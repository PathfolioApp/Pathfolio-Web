const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {load,candidate}=require('./jd-analyzer-audit.cjs');

function embeddingService(fetch, {key='fixture',fastTimers=false}={}) {
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/modules/admin/embedding.service.js'),'utf8'),{
    module, require:name=>{assert.equal(name,'../../config');return {geminiApiKey:key};},fetch,AbortController,
    setTimeout:(fn,ms)=>setTimeout(fn,fastTimers?Math.min(ms,5):ms),clearTimeout,console:{warn(){}},
  });
  return module.exports;
}
function embeddingStore(getEmbedding) {
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/modules/admin/embeddingStore.js'),'utf8'),{
    module,require:name=>name==='crypto'?require('node:crypto'):{getEmbedding},
  });
  return module.exports;
}
const validVector=()=>Array.from({length:768},(_,i)=>i===0?1:0);
const response=values=>({ok:true,json:async()=>({embedding:{values}})});

test('embedding rejects invalid vectors and safely handles provider errors',async t=>{
  for(const values of [[],[1,0],Array(768).fill(0),Array(768).fill(Infinity),Array(768).fill('1')]) await t.test(`invalid vector ${typeof values[0]} length ${values.length}`,async()=>{
    assert.equal(await embeddingService(async()=>response(values)).getEmbedding('Java backend'),null);
  });
  for(const status of [401,403,429,500,503]) await t.test(`HTTP ${status}`,async()=>{
    let calls=0;const service=embeddingService(async()=>{calls++;return {ok:false,status};});
    assert.equal(await service.getEmbedding('JD'),null);assert.equal(await service.getEmbedding('Student'),null);assert.equal(calls,1,'Failure cooldown prevents a cohort-wide retry storm');
  });
  const service=embeddingService(async()=>response(validVector()));
  assert.equal((await service.getEmbedding('Java backend')).length,768);
  assert.equal(service.cosineSimilarity([1,0],[1,0]),1);
  assert.ok(Number.isNaN(service.cosineSimilarity([1],[NaN])));
});

test('embedding without credentials never calls network',async()=>{
  assert.equal(await embeddingService(()=>{throw Error('Unexpected call');},{key:null}).getEmbedding('JD'),null);
});

test('embedding aborts a stalled response body and clears its slot',async()=>{
  const service=embeddingService(async(_url,{signal})=>({ok:true,json:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('Aborted'),{name:'AbortError'})),{once:true}))}),{fastTimers:true});
  assert.equal(await service.getEmbedding('JD'),null);
});

test('embedding concurrency is bounded across independent callers',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});let calls=0;
  const service=embeddingService(async()=>{calls++;await gate;return response(validVector());});
  const pending=Array.from({length:12},(_,i)=>service.getEmbedding(`JD ${i}`));
  assert.equal(calls,4);
  release();
  const results=await Promise.all(pending);
  assert.equal(results.filter(Boolean).length,4);
});

test('cache separates task types, deduplicates in-flight work and honors fresh-call budget',async()=>{
  let calls=0;const tasks=[];
  const store=embeddingStore(async(_text,task)=>{calls++;tasks.push(task);return validVector();});
  await Promise.all(Array.from({length:20},()=>store.getStudentEmbedding('Same Java profile')));
  assert.equal(calls,1);
  await store.getJdEmbedding('Same Java profile');assert.equal(calls,2);
  assert.notEqual(tasks[0],tasks[1]);
  const budget={remaining:1,deadlineAt:Date.now()+1000};
  await store.getStudentEmbedding('First new profile',{budget});
  assert.equal(await store.getStudentEmbedding('Second new profile',{budget}),null);
  assert.equal(calls,3);
  assert.ok(await store.getStudentEmbedding('First new profile',{budget}),'Cache hit is allowed after fresh-call budget ends');
});

test('failed embeddings are negatively cached without repeated provider calls',async()=>{
  let calls=0;const store=embeddingStore(async()=>{calls++;return null;});
  await store.getStudentEmbedding('Profile');await store.getStudentEmbedding('Profile');assert.equal(calls,1);
});

test('partial semantic enrichment never mixes incomparable ranking scores',async()=>{
  let count=0;
  const result=await load([candidate('a'),candidate('b')],{getJdEmbedding:async()=>[1,0],getStudentEmbedding:async()=>++count===1?[1,0]:null}).analyze({useSemantic:true,jobDescription:'Java backend developer building REST APIs.'});
  assert.equal(result.scoring.mode,'deterministic');
  for(const c of result.candidates)assert.equal(c.score,c.deterministicScore);
});

test('full semantic enrichment is identified and all scores remain finite',async()=>{
  const result=await load([candidate('a'),candidate('b')],{getJdEmbedding:async()=>[1,0],getStudentEmbedding:async()=>[1,0]}).analyze({useSemantic:true,jobDescription:'Java backend developer building REST APIs.'});
  assert.equal(result.scoring.mode,'hybrid');
  assert.equal(result.scoring.semanticProfiles,2);
  assert.ok(result.candidates.every(c=>Number.isFinite(c.score)));
});

test('eligibility distinguishes absent requirements from missing evidence',async()=>{
  const service=load([candidate('a',{cgpa:8,activeBacklogs:null})]);
  const none=await service.analyze({jobDescription:'Java developer building backend services and APIs.'});
  assert.equal(none.candidates[0].eligibilityStatus,'not_specified');
  const required=await service.analyze({jobDescription:'Java developer with no active backlogs. Minimum CGPA 7.0.'});
  assert.equal(required.candidates[0].eligibilityStatus,'review');
  assert.ok(required.candidates[0].eligibilityFlags.some(flag=>/Backlog/.test(flag)));
});

test('dual-role student remains eligible for discovery, blocked and operator-only accounts do not',async()=>{
  const result=await load([{...candidate('a'),isAdmin:true,rollNumber:'23051486'},{...candidate('b'),isAdmin:true,rollNumber:'EXT-123'},{...candidate('c'),blocked:true}]).analyze({jobDescription:'Java developer building backend services and APIs.'});
  assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].id,'a');
});

test('role evidence counts do not credit unrelated projects and internships',async()=>{
  const student={...candidate('a'),projects:[{projectName:'Music',technologies:['Swift']}],internships:[{role:'Finance',skills:['Excel']}]};
  const result=await load([student]).analyze({jobDescription:'Java Spring Boot backend developer building REST APIs.'});
  assert.equal(result.candidates[0].evidence.projects,0);assert.equal(result.candidates[0].evidence.internships,0);
});

test('input size, type, fresher range and valid B.E. qualification',()=>{
  const service=load();
  for(const jobDescription of ['x'.repeat(30001),{text:'Not a string'}]) assert.throws(()=>service.analyzeOnly({jobDescription}));
  const result=service.analyzeOnly({jobDescription:'Backend engineer, 0–1 years. B.E. degree required. Java development.'});
  assert.equal(result.experienceLabel,'0–1 years');
  assert.ok(result.education.includes('Bachelor of Engineering (B.E.)'));
});

test('malformed legacy collections do not break analysis or frontend array contracts',async()=>{
  const student={...candidate('a'),projects:[null,{projectName:'Java API',technologies:'Java',contributions:null}],internships:{bad:true},achievements:[null],interests:{hobbies:{bad:true},passions:null}};
  const result=await load([student]).analyze({jobDescription:'Java developer building backend services and APIs.'});
  assert.equal(result.candidates.length,1);assert.ok(Number.isFinite(result.candidates[0].score));
  assert.ok(Array.isArray(result.candidates[0].projects[0].technologies));
});

test('cache enforces its entry limit and honors expired request budgets',async()=>{
  let calls=0;const store=embeddingStore(async()=>{calls++;return validVector();});
  assert.equal(await store.getStudentEmbedding('Expired',{budget:{remaining:24,deadlineAt:Date.now()-1}}),null);
  assert.equal(calls,0);
  for(let i=0;i<5000;i++)store.cache.set(`fixture-${i}`,{vector:null,expiresAt:Date.now()+1000});
  await store.getStudentEmbedding('One more');assert.equal(store.cache.size,5000);
});

test('stalled JD embedding falls back within the response deadline',async()=>{
  const service=load([candidate('a')],{getJdEmbedding:()=>new Promise(()=>{})},{setTimeout:fn=>setTimeout(fn,5)});
  const result=await service.analyze({useSemantic:true,jobDescription:'Java developer building backend services and APIs.'});
  assert.equal(result.scoring.mode,'deterministic');assert.equal(result.candidates.length,1);
});

test('stalled student query returns a retryable error rather than an endless request',async()=>{
  const service=load([],undefined,{listStudents:()=>new Promise(()=>{}),setTimeout:fn=>setTimeout(fn,5)});
  await assert.rejects(service.analyze({jobDescription:'Java developer building backend services and APIs.'}),error=>error.statusCode===503);
});

test('only two cohort analyses can run at once and slots are released',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const service=load([candidate('a')],{getJdEmbedding:async()=>{await gate;return null;}});
  const input={useSemantic:true,jobDescription:'Java developer building backend services and APIs.'};
  const first=service.analyze(input),second=service.analyze(input);
  await assert.rejects(service.analyze(input),error=>error.statusCode===503);
  release();await Promise.all([first,second]);
  assert.equal((await service.analyze(input)).candidates.length,1);
});

test('default analysis never transmits profile text to an embedding provider',async()=>{
  let calls=0;
  const service=load([candidate('a')],{getJdEmbedding:()=>{calls++;throw Error('Unexpected transmission');},getStudentEmbedding:()=>{calls++;throw Error('Unexpected transmission');}});
  const result=await service.analyze({jobDescription:'Java developer building backend services and APIs.'});
  assert.equal(result.scoring.mode,'deterministic');assert.match(result.scoring.explanation,/off/);
  assert.equal(calls,0);
});

test('related tools and ordinary words are not falsely credited as named technologies',()=>{
  const result=load().analyzeOnly({jobDescription:'Use Vite, Zustand, Adobe XD and caching. Complete the next task in less than a day.'});
  for(const skill of ['React','Redux','Figma','Redis','Next.js','HTML & CSS'])assert.ok(!result.skills.includes(skill),skill);
});
