const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { good } = require('./resume-parser-audit.cjs');

function gemini(fetch) {
  const module = { exports: {} }, timers = new Set();
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/shared/gemini.service.js'),'utf8'), {
    module, Buffer, AbortController, console: { warn() {} }, require: () => ({geminiApiKey:'fixture'}), fetch,
    setTimeout(fn,ms) { const timer={fn,ms}; timers.add(timer); return timer; }, clearTimeout(timer) { timers.delete(timer); },
  });
  return {...module.exports, timers};
}
const response = data => ({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}]})});

test('Gemini keeps body reads inside the timeout and clears timers',async()=>{
  let client, protectedBody=false;
  client=gemini(async()=>({ok:true,json:async()=>{protectedBody=client.timers.size>0;return {candidates:[{content:{parts:[{text:JSON.stringify(good())}]}}]};}}));
  assert.ok(await client.parseResumeText('Synthetic resume '.repeat(8)));
  assert.equal(protectedBody,true);assert.equal(client.timers.size,0);
});
test('Gemini network errors and malformed collections reach a clean null fallback',async()=>{
  for(const fetch of [async()=>{throw Error('Network failure');},async()=>response({...good(),projects:'invalid'}),async()=>response({...good(),education:[null]})]){
    const client=gemini(fetch);assert.equal(await client.parseResumeText('Synthetic resume '.repeat(8)),null);assert.equal(client.timers.size,0);
  }
});
test('Gemini stalled body aborts and releases its timer',async()=>{
  let signal;
  const client=gemini(async(_url,options)=>{signal=options.signal;return {ok:true,json:()=>new Promise(()=>{})};});
  const pending=client.parseResumeText('Synthetic resume '.repeat(8),{maxAttempts:1});
  await Promise.resolve();const timer=[...client.timers][0];assert.ok(timer);timer.fn();
  assert.equal(await pending,null);assert.equal(signal.aborted,true);assert.equal(client.timers.size,0);
});
test('Expired Gemini deadline makes no network request',async()=>{
  let calls=0;const client=gemini(async()=>{calls++;return response(good());});
  assert.equal(await client.parseResumeText('Synthetic resume '.repeat(8),{deadlineAt:Date.now()-1}),null);assert.equal(calls,0);
});

function controller(original, analysis) {
  const module={exports:{}};let update=null,error=null;
  const deps={crypto:require('node:crypto'),'./resumeStore':{findOwnedResume:async()=>original,updateAnalysis:async(...args)=>{update=args;return {extractedData:args[2].structured};}},
    './r2.service':{getFile:async()=>({Body:Buffer.from('%PDF-fixture')})},'./resumeAnalysis':{analysePdf:async()=>analysis},
    './tailorResume.service':{},'./resumePdf.service':{},'./resumeDocument.service':{},'./resumeValidation':require('../src/modules/resumes/resumeValidation')};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/modules/resumes/resume.controller.js'),'utf8'),{module,Buffer,require:name=>deps[name]});
  return {async run(){await module.exports.analyze({student:{id:'owner'},params:{resumeId:1}},{json(){}},e=>{error=e;});return {update,error};}};
}
test('Successful reparse saves one recovery snapshot and keeps layout metadata',async()=>{
  const original={filepath:'fixture.pdf',extractedData:{...good(),studioLayout:{version:1,template:'compact',isCompact:true}}};
  const result=await controller(original,{parserReady:true,structured:good()}).run();
  assert.equal(result.error,null);assert.ok(result.update);assert.deepEqual(JSON.parse(JSON.stringify(result.update[2].previousExtraction)),original.extractedData);
  assert.deepEqual(JSON.parse(JSON.stringify(result.update[2].structured.studioLayout)),original.extractedData.studioLayout);
  assert.deepEqual(JSON.parse(JSON.stringify(result.update[3].extractedData)),original.extractedData);
});
test('Partial reparse cannot erase a skill, link, project technology or negated bullet',async()=>{
  for(const mutate of [d=>{d.skills.raw.pop();},d=>{d.projects[0].liveUrl='';},d=>{d.projects[0].technologies='JavaScript';},d=>{d.experience[0].bullets[1]='Wrote 12 API test cases. Led a team.';}]){
    const next=good();mutate(next);const result=await controller({filepath:'fixture.pdf',extractedData:good()},{parserReady:true,structured:next}).run();
    assert.equal(result.update,null);assert.equal(result.error?.statusCode,409);
  }
});
function store(pool=null) {
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/modules/resumes/resumeStore.js'),'utf8'),{module,require:name=>name==='../../config'?{}:name==='mysql2/promise'?{}:require(name)});
  module.exports.pool=pool;return module.exports;
}
test('In-memory reparse persistence refuses concurrent edits',async()=>{
  const db=store(), data=good();db.resumes.set(1,{studentId:'owner',filepath:'fixture.pdf',extractedData:data});
  const expected=JSON.parse(JSON.stringify({filepath:'fixture.pdf',extractedData:data}));data.personal.headline='Manually edited headline';
  await assert.rejects(db.updateAnalysis('owner',1,{structured:good()},expected),e=>e.statusCode===409);
  assert.equal(db.resumes.get(1).extractedData.personal.headline,'Manually edited headline');
});
test('MySQL reparse locks the source and rolls back on concurrent edits',async()=>{
  const calls=[];const connection={beginTransaction:async()=>calls.push('begin'),execute:async(sql)=>{calls.push(sql);return [[{filepath:'fixture.pdf',extracted_data:{...good(),personal:{fullName:'Newer Edit'}}}]];},commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>calls.push('release')};
  const db=store({getConnection:async()=>connection});
  await assert.rejects(db.updateAnalysis('owner',1,{structured:good()},{filepath:'fixture.pdf',extractedData:good()}),e=>e.statusCode===409);
  assert.ok(calls.some(sql=>sql.includes('FOR UPDATE')));assert.ok(!calls.some(sql=>sql.startsWith('UPDATE')));
  assert.ok(calls.includes('rollback'));assert.ok(calls.includes('release'));
});
