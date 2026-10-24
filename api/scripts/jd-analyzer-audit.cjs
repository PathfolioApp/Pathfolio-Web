// Reproducible audit/regression checks. Records failed expectations explicitly;
// never uses .env, real students, network, or production caches.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const results=[];
function load(students=[], embeddings={getJdEmbedding:async()=>null,getStudentEmbedding:async()=>null}, options={}){
  const module={exports:{}};
  const dependencies={
    '../students/studentStore':{listStudents:options.listStudents || (async()=>students)},
    '../../shared/textMatch':require('../src/shared/textMatch'),
    './embeddingStore':embeddings,
    './embedding.service':{cosineSimilarity:(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0)},
    '../../shared/logger':{api:{warn(){},error(){}}},
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/modules/admin/jdAnalyzer.service.js'),'utf8'),{module,setTimeout:options.setTimeout || setTimeout,clearTimeout,require:name=>{assert.ok(name in dependencies,name);return dependencies[name];}});
  return module.exports;
}
const candidate=(id,academic={cgpa:8,activeBacklogs:0})=>({id,personal:{fullName:`Fixture ${id}`},academic,projects:[{projectName:'Backend',technologies:['Java']}],internships:[],achievements:[],interests:{},onboarding:{completed:true}});
async function check(name,action){try{const observed=await action();results.push({name,passed:true,observed});}catch(error){results.push({name,passed:false,details:error.message});}}
async function main(){
  const service=load();
  await check('Reject short JD',()=>{assert.throws(()=>service.analyzeOnly({jobDescription:'too short'}));});
  await check('JavaScript is not Java',()=>{const a=service.analyzeOnly({jobDescription:'JavaScript developer building web applications.'});assert.ok(a.skills.includes('JavaScript'));assert.ok(!a.skills.includes('Java'));return a.skills;});
  await check('CGPA 7.0 without "of" is detected',()=>{const a=service.analyzeOnly({jobDescription:'Java developer. Minimum CGPA 7.0. Build APIs.'});assert.equal(a.minCgpa,7);return a.minCgpa;});
  await check('Built-in sample wording CGPA of 7.0 is detected',()=>{const a=service.analyzeOnly({jobDescription:'Java developer. Minimum CGPA of 7.0 with no active backlogs.'});assert.equal(a.minCgpa,7);return a.minCgpa;});
  await check('Fresher 0-1 years does not become 1+ years',()=>{const a=service.analyzeOnly({jobDescription:'Java developer, fresher, 0-1 years of experience. Build APIs.'});assert.equal(a.experienceYears,0);return a.experienceYears;});
  await check('Ordinary word be is not a B.E. qualification',()=>{const a=service.analyzeOnly({jobDescription:'Candidates should be comfortable building React applications.'});assert.equal(a.education.length,0);return a.education;});
  await check('Negated Java is not a required skill',()=>{const a=service.analyzeOnly({jobDescription:'Frontend developer. Java is not required. Use JavaScript and React.'});assert.ok(!a.skills.includes('Java'));return a.skills;});
  await check('Soft communication requirement does not imply ECE eligibility',()=>{const a=service.analyzeOnly({jobDescription:'React developer. Strong communication skills and teamwork required.'});assert.ok(!a.departments.includes('Electronics & Communication Engineering'));return a.departments;});
  await check('No-provider deterministic fallback returns finite scores',async()=>{const a=await load([candidate('a')]).analyze({jobDescription:'Java backend engineer building REST APIs with SQL.'});assert.ok(Number.isFinite(a.candidates[0].score));assert.equal(a.candidates[0].score,a.candidates[0].deterministicScore);return a.stats;});
  await check('Embedding failure falls back without losing candidates',async()=>{const a=await load([candidate('a')],{getJdEmbedding:async()=>{throw Error('Fixture outage');}}).analyze({useSemantic:true,jobDescription:'Java backend engineer building REST APIs with SQL.'});assert.equal(a.candidates.length,1);assert.ok(Number.isFinite(a.candidates[0].score));return a.stats;});
  await check('Missing or invalid CGPA is not treated as meeting minimum',async()=>{const a=await load([candidate('a',{cgpa:'not-a-number',activeBacklogs:0})]).analyze({jobDescription:'Java developer. Minimum CGPA 7.0. Build APIs.'});assert.ok(a.candidates[0].eligibilityFlags.some(x=>/CGPA/i.test(x)));return a.candidates[0].eligibilityFlags;});
  await check('Required degree mismatch is flagged for eligibility review',async()=>{const a=await load([candidate('a',{cgpa:8,degreeProgram:'B.Tech',activeBacklogs:0})]).analyze({jobDescription:'Java developer. Master of Technology required. Build backend services.'});assert.ok(a.candidates[0].eligibilityFlags.length>0);return a.candidates[0].eligibilityFlags;});
  await check('Suspended and incomplete profiles are excluded',async()=>{const a=await load([candidate('a'),{...candidate('b'),status:'suspended'},{...candidate('c'),onboarding:{completed:false}}]).analyze({jobDescription:'Java developer building backend services and APIs.'});assert.equal(a.candidates.length,1);return a.stats;});
  await check('Null/incomplete legacy profile sections do not crash the batch',async()=>{const a=await load([{...candidate('a'),personal:null,academic:null}]).analyze({jobDescription:'Java developer building backend services and APIs.'});assert.equal(a.candidates.length,1);return a.stats;});
  await check('Null academic section with required CGPA does not crash the batch',async()=>{const a=await load([{...candidate('a'),academic:null}]).analyze({jobDescription:'Java developer. Minimum CGPA 7.0. Build APIs.'});assert.equal(a.candidates.length,1);assert.ok(a.candidates[0].eligibilityFlags.length);return a.stats;});
  await check('Recruiter-only accounts are not ranked as student candidates',async()=>{const a=await load([{...candidate('a'),isRecruiter:true,isAdmin:false}]).analyze({jobDescription:'Java developer building backend services and APIs.'});assert.equal(a.candidates.length,0);return a.stats;});
  await check('Candidate embedding concurrency is bounded below cohort size',async()=>{let active=0,peak=0;const a=await load(Array.from({length:80},(_,i)=>candidate(String(i))),{getJdEmbedding:async()=>[1,0],getStudentEmbedding:async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;return [1,0];}}).analyze({useSemantic:true,jobDescription:'Java developer building backend services and APIs.',limit:5});assert.ok(peak>0 && peak<=4,`Observed ${peak} simultaneous candidate embedding requests for 80 profiles (limit=5).`);return {peak,returned:a.candidates.length};});
  const report={checks:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
  fs.mkdirSync(path.resolve('tmp'),{recursive:true});
  fs.writeFileSync(path.resolve('tmp/admin-jd-audit.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.failed?1:0;
}
if (require.main === module) main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={load,candidate};
