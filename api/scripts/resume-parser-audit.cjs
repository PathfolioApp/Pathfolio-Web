// Audit only: no .env, database, storage, real resumes or provider requests.
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {createRequire}=require('node:module');const assert=require('node:assert/strict');
const {text,lines,expected,createFixture}=require('./resume-parser.fixture.cjs');
const validation=require('../src/modules/resumes/resumeValidation');
const auditDir=path.resolve(__dirname,'../../tmp/resume-parser-audit');
const results=[];
const good=()=>({personal:{fullName:expected.fullName,email:expected.email,phone:''},summary:{text:'Computer science student with Python API and JavaScript project experience.'},education:[{title:'B.Tech in Computer Science',institution:expected.institution,dates:'2023 - 2027'}],experience:[{title:'Backend Intern',company:'Harbor Systems',bullets:['Implemented authentication endpoints using Python and Flask.','Wrote 12 API test cases. Did not lead a team.']}],projects:[{title:'Pantry Cart',technologies:expected.projectStack.join(', '),liveUrl:expected.projectLink,bullets:['Built a product catalogue and shopping cart.','Developed order APIs; no payment processing was implemented.']}],skills:{languages:['Java','JavaScript','Python'],frameworks:['Flask','Node.js','Express.js'],databasesTools:['MySQL'],raw:['Java','JavaScript','Python','Flask','Node.js','Express.js','MySQL']}});
function load({config={},gemini={},fetch=async()=>{throw Error('Unexpected network');},pdfParse}={}){
  const module={exports:{}};const timers=new Set();let bodyProtected=false;
  const filename=path.resolve(__dirname,'../src/modules/resumes/resumeAnalysis.js');const realRequire=createRequire(filename);
  const customRequire=name=>name==='../../config'?config:name==='../../shared/gemini.service'?{parseResumeText:async()=>null,parseResumePdf:async()=>null,...gemini}:name==='pdf-parse'&&pdfParse?pdfParse:realRequire(name);
  customRequire.resolve=realRequire.resolve;
  vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.audit={normalizeLlmStructured,extractContact,extractSections};',{
    module,require:customRequire,Buffer,URL,process:{env:{}},AbortController,console:{log(){},warn(){}},
    setTimeout:(fn,ms)=>{const timer={fn,ms};timers.add(timer);return timer;},clearTimeout:timer=>timers.delete(timer),
    fetch:(...args)=>fetch(...args,{timers,setBodyProtected:value=>{bodyProtected=value;}}),
  });
  return {...module.exports,timers,get bodyProtected(){return bodyProtected;}};
}
async function check(name,fn){try{const observed=await fn();results.push({name,passed:true,observed});}catch(error){results.push({name,passed:false,details:error.message});}}
async function main(){
  if(!fs.existsSync(path.join(auditDir,'source.pdf'))) await createFixture(path.join(auditDir,'source.pdf'));
  const offline=load();
  await check('Reject non-PDF upload signature',()=>assert.throws(()=>validation.validatePdfBuffer(Buffer.from('not pdf'))));
  await check('Reject truncated PDF rather than accepting an empty successful analysis',async()=>{await assert.rejects(offline.analysePdf(Buffer.from('%PDF-not-a-document')));});
  await check('Deterministic parser preserves source name and email',async()=>{const a=await offline.analyseText(text,1);assert.equal(a.structured.personal.fullName,expected.fullName);assert.equal(a.structured.personal.email,expected.email);return a.structured.extractionMethod;});
  await check('Missing phone is not inferred from education date range',async()=>{const a=await offline.analyseText(text,1);assert.equal(a.structured.personal.phone,'');return a.structured.personal.phone;});
  await check('Well-formed AI parse retains explicit institution',async()=>{const service=load({config:{geminiApiKey:'fixture'},gemini:{parseResumeText:async()=>good()}});const a=await service.analyseText(text,1);assert.equal(a.structured.education[0].institution,expected.institution);});
  await check('AI-invented project technology is rejected against that project',async()=>{const draft=good();draft.projects[0].technologies+=' , Java, Spring Boot';const service=load({config:{geminiApiKey:'fixture'},gemini:{parseResumeText:async()=>draft}});const a=await service.analyseText(text,1);assert.ok(!a.structured.projects[0].technologies.includes('Spring Boot'));assert.ok(!/(?:^|[, ])Java(?:[, ]|$)/.test(a.structured.projects[0].technologies));});
  await check('AI-invented employer, metrics and ownership are rejected',async()=>{const draft=good();draft.experience[0]={title:'Team Lead',company:'Invented Employer',bullets:['Led 30 engineers and improved throughput by 70%.']};const service=load({config:{geminiApiKey:'fixture'},gemini:{parseResumeText:async()=>draft}});const a=await service.analyseText(text,1);assert.ok(!JSON.stringify(a.structured).includes('Invented Employer'));assert.ok(!JSON.stringify(a.structured).includes('70%'));});
  await check('AI-invented contact URL and email are rejected',async()=>{const draft=good();draft.personal.email='invented@example.test';draft.personal.links=['https://invented.example.test'];const a=await load({config:{geminiApiKey:'fixture'},gemini:{parseResumeText:async()=>draft}}).analyseText(text,1);assert.equal(a.structured.personal.email,expected.email);assert.ok(!a.structured.personal.links.some(url=>url.includes('invented')));});
  await check('Malformed AI collection falls back instead of crashing',async()=>{const draft=good();draft.projects='wrong shape';const a=await load({config:{geminiApiKey:'fixture'},gemini:{parseResumeText:async()=>draft}}).analyseText(text,1);assert.ok(Array.isArray(a.structured.projects));});
  await check('Null AI collection entries fall back instead of crashing',async()=>{const draft=good();draft.education=[null];const a=await load({config:{geminiApiKey:'fixture'},gemini:{parseResumeText:async()=>draft}}).analyseText(text,1);assert.ok(Array.isArray(a.structured.education));});
  await check('Groq fallback is used when Gemini is unavailable',async()=>{let calls=0;const a=await load({config:{groqApiKey:'fixture'},fetch:async()=>{calls++;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(good())}}]})};}}).analyseText(text,1);assert.equal(calls,1);assert.equal(a.structured.extractionMethod,'llm-groq');});
  await check('Provider outages return deterministic extraction',async()=>{const service=load({config:{groqApiKey:'fixture'},fetch:async()=>({ok:false,status:429,text:async()=>''})});const a=await service.analyseText(text,1);assert.equal(a.structured.extractionMethod,'pdf-text');});
  await check('Network exceptions clear every provider timer',async()=>{const service=load({config:{groqApiKey:'fixture'},fetch:async()=>{throw TypeError('Fixture network failure');}});await service.analyseText(text,1);assert.equal(service.timers.size,0);});
  await check('Provider timeout remains active while reading JSON body',async()=>{let protectedBody=false;const service=load({config:{groqApiKey:'fixture'},fetch:async(_url,_options,{timers})=>({ok:true,json:async()=>{protectedBody=timers.size>0;return {choices:[{message:{content:JSON.stringify(good())}}]};}})});await service.analyseText(text,1);assert.equal(protectedBody,true);});
  await check('Groq fallback does not repeat the configured default model',async()=>{const models=[];const service=load({config:{groqApiKey:'fixture',groqModel:'openai/gpt-oss-120b'},fetch:async(_url,options)=>{models.push(JSON.parse(options.body).model);return {ok:false,status:429,text:async()=>''};}});await service.analyseText(text,1);assert.equal(new Set(models).size,models.length);return models;});
  await check('Selectable PDF annotation links remain available in extraction',async()=>{const a=await offline.analysePdf(fs.readFileSync(path.join(auditDir,'source.pdf')));assert.ok(a.sourceText.includes(expected.personalLink));assert.ok(a.sourceText.includes(expected.projectLink));return {pages:a.pages};});
  await check('Selectable PDF retains its text layer for deterministic verification',async()=>{const a=await offline.analysePdf(fs.readFileSync(path.join(auditDir,'source.pdf')));assert.ok(a.sourceText.includes('RIYA MEHTA'));return {characters:a.sourceText.length};});
  await check('Reparse checks ownership before reading stored files',async()=>{const module={exports:{}};let reads=0,updates=0;const deps={crypto:require('node:crypto'),'./resumeStore':{findOwnedResume:async()=>null,updateAnalysis:async()=>{updates++;}},'./r2.service':{getFile:async()=>{reads++;}},'./resumeAnalysis':{},'./tailorResume.service':{},'./resumePdf.service':{},'./resumeDocument.service':{},'./resumeValidation':validation};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/modules/resumes/resume.controller.js'),'utf8'),{module,Buffer,require:name=>deps[name]});let error;await module.exports.analyze({student:{id:'owner'},params:{resumeId:'not-owned'}},{},err=>{error=err;});assert.equal(error.statusCode,404);assert.equal(reads,0);assert.equal(updates,0);});
  await check('Empty failed reparse does not overwrite previously extracted information',async()=>{const module={exports:{}};let updates=0;const original={filepath:'fixture.pdf',extractedData:good()};const deps={crypto:require('node:crypto'),'./resumeStore':{findOwnedResume:async()=>original,updateAnalysis:async()=>{updates++;return original;}},'./r2.service':{getFile:async()=>({Body:Buffer.from('%PDF-fixture')})},'./resumeAnalysis':{analysePdf:async()=>({parserReady:false,structured:{personal:{fullName:''},projects:[]}})},'./tailorResume.service':{},'./resumePdf.service':{},'./resumeDocument.service':{},'./resumeValidation':validation};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/modules/resumes/resume.controller.js'),'utf8'),{module,Buffer,require:name=>deps[name]});await module.exports.analyze({student:{id:'owner'},params:{resumeId:'fixture'}},{json(){}},()=>{});assert.equal(updates,0);});
  const shared=await import('../../shared/resume/resumeDocument.mjs');
  await check('Studio normalization handles malformed entries safely',()=>{const source=good();source.education=[null];assert.doesNotThrow(()=>shared.normalizeExtractedData(source,null));});
  await check('Studio import does not fill source schooling from logged-in account',()=>{const source=good();source.education[0].bullets=['Class X: 92%'];const normalized=shared.normalizeExtractedData(source,{academic:{tenthSchool:'Different Account School',tenthYear:'1999',tenthPercentage:55}});assert.ok(!JSON.stringify(normalized).includes('Different Account School'));assert.ok(!JSON.stringify(normalized).includes('1999'));});
  await check('Studio education presentation does not invent institution or city',()=>{const normalized=shared.normalizeExtractedData({education:[{title:'B.Tech',institution:'University',dates:'2023 - 2027'}]},null);const html=shared.printable(normalized,'classic');assert.ok(!html.includes('Kalinga Institute'));assert.ok(!html.includes('Bhubaneswar'));});

  await check('AI extraction retains project bullets, exact stack and negations without polluting skills', async()=>{
    const a=await load({config:{geminiApiKey:'fixture'},gemini:{parseResumeText:async()=>good()}}).analyseText(text,1);
    assert.equal(a.structured.projects.length,1);
    assert.equal(a.structured.projects[0].technologies,expected.projectStack.join(', '));
    assert.deepEqual(Array.from(a.structured.projects[0].bullets),good().projects[0].bullets);
    assert.ok(!a.structured.skills.raw.some(value=>/payment|catalogue|implemented/i.test(value)));
    assert.ok(!a.structured.documentLinks.includes('https://b.tech'));
  });
  await check('Annotation-only profile and project links survive AI omissions and repeated extraction', async()=>{
    const service=load({config:{geminiApiKey:'fixture'},gemini:{parseResumePdf:async()=>good()}});
    for(let i=0;i<2;i++){
      const a=await service.analysePdf(fs.readFileSync(path.join(auditDir,'source.pdf')));
      assert.ok(a.structured.personal.links.includes(expected.personalLink));
      assert.equal(a.structured.projects[0].liveUrl,expected.projectLink);
      assert.ok(a.structured.documentLinks.includes(expected.projectLink));
      assert.equal(a.structured.certifications.length,1);
    }
  });
  await check('Plausible locations absent from source are not inferred from institutions', async()=>{
    const draft=good();draft.personal.location='Tiruchirappalli, India';draft.education[0].location='Tiruchirappalli';
    const a=await load({config:{geminiApiKey:'fixture'},gemini:{parseResumeText:async()=>draft}}).analyseText(text,1);
    assert.equal(a.structured.personal.location,'');assert.equal(a.structured.education[0].location,'');
  });
  await check('Deterministic fallback retains project evidence and source-only stack', async()=>{
    const a=await load().analyseText(text,1);
    assert.equal(a.structured.projects[0].technologies,expected.projectStack.join(', '));
    assert.deepEqual(Array.from(a.structured.projects[0].bullets),good().projects[0].bullets);
    assert.equal(a.structured.skills.raw.length,7);
  });
  await check('Scanned documents return actionable extraction failure instead of empty success', async()=>{
    await assert.rejects(load({pdfParse:async()=>({text:'',numpages:1})}).analysePdf(Buffer.from('%PDF-fixture')),error=>error.statusCode===422 && /OCR/.test(error.message));
  });
  await check('Extraction retains text beyond 400 lines without silent truncation', async()=>{
    const a=await load().analyseText(text+'\nACHIEVEMENTS\n'+Array.from({length:420},(_,i)=>'Award '+i).join('\n')+'\nFinal Source Award',1);
    assert.ok(JSON.stringify(a.structured).includes('Final Source Award'));
  });
  await check('Actual phone numbers remain available while date-only lines are excluded', async()=>{
    const a=await load().analyseText(text.replace(expected.email,expected.email+' | +91 98765 43210'),1);
    assert.equal(a.structured.personal.phone,'+91 98765 43210');
  });
  await check('Fresh process accepts the fixture PDF using the selected bundled PDF reader', async()=>{
    const {execFileSync}=require('node:child_process');
    const child=execFileSync(process.execPath,['-e',"const fs=require('node:fs');const {load}=require('./api/scripts/resume-parser-audit.cjs');load().analysePdf(fs.readFileSync('tmp/resume-parser-audit/source.pdf')).then(a=>{if(a.pages!==1||!a.sourceText.includes('RIYA MEHTA'))process.exit(1)}).catch(()=>process.exit(1));"],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'});
    return {freshProcess:true};
  });
  const output={checks:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
  fs.mkdirSync(auditDir,{recursive:true});fs.writeFileSync(path.join(auditDir,'diagnostics.json'),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));process.exitCode=output.failed?1:0;
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={load,good};
