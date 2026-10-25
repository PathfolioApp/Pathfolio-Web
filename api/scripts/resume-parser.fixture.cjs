// Synthetic source document: no real contact details or student data.
const fs=require('node:fs');
const path=require('node:path');
const {PDFDocument,StandardFonts,PDFName,PDFString}=require('pdf-lib');
const lines=[
  'RIYA MEHTA',
  'Backend Engineering Student',
  'riya.qa@example.test',
  'LinkedIn | Pantry Cart demo',
  'SUMMARY',
  'Computer science student with Python API and JavaScript project experience.',
  'EDUCATION',
  'National Institute of Technology Tiruchirappalli',
  'B.Tech in Computer Science | 2023 - 2027',
  'CGPA: 8.10/10',
  'EXPERIENCE',
  'Backend Intern - Harbor Systems | Jun 2026 - Aug 2026',
  '- Implemented authentication endpoints using Python and Flask.',
  '- Wrote 12 API test cases. Did not lead a team.',
  'PROJECTS',
  'Pantry Cart | Jan 2026 - Feb 2026',
  'Technologies: JavaScript, Node.js, Express.js, MySQL',
  '- Built a product catalogue and shopping cart.',
  '- Developed order APIs; no payment processing was implemented.',
  'TECHNICAL SKILLS',
  'Languages: Java, JavaScript, Python',
  'Frameworks: Flask, Node.js, Express.js',
  'Databases: MySQL',
  'CERTIFICATIONS',
  'Cloud Fundamentals - Example Academy | 2025',
];
const text=lines.join('\n');
const expected={fullName:'RIYA MEHTA',email:'riya.qa@example.test',phone:'',institution:'National Institute of Technology Tiruchirappalli',project:'Pantry Cart',projectStack:['JavaScript','Node.js','Express.js','MySQL'],personalLink:'https://linkedin.com/in/riya-parser-qa',projectLink:'https://example.test/pantry/demo'};
async function createFixture(output='tmp/resume-parser-audit/source.pdf'){
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const doc=await PDFDocument.create();doc.setTitle('Synthetic Resume Parser QA');
  const page=doc.addPage([595.28,841.89]);const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  let y=798;
  for(const [i,line] of lines.entries()){
    const heading=/^[A-Z ]+$/.test(line);page.drawText(line,{x:42,y,size:i===0?18:heading?11:10,font:heading?bold:regular});
    if(i===3){
      const annotations=[[42,expected.personalLink],[105,expected.projectLink]].map(([x,url])=>doc.context.register(doc.context.obj({Type:PDFName.of('Annot'),Subtype:PDFName.of('Link'),Rect:[x,y-2,x+58,y+12],Border:[0,0,0],A:{S:PDFName.of('URI'),URI:PDFString.of(url)}})));
      page.node.set(PDFName.of('Annots'),doc.context.obj(annotations));
    }
    y-=heading?24:22;
  }
  fs.writeFileSync(output,await doc.save({useObjectStreams:false}));
  fs.writeFileSync(path.join(path.dirname(output),'source.txt'),text);
  return output;
}
if(require.main===module)createFixture().then(file=>console.log(file));
module.exports={lines,text,expected,createFixture};
