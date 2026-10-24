// Content policy only. Layout, print CSS, margins, and export remain in the shared renderer.
const aliases = new Map([
  ['nodejs', 'node.js'], ['express', 'express.js'], ['reactjs', 'react'], ['react.js', 'react'],
  ['postgres', 'postgresql'], ['rest api', 'rest apis'], ['restful api', 'rest apis'], ['restful apis', 'rest apis'],
  ['oop', 'object-oriented programming'], ['oops', 'object-oriented programming'], ['object oriented programming', 'object-oriented programming'],
  ['dsa', 'data structures and algorithms'], ['data structures & algorithms', 'data structures and algorithms'],
  ['dbms', 'database management systems'], ['database management system', 'database management systems'],
  ['amazon web services', 'aws'], ['continuous integration', 'ci/cd'],
]);
const key = value => { const lower = String(value || '').toLowerCase().trim(); return aliases.get(lower) || lower; };
const unique = values => {
  const result = new Map();
  for (const value of values) if (typeof value === 'string' && value.trim() && !result.has(key(value))) result.set(key(value), value.trim());
  return [...result.values()];
};
const categories = {
  Languages: ['java', 'javascript', 'typescript', 'python', 'sql', 'c', 'c++', 'c#', 'go', 'rust', 'kotlin', 'php', 'html', 'css', 'bash'],
  Backend: ['node.js', 'express.js', 'spring boot', 'spring', 'fastapi', 'flask', 'django', '.net', 'graphql'],
  Frontend: ['react', 'next.js', 'vue', 'angular', 'svelte', 'tailwind css', 'chart.js'],
  Database: ['mysql', 'postgresql', 'mongodb', 'sqlite', 'redis', 'dynamodb', 'neon', 'supabase'],
  'Cloud & DevOps': ['aws', 'docker', 'kubernetes', 'github actions', 'ci/cd', 'cloudflare r2', 'vercel', 'render', 'linux', 'terraform', 'nginx'],
  Concepts: ['rest apis', 'object-oriented programming', 'data structures and algorithms', 'database management systems', 'operating systems', 'computer networks', 'authentication', 'authorization', 'authentication & authorization', 'backend development', 'system design'],
};
function technologyCategory(value) {
  return Object.keys(categories).find(label => categories[label].includes(key(value))) || 'Tools';
}
function technologyStack(input) {
  const groups = new Map();
  const add = (value, label) => {
    const text = String(value || '').replace(/\*\*/g, '').trim();
    if (!text) return;
    const labelled = text.match(/^(?:\d+[.)]\s*)?([A-Za-z][A-Za-z &/+-]{1,35}):\s*(.*)$/);
    if (labelled) return parse(labelled[2], labelled[1]);
    const group = label || technologyCategory(text);
    groups.set(group, unique([...(groups.get(group) || []), text]));
  };
  const parse = (value, label) => {
    if (Array.isArray(value)) return value.forEach(v => parse(v, label));
    if (value && typeof value === 'object') return Object.entries(value).forEach(([name, list]) => parse(list, name));
    if (typeof value !== 'string') return;
    // Split groups first so a label applies to every comma-separated item in its group.
    value.split(/[\n;|·]+/).forEach(part => {
      const match = part.replace(/\*\*/g, '').trim().match(/^(?:\d+[.)]\s*)?([A-Za-z][A-Za-z &/+-]{1,35}):\s*(.*)$/);
      if (match) match[2].split(',').forEach(item => add(item, match[1]));
      else part.split(',').forEach(item => add(item, label));
    });
  };
  parse(input);
  const seen = new Set();
  const cleaned = [...groups].map(([label, values]) => [label, values.filter(v => { const k = key(v); if (seen.has(k)) return false; seen.add(k); return true; })]).filter(([, values]) => values.length);
  return { list: cleaned.flatMap(([, values]) => values), text: cleaned.map(([label, values]) => `${label}: ${values.join(', ')}`).join(' | ') };
}
function containsSkill(text, skill) {
  const variants = [skill, ...[...aliases].filter(([, target]) => target === key(skill)).map(([alias]) => alias)];
  return variants.some(value => new RegExp(`(^|[^a-z0-9+#])${key(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9+#])`, 'i').test(text)
    || new RegExp(`(^|[^a-z0-9+#])${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9+#])`, 'i').test(text));
}
const knownSkills = unique([...Object.values(categories).flat(), 'git', 'github', 'maven', 'postman', 'jwt', 'junit', 'testing', 'debugging', 'microservices']);
const skillWeight = skill => ({ Languages: 4, Backend: 3, Database: 3, Frontend: 2, 'Cloud & DevOps': 1, Concepts: 1, Tools: .5 }[technologyCategory(skill)]);
function relevance(item, jd) {
  const text = JSON.stringify(item);
  return knownSkills.reduce((score, skill) => score + (containsSkill(jd, skill) && containsSkill(text, skill) ? skillWeight(skill) : 0), 0);
}
function rank(items, jd) {
  return [...(items || [])].map((item, index) => ({ item, index, score: relevance(item, jd) })).sort((a, b) => b.score - a.score || a.index - b.index).map(({ item }) => item);
}
// Do not treat keyword overlap as semantic proof. Model wording can invent
// ownership, outcomes, scale or responsibility without introducing a new tool.
const statementKey = value => String(value || '').trim().replace(/\s+/g, ' ').replace(/\.$/, '');
function groundedBullets(draft, source, jd) {
  const originals = unique((source.bullets || []).filter(v => typeof v === 'string' && v.trim()));
  const selected = (draft || []).map(text => originals.find(original => statementKey(original) === statementKey(text))).filter(Boolean);
  return unique([...selected, ...rank(originals.map(text => ({ text })), jd).map(item => item.text)]).slice(0, 2);
}
function groundedSummary(_text, profile, jd) {
  const relevant = unique(sourceSkills(profile).filter(skill => containsSkill(jd, skill))).slice(0, 4);
  const projects = rank(profile.projects || [], jd).slice(0, 2).map(p => p.title);
  return [relevant.length ? `Skills include ${relevant.join(', ')}.` : '', projects.length ? `Project work includes ${projects.join(' and ')}.` : ''].filter(Boolean).join(' ');
}
function auditClaims(resume, profile) {
  const findings = [];
  let checkedBullets = 0;
  for (const section of ['experience', 'projects']) for (const [index, entry] of (resume[section] || []).entries()) {
    const identity = section === 'projects' ? 'title' : 'company';
    const source = (entry.id && (profile[section] || []).find(item => item.id === entry.id))
      || (profile[section] || []).find(item => key(item[identity]) === key(entry[identity]) && (section !== 'experience' || key(item.title) === key(entry.title)));
    const path = `${section}[${index}]`;
    if (!source) { findings.push({path, reason:'Entry has no matching source record'}); continue; }
    for (const field of section === 'projects' ? ['title','dates','liveUrl','repoUrl'] : ['title','company','dates','location']) {
      if (String(entry[field] || '') !== String(source[field] || '')) findings.push({path:`${path}.${field}`,reason:'Field differs from source record'});
    }
    if (section === 'projects' && technologyStack(entry.technologies).text !== technologyStack(source.technologies).text) findings.push({path:`${path}.technologies`,reason:'Stack differs from this project source'});
    for (const [bulletIndex, text] of (entry.bullets || []).entries()) {
      checkedBullets++;
      if (!(source.bullets || []).some(original => statementKey(original) === statementKey(text))) findings.push({path:`${path}.bullets[${bulletIndex}]`,reason:'Wording has no exact source statement',text,sourceStatements:source.bullets || []});
    }
  }
  return { policy:'source-statements-v1', passed:findings.length === 0, checkedBullets, findings };
}
function selectEntries(drafts, sources, limit, jd, identity) {
  const selected = new Map();
  for (const draft of drafts || []) {
    const source = (draft.id && sources.find(item => item.id === draft.id))
      || sources.find(item => key(identity(item)) === key(identity(draft)));
    if (source && !selected.has(source.id)) selected.set(source.id, { ...source, bullets: groundedBullets(draft.bullets, source, jd) });
  }
  for (const source of sources) if (!selected.has(source.id)) selected.set(source.id, { ...source, bullets: groundedBullets([], source, jd) });
  return rank([...selected.values()], jd).slice(0, limit);
}
function skillsForRole(inventory, jd) {
  const skills = { languages: [], frameworks: [], cloudDevOps: [], databasesTools: [], coreConcepts: [] };
  for (const skill of unique(inventory).map((value, index) => ({ value, index, score: (containsSkill(jd, value) ? 100 : 0) + skillWeight(value) })).sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.value)) {
    const category = technologyCategory(skill);
    const target = { Languages: 'languages', Backend: 'frameworks', Frontend: 'frameworks', Database: 'databasesTools', 'Cloud & DevOps': 'cloudDevOps', Concepts: 'coreConcepts', Tools: 'databasesTools' }[category];
    if (skills[target].length < 6 && Object.values(skills).flat().length < 20) skills[target].push(skill);
  }
  skills.raw = unique(Object.values(skills).flat());
  return skills;
}
function roleEvidence(inventory, jd) {
  const mentioned = knownSkills.filter(skill => containsSkill(jd, skill));
  // Spring Boot subsumes the generic Spring label. GitHub Actions does not subsume GitHub.
  const required = mentioned.filter(skill => !(key(skill) === 'spring' && mentioned.some(other => key(other) === 'spring boot')));
  const supported = skill => inventory.some(value => containsSkill(value, skill));
  const matched = required.filter(supported);
  return { matched, missing: required.filter(skill => !supported(skill)), score: required.length ? Math.round(100 * matched.length / required.length) : 0 };
}
function sourceSkills(profile) {
  const sourceText = JSON.stringify({ experience: profile.experience, projects: profile.projects });
  const explicit = profile.rawSkills || [];
  const display = { 'ci/cd': 'CI/CD', authentication: 'Authentication', authorization: 'Authorization', 'rest apis': 'REST APIs', debugging: 'Debugging', testing: 'Testing' };
  return unique([...explicit, ...knownSkills.filter(skill => containsSkill(sourceText, skill)
    && !(key(skill) === 'spring' && explicit.some(value => key(value) === 'spring boot'))).map(skill => display[key(skill)] || skill)]);
}
function refreshSections(resume) {
  resume.sectionOrder = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'achievements', 'leadership'].filter(section => section === 'summary' ? Boolean(resume.summary?.text) : section === 'skills' ? Boolean(resume.skills?.raw?.length) : Boolean(resume[section]?.length));
}
// Each step reduces CONTENT. Never change density, fonts, margins, or export settings.
function reduceContent(resume) {
  for (const section of ['leadership', 'achievements', 'certifications']) {
    if (resume[section]?.length > 1) { resume[section].pop(); return true; }
    const verbose = resume[section]?.find(item => item.description || item.bullets?.length);
    if (verbose) {
      if (section === 'leadership') resume[section].splice(resume[section].indexOf(verbose), 1);
      else { verbose.description = ''; verbose.bullets = []; }
      return true;
    }
  }
  for (const section of ['experience', 'projects']) {
    const last = [...(resume[section] || [])].reverse().find(item => item.bullets?.length > 1);
    if (last) { last.bullets.pop(); return true; }
  }
  for (const section of ['leadership', 'achievements']) if (resume[section]?.length) { resume[section].pop(); return true; }
  if (resume.skills?.raw?.length > 12) {
    for (const category of ['databasesTools', 'cloudDevOps', 'frameworks', 'coreConcepts', 'languages']) {
      if (resume.skills[category]?.length > 2) { resume.skills[category].pop(); resume.skills.raw = unique(Object.entries(resume.skills).filter(([k]) => k !== 'raw').flatMap(([, v]) => v)); return true; }
    }
  }
  if (resume.projects?.length > 1) { resume.projects.pop(); return true; }
  if (resume.experience?.length > 1) { resume.experience.pop(); return true; }
  if (resume.education?.length > 1) { resume.education.pop(); return true; }
  if (resume.certifications?.length) { resume.certifications.pop(); return true; }
  if (resume.summary?.text) { resume.summary.text = ''; return true; }
  return false;
}
async function fitOnePage(resume, measure) {
  const data = structuredClone(resume);
  const started = Date.now();
  for (let pass = 0; pass < 35; pass++) {
    refreshSections(data);
    if (await measure(data) === 1) return data;
    if (Date.now() - started > 20000) break;
    if (!reduceContent(data)) break;
  }
  const error = new Error('The tailored content could not fit one A4 page without changing the layout. Shorten long profile entries and try again.');
  error.statusCode = 422;
  throw error;
}
module.exports = { technologyStack, containsSkill, rank, groundedBullets, groundedSummary, auditClaims, selectEntries, skillsForRole, roleEvidence, sourceSkills, fitOnePage, key };
