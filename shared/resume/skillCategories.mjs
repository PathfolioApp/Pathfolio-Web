// Categorization taxonomy for skills
const TAXONOMY = {
  languages: [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c', 'c#', 'golang', 'go',
    'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'html', 'css', 'r', 'matlab', 'bash', 'shell', 'dart'
  ],
  frameworks: [
    'react', 'react.js', 'reactjs', 'next.js', 'nextjs', 'vue', 'vue.js', 'angular', 'svelte',
    'node.js', 'nodejs', 'express', 'express.js', 'spring', 'spring boot', 'django', 'flask',
    'fastapi', 'laravel', 'asp.net', '.net', 'pandas', 'numpy', 'scipy', 'pytorch', 'tensorflow',
    'chart.js', 'tailwind', 'tailwindcss', 'bootstrap', 'jquery'
  ],
  cloudDevOps: [
    'aws', 'amazon web services', 'gcp', 'google cloud', 'azure', 'docker', 'kubernetes',
    'cloudflare', 'cloudflare r2', 'r2', 'ci/cd', 'github actions', 'jenkins', 'terraform',
    'vercel', 'render', 'neon', 'resend', 'linux', 'nginx', 'jwt'
  ],
  databasesTools: [
    'mysql', 'postgresql', 'postgres', 'mongodb', 'sqlite', 'redis', 'elasticsearch',
    'dynamodb', 'cassandra', 'firebase', 'supabase', 'prisma', 'git', 'github', 'gitlab',
    'postman', 'power bi', 'tableau', 'excel', 'microsoft excel', 'figma', 'jira', 'rest api', 'graphql'
  ],
  coreConcepts: [
    'data structures & algorithms', 'data structures and algorithms', 'dsa',
    'object-oriented programming', 'object oriented programming', 'oop', 'oops',
    'database management system', 'database management systems', 'dbms',
    'computer networks', 'cn', 'operating system', 'operating systems', 'os',
    'software development life cycle', 'sdlc', 'system design'
  ]
};

export function categorizeSkill(skillName) {
  const lower = skillName.toLowerCase().trim();
  if (TAXONOMY.languages.some(lang => lower === lang || lower.startsWith(`${lang} `))) return 'languages';
  if (TAXONOMY.frameworks.some(fw => lower === fw || lower.startsWith(`${fw} `))) return 'frameworks';
  if (TAXONOMY.cloudDevOps.some(cd => lower === cd || lower.startsWith(`${cd} `))) return 'cloudDevOps';
  if (TAXONOMY.databasesTools.some(dt => lower === dt || lower.startsWith(`${dt} `))) return 'databasesTools';
  if (TAXONOMY.coreConcepts.some(cc => lower === cc || lower.startsWith(`${cc} `))) return 'coreConcepts';
  return 'tools';
}

export function deduplicateStrings(list) {
  const map = new Map();
  for (const item of list) {
    const trimmed = String(item || '').trim();
    if (trimmed && !map.has(trimmed.toLowerCase())) {
      map.set(trimmed.toLowerCase(), trimmed);
    }
  }
  return Array.from(map.values());
}

