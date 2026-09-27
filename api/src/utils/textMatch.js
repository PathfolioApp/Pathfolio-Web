/**
 * Shared text matching helpers.
 *
 * Job descriptions and student records contain a lot of generic filler. If we
 * match on raw substrings, short words like "art" or "beat" explode into false
 * positives ("art" inside "Artificial", "startup", "department"). This module
 * keeps tokenisation conservative and always matches on word boundaries.
 */

// Common English function words plus generic recruitment/description filler.
const GENERIC_TERMS = new Set([
  // Function words
  'and', 'the', 'for', 'with', 'from', 'that', 'this', 'these', 'those', 'are', 'was', 'were', 'been', 'being',
  'you', 'your', 'yours', 'our', 'ours', 'their', 'theirs', 'them', 'they', 'its', 'his', 'her', 'hers', 'him',
  'she', 'he', 'we', 'us', 'who', 'whom', 'whose', 'which', 'what', 'when', 'where', 'while', 'whilst', 'than',
  'then', 'there', 'here', 'also', 'such', 'into', 'onto', 'upon', 'over', 'under', 'about', 'above', 'below',
  'between', 'within', 'without', 'across', 'along', 'around', 'through', 'during', 'before', 'after', 'again',
  'further', 'once', 'only', 'other', 'others', 'some', 'any', 'all', 'both', 'each', 'few', 'more', 'most',
  'much', 'many', 'very', 'just', 'too', 'not', 'nor', 'but', 'or', 'if', 'so', 'as', 'at', 'by', 'in', 'of',
  'on', 'to', 'up', 'out', 'off', 'per', 'via', 'etc', 'will', 'would', 'shall', 'should', 'must', 'can', 'could',
  'may', 'might', 'able', 'ability', 'skills', 'skill', 'knowledge', 'experience', 'experienced', 'candidate',
  'candidates', 'applicant', 'applicants',
  // Generic job/description filler
  'job', 'role', 'work', 'works', 'working', 'team', 'teams', 'company', 'companies', 'organization', 'organisation',
  'plus', 'preferred', 'require', 'requires', 'required', 'requirement', 'requirements', 'responsibility',
  'responsibilities', 'including', 'include', 'includes', 'well', 'good', 'best', 'great', 'strong', 'excellent',
  'proficient', 'proficiency', 'familiar', 'familiarity', 'understanding', 'solid', 'deep', 'hands', 'fast', 'paced',
  'environment', 'opportunity', 'opportunities', 'benefits', 'salary', 'package', 'location', 'remote', 'hybrid',
  'onsite', 'full', 'part', 'time', 'contract', 'intern', 'internship', 'join', 'looking', 'seeking', 'want', 'wants',
  'need', 'needs', 'help', 'helps', 'support', 'supports', 'ensure', 'ensures', 'provide', 'provides', 'maintain',
  'maintains', 'deliver', 'delivers', 'create', 'creates', 'build', 'builds', 'building', 'develop', 'develops',
  'developing', 'design', 'designs', 'designing', 'manage', 'manages', 'managing', 'lead', 'leads', 'leading', 'own',
  'owns', 'drive', 'drives', 'define', 'defines', 'implement', 'implements', 'implementing', 'conduct', 'conducts',
  'test', 'tests', 'testing', 'deploy', 'deploys', 'deployment', 'collaborate', 'collaborates', 'collaboration',
  'coordinate', 'coordination', 'review', 'reviews', 'monitor', 'monitors', 'analyze', 'analyzes', 'analyse',
  'analyses', 'optimize', 'optimise', 'improve', 'improves', 'solve', 'solves', 'beat', 'beats', 'meet', 'meets',
  'handle', 'handles', 'write', 'writes', 'writing', 'read', 'reads', 'make', 'makes', 'making', 'take', 'takes',
  'taking', 'give', 'gives', 'given', 'daily', 'basis', 'year', 'years', 'month', 'months', 'week', 'weeks', 'day',
  'days', 'hour', 'hours', 'new', 'current', 'future', 'past', 'next', 'last', 'first', 'second', 'third', 'high',
  'low', 'senior', 'junior', 'entry', 'level', 'degree', 'university', 'college', 'student', 'students', 'graduate',
  'graduates', 'perform', 'performs', 'participate', 'participates', 'contribute', 'contributes', 'assist',
  'assists', 'supporting', 'communication', 'interpersonal', 'motivated', 'starter', 'attention', 'detail',
  'details', 'passionate', 'passion', 'growth', 'learn', 'learns', 'learning', 'quickly', 'independently',
  'office', 'relocate', 'travel', 'visa', 'authorized', 'authorised', 'someone', 'somebody', 'anyone', 'everyone',
  'minimum', 'maximum', 'least', 'ideal', 'deadline', 'deadlines', 'responsible', 'responsibly', 'strongly', 'highly'
]);

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Extract significant, de-duplicated terms from free text.
 * Tokens shorter than `minLength` and generic filler words are discarded.
 */
function tokenize(value, { minLength = 4, limit = 40 } = {}) {
  const raw = String(value || '').toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
  const seen = new Set();
  for (const token of raw) {
    const word = token.replace(/[.-]+$/, '');
    if (word.length < minLength) continue;
    if (GENERIC_TERMS.has(word)) continue;
    seen.add(word);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

/**
 * Returns a predicate that tests whether a term appears in `text` as a whole
 * word, so short terms cannot match inside larger words.
 */
function createMatcher(text) {
  const haystack = String(text || '').toLowerCase();
  const cache = new Map();
  return term => {
    const needle = String(term || '').toLowerCase();
    if (!needle) return false;
    if (!cache.has(needle)) {
      const regex = new RegExp(`(^|[^a-z0-9+#.])${escapeRegExp(needle)}(?![a-z0-9+#])`, 'i');
      cache.set(needle, regex.test(haystack));
    }
    return cache.get(needle);
  };
}

module.exports = { GENERIC_TERMS, escapeRegExp, tokenize, createMatcher };
