const MAX_RESUME_SIZE = 10 * 1024 * 1024;
const MAX_FILENAME_LENGTH = 255;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 30;
const MAX_CATEGORY_LENGTH = 48;
const RESUME_CATEGORIES = ['Software Engineering', 'Backend Engineering', 'Cloud / DevOps', 'Data / AI', 'Core Engineering', 'Design / Product', 'General'];

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeTags(rawTags) {
  if (!Array.isArray(rawTags)) return [];
  const seen = new Set();
  const result = [];

  for (const raw of rawTags) {
    if (typeof raw !== 'string') continue;
    const clean = raw
      .replace(/[<>]/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim()
      .slice(0, MAX_TAG_LENGTH);

    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(clean);
    if (result.length >= MAX_TAGS) break;
  }

  return result;
}

function sanitizeFilename(filename) {
  const value = String(filename || '').trim();
  if (!value) throw badRequest('Filename is required');

  if (/[/\\]/.test(value) || value.includes('..') || /[\u0000<>:"|?*]/.test(value)) {
    throw badRequest('Filename contains invalid characters');
  }

  const base = value.replace(/\.pdf$/i, '').trim();
  if (!base) throw badRequest('Filename is required');

  return `${base.slice(0, MAX_FILENAME_LENGTH - 4)}.pdf`;
}

function validateFilenameForRename(filename, currentFilename) {
  const value = String(filename || '').trim();
  if (!value) throw badRequest('Filename is required');

  if (/[/\\]/.test(value) || value.includes('..') || /[\u0000<>:"|?*]/.test(value)) {
    throw badRequest('Filename contains invalid characters');
  }

  const isPdf = /\.pdf$/i.test(currentFilename || '');
  const ext = isPdf ? '.pdf' : '';
  const base = value.replace(/\.pdf$/i, '').trim();
  if (!base) throw badRequest('Filename is required');

  return `${base.slice(0, MAX_FILENAME_LENGTH - ext.length)}${ext}`;
}

function validateDriveUrl(url) {
  try {
    const parsed = new URL(String(url || '').trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch {
    throw badRequest('A valid HTTP/HTTPS URL is required');
  }
}

function validatePdfBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5 || buffer.subarray(0, 5).toString() !== '%PDF-') {
    throw badRequest('Uploaded file is not a valid PDF');
  }
}

function normalizeCategory(category) {
  const value = String(category || 'General')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_CATEGORY_LENGTH);
  return value || 'General';
}

/**
 * Generates an industry-standard, ATS-compliant resume filename.
 * Format: Firstname_Lastname_Role_Company.pdf
 * Cleans slashes, colons, pipes, em-dashes, and special characters into clean underscores,
 * collapses multiple underscores, caps to safe length, and ensures 100% valid filesystem name.
 */
function generateProfessionalResumeFilename(name, role, company) {
  const cleanPart = (str) => {
    return String(str || '')
      .replace(/[/\\]+/g, '_')
      .replace(/[\u0000<>:"|?*—–]/g, '_')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_');
  };

  const namePart = cleanPart(name) || 'Candidate';
  const rolePart = cleanPart(role);
  const companyPart = cleanPart(company);

  const parts = [namePart];
  if (rolePart) parts.push(rolePart);
  if (companyPart) {
    parts.push(companyPart);
  } else if (!rolePart) {
    parts.push('Resume');
  }

  let base = parts.join('_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!base) base = 'Resume_Tailored';

  const maxBaseLen = MAX_FILENAME_LENGTH - 4;
  if (base.length > maxBaseLen) {
    base = base.slice(0, maxBaseLen).replace(/_+$/, '');
  }

  return `${base}.pdf`;
}

module.exports = {
  MAX_RESUME_SIZE,
  normalizeTags,
  sanitizeFilename,
  validateFilenameForRename,
  generateProfessionalResumeFilename,
  validateDriveUrl,
  validatePdfBuffer,
  normalizeCategory,
  MAX_CATEGORY_LENGTH,
  RESUME_CATEGORIES,
  badRequest,
};
