const MAX_RESUME_SIZE = 10 * 1024 * 1024;
const MAX_FILENAME_LENGTH = 255;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 30;
const RESUME_CATEGORIES = ['Software', 'Data', 'Core', 'Design', 'General'];

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
  const value = String(category || 'General').trim();
  return RESUME_CATEGORIES.includes(value) ? value : 'General';
}

module.exports = {
  MAX_RESUME_SIZE,
  normalizeTags,
  sanitizeFilename,
  validateFilenameForRename,
  validateDriveUrl,
  validatePdfBuffer,
  normalizeCategory,
  RESUME_CATEGORIES,
  badRequest,
};
