const crypto = require('crypto');
const resumeStore = require('../models/resumeStore');
const r2Service = require('../services/r2.service');
const {
  validatePdfBuffer,
  sanitizeFilename,
  validateFilenameForRename,
  normalizeTags,
  badRequest,
  MAX_RESUME_SIZE,
} = require('../services/resumeValidation');

function notFound(message = 'Resume not found') {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function serviceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const resumeController = {
  async list(req, res, next) {
    try {
      const list = await resumeStore.list(req.student.id);
      const enhanced = list.map(r => ({
        ...r,
        fileUrl: `/api/resumes/${r.id}/file?mode=view`,
        downloadUrl: `/api/resumes/${r.id}/file?mode=download`,
      }));
      res.json(enhanced);
    } catch (error) {
      next(error);
    }
  },

  async upload(req, res, next) {
    let uploadedKey = null;
    try {
      if (!r2Service.isAvailable()) {
        throw serviceError('Cloudflare R2 storage is not configured. Please add R2 credentials to .env', 503);
      }

      const file = req.file;
      if (!file) throw badRequest('Resume PDF is required');
      if (file.size > MAX_RESUME_SIZE) throw serviceError('Resume exceeds the 10 MB limit', 413);

      validatePdfBuffer(file.buffer);

      const filename = sanitizeFilename(file.originalname);
      const key = `resumes/${crypto.randomUUID()}_${filename}`;

      await r2Service.uploadFile(file.buffer, key, 'application/pdf');
      uploadedKey = key;

      let tags = [];
      if (req.body?.tags) {
        try {
          const parsed = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
          tags = normalizeTags(parsed);
        } catch (_) {}
      }

      const count = await resumeStore.count(req.student.id);
      const isDefault = count === 0;

      const resume = await resumeStore.create(req.student.id, {
        filename,
        filepath: key,
        driveLink: null,
        isCloud: true,
        tags,
        isDefault,
      });

      res.status(201).json({
        ...resume,
        fileUrl: `/api/resumes/${resume.id}/file?mode=view`,
        downloadUrl: `/api/resumes/${resume.id}/file?mode=download`,
      });
    } catch (error) {
      if (uploadedKey) {
        try {
          await r2Service.deleteFile(uploadedKey);
        } catch (_) {}
      }
      next(error);
    }
  },

  async getFile(req, res, next) {
    try {
      const resume = await resumeStore.findOwnedResume(req.student.id, req.params.resumeId);
      if (!resume) throw notFound();
      if (!resume.filepath) {
        throw badRequest('This resume does not have an uploaded file');
      }

      const object = await r2Service.getFile(resume.filepath);
      if (!object.Body) throw serviceError('Resume file is unavailable', 404);

      const mode = req.query.mode === 'download' ? 'download' : 'view';
      const safeFilename = String(resume.filename || 'resume.pdf').replace(/"/g, '');

      res.setHeader('Content-Type', object.ContentType || 'application/pdf');
      if (object.ContentLength) {
        res.setHeader('Content-Length', String(object.ContentLength));
      }
      res.setHeader(
        'Content-Disposition',
        `${mode === 'view' ? 'inline' : 'attachment'}; filename="${safeFilename}"`
      );

      // AWS SDK v3 stream or fallback stream
      if (typeof object.Body.pipe === 'function') {
        object.Body.pipe(res);
      } else if (typeof object.Body.transformToByteArray === 'function') {
        const bytes = await object.Body.transformToByteArray();
        res.send(Buffer.from(bytes));
      } else {
        res.send(object.Body);
      }
    } catch (error) {
      next(error);
    }
  },

  async updateTags(req, res, next) {
    try {
      const { resumeId } = req.params;
      const { tags } = req.body || {};
      const resume = await resumeStore.findOwnedResume(req.student.id, resumeId);
      if (!resume) throw notFound();

      const normalized = normalizeTags(tags);
      const updated = await resumeStore.updateTags(req.student.id, resumeId, normalized);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },

  async rename(req, res, next) {
    try {
      const { resumeId } = req.params;
      const { filename } = req.body || {};
      const resume = await resumeStore.findOwnedResume(req.student.id, resumeId);
      if (!resume) throw notFound();

      const normalized = validateFilenameForRename(filename, resume.filename);
      const updated = await resumeStore.rename(req.student.id, resumeId, normalized);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },

  async setDefault(req, res, next) {
    try {
      const { resumeId } = req.params;
      const resume = await resumeStore.findOwnedResume(req.student.id, resumeId);
      if (!resume) throw notFound();

      const updated = await resumeStore.setDefault(req.student.id, resumeId);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },

  async remove(req, res, next) {
    try {
      const { resumeId } = req.params;
      const resume = await resumeStore.findOwnedResume(req.student.id, resumeId);
      if (!resume) throw notFound();

      await resumeStore.delete(req.student.id, resumeId);

      if (resume.filepath) {
        try {
          await r2Service.deleteFile(resume.filepath);
        } catch (err) {
          console.warn('Failed to delete R2 resume object:', resume.filepath, err?.message || err);
        }
      }

      res.json({ detail: 'Resume deleted' });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = resumeController;
