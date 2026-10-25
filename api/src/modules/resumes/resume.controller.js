const crypto = require('crypto');
const resumeStore = require('./resumeStore');
const r2Service = require('./r2.service');
const { analysePdf } = require('./resumeAnalysis');
const tailorResumeService = require('./tailorResume.service');
const { renderResumePdf } = require('./resumePdf.service');
const { renderSavedResumeHtml } = require('./resumeDocument.service');
const {
  validatePdfBuffer,
  sanitizeFilename,
  validateFilenameForRename,
  generateProfessionalResumeFilename,
  normalizeTags,
  normalizeCategory,
  RESUME_CATEGORIES,
  badRequest,
  MAX_RESUME_SIZE,
} = require('./resumeValidation');

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

async function bodyToBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
  if (typeof body.arrayBuffer === 'function') return Buffer.from(await body.arrayBuffer());
  if (typeof body.on === 'function') {
    const chunks = [];
    for await (const chunk of body) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  return Buffer.from(body);
}

// Reparse must never silently replace saved facts with a lower-quality extraction.
function assertSafeReparse(previous, analysis) {
  const next = analysis?.structured;
  const fail = () => { throw serviceError('Re-extraction was incomplete. Your saved resume was kept unchanged. Review the source PDF or try again.', 409); };
  if (!next || !analysis.parserReady) fail();
  if (!previous) return;
  const canonical = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const fields = ['fullName','email','phone','headline','location'];
  for (const field of fields) if (previous.personal?.[field] && !next.personal?.[field]) fail();
  if (previous.summary?.text && !next.summary?.text) fail();
  for (const key of ['education','experience','projects','certifications','achievements','leadership']) {
    const oldRecords = Array.isArray(previous[key]) ? previous[key].filter(Boolean) : [];
    const records = Array.isArray(next[key]) ? next[key] : [];
    if (records.length < oldRecords.length) fail();
    for (const old of oldRecords) {
      const anchor = canonical(old.title || old.institution || old.company);
      const record = records.find(item => anchor && [item.title,item.institution,item.company,item.raw].some(value => canonical(value).includes(anchor)));
      if (!record) fail();
      for (const field of ['institution','company','dates','description','location','technologies','liveUrl','repoUrl']) {
        if (old[field] && !record[field]) {
          const retained = canonical([record.sourceEvidence,record.raw,...(record.bullets || [])].join(' '));
          if (field !== 'description' || !retained.includes(canonical(old[field]))) fail();
        }
      }
      if ((record.bullets || []).length < (old.bullets || []).length) fail();
      const evidence = canonical([record.sourceEvidence,record.raw,record.description,...(record.bullets || [])].join(' '));
      for (const bullet of old.bullets || []) if (!evidence.includes(canonical(bullet))) fail();
      const technologies = String(record.technologies || '').split(/[,;|]/).map(canonical);
      for (const tech of String(old.technologies || '').split(/[,;|]/).filter(Boolean)) if (!technologies.includes(canonical(tech))) fail();
    }
  }
  const urls = data => [...(data.documentLinks || []), ...(data.personal?.links || []), data.personal?.linkedin, data.personal?.github, data.personal?.portfolio,
    ...(data.projects || []).flatMap(item => [item?.liveUrl,item?.repoUrl])].filter(Boolean).map(value => typeof value === 'string' ? value.replace(/\/$/, '') : value.url?.replace(/\/$/, '')).filter(Boolean);
  const nextLinks = new Set(urls(next));
  if (urls(previous).some(link => !nextLinks.has(link))) fail();
  const oldSkills = previous.skills?.raw || [], newSkills = new Set((next.skills?.raw || []).map(canonical));
  if (oldSkills.some(skill => !newSkills.has(canonical(skill)))) fail();
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
      const category = normalizeCategory(req.body?.category);
      const analysis = await analysePdf(file.buffer);

      const resume = await resumeStore.create(req.student.id, {
        filename,
        filepath: key,
        driveLink: null,
        isCloud: true,
        tags,
        category,
        analysis,
        extractedData: analysis.structured,
        isDefault,
      });
      if (isDefault) await resumeStore.setDefault(req.student.id, resume.id);

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

  async createStudioResume(req, res, next) {
    try {
      const { filename, category, extractedData, tags } = req.body || {};
      if (!extractedData || typeof extractedData !== 'object' || Array.isArray(extractedData)) {
        throw badRequest('Structured resume data is required');
      }
      const rawName = String(filename || '').trim() || `${extractedData.personal?.fullName || 'Student'}_Resume.pdf`;
      const safeFilename = sanitizeFilename(rawName.endsWith('.pdf') ? rawName : `${rawName}.pdf`);
      const normalizedCategory = normalizeCategory(category || 'General');
      const normalizedTags = normalizeTags(tags || ['Studio', 'Profile']);
      const count = await resumeStore.count(req.student.id);
      const isDefault = count === 0;

      const resume = await resumeStore.create(req.student.id, {
        filename: safeFilename,
        filepath: '',
        driveLink: null,
        isCloud: false,
        tags: normalizedTags,
        category: normalizedCategory,
        analysis: null,
        extractedData,
        isDefault,
      });

      if (isDefault) await resumeStore.setDefault(req.student.id, resume.id);

      res.status(201).json({
        ...resume,
        fileUrl: `/api/resumes/${resume.id}/file?mode=view`,
        downloadUrl: `/api/resumes/${resume.id}/file?mode=download`,
      });
    } catch (error) {
      next(error);
    }
  },

  async tailor(req, res, next) {
    try {
      const { jobTitle, company, jobDescription } = req.body || {};
      if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 40) {
        throw badRequest('A detailed Job Description is required (minimum 40 characters)');
      }

      const { resumeData, tailoredMeta } = await tailorResumeService.tailorForJd(req.student.id, {
        jobTitle: jobTitle?.trim(),
        company: company?.trim(),
        jobDescription: jobDescription.trim()
      });

      const candidateName = resumeData.personal?.fullName || req.student?.name || 'Candidate';
      const safeFilename = generateProfessionalResumeFilename(candidateName, jobTitle, company);

      // Keep tags clean for tailored resumes without stuffing redundant role/company/Tailored strings.
      // Genuine user tags can be added later by the student.
      const normalizedTags = Array.isArray(req.body?.tags) ? normalizeTags(req.body.tags) : [];
      const normalizedCategory = normalizeCategory('Tailored');

      const count = await resumeStore.count(req.student.id);
      const isDefault = count === 0;

      // Build analysis object with ATS score and tailored insights
      const analysis = {
        score: tailoredMeta.matchScore,
        tailoredMeta,
        checkedAt: new Date().toISOString(),
        findings: (tailoredMeta.missingOrWeakSkills || []).map(skill => ({
          title: `Missing skill: ${skill}`,
          detail: `The job description emphasizes ${skill}, which was not identified in your verified profile.`,
          severity: 'medium'
        }))
      };

      const resume = await resumeStore.create(req.student.id, {
        filename: safeFilename,
        filepath: '',
        driveLink: null,
        isCloud: false,
        tags: normalizedTags,
        category: normalizedCategory,
        analysis,
        extractedData: resumeData,
        isDefault
      });

      res.status(201).json({
        ...resume,
        tailoredMeta,
        fileUrl: `/api/resumes/${resume.id}/file?mode=view`,
        downloadUrl: `/api/resumes/${resume.id}/file?mode=download`
      });
    } catch (error) {
      next(error);
    }
  },

  async getFile(req, res, next) {
    try {
      const resume = await resumeStore.findOwnedResume(req.student.id, req.params.resumeId);
      if (!resume) throw notFound();
      if (!resume.filepath) {
        if (resume.extractedData) {
          const safeFilename = String(resume.filename || 'resume').replace(/"/g, '').replace(/\.pdf$/i, '');
          const html = await renderSavedResumeHtml(resume.extractedData, safeFilename);
          if (req.query.mode === 'download') {
            const pdf = await renderResumePdf(html);
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.attachment(sanitizeFilename(resume.filename || 'Resume.pdf'));
            return res.send(pdf);
          }
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Content-Disposition', `inline; filename="${safeFilename}.html"`);
          return res.send(html);
        }
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

  async replace(req, res, next) {
    let uploadedKey = null;
    try {
      const resume = await resumeStore.findOwnedResume(req.student.id, req.params.resumeId);
      if (!resume) throw notFound();
      const file = req.file;
      if (!file) throw badRequest('Replacement PDF is required');
      validatePdfBuffer(file.buffer);
      const filename = sanitizeFilename(file.originalname);
      const key = `resumes/${crypto.randomUUID()}_${filename}`;
      await r2Service.uploadFile(file.buffer, key, 'application/pdf');
      uploadedKey = key;
      const analysis = await analysePdf(file.buffer);
      const updated = await resumeStore.replaceFile(req.student.id, resume.id, { filename, filepath: key, analysis, extractedData: analysis.structured });
      if (resume.filepath) await r2Service.deleteFile(resume.filepath).catch(() => {});
      res.json({ ...updated, fileUrl: `/api/resumes/${updated.id}/file?mode=view`, downloadUrl: `/api/resumes/${updated.id}/file?mode=download` });
    } catch (error) {
      if (uploadedKey) await r2Service.deleteFile(uploadedKey).catch(() => {});
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

  async updateCategory(req, res, next) {
    try {
      const { resumeId } = req.params;
      const resume = await resumeStore.findOwnedResume(req.student.id, resumeId);
      if (!resume) throw notFound();
      const updated = await resumeStore.updateCategory(req.student.id, resumeId, normalizeCategory(req.body?.category));
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },

  async listCategories(req, res, next) {
    try {
      res.json(await resumeStore.listCategories(req.student.id));
    } catch (error) {
      next(error);
    }
  },

  async createCategory(req, res, next) {
    try {
      const name = normalizeCategory(req.body?.name);
      if (!name || RESUME_CATEGORIES.includes(name)) throw badRequest('A custom category name is required');
      await resumeStore.createCategory(req.student.id, name);
      res.status(201).json({ name });
    } catch (error) {
      next(error);
    }
  },

  async renameCategory(req, res, next) {
    try {
      const previousName = normalizeCategory(req.params.name);
      const nextName = normalizeCategory(req.body?.name);
      if (RESUME_CATEGORIES.includes(previousName)) throw badRequest('Built-in categories cannot be renamed');
      if (!nextName || nextName === 'General') throw badRequest('A valid new category name is required');
      const categories = await resumeStore.listCategories(req.student.id);
      if (!categories.includes(previousName)) throw notFound('Category not found');
      res.json({ name: await resumeStore.renameCategory(req.student.id, previousName, nextName) });
    } catch (error) {
      next(error);
    }
  },

  async deleteCategory(req, res, next) {
    try {
      const name = normalizeCategory(req.params.name);
      if (RESUME_CATEGORIES.includes(name)) throw badRequest('Built-in categories cannot be removed');
      await resumeStore.deleteCategory(req.student.id, name);
      res.json({ detail: 'Category removed; affected resumes moved to General' });
    } catch (error) {
      next(error);
    }
  },

  async updateExtractedData(req, res, next) {
    try {
      const resume = await resumeStore.findOwnedResume(req.student.id, req.params.resumeId);
      if (!resume) throw notFound();
      const data = req.body?.extractedData;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw badRequest('Structured resume data is required');
      res.json(await resumeStore.updateExtractedData(req.student.id, req.params.resumeId, data));
    } catch (error) {
      next(error);
    }
  },

  async analyze(req, res, next) {
    try {
      const resume = await resumeStore.findOwnedResume(req.student.id, req.params.resumeId);
      if (!resume) throw notFound();
      if (!resume.filepath) throw badRequest('This resume does not have an uploaded file');
      const original = { filepath: resume.filepath, extractedData: JSON.parse(JSON.stringify(resume.extractedData || null)) };
      const object = await r2Service.getFile(resume.filepath);
      if (!object.Body) throw serviceError('Resume file is unavailable', 404);
      const analysis = await analysePdf(await bodyToBuffer(object.Body));
      assertSafeReparse(original.extractedData, analysis);
      // Retain one previous extraction for recovery; do not recursively store old analyses.
      analysis.previousExtraction = original.extractedData;
      if (resume.extractedData?.studioLayout) analysis.structured.studioLayout = resume.extractedData.studioLayout;
      if (resume.extractedData?.sectionOrder) analysis.structured.sectionOrder = resume.extractedData.sectionOrder;
      const updated = await resumeStore.updateAnalysis(req.student.id, req.params.resumeId, analysis, original);
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
          require('../../shared/logger').storage.warn(`Failed to delete R2 resume object ${resume.filepath}: ${err?.message || err}`);
        }
      }

      res.json({ detail: 'Resume deleted' });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = resumeController;
