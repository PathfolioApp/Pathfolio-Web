const router = require('express').Router();
const auth = require('../../shared/authenticate');
const controller = require('./resume.controller');
const { resumeUpload } = require('./resumeUpload');
const rateLimit = require('../../shared/rateLimit');

// AI and upload endpoints are expensive (external calls, storage); keep them
// to a sane per-user ceiling so one account cannot exhaust the quota.
const uploadLimiter = rateLimit({ windowMs: 60 * 60_000, max: 20, message: 'Upload limit reached (20 per hour). Please try again later.' });
const aiLimiter = rateLimit({ windowMs: 60 * 60_000, max: 30, message: 'AI feature limit reached (30 per hour). Please try again later.' });

router.use(auth);

router.get('/', controller.list);
router.get('/categories', controller.listCategories);
router.post('/categories', controller.createCategory);
router.patch('/categories/:name', controller.renameCategory);
router.delete('/categories/:name', controller.deleteCategory);
router.post('/upload', uploadLimiter, resumeUpload, controller.upload);
router.post('/studio', uploadLimiter, controller.createStudioResume);
router.post('/tailor', aiLimiter, controller.tailor);
router.put('/:resumeId/file', uploadLimiter, resumeUpload, controller.replace);
router.get('/:resumeId/file', controller.getFile);
router.patch('/:resumeId/tags', controller.updateTags);
router.patch('/:resumeId/filename', controller.rename);
router.patch('/:resumeId/category', controller.updateCategory);
router.patch('/:resumeId/extracted', controller.updateExtractedData);
router.post('/:resumeId/analyze', aiLimiter, controller.analyze);
router.post('/:resumeId/reparse', aiLimiter, controller.analyze);
router.put('/:resumeId/default', controller.setDefault);
router.delete('/:resumeId', controller.remove);

module.exports = router;
