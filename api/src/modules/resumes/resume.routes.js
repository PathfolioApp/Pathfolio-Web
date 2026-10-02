const router = require('express').Router();
const auth = require('../../shared/authenticate');
const controller = require('./resume.controller');
const { resumeUpload } = require('./resumeUpload');

router.use(auth);

router.get('/', controller.list);
router.get('/categories', controller.listCategories);
router.post('/categories', controller.createCategory);
router.patch('/categories/:name', controller.renameCategory);
router.delete('/categories/:name', controller.deleteCategory);
router.post('/upload', resumeUpload, controller.upload);
router.put('/:resumeId/file', resumeUpload, controller.replace);
router.get('/:resumeId/file', controller.getFile);
router.patch('/:resumeId/tags', controller.updateTags);
router.patch('/:resumeId/filename', controller.rename);
router.patch('/:resumeId/category', controller.updateCategory);
router.patch('/:resumeId/extracted', controller.updateExtractedData);
router.post('/:resumeId/analyze', controller.analyze);
router.put('/:resumeId/default', controller.setDefault);
router.delete('/:resumeId', controller.remove);

module.exports = router;
