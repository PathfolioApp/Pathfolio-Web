const router = require('express').Router();
const auth = require('../../shared/authenticate');
const controller = require('./resume.controller');
const { resumeUpload } = require('./resumeUpload');

router.use(auth);

router.get('/', controller.list);
router.post('/upload', resumeUpload, controller.upload);
router.get('/:resumeId/file', controller.getFile);
router.patch('/:resumeId/tags', controller.updateTags);
router.patch('/:resumeId/filename', controller.rename);
router.patch('/:resumeId/category', controller.updateCategory);
router.post('/:resumeId/analyze', controller.analyze);
router.put('/:resumeId/default', controller.setDefault);
router.delete('/:resumeId', controller.remove);

module.exports = router;
