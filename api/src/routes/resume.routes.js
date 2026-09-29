const router = require('express').Router();
const auth = require('../middleware/authenticate');
const controller = require('../controllers/resume.controller');
const { resumeUpload } = require('../middleware/resumeUpload');

router.use(auth);

router.get('/', controller.list);
router.post('/upload', resumeUpload, controller.upload);
router.get('/:resumeId/file', controller.getFile);
router.patch('/:resumeId/tags', controller.updateTags);
router.patch('/:resumeId/filename', controller.rename);
router.put('/:resumeId/default', controller.setDefault);
router.delete('/:resumeId', controller.remove);

module.exports = router;
