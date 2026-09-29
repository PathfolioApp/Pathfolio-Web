const router = require('express').Router();
const auth = require('../middleware/authenticate');
const c = require('../controllers/profile.controller');
const { academicUpload } = require('../middleware/academicUpload');

router.use(auth);

router.get('/', c.get);
router.patch('/personal', c.update('personal'));
router.patch('/academic', c.update('academic'));
router.patch('/interests', c.update('interests'));
router.patch('/family-context', c.update('familyContext'));
router.get('/settings', c.get);
router.patch('/settings', c.update('profileSettings'));

// Achievements
router.post('/achievements', c.addAchievement);
router.patch('/achievements/:id', c.editAchievement);
router.delete('/achievements/:id', c.deleteAchievement);

// Avatar & account
router.post('/avatar', c.setAvatar);
router.post('/uploads/signature', c.uploadSignature);
router.delete('/account', c.deleteAccount);

// Academic documents & semester records
router.post('/academic/documents/upload', academicUpload, c.uploadAcademicDocument);
router.get('/academic/documents/:docType/file', c.getAcademicDocumentFile);
router.delete('/academic/documents/:docType', c.deleteAcademicDocument);

router.post('/academic/semesters', c.saveSemester);
router.delete('/academic/semesters/:semesterId', c.deleteSemester);
router.get('/academic/semesters/:semesterId/file', c.getSemesterTranscriptFile);

module.exports = router;
