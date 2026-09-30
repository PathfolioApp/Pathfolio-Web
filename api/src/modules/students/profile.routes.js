const router = require('express').Router();
const auth = require('../../shared/authenticate');
const c = require('./profile.controller');
const { academicUpload } = require('./academicUpload');
const { internshipUpload } = require('./internshipUpload');
const { projectUpload } = require('./projectUpload');

router.use(auth);

router.get('/', c.get);
router.patch('/personal', c.update('personal'));
router.patch('/academic', c.update('academic'));
router.patch('/interests', c.update('interests'));
router.patch('/social', c.update('social'));
router.patch('/family-context', c.update('familyContext'));
router.get('/settings', c.get);
router.patch('/settings', c.update('profileSettings'));

// Internships
router.post('/internships', c.addInternship);
router.patch('/internships/:id', c.editInternship);
router.delete('/internships/:id', c.deleteInternship);
router.post('/internships/:id/certificate', internshipUpload, c.uploadInternshipCertificate);
router.get('/internships/:id/certificate/file', c.getInternshipCertificateFile);
router.delete('/internships/:id/certificate', c.deleteInternshipCertificate);

// Projects
router.post('/projects', c.addProject);
router.patch('/projects/:id', c.editProject);
router.delete('/projects/:id', c.deleteProject);
router.post('/projects/:id/document', projectUpload, c.uploadProjectDocument);
router.get('/projects/:id/document/file', c.getProjectDocumentFile);
router.delete('/projects/:id/document', c.deleteProjectDocument);

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
