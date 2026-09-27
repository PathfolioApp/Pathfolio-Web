const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const content = require('../services/adminContent.service');

router.use(authenticate);
router.get('/', async (req, res) => { try { res.json({ success: true, jobPosts: await content.publishedJobsForStudent(req.student.id) }); } catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); } });
router.post('/:id/applications', async (req, res) => { try { res.status(201).json({ success: true, application: await content.apply(req.params.id, req.student.id, req.body.answers) }); } catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); } });

module.exports = router;