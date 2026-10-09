const express = require('express');
const auth = require('./auth.service');
const store = require('../students/studentStore');
const config = require('../../config');
const router = express.Router();
// Flags come from config so separate-host deployments can set SameSite=None;
// secure via SESSION_COOKIE_* without touching code.
const cookieOptions = { httpOnly: true, sameSite: config.sessionCookie.sameSite, secure: config.sessionCookie.secure, maxAge: 1000 * 60 * 60 * 24 * 7, path: '/' };
const tokenFrom = req => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('pf_session='))?.slice('pf_session='.length);

router.post('/login', async (req, res) => { try { const { student, token } = await auth.login(req.body.email, req.body.password); res.cookie('pf_session', token, cookieOptions).json({ success: true, student }); } catch (e) { res.status(401).json({ success: false, message: e.message }); } });
router.post('/logout', async (req, res) => { const token = tokenFrom(req); if (token) await store.deleteSession(token); res.clearCookie('pf_session', { path: '/' }).json({ success: true }); });
// An anonymous visitor is an expected state while the app initializes. Return a
// neutral session response instead of producing a noisy failed-network request.
router.get('/me', async (req, res) => { const student = await auth.getStudentForSession(tokenFrom(req)); res.json({ success: true, student: student || null }); });
router.post('/forgot-password', async (req, res) => { if (!req.body.email) return res.status(400).json({ success: false, message: 'Email is required.' }); res.json({ success: true, message: 'Password reset email delivery is not configured in this development environment. No password has been changed.' }); });
module.exports = router;
