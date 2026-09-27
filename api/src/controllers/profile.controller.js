const profile = require('../services/profile.service');
const cloudinary = require('cloudinary').v2;
const config = require('../config');
const send = async (res, action) => { try { res.json({ success: true, student: await action() }); } catch (e) { res.status(e.statusCode || 400).json({ success: false, message: e.message }); } };
exports.get = (req,res) => send(res, () => profile.get(req.student.id));
exports.update = (section) => (req,res) => send(res, () => profile.update(req.student.id, section, req.body));
exports.addAchievement = (req,res) => send(res, () => profile.achievement(req.student.id, req.body));
exports.editAchievement = (req,res) => send(res, () => profile.achievement(req.student.id, req.body, req.params.id));
exports.deleteAchievement = (req,res) => send(res, () => profile.deleteAchievement(req.student.id, req.params.id));
exports.changePassword = async (req,res) => { try { await profile.changePassword(req.student.id, req.body.currentPassword, req.body.newPassword); res.json({ success: true, message: 'Password updated securely.' }); } catch (e) { res.status(400).json({ success: false, message: e.message }); } };
exports.setAvatar = (req,res) => send(res, () => profile.setAvatar(req.student.id, req.body.avatarUrl));
exports.uploadSignature = (req, res) => {
  if (!config.cloudinary.configured) return res.status(503).json({ success: false, message: 'Image uploads are not configured on the API.' });
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `${config.cloudinary.uploadFolder}/avatars`;
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, config.cloudinary.apiSecret);
  res.json({ success: true, cloudName: config.cloudinary.cloudName, apiKey: config.cloudinary.apiKey, timestamp, folder, signature });
};
exports.deleteAccount = async (req,res) => { try { await profile.deleteAccount(req.student.id); res.clearCookie('pf_session', { path: '/' }).json({ success: true, message: 'Your account and record have been permanently deleted.' }); } catch (e) { res.status(e.statusCode || 400).json({ success: false, message: e.message }); } };
