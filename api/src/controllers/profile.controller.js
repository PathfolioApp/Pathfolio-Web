const profile = require('../services/profile.service');
const send = async (res, action) => { try { res.json({ success: true, student: await action() }); } catch (e) { res.status(400).json({ success: false, message: e.message }); } };
exports.get = (req,res) => send(res, () => profile.get(req.student.id));
exports.update = (section) => (req,res) => send(res, () => profile.update(req.student.id, section, req.body));
exports.addAchievement = (req,res) => send(res, () => profile.achievement(req.student.id, req.body));
exports.editAchievement = (req,res) => send(res, () => profile.achievement(req.student.id, req.body, req.params.id));
exports.deleteAchievement = (req,res) => send(res, () => profile.deleteAchievement(req.student.id, req.params.id));
exports.changePassword = async (req,res) => { try { await profile.changePassword(req.student.id, req.body.currentPassword, req.body.newPassword); res.json({ success: true, message: 'Password updated securely.' }); } catch (e) { res.status(400).json({ success: false, message: e.message }); } };
