const router=require('express').Router(); const auth=require('../middleware/authenticate'); const store=require('../models/studentStore'); router.use(auth);
router.get('/',async(req,res,next)=>{try{const notifications=await store.getNotifications(req.student.id);res.json({success:true,notifications,unreadCount:notifications.filter(n=>!n.isRead).length});}catch(e){next(e)}});
router.patch('/:id/read',async(req,res,next)=>{try{const notifications=await store.markNotificationRead(req.student.id,req.params.id);res.json({success:true,notifications,unreadCount:notifications.filter(n=>!n.isRead).length});}catch(e){next(e)}});
router.patch('/read-all',async(req,res,next)=>{try{const notifications=await store.markAllNotificationsRead(req.student.id);res.json({success:true,notifications,unreadCount:notifications.filter(n=>!n.isRead).length});}catch(e){next(e)}});
router.delete('/',async(req,res,next)=>{try{const notifications=await store.clearNotifications(req.student.id);res.json({success:true,notifications,unreadCount:0});}catch(e){next(e)}});
module.exports=router;
