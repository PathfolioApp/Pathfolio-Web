const router=require('express').Router(); const auth=require('../../shared/authenticate'); const store=require('../students/studentStore'); const bus=require('../../shared/notificationBus'); const config=require('../../config'); const crypto=require('crypto');
// EventSource cannot attach the X-API-Key header, so the stream accepts the
// application key via ?apiKey=. Timing-safe compare; per-user auth still
// comes from the session cookie in the standard middleware below.
const sseKeyGate=(req,res,next)=>{const allowed=config.apiKeys;if(!allowed.length)return next();const presented=String(req.query.apiKey||'');const ok=allowed.some(expected=>{const a=Buffer.from(presented),b=Buffer.from(expected);return a.length===b.length&&crypto.timingSafeEqual(a,b);});if(!ok)return res.status(401).json({success:false,message:'Invalid or missing API key.'});next();};
router.get('/stream',sseKeyGate,auth,(req,res)=>{res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache, no-transform');res.setHeader('Connection','keep-alive');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();res.write(': connected\n\n');const unsubscribe=bus.subscribe(req.student.id,res);const keepAlive=setInterval(()=>{try{res.write(': ping\n\n');}catch{/* handled by close */}},25_000);req.on('close',()=>{clearInterval(keepAlive);unsubscribe();});});
router.use(auth);
router.get('/',async(req,res,next)=>{try{const notifications=await store.getNotifications(req.student.id);res.json({success:true,notifications,unreadCount:notifications.filter(n=>!n.isRead).length});}catch(e){next(e)}});
router.patch('/:id/read',async(req,res,next)=>{try{const notifications=await store.markNotificationRead(req.student.id,req.params.id);res.json({success:true,notifications,unreadCount:notifications.filter(n=>!n.isRead).length});}catch(e){next(e)}});
router.patch('/read-all',async(req,res,next)=>{try{const notifications=await store.markAllNotificationsRead(req.student.id);res.json({success:true,notifications,unreadCount:notifications.filter(n=>!n.isRead).length});}catch(e){next(e)}});
router.delete('/',async(req,res,next)=>{try{const notifications=await store.clearNotifications(req.student.id);res.json({success:true,notifications,unreadCount:0});}catch(e){next(e)}});
module.exports=router;
