import React,{useEffect,useRef,useState} from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { notificationApi } from '../services/notificationApi';
import { Modal } from './Modal';
import { Button } from './Button';
import './NotificationPanel.css';

export function NotificationPanel(){
	const [open,setOpen]=useState(false),[data,setData]=useState({notifications:[],unreadCount:0}),[loading,setLoading]=useState(false),[clearing,setClearing]=useState(false),[confirming,setConfirming]=useState(false),[error,setError]=useState('');
	const ref=useRef();
	const load=async()=>{setLoading(true);setError('');try{setData(await notificationApi.list())}catch(e){setError(e.message)}finally{setLoading(false)}};
	useEffect(()=>{if(open)load()},[open]);
	useEffect(()=>{const close=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[]);
	const read=async id=>{try{setData(await notificationApi.markRead(id))}catch(e){setError(e.message)}};
	const clearAll=async()=>{setClearing(true);setError('');try{setData(await notificationApi.clearAll());setConfirming(false)}catch(e){setError(e.message)}finally{setClearing(false)}};
	return <div className="pf-notifications" ref={ref}>
		<button className="pf-icon-btn" onClick={()=>setOpen(!open)} aria-expanded={open} aria-label="Notifications"><Bell size={19}/>{data.unreadCount>0&&<b>{data.unreadCount}</b>}</button>
		{open&&<section className="pf-notification-panel" aria-label="Notifications"><header><strong>Notifications</strong><div className="pf-notification-actions">{data.notifications.some(n=>!n.isRead)&&<button className="pf-notification-clear" onClick={()=>setConfirming(true)}>Clear all</button>}<button onClick={()=>setOpen(false)} aria-label="Close notifications"><X size={17}/></button></div></header>{loading?<p className="pf-notification-state">Loading notifications...</p>:error?<p className="pf-notification-state pf-error">{error}</p>:data.notifications.length===0?<p className="pf-notification-state">You're all caught up.</p>:<ul>{data.notifications.map(n=><li key={n.id} className={n.isRead?'':'is-unread'}><div><strong>{n.title}</strong><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleDateString()}</small></div>{!n.isRead&&<button onClick={()=>read(n.id)} aria-label={`Mark ${n.title} as read`}><CheckCheck size={16}/></button>}</li>)}</ul>}</section>}
		<Modal isOpen={confirming} onClose={()=>!clearing&&setConfirming(false)} title="Clear notifications?" footer={<><Button variant="secondary" onClick={()=>setConfirming(false)} disabled={clearing}>Cancel</Button><Button onClick={clearAll} disabled={clearing}>{clearing?'Clearing...':'Clear all'}</Button></>}><p>This will mark all of your notifications as read.</p></Modal>
	</div>;
}
