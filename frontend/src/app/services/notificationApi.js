import { apiUrl, apiHeaders } from '../../app/services/apiClient.js';

async function request(path, options={}){const res=await fetch(apiUrl(`/api/notifications${path}`),{...options,credentials:'include',headers:apiHeaders({'Content-Type':'application/json',...(options.headers||{})})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.message||'We could not load notifications.');return data;}
export const notificationApi={list:()=>request('/'),markRead:id=>request(`/${id}/read`,{method:'PATCH'}),clearAll:()=>request('/',{method:'DELETE'})};
