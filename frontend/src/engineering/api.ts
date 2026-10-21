export type Role = 'admin' | 'coordinator' | 'director' | 'engineer' | 'viewer';
export type User = { id:number; name:string; username:string; role:Role; engineer_id:number|null; must_change_password:boolean };
export type Assignment = { engineer_id:number; name?:string; allocation_percent:number };
export type ClientNote = { id:number; note_date:string; body:string; created_by_name:string|null };
export type Alert = { id?:number; title:string; severity:'info'|'warning'|'critical'; due_date:string|null; is_resolved:boolean };
export type Project = {
  id:number; code:string; name:string; client:string; status:'on_track'|'at_risk'|'delayed';
  progress_percent:number|null; planned_progress_percent:number|null; sop_phase:string|null;
  next_milestone_name:string|null; next_milestone_date:string|null; risks:string|null;
  findings_open:number; findings_closed:number; version:number; updated_at:string|null;
  engineers:Assignment[]; notes:ClientNote[]; alerts:Alert[];
};
export type Engineer = { id:number; name:string; initials:string|null };
export class ApiError extends Error {
  status:number;
  constructor(message:string, status:number) { super(message); this.status=status; }
}
function xsrf():string {
  const row=document.cookie.split('; ').find(x=>x.startsWith('XSRF-TOKEN='));
  return row ? decodeURIComponent(row.split('=').slice(1).join('=')) : '';
}
export async function api<T>(url:string, method='GET', body?:unknown):Promise<T> {
  const headers:Record<string,string> = {Accept:'application/json'};
  if (body !== undefined) headers['Content-Type']='application/json';
  const token=xsrf();
  if (token) headers['X-XSRF-TOKEN']=token;
  const response=await fetch(url,{method,headers,credentials:'same-origin',cache:'no-store',body:body===undefined?undefined:JSON.stringify(body)});
  let data:unknown={};
  try { data=await response.json(); } catch { /* Missing JSON from backend */ }
  if (!response.ok) {
    const issue=data as {message?:string;errors?:Record<string,string[]>};
    throw new ApiError(Object.values(issue.errors ?? {}).flat().join(' ') || issue.message || `Permintaan gagal (${response.status}).`,response.status);
  }
  return data as T;
}
export async function csrf():Promise<void> {
  const response=await fetch('/sanctum/csrf-cookie',{credentials:'same-origin',cache:'no-store'});
  if (!response.ok) throw new ApiError('Gagal menyiapkan sesi aman.',response.status);
}
