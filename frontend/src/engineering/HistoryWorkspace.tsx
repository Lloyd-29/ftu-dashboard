import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import './finishing-workspace.css';

type LogEntry = {
  id: number; created_at: string|null; field: string;
  old_value: string|null; new_value: string|null;
  user: {id:number;name:string;username:string}|null;
  project: {id:number;code:string;name:string}|null;
};
type HistoryPage = { entries:LogEntry[]; current_page:number;last_page:number;total:number };

const names:Record<string,string> = {
  version:'Versi proyek', progress_percent:'Progres aktual', planned_progress_percent:'Progres rencana',
  status:'Status', engineers:'Penugasan engineer', client_note:'Catatan klien', alerts:'Peringatan',
  task_created:'Tugas dibuat', task_status:'Status tugas', field_verification_created:'Verifikasi dibuat',
  field_verification_submitted:'Hasil verifikasi dikirim', field_verification_review:'Review verifikasi',
  document_uploaded:'Dokumen diunggah', document_revision_uploaded:'Revisi dokumen diunggah',
  document_review:'Review dokumen', document_revision_deleted:'Revisi dokumen dihapus',
  password_changed:'Password diganti', password_reset:'Password direset',
  account_created:'Akun dibuat', account_deactivated:'Akun dinonaktifkan',
  demo_milestone_date:'Tanggal milestone demo',
};
function dateWIB(value:string|null):string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', {dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(value));
}
function textValue(value:string|null):string {
  if (value===null || value==='') return '—';
  if (value.length>170) return value.slice(0,170)+'…';
  return value;
}

export default function HistoryWorkspace({canManageAccounts}:{canManageAccounts:boolean}) {
  const [data,setData]=useState<HistoryPage|null>(null);
  const [page,setPage]=useState(1);
  const [projectId,setProjectId]=useState('');
  const [userId,setUserId]=useState('');
  const [field,setField]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [projects,setProjects]=useState<{id:number;code:string;name:string}[]>([]);
  const [accounts,setAccounts]=useState<{id:number;name:string}[]>([]);

  const refresh=useCallback(async () => {
    setLoading(true);setError('');
    const params=new URLSearchParams({page:String(page)});
    if (projectId) params.set('project_id',projectId);
    if (userId) params.set('user_id',userId);
    if (field.trim()) params.set('field',field.trim());
    try {setData(await api<HistoryPage>('/api/activity-logs?'+params.toString()));}
    catch (err) {setError(err instanceof Error?err.message:'Gagal memuat riwayat.');}
    finally {setLoading(false);}
  },[page,projectId,userId,field]);

  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    let live=true;
    Promise.all([
      api<{projects:{id:number;code:string;name:string}[]}>('/api/projects'),
      canManageAccounts ? api<{users:{id:number;name:string}[]}>('/api/users') : Promise.resolve({users:[]} as {users:{id:number;name:string}[]}),
    ]).then(([p,u])=>{if(live){setProjects(p.projects);setAccounts(u.users);}})
      .catch(()=>{ /* Filters remain optional if metadata is unavailable. */ });
    return ()=>{live=false};
  },[canManageAccounts]);

  return <main className="ftu-content ftu-finishing">
    <div className="ftu-heading"><div><h1>Riwayat aktivitas</h1><p>Jejak perubahan sistem. Halaman ini hanya untuk membaca.</p></div><span>{data?.total??0} catatan</span></div>
    <section className="ftu-panel">
      <div className="ftu-filters">
        <label>Proyek<select value={projectId} onChange={(e:{target:{value:string}})=>{setProjectId(e.target.value);setPage(1);}}>
          <option value="">Semua proyek</option>{projects.map(p=><option value={p.id} key={p.id}>{p.code} — {p.name}</option>)}
        </select></label>
        {canManageAccounts&&<label>Pengguna<select value={userId} onChange={(e:{target:{value:string}})=>{setUserId(e.target.value);setPage(1);}}>
          <option value="">Semua pengguna</option>{accounts.map(u=><option value={u.id} key={u.id}>{u.name}</option>)}
        </select></label>}
        <label>Jenis perubahan<input value={field} onChange={(e:{target:{value:string}})=>{setField(e.target.value);setPage(1);}} placeholder="Contoh: document_review"/></label>
        <button type="button" className="ftu-outline-button" onClick={()=>void refresh()}>Muat ulang</button>
      </div>
      {error&&<p className="ftu-error" role="alert">{error}</p>}
      {loading&&<p role="status">Memuat riwayat…</p>}
      {!loading&&data&&<>
        <div className="ftu-table-scroll"><table className="ftu-data-table">
          <thead><tr><th>Waktu (WIB)</th><th>Pengguna</th><th>Proyek</th><th>Aktivitas</th><th>Perubahan</th></tr></thead>
          <tbody>{data.entries.map(row=><tr key={row.id}>
            <td>{dateWIB(row.created_at)}</td>
            <td>{row.user?.name??'Pengguna tidak tersedia'}</td>
            <td>{row.project?.code??'Sistem'}</td>
            <td><strong>{names[row.field]??row.field}</strong></td>
            <td className="ftu-diff"><span>{textValue(row.old_value)}</span><span aria-hidden="true">→</span><span>{textValue(row.new_value)}</span></td>
          </tr>)}</tbody>
        </table></div>
        {data.entries.length===0&&<p className="ftu-empty">Belum ada aktivitas sesuai filter.</p>}
        <div className="ftu-pager"><span>Halaman {data.current_page} dari {data.last_page}</span>
          <button type="button" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Sebelumnya</button>
          <button type="button" disabled={page>=data.last_page} onClick={()=>setPage(p=>p+1)}>Berikutnya</button>
        </div>
      </>}
    </section>
  </main>;
}
