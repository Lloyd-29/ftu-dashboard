import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, type Engineer, type Project } from './api';
import {
  type Task, type TaskStatus, type FieldCandidate, taskStatusLabel,
  reviewStatusLabel, todayWIB,
} from './team-types';
import WorkspaceDrawer from './WorkspaceDrawer';

const empty = {
  project_id:'', assignee_engineer_id:'', title:'', description:'',
  type:'job' as 'job'|'field_verification', due_date:todayWIB(),
  site_name:'', visit_date:todayWIB(),
};

export default function TaskWorkspace({canManage}:{canManage:boolean}) {
  const [tasks,setTasks]=useState<Task[]>([]);
  const [projects,setProjects]=useState<Project[]>([]);
  const [engineers,setEngineers]=useState<Engineer[]>([]);
  const [candidates,setCandidates]=useState<FieldCandidate[]>([]);
  const [projectFilter,setProjectFilter]=useState('');
  const [engineerFilter,setEngineerFilter]=useState('');
  const [statusFilter,setStatusFilter]=useState('');
  const [form,setForm]=useState({...empty});
  const [drawer,setDrawer]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [drawerError,setDrawerError]=useState('');

  async function refresh(filters={projectFilter,engineerFilter,statusFilter}) {
    const q=new URLSearchParams();
    if(filters.projectFilter)q.set('project_id',filters.projectFilter);
    if(filters.engineerFilter&&canManage)q.set('assignee_engineer_id',filters.engineerFilter);
    if(filters.statusFilter)q.set('status',filters.statusFilter);
    const r=await api<{tasks:Task[]}>(`/api/tasks${q.size?'?'+q.toString():''}`);
    setTasks(r.tasks);
  }

  useEffect(()=>{
    let live=true;
    Promise.all([
      api<{projects:Project[]}>('/api/projects'),
      canManage?api<{engineers:Engineer[]}>('/api/engineers'):Promise.resolve({engineers:[]}),
      api<{tasks:Task[]}>('/api/tasks'),
    ]).then(([p,e,t])=>{
      if(!live)return;
      setProjects(p.projects);setEngineers(e.engineers);setTasks(t.tasks);
      if(p.projects.length)setForm(prev=>({...prev,project_id:String(p.projects[0].id)}));
    }).catch(e=>{if(live)setError(e instanceof Error?e.message:'Gagal memuat tugas.');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[canManage]);

  useEffect(()=>{
    if(!drawer||!canManage||form.type!=='field_verification'||!form.project_id){setCandidates([]);return;}
    let live=true;
    api<{candidates:FieldCandidate[]}>(`/api/field-verifications/candidates?project_id=${form.project_id}`)
      .then(r=>{if(live)setCandidates(r.candidates);})
      .catch(e=>{if(live)setDrawerError(e instanceof Error?e.message:'Gagal memuat kapasitas.');});
    return()=>{live=false;};
  },[drawer,canManage,form.project_id,form.type]);

  const selectedProject=useMemo(()=>projects.find(p=>String(p.id)===form.project_id),[projects,form.project_id]);
  const assigned=selectedProject?.engineers??[];
  function edit<K extends keyof typeof empty>(key:K,value:(typeof empty)[K]) {
    setForm(p=>({...p,[key]:value}));setDirty(true);
  }
  async function filterSubmit(e:FormEvent) {
    e.preventDefault();setError('');setLoading(true);
    try{await refresh();}catch(err){setError(err instanceof Error?err.message:'Gagal memuat tugas.');}
    finally{setLoading(false);}
  }
  async function create(e:FormEvent) {
    e.preventDefault();setBusy(true);setDrawerError('');setNotice('');
    try {
      await api<{task:Task}>('/api/tasks','POST',{
        project_id:Number(form.project_id),assignee_engineer_id:Number(form.assignee_engineer_id),
        title:form.title.trim(),description:form.description.trim()||null,
        type:form.type,due_date:form.due_date,
        ...(form.type==='field_verification'?{field_verification:{site_name:form.site_name.trim(),visit_date:form.visit_date}}:{}),
      });
      setForm(prev=>({...empty,project_id:prev.project_id}));setDirty(false);setDrawer(false);
      setNotice('Tugas berhasil dibuat dan dicatat di riwayat.');
      setProjectFilter('');setEngineerFilter('');setStatusFilter('');
      const r=await api<{tasks:Task[]}>('/api/tasks');setTasks(r.tasks);
    }catch(err){setDrawerError(err instanceof Error?err.message:'Gagal membuat tugas.');}
    finally{setBusy(false);}
  }
  async function changeStatus(task:Task,status:TaskStatus) {
    setBusy(true);setError('');setNotice('');
    try {
      const result=await api<{task:Task}>(`/api/tasks/${task.id}/status`,'PATCH',{status});
      setTasks(prev=>prev.map(x=>x.id===task.id?result.task:x));
      setNotice(`Status tugas ${task.title} diperbarui.`);
    }catch(err){setError(err instanceof Error?err.message:'Gagal memperbarui status.');}
    finally{setBusy(false);}
  }
  return <main className="ftu-content ftu-team-workspace ftu-hybrid-tasks">
    <div className="ftu-heading"><div><h1>{canManage?'Semua Tugas':'Tugas Saya'}</h1><p>{canManage?'Kelola penugasan engineering dari satu daftar.':'Pekerjaan yang ditugaskan kepada Anda.'}</p></div>
      <div className="ftu-page-actions"><span className="ftu-record-count">{tasks.length} tugas</span>
        {canManage&&<button type="button" className="ftu-primary-action" onClick={()=>{setDrawer(true);setDrawerError('');setDirty(false);}}>+ Tugas baru</button>}
      </div></div>
    <section className="ftu-panel ftu-team-section">
      <div className="ftu-team-title"><h2>Daftar tugas</h2><span>Filter pekerjaan</span></div>
      <form className="ftu-team-filters" onSubmit={filterSubmit}>
        <label>Proyek<select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="">Semua proyek</option>{projects.map(p=><option key={p.id} value={p.id}>{p.code}</option>)}</select></label>
        {canManage&&<label>Engineer<select value={engineerFilter} onChange={e=>setEngineerFilter(e.target.value)}><option value="">Semua engineer</option>{engineers.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>}
        <label>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">Semua status</option>{(Object.keys(taskStatusLabel) as TaskStatus[]).map(s=><option key={s} value={s}>{taskStatusLabel[s]}</option>)}</select></label>
        <button type="submit" className="ftu-team-filter-button">Terapkan</button>
        <button type="button" className="ftu-secondary" onClick={()=>{setProjectFilter('');setEngineerFilter('');setStatusFilter('');void refresh({projectFilter:'',engineerFilter:'',statusFilter:''}).catch(e=>setError(String(e)));}}>Reset</button>
      </form>
      {loading&&<p>Memuat tugas…</p>}
      <div className="ftu-table-scroll"><table className="ftu-team-table"><thead><tr><th>Proyek / tugas</th><th>Engineer</th><th>Jatuh tempo</th><th>Jenis</th><th>Status</th></tr></thead><tbody>
        {tasks.map(task=><tr key={task.id}><td><strong>{task.project_code}</strong><div>{task.title}</div>{task.description&&<small>{task.description}</small>}</td>
          <td>{task.assignee_name}</td><td>{task.due_date}</td>
          <td>{task.type==='job'?'Engineering':<><span>Verifikasi lapangan</span><div><small>{reviewStatusLabel[task.review_status??'pending']}</small></div></>}</td>
          <td><select aria-label={`Status ${task.title}`} disabled={busy||task.review_status==='submitted'||task.review_status==='verified'} value={task.status} onChange={e=>void changeStatus(task,e.target.value as TaskStatus)}>
            {(Object.keys(taskStatusLabel) as TaskStatus[]).filter(s=>task.type==='job'||s!=='done'||task.status==='done'&&s==='done').map(s=><option key={s} value={s}>{taskStatusLabel[s]}</option>)}
          </select></td>
        </tr>)}
      </tbody></table></div>
      {!loading&&tasks.length===0&&<p>Belum ada tugas untuk filter ini.</p>}
    </section>
    {error&&<p role="alert" className="ftu-error">{error}</p>}
    {notice&&<p role="status" className="ftu-success">{notice}</p>}
    {drawer&&<WorkspaceDrawer title="Tugas baru" subtitle="Isi penugasan engineer, lalu simpan." busy={busy} dirty={dirty} onClose={()=>setDrawer(false)}>
      <form onSubmit={create} className="ftu-stack">
        <div className="ftu-team-fields">
          <label>Proyek<select required value={form.project_id} onChange={e=>{edit('project_id',e.target.value);edit('assignee_engineer_id','');}}>
            <option value="">Pilih proyek</option>{projects.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select></label>
          <label>Jenis tugas<select value={form.type} onChange={e=>{edit('type',e.target.value as typeof form.type);edit('assignee_engineer_id','');}}>
            <option value="job">Pekerjaan engineering</option><option value="field_verification">Verifikasi lapangan</option>
          </select></label>
          <label>Tanggal jatuh tempo<input required type="date" value={form.due_date} onChange={e=>edit('due_date',e.target.value)}/></label>
          <label className="ftu-team-span">Judul tugas<input required maxLength={255} value={form.title} onChange={e=>edit('title',e.target.value)} placeholder="Contoh: Tinjau laporan inspeksi"/></label>
          <label className="ftu-team-span">Deskripsi<textarea rows={3} maxLength={10000} value={form.description} onChange={e=>edit('description',e.target.value)}/></label>
          {form.type==='field_verification'&&<>
            <label>Lokasi kunjungan<input required maxLength={255} value={form.site_name} onChange={e=>edit('site_name',e.target.value)}/></label>
            <label>Tanggal kunjungan<input required type="date" value={form.visit_date} onChange={e=>edit('visit_date',e.target.value)}/></label>
          </>}
          <label className="ftu-team-span">Engineer penanggung jawab<select required value={form.assignee_engineer_id} onChange={e=>edit('assignee_engineer_id',e.target.value)}>
            <option value="">Pilih engineer</option>
            {form.type==='field_verification'?candidates.map(c=><option key={c.engineer_id} disabled={!c.is_available} value={c.engineer_id}>{c.name} · {c.total_allocation_percent}% teralokasi · {c.is_available?'Tersedia':!c.is_assigned_to_project?'Belum ditugaskan pada proyek':'Tidak tersedia'}</option>):assigned.map(a=><option key={a.engineer_id} value={a.engineer_id}>{engineers.find(e=>e.id===a.engineer_id)?.name??a.name??`Engineer ${a.engineer_id}`}</option>)}
          </select></label>
        </div>
        {form.type==='field_verification'&&<p className="ftu-helper">Engineer tersedia bila alokasi total kurang dari 80% dan ditugaskan ke proyek.</p>}
        {drawerError&&<p role="alert" className="ftu-error">{drawerError}</p>}
        <div className="ftu-drawer-actions"><button type="button" className="ftu-secondary" disabled={busy} onClick={()=>{if(!dirty||window.confirm('Batalkan form yang belum disimpan?'))setDrawer(false);}}>Batal</button><button type="submit" disabled={busy||!form.project_id}>{busy?'Menyimpan…':'Buat tugas'}</button></div>
      </form>
    </WorkspaceDrawer>}
  </main>;
}
