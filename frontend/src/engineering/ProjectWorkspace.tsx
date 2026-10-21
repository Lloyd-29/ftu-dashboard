import { useEffect, useState, type FormEvent } from 'react';
import { api, type Alert, type Engineer, type Project } from './api';

const statuses:Record<Project['status'],string>={on_track:'Sesuai jadwal',at_risk:'Berisiko',delayed:'Terlambat'};
function dateToday():string {return new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'});}
function countValue(value:string):number|null {return value===''?null:Number(value);}

export default function ProjectWorkspace({canEdit}:{canEdit:boolean}) {
  const [list,setList]=useState<Project[]>([]);
  const [engineers,setEngineers]=useState<Engineer[]>([]);
  const [active,setActive]=useState<Project|null>(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [noteDate,setNoteDate]=useState(dateToday());
  const [noteBody,setNoteBody]=useState('');
  const [filter,setFilter]=useState('');

  useEffect(()=>{
    let live=true;
    Promise.all([api<{projects:Project[]}>('/api/projects'),canEdit?api<{engineers:Engineer[]}>('/api/engineers'):Promise.resolve({engineers:[]})])
      .then(([p,e])=>{if(live){setList(p.projects);setEngineers(e.engineers);if(p.projects.length)void load(p.projects[0].id);}})
      .catch(e=>{if(live)setError(e instanceof Error?e.message:'Gagal memuat proyek.');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  // Load once when opening the workspace.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[canEdit]);

  async function load(id:number) {
    setError('');setNotice('');setBusy(true);
    try {const response=await api<{project:Project}>(`/api/projects/${id}`);setActive(response.project);setNoteBody('');setNoteDate(dateToday());}
    catch(e){setError(e instanceof Error?e.message:'Gagal memuat detail.');}
    finally{setBusy(false);}
  }

  function field<K extends keyof Project>(key:K,value:Project[K]) {setActive(prev=>prev?{...prev,[key]:value}:null);}
  function assign(id:number, percentage:number|null) {
    setActive(prev=>prev?{...prev,engineers:percentage===null?prev.engineers.filter(x=>x.engineer_id!==id):[
      ...prev.engineers.filter(x=>x.engineer_id!==id),{engineer_id:id,allocation_percent:percentage},
    ]}:prev);
  }
  function updateAlert(index:number, patch:Partial<Alert>) {
    setActive(prev=>prev?{...prev,alerts:prev.alerts.map((a,i)=>i===index?{...a,...patch}:a)}:null);
  }
  async function save(e:FormEvent) {
    e.preventDefault();if(!active||!canEdit)return;
    setBusy(true);setError('');setNotice('');
    try {
      const {id,version,status,progress_percent,planned_progress_percent,sop_phase,
        next_milestone_name,next_milestone_date,risks,findings_open,findings_closed,engineers:assignments,alerts}=active;
      const body={version,status,progress_percent,planned_progress_percent,sop_phase,
        next_milestone_name,next_milestone_date,risks,findings_open,findings_closed,
        engineers:assignments.map(a=>({engineer_id:a.engineer_id,allocation_percent:a.allocation_percent})),
        alerts:alerts.map(a=>({...(a.id?{id:a.id}:{}),title:a.title,severity:a.severity,due_date:a.due_date,is_resolved:a.is_resolved})),
        ...(noteBody.trim()?{note:{note_date:noteDate,body:noteBody.trim()}}:{}),
      };
      const response=await api<{project:Project}>(`/api/projects/${id}`,'PUT',body);
      setActive(response.project);setList(prev=>prev.map(p=>p.id===id?response.project:p));
      setNoteBody('');setNotice('Perubahan tersimpan dan masuk riwayat aktivitas.');
    } catch(err) {setError(err instanceof Error?err.message:'Gagal menyimpan.');}
    finally{setBusy(false);}
  }

  return <main className="ftu-content">
    <div className="ftu-heading"><div><h1>Data Proyek</h1><p>{canEdit?'Perbarui status dan penugasan dalam satu halaman.':'Proyek yang ditugaskan kepada Anda.'}</p></div><span>{list.length} proyek</span></div>
    <div className="ftu-project-grid">
      <aside className="ftu-panel ftu-project-list">
        <label>Cari proyek<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Kode, nama, klien" /></label>
        {loading&&<p>Memuat proyek…</p>}
        {list.filter(p=>`${p.code} ${p.name} ${p.client}`.toLowerCase().includes(filter.toLowerCase())).map(p=><button type="button" key={p.id} className={`ftu-project-item ${active?.id===p.id?'selected':''}`} onClick={()=>void load(p.id)}>
          <strong>{p.code}</strong><span>{p.name}</span><small>{statuses[p.status]} · {p.progress_percent===null?'Belum diisi':`${p.progress_percent}%`}</small>
        </button>)}
        {!loading&&list.length===0&&<p>Belum ada proyek yang dapat diakses.</p>}
      </aside>
      <section className="ftu-panel ftu-detail">
        {!active?<p>Pilih proyek untuk melihat detail.</p>:<>
          <div className="ftu-detail-title"><div><span className="ftu-eyebrow">{active.code} · Versi {active.version}</span><h2>{active.name}</h2><p>Klien: {active.client}</p></div><span className={`ftu-mini-pill ${active.status}`}>{statuses[active.status]}</span></div>
          <form onSubmit={save} className="ftu-stack">
            <fieldset disabled={!canEdit||busy}>
              <div className="ftu-section-heading">Progres dan jadwal</div>
              <div className="ftu-fields">
                <label>Status<select value={active.status} onChange={e=>field('status',e.target.value as Project['status'])}><option value="on_track">Sesuai jadwal</option><option value="at_risk">Berisiko</option><option value="delayed">Terlambat</option></select></label>
                <label>Progres aktual (%)<input type="number" min={0} max={100} placeholder="Belum diisi" value={active.progress_percent??''} onChange={e=>field('progress_percent',countValue(e.target.value))}/></label>
                <label>Progres rencana (%)<input type="number" min={0} max={100} placeholder="Belum diisi" value={active.planned_progress_percent??''} onChange={e=>field('planned_progress_percent',countValue(e.target.value))}/></label>
                <label>Fase SOP<input value={active.sop_phase??''} onChange={e=>field('sop_phase',e.target.value||null)} /></label>
                <label>Milestone berikutnya<input value={active.next_milestone_name??''} onChange={e=>field('next_milestone_name',e.target.value||null)}/></label>
                <label>Tanggal milestone<input type="date" value={active.next_milestone_date??''} onChange={e=>field('next_milestone_date',e.target.value||null)} /></label>
                <label>Temuan terbuka<input type="number" min={0} value={active.findings_open} onChange={e=>field('findings_open',Number(e.target.value||0))}/></label>
                <label>Temuan tertutup<input type="number" min={0} value={active.findings_closed} onChange={e=>field('findings_closed',Number(e.target.value||0))}/></label>
                <label className="ftu-wide">Kendala / risiko<textarea rows={3} value={active.risks??''} onChange={e=>field('risks',e.target.value||null)}/></label>
              </div>
              <div className="ftu-section-heading">Penugasan engineer</div>
              <div className="ftu-assignments">
                {active.engineers.map(a=><div className="ftu-assignment" key={a.engineer_id}><span>{engineers.find(e=>e.id===a.engineer_id)?.name ?? a.name ?? a.engineer_id}</span><label>Alokasi (%)<input type="number" min={0} max={100} value={a.allocation_percent} onChange={e=>assign(a.engineer_id,Number(e.target.value||0))}/></label>{canEdit&&<button type="button" className="ftu-subtle" onClick={()=>assign(a.engineer_id,null)}>Hapus</button>}</div>)}
                {active.engineers.length===0&&<p>Belum ada engineer yang ditugaskan.</p>}
                {canEdit&&<label className="ftu-inline">Tambahkan engineer<select value="" onChange={e=>{if(e.target.value)assign(Number(e.target.value),0);}}><option value="">Pilih engineer…</option>{engineers.filter(e=>!active.engineers.some(a=>a.engineer_id===e.id)).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>}
              </div>
              <div className="ftu-section-heading">Peringatan proyek</div>
              {active.alerts.map((a,i)=><div className="ftu-alert-edit" key={a.id??`new-${i}`}>
                <label>Judul<input required value={a.title} onChange={e=>updateAlert(i,{title:e.target.value})}/></label>
                <label>Tingkat<select value={a.severity} onChange={e=>updateAlert(i,{severity:e.target.value as Alert['severity']})}><option value="info">Informasi</option><option value="warning">Peringatan</option><option value="critical">Kritis</option></select></label>
                <label>Jatuh tempo<input type="date" value={a.due_date??''} onChange={e=>updateAlert(i,{due_date:e.target.value||null})}/></label>
                <label className="ftu-checkbox"><input type="checkbox" checked={a.is_resolved} onChange={e=>updateAlert(i,{is_resolved:e.target.checked})}/>Selesai</label>
                {canEdit&&<button type="button" className="ftu-subtle" onClick={()=>field('alerts',active.alerts.filter((_,idx)=>i!==idx))}>Hapus</button>}
              </div>)}
              {canEdit&&<button type="button" className="ftu-secondary" onClick={()=>field('alerts',[...active.alerts,{title:'',severity:'warning',due_date:null,is_resolved:false}])}>+ Tambah peringatan</button>}
              <div className="ftu-section-heading">Catatan klien</div>
              <div className="ftu-notes">{active.notes.map(n=><article key={n.id}><strong>{n.note_date}</strong> <span>· {n.created_by_name??'Tim FTU'}</span><p>{n.body}</p></article>)}{active.notes.length===0&&<p>Belum ada catatan klien.</p>}</div>
              {canEdit&&<div className="ftu-fields"><label>Tanggal catatan baru<input type="date" value={noteDate} onChange={e=>setNoteDate(e.target.value)}/></label><label className="ftu-wide">Tambah catatan<textarea rows={3} placeholder="Opsional, akan ditambahkan saat simpan" value={noteBody} onChange={e=>setNoteBody(e.target.value)}/></label></div>}
            </fieldset>
            {error&&<p role="alert" className="ftu-error">{error} {error.includes('Muat ulang')&&<button type="button" className="ftu-subtle" onClick={()=>void load(active.id)}>Muat ulang proyek</button>}</p>}
            {notice&&<p role="status" className="ftu-success">{notice}</p>}
            {canEdit&&<div className="ftu-savebar"><span>Perubahan akan dicatat dalam riwayat.</span><button disabled={busy} type="submit">{busy?'Menyimpan…':'Simpan perubahan'}</button></div>}
          </form>
        </>}
        {!active&&error&&<p className="ftu-error" role="alert">{error}</p>}
      </section>
    </div>
  </main>;
}
