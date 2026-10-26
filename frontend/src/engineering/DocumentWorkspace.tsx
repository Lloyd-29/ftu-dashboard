import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, type Project, type ApiError } from './api';
import { todayWIB, type Task } from './team-types';
import type { DocumentList, FTUDocument, Revision, DocumentStatus } from './document-types';
import './document-workspace.css';

type Props = { canManage:boolean; canDelete:boolean; onPendingChange?:(count:number)=>void };
const statusText:Record<DocumentStatus,string> = {
  submitted:'Menunggu review', revision_needed:'Perlu revisi', checked:'Diperiksa',
};
const initialUpload = {doc_no:'',title:'',doc_type:'',client_name:'',revision_label:'A',description:'',issued_date:todayWIB(),task_id:''};

async function sendPdf(url:string, body:FormData):Promise<{document:FTUDocument}> {
  const token = document.cookie.split('; ').find(row=>row.startsWith('XSRF-TOKEN='));
  const headers:Record<string,string> = {Accept:'application/json'};
  if(token)headers['X-XSRF-TOKEN']=decodeURIComponent(token.slice('XSRF-TOKEN='.length));
  const response=await fetch(url,{method:'POST',body,headers,credentials:'same-origin',cache:'no-store'});
  const value=await response.json().catch(()=>({})) as {document?:FTUDocument;message?:string;errors?:Record<string,string[]>};
  if(!response.ok)throw new Error(Object.values(value.errors??{}).flat().join(' ')||value.message||`Gagal mengunggah (${response.status}).`);
  if(!value.document)throw new Error('Respons server tidak lengkap.');
  return {document:value.document};
}

function DateText({date}:{date:string|null}) {
  return <>{date?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeZone:'Asia/Jakarta'}).format(new Date(date+'T12:00:00+07:00')):'—'}</>;
}

export default function DocumentWorkspace({canManage,canDelete,onPendingChange}:Props) {
  const [documents,setDocuments]=useState<FTUDocument[]>([]);
  const [types,setTypes]=useState<string[]>([]);
  const [projects,setProjects]=useState<Project[]>([]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [projectId,setProjectId]=useState('');
  const [filterProject,setFilterProject]=useState('');
  const [filterStatus,setFilterStatus]=useState('');
  const [draft,setDraft]=useState({...initialUpload});
  const [file,setFile]=useState<File|null>(null);
  const [reFile,setReFile]=useState<File|null>(null);
  const [reLabel,setReLabel]=useState('B');
  const [reDescription,setReDescription]=useState('');
  const [reDate,setReDate]=useState(initialUpload.issued_date);
  const [reviewNotes,setReviewNotes]=useState<Record<number,string>>({});
  const [typeEditor,setTypeEditor]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');

  async function load() {
    const response=await api<DocumentList>('/api/documents');
    setDocuments(response.documents);setTypes(response.types);
    onPendingChange?.(response.pending_review_count);
    setSelectedId(old=>old&&response.documents.some(doc=>doc.id===old)?old:response.documents[0]?.id??null);
  }

  useEffect(()=>{
    let active=true;
    Promise.all([
      api<DocumentList>('/api/documents'),
      api<{projects:Project[]}>('/api/projects'),
      api<{tasks:Task[]}>('/api/tasks'),
    ]).then(([docs,pr,ts])=>{
      if(!active)return;
      setDocuments(docs.documents);setTypes(docs.types);setProjects(pr.projects);setTasks(ts.tasks);
      onPendingChange?.(docs.pending_review_count);
      setSelectedId(docs.documents[0]?.id??null);
      setProjectId(String(pr.projects[0]?.id??''));
      setDraft(d=>({...d,client_name:pr.projects[0]?.client??'',doc_type:docs.types[0]??''}));
    }).catch(e=>{if(active)setError((e as Error).message);})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false};
  },[]);

  const visible=useMemo(()=>documents.filter(doc=>
    (!filterProject||doc.project_id===Number(filterProject))&&
    (!filterStatus||doc.revisions.some(rev=>rev.status===filterStatus))
  ),[documents,filterProject,filterStatus]);
  const chosen=documents.find(doc=>doc.id===selectedId)??null;
  const forProject=tasks.filter(task=>task.project_id===Number(projectId));
  const nextLabel=(doc:FTUDocument):string=>{
    const last=doc.revisions[doc.revisions.length-1]?.revision_label??'A';
    if(/^[A-Z]$/.test(last))return last==='Z'?'0':String.fromCharCode(last.charCodeAt(0)+1);
    return String(Number(last)+1);
  };

  useEffect(()=>{
    if(chosen)setReLabel(nextLabel(chosen));
  },[chosen?.id,chosen?.revisions[chosen.revisions.length-1]?.id]);

  async function create(e:FormEvent) {
    e.preventDefault();if(!file)return setError('Pilih berkas PDF terlebih dahulu.');
    setSaving(true);setError('');setSuccess('');
    try {
      const form=new FormData();
      Object.entries({...draft,project_id:projectId}).forEach(([key,val])=>{if(val)form.append(key,val);});
      form.append('file',file);
      const result=await sendPdf('/api/documents',form);
      await load();setSelectedId(result.document.id);
      setDraft(d=>({...d,doc_no:'',title:'',description:'',revision_label:'A'}));setFile(null);
      const picker=document.getElementById('m3-new-file') as HTMLInputElement|null;if(picker)picker.value='';
      setSuccess('Dokumen berhasil diajukan untuk review.');
    }catch(e){setError((e as Error).message)}finally{setSaving(false)}
  }

  async function revise(e:FormEvent) {
    e.preventDefault();if(!chosen||!reFile)return setError('Pilih berkas revisi terlebih dahulu.');
    setSaving(true);setError('');setSuccess('');
    try {
      const form=new FormData();
      form.append('revision_label',reLabel);form.append('description',reDescription);
      form.append('issued_date',reDate);form.append('file',reFile);
      await sendPdf(`/api/documents/${chosen.id}/revisions`,form);
      setReFile(null);setReDescription('');
      const picker=document.getElementById('m3-revision-file') as HTMLInputElement|null;if(picker)picker.value='';
      await load();setSuccess('Revisi baru berhasil diajukan.');
    }catch(e){setError((e as Error).message)}finally{setSaving(false)}
  }

  async function review(revision:Revision,decision:'checked'|'revision_needed') {
    if(decision==='revision_needed'&&!reviewNotes[revision.id]?.trim()){
      setError('Catatan wajib diisi saat meminta revisi.');return;
    }
    setSaving(true);setError('');setSuccess('');
    try {
      await api(`/api/document-revisions/${revision.id}/review`,'PATCH',{
        decision,review_note:reviewNotes[revision.id]??null,
      });
      await load();setSuccess(decision==='checked'?'Revisi ditandai Diperiksa.':'Catatan revisi terkirim.');
    }catch(e){setError((e as ApiError).message)}finally{setSaving(false)}
  }

  async function deleteRevision(revision:Revision) {
    if(!window.confirm(`Hapus revisi ${revision.revision_label}? Berkas privat juga akan dihapus.`))return;
    setSaving(true);setError('');
    try {await api(`/api/document-revisions/${revision.id}`,'DELETE');await load();setSuccess('Revisi dihapus.');}
    catch(e){setError((e as Error).message)}finally{setSaving(false)}
  }

  async function saveTypes() {
    if(typeEditor===null)return;
    setSaving(true);setError('');
    try {const updated=await api<{types:string[]}>('/api/documents/types','PUT',{
      types:typeEditor.split('\n').map(t=>t.trim()).filter(Boolean),
    });setTypes(updated.types);setTypeEditor(null);setSuccess('Jenis dokumen tersimpan.');}
    catch(e){setError((e as Error).message)}finally{setSaving(false)}
  }

  return <main className="ftu-content ftu-doc-workspace">
    <header className="ftu-heading"><div><h1>Dokumen & Review</h1><p>PDF privat · Lembar revisi · Pemeriksaan coordinator</p></div>
      <span>{documents.filter(d=>d.revisions.some(r=>r.status==='submitted')).length} dokumen dengan review tertunda</span></header>
    {error&&<p className="ftu-error" role="alert">{error}</p>}
    {success&&<p className="ftu-success" role="status">{success}</p>}
    {loading?<section className="ftu-panel">Memuat dokumen…</section>:<>
      <section className="ftu-panel ftu-doc-create">
        <h2>Ajukan dokumen baru</h2>
        <form className="ftu-doc-fields" onSubmit={create}>
          <label>Proyek<select required value={projectId} onChange={e=>{
            const id=e.target.value;setProjectId(id);setDraft(d=>({...d,client_name:projects.find(p=>p.id===Number(id))?.client??'',task_id:''}));
          }}><option value="">Pilih proyek</option>{projects.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
          <label>Tugas terkait (opsional)<select value={draft.task_id} onChange={e=>setDraft(d=>({...d,task_id:e.target.value}))}>
            <option value="">Tidak dikaitkan ke tugas</option>{forProject.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}
          </select></label>
          <label>Nomor dokumen<input required placeholder="FTU-0001/R.RLA-PRV/X/2026" value={draft.doc_no} onChange={e=>setDraft(d=>({...d,doc_no:e.target.value.toUpperCase()}))}/></label>
          <label className="ftu-doc-wide">Judul<input required maxLength={255} value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))}/></label>
          <label>Jenis dokumen<select value={draft.doc_type} required onChange={e=>setDraft(d=>({...d,doc_type:e.target.value}))}>{types.map(t=><option key={t}>{t}</option>)}</select></label>
          <label>Nama klien<input required maxLength={255} value={draft.client_name} onChange={e=>setDraft(d=>({...d,client_name:e.target.value}))}/></label>
          <label>Revisi (A, B atau 0)<input required value={draft.revision_label} onChange={e=>setDraft(d=>({...d,revision_label:e.target.value.toUpperCase()}))}/></label>
          <label>Tanggal terbit<input type="date" required value={draft.issued_date} onChange={e=>setDraft(d=>({...d,issued_date:e.target.value}))}/></label>
          <label className="ftu-doc-wide">Keterangan revisi<textarea required value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))}/></label>
          <label>PDF privat (maks. 15 MB)<input id="m3-new-file" required type="file" accept=".pdf,application/pdf" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
          <div className="ftu-doc-actions"><button disabled={saving||!projectId} type="submit">{saving?'Memproses…':'Unggah & ajukan review'}</button></div>
        </form>
      </section>
      {canManage&&<section className="ftu-doc-types"><button type="button" className="ftu-subtle" onClick={()=>setTypeEditor(typeEditor===null?types.join('\n'):null)}>Pengaturan jenis dokumen</button>
        {typeEditor!==null&&<div className="ftu-panel"><h2>Jenis dokumen</h2><p>Satu jenis per baris; tidak mengubah jenis dokumen yang sudah ada.</p><textarea rows={6} value={typeEditor} onChange={e=>setTypeEditor(e.target.value)}/><button disabled={saving} type="button" onClick={saveTypes}>Simpan jenis</button></div>}
      </section>}
      <div className="ftu-doc-grid"><section className="ftu-panel ftu-doc-list"><h2>Register dokumen</h2>
        <div className="ftu-doc-filters"><label>Proyek<select value={filterProject} onChange={e=>setFilterProject(e.target.value)}><option value="">Semua proyek</option>{projects.map(p=><option key={p.id} value={p.id}>{p.code}</option>)}</select></label>
        <label>Status<select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="">Semua status</option><option value="submitted">Menunggu review</option><option value="revision_needed">Perlu revisi</option><option value="checked">Diperiksa</option></select></label></div>
        {visible.length===0?<p>Belum ada dokumen.</p>:visible.map(doc=><button type="button" className={`ftu-doc-item ${selectedId===doc.id?'selected':''}`} key={doc.id} onClick={()=>{setSelectedId(doc.id);setReLabel(nextLabel(doc));}}>
          <strong>{doc.doc_no}</strong><span>{doc.title}</span><small>{doc.project_code} · {doc.doc_type}</small><small>Terakhir: {statusText[doc.revisions[doc.revisions.length-1]?.status??'submitted']}</small>
        </button>)}</section>
      <section className="ftu-panel ftu-doc-detail">{!chosen?<p>Pilih dokumen untuk melihat lembar revisi.</p>:<>
        <div className="ftu-detail-title"><div><span className="ftu-eyebrow">{chosen.doc_no}</span><h2>{chosen.title}</h2><p>{chosen.project_code} · {chosen.client_name} · {chosen.doc_type}</p></div></div>
        <h3>Lembar revisi</h3><div className="ftu-table-scroll"><table className="ftu-doc-table"><thead><tr><th>Rev</th><th>Tanggal</th><th>Keterangan</th><th>Prepared</th><th>Checked</th><th>Status / PDF</th></tr></thead>
          <tbody>{chosen.revisions.map(rev=><tr key={rev.id}><td><strong>{rev.revision_label}</strong><small>{rev.issue_purpose==='review'?'Untuk ditinjau':'Untuk persetujuan'}</small></td><td><DateText date={rev.issued_date}/></td><td>{rev.description}</td>
            <td>{rev.uploaded_by_name??'—'}<small>{rev.prepared_initials??'—'} · <DateText date={rev.issued_date}/></small></td>
            <td>{rev.reviewed_by_name??'Belum diperiksa'}<small>{rev.checked_initials??'—'} · {rev.reviewed_at?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeZone:'Asia/Jakarta'}).format(new Date(rev.reviewed_at)):'—'}</small></td>
            <td><span className={`ftu-doc-pill ${rev.status}`}>{statusText[rev.status]}</span><a href={rev.download_url} target="_blank" rel="noopener">Buka PDF</a>
              {rev.review_note&&<small className="ftu-doc-review-note">Catatan: {rev.review_note}</small>}
              {canManage&&rev.status==='submitted'&&<div className="ftu-doc-review">
                <textarea aria-label={`Catatan review ${rev.revision_label}`} placeholder="Catatan jika perlu revisi" value={reviewNotes[rev.id]??''} onChange={e=>setReviewNotes(p=>({...p,[rev.id]:e.target.value}))}/>
                <button disabled={saving} type="button" onClick={()=>review(rev,'checked')}>Tandai Diperiksa</button>
                <button disabled={saving} className="ftu-doc-secondary" type="button" onClick={()=>review(rev,'revision_needed')}>Minta revisi</button>
              </div>}
              {canDelete&&rev.status!=='submitted'&&<button type="button" className="ftu-doc-danger" disabled={saving} onClick={()=>deleteRevision(rev)}>Hapus revisi (coordinator)</button>}
            </td></tr>)}</tbody></table></div>
        <p className="ftu-helper">Approved oleh klien dilakukan di luar sistem. Status persetujuan klien belum dicatat pada M3.</p>
        {chosen.revisions[chosen.revisions.length-1]?.status!=='submitted'&&<form className="ftu-doc-revise" onSubmit={revise}>
          <h3>Unggah revisi berikutnya</h3><div className="ftu-doc-fields">
            <label>Label berikutnya<input required value={reLabel} onChange={e=>setReLabel(e.target.value.toUpperCase())} placeholder={nextLabel(chosen)}/></label>
            <label>Tanggal terbit<input required type="date" value={reDate} onChange={e=>setReDate(e.target.value)}/></label>
            <label className="ftu-doc-wide">Keterangan revisi<textarea required value={reDescription} onChange={e=>setReDescription(e.target.value)}/></label>
            <label>PDF baru<input required id="m3-revision-file" type="file" accept=".pdf,application/pdf" onChange={e=>setReFile(e.target.files?.[0]??null)}/></label>
            <div className="ftu-doc-actions"><button disabled={saving} type="submit">Unggah revisi</button></div>
          </div>
        </form>}
      </>}</section></div>
    </>}
  </main>;
}
