import { useEffect, useState, type FormEvent } from 'react';
import { api, type Project } from './api';
import { type FieldVerification, type ReviewStatus, reviewStatusLabel } from './team-types';

export default function FieldVerificationWorkspace({canManage}:{canManage:boolean}) {
  const [items,setItems] = useState<FieldVerification[]>([]);
  const [projects,setProjects] = useState<Project[]>([]);
  const [selected,setSelected] = useState<number|null>(null);
  const [projectFilter,setProjectFilter] = useState('');
  const [reviewFilter,setReviewFilter] = useState('');
  const [result,setResult] = useState<'confirmed'|'findings'>('confirmed');
  const [findings,setFindings] = useState(0);
  const [notes,setNotes] = useState('');
  const [decision,setDecision] = useState<'verify'|'revision_needed'>('verify');
  const [reviewNote,setReviewNote] = useState('');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const active=items.find(v=>v.id===selected)??null;

  async function refresh(project=projectFilter,review=reviewFilter) {
    const params=new URLSearchParams();
    if(project)params.set('project_id',project);
    if(review)params.set('review_status',review);
    const response=await api<{verifications:FieldVerification[]}>(`/api/field-verifications${params.size?'?'+params:''}`);
    setItems(response.verifications);
    setSelected(prev=>response.verifications.some(v=>v.id===prev)?prev:response.verifications[0]?.id??null);
  }

  useEffect(()=>{
    let live=true;
    Promise.all([api<{verifications:FieldVerification[]}>('/api/field-verifications'),api<{projects:Project[]}>('/api/projects')])
      .then(([v,p])=>{if(live){setItems(v.verifications);setProjects(p.projects);setSelected(v.verifications[0]?.id??null);}})
      .catch(e=>{if(live)setError(e instanceof Error?e.message:'Gagal memuat verifikasi.');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[]);

  useEffect(()=>{
    if(!active)return;
    setResult(active.result==='findings'?'findings':'confirmed');
    setFindings(active.result==='findings'?active.findings_count:0);
    setNotes(active.notes??'');
    setDecision('verify');setReviewNote('');
  },[active?.id,active?.review_status]);

  async function submit(e:FormEvent) {
    e.preventDefault();if(!active)return;
    setBusy(true);setError('');setNotice('');
    try {
      await api(`/api/field-verifications/${active.id}/submit`,'PATCH',{
        result,findings_count:result==='confirmed'?0:findings,notes:notes.trim(),
      });
      await refresh();setNotice('Hasil kunjungan dikirim dan menunggu review coordinator.');
    }catch(e){setError(e instanceof Error?e.message:'Gagal mengirim hasil.');}
    finally{setBusy(false);}
  }

  async function review(e:FormEvent) {
    e.preventDefault();if(!active)return;
    setBusy(true);setError('');setNotice('');
    try {
      await api(`/api/field-verifications/${active.id}/review`,'PATCH',{
        decision,review_note:reviewNote.trim()||null,
      });
      await refresh();setNotice(decision==='verify'?'Hasil diverifikasi; temuan proyek diperbarui.':'Laporan dikembalikan kepada engineer.');
    }catch(e){setError(e instanceof Error?e.message:'Gagal memproses review.');}
    finally{setBusy(false);}
  }

  return <main className="ftu-content ftu-team-workspace">
    <div className="ftu-heading"><div><h1>Verifikasi Lapangan</h1><p>{canManage?'Tinjau kunjungan, temuan dan hasil engineer.':'Isi hasil kunjungan lapangan lalu kirim untuk diperiksa.'}</p></div><span>{items.length} verifikasi</span></div>
    <form className="ftu-panel ftu-team-filters ftu-team-filter-panel" onSubmit={e=>{e.preventDefault();setLoading(true);setError('');void refresh().catch(err=>setError(String(err))).finally(()=>setLoading(false));}}>
      <label>Proyek<select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="">Semua proyek</option>{projects.map(p=><option key={p.id} value={p.id}>{p.code}</option>)}</select></label>
      <label>Status review<select value={reviewFilter} onChange={e=>setReviewFilter(e.target.value)}><option value="">Semua status</option>{(Object.keys(reviewStatusLabel) as ReviewStatus[]).map(s=><option key={s} value={s}>{reviewStatusLabel[s]}</option>)}</select></label>
      <button className="ftu-team-filter-button" type="submit">Terapkan</button>
      <button className="ftu-secondary" type="button" onClick={()=>{setProjectFilter('');setReviewFilter('');void refresh('','').catch(e=>setError(String(e)));}}>Reset</button>
    </form>
    <div className="ftu-verification-grid">
      <aside className="ftu-panel ftu-verification-list">
        <h2>Daftar kunjungan</h2>
        {loading&&<p>Memuat data…</p>}
        {items.map(v=><button type="button" key={v.id} className={`ftu-visit-item ${selected===v.id?'selected':''}`} onClick={()=>{setSelected(v.id);setError('');setNotice('');}}>
          <strong>{v.project_code} · {v.visit_date}</strong>
          <span>{v.site_name}</span><small>{v.assignee_name} · {reviewStatusLabel[v.review_status]}</small>
        </button>)}
        {!loading&&items.length===0&&<p>Belum ada verifikasi untuk filter ini.</p>}
      </aside>
      <section className="ftu-panel ftu-visit-detail">
        {!active?<p>Pilih kunjungan untuk melihat detailnya.</p>:<>
          <div className="ftu-detail-title"><div><span className="ftu-eyebrow">{active.project_code} · {active.visit_date}</span><h2>{active.site_name}</h2><p>{active.task_title} · {active.assignee_name}</p></div><span className="ftu-mini-pill">{reviewStatusLabel[active.review_status]}</span></div>
          {active.review_note&&<p className="ftu-review-note"><strong>Catatan pemeriksa:</strong> {active.review_note}</p>}
          {active.review_status==='verified'&&<p className="ftu-success">Diverifikasi oleh {active.verified_by_name??'Koordinator'} pada {active.verified_at?.slice(0,10)}.</p>}
          {active.review_status!=='pending'&&<div className="ftu-visit-report">
            <h3>Laporan terakhir</h3><p><strong>Hasil:</strong> {active.result==='findings'?'Ditemukan temuan':'Sesuai / terkonfirmasi'} · <strong>Jumlah temuan:</strong> {active.findings_count}</p>
            <p>{active.notes}</p>
          </div>}
          {!canManage&&['pending','revision_needed'].includes(active.review_status)&&<form className="ftu-stack ftu-visit-form" onSubmit={submit}>
            <h3>Hasil kunjungan</h3>
            <div className="ftu-team-fields">
              <label>Hasil verifikasi<select value={result} onChange={e=>{const r=e.target.value as typeof result;setResult(r);if(r==='confirmed')setFindings(0);}}>
                <option value="confirmed">Terkonfirmasi tanpa temuan</option><option value="findings">Ada temuan</option>
              </select></label>
              {result==='findings'&&<label>Jumlah temuan<input required type="number" min={1} max={1000000} value={findings} onChange={e=>setFindings(Number(e.target.value))}/></label>}
              <label className="ftu-team-span">Catatan lapangan<textarea required minLength={3} maxLength={15000} rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ringkasan hasil pemeriksaan dan tindak lanjut"/></label>
            </div>
            <p className="ftu-helper">Lampiran dokumen akan tersedia pada M3. Setelah dikirim, hasil hanya dapat diperbaiki jika dikembalikan pemeriksa.</p>
            <button type="submit" disabled={busy}>{busy?'Mengirim…':'Kirim untuk review'}</button>
          </form>}
          {canManage&&active.review_status==='submitted'&&<form className="ftu-stack ftu-visit-form" onSubmit={review}>
            <h3>Review coordinator / director</h3>
            <label>Keputusan<select value={decision} onChange={e=>setDecision(e.target.value as typeof decision)}><option value="verify">Verifikasi hasil</option><option value="revision_needed">Kembalikan untuk perbaikan</option></select></label>
            <label>Catatan pemeriksa<textarea required={decision==='revision_needed'} rows={3} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Catatan wajib jika dikembalikan"/></label>
            {decision==='verify'&&active.findings_count>0&&<p className="ftu-helper">Persetujuan ini akan menambahkan {active.findings_count} temuan terbuka pada proyek dan menaikkan versinya.</p>}
            <button type="submit" disabled={busy}>{busy?'Memproses…':decision==='verify'?'Setujui hasil':'Kirim kembali'}</button>
          </form>}
          {!canManage&&active.review_status==='submitted'&&<p className="ftu-helper">Laporan menunggu pemeriksaan coordinator atau director.</p>}
        </>}
      </section>
    </div>
    {error&&<p role="alert" className="ftu-error">{error}</p>}
    {notice&&<p role="status" className="ftu-success">{notice}</p>}
  </main>;
}
