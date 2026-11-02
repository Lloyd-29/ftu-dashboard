import { useEffect, useState, type FormEvent } from 'react';
import App from '../App';
import { api, csrf, type User } from './api';
import ProjectWorkspace from './ProjectWorkspace';
import TaskWorkspace from './TaskWorkspace';
import FieldVerificationWorkspace from './FieldVerificationWorkspace';
import DocumentWorkspace from './DocumentWorkspace';
import HistoryWorkspace from './HistoryWorkspace';
import AccountWorkspace from './AccountWorkspace';
import './engineering.css';
import './team-workspace.css';
import './ftu-hybrid-tokens.css';
import './hybrid-workbench.css';

type Path = 'dashboard'|'proyek'|'tugas'|'verifikasi'|'dokumen'|'riwayat'|'akun';
function currentPath():Path {
  const path=window.location.pathname.replace(/^\//,'');
  return ['dashboard','proyek','tugas','verifikasi','dokumen','riwayat','akun'].includes(path) ? path as Path : 'proyek';
}
const labels:Record<Path,string>={dashboard:'Dashboard',proyek:'Proyek',tugas:'Tugas',verifikasi:'Verifikasi',dokumen:'Dokumen',riwayat:'Riwayat',akun:'Akun'};
function NavIcon({item}:{item:Path}) {
  const paths:Record<Path,string>={
    dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    proyek:'M3 7h6l2 2h10v11H3z M3 7V4h7l2 3',
    tugas:'M9 6h12 M9 12h12 M9 18h12 M3 6l1 1 2-2 M3 12l1 1 2-2 M3 18l1 1 2-2',
    verifikasi:'M9 4h6l1 2h4v15H4V6h4z M9 3h6v4H9z M8 14l3 3 5-6',
    dokumen:'M6 3h9l5 5v13H6z M15 3v6h5 M9 13h8 M9 17h8',
    riwayat:'M3 12a9 9 0 1 0 2-6 M3 4v5h5 M12 7v5l4 3',
    akun:'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M21 20v-2a4 4 0 0 0-3-3.87 M16 2.13a4 4 0 0 1 0 7.75',
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[item]}/></svg>;
}
const groups:{title:string;items:Path[]}[] = [
  {title:'MONITORING',items:['dashboard','proyek']},
  {title:'OPERASIONAL',items:['tugas','verifikasi','dokumen']},
  {title:'ADMINISTRASI',items:['riwayat','akun']},
];


export default function EngineeringRoot() {
  const [user,setUser]=useState<User|null>(null);
  const [pending,setPending]=useState(true);
  const [failure,setFailure]=useState('');
  const [path,setPath]=useState<Path>(currentPath);
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [oldPassword,setOldPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [sending,setSending]=useState(false);
  const [pendingDocs,setPendingDocs]=useState(0);
  const [collapsed,setCollapsed]=useState(()=>{try{return window.localStorage.getItem('ftu-sidebar-collapsed')==='1';}catch{return false;}});
  const [mobileNav,setMobileNav]=useState(false);

  useEffect(()=>{
    let live=true;
    api<{user:User}>('/api/auth/me').then(r=>{if(live)setUser(r.user);})
      .catch(()=>{if(live)setUser(null);}).finally(()=>{if(live)setPending(false);});
    const onPop=()=>setPath(currentPath());
    window.addEventListener('popstate',onPop);
    return ()=>{live=false;window.removeEventListener('popstate',onPop);};
  },[]);

  useEffect(()=>{
    if(!user || !['admin','coordinator','director'].includes(user.role) || user.must_change_password)return;
    let live=true;
    const refresh=()=>{void api<{pending_review_count:number}>('/api/documents').then(r=>{
      if(live)setPendingDocs(r.pending_review_count);
    }).catch(()=>{ /* Keep last badge until next refresh. */ });};
    refresh();
    const timer=window.setInterval(refresh,60000);
    return ()=>{live=false;window.clearInterval(timer);};
  },[user?.id,user?.role,user?.must_change_password]);

  function toggleSidebar() {
    const next=!collapsed;
    setCollapsed(next);
    try{window.localStorage.setItem('ftu-sidebar-collapsed',next?'1':'0');}
    catch{/* Browser may disable storage. */}
  }

  function navigate(next:Path) {
    if(path===next)return;
    window.history.pushState({},'',`/${next}`);setPath(next);setFailure('');setMobileNav(false);
  }

  async function login(e:FormEvent) {
    e.preventDefault();setFailure('');setSending(true);
    try {await csrf();const response=await api<{user:User}>('/api/auth/login','POST',{username,password});setUser(response.user);setPassword('');}
    catch(error){setFailure(error instanceof Error?error.message:'Gagal masuk.');}
    finally{setSending(false);}
  }

  async function changePassword(e:FormEvent) {
    e.preventDefault();setFailure('');setSending(true);
    try {const response=await api<{user:User}>('/api/auth/password','POST',{current_password:oldPassword,password:newPassword,password_confirmation:confirmation});setUser(response.user);setOldPassword('');setNewPassword('');setConfirmation('');}
    catch(error){setFailure(error instanceof Error?error.message:'Gagal menyimpan kata sandi.');}
    finally{setSending(false);}
  }

  async function logout() {
    try {await api('/api/auth/logout','POST',{});} catch {/* Still clear local view */}
    setUser(null);setPath('dashboard');window.history.replaceState({},'','/login');
  }

  if(pending)return <div className="engineering-root"><div className="ftu-auth-card">Memeriksa sesi…</div></div>;
  if(!user||user.must_change_password)return <div className="engineering-root ftu-auth-screen">
    <div className="ftu-auth-card">
      <div className="ftu-brand ftu-brand--full"><img src="/ftu-hybrid-logo.png" alt="PT Filosofi Teknik Utama"/></div>
      <h1>{user?'Ganti kata sandi sementara':'Masuk ke Engineering System'}</h1>
      <p>{user?'Gunakan kata sandi baru minimal 10 karakter.':'Gunakan username dan kata sandi yang diberikan administrator.'}</p>
      <form onSubmit={user?changePassword:login} className="ftu-stack">
        {user? <>
          <label>Kata sandi sementara<input autoComplete="current-password" required type="password" value={oldPassword} onChange={e=>setOldPassword(e.target.value)}/></label>
          <label>Kata sandi baru<input autoComplete="new-password" minLength={10} required type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
          <label>Ulangi kata sandi baru<input autoComplete="new-password" minLength={10} required type="password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
        </>:<>
          <label>Username<input autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)} /></label>
          <label>Kata sandi<input autoComplete="current-password" required type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        </>}
        {failure && <p role="alert" className="ftu-error">{failure}</p>}
        <button disabled={sending} type="submit">{sending?'Memproses…':user?'Simpan kata sandi':'Masuk'}</button>
        {user&&<button className="ftu-subtle" type="button" onClick={logout}>Keluar</button>}
      </form>
    </div>
  </div>;
  if(user.role==='viewer')return <App/>;
  const canEdit=['admin','coordinator','director'].includes(user.role);
  const nav:Path[]=canEdit?['dashboard','proyek','tugas','verifikasi','dokumen','riwayat',...(['admin','coordinator'].includes(user.role)?['akun' as Path]:[])]:['proyek','tugas','verifikasi','dokumen'];
  const visible=nav.includes(path)?path:'proyek';
  // Keep the original fullscreen slideshow untouched, even for management accounts.
  if(visible==='dashboard')return <div className="ftu-fullscreen-dashboard">
    <App/>
    <button type="button" className="ftu-return-workspace" onClick={()=>navigate('proyek')}>
      Kembali ke sistem
    </button>
  </div>;
  return <div className={`engineering-root ftu-workbench ftu-hybrid ${collapsed?'ftu-is-collapsed':''} ${mobileNav?'ftu-mobile-open':''}`}>
    <header className="ftu-topbar">
      <div className="ftu-brand ftu-brand--full"><img src="/ftu-hybrid-logo.png" alt="PT Filosofi Teknik Utama"/></div>
      <div className="ftu-topbar-context"><strong>Engineering System</strong><span>Operasional Internal</span></div>
      <div className="ftu-account"><span>{user.name} · {user.role}</span><button type="button" className="ftu-header-logout" onClick={logout}>Keluar</button></div>
      <button type="button" className="ftu-mobile-toggle" onClick={()=>setMobileNav(v=>!v)} aria-label="Buka atau tutup menu" aria-expanded={mobileNav}>Menu</button>
    </header>
    <div className="ftu-app-body">
      <aside className="ftu-side-shell" aria-label="Navigasi aplikasi">
        <div className="ftu-side-head">
          {!collapsed&&<span>AREA KERJA</span>}
          <button type="button" onClick={toggleSidebar} aria-label={collapsed?'Perluas sidebar':'Perkecil sidebar'} title={collapsed?'Perluas sidebar':'Perkecil sidebar'}>{collapsed?'»':'«'}</button>
        </div>
        {groups.map(group=>{
          const items=group.items.filter(item=>nav.includes(item));
          return items.length>0?<div className="ftu-side-group" key={group.title}>
            {!collapsed&&<p className="ftu-side-group-label">{group.title}</p>}
            {items.map(item=><button key={item} type="button" className={`ftu-side-link ${visible===item?'active':''}`} aria-current={visible===item?'page':undefined} onClick={()=>navigate(item)} title={collapsed?labels[item]:undefined}>
              <span className="ftu-side-glyph" aria-hidden="true"><NavIcon item={item}/></span>
              {!collapsed&&<span className="ftu-side-label">{labels[item]}</span>}
              {!collapsed&&item==='dokumen'&&pendingDocs>0&&<span className="ftu-side-count">{pendingDocs}</span>}
            </button>)}
          </div>:null;
        })}
        <div className="ftu-side-foot">{!collapsed?'FTU · Ruang Engineering':'FTU'}</div>
      </aside>
      <div className="ftu-main-stage">
        <div className="ftu-page-context">Engineering <span>/</span> {labels[visible]}</div>
        {visible==='proyek'? <ProjectWorkspace canEdit={canEdit}/>: visible==='tugas'? <TaskWorkspace canManage={canEdit}/>: visible==='verifikasi'? <FieldVerificationWorkspace canManage={canEdit}/>: visible==='riwayat'? <HistoryWorkspace canManageAccounts={user.role==='admin'||user.role==='coordinator'}/> : visible==='akun'? <AccountWorkspace currentUserId={user.id}/> :
          <DocumentWorkspace canManage={canEdit} canDelete={user.role==='coordinator'||user.role==='admin'} onPendingChange={setPendingDocs}/>}
      </div>
    </div>
  </div>;
}
