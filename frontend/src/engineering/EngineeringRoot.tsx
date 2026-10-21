import { useEffect, useState, type FormEvent } from 'react';
import App from '../App';
import { api, csrf, type User } from './api';
import ProjectWorkspace from './ProjectWorkspace';
import './engineering.css';

type Path = 'dashboard'|'proyek'|'tugas'|'verifikasi'|'dokumen';
function currentPath():Path {
  const path=window.location.pathname.replace(/^\//,'');
  return ['dashboard','proyek','tugas','verifikasi','dokumen'].includes(path) ? path as Path : 'dashboard';
}
const labels:Record<Path,string>={dashboard:'Dashboard',proyek:'Proyek',tugas:'Tugas',verifikasi:'Verifikasi',dokumen:'Dokumen'};

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

  useEffect(()=>{
    let live=true;
    api<{user:User}>('/api/auth/me').then(r=>{if(live)setUser(r.user);})
      .catch(()=>{if(live)setUser(null);}).finally(()=>{if(live)setPending(false);});
    const onPop=()=>setPath(currentPath());
    window.addEventListener('popstate',onPop);
    return ()=>{live=false;window.removeEventListener('popstate',onPop);};
  },[]);

  function navigate(next:Path) {
    if(path===next)return;
    window.history.pushState({},'',`/${next}`);setPath(next);setFailure('');
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
      <div className="ftu-brand"><img src="/ftu-logo1.png" alt="Logo FTU"/><span>PT Filosofi Teknik Utama</span></div>
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
  const nav:Path[]=canEdit?['dashboard','proyek','tugas','verifikasi','dokumen']:['proyek','tugas','verifikasi','dokumen'];
  const visible=nav.includes(path)?path:'proyek';
  return <div className="engineering-root ftu-workbench">
    <header className="ftu-topbar">
      <div className="ftu-brand"><img src="/ftu-logo1.png" alt="Logo FTU"/><span>PT Filosofi Teknik Utama</span></div>
      <div className="ftu-account"><span>{user.name} · {user.role}</span><button type="button" className="ftu-subtle" onClick={logout}>Keluar</button></div>
    </header>
    <nav className="ftu-nav" aria-label="Menu utama">{nav.map(item=><button key={item} type="button" onClick={()=>navigate(item)} className={visible===item?'active':''}>{labels[item]}</button>)}</nav>
    {visible==='dashboard'? <App/> : visible==='proyek'? <ProjectWorkspace canEdit={canEdit}/>:
      <main className="ftu-content"><section className="ftu-panel"><h1>{labels[visible]}</h1><p>Modul ini tersedia pada milestone berikutnya. Data proyek dan dashboard tetap bisa digunakan.</p></section></main>}
  </div>;
}
