import { useEffect, useState } from 'react';
import { api } from './api';
import './finishing-workspace.css';

type ManagedUser={
  id:number;name:string;username:string;role:string;is_active:boolean;
  must_change_password:boolean;engineer_name:string|null;
};
const roles:Record<string,string>={admin:'Admin',coordinator:'Koordinator',director:'Direktur',engineer:'Engineer',viewer:'TV viewer'};

export default function AccountWorkspace({currentUserId}:{currentUserId:number}) {
  const [users,setUsers]=useState<ManagedUser[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<number|null>(null);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [revealed,setRevealed]=useState<{username:string;password:string}|null>(null);
  const [search,setSearch]=useState('');

  async function load() {
    const response=await api<{users:ManagedUser[]}>('/api/users');setUsers(response.users);
  }
  useEffect(()=>{
    let live=true;
    api<{users:ManagedUser[]}>('/api/users').then(response=>{if(live)setUsers(response.users);})
      .catch(err=>{if(live)setError((err as Error).message);})
      .finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false};
  },[]);

  async function reset(user:ManagedUser) {
    if (!window.confirm(`Reset kata sandi ${user.username}? Sesi pengguna akan diakhiri.`)) return;
    setBusy(user.id);setError('');setSuccess('');setRevealed(null);
    try {
      const result=await api<{temporary_password:string}>(`/api/auth/users/${user.id}/reset-password`,'POST',{});
      setRevealed({username:user.username,password:result.temporary_password});
      await load();
    } catch (err) {setError(err instanceof Error?err.message:'Gagal mereset password.');}
    finally {setBusy(null);}
  }
  async function deactivate(user:ManagedUser) {
    if (!window.confirm(`Nonaktifkan ${user.username}? Pengguna tidak akan dapat login kembali.`)) return;
    setBusy(user.id);setError('');setSuccess('');setRevealed(null);
    try {
      await api(`/api/users/${user.id}/deactivate`,'PATCH',{});
      await load();setSuccess(`Akun ${user.username} sudah dinonaktifkan.`);
    } catch (err) {setError(err instanceof Error?err.message:'Gagal menonaktifkan akun.');}
    finally {setBusy(null);}
  }

  const shown=users.filter(u=>`${u.name} ${u.username} ${u.role} ${u.engineer_name??''}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="ftu-content ftu-finishing">
    <div className="ftu-heading"><div><h1>Manajemen akun</h1><p>Lihat pengguna, reset kata sandi, dan nonaktifkan akun. Akun baru dibuat lewat CLI.</p></div><span>{users.length} akun</span></div>
    <section className="ftu-panel">
      <div className="ftu-filters"><label>Cari akun<input value={search} onChange={(e:{target:{value:string}})=>setSearch(e.target.value)} placeholder="Nama, username, peran"/></label>
        <button className="ftu-outline-button" type="button" onClick={()=>{setRevealed(null);setLoading(true);void load().catch(err=>setError((err as Error).message)).finally(()=>setLoading(false));}}>Muat ulang</button></div>
      {revealed&&<div className="ftu-password-reveal" role="status"><strong>Kata sandi sementara untuk {revealed.username}</strong>
        <p>Salin sekarang, tampil sekali saja. Jangan simpan di Git atau chat.</p><code>{revealed.password}</code>
        <button type="button" className="ftu-outline-button" onClick={()=>setRevealed(null)}>Tutup dan hapus dari layar</button></div>}
      {error&&<p role="alert" className="ftu-error">{error}</p>}
      {success&&<p role="status" className="ftu-success">{success}</p>}
      {loading?<p>Memuat akun…</p>:<div className="ftu-table-scroll"><table className="ftu-data-table">
        <thead><tr><th>Pengguna</th><th>Peran</th><th>Engineer</th><th>Status</th><th>Tindakan</th></tr></thead>
        <tbody>{shown.map(u=><tr key={u.id}>
          <td><strong>{u.name}</strong><small>@{u.username}</small></td>
          <td>{roles[u.role]??u.role}</td>
          <td>{u.engineer_name??'—'}</td>
          <td><span className={`ftu-account-status ${u.is_active?'active':'inactive'}`}>{u.is_active?(u.must_change_password?'Wajib ganti password':'Aktif'):'Nonaktif'}</span></td>
          <td className="ftu-action-cell">{u.id===currentUserId?'Akun sendiri':u.is_active?<>
            <button type="button" disabled={busy!==null} onClick={()=>void reset(u)}>Reset password</button>
            <button type="button" className="danger" disabled={busy!==null} onClick={()=>void deactivate(u)}>Nonaktifkan</button>
          </>:'Tidak ada tindakan'}</td>
        </tr>)}</tbody>
      </table></div>}
      {!loading&&shown.length===0&&<p className="ftu-empty">Tidak ada akun yang cocok.</p>}
    </section>
  </main>;
}
