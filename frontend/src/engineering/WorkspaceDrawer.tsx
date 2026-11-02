import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title:string;
  subtitle?:string;
  busy?:boolean;
  dirty?:boolean;
  onClose:()=>void;
  children:ReactNode;
}

export default function WorkspaceDrawer({title,subtitle,busy=false,dirty=false,onClose,children}:Props) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const el=dialog.current;
    if(el && !el.open)el.showModal();
    return()=>{if(el?.open)el.close();};
  },[]);
  const requestClose=()=>{
    if(busy)return;
    if(dirty && !window.confirm('Ada perubahan yang belum disimpan. Tutup form ini?'))return;
    onClose();
  };
  return <dialog ref={dialog} className="ftu-workspace-drawer" aria-label={title}
      onCancel={event=>{event.preventDefault();requestClose();}}
      onClick={event=>{if(event.target===dialog.current)requestClose();}}>
    <div className="ftu-drawer-head">
      <div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>
      <button type="button" className="ftu-drawer-close" onClick={requestClose} disabled={busy} aria-label="Tutup panel">×</button>
    </div>
    <div className="ftu-drawer-body">{children}</div>
  </dialog>;
}
