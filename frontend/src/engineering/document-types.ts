export type DocumentStatus = 'submitted'|'revision_needed'|'checked';
export type Revision = {
  id:number; revision_label:string; issue_purpose:'review'|'approval'; description:string; issued_date:string;
  original_file_name:string; file_size:number; status:DocumentStatus;
  review_note:string|null; uploaded_by_name:string|null; prepared_initials:string|null;
  reviewed_by_name:string|null; checked_initials:string|null; reviewed_at:string|null; download_url:string;
};
export type FTUDocument = {
  id:number; project_id:number; project_code:string; project_name:string;
  task_id:number|null; doc_no:string; title:string; doc_type:string;
  client_name:string; revisions:Revision[]; updated_at:string|null;
};
export type DocumentList = {documents:FTUDocument[]; types:string[]; pending_review_count:number};
