export type ProjectStatus = 'on_track' | 'at_risk' | 'delayed';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export interface DashboardProject {
  code:string; name:string; client:string; status:ProjectStatus;
  progress_percent:number|null; planned_progress_percent:number|null;
  sop_phase:string|null; next_milestone_name:string|null; next_milestone_date:string|null;
  risks:string|null; findings_open:number; findings_closed:number;
  updated_at:string|null; updated_by_name:string|null; is_stale:boolean;
}
export interface DashboardAlert { id:number; title:string; severity:AlertSeverity; project_code:string|null; due_date:string|null; is_overdue:boolean; }
export interface DashboardMilestone {id:number;project_code:string|null;project_name:string|null;name:string;due_date:string;is_overdue:boolean;}
export interface DashboardClientNote {id:number;project_code:string|null;project_name:string|null;note_date:string;body:string;created_by_name:string|null;}
export interface DashboardData {
  generated_at:string; last_updated_at:string|null;
  settings:{slide_rotation_seconds:number;stale_after_days:number};
  summary:{total_projects:number;on_track:number;at_risk:number;delayed:number;without_progress:number;
    findings_open:number;findings_closed:number;active_alerts:number;
    documents_pending_review?:number;scheduled_field_verifications?:number;overdue_tasks?:number};
  projects:DashboardProject[];
  alerts:DashboardAlert[];
  upcoming_milestones:DashboardMilestone[];
  overdue_milestones:DashboardMilestone[];
  s_curve:{project_code:string;project_name:string;points:{week_date:string;planned:number|null;actual:number|null}[]}[];
  engineer_workload:{name:string;total_allocation_percent:number;is_overallocated:boolean;
    assignments:{project_code:string;project_name:string;allocation_percent:number}[]}[];
  latest_client_notes:DashboardClientNote[];
}
