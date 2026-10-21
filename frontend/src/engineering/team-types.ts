export type TaskStatus = 'todo' | 'doing' | 'done';
export type ReviewStatus = 'pending' | 'submitted' | 'revision_needed' | 'verified';
export type Task = {
  id: number; project_id: number; project_code: string; project_name: string;
  assignee_engineer_id: number; assignee_name: string;
  title: string; description: string | null; type: 'job' | 'field_verification';
  due_date: string; status: TaskStatus; verification_id: number | null;
  review_status: ReviewStatus | null; created_at: string;
};
export type FieldVerification = {
  id: number; task_id: number; task_title: string; task_status: TaskStatus;
  project_id: number; project_code: string; project_name: string;
  assignee_engineer_id: number; assignee_name: string;
  site_name: string; visit_date: string; result: 'pending' | 'confirmed' | 'findings';
  findings_count: number; notes: string | null; review_status: ReviewStatus;
  review_note: string | null; submitted_at: string | null;
  verified_by_name: string | null; verified_at: string | null;
};
export type FieldCandidate = {
  engineer_id: number; name: string; total_allocation_percent: number;
  remaining_capacity_percent: number; is_assigned_to_project: boolean; is_available: boolean;
};
export const taskStatusLabel: Record<TaskStatus,string> = {
  todo: 'Belum mulai', doing: 'Dikerjakan', done: 'Selesai',
};
export const reviewStatusLabel: Record<ReviewStatus,string> = {
  pending: 'Belum dikirim', submitted: 'Menunggu review',
  revision_needed: 'Perlu perbaikan', verified: 'Diverifikasi',
};
export function todayWIB(): string {
  return new Date().toLocaleDateString('sv-SE', {timeZone:'Asia/Jakarta'});
}
