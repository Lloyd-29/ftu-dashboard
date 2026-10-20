import type { ProjectStatus } from '../types/dashboard';

const LABELS: Record<ProjectStatus, string> = {
  on_track: 'Sesuai jadwal',
  at_risk: 'Berisiko',
  delayed: 'Terlambat',
};

export default function StatusPill({ status, isStale = false }: { status: ProjectStatus; isStale?: boolean }) {
  return (
    <span className="ftu-pill-group">
      <span className={`ftu-pill ftu-pill--${status}`}>{LABELS[status]}</span>
      {isStale && <span className="ftu-pill ftu-pill--stale">Data lama</span>}
    </span>
  );
}
