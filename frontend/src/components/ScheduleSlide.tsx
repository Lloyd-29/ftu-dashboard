import type { DashboardData } from '../types/dashboard';
import './ScheduleSlide.css';

type Props = { data: DashboardData };
type Curve = DashboardData['s_curve'][number];
type Point = Curve['points'][number];
type Project = DashboardData['projects'][number];

const FEATURED_CODES = [
  'ENG-2412',
  'INS-2409',
  'PRJ-2417',
  'INS-2607',
] as const;

const STATUS_LABELS: Record<Project['status'], string> = {
  on_track: 'Sesuai Rencana',
  at_risk: 'Berisiko',
  delayed: 'Terlambat',
};

function shortDate(date: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function curvePath(points: Point[], field: 'planned' | 'actual'): string {
  if (points.length === 0) return '';

  let connected = false;
  const segments: string[] = [];

  points.forEach((point, index) => {
    const value = point[field];
    if (value === null) {
      connected = false;
      return;
    }

    const x = 34 + (index / Math.max(1, points.length - 1)) * 366;
    const y = 102 - (Math.min(100, Math.max(0, value)) / 100) * 82;
    segments.push(`${connected ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
    connected = true;
  });

  return segments.join(' ');
}

function CurveCard({ curve, project, index }: {
  curve: Curve;
  project: Project | undefined;
  index: number;
}) {
  const points = [...curve.points].sort((a, b) =>
    a.week_date.localeCompare(b.week_date),
  );
  const latest = points.length ? points[points.length - 1] : undefined;
  const hasActual = points.some((point) => point.actual !== null);
  const status = project?.status ?? 'on_track';

  return (
    <article
      className={`schedule-curve schedule-curve--${status}`}
      style={{ animationDelay: `${index * 65}ms` }}
    >
      <div className="schedule-curve__head">
        <div className="schedule-curve__names">
          <strong title={curve.project_name}>{curve.project_name}</strong>
          <span>{curve.project_code}</span>
        </div>
        <span className={`schedule-status schedule-status--${status}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="schedule-curve__meta">
        <span>Rencana <b>{latest?.planned ?? '—'}{latest?.planned == null ? '' : '%'}</b></span>
        <span>
          Aktual <b>{latest?.actual == null ? 'Belum ada' : `${latest.actual}%`}</b>
        </span>
      </div>

      <svg
        className="schedule-curve__svg"
        viewBox="0 0 420 122"
        role="img"
        aria-label={`S-Curve ${curve.project_name}: rencana ${latest?.planned ?? 'belum ada'} persen, aktual ${latest?.actual ?? 'belum dilaporkan'}${latest?.actual === null ? '' : ' persen'}`}
        preserveAspectRatio="none"
      >
        {[20, 61, 102].map((y) => (
          <line key={y} x1="34" x2="400" y1={y} y2={y} className="schedule-curve__gridline" />
        ))}
        <text x="2" y="24" className="schedule-curve__axis">100%</text>
        <text x="9" y="65" className="schedule-curve__axis">50%</text>
        <text x="16" y="105" className="schedule-curve__axis">0</text>
        <path d={curvePath(points, 'planned')} className="schedule-curve__planned" />
        {hasActual && (
          <path d={curvePath(points, 'actual')} className="schedule-curve__actual" />
        )}
        {points.length > 0 && (
          <>
            <text x="34" y="118" className="schedule-curve__axis schedule-curve__axis--date">
              {shortDate(points[0].week_date)}
            </text>
            <text x="400" y="118" textAnchor="end" className="schedule-curve__axis schedule-curve__axis--date">
              {shortDate(points[points.length - 1].week_date)}
            </text>
          </>
        )}
      </svg>
    </article>
  );
}

export default function ScheduleSlide({ data }: Props) {
  const projectByCode = new Map(data.projects.map((project): [string, Project] => [
    project.code, project,
  ]));
  const curveByCode = new Map(data.s_curve.map((curve): [string, Curve] => [
    curve.project_code, curve,
  ]));

  // DEMO-ONLY: Four representative projects fit the laptop's non-scrolling TV slide.
  const featured = FEATURED_CODES
    .map((code) => curveByCode.get(code))
    .filter((curve): curve is Curve => curve !== undefined);

  const upcoming = data.upcoming_milestones;
  const overdue = data.overdue_milestones;
  const totalPoints = data.s_curve.reduce((total, curve) => total + curve.points.length, 0);
  const withoutActual = data.projects.filter((project) => project.progress_percent === null).length;

  return (
    <section className="schedule-layout" aria-label="Progres mingguan dan jadwal proyek">
      <div className="schedule-kpis">
        <article className="schedule-kpi">
          <span>Proyek Dipantau</span><strong>{data.s_curve.length}</strong>
        </article>
        <article className="schedule-kpi schedule-kpi--violet">
          <span>Titik Progres</span><strong>{totalPoints}</strong>
        </article>
        <article className="schedule-kpi schedule-kpi--amber">
          <span>Jadwal 14 Hari</span><strong>{upcoming.length}</strong>
        </article>
        <article className="schedule-kpi schedule-kpi--red">
          <span>Milestone Terlambat</span><strong>{overdue.length}</strong>
        </article>
      </div>

      <div className="schedule-columns">
        <div className="schedule-panel schedule-panel--charts">
          <div className="schedule-panel__header">
            <div>
              <h2>S-Curve Proyek</h2>
              <p>Empat proyek prioritas · {withoutActual} belum melaporkan aktual</p>
            </div>
            <div className="schedule-legend">
              <span><i className="schedule-legend__planned" /> Rencana</span>
              <span><i className="schedule-legend__actual" /> Aktual</span>
            </div>
          </div>
          <div className="schedule-curve-grid">
            {featured.map((curve, index) => (
              <CurveCard
                key={curve.project_code}
                curve={curve}
                project={projectByCode.get(curve.project_code)}
                index={index}
              />
            ))}
          </div>
          <p className="schedule-footnote">Data simulasi · Persentase kumulatif mingguan · Semua {data.s_curve.length} proyek ada di API.</p>
        </div>

        <div className="schedule-panel schedule-panel--milestones">
          <div className="schedule-panel__header">
            <div>
              <h2>Jadwal 14 Hari ke Depan</h2>
              <p>Termasuk hari ini · berdasarkan WIB</p>
            </div>
            <span className="schedule-count">{upcoming.length} jadwal</span>
          </div>
          {overdue.length > 0 && (
            <div className="schedule-overdue">
              <strong>Lewat tenggat · {overdue.length}</strong>
              {overdue.slice(0, 2).map((item) => (
                <div className="schedule-overdue__row" key={item.id}>
                  <span>{item.project_code} · {item.name}</span>
                  <b>{shortDate(item.due_date)}</b>
                </div>
              ))}
            </div>
          )}
          <div className="schedule-milestone-list">
            {upcoming.length === 0 ? (
              <p className="schedule-empty">Belum ada milestone 14 hari ke depan.</p>
            ) : upcoming.slice(0, 9).map((item, index) => (
              <div
                key={item.id}
                className="schedule-milestone"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="schedule-milestone__date">{shortDate(item.due_date)}</div>
                <div className="schedule-milestone__details">
                  <strong title={item.name}>{item.name}</strong>
                  <span>{item.project_code} · {item.project_name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
