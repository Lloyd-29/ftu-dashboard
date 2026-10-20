import type { DashboardData, DashboardProject } from '../types/dashboard';
import SCurveChart from './SCurveChart';
import ProgressBar from './ProgressBar';
import StatusPill from './StatusPill';
import { formatShortDate } from '../utils/date';
import './ScheduleSlide.css';

type Props = { data: DashboardData };
type Curve = DashboardData['s_curve'][number];
type Milestone = DashboardData['upcoming_milestones'][number];

const PRIORITY: Record<DashboardProject['status'], number> = {
  delayed: 0,
  at_risk: 1,
  on_track: 2,
};

function progressGap(project: DashboardProject): number {
  if (project.progress_percent === null || project.planned_progress_percent === null) {
    return Number.NEGATIVE_INFINITY;
  }
  return project.planned_progress_percent - project.progress_percent;
}

function MilestoneRow({
  item, overdue, project,
}: {
  item: Milestone;
  overdue: boolean;
  project: DashboardProject | undefined;
}) {
  return (
    <div className={`ps-milestone ps-appear${overdue ? ' ps-milestone--overdue' : ''}`}>
      <span className="ps-milestone__date">{formatShortDate(item.due_date)}</span>
      <div className="ps-milestone__content">
        <strong title={item.name}>{item.name}</strong>
        <span>
          <code>{item.project_code ?? '—'}</code>
          {overdue && <b className="ps-milestone__overdue-tag">Lewat tenggat</b>}
        </span>
      </div>
      <span className={`ps-milestone__dot ps-milestone__dot--${project?.status ?? 'unknown'}`} aria-label={project?.status ?? 'Status tidak tersedia'} />
    </div>
  );
}

export default function ScheduleSlide({ data }: Props) {
  const projectByCode = new Map(data.projects.map((project) => [project.code, project]));
  const curveByCode = new Map(data.s_curve.map((curve) => [curve.project_code, curve]));

  const prioritized = [...data.projects].sort((a, b) =>
    PRIORITY[a.status] - PRIORITY[b.status] || a.code.localeCompare(b.code)
  );

  // DEMO-ONLY: Keep the four highest-priority projects on one non-scrolling stage.
  const comparisonProjects = prioritized.slice(0, 4);

  const featuredProject = [...prioritized]
    .filter((project) => (curveByCode.get(project.code)?.points.length ?? 0) > 0)
    .sort((a, b) =>
      PRIORITY[a.status] - PRIORITY[b.status] ||
      progressGap(b) - progressGap(a) ||
      a.code.localeCompare(b.code)
    )[0];

  const featuredCurve: Curve | undefined = featuredProject
    ? curveByCode.get(featuredProject.code)
    : undefined;
  const weeks = featuredCurve?.points.length ?? 0;

  const milestones = [
    ...data.overdue_milestones.map((item) => ({ item, overdue: true })),
    ...data.upcoming_milestones.map((item) => ({ item, overdue: false })),
  ];

  return (
    <section className="ps-layout" aria-label="Progres aktual dan jadwal proyek">
      <div className="ps-top">
        <article className="ftu-card ps-curve-card">
          {featuredProject && featuredCurve ? (
            <>
              <div className="ps-card-heading">
                <h2>Kurva-S: <code>{featuredProject.code}</code> {featuredProject.name}</h2>
                <p>Progres aktual vs rencana, {weeks} minggu terakhir</p>
              </div>
              <div className="ps-curve-chart">
                <SCurveChart points={featuredCurve.points} />
              </div>
              <p className="ps-curve-footnote">Data simulasi · Titik paling kanan adalah minggu laporan terakhir.</p>
            </>
          ) : (
            <div className="ps-empty">Belum tersedia riwayat progres proyek.</div>
          )}
        </article>

        <article className="ftu-card ps-schedule-card">
          <div className="ps-card-heading">
            <h2>Jadwal 14 Hari ke Depan</h2>
            <p>{data.upcoming_milestones.length} jadwal mendatang · WIB</p>
          </div>
          <div className="ps-milestone-list" aria-label="Milestone terlambat dan 14 hari mendatang">
            {milestones.length === 0 ? (
              <p className="ps-empty">Belum ada milestone pada periode ini.</p>
            ) : milestones.map(({ item, overdue }) => (
              <MilestoneRow
                key={item.id}
                item={item}
                overdue={overdue}
                project={projectByCode.get(item.project_code ?? '')}
              />
            ))}
          </div>
        </article>
      </div>

      <article className="ftu-card ps-comparison">
        <div className="ps-card-heading">
          <h2>Progres vs Rencana per Proyek</h2>
          <p>Perbandingan progres aktual terhadap target rencana</p>
        </div>
        <div className="ps-comparison__rows">
          {comparisonProjects.map((project, index) => (
            <div className="ps-comparison__row ps-appear" key={project.code} style={{ animationDelay: `${index * 40}ms` }}>
              <code>{project.code}</code>
              <strong className="ps-comparison__name" title={project.name}>{project.name}</strong>
              <div className="ps-comparison__bar">
                <span>Rencana {project.planned_progress_percent === null ? '—' : `${project.planned_progress_percent}%`}</span>
                <ProgressBar actual={project.progress_percent} planned={project.planned_progress_percent} showLabel={false} />
              </div>
              <div className="ps-comparison__numbers">
                <strong>{project.progress_percent === null ? 'Belum diisi' : `${project.progress_percent}%`}</strong>
                <span>Rencana {project.planned_progress_percent === null ? '—' : `${project.planned_progress_percent}%`}</span>
              </div>
              <div className="ps-comparison__status"><StatusPill status={project.status} isStale={project.is_stale} /></div>
            </div>
          ))}
          {comparisonProjects.length === 0 && <p className="ps-empty">Belum ada proyek aktif.</p>}
        </div>
      </article>
    </section>
  );
}
