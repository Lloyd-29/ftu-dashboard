import { useEffect, useRef } from 'react';
import type { DashboardData, DashboardProject } from '../types/dashboard';
import SCurveChart from './SCurveChart';
import ProgressBar from './ProgressBar';
import StatusPill from './StatusPill';
import { formatShortDate } from '../utils/date';
import './ScheduleSlide.css';

type Props = {
  data: DashboardData;
  remainingMs: number;
  rotationMs: number;
};
type Curve = DashboardData['s_curve'][number];
type Milestone = DashboardData['upcoming_milestones'][number];

const PRIORITY: Record<DashboardProject['status'], number> = {
  delayed: 0,
  at_risk: 1,
  on_track: 2,
};

function progressGap(project: DashboardProject): number {
  if (project.progress_percent === null || project.planned_progress_percent === null) {
    return -1_000;
  }
  return project.planned_progress_percent - project.progress_percent;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** DEMO-ONLY: Slowly reveal a long list during the existing 25-second slide.
 * Scrolling with a mouse/touchpad (or touching/dragging) stops auto-scroll
 * until this slide is entered again. The actual native overflow remains enabled.
 */
function useSlideAutoScroll(remainingMs: number, rotationMs: number) {
  const ref = useRef<HTMLDivElement>(null);
  const userIsScrolling = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || userIsScrolling.current) return;
    if (new URLSearchParams(window.location.search).get('lite') === '1') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
    // Briefly show the first rows, glide down, then hold on the final rows.
    const progress = clamp01(1 - remainingMs / Math.max(1, rotationMs));
    const travel = clamp01((progress - 0.08) / 0.84);
    const eased = travel * travel * (3 - 2 * travel);
    element.scrollTop = maxScroll * eased;
  }, [remainingMs, rotationMs]);

  const stop = () => { userIsScrolling.current = true; };
  return { ref, onWheelCapture: stop, onTouchStartCapture: stop, onPointerDownCapture: stop };
}

function MilestoneRow({ item, overdue, project }: {
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
      <span
        className={`ps-milestone__dot ps-milestone__dot--${project?.status ?? 'unknown'}`}
        aria-label={project?.status ?? 'Status tidak tersedia'}
      />
    </div>
  );
}

export default function ScheduleSlide({ data, remainingMs, rotationMs }: Props) {
  const projectByCode = new Map(data.projects.map((project) => [project.code, project]));
  const curveByCode = new Map(data.s_curve.map((curve) => [curve.project_code, curve]));

  const prioritized = [...data.projects].sort((a, b) =>
    PRIORITY[a.status] - PRIORITY[b.status] ||
    progressGap(b) - progressGap(a) ||
    a.code.localeCompare(b.code)
  );

  // DEMO-ONLY: Cycle ALL available project curves once within the slide duration.
  const curves = [
    ...prioritized.map((project) => curveByCode.get(project.code))
      .filter((curve): curve is Curve => curve !== undefined),
    ...data.s_curve.filter((curve) => !projectByCode.has(curve.project_code)),
  ];
  const progress = clamp01(1 - remainingMs / Math.max(1, rotationMs));
  const curveIndex = Math.min(curves.length - 1, Math.floor(progress * curves.length));
  const featuredCurve = curves[curveIndex];
  const weeks = featuredCurve?.points.length ?? 0;
  const hasAnyActual = featuredCurve?.points.some((point) => point.actual !== null) ?? false;

  const milestoneScroll = useSlideAutoScroll(remainingMs, rotationMs);
  const comparisonScroll = useSlideAutoScroll(remainingMs, rotationMs);
  const milestones = [
    ...data.overdue_milestones.map((item) => ({ item, overdue: true })),
    ...data.upcoming_milestones.map((item) => ({ item, overdue: false })),
  ];

  return (
    <section className="ps-layout" aria-label="Progres aktual dan jadwal proyek">
      <div className="ps-top">
        <article className="ftu-card ps-curve-card">
          {featuredCurve ? (
            <>
              <div className="ps-curve-heading">
                <div className="ps-card-heading">
                  <h2 title={`${featuredCurve.project_code} ${featuredCurve.project_name}`}>
                    Kurva-S: <code>{featuredCurve.project_code}</code> {featuredCurve.project_name}
                  </h2>
                  <p>Progres aktual vs rencana, {weeks} minggu terakhir</p>
                </div>
                <span className="ps-curve-count" aria-label={`Grafik ${curveIndex + 1} dari ${curves.length}`}>
                  {curveIndex + 1}/{curves.length}
                </span>
              </div>
              <div className="ps-curve-chart ps-curve-swap" key={featuredCurve.project_code}>
                <SCurveChart points={featuredCurve.points} />
                {!hasAnyActual && <span className="ps-curve-unreported">Aktual belum dilaporkan</span>}
              </div>
              <p className="ps-curve-footnote">Data simulasi · Grafik berganti otomatis · Titik terakhir = minggu laporan terakhir.</p>
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
          <div
            className="ps-milestone-list ps-auto-scroll"
            aria-label="Milestone terlambat dan 14 hari mendatang, dapat digulir dengan mouse"
            tabIndex={0}
            {...milestoneScroll}
          >
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
          <p>Semua {prioritized.length} proyek aktif · bergulir otomatis, bisa digeser manual</p>
        </div>
        <div
          className="ps-comparison__rows ps-auto-scroll"
          aria-label="Perbandingan progres seluruh proyek aktif, dapat digulir dengan mouse"
          tabIndex={0}
          {...comparisonScroll}
        >
          {prioritized.map((project, index) => (
            <div className="ps-comparison__row ps-appear" key={project.code} style={{ animationDelay: `${index * 40}ms` }}>
              <code>{project.code}</code>
              <strong className="ps-comparison__name" title={project.name}>{project.name}</strong>
              <div className="ps-comparison__bar">
                <span>Rencana {project.planned_progress_percent === null ? '—' : `${project.planned_progress_percent}%`}</span>
                <ProgressBar actual={project.progress_percent ?? 0} planned={project.planned_progress_percent} showLabel={false} />
              </div>
              <div className="ps-comparison__numbers">
                <strong title={project.progress_percent === null ? 'Progres aktual belum dilaporkan (0% hanya tampilan)' : undefined}>
                  {project.progress_percent ?? 0}%
                </strong>
                <span>Rencana {project.planned_progress_percent === null ? '—' : `${project.planned_progress_percent}%`}</span>
              </div>
              <div className="ps-comparison__status"><StatusPill status={project.status} isStale={project.is_stale} /></div>
            </div>
          ))}
          {prioritized.length === 0 && <p className="ps-empty">Belum ada proyek aktif.</p>}
        </div>
      </article>
    </section>
  );
}
