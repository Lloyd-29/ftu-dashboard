import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DashboardData, DashboardProject } from '../types/dashboard';
import DonutChart from './DonutChart';
import ProgressBar from './ProgressBar';
import StatusPill from './StatusPill';
import { formatShortDate } from '../utils/date';
import './SummarySlide.css';

type Props = {
  data: DashboardData;
  remainingMs: number;
  rotationMs: number;
};

const PRIORITY: Record<DashboardProject['status'], number> = {
  delayed: 0,
  at_risk: 1,
  on_track: 2,
};

const STATUS_LEGEND = [
  { key: 'on_track', label: 'Sesuai jadwal', className: 'on-track' },
  { key: 'at_risk', label: 'Berisiko', className: 'at-risk' },
  { key: 'delayed', label: 'Terlambat', className: 'delayed' },
] as const;

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    // DEMO-ONLY: Gentle entrance animation; reduced-motion/lite skip it.
    const lite = new URLSearchParams(window.location.search).get('lite') === '1';
    if (lite || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const animate = (time: number) => {
      const progress = Math.min(1, (time - start) / 580);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <>{display}</>;
}

function dateLabel(value: string | null) {
  return value ? formatShortDate(value) : 'Belum dijadwalkan';
}

export default function SummarySlide({ data, remainingMs, rotationMs }: Props) {
  // DEMO-ONLY: Four projects per sub-page; synchronize with the main slide timer.
  // Pausing with P freezes both the outer slide and this inner carousel.
  const prioritized = [...data.projects].sort((a, b) =>
    PRIORITY[a.status] - PRIORITY[b.status] || a.code.localeCompare(b.code)
  );
  const projectsPerSheet = 4;
  const sheetCount = Math.max(1, Math.ceil(prioritized.length / projectsPerSheet));
  const progress = Math.max(0, Math.min(1, 1 - remainingMs / Math.max(1, rotationMs)));
  const sheetIndex = Math.min(sheetCount - 1, Math.floor(progress * sheetCount));
  const visible = prioritized.slice(sheetIndex * projectsPerSheet, (sheetIndex + 1) * projectsPerSheet);
  // DEMO-ONLY: Lack of engineer allocations is used as a jobdesk placeholder.
  const assignedCodes = new Set(data.engineer_workload.flatMap((engineer) =>
    engineer.assignments.map((assignment) => assignment.project_code)
  ));
  const topFindings = [...data.projects].sort((a, b) =>
    b.findings_open - a.findings_open || a.code.localeCompare(b.code)
  ).slice(0, 4);
  const alertHighlights = data.alerts.slice(0, 3);

  return (
    <div className="rs-layout">
      <div className="rs-overview">
        <section className="ftu-card rs-card rs-status" aria-label="Status proyek">
          <h2>Status Proyek</h2>
          <div className="rs-status__body">
            <DonutChart
              onTrack={data.summary.on_track}
              atRisk={data.summary.at_risk}
              delayed={data.summary.delayed}
              size={272}
            />
            <div className="rs-legend">
              {STATUS_LEGEND.map((item, index) => (
                <div className="rs-legend__row rs-appear" key={item.key} style={{ animationDelay: `${index * 40}ms` }}>
                  <span className={`rs-legend__dot rs-legend__dot--${item.className}`} />
                  <strong><CountUp value={data.summary[item.key]} /></strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="ftu-card rs-card rs-attention" aria-label="Peringatan penting">
          <h2>Perlu Perhatian</h2>
          <div className="rs-attention__items">
            {alertHighlights.length === 0 ? (
              <p className="rs-empty">Tidak ada peringatan aktif.</p>
            ) : alertHighlights.map((alert, index) => (
              <article className="rs-alert rs-appear" key={alert.id} style={{ animationDelay: `${index * 40}ms` }}>
                <span className={`rs-alert__rail rs-alert__rail--${alert.severity}`} aria-hidden="true" />
                <div className="rs-alert__text">
                  <strong>{alert.title}</strong>
                  <p>
                    {alert.project_code ?? 'Umum'} · {dateLabel(alert.due_date)}
                    {alert.is_overdue && <span className="rs-overdue"> · Lewat tenggat</span>}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ftu-card rs-card rs-findings" aria-label="Temuan terbuka">
          <h2>Temuan Terbuka</h2>
          <div className="rs-findings__body">
            <div className="rs-findings__total">
              <strong><CountUp value={data.summary.findings_open} /></strong>
              <span>temuan terbuka</span>
            </div>
            <div className="rs-findings__projects">
              {topFindings.map((project, index) => {
                const total = project.findings_open + project.findings_closed;
                const fill = total ? (100 * project.findings_open) / total : 0;
                return (
                  <div className="rs-findings__row rs-appear" key={project.code} style={{ animationDelay: `${index * 40}ms` }}>
                    <code>{project.code}</code>
                    <div className="rs-findings__track" aria-label={`${project.findings_open} dari ${total} temuan masih terbuka`}>
                      <span style={{ width: `${fill}%` }} />
                    </div>
                    <span className="rs-findings__count">{project.findings_open}/{total}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <section className="ftu-card rs-projects" aria-label="Proyek aktif">
        <div className="rs-projects__heading">
          <h2>Proyek Aktif</h2>
          <span className="rs-projects__sheet" aria-label={`Lembar ${sheetIndex + 1} dari ${sheetCount}`}>
            {sheetIndex + 1}/{sheetCount}
          </span>
        </div>
        <div className="rs-table" role="table" aria-label={`Proyek aktif, lembar ${sheetIndex + 1} dari ${sheetCount}`}>
          <div className="rs-table__head" role="row">
            <span role="columnheader">Kode</span>
            <span role="columnheader">Proyek</span>
            <span role="columnheader">Klien</span>
            <span role="columnheader">Progres</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Milestone berikutnya</span>
          </div>
          {visible.length === 0 && <p className="rs-projects__empty">Belum ada proyek aktif.</p>}
          {visible.map((project, index) => (
            <div
              className="rs-table__row rs-appear"
              role="row"
              key={`${sheetIndex}-${project.code}`}
              style={{ animationDelay: `${index * 40}ms` } as CSSProperties}
            >
              <code role="cell">{project.code}</code>
              <strong role="cell" title={project.name}>{project.name}</strong>
              <span role="cell" title={project.client}>{project.client}</span>
              <div role="cell" className="rs-project-progress">
                <div className="rs-project-progress__top">
                  <strong>{project.progress_percent ?? 0}%</strong>
                  <div className="rs-project-progress__bar">
                    <ProgressBar actual={project.progress_percent ?? 0} planned={project.planned_progress_percent} showLabel={false} />
                    <span>{!assignedCodes.has(project.code)
                      ? 'Jobdesk belum dibagi'
                      : project.planned_progress_percent === null
                        ? 'Rencana belum diisi'
                        : `Rencana ${project.planned_progress_percent}%`}</span>
                  </div>
                </div>
              </div>
              <span role="cell" className="rs-table__status"><StatusPill status={project.status} isStale={project.is_stale} /></span>
              <span role="cell" className="rs-milestone">
                <strong title={project.next_milestone_name ?? ''}>{project.next_milestone_name ?? 'Belum dijadwalkan'}</strong>
                <span>{project.next_milestone_date ? dateLabel(project.next_milestone_date) : '—'}</span>
              </span>
            </div>
          ))}
        </div>

      </section>
    </div>
  );
}
