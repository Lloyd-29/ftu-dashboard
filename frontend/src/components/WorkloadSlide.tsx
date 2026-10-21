import { useEffect, useRef, useState } from 'react';
import type { DashboardData } from '../types/dashboard';
import StackedBar, { projectColor } from './StackedBar';
import './WorkloadSlide.css';

type Props = { data: DashboardData };
type Engineer = DashboardData['engineer_workload'][number];

const PROJECT_COLORS = [
  '#5B4BC4', '#F6B531', '#76A1A7', '#AD9CFC',
  '#8AA2C1', '#2FA36B', '#9D78C9', '#3E78C0',
] as const;

function useCountUp(): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const lite = new URLSearchParams(window.location.search).get('lite') === '1';
    if (lite || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1);
      return;
    }

    // DEMO-ONLY: A lightweight shared count-up for the presentation slide.
    let frame = 0;
    const start = performance.now();
    const tick = (time: number) => {
      const fraction = Math.min(1, (time - start) / 650);
      setProgress(1 - (1 - fraction) ** 3);
      if (fraction < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return progress;
}

function AvailableEngineers({ engineers }: { engineers: Engineer[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [manualScroll, setManualScroll] = useState(false);

  useEffect(() => {
    const list = listRef.current;
    if (!list || manualScroll) return;
    const lite = new URLSearchParams(window.location.search).get('lite') === '1';
    if (lite || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // DEMO-ONLY: Automatically reveal clipped entries during the 25-second TV slide.
    // Manual scrolling takes over immediately when the viewer interacts with the list.
    let frame = 0;
    let startedAt: number | null = null;
    const ease = (value: number) => value * value * (3 - 2 * value);
    const animate = (now: number) => {
      if (startedAt === null) startedAt = now;
      const distance = Math.max(0, list.scrollHeight - list.clientHeight);
      if (distance > 1) {
        const phase = (now - startedAt) % 16_000;
        let fraction = 0;
        if (phase < 2_000) fraction = 0;
        else if (phase < 7_300) fraction = ease((phase - 2_000) / 5_300);
        else if (phase < 11_300) fraction = 1;
        else if (phase < 15_300) fraction = 1 - ease((phase - 11_300) / 4_000);
        list.scrollTop = distance * fraction;
      }
      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [manualScroll]);

  return (
    <div
      ref={listRef}
      className="workload-available__list"
      aria-label="Daftar engineer dengan kapasitas tersisa, dapat digulir"
      tabIndex={0}
      onWheel={() => setManualScroll(true)}
      onPointerDown={() => setManualScroll(true)}
      onTouchStart={() => setManualScroll(true)}
    >
      {engineers.map((engineer) => (
        <div className="workload-available__row" key={engineer.name}>
          <div className="workload-available__info">
            <strong>{engineer.name}</strong>
            <span>Proyek: {engineer.assignments.length
              ? engineer.assignments.map((assignment) => assignment.project_code).join(', ')
              : 'Tidak ada penugasan'}</span>
          </div>
          <span className="workload-available__remaining">sisa <strong>{100 - engineer.total_allocation_percent}%</strong></span>
        </div>
      ))}
    </div>
  );
}

export default function WorkloadSlide({ data }: Props) {
  const engineers = [...data.engineer_workload].sort(
    (a, b) => b.total_allocation_percent - a.total_allocation_percent ||
      a.name.localeCompare(b.name, 'id-ID'),
  );
  const assigned = engineers.filter((engineer) => engineer.assignments.length > 0).length;
  const nearlyFull = engineers.filter((engineer) =>
    engineer.total_allocation_percent >= 80 && engineer.total_allocation_percent <= 100,
  ).length;
  const available = engineers.filter((engineer) => engineer.total_allocation_percent < 80).length;
  const overloaded = engineers.filter((engineer) => engineer.total_allocation_percent > 100).length;
  const mostAvailable = [...engineers]
    .filter((engineer) => engineer.total_allocation_percent < 100)
    .sort((a, b) => a.total_allocation_percent - b.total_allocation_percent || a.name.localeCompare(b.name, 'id-ID'))
    .slice(0, 3);

  // DEMO-ONLY: Fixed palette in project-code order; every legend swatch matches its segment.
  const projectCodes = [...new Set([
    ...data.projects.map((project) => project.code),
    ...engineers.flatMap((engineer) => engineer.assignments.map((assignment) => assignment.project_code)),
  ])].sort((a, b) => a.localeCompare(b));
  const colors = new Map(projectCodes.map((code, index): [string, string] => [
    code, PROJECT_COLORS[index % PROJECT_COLORS.length] ?? projectColor(code),
  ]));

  const progress = useCountUp();
  const animated = (value: number) => Math.round(value * progress);

  return (
    <section className="workload-aligned" aria-label="Beban kerja per engineer">
      <article className="workload-panel workload-panel--chart">
        <h2>Beban Kerja per Engineer</h2>
        <div className="workload-legend" aria-label="Warna berdasarkan proyek">
          {projectCodes.map((code) => (
            <span className="workload-legend__item" key={code}>
              <span className="workload-legend__swatch" style={{ backgroundColor: colors.get(code) }} />
              <span>{code}</span>
            </span>
          ))}
        </div>

        <div className="workload-plot__axis" aria-hidden="true">
          <div className="workload-plot__capacity-label"><span>Kapasitas 100%</span></div>
        </div>

        {engineers.length === 0 ? (
          <div className="workload-empty">Belum ada data alokasi engineer.</div>
        ) : (
          <div className="workload-rows">
            {engineers.map((engineer: Engineer, index) => {
              const total = engineer.total_allocation_percent;
              return (
                <div className="workload-row" key={engineer.name} style={{ animationDelay: `${index * 40}ms` }}>
                  <span className="workload-row__name" title={engineer.name}>{engineer.name}</span>
                  <StackedBar assignments={engineer.assignments} total={total} max={120} colors={colors} />
                  <div className="workload-row__result">
                    <strong className={total > 100 ? 'is-overloaded' : undefined}>{animated(total)}%</strong>
                    {total > 100 && <span className="workload-row__over-pill">Berlebih</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="workload-caption">Data simulasi · Alokasi lintas proyek, bukan jam kerja aktual.</p>
      </article>

      <aside className="workload-sidebar">
        <section className="workload-panel workload-summary">
          <h2>Ringkasan</h2>
          <div className="workload-summary__stat">
            <strong className="workload-summary__number">{animated(assigned)}</strong>
            <div><h3>Aktif</h3><p>Engineer dengan penugasan proyek</p></div>
          </div>
          <div className="workload-summary__stat">
            <strong className="workload-summary__number is-amber">{animated(nearlyFull)}</strong>
            <div><h3>Hampir penuh</h3><p>Alokasi 80–100% dari kapasitas</p></div>
          </div>
          <div className="workload-summary__stat">
            <strong className="workload-summary__number is-green">{animated(available)}</strong>
            <div><h3>Tersedia</h3><p>Alokasi di bawah 80%</p></div>
          </div>
          {overloaded > 0 && <p className="workload-summary__warning">{overloaded} engineer melebihi kapasitas 100%</p>}
        </section>

        <section className="workload-panel workload-available">
          <h2>Tersedia Minggu Ini</h2>
          <p className="workload-available__description">Engineer dengan sisa kapasitas terbesar</p>
          {mostAvailable.length === 0 ? (
            <p className="workload-available__empty">Belum ada engineer dengan kapasitas tersisa.</p>
          ) : (
            <AvailableEngineers engineers={mostAvailable} />
          )}
        </section>
      </aside>
    </section>
  );
}
