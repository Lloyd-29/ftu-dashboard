import type { DashboardData } from '../types/dashboard';
import './WorkloadSlide.css';

type Props = { data: DashboardData };
type Engineer = DashboardData['engineer_workload'][number];

const PROJECT_COLORS = [
  '#5B4BC4', '#287FAD', '#37957B', '#8C6DCA',
  '#C18B25', '#4B78A6', '#578F51', '#826CC0',
] as const;

function capacityLabel(percent: number): string {
  if (percent > 100) return 'Berlebih';
  if (percent >= 80) return 'Hampir penuh';
  return 'Tersedia';
}

export default function WorkloadSlide({ data }: Props) {
  const engineers = [...data.engineer_workload].sort(
    (a, b) => b.total_allocation_percent - a.total_allocation_percent ||
      a.name.localeCompare(b.name),
  );

  const active = engineers.filter((engineer) => engineer.assignments.length > 0).length;
  const nearlyFull = engineers.filter(
    (engineer) => engineer.total_allocation_percent >= 80 &&
      engineer.total_allocation_percent <= 100,
  ).length;
  const available = engineers.filter(
    (engineer) => engineer.total_allocation_percent < 80,
  ).length;
  const overallocated = engineers.filter(
    (engineer) => engineer.total_allocation_percent > 100,
  ).length;

  // DEMO-ONLY: Fixed single-panel capacity view, with a visible 100% reference.
  const chartMax = Math.max(
    120,
    Math.ceil(Math.max(100, ...engineers.map(
      (engineer) => engineer.total_allocation_percent,
    )) / 10) * 10,
  );
  const capacityPosition = (100 / chartMax) * 100;
  const projectColors = new Map<string, string>(
    data.projects.map((project, index): [string, string] => [
      project.code,
      PROJECT_COLORS[index % PROJECT_COLORS.length],
    ]),
  );

  return (
    <section className="workload-layout" aria-label="Beban kerja engineer">
      <div className="workload-kpis">
        <article className="workload-kpi">
          <span>Engineer Aktif</span><strong>{active}</strong>
        </article>
        <article className="workload-kpi workload-kpi--amber">
          <span>Hampir Penuh (80–100%)</span><strong>{nearlyFull}</strong>
        </article>
        <article className="workload-kpi workload-kpi--green">
          <span>Tersedia (&lt;80%)</span><strong>{available}</strong>
        </article>
        <article className="workload-kpi workload-kpi--red">
          <span>Beban Berlebih (&gt;100%)</span><strong>{overallocated}</strong>
        </article>
      </div>

      <div className="workload-headline">
        <div>
          <strong>Alokasi per Engineer</strong>
          <span>Gabungan seluruh proyek aktif · garis batas 100%</span>
        </div>
        <div className="workload-headline__badge">
          {engineers.length} engineer · {overallocated} melebihi kapasitas
        </div>
      </div>

      {engineers.length === 0 ? (
        <div className="workload-empty">Belum ada data alokasi engineer.</div>
      ) : (
        <div className="workload-grid">
          {engineers.map((engineer: Engineer, index: number) => {
            const percent = engineer.total_allocation_percent;
            const availableCapacity = Math.max(0, 100 - percent);
            const tone = percent > 100 ? 'red' : percent >= 80 ? 'amber' : 'green';

            return (
              <article
                key={engineer.name}
                className={`workload-card workload-card--${tone}`}
                style={{ animationDelay: `${index * 35}ms` }}
              >
                <div className="workload-card__head">
                  <strong title={engineer.name}>{engineer.name}</strong>
                  <span className={`workload-card__status workload-card__status--${tone}`}>
                    {capacityLabel(percent)}
                  </span>
                  <b>{percent}%</b>
                </div>

                <div className="workload-card__chart">
                  <div className="workload-card__bar" aria-hidden="true">
                    <div
                      className="workload-card__segments"
                      style={{ width: `${(percent / chartMax) * 100}%` }}
                    >
                      {engineer.assignments.map((assignment) => (
                        <span
                          key={assignment.project_code}
                          className="workload-card__segment"
                          style={{
                            width: percent > 0
                              ? `${(assignment.allocation_percent / percent) * 100}%`
                              : '0%',
                            background: projectColors.get(assignment.project_code) ?? '#8A93A3',
                          }}
                        />
                      ))}
                    </div>
                    <span
                      className="workload-card__capacity"
                      style={{ left: `${capacityPosition}%` }}
                    />
                  </div>
                </div>

                <div className="workload-card__details">
                  <span className="workload-card__assignments">
                    {engineer.assignments.map((assignment) => (
                      <span key={assignment.project_code} className="workload-card__project">
                        <i style={{ background: projectColors.get(assignment.project_code) ?? '#8A93A3' }} />
                        {assignment.project_code} {assignment.allocation_percent}%
                      </span>
                    ))}
                  </span>
                  <span className="workload-card__remaining">
                    {percent > 100 ? `+${percent - 100}% berlebih` : `${availableCapacity}% sisa`}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="workload-caption">Data simulasi · Persentase alokasi lintas proyek, bukan jam kerja aktual.</p>
    </section>
  );
}
