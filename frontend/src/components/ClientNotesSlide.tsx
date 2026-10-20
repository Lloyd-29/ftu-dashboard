import type { DashboardData, DashboardProject } from '../types/dashboard';
import StatusPill from './StatusPill';
import { formatRelativeDays, formatShortDate } from '../utils/date';
import './ClientNotesSlide.css';

type DashboardClientNote = DashboardData['latest_client_notes'][number];

type Props = {
  data: DashboardData;
  now: Date;
  remainingMs: number;
  rotationMs: number;
};

const STATUS_PRIORITY: Record<DashboardProject['status'], number> = {
  delayed: 0,
  at_risk: 1,
  on_track: 2,
};

function riskItems(text: string | null): string[] {
  return (text ?? '')
    .split(/[;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function updatedLabel(project: DashboardProject, now: Date): string {
  if (!project.updated_at || !project.updated_by_name) {
    return 'Belum ada pembaruan';
  }
  return `${formatRelativeDays(project.updated_at, now)} oleh ${project.updated_by_name}`;
}

export default function ClientNotesSlide({ data, now, remainingMs, rotationMs }: Props) {
  const latestNotes = new Map<string, DashboardClientNote>();
  for (const note of data.latest_client_notes) {
    if (!note.project_code) continue;
    const existing = latestNotes.get(note.project_code);
    if (
      !existing || note.note_date > existing.note_date ||
      (note.note_date === existing.note_date && note.id > existing.id)
    ) {
      latestNotes.set(note.project_code, note);
    }
  }

  const projects = [...data.projects].sort((a, b) =>
    STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || a.code.localeCompare(b.code)
  );

  // DEMO-ONLY: Keep four projects per sub-page synchronized with the outer timer.
  // Pressing P pauses both the slideshow and this four-card sub-page rotation.
  const totalSubpages = Math.max(1, Math.ceil(projects.length / 4));
  const progress = Math.max(0, Math.min(1, 1 - remainingMs / Math.max(1, rotationMs)));
  const subpage = Math.min(totalSubpages - 1, Math.floor(progress * totalSubpages));
  const visible = projects.slice(subpage * 4, subpage * 4 + 4);

  return (
    <section className="client-layout" aria-label="Catatan klien per proyek">
      <div className="client-subpage-head">
        <span className="client-subpage-count" aria-label={`Subhalaman ${subpage + 1} dari ${totalSubpages}`}>
          {subpage + 1}/{totalSubpages}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="client-empty">Belum ada proyek untuk ditampilkan.</div>
      ) : (
        <div className="client-grid" key={subpage}>
          {visible.map((project, index) => {
            const note = latestNotes.get(project.code);
            const risks = riskItems(project.risks);

            return (
              <article
                className="client-card"
                key={project.code}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <header className="client-card__head">
                  <div className="client-card__identity">
                    <span className="client-card__code">{project.code}</span>
                    <h2 title={project.name}>{project.name}</h2>
                    <p className="client-card__client">{project.client}</p>
                  </div>
                  <StatusPill status={project.status} isStale={project.is_stale} />
                </header>

                <section className="client-card__note-panel" aria-label="Catatan klien terbaru">
                  <div className="client-card__panel-heading">
                    <span>CATATAN KLIEN</span>
                    <time dateTime={note?.note_date}>
                      {note ? formatShortDate(note.note_date, true) : 'Tanggal belum tersedia'}
                    </time>
                  </div>
                  <p className="client-card__note-text">
                    {note?.body ?? 'Belum ada catatan klien.'}
                  </p>
                </section>

                <section className="client-card__risk-panel" aria-label="Kendala atau risiko proyek">
                  <div className="client-card__panel-heading">
                    <span>KENDALA / RISIKO</span>
                  </div>
                  {risks.length ? (
                    <ul className="client-card__risk-list">
                      {risks.map((risk, riskIndex) => <li key={riskIndex}>{risk}</li>)}
                    </ul>
                  ) : (
                    <p className="client-card__no-risk">Tidak ada risiko tercatat.</p>
                  )}
                </section>

                <p className="client-card__meta">{updatedLabel(project, now)}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
