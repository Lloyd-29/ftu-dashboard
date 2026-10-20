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
    if (!existing || note.note_date > existing.note_date ||
      (note.note_date === existing.note_date && note.id > existing.id)) {
      latestNotes.set(note.project_code, note);
    }
  }

  const projects = [...data.projects].sort((a, b) =>
    STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || a.code.localeCompare(b.code)
  );

  // DEMO-ONLY: Two four-project sub-pages share one slide's rotation countdown.
  // Using remainingMs keeps the sub-page frozen when the laptop presenter presses P.
  const totalSubpages = Math.max(1, Math.ceil(projects.length / 4));
  const progress = Math.max(0, Math.min(1, 1 - remainingMs / Math.max(1, rotationMs)));
  const subpage = Math.min(totalSubpages - 1, Math.floor(progress * totalSubpages));
  const visible = projects.slice(subpage * 4, subpage * 4 + 4);

  return (
    <section className="client-layout" aria-label="Catatan klien per proyek">
      <div className="client-subpage-head">
        <span>Catatan klien terbaru per proyek</span>
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
              <article className="client-card" key={project.code} style={{ animationDelay: `${index * 40}ms` }}>
                <div className="client-card__head">
                  <div className="client-card__identity">
                    <span className="client-card__code">{project.code}</span>
                    <h2 title={project.name}>{project.name}</h2>
                    <div className="client-card__client">{project.client}</div>
                  </div>
                  <StatusPill status={project.status} isStale={project.is_stale} />
                </div>

                <div className="client-card__latest">
                  <div className="client-card__section-head">
                    <span>Catatan klien terbaru</span>
                    <time dateTime={note?.note_date}>
                      {note ? formatShortDate(note.note_date, true) : 'Belum ada tanggal'}
                    </time>
                  </div>
                  <p className="client-card__note">{note?.body ?? 'Belum ada catatan klien.'}</p>
                </div>

                <div className="client-card__risk">
                  <span className="client-card__risk-label">Kendala / risiko</span>
                  {risks.length ? (
                    <ul>{risks.map((risk, riskIndex) => <li key={riskIndex}>{risk}</li>)}</ul>
                  ) : (
                    <span className="client-card__no-risk">Tidak ada risiko tercatat.</span>
                  )}
                </div>
                <p className="client-card__updated">{updatedLabel(project, now)}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
