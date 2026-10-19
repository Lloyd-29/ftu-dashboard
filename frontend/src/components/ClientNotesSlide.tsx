import type { DashboardClientNote, DashboardData, DashboardProject } from '../types/dashboard';
import './ClientNotesSlide.css';

type Props = { data: DashboardData };

const STATUS_LABELS: Record<DashboardProject['status'], string> = {
  delayed: 'Terlambat',
  at_risk: 'Berisiko',
  on_track: 'Sesuai Rencana',
};

const STATUS_ORDER: Record<DashboardProject['status'], number> = {
  delayed: 0,
  at_risk: 1,
  on_track: 2,
};

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${value}T12:00:00+07:00`));
}

export default function ClientNotesSlide({ data }: Props) {
  const notesByProject = new Map<string, DashboardClientNote[]>();

  for (const note of data.latest_client_notes) {
    if (!note.project_code) continue;
    const existing = notesByProject.get(note.project_code) ?? [];
    existing.push(note);
    notesByProject.set(note.project_code, existing);
  }

  // DEMO-ONLY: Two recent notes per project, arranged for the laptop display.
  const groups = data.projects
    .map((project) => ({
      project,
      notes: (notesByProject.get(project.code) ?? [])
        .sort((a, b) => b.note_date.localeCompare(a.note_date) || b.id - a.id)
        .slice(0, 2),
    }))
    .filter((group) => group.notes.length > 0)
    .sort((a, b) =>
      STATUS_ORDER[a.project.status] - STATUS_ORDER[b.project.status] ||
      a.project.code.localeCompare(b.project.code)
    );

  const latestDate = data.latest_client_notes[0]?.note_date;

  return (
    <section className="client-layout" aria-label="Catatan klien per proyek">
      <div className="client-overview">
        <div className="client-overview__intro">
          <span className="client-overview__eyebrow">KOMUNIKASI PROYEK</span>
          <strong>{data.latest_client_notes.length} catatan dari {groups.length} proyek</strong>
        </div>
        <span className="client-overview__latest">
          Catatan terakhir: <strong>{latestDate ? shortDate(latestDate) : 'Belum ada'}</strong>
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="client-empty">Belum ada catatan klien.</div>
      ) : (
        <div className="client-grid">
          {groups.map(({ project, notes }, index) => (
            <article
              className={`client-card client-card--${project.status}`}
              key={project.code}
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <div className="client-card__head">
                <div className="client-card__identity">
                  <h2 title={project.name}>{project.name}</h2>
                  <span title={project.client}>{project.code} · {project.client}</span>
                </div>
                <span className={`client-card__status client-card__status--${project.status}`}>
                  {STATUS_LABELS[project.status]}
                </span>
              </div>
              <div className="client-card__notes">
                {notes.map((note, noteIndex) => (
                  <div className="client-card__note" key={note.id}>
                    <span className={noteIndex === 0 ? 'client-card__date recent' : 'client-card__date'}>
                      {shortDate(note.note_date)}
                    </span>
                    <p title={note.body}>{note.body}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="client-caption">Data simulasi untuk demonstrasi FTU Dashboard.</p>
    </section>
  );
}
