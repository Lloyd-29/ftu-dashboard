const bounded = (value: number) => Math.max(0, Math.min(100, value));

type Props = {
  actual: number | null;
  planned: number | null;
  showLabel?: boolean;
};

export default function ProgressBar({ actual, planned, showLabel = true }: Props) {
  return (
    <div className="ftu-progress">
      <div className="ftu-progress__track" aria-label={`Aktual ${actual ?? 'belum diisi'}, rencana ${planned ?? 'belum diisi'}`}>
        <div className="ftu-progress__fill" style={{ width: `${bounded(actual ?? 0)}%` }} />
        {planned !== null && <span className="ftu-progress__planned" style={{ left: `${bounded(planned)}%` }} />}
      </div>
      {showLabel && <div className="ftu-progress__info">
        {actual === null ? <span className="ftu-progress__missing">Belum diisi</span> : <strong>{actual}%</strong>}
        {' · Rencana '}{planned === null ? '—' : `${planned}%`}
      </div>}
    </div>
  );
}
