type Props = {
  page: number;
  pageCount: number;
  remainingMs: number;
  rotationMs: number;
  paused: boolean;
};

export default function DashboardFooter({ page, pageCount, remainingMs, rotationMs, paused }: Props) {
  const fraction = Math.max(0, Math.min(1, 1 - remainingMs / Math.max(1, rotationMs)));
  const seconds = Math.max(0, Math.ceil(remainingMs / 1_000));

  return (
    <footer className="dashboard-footer">
      <div className="page-dots" aria-hidden="true">
        {Array.from({ length: pageCount }, (_, index) => (
          <span key={index} className={`page-dot${page === index ? ' active' : ''}`} />
        ))}
      </div>
      <span className="page-count">Halaman {page + 1} dari {pageCount}</span>
      <span className="demo-label">Data simulasi</span>
      <div className="rotation-track" role="progressbar" aria-label="Waktu menuju slide berikutnya" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
        <div className="rotation-fill" style={{ transform: `scaleX(${fraction})` }} />
      </div>
      <span className="countdown">{paused ? `Dijeda · ${seconds} detik tersisa` : `Berikutnya dalam ${seconds} detik`}</span>
    </footer>
  );
}
