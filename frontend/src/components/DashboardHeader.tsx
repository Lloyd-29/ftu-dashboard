import { formatClock, formatDateTimeWib, formatLongDate } from '../utils/date';

type Props = {
  pages: readonly string[];
  activePage: number;
  now: Date;
  lastUpdatedAt: string | null;
  hasData: boolean;
  disconnected: boolean;
  paused: boolean;
};

export default function DashboardHeader({
  pages, activePage, now, lastUpdatedAt, hasData, disconnected, paused,
}: Props) {
  const status = disconnected
    ? 'Terputus · menampilkan data terakhir'
    : hasData ? 'Terhubung' : 'Menghubungkan...';

  return (
    <header className="dashboard-header">
      <div className="brand">
        <img className="brand-logo" src="/ftu-logo.png" alt="Logo FTU" />
        <strong className="brand-name brand-name--stacked" aria-label="Filosofi Teknik Utama">
          <span>FILOSOFI</span>
          <span>TEKNIK</span>
          <span>UTAMA</span>
        </strong>
      </div>

      <nav className="page-tabs" aria-label="Urutan slide, bukan navigasi interaktif">
        {pages.map((label, index) => (
          <span
            key={label}
            className={`page-tab${activePage === index ? ' active' : ''}`}
            aria-current={activePage === index ? 'page' : undefined}
          >
            {label}
          </span>
        ))}
      </nav>

      <div className="header-clock">
        <div className="header-clock__time">
          {formatClock(now)}<span className="header-clock__zone">WIB</span>
        </div>
        <span className="header-clock__date">{formatLongDate(now)}</span>
        <div className="header-data-status" aria-live="polite">
          <span>Diperbarui {formatDateTimeWib(lastUpdatedAt)}</span>
          <span aria-hidden="true">·</span>
          <span className={`connection-dot${disconnected ? ' offline' : !hasData ? ' waiting' : ''}`} aria-hidden="true" />
          <span className={disconnected ? 'connection-text offline' : ''}>{status}</span>
          {paused && <span className="paused-flag">Dijeda</span>}
        </div>
      </div>
    </header>
  );
}
