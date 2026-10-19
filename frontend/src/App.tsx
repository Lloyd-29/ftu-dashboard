import { useEffect, useState } from 'react';
import SummarySlide from './components/SummarySlide';
import ClientNotesSlide from './components/ClientNotesSlide';
import WorkloadSlide from './components/WorkloadSlide';
import type { DashboardData } from './types/dashboard';
import './App.css';
import './components/DemoViewport.css';

const PAGES = [
  'Ringkasan',
  'Catatan Klien',
  'Beban Kerja',
  'Progres & Jadwal',
] as const;

const TIME_ZONE = 'Asia/Jakarta';
const POLL_INTERVAL_MS = 45_000;

function formatTime(value: Date | string | null): string {
  if (!value) return '--:--';

  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE,
  })
    .format(typeof value === 'string' ? new Date(value) : value)
    .replace('.', ':');
}

function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [lastReceivedAt, setLastReceivedAt] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    let pending: AbortController | null = null;

    async function refresh(): Promise<void> {
      if (pending) return;

      const request = new AbortController();
      pending = request;

      const timeout = window.setTimeout(() => request.abort(), 8_000);

      try {
        const response = await fetch('/api/dashboard', {
          cache: 'no-store',
          signal: request.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload: DashboardData = await response.json();

        if (!payload.summary || !Array.isArray(payload.projects)) {
          throw new Error('Invalid dashboard payload');
        }

        if (mounted) {
          setData(payload);
          setLastReceivedAt(new Date());
          setIsOffline(false);
        }
      } catch {
        if (mounted) setIsOffline(true);
      } finally {
        window.clearTimeout(timeout);
        if (pending === request) pending = null;
      }
    }

    void refresh();

    const interval = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      pending?.abort();
    };
  }, []);

  return { data, isOffline, lastReceivedAt };
}

function App() {
  const { data, isOffline, lastReceivedAt } = useDashboard();
  const [now, setNow] = useState(() => new Date());
  const [page, setPage] = useState(0);

  const rotationSeconds = Math.max(
    5,
    data?.settings.slide_rotation_seconds ?? 25
  );

  // DEMO-ONLY: Simple lite switch without performance detection.
  const isLite =
    new URLSearchParams(window.location.search).get('lite') === '1';

  const isStale =
    lastReceivedAt !== null &&
    now.getTime() - lastReceivedAt.getTime() > 90_000;

  const isDisconnected = isOffline || isStale;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPage((current) => (current + 1) % PAGES.length);
    }, rotationSeconds * 1_000);

    return () => window.clearInterval(interval);
  }, [rotationSeconds]);

  const currentDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(now);

  return (
    <div className={`dashboard-shell${isLite ? ' lite' : ''}`}>
      <header className="dashboard-header">
        <div className="brand">
          <img className="brand-logo" src="/ftu-logo.png" alt="Logo FTU" />
          <div className="brand-copy">
            <strong>PT Filosofi Teknik Utama</strong>
            <span>Dashboard Proyek Engineering</span>
          </div>
        </div>

        <nav className="page-tabs" aria-label="Halaman slideshow">
          {PAGES.map((label, index) => (
            <span
              key={label}
              className={`page-tab${index === page ? ' active' : ''}`}
              aria-current={index === page ? 'page' : undefined}
            >
              {label}
            </span>
          ))}
        </nav>

        <div className="header-clock">
          <strong>{formatTime(now)}</strong>
          <span>{currentDate}</span>
        </div>
      </header>

      <div className="connection-row" aria-live="polite">
        <span className={`connection-dot${isDisconnected ? ' offline' : ''}`} />
        <span>
          {isDisconnected
            ? 'Koneksi terganggu'
            : data
              ? 'Terhubung'
              : 'Menghubungkan...'}
        </span>
        <span className="connection-separator">·</span>
        <span>Diperbarui {formatTime(data?.last_updated_at ?? null)}</span>
      </div>

      {isDisconnected && (
        <div className="offline-notice" role="status">
          Menampilkan data terakhir {formatTime(lastReceivedAt)} WIB,
          mencoba menyambung ulang.
        </div>
      )}

      <main key={page} className="slide-view" aria-label={PAGES[page]}>
        <div className="slide-heading">
          <div>
            <p className="slide-eyebrow">MONITORING PROYEK</p>
            <h1>{PAGES[page]}</h1>
          </div>
          <span className="slide-date">{currentDate}</span>
        </div>

        {!data ? (
          <section className="placeholder-card" role="status">
            {isOffline
              ? 'API belum dapat dihubungi. Periksa koneksi Laravel.'
              : 'Memuat data dashboard...'}
          </section>
        ) : page === 0 ? (
          <SummarySlide data={data} />
        ) : page === 1 ? (
          <ClientNotesSlide data={data} />
        ) : page === 2 ? (
          <WorkloadSlide data={data} />
        ) : (
          <div className="shell-preview">
            {/* DEMO-ONLY: Schedule slide is optional for the supervisor demo. */}
            <section className="preview-card wide">
              <h2>Riwayat Progres Proyek</h2>
              <strong>{data.s_curve.length}</strong>
            </section>
            <p className="preview-note">
              Konten Progres &amp; Jadwal ditambahkan pada batch berikutnya.
            </p>
          </div>
        )}
      </main>

      <footer className="dashboard-footer">
        <div className="page-dots" aria-hidden="true">
          {PAGES.map((label, index) => (
            <span
              key={label}
              className={`page-dot${page === index ? ' active' : ''}`}
            />
          ))}
        </div>
        <span className="page-count">
          Halaman {page + 1} dari {PAGES.length}
        </span>
        <div
          className="rotation-track"
          aria-label={`Ganti halaman setiap ${rotationSeconds} detik`}
        >
          <div
            key={`${page}-${rotationSeconds}`}
            className="rotation-fill"
            style={{ animationDuration: `${rotationSeconds}s` }}
          />
        </div>
      </footer>
    </div>
  );
}

export default App;
