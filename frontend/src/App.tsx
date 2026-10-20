import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import SummarySlide from './components/SummarySlide';
import ScheduleSlide from './components/ScheduleSlide';
import WorkloadSlide from './components/WorkloadSlide';
import ClientNotesSlide from './components/ClientNotesSlide';
import DashboardHeader from './components/DashboardHeader';
import DashboardFooter from './components/DashboardFooter';
import type { DashboardData } from './types/dashboard';
import './App.css';
import './components/DemoViewport.css';

const PAGES = ['Ringkasan', 'Progres & Jadwal', 'Beban Kerja', 'Catatan Klien'] as const;
const POLL_INTERVAL_MS = 45_000;
const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [offline, setOffline] = useState(false);
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
          cache: 'no-store', signal: request.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: DashboardData = await response.json();
        if (!payload.summary || !Array.isArray(payload.projects)) {
          throw new Error('Invalid dashboard payload');
        }
        if (mounted) {
          setData(payload);
          setLastReceivedAt(new Date());
          setOffline(false);
        }
      } catch {
        if (mounted) setOffline(true);
      } finally {
        window.clearTimeout(timeout);
        if (pending === request) pending = null;
      }
    }

    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      pending?.abort();
    };
  }, []);

  return { data, offline, lastReceivedAt };
}

function readScale(): number {
  return Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
}

export default function App() {
  const { data, offline, lastReceivedAt } = useDashboard();
  const [now, setNow] = useState(() => new Date());
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [scale, setScale] = useState(readScale);
  const rotationMs = Math.max(5, data?.settings.slide_rotation_seconds ?? 25) * 1_000;
  const [remainingMs, setRemainingMs] = useState(rotationMs);
  const remainingRef = useRef(rotationMs);
  const isLite = new URLSearchParams(window.location.search).get('lite') === '1';
  const disconnected = offline || (lastReceivedAt !== null && now.getTime() - lastReceivedAt.getTime() > 90_000);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const resize = () => setScale(readScale());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    remainingRef.current = rotationMs;
    setRemainingMs(rotationMs);
  }, [page, rotationMs]);

  useEffect(() => {
    if (paused) return;
    let previous = Date.now();
    const ticker = window.setInterval(() => {
      const current = Date.now();
      const delta = current - previous;
      previous = current;
      remainingRef.current = Math.max(0, remainingRef.current - delta);
      setRemainingMs(remainingRef.current);
      if (remainingRef.current === 0) {
        setPage((currentPage) => (currentPage + 1) % PAGES.length);
      }
    }, 250);
    return () => window.clearInterval(ticker);
  }, [page, paused, rotationMs]);

  // DEMO-ONLY: Keyboard-only controls for the supervisor's laptop demo.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPage((current) => (current + 1) % PAGES.length);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPage((current) => (current - 1 + PAGES.length) % PAGES.length);
      } else if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setPaused((current) => !current);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const viewportStyle = { '--stage-scale': scale } as CSSProperties;

  return (
    <div className="demo-viewport" style={viewportStyle}>
      <div className="demo-stage-holder">
        <div className={`dashboard-shell${isLite ? ' lite' : ''}`}>
          <DashboardHeader
            pages={PAGES}
            activePage={page}
            now={now}
            lastUpdatedAt={data?.last_updated_at ?? null}
            hasData={data !== null}
            disconnected={disconnected}
            paused={paused}
          />

          <main key={page} className="slide-view" aria-label={PAGES[page]}>
            {!data ? (
              <section className="placeholder-card" role="status">
                {offline ? 'API belum dapat dihubungi. Periksa koneksi Laravel.' : 'Memuat data dashboard...'}
              </section>
            ) : page === 0 ? (
              <SummarySlide data={data} />
            ) : page === 1 ? (
              <ScheduleSlide data={data} />
            ) : page === 2 ? (
              <WorkloadSlide data={data} />
            ) : (
              <ClientNotesSlide data={data} now={now} remainingMs={remainingMs} rotationMs={rotationMs} />
            )}
          </main>

          <DashboardFooter
            page={page}
            pageCount={PAGES.length}
            remainingMs={remainingMs}
            rotationMs={rotationMs}
            paused={paused}
          />
        </div>
      </div>
    </div>
  );
}
