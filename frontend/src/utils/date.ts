const TIME_ZONE = 'Asia/Jakarta';
const LOCALE = 'id-ID';

function parseDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  // Date-only values are calendar dates in WIB; do not reinterpret in the viewer's zone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00+07:00`);
  }
  return new Date(value);
}

function fmt(value: Date | string, options: Intl.DateTimeFormatOptions): string {
  const parsed = parseDate(value);
  if (!Number.isFinite(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: TIME_ZONE }).format(parsed);
}

export function formatClock(value: Date | string): string {
  return fmt(value, { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
}

export function formatLongDate(value: Date | string): string {
  return fmt(value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatShortDate(value: Date | string | null, withYear = false): string {
  if (!value) return '—';
  return fmt(value, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

export function formatDateTimeWib(value: Date | string | null): string {
  if (!value) return 'Belum ada';
  return `${fmt(value, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })} · ${formatClock(value)} WIB`;
}

function dayNumber(value: Date | string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE,
  }).formatToParts(parseDate(value));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day')) / 86_400_000;
}

export function formatRelativeDays(value: Date | string | null, today: Date = new Date()): string {
  if (!value) return 'Belum ada pembaruan';
  const difference = dayNumber(today) - dayNumber(value);
  if (difference === 0) return 'Diperbarui hari ini';
  if (difference > 0) return `Diperbarui ${difference} hari lalu`;
  return `Diperbarui ${Math.abs(difference)} hari mendatang`;
}
