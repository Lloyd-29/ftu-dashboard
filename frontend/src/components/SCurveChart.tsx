type Point = { week_date: string; planned: number | null; actual: number | null };
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const xAt = (i: number, count: number) => 70 + (i / Math.max(1, count - 1)) * 870;
const yAt = (value: number) => 354 - (clamp(value) / 100) * 270;

function buildPath(points: Point[], key: 'planned' | 'actual'): string {
  let connected = false;
  return points.map((point, index) => {
    const value = point[key];
    if (value === null) { connected = false; return ''; }
    const part = `${connected ? 'L' : 'M'}${xAt(index, points.length).toFixed(2)},${yAt(value).toFixed(2)}`;
    connected = true;
    return part;
  }).filter(Boolean).join(' ');
}

export default function SCurveChart({ points }: { points: Point[] }) {
  const sorted = [...points].sort((a, b) => a.week_date.localeCompare(b.week_date));
  let latestActualIndex = -1;
  sorted.forEach((point, index) => { if (point.actual !== null) latestActualIndex = index; });
  const latest = latestActualIndex >= 0 ? sorted[latestActualIndex] : null;
  const gap = latest !== null && latest.planned !== null && latest.actual !== null
    ? latest.planned - latest.actual : null;
  const pointX = latestActualIndex >= 0 ? xAt(latestActualIndex, sorted.length) : 0;
  // DEMO-ONLY: Keep the red gap callout within the SVG even when the latest point is at the right edge.
  const labelOnLeft = pointX > 735;
  const textX = labelOnLeft ? pointX - 15 : pointX + 15;
  const textAnchor = labelOnLeft ? 'end' : 'start';
  const calloutX = labelOnLeft ? pointX - 192 : pointX + 22;
  const arrowX = labelOnLeft ? pointX - 10 : pointX + 10;

  return (
    <svg className="ftu-scurve" viewBox="0 0 1010 430" role="img" aria-label={`Kurva S progres rencana dan aktual, ${sorted.length} minggu`}>
      {[0, 20, 40, 60, 80, 100].map((value) => (
        <g key={value}>
          <line x1="70" x2="945" y1={yAt(value)} y2={yAt(value)} stroke="#E4E8F0" strokeWidth="1.5" />
          <text x="54" y={yAt(value) + 7} textAnchor="end">{value}%</text>
        </g>
      ))}
      {sorted.map((point, index) => (
        <g key={`${point.week_date}-${index}`}>
          <line x1={xAt(index, sorted.length)} x2={xAt(index, sorted.length)} y1="84" y2="354" stroke="#EFF1F6" strokeWidth="1" />
          <text x={xAt(index, sorted.length)} y="386" textAnchor="middle">M{index + 1}</text>
        </g>
      ))}
      <path d={buildPath(sorted, 'planned')} fill="none" stroke="#8C97AD" strokeWidth="3" strokeDasharray="9 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d={buildPath(sorted, 'actual')} fill="none" stroke="#5B4BC4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {sorted.map((point, index) => (
        <g key={point.week_date}>
          {point.planned !== null && <circle cx={xAt(index, sorted.length)} cy={yAt(point.planned)} r="5" fill="#8C97AD" />}
          {point.actual !== null && <circle cx={xAt(index, sorted.length)} cy={yAt(point.actual)} r="6" fill="#5B4BC4" />}
        </g>
      ))}
      {latest && (
        <g>
          <line x1={pointX} x2={pointX} y1="74" y2="354" stroke="#5B4BC4" strokeWidth="2" strokeDasharray="7 7" />
          <text x={pointX} y="56" textAnchor="middle" fill="#5B4BC4">Hari ini</text>
          {latest.planned !== null && <text x={textX} y={yAt(latest.planned) - 14} textAnchor={textAnchor} fontWeight="750">{latest.planned}%</text>}
          {latest.actual !== null && <text x={textX} y={yAt(latest.actual) + 31} textAnchor={textAnchor} fontWeight="750">{latest.actual}%</text>}
          {gap !== null && gap > 0 && latest.actual !== null && latest.planned !== null && (
            <g>
              <line x1={arrowX} x2={arrowX} y1={yAt(latest.planned) + 5} y2={yAt(latest.actual) - 5} stroke="#D62B1F" strokeWidth="2" />
              <rect x={calloutX} y={(yAt(latest.planned) + yAt(latest.actual)) / 2 - 19} width="172" height="36" rx="7" fill="#FFF2F2" stroke="#D62B1F" />
              <text x={calloutX + 86} y={(yAt(latest.planned) + yAt(latest.actual)) / 2 + 6} textAnchor="middle" fill="#B91C1C" fontWeight="650">Terlambat {gap}%</text>
            </g>
          )}
        </g>
      )}
      <line x1="74" x2="121" y1="414" y2="414" stroke="#5B4BC4" strokeWidth="5" />
      <text x="133" y="421">Progres aktual</text>
      <line x1="330" x2="377" y1="414" y2="414" stroke="#8C97AD" strokeWidth="3" strokeDasharray="8 6" />
      <text x="389" y="421">Rencana</text>
    </svg>
  );
}
