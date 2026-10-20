type Props = {
  onTrack: number;
  atRisk: number;
  delayed: number;
  size?: number;
};

const COLORS = ['#2FA36B', '#F6B531', '#DC3535'];

export default function DonutChart({ onTrack, atRisk, delayed, size = 260 }: Props) {
  const numbers = [onTrack, atRisk, delayed];
  const total = numbers.reduce((sum, value) => sum + value, 0);
  const circumference = 2 * Math.PI * 88;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 240 240" role="img" aria-label={`${total} proyek aktif: ${onTrack} sesuai jadwal, ${atRisk} berisiko, ${delayed} terlambat`}>
      <circle cx="120" cy="120" r="88" fill="none" stroke="#E9EBF2" strokeWidth="40" />
      {numbers.map((number, index) => {
        const length = total ? (number / total) * circumference : 0;
        const start = offset;
        offset += length;
        return <circle key={index} cx="120" cy="120" r="88" fill="none" stroke={COLORS[index]} strokeWidth="40" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start} transform="rotate(-90 120 120)" />;
      })}
      <text x="120" y="120" textAnchor="middle" fontSize="64" fontWeight="800" fill="#14171F">{total}</text>
      <text x="120" y="152" textAnchor="middle" fontSize="20" fill="#14171F">proyek aktif</text>
    </svg>
  );
}
