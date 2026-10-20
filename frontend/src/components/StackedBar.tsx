type Assignment = { project_code: string; allocation_percent: number };

const COLORS = ['#5B4BC4', '#F6B531', '#76A1A7', '#AD9CFC', '#8AA2C1', '#2FA36B', '#9D78C9', '#3E78C0'];

export function projectColor(code: string): string {
  let hash = 0;
  for (const letter of code) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export default function StackedBar({ assignments, total, max = 120, colors }: {
  assignments: Assignment[];
  total: number;
  max?: number;
  colors?: ReadonlyMap<string, string>;
}) {
  const safeMax = Math.max(max, 100, total);
  return (
    <div className="ftu-stacked" aria-label={`Total alokasi ${total} persen`}>
      <div className="ftu-stacked__segments" style={{ width: `${(total / safeMax) * 100}%` }}>
        {assignments.map((assignment) => (
          <span
            key={assignment.project_code}
            className="ftu-stacked__part"
            title={`${assignment.project_code}: ${assignment.allocation_percent}%`}
            style={{
              width: `${total > 0 ? (assignment.allocation_percent / total) * 100 : 0}%`,
              background: colors?.get(assignment.project_code) ?? projectColor(assignment.project_code),
            }}
          />
        ))}
      </div>
      <span className="ftu-stacked__capacity" style={{ left: `${(100 / safeMax) * 100}%` }} />
    </div>
  );
}
