import { averageBand } from "../../utils/gradeBands";

// Weighted average shown as a bold, color-banded percentage with a small
// horizontal fill bar underneath — same color language as averageBand()
// (green/blue/amber/red), so it's readable at a glance across a full class
// list instead of a flat column of plain numbers.
export default function ScoreCell({ value }) {
  const band = averageBand(value);
  const pct = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col gap-1 min-w-[64px]">
      <span className={`text-sm font-semibold tabular-nums ${band.text}`}>
        {value !== null && value !== undefined ? `${value}%` : "N/A"}
      </span>
      <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${band.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
