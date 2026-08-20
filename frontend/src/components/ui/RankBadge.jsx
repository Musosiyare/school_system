// Class rank shown as plain "n / total" text for every student — no medal
// styling for the top 3 positions, so the rank column stays uniform.
export default function RankBadge({ rank, total }) {
  if (rank == null || !total) {
    return <span className="text-sm text-slate-400 tabular-nums">-</span>;
  }
  return (
    <span className="text-sm font-medium text-slate-700 tabular-nums">
      {rank}
      <span className="text-slate-400 font-normal">/{total}</span>
    </span>
  );
}
