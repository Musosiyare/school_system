// Color band for a weighted-average score — mirrors the thresholds used
// for "Overall Result" elsewhere (Excellent 80-100, Very Good 70-79, Pass
// 50-69, else Fail), so a score's color always means the same thing
// wherever it's shown.
export function averageBand(avg) {
  if (avg === null || avg === undefined) {
    return { text: "text-slate-400", bar: "bg-slate-300", ring: "ring-slate-200" };
  }
  if (avg >= 80) return { text: "text-emerald-600", bar: "bg-emerald-500", ring: "ring-emerald-200" };
  if (avg >= 70) return { text: "text-sky-600", bar: "bg-sky-500", ring: "ring-sky-200" };
  if (avg >= 50) return { text: "text-amber-600", bar: "bg-amber-500", ring: "ring-amber-200" };
  return { text: "text-red-600", bar: "bg-red-500", ring: "ring-red-200" };
}
