import { useYear } from "../context/YearContext";
import { CalendarRange } from "lucide-react";

export default function YearSwitcher() {
  const { years, viewingYearId, setViewingYearId, isCurrentView } = useYear();

  if (!years || years.length === 0) return null;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium ${
        isCurrentView ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-amber-50 border-amber-200 text-amber-700"
      }`}
      title={isCurrentView ? "Viewing the active academic year" : "Viewing an archived academic year — read-only"}
    >
      <CalendarRange size={14} className="shrink-0" />
      <span className="text-slate-400 shrink-0">Viewing:</span>
      <select
        value={viewingYearId || ""}
        onChange={(e) => setViewingYearId(Number(e.target.value))}
        className="flex-1 min-w-0 bg-transparent outline-none cursor-pointer truncate"
      >
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
            {y.isCurrent ? " (Active)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
