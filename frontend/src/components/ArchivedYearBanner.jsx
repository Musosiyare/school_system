import { Lock } from "lucide-react";
import { useYear } from "../context/YearContext";

// Drop this at the top of any manager page that shows year-scoped data
// (Classes, Students, Reports, Statistics, Dashboard). Renders nothing when
// viewing the current year, so pages don't need their own conditional.
export default function ArchivedYearBanner() {
  const { viewingYear, isCurrentView } = useYear();
  if (isCurrentView || !viewingYear) return null;

  return (
    <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <Lock size={16} className="shrink-0" />
      <span>
        Viewing <strong>{viewingYear.name}</strong> — this is an archived academic year, not the active one.
        Everything here is read-only. Use the year switcher in the header to jump back to the active year.
      </span>
    </div>
  );
}
