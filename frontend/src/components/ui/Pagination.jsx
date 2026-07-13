import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Prev/next + numbered pagination bar. Shows at most 5 page numbers with the
 * current page centered where possible; collapses distant pages behind an
 * ellipsis rather than listing every single one, since a school importing a
 * full roster can easily have 20+ pages.
 */
export default function Pagination({ page, totalPages, onPageChange, total, pageSize }) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages = [];
  const windowSize = 1;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= windowSize) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-100">
      <p className="text-xs text-slate-400">
        Showing <span className="font-medium text-slate-600">{start}–{end}</span> of{" "}
        <span className="font-medium text-slate-600">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-slate-300">
              ⋯
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-lg text-xs font-medium transition ${
                p === page
                  ? "bg-brand-500 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
