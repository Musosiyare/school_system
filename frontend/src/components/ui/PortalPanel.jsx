import { forwardRef } from "react";
import { Search, ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Dark navy "client portal" style panel for data tables — modeled on the
 * invoice-list look (title + search up top, a colored "View" filter pill,
 * a dark table, and a Show-N-entries / Previous-1-Next footer). Used by
 * Students.jsx and Teachers.jsx so both browse screens share one consistent
 * look instead of the light Card/Table used elsewhere in the app.
 */
export default function PortalPanel({
  title,
  breadcrumb,
  headerExtra,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  viewValue,
  onViewChange,
  viewOptions,
  barActions,
  page,
  totalPages,
  onPageChange,
  total,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50],
  children,
}) {
  const pages = [];
  if (totalPages > 0) {
    const windowSize = 1;
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - page) <= windowSize) {
        pages.push(p);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-brand-700 shadow-xl mb-6">
      {/* Header: title/breadcrumb + search */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 sm:px-6 pt-6 pb-5 border-b border-white/10">
        <div className="min-w-0">
          {breadcrumb && (
            <p className="mb-1 text-xs text-brand-200">{breadcrumb}</p>
          )}
          <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
          {headerExtra && <div className="mt-2">{headerExtra}</div>}
        </div>
        {onSearchChange && (
          <div className="relative w-full sm:w-72 shrink-0">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-200" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg bg-brand-600/60 border border-white/10 pl-9 pr-3 py-2 text-sm text-white
                placeholder:text-brand-200 focus:border-coral-400 focus:ring-0 outline-none transition"
            />
          </div>
        )}
      </div>

      {/* View filter bar */}
      {(viewOptions || barActions) && (
        <div className="flex flex-wrap items-center gap-3 bg-brand-600/50 px-5 sm:px-6 py-3">
          {viewOptions && (
            <>
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-200">View</span>
              <div className="relative">
                <select
                  value={viewValue}
                  onChange={(e) => onViewChange(e.target.value)}
                  className="appearance-none rounded-full bg-coral-500 hover:bg-coral-600 pl-4 pr-8 py-1.5 text-xs font-semibold
                    text-white cursor-pointer focus:outline-none transition"
                >
                  {viewOptions.map((o) => (
                    <option key={o.value} value={o.value} className="bg-brand-700 text-white">
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white" />
              </div>
            </>
          )}
          {barActions && <div className="ml-auto flex flex-wrap items-center gap-2">{barActions}</div>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>

      {/* Footer: entries-per-page + pagination */}
      {typeof total === "number" && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-brand-200">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-md bg-brand-600 border border-white/10 px-2 py-1 text-xs text-white focus:outline-none"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n} className="bg-brand-700 text-white">
                  {n}
                </option>
              ))}
            </select>
            <span>entries {total > 0 && <span className="text-brand-300">({total} total)</span>}</span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-brand-100
                  hover:bg-brand-500 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft size={13} /> Previous
              </button>
              {pages.map((p, i) =>
                p === "..." ? (
                  <span key={`e-${i}`} className="px-1.5 text-xs text-brand-300">
                    ⋯
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange(p)}
                    className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-xs font-semibold transition ${
                      p === page ? "bg-coral-500 text-white" : "bg-brand-600 text-brand-100 hover:bg-brand-500 hover:text-white"
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
                className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-brand-100
                  hover:bg-brand-500 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PortalThead({ children }) {
  return <thead className="bg-brand-600/70 text-[11px] uppercase tracking-wide text-brand-200">{children}</thead>;
}

export function PortalTh({ children, className = "" }) {
  return <th className={`text-left font-semibold px-4 py-3 whitespace-nowrap ${className}`}>{children}</th>;
}

export function PortalSortableTh({ children, sortKey, sort, onSort, className = "" }) {
  const active = sort?.key === sortKey;
  const Icon = active ? (sort.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th className={`text-left font-semibold px-4 py-3 whitespace-nowrap ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-white transition ${active ? "text-white" : ""}`}
      >
        {children}
        <Icon size={12} className={active ? "text-coral-400" : "text-brand-300"} />
      </button>
    </th>
  );
}

export function PortalTd({ children, className = "" }) {
  return <td className={`px-4 py-3 text-brand-100 border-t border-white/5 ${className}`}>{children}</td>;
}

export const PortalRow = forwardRef(function PortalRow({ children, className = "", ...rest }, ref) {
  return (
    <tr ref={ref} className={`transition hover:bg-white/5 ${className}`} {...rest}>
      {children}
    </tr>
  );
});

export function PortalEmptyRow({ colSpan, children = "Nothing here yet." }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-brand-300 text-sm">
        {children}
      </td>
    </tr>
  );
}
