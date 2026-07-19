import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export function Table({ children }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Thead({ children }) {
  return <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">{children}</thead>;
}

export function Th({ children, className = "" }) {
  return <th className={`text-left font-semibold px-4 py-2.5 ${className}`}>{children}</th>;
}

// Clickable column header for tables that support client-side sorting.
// `sortKey` identifies this column; `sort` is the { key, dir } state from
// useSort; `onSort` toggles it. Shows a neutral both-ways icon until this
// column becomes the active sort, then an up/down arrow for the direction.
export function SortableTh({ children, sortKey, sort, onSort, className = "" }) {
  const active = sort?.key === sortKey;
  const Icon = active ? (sort.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th className={`text-left font-semibold px-4 py-2.5 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-slate-700 transition ${
          active ? "text-slate-700" : ""
        }`}
      >
        {children}
        <Icon size={13} className={active ? "text-slate-600" : "text-slate-300"} />
      </button>
    </th>
  );
}

export function Td({ children, className = "" }) {
  return <td className={`px-4 py-2.5 text-slate-700 border-t border-slate-100 ${className}`}>{children}</td>;
}

export function EmptyRow({ colSpan, children = "Nothing here yet." }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-400 text-sm">
        {children}
      </td>
    </tr>
  );
}
