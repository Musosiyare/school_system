import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Layers, ChevronDown, Search, Check, LayoutGrid } from "lucide-react";

// Deterministic accent per class name, so each class reads as a distinct
// "chip" in the list rather than a wall of identical rows — same idea as
// the name-hash avatar colors used in MarksEntry.
const ACCENTS = [
  "from-teal-400 to-teal-600",
  "from-violet-400 to-violet-600",
  "from-blue-400 to-blue-600",
  "from-amber-400 to-amber-600",
  "from-rose-400 to-rose-600",
  "from-emerald-400 to-emerald-600",
  "from-sky-400 to-sky-600",
  "from-fuchsia-400 to-fuchsia-600",
];
function accentFor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

/**
 * A polished, searchable dropdown for picking a class out of a (potentially
 * long) list — replaces the old row-of-pill-buttons pattern, which stopped
 * scaling once a school has more than a handful of classes.
 *
 * value: "all" | classId (string) — "all" only meaningful when includeAll
 * onChange(value: string)
 */
export default function ClassDropdown({
  classes = [],
  value,
  onChange,
  includeAll = true,
  allLabel = "All classes",
  placeholder = "Select class",
  label,
  className = "",
  fullWidth = false,
  variant = "default", // "default" (white trigger) | "light" (for dark/colored backgrounds)
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState(null); // { top, left, width } in viewport coords, or null
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target) &&
        panelRef.current &&
        !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (open) {
      setQuery("");
      // let the panel mount before focusing
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  // The trigger button can sit inside a scrollable container (most notably a
  // Modal's body, which has overflow-auto). An `absolute`-positioned panel
  // there gets clipped by that container instead of floating over it, which
  // visually reads as the dropdown "collapsing" and forces the modal itself
  // to scroll just to see the options. Rendering the panel into a portal at
  // document.body, positioned with `fixed` coordinates taken from the
  // trigger's own bounding rect, escapes that clipping entirely.
  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    function updateCoords() {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    }
    updateCoords();
    // `capture: true` so this also fires for scrolling inside a nested
    // scrollable ancestor (like the Modal body), not just the window.
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [open]);

  function handleKeyDown(e) {
    if (e.key === "Escape") setOpen(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => c.name.toLowerCase().includes(q));
  }, [classes, query]);

  const isAllSelected = includeAll && (value === "all" || !value);
  const selectedClass = classes.find((c) => String(c.id) === String(value));
  const selectedLabel = isAllSelected ? allLabel : selectedClass?.name || placeholder;
  const isLight = variant === "light";

  function pick(v) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className={`relative ${fullWidth ? "block w-full" : "inline-block"} text-left ${className}`} ref={wrapRef} onKeyDown={handleKeyDown}>
      {label && (
        <span className={`flex items-center gap-1.5 text-sm font-medium mb-1.5 ${isLight ? "text-white/80" : "text-slate-400 text-xs uppercase tracking-wide"}`}>
          <Layers size={13} /> {label}
        </span>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`group flex items-center gap-2.5 rounded-xl border pl-2 pr-3 py-2 text-sm transition-all ${
          fullWidth ? "w-full" : ""
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${
          isLight
            ? `bg-white/10 backdrop-blur-sm ${open ? "border-white/40 bg-white/15" : "border-white/20 hover:bg-white/15"}`
            : `bg-white shadow-sm ${open ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200 hover:border-brand-300 hover:shadow-md"}`
        }`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm ${
            isAllSelected ? "from-brand-500 to-brand-700" : accentFor(selectedClass?.name)
          }`}
        >
          {isAllSelected ? <LayoutGrid size={14} /> : <Layers size={14} />}
        </span>
        <span
          className={`flex-1 text-left font-medium truncate ${fullWidth ? "" : "max-w-[9rem]"} ${
            isLight ? "text-white" : selectedClass || isAllSelected ? "text-slate-800" : "text-slate-400"
          }`}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 transition-transform ${
            isLight ? "text-white/60" : "text-slate-400"
          } ${open ? `rotate-180 ${isLight ? "text-white" : "text-brand-500"}` : ""}`}
        />
      </button>

      {open && coords &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: fullWidth ? coords.width : undefined,
            }}
            className={`z-[60] ${fullWidth ? "" : "w-72"} max-w-[85vw] rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 overflow-hidden dropdown-pop`}
          >
          {classes.length > 6 && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/60">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search classes…"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto py-1.5">
            {includeAll && (
              <button
                type="button"
                onClick={() => pick("all")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                  isAllSelected ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                  <LayoutGrid size={12} />
                </span>
                <span className="flex-1 truncate font-medium">{allLabel}</span>
                {isAllSelected && <Check size={15} className="text-brand-600 shrink-0" />}
              </button>
            )}

            {includeAll && filtered.length > 0 && <div className="my-1 border-t border-slate-100" />}

            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-400">No classes found.</p>
            ) : (
              filtered.map((c) => {
                const selected = !isAllSelected && String(c.id) === String(value);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick(String(c.id))}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                      selected ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white ${accentFor(c.name)}`}>
                      <Layers size={12} />
                    </span>
                    <span className="flex-1 truncate font-medium">{c.name}</span>
                    {selected && <Check size={15} className="text-brand-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
          </div>,
          document.body
        )}
    </div>
  );
}
