import { Loader2 } from "lucide-react";

// A small, reusable "waiting for data" indicator: a spinning icon sitting
// inside a soft pulsing ring, plus an optional label underneath. Used
// anywhere the app is fetching data the user is actively waiting on (e.g.
// a report after picking a class/term). Keeps to the existing brand-500
// blue and lucide-react's Loader2 + Tailwind's animate-spin, which are
// already used elsewhere in the app (GlobalSearch, AcademicYears,
// ModuleStatus) — this just gives that same pattern a consistent, nicer
// home instead of a bare spinning icon or "Loading…" text.
export default function Loader({ label = "Loading…", size = "md", className = "" }) {
  const iconSizes = { sm: 18, md: 28, lg: 38 };
  const ringSizes = { sm: 34, md: 52, lg: 70 };
  const iconSize = iconSizes[size] || iconSizes.md;
  const ringSize = ringSizes[size] || ringSizes.md;

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-8 ${className}`}>
      <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
        {/* Soft pulsing halo behind the spinner — gives the loader some
            life instead of a flat spinning glyph on its own. */}
        <span
          className="absolute inline-flex rounded-full bg-brand-200 opacity-60 animate-ping"
          style={{ width: ringSize, height: ringSize }}
        />
        <span
          className="absolute inline-flex rounded-full bg-brand-50"
          style={{ width: ringSize * 0.78, height: ringSize * 0.78 }}
        />
        <Loader2 size={iconSize} className="relative text-brand-500 animate-spin" strokeWidth={2.25} />
      </div>
      {label && <p className="text-sm text-slate-400">{label}</p>}
    </div>
  );
}
