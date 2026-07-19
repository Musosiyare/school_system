const TONES = {
  pass: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  fail: "bg-red-50 text-red-700 ring-1 ring-red-200",
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  superuser: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  manager: "bg-brand-50 text-brand-600 ring-1 ring-brand-200",
  teacher: "bg-brand-50 text-brand-600 ring-1 ring-brand-200",
  teal: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  orange: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
};

export default function Badge({ children, tone = "neutral", className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
