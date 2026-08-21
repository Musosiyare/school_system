const VARIANTS = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-400",
  secondary: "bg-white text-brand-500 border border-brand-200 hover:bg-brand-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  teal: "bg-teal-500 text-white hover:bg-teal-600",
  violet: "bg-violet-600 text-white hover:bg-violet-700",
  amber: "bg-amber-500 text-white hover:bg-amber-600",
  // For use on top of dark/navy surfaces (e.g. the brand-colored class
  // picker card), where the default `primary`/`secondary` variants would
  // blend into the background instead of standing out from it.
  light: "bg-white text-brand-600 hover:bg-slate-100 shadow-sm",
  outlineLight: "bg-white/10 text-white border border-white/30 hover:bg-white/20 backdrop-blur-sm",
};

const SIZES = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors whitespace-nowrap
        disabled:opacity-50 disabled:cursor-not-allowed
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
