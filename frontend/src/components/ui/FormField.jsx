export function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const fieldClasses =
  "form-field rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 " +
  "placeholder:text-slate-400 focus:border-black focus:ring-0 outline-none transition shadow-none";

export function Input(props) {
  return <input {...props} className={`${fieldClasses} ${props.className || ""}`} />;
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={`${fieldClasses} ${props.className || ""}`}>
      {children}
    </select>
  );
}

export function Textarea(props) {
  return <textarea {...props} className={`${fieldClasses} ${props.className || ""}`} />;
}
