import { forwardRef } from "react";

export function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const fieldClasses =
  "form-field w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 " +
  "placeholder:text-slate-400 outline-none transition " +
  "focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100";

export const Input = forwardRef(function Input(props, ref) {
  return <input ref={ref} {...props} className={`${fieldClasses} ${props.className || ""}`} />;
});

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

// Icon-prefixed variants — same field styling, with room on the left for a
// lucide icon. Used on forms where a quick visual cue (who/what/contact
// method) helps the field read faster at a glance, e.g. name/email/phone
// triples in creation forms.
export function IconInput({ icon: Icon, className = "", ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      )}
      <input {...props} className={`${fieldClasses} ${Icon ? "pl-9" : ""} ${className}`} />
    </div>
  );
}

export function IconSelect({ icon: Icon, children, className = "", ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
      )}
      <select {...props} className={`${fieldClasses} ${Icon ? "pl-9" : ""} ${className}`}>
        {children}
      </select>
    </div>
  );
}
