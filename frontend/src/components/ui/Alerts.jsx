import { AlertCircle, CheckCircle2 } from "lucide-react";

export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p className="flex items-center gap-1.5 text-sm text-red-600">
      <AlertCircle size={15} className="shrink-0" /> {children}
    </p>
  );
}

export function SuccessText({ children }) {
  if (!children) return null;
  return (
    <p className="flex items-center gap-1.5 text-sm text-emerald-600">
      <CheckCircle2 size={15} className="shrink-0" /> {children}
    </p>
  );
}
