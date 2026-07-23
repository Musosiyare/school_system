import { Wrench, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useMaintenance } from "../context/MaintenanceContext";

// Shown in place of the whole app for managers/teachers while maintenance
// mode is on. Superusers never see this — they're the ones who'd need to get
// in to turn it back off.
export default function MaintenanceScreen() {
  const { title, message, updatedAt } = useMaintenance();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 overflow-hidden">
      {/* Decorative background — same language as the login screen's brand panel */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur border border-white/60 rounded-3xl shadow-2xl shadow-brand-900/20 p-7 sm:p-9 text-center">
          <div className="relative mx-auto mb-6 h-20 w-20">
            {/* Soft pulsing ring behind the icon — signals "actively working on it" without a spinner */}
            <span className="absolute inset-0 rounded-2xl bg-amber-400/40 animate-ping" style={{ animationDuration: "2.5s" }} />
            <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Wrench size={30} />
            </div>
          </div>

          <span className="inline-block text-[11px] font-semibold tracking-[0.15em] uppercase text-amber-700 bg-amber-50 px-3 py-1 rounded-full mb-4 ring-1 ring-amber-200">
            Under Maintenance
          </span>

          <h1 className="text-2xl font-bold text-slate-800 mb-2.5 tracking-tight">
            {title || "We'll be right back"}
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line max-w-sm mx-auto px-4">
            {message ||
              "The system is currently undergoing scheduled maintenance. Please check back shortly."}
          </p>

          {updatedAt && (
            <p className="mt-4 text-xs text-slate-400">
              Since{" "}
              {new Date(updatedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}

          {/* Live status — reinforces that this page is watching for the moment
              maintenance ends on its own, without asking for a manual reload. */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Checking automatically — this page will update itself
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 px-4 py-2 text-xs font-medium hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <RefreshCw size={13} />
              Refresh now
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 px-4 py-2 text-xs font-medium hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <LogOut size={13} />
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
