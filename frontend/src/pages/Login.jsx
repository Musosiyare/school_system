import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMaintenance } from "../context/MaintenanceContext";
import { ErrorText, SuccessText } from "../components/ui/Alerts";
import {
  School,
  GraduationCap,
  ClipboardCheck,
  BarChart3,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  FileText,
  Users,
  Wrench,
} from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const { maintenanceMode, title, message, checked } = useMaintenance();
  const navigate = useNavigate();
  const location = useLocation();
  const resetSuccess = Boolean(location.state?.resetSuccess);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The maintenance screen below hides the login form for everyone, since we
  // can't know someone's role until after they authenticate. Superusers are
  // exempt from maintenance mode on the backend (login + every API call).
  // Rather than a visible link (which every visitor would see), this is
  // revealed only via a bookmarkable URL — e.g. /login?admin — so it's not
  // shown or hinted at anywhere on the page itself.
  const [showAdminLogin, setShowAdminLogin] = useState(
    () => new URLSearchParams(window.location.search).has("admin")
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await login(identifier, password);
      if (user.mustChangePassword) {
        navigate("/change-password");
        return;
      }
      if (user.role === "superuser") navigate("/superuser");
      else if (user.role === "manager") navigate("/manager");
      else navigate("/teacher");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Real facts about the system — not invented marketing numbers.
  const stats = [
    { value: "5", label: "User roles" },
    { value: "Auto", label: "Averages & ranks" },
    { value: "PDF", label: "Print-ready reports" },
  ];

  // The actual overall-result bands used on every generated report card.
  const grades = [
    { label: "Excellent", tone: "bg-emerald-400" },
    { label: "Very Good", tone: "bg-teal-400" },
    { label: "Pass", tone: "bg-amber-400" },
    { label: "Fail", tone: "bg-rose-400" },
  ];

  // Maintenance mode is on: show only the message, no login form and no
  // buttons. MaintenanceProvider already polls every 20s, so this clears
  // itself automatically the moment maintenance is switched off.
  if (checked && maintenanceMode && !showAdminLogin) {
    return (
      <div className="min-h-screen relative flex items-center justify-center px-4 py-10 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 overflow-hidden">
        {/* Decorative background — same language as the normal login screen's brand panel */}
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
              <span
                className="absolute inset-0 rounded-2xl bg-amber-400/40 animate-ping"
                style={{ animationDuration: "2.5s" }}
              />
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
            <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line max-w-sm mx-auto">
              {message ||
                "The system is currently undergoing scheduled maintenance. Please check back shortly."}
            </p>

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Checking automatically — this page will update itself
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-brand-700">
      {/* Left brand panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 text-white overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <Link to="/" className="relative flex items-center gap-2.5 w-fit">
          <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur ring-1 ring-white/20">
            <School size={20} />
          </div>
          <span className="font-semibold text-lg tracking-tight">Mid-Term Reporting System</span>
        </Link>

        <div className="relative">
          <span className="inline-block text-[11px] font-semibold tracking-[0.15em] uppercase text-brand-100/90 bg-white/10 px-3 py-1 rounded-full mb-5 ring-1 ring-white/15">
            Built for TVET Schools
          </span>
          {/* The headline states the real workflow — record, then rank,
              then report — so it does the job a separate step list would,
              without repeating itself underneath. */}
          <h2 className="font-black text-5xl leading-[1.05] tracking-tight">
            <span className="text-white">Record Marks.</span>
            <br />
            <span className="text-teal-300">Rank Classes.</span>
            <br />
            <span className="text-brand-200">Print Reports.</span>
          </h2>
          <p className="text-brand-100 mt-5 text-sm leading-relaxed max-w-sm">
            One place for academic years, classes, modules and marks — and the report cards they
            produce, ready to print or download.
          </p>

          <div className="mt-12 flex items-center gap-10">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-black text-3xl text-white leading-none">{s.value}</p>
                <p className="text-brand-200 text-xs mt-1.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Grading legend — the actual four overall-result bands used on
            every report card, standing in for a generic footer tagline. */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            {grades.map((g) => (
              <span key={g.label} className="flex items-center gap-1.5 text-[11px] text-brand-100">
                <span className={`h-2 w-2 rounded-full ${g.tone}`} />
                {g.label}
              </span>
            ))}
          </div>
          <p className="text-xs text-brand-200">© {new Date().getFullYear()}</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 relative flex items-center justify-center px-4 py-12 overflow-hidden bg-slate-50">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 15%, rgba(43,58,103,0.06), transparent 45%), radial-gradient(circle at 85% 85%, rgba(13,148,136,0.07), transparent 45%)",
          }}
        />
        <div className="relative w-full max-w-sm">
          <Link to="/" className="flex flex-col items-center mb-6 lg:hidden">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center mb-3 shadow-lg shadow-brand-500/25">
              <School size={26} className="text-white" />
            </div>
            <h1 className="text-lg font-semibold text-slate-800">Mid-Term Reporting System</h1>
          </Link>

          {/* Compact feature strip for small screens, standing in for the
              hidden left panel's marketing content. */}
          <div className="flex items-center justify-center gap-5 mb-7 lg:hidden">
            {[
              { icon: Users, label: "Students" },
              { icon: BarChart3, label: "Marks" },
              { icon: FileText, label: "Reports" },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-1">
                <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center ring-1 ring-brand-100">
                  <f.icon size={16} />
                </div>
                <span className="text-[11px] text-slate-400 font-medium">{f.label}</span>
              </div>
            ))}
          </div>

          {/* Floating card */}
          <div className="relative bg-white rounded-[28px] shadow-[0_30px_70px_-20px_rgba(43,58,103,0.35)] px-8 pt-9 pb-8">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center ring-1 ring-brand-100">
                  <GraduationCap size={20} className="text-brand-600" />
                </div>
                <div className="h-12 w-12 rounded-2xl bg-teal-50 flex items-center justify-center ring-1 ring-teal-100">
                  <ClipboardCheck size={20} className="text-teal-600" />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-brand-600 to-teal-600 px-3 py-1 rounded-full">
                  <Lock size={10} /> Secure sign in
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                  5 roles supported
                </span>
              </div>

              <h1 className="font-black text-[26px] text-slate-900 tracking-tight">Welcome back</h1>
              <p className="text-sm text-slate-500 mt-1.5">
                Sign in to your <span className="font-semibold text-slate-700">Mid-Term Reporting System</span> account
              </p>

              {/* Grade-band divider — the same legend from the left panel,
                  repurposed here as a small, meaningful rule instead of a
                  decorative progress dot. */}
              <div className="flex items-center gap-2.5 mt-5">
                {grades.map((g) => (
                  <span key={g.label} className={`h-1.5 w-1.5 rounded-full ${g.tone}`} title={g.label} />
                ))}
              </div>
            </div>

            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              <SuccessText>{resetSuccess ? "Password updated. Please sign in." : null}</SuccessText>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wide uppercase text-slate-500">
                  Email or Phone
                </label>
                <div className="relative">
                  <Mail
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400"
                  />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@school.edu or 07xxxxxxxx"
                    autoComplete="username"
                    required
                    autoFocus
                    className="form-field w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 py-3 text-sm text-slate-800
                      placeholder:text-slate-400 outline-none transition
                      focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wide uppercase text-slate-500">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="form-field w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-10 py-3 text-sm text-slate-800
                      placeholder:text-slate-400 outline-none transition
                      focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <ErrorText>{error}</ErrorText>

              <button
                type="submit"
                disabled={submitting}
                className="group w-full inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white text-sm py-3.5 mt-2
                  bg-gradient-to-r from-brand-600 to-teal-600 shadow-lg shadow-brand-500/25
                  hover:from-brand-500 hover:to-teal-500 transition
                  disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  "Signing in..."
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              <Link
                to="/forgot-password"
                className="block text-center text-xs font-semibold text-brand-600 hover:text-brand-700 transition"
              >
                Forgot super admin password?
              </Link>
            </form>

            <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-6">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Secure connection · Your school's data stays private
            </p>
          </div>

          <p className="text-xs text-center text-slate-400 mt-4">
            Teacher or manager account? Contact your school administrator to have it reset.
          </p>
          <Link
            to="/"
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-brand-600 transition mt-3"
          >
            <ArrowRight size={13} className="rotate-180" /> Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
