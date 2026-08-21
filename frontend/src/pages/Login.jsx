import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMaintenance } from "../context/MaintenanceContext";
import { Field, Input } from "../components/ui/FormField";
import Button from "../components/ui/Button";
import { ErrorText, SuccessText } from "../components/ui/Alerts";
import { School, Eye, EyeOff, Wrench } from "lucide-react";

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

    const trimmedIdentifier = identifier.trim();

    // Custom validation, not the browser's — matches the same pattern used
    // on SBMS's login, so a person sees a plain sentence in place instead
    // of a native "please fill out this field" popup.
    if (!trimmedIdentifier && !password) {
      setError("Email/phone and password are required.");
      return;
    }
    if (!trimmedIdentifier) {
      setError("Please enter your email or phone number.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(trimmedIdentifier, password);
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
    <div className="min-h-screen flex bg-white">
      {/* Identity panel — the system's own brand navy, same layout language
          as SBMS's login (icon + wordmark top, headline mid, copyright
          bottom), but kept in this system's own color so the two sibling
          apps still read as visually distinct at a glance. */}
      <div className="relative hidden md:flex md:w-[42%] lg:w-[38%] flex-col justify-between overflow-hidden bg-gradient-to-b from-brand-700 via-brand-600 to-brand-500 px-12 py-12 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <Link to="/" className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white shadow-sm backdrop-blur">
            <School size={19} />
          </div>
          <div className="leading-tight">
            <p className="font-display text-2xl font-extrabold leading-none tracking-tight text-white">
              Mid-Term Reporting
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-brand-100/70">
              Academics · Reporting
            </p>
          </div>
        </Link>

        <div className="relative max-w-sm">
          <h1 className="font-display text-4xl font-extrabold leading-[1.15] text-white lg:text-[2.75rem]">
            Record marks.
            <br />
            Print reports.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-brand-100/80">
            One place for academic years, classes, modules and marks — and
            the report cards they produce, ready to print or download.
          </p>
          <div className="mt-6 flex items-center gap-4">
            {grades.map((g) => (
              <span key={g.label} className="flex items-center gap-1.5 text-[11px] text-brand-100/80">
                <span className={`h-2 w-2 rounded-full ${g.tone}`} />
                {g.label}
              </span>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-brand-100/60">
          &copy; {new Date().getFullYear()} Mid-Term Reporting System · Built for TVET Schools
        </p>
      </div>

      {/* Form side */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* mobile-only identity, since the brand panel is hidden below md */}
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
              <School size={20} />
            </div>
            <div className="leading-tight">
              <p className="font-display text-lg font-extrabold text-slate-800">Mid-Term Reporting</p>
              <p className="text-xs text-slate-500">Mid-Term Reporting System</p>
            </div>
          </div>

          <h2 className="font-display text-3xl font-extrabold text-slate-900">Sign in</h2>
          <p className="mt-2 text-sm text-slate-500">Enter your credentials to open your dashboard.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
            <SuccessText>{resetSuccess ? "Password updated. Please sign in." : null}</SuccessText>

            <Field label="Email or Phone">
              <Input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@school.edu or 07xxxxxxxx"
                autoComplete="username"
                autoFocus
              />
            </Field>

            <Field
              label={
                <span className="flex items-center justify-between">
                  <span>Password</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-brand-600"
                  >
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
              }
            >
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Field>

            <ErrorText>{error}</ErrorText>

            <Button type="submit" disabled={submitting} className="mt-1 w-full" size="lg" variant="primary">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>

            <Link
              to="/forgot-password"
              className="block text-center text-xs font-semibold text-brand-600 hover:text-brand-700 transition"
            >
              Forgot password?
            </Link>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
            Teacher or manager account? Contact your school administrator to have it reset.
          </p>
        </div>
      </div>
    </div>
  );
}
