import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ErrorText } from "../components/ui/Alerts";
import Button from "../components/ui/Button";
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
  ShieldCheck,
  FileText,
  Users,
  User,
} from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await login(email, password);
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

  const steps = [
    { icon: ClipboardCheck, title: "Record", text: "Enter marks by module, class and term" },
    { icon: BarChart3, title: "Calculate", text: "Weighted averages and class rankings, done for you" },
    { icon: GraduationCap, title: "Report", text: "Polished report cards, ready to print or download" },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left brand panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 text-white overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400">
        {/* Decorative glow shapes */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur ring-1 ring-white/20">
            <School size={20} />
          </div>
          <span className="font-semibold text-lg tracking-tight">Mid-Term Reporting</span>
        </div>

        <div className="relative flex flex-col gap-10 xl:grid xl:grid-cols-2 xl:items-center">
          <div>
            <span className="inline-block text-xs font-medium tracking-wide uppercase text-brand-100/90 bg-white/10 px-3 py-1 rounded-full mb-5 ring-1 ring-white/15">
              Built for schools
            </span>
            <h2 className="text-3xl font-bold leading-tight">
              Report cards your whole school can trust.
            </h2>
            <p className="text-brand-100 mt-3 text-sm leading-relaxed">
              One place for academic years, classes, modules, marks, and the report cards they
              produce.
            </p>

            {/* Step timeline — this genuinely is the sequence: enter marks,
                then the system computes averages/ranks, then reports come
                out the other end. */}
            <ul className="mt-8 relative">
              <div className="absolute left-[18px] top-2 bottom-2 w-px bg-white/15" />
              {steps.map((s, i) => (
                <li key={s.title} className="relative flex gap-3.5 pb-6 last:pb-0">
                  <div className="relative h-9 w-9 shrink-0 rounded-full bg-white/15 flex items-center justify-center ring-1 ring-white/20 text-xs font-bold">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="pt-1">
                    <p className="font-semibold text-sm text-white">{s.title}</p>
                    <p className="text-brand-100 text-xs mt-0.5 leading-relaxed">{s.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Signature visual: a floating mock report card, echoing the
              navy/gold letterhead used on real generated reports. */}
          <div className="relative h-72">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-56 rotate-[4deg] rounded-xl bg-white text-slate-700 shadow-2xl shadow-black/30 overflow-hidden ring-1 ring-black/5">
                <div className="bg-brand-600 px-4 py-3 flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-amber-400/90 flex items-center justify-center shrink-0">
                    <School size={13} className="text-brand-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-white leading-tight">Class 6A</p>
                    <p className="text-[9px] text-brand-100 leading-tight">Term 2 Report</p>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {[
                    { m: "Mathematics", pct: 88, tone: "bg-emerald-500" },
                    { m: "Kinyarwanda", pct: 74, tone: "bg-teal-500" },
                    { m: "General Studies", pct: 46, tone: "bg-amber-500" },
                  ].map((row) => (
                    <div key={row.m}>
                      <div className="flex items-center justify-between text-[9.5px] text-slate-500 mb-0.5">
                        <span className="truncate">{row.m}</span>
                        <span className="font-semibold text-slate-700 tabular-nums">{row.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full ${row.tone}`} style={{ width: `${row.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-between">
                  <span className="text-[9px] text-slate-400">Overall</span>
                  <span className="text-[11px] font-bold text-brand-600">76.2%</span>
                </div>
              </div>
              {/* A smaller card peeking behind, for depth */}
              <div className="absolute w-56 h-64 -rotate-[8deg] translate-x-6 translate-y-4 rounded-xl bg-white/10 ring-1 ring-white/10 -z-10" />
            </div>
          </div>
        </div>

        <p className="relative text-xs text-brand-200">
          © {new Date().getFullYear()} Mid-Term Reporting System
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 relative flex items-center justify-center px-4 py-12 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(43,58,103,0.06), transparent 45%), radial-gradient(circle at 85% 80%, rgba(13,148,136,0.06), transparent 45%)",
          }}
        />
        <div className="relative w-full max-w-sm">
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center mb-3 shadow-lg shadow-brand-500/25">
              <School size={26} className="text-white" />
            </div>
            <h1 className="text-lg font-semibold text-slate-800">Mid-Term Reporting System</h1>
          </div>

          {/* Compact feature strip — the left panel's marketing content is
              hidden below lg, so small screens get a condensed version here
              instead of losing it entirely. */}
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

          <div className="mb-7 hidden lg:block">
            <div className="flex items-center gap-3.5">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/25 shrink-0">
                <User size={28} strokeWidth={2} />
              </div>
              <h1 className="font-display text-4xl font-bold text-brand-600 tracking-tight">
                Welcome back
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-2">Sign in to your account to continue</p>
          </div>

          <form
            noValidate
            onSubmit={handleSubmit}
            className="relative bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 p-7 space-y-5 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-600 via-brand-400 to-teal-500" />
            <GraduationCap
              size={140}
              className="pointer-events-none absolute -right-6 -bottom-8 text-slate-50"
              strokeWidth={1}
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  required
                  autoFocus
                  className="form-field w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2.5 text-sm text-slate-800
                    placeholder:text-slate-400 outline-none transition
                    focus:border-black focus:ring-0 shadow-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="form-field w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-800
                    placeholder:text-slate-400 outline-none transition
                    focus:border-black focus:ring-0 shadow-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <ErrorText>{error}</ErrorText>

            <Button type="submit" disabled={submitting} className="w-full group" size="lg">
              {submitting ? (
                "Signing in..."
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>
          <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-5">
            <ShieldCheck size={13} className="text-slate-300" />
            Your school's data stays private to your school
          </p>
          <p className="text-xs text-center text-slate-400 mt-1.5">
            Forgot your password? Contact your school manager to have it reset.
          </p>
        </div>
      </div>
    </div>
  );
}
