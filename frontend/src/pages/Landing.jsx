import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  School,
  ArrowRight,
  CalendarRange,
  Layers,
  BookOpen,
  Users,
  GraduationCap,
  ClipboardList,
  FileText,
  ShieldCheck,
  ClipboardCheck,
  BarChart3,
  Menu,
  X,
  Lock,
  Scale,
  Award,
} from "lucide-react";

function homeRoute(user) {
  if (!user) return "/login";
  if (user.mustChangePassword) return "/change-password";
  if (user.role === "superuser") return "/superuser";
  if (user.role === "manager") return "/manager";
  return "/teacher";
}

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#roles", label: "Who it's for" },
];

const FEATURES = [
  {
    icon: CalendarRange,
    title: "Academic years & terms",
    text: "Create a year and its three terms are set up automatically. Lock a term once it's final so marks can't quietly change after report cards go out.",
  },
  {
    icon: Layers,
    title: "Classes & modules",
    text: "Assign modules to a class with a checkbox, set a class teacher, and reuse the same module catalog across every class it applies to.",
  },
  {
    icon: Scale,
    title: "Marks that weigh fairly",
    text: "One module out of 50, another out of 100 — scores are normalized before they're weighted, so the overall average is never skewed by how a test happened to be scored.",
  },
  {
    icon: FileText,
    title: "Report cards, ready to print",
    text: "Individual or full-class PDFs with pass/fail colour-coding, a class rank, your school's letterhead, and the class teacher's remarks.",
  },
];

const STEPS = [
  {
    icon: ClipboardCheck,
    title: "Record",
    text: "Teachers enter scores for their own modules and classes only — nothing they aren't assigned to shows up.",
  },
  {
    icon: BarChart3,
    title: "Calculate",
    text: "Weighted averages, pass/fail per module, and class ranking are computed the moment marks are saved.",
  },
  {
    icon: GraduationCap,
    title: "Report",
    text: "A polished report card is ready to download or print — for one student, or the whole class at once.",
  },
];

const ROLES = [
  {
    icon: School,
    tone: "teal",
    title: "Superuser",
    text: "Onboards new schools. Each one gets its own manager account and its own fully separated data.",
  },
  {
    icon: Users,
    tone: "ink",
    title: "Manager",
    text: "Sets up years, classes, modules, teachers and students, then reviews reports and rankings for the whole school.",
  },
  {
    icon: GraduationCap,
    tone: "orange",
    title: "Teacher",
    text: "Opens straight to their own assigned modules and classes, records marks, and downloads their own reports.",
  },
];

export default function Landing() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Signed-in visitors don't need the pitch — send them straight to their dashboard.
  if (user) return <Navigate to={homeRoute(user)} replace />;

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* ---------------------------------------------------------------- Nav */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
              <School size={17} className="text-teal-400" />
            </div>
            <span className="font-semibold tracking-tight">Mid-Term Reporting</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-teal-600 transition-colors"
            >
              Sign in <ArrowRight size={15} />
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden text-slate-700"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-slate-100 px-4 py-4 space-y-3 bg-white">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/login"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 text-white px-4 py-2.5 text-sm font-medium"
            >
              Sign in <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </header>

      {/* --------------------------------------------------------------- Hero */}
      <section className="relative bg-slate-950 text-white overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="pointer-events-none absolute -top-32 -left-20 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="landing-fade-up inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-teal-300 bg-teal-400/10 px-3 py-1 rounded-full ring-1 ring-teal-400/20">
              Built for one school at a time
            </span>
            <h1
              className="landing-fade-up font-display text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight mt-5"
              style={{ animationDelay: "80ms" }}
            >
              Marks in.{" "}
              <span className="text-teal-400">Ranked report cards</span> out.
            </h1>
            <p
              className="landing-fade-up text-slate-300 text-base sm:text-lg mt-5 max-w-lg leading-relaxed"
              style={{ animationDelay: "160ms" }}
            >
              One place for academic years, classes, modules and marks — and
              the report cards they produce. Built for the way a real school
              term actually runs, term locks included.
            </p>
            <div
              className="landing-fade-up flex flex-wrap items-center gap-3 mt-8"
              style={{ animationDelay: "240ms" }}
            >
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-500 text-slate-950 px-5 py-3 text-sm font-semibold hover:bg-teal-400 transition-colors"
              >
                Sign in to your school <ArrowRight size={16} />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
              >
                See how it works
              </a>
            </div>
            <p
              className="landing-fade-up flex items-center gap-1.5 text-xs text-slate-400 mt-8"
              style={{ animationDelay: "300ms" }}
            >
              <ShieldCheck size={13} className="text-slate-500" />
              Every school's data stays private to that school.
            </p>
          </div>

          {/* Signature visual: a report card ledger, the actual artifact this
              product exists to produce — with the one orange mark on the page,
              the way a teacher's pen would land on the final grade. */}
          <div
            className="landing-fade-up relative h-[380px] sm:h-[420px]"
            style={{ animationDelay: "200ms" }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute w-72 h-80 -rotate-[7deg] translate-x-5 translate-y-6 rounded-2xl bg-white/[0.04] ring-1 ring-white/10" />
              <div className="relative w-72 rotate-[3deg] rounded-2xl bg-white text-slate-700 shadow-2xl shadow-black/40 overflow-hidden ring-1 ring-black/5">
                <div className="bg-slate-900 px-5 py-4 flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-teal-400 flex items-center justify-center shrink-0">
                    <School size={16} className="text-slate-900" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-white leading-tight">
                      Class 6A — Term 2
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight">Report Card</p>
                  </div>
                </div>
                <div className="p-4 space-y-2.5 font-mono">
                  {[
                    { m: "Mathematics", pct: 88 },
                    { m: "Kinyarwanda", pct: 74 },
                    { m: "General Studies", pct: 61 },
                  ].map((row) => (
                    <div key={row.m}>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span className="font-sans truncate">{row.m}</span>
                        <span className="font-semibold text-slate-700 tabular-nums">
                          {row.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-teal-500"
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-sans">Overall</span>
                  <span className="text-[13px] font-bold text-slate-800 tabular-nums">74.3%</span>
                </div>
                {/* the one orange accessory */}
                <div className="absolute -right-3 -top-3 h-14 w-14 rounded-full bg-orange-500 rotate-[-9deg] flex flex-col items-center justify-center shadow-lg shadow-orange-500/30 ring-4 ring-white">
                  <Award size={14} className="text-white" />
                  <span className="text-[9px] font-bold text-white leading-none mt-0.5">
                    RANK 2
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- What changes */}
      <section className="bg-slate-50 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
            {[
              {
                before: "Marks scattered across teachers' notebooks and spreadsheets",
                after: "One record per class, visible to the manager at any time",
              },
              {
                before: "Averages worked out by hand across differently-scored tests",
                after: "Normalized and weighted automatically, every time",
              },
              {
                before: "Report cards typed up fresh each term",
                after: "Generated as a PDF, with rank and remarks, in one click",
              },
            ].map((row) => (
              <div key={row.after}>
                <p className="text-sm text-slate-400 line-through decoration-slate-300">
                  {row.before}
                </p>
                <p className="text-sm sm:text-[15px] font-medium text-slate-800 mt-2 flex gap-2">
                  <ArrowRight size={16} className="text-orange-500 shrink-0 mt-0.5" />
                  {row.after}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-xl">
          <span className="text-xs font-semibold tracking-wide uppercase text-teal-600">
            The sequence
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mt-3">
            Three steps, in this order
          </h2>
          <p className="text-slate-500 mt-3">
            It's the same path every term takes, from a blank markbook to a
            report card in a parent's hand.
          </p>
        </div>

        <div className="relative mt-12 grid sm:grid-cols-3 gap-8">
          <div className="hidden sm:block absolute top-6 left-[16.5%] right-[16.5%] h-px bg-slate-200" />
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative">
              <div className="flex items-center gap-3">
                <div className="relative z-10 h-12 w-12 rounded-full bg-white ring-2 ring-slate-900 flex items-center justify-center text-sm font-bold text-slate-900">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <s.icon size={20} className="text-teal-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mt-4">{s.title}</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ Features */}
      <section id="features" className="bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <div className="max-w-xl">
            <span className="text-xs font-semibold tracking-wide uppercase text-teal-300">
              What's in the dashboard
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-3">
              Everything a term needs, nothing it doesn't
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 mt-12">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.06] hover:border-white/20 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-teal-400/10 ring-1 ring-teal-400/20 flex items-center justify-center">
                  <f.icon size={19} className="text-teal-300" />
                </div>
                <h3 className="font-semibold mt-4">{f.title}</h3>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- Roles */}
      <section id="roles" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-xl">
          <span className="text-xs font-semibold tracking-wide uppercase text-orange-600">
            Who it's for
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mt-3">
            Three roles, one dashboard each
          </h2>
          <p className="text-slate-500 mt-3">
            Everyone signs in the same way — what they see next depends on
            who they are.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 mt-12">
          {ROLES.map((r) => (
            <div
              key={r.title}
              className="rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:shadow-slate-200/60 hover:-translate-y-0.5 transition"
            >
              <div
                className={`h-11 w-11 rounded-xl flex items-center justify-center ring-1
                  ${
                    r.tone === "teal"
                      ? "bg-teal-50 ring-teal-100 text-teal-600"
                      : r.tone === "orange"
                      ? "bg-orange-50 ring-orange-100 text-orange-600"
                      : "bg-slate-900 ring-slate-900 text-white"
                  }`}
              >
                <r.icon size={20} />
              </div>
              <h3 className="font-semibold text-slate-900 mt-4">{r.title}</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------------- CTA */}
      <section className="bg-orange-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Your school, your data, one sign-in away.
            </h2>
            <p className="text-orange-50 mt-2 text-sm">
              Ask your school manager for an account if you don't have one yet.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 text-white px-6 py-3 text-sm font-semibold hover:bg-slate-800 transition-colors shrink-0"
          >
            Sign in <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* -------------------------------------------------------------- Footer */}
      <footer className="bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-slate-900 flex items-center justify-center">
              <School size={13} className="text-teal-400" />
            </div>
            <span className="text-sm font-medium text-slate-600">Mid-Term Reporting System</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Lock size={12} />
            © {new Date().getFullYear()} · Every school's data stays private to that school
          </div>
        </div>
      </footer>
    </div>
  );
}
