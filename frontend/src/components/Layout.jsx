import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useMaintenance } from "../context/MaintenanceContext";
import { useConfirm } from "./ui/ConfirmProvider";
import NotificationBell from "./NotificationBell";
import YearSwitcher from "./YearSwitcher";
import GlobalSearch from "./GlobalSearch";
import MaintenanceScreen from "./MaintenanceScreen";
import MaintenanceBanner from "./MaintenanceBanner";
import {
  School,
  LayoutDashboard,
  CalendarRange,
  Layers,
  BookOpen,
  Users,
  GraduationCap,
  ClipboardList,
  PencilLine,
  FileText,
  BarChart3,
  BellRing,
  UserCog,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
  History,
  CalendarClock,
  SlidersHorizontal,
  ShieldAlert,
  ChevronDown,
} from "lucide-react";

const ROLE_META = {
  superuser: { label: "Superuser", accent: "bg-violet-600", text: "text-violet-600", ring: "ring-violet-200", tint: "bg-violet-50 border-violet-100", hover: "hover:bg-violet-100/70" },
  manager: { label: "Manager", accent: "bg-brand-500", text: "text-brand-500", ring: "ring-brand-200", tint: "bg-brand-50 border-brand-100", hover: "hover:bg-brand-100/70" },
  // Same palette as manager — teacher used to have its own teal theme, but
  // the design is meant to be identical across roles (only the nav items
  // and page content differ).
  teacher: { label: "Teacher", accent: "bg-brand-500", text: "text-brand-500", ring: "ring-brand-200", tint: "bg-brand-50 border-brand-100", hover: "hover:bg-brand-100/70" },
};

// Each role's nav is a mix of standalone links and groups. A group shows as
// one row (icon + label + chevron); hovering or clicking it reveals its
// items. This is what keeps a role with 10+ destinations from turning into
// one long, hard-to-scan list.
const NAV = {
  superuser: [
    { type: "link", to: "/superuser", label: "Schools", icon: School },
    { type: "link", to: "/superuser/activity", label: "Activity", icon: History },
    { type: "link", to: "/superuser/profile", label: "Profile", icon: UserCog },
  ],
  manager: [
    { type: "link", to: "/manager", label: "Dashboard", icon: LayoutDashboard },
    {
      type: "group",
      id: "academics",
      label: "Academics",
      icon: BookOpen,
      accent: "from-blue-400 to-blue-600",
      tint: "bg-blue-50/60 border-blue-100",
      items: [
        { to: "/manager/academic-years", label: "Academic Years", icon: CalendarRange },
        { to: "/manager/classes", label: "Classes", icon: Layers },
        { to: "/manager/modules", label: "Modules", icon: BookOpen },
        { to: "/manager/assignments", label: "Assignments", icon: ClipboardList },
      ],
    },
    {
      type: "group",
      id: "people",
      label: "People",
      icon: Users,
      accent: "from-violet-400 to-violet-600",
      tint: "bg-violet-50/60 border-violet-100",
      items: [
        { to: "/manager/teachers", label: "Teachers", icon: Users },
        { to: "/manager/disciplinary-staff", label: "Disciplinary Staff", icon: ShieldAlert },
        { to: "/manager/students", label: "Students", icon: GraduationCap },
      ],
    },
    {
      type: "group",
      id: "insights",
      label: "Insights",
      icon: BarChart3,
      accent: "from-amber-400 to-amber-600",
      tint: "bg-amber-50/60 border-amber-100",
      items: [
        { to: "/manager/reports", label: "Reports", icon: FileText },
        { to: "/manager/statistics", label: "Statistics", icon: BarChart3 },
        { to: "/manager/activity", label: "Activity", icon: History },
      ],
    },
    { type: "link", to: "/manager/profile", label: "Profile", icon: UserCog },
  ],
  teacher: [
    { type: "link", to: "/teacher", label: "Dashboard", icon: LayoutDashboard },
    {
      type: "group",
      id: "marks",
      label: "Marks",
      icon: PencilLine,
      accent: "from-teal-400 to-teal-600",
      tint: "bg-teal-50/60 border-teal-100",
      items: [
        { to: "/teacher/marks", label: "Record Marks", icon: PencilLine },
        { to: "/teacher/marks-status", label: "Marks Status", icon: BellRing },
        { to: "/teacher/module-status", label: "Module Status", icon: SlidersHorizontal },
      ],
    },
    {
      type: "group",
      id: "reports",
      label: "Reports",
      icon: FileText,
      accent: "from-blue-400 to-blue-600",
      tint: "bg-blue-50/60 border-blue-100",
      items: [
        { to: "/teacher/reports", label: "Reports", icon: FileText },
        { to: "/teacher/statistics", label: "Statistics", icon: BarChart3 },
        { to: "/teacher/past-years", label: "Past Years", icon: CalendarClock },
      ],
    },
    {
      type: "group",
      id: "account",
      label: "Account",
      icon: UserCog,
      accent: "from-violet-400 to-violet-600",
      tint: "bg-violet-50/60 border-violet-100",
      items: [
        { to: "/teacher/activity", label: "Activity", icon: History },
        { to: "/teacher/profile", label: "Profile", icon: UserCog },
      ],
    },
  ],
};

// Drives the top page header: one line, no filler. Titles/subtitles can be a
// plain string or a fn(user) for pages that personalize the greeting.
const PAGE_META = {
  "/superuser": { title: "Schools", subtitle: "Every school on the platform.", icon: School },
  "/superuser/profile": { title: "Profile", subtitle: "Manage your account settings.", icon: UserCog },
  "/superuser/activity": {
    title: "Activity Log",
    subtitle: "A history of actions you've taken in the system.",
    icon: History,
  },
  "/manager": {
    title: (user) => `${greeting()}, ${user.name?.split(" ")[0] || ""}`,
    subtitle: "Here's your school at a glance.",
    icon: LayoutDashboard,
  },
  "/manager/academic-years": {
    title: "Academic Years",
    subtitle: "Each year auto-creates its three terms.",
    icon: CalendarRange,
  },
  "/manager/classes": { title: "Classes", subtitle: "Classes for the year you're viewing.", icon: Layers },
  "/manager/modules": { title: "Modules", subtitle: "Your school's subject catalog.", icon: BookOpen },
  "/manager/teachers": { title: "Teachers", subtitle: "Teacher accounts in your school.", icon: Users },
  "/manager/disciplinary-staff": {
    title: "Disciplinary Staff",
    subtitle: "Dean of Discipline and Disciplinary Officer (patron/matron) accounts for SBMS.",
    icon: ShieldAlert,
  },
  "/manager/students": { title: "Students", subtitle: "Pick a class to manage its students.", icon: GraduationCap },
  "/manager/assignments": {
    title: "Assignments",
    subtitle: "Assign teachers to modules by class.",
    icon: ClipboardList,
  },
  "/manager/reports": { title: "Reports", subtitle: "Class rankings and printable report cards.", icon: FileText },
  "/manager/statistics": {
    title: "Statistics",
    subtitle: "Enrollment, gender split, and top performers at a glance.",
    icon: BarChart3,
  },
  "/manager/profile": { title: "Profile", subtitle: "Your account and school settings.", icon: UserCog },
  "/manager/activity": {
    title: "Activity Log",
    subtitle: "A history of actions you've taken in the system.",
    icon: History,
  },
  "/teacher": {
    title: (user) => `${greeting()}, ${user.name?.split(" ")[0] || ""}`,
    subtitle: "What you're teaching this year.",
    icon: LayoutDashboard,
  },
  "/teacher/marks": { title: "Record Marks", subtitle: "Enter or update scores for your modules.", icon: PencilLine },
  "/teacher/marks-status": {
    title: "Marks Status",
    subtitle: "Who hasn't finished recording marks yet.",
    icon: BellRing,
  },
  "/teacher/module-status": {
    title: "Module Status",
    subtitle: "Switch a module on or off for a specific term.",
    icon: SlidersHorizontal,
  },
  "/teacher/reports": { title: "Reports", subtitle: "Class rankings and report cards.", icon: FileText },
  "/teacher/statistics": { title: "Statistics", subtitle: "Performance for the class you teach.", icon: BarChart3 },
  "/teacher/past-years": {
    title: "Past Years",
    subtitle: "Browse an old academic year — read-only.",
    icon: CalendarClock,
  },
  "/teacher/profile": { title: "Profile", subtitle: "Manage your account settings.", icon: UserCog },
  "/teacher/activity": {
    title: "Activity Log",
    subtitle: "A history of actions you've taken in the system.",
    icon: History,
  },
};

// Good morning / afternoon / evening, based on the viewer's local clock —
// not the server's, since a teacher and the school office may be in
// different timezones.
function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function findGroupIdForPath(user, pathname) {
  if (!user) return null;
  const entries = NAV[user.role] || [];
  const group = entries.find(
    (entry) => entry.type === "group" && entry.items.some((i) => i.to === pathname)
  );
  if (group) return group.id;
  // No group matches the current route (e.g. the dashboard) — default to
  // the first group open rather than starting collapsed, so the nav isn't
  // empty-looking on first load.
  return entries.find((entry) => entry.type === "group")?.id ?? null;
}

// Nav links that only make sense for a class teacher — Reports shows only
// their own class(es) and Marks Status shows who in their class(es) hasn't
// finished recording marks. A subject teacher who isn't a class teacher for
// anything currently sees these as blank/empty pages, so they're hidden from
// the nav entirely for that teacher.
const CLASS_TEACHER_ONLY_LINKS = new Set(["/teacher/reports", "/teacher/marks-status", "/teacher/statistics"]);

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { maintenanceMode, scheduledAt } = useMaintenance();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "1"
  );
  // Starts false (links hidden) so a subject teacher never briefly sees a
  // link that leads to an empty page; flips true once we confirm they're a
  // class teacher for at least one class this year.
  const [isClassTeacher, setIsClassTeacher] = useState(false);

  // Which nav group is expanded. Set by clicking a group's header, and kept
  // in sync with whichever group contains the current page so navigating
  // never leaves you looking at a collapsed menu.
  const [openGroupId, setOpenGroupId] = useState(() => findGroupIdForPath(user, location.pathname));

  useEffect(() => {
    setOpenGroupId(findGroupIdForPath(user, location.pathname));
  }, [location.pathname, user?.role]);

  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    let cancelled = false;
    api
      .get("/classes")
      .then(({ data }) => {
        if (cancelled) return;
        const owns = (data.classes || []).some((c) => c.classTeacher?.id === user.id);
        setIsClassTeacher(owns);
      })
      .catch(() => {
        // If this fails, err on the side of showing the links rather than
        // silently hiding pages the teacher may actually need.
        if (!cancelled) setIsClassTeacher(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  // Browser tab title — "Reporting - Modules" rather than the greeting shown
  // on dashboard pages (that reads fine as a page heading, not as a tab title).
  useEffect(() => {
    if (!user) return;
    const meta = PAGE_META[location.pathname] || {};
    const shortTitle = typeof meta.title === "function" ? "Dashboard" : meta.title || ROLE_META[user.role]?.label || "";
    document.title = shortTitle ? `Reporting - ${shortTitle}` : "Reporting";
  }, [location.pathname, user]);

  // Browser tab icon — swap in the school's own logo once we know it, so
  // each school's tab reads as their own branding rather than the generic
  // app icon. Falls back to the default favicon for schools with no logo
  // uploaded yet (or for the superuser, who isn't tied to one school).
  useEffect(() => {
    const href = user?.schoolLogoUrl || "/favicon.svg";
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [user?.schoolLogoUrl]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarCollapsed", next ? "1" : "0");
      return next;
    });
  }

  // Auth pages (login / change-password) get a plain centered layout, no sidebar
  if (!user) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  // Superuser is exempt (they're the one who needs to get in to turn it back
  // off). Everyone else sees the full-page maintenance notice instead of the
  // app, until it's switched off.
  if (user.role !== "superuser" && maintenanceMode) {
    return <MaintenanceScreen />;
  }

  const meta = ROLE_META[user.role];
  const navItems = (NAV[user.role] || [])
    .map((entry) => {
      if (entry.type !== "group") return entry;
      const items = entry.items.filter(
        (item) => isClassTeacher || !CLASS_TEACHER_ONLY_LINKS.has(item.to)
      );
      return { ...entry, items };
    })
    .filter((entry) => (entry.type === "group" ? entry.items.length > 0 : isClassTeacher || !CLASS_TEACHER_ONLY_LINKS.has(entry.to)));
  const pageMeta = PAGE_META[location.pathname] || {};
  const pageTitle =
    typeof pageMeta.title === "function" ? pageMeta.title(user) : pageMeta.title || meta.label;
  const PageIcon = pageMeta.icon;

  async function handleLogout() {
    if (maintenanceMode) {
      const goToSettings = await confirm({
        title: "Turn off maintenance mode first",
        message:
          "Logging out is blocked while maintenance mode is on, so you don't get locked out again. Turn maintenance mode off, then you can log out normally.",
        confirmText: "Go to maintenance settings",
        cancelText: "Close",
      });
      if (goToSettings) navigate("/superuser");
      return;
    }
    const ok = await confirm({
      title: "Log out?",
      message: "You'll need to log in again to access your account.",
      confirmText: "Log Out",
    });
    if (ok) {
      await logout();
      navigate("/login");
    }
  }

  // Renders one nav entry: a plain link, or a group whose items expand
  // inline (normal width) or as a hover flyout (collapsed, icon-only width).
  function renderNavEntry(entry, isCollapsed) {
    if (entry.type === "link") {
      const Icon = entry.icon;
      const active = location.pathname === entry.to;
      return (
        <Link
          key={entry.to}
          to={entry.to}
          title={isCollapsed ? entry.label : undefined}
          onClick={() => setMobileNavOpen(false)}
          className={`flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors border
            ${isCollapsed ? "justify-center px-2" : "px-3"}
            ${active ? "bg-white/10 border-white/10 text-white" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"}`}
        >
          <Icon size={17} className={`shrink-0 ${active ? "text-gold-400" : ""}`} />
          {!isCollapsed && entry.label}
        </Link>
      );
    }

    // Group — icon badge + soft tinted panel for its items. In the full
    // sidebar this expands/collapses on click. In the collapsed
    // (icon-only) sidebar there's no label to click anyway, so instead the
    // group's item icons are shown stacked right under the group badge,
    // always visible — no click needed to see what's inside.
    const Icon = entry.icon;
    const groupActive = entry.items.some((i) => i.to === location.pathname);
    const expanded = openGroupId === entry.id;

    if (isCollapsed) {
      return (
        <div key={entry.id} className="space-y-0.5 pt-1.5 border-t border-white/10 first:pt-0 first:border-t-0">
          {entry.items.map((item) => {
            const ItemIcon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                onClick={() => setMobileNavOpen(false)}
                className={`flex items-center justify-center h-8 w-full rounded-lg transition-colors
                  ${active ? `bg-gradient-to-br ${entry.accent} text-white` : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
              >
                <ItemIcon size={15} />
              </Link>
            );
          })}
        </div>
      );
    }

    return (
      <div key={entry.id} className="relative">
        <button
          type="button"
          onClick={() => setOpenGroupId((prev) => (prev === entry.id ? null : entry.id))}
          aria-expanded={expanded}
          className={`w-full flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2.5 text-sm font-medium transition-colors
            ${expanded || groupActive ? `${entry.tint} border` : "border border-transparent text-slate-300 hover:bg-white/5 hover:text-white"}`}
        >
          <span
            className={`h-7 w-7 shrink-0 rounded-lg flex items-center justify-center bg-gradient-to-br ${entry.accent} text-white shadow-sm transition-transform duration-200 ${expanded ? "scale-105" : ""}`}
          >
            <Icon size={15} />
          </span>
          <span className={`flex-1 text-left truncate ${expanded || groupActive ? "text-slate-800" : ""}`}>
            {entry.label}
          </span>
          <ChevronDown
            size={15}
            className={`shrink-0 transition-transform text-slate-400 ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {/* Items appear inline, in a soft tinted card under the group */}
        {expanded && (
          <div className={`mt-1 rounded-xl border ${entry.tint} p-1.5 space-y-0.5`}>
            {entry.items.map((item) => {
              const ItemIcon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg pl-1.5 pr-3 py-1.5 text-sm font-medium transition-colors
                    ${active ? "bg-white shadow-sm text-slate-800" : "text-slate-600 hover:bg-white/70"}`}
                >
                  <span
                    className={`h-6 w-6 shrink-0 rounded-md flex items-center justify-center transition-colors
                      ${active ? `bg-gradient-to-br ${entry.accent} text-white` : "bg-white/80 text-slate-400"}`}
                  >
                    <ItemIcon size={13} />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderSidebarContent(isCollapsed) {
    return (
      <>
        <div className={`h-16 flex items-center gap-2.5 px-5 border-b border-white/10 ${isCollapsed ? "justify-center px-0" : "justify-between"}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {user.schoolLogoUrl ? (
              <div className="h-9 w-9 shrink-0 rounded-lg bg-white flex items-center justify-center overflow-hidden ring-1 ring-white/20">
                <img src={user.schoolLogoUrl} alt="School logo" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-sm shadow-black/30">
                <School size={18} strokeWidth={2.25} className="text-white" />
              </div>
            )}
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="block text-white font-semibold text-sm leading-tight truncate">
                  Mid-Term Reporting
                </span>
                <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 truncate">
                  {meta.label}
                </span>
              </div>
            )}
          </div>
          <button
            className="md:hidden text-slate-300 hover:text-white"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Academic year switcher — moved here from the top header so it
            lives alongside the rest of the navigation. Hidden while
            collapsed (a <select> has no useful icon-only form). */}
        {user.role === "manager" && !isCollapsed && (
          <div className="px-3 pt-3">
            <YearSwitcher />
          </div>
        )}

        <nav className="flex-1 px-3 py-4 overflow-y-auto flex flex-col">
          <div className="space-y-1">
            {navItems.map((entry) => renderNavEntry(entry, isCollapsed))}
          </div>

          <div className={`mt-4 rounded-xl border ${meta.tint} p-3`}>
            <div className={`flex items-center gap-3 px-1 py-1 ${isCollapsed ? "justify-center" : ""}`}>
              <div
                title={isCollapsed ? user.name : undefined}
                className={`h-8 w-8 shrink-0 rounded-full bg-white ring-2 ${meta.ring} flex items-center justify-center text-xs font-semibold ${meta.text}`}
              >
                {user.name?.[0]?.toUpperCase() || "?"}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                  <p className={`text-xs font-medium ${meta.text} truncate`}>
                    {meta.label}
                    {user.schoolName && <span className="text-slate-400 font-normal"> · {user.schoolName.split(" ")[0]}</span>}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              title={isCollapsed ? "Log Out" : undefined}
              className={`mt-2 w-full flex items-center gap-2 rounded-lg py-2 text-sm font-medium ${meta.text} ${meta.hover} transition-colors
                ${isCollapsed ? "justify-center px-2" : "px-3"}`}
            >
              <LogOut size={16} className="shrink-0" />
              {!isCollapsed && "Log Out"}
            </button>
          </div>
        </nav>
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop sidebar: always visible from md breakpoint up, pinned while the page scrolls */}
      <aside
        className={`hidden md:flex md:sticky md:top-0 md:h-screen shrink-0 bg-gradient-to-b from-brand-600 via-brand-700 to-brand-900 border-r border-black/20 flex-col transition-[width] duration-200
          ${collapsed ? "w-[72px]" : "w-64"}`}
      >
        {renderSidebarContent(collapsed)}
      </aside>

      {/* Mobile sidebar: slide-over drawer, only rendered when opened — always shows full labels */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-50 w-64 max-w-[80vw] bg-gradient-to-b from-brand-600 via-brand-700 to-brand-900 border-r border-black/20 flex flex-col h-full">
            {renderSidebarContent(false)}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Page header: hamburger (mobile only) + icon/title/subtitle + date. Sticky so it stays visible while the page content scrolls. */}
        <header className="relative sticky top-0 z-30 flex items-center gap-3 bg-brand-700 px-4 sm:px-6 lg:px-8 py-3.5 shrink-0">
          {/* Signature hairline — the one gold flourish, echoing the logo mark */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/70 to-transparent" />

          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden text-slate-300 hover:text-white -ml-1"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <button
            onClick={toggleCollapsed}
            className="hidden md:flex text-slate-300 hover:text-white hover:bg-white/10 rounded-lg p-1.5 -ml-1.5 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>

          {PageIcon && (
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-gold-500/40 text-white">
              <PageIcon size={19} strokeWidth={2} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-white truncate">
                {pageTitle}
              </h1>
              {(maintenanceMode || scheduledAt) && (
                <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-semibold">
                  <Wrench size={11} className="shrink-0" />
                  {maintenanceMode ? "Maintenance ON" : "Maintenance planned"}
                </span>
              )}
            </div>
            {pageMeta.subtitle && (
              <p className="hidden sm:block text-xs text-slate-400 truncate">{pageMeta.subtitle}</p>
            )}
          </div>

          {user.role === "manager" && <GlobalSearch />}

          {(user.role === "teacher" || user.role === "manager") && <NotificationBell />}

          <div className="hidden md:flex items-center gap-2 rounded-lg bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
            {new Date().toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
        </header>

        <MaintenanceBanner />

        <main className="flex-1 min-w-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
