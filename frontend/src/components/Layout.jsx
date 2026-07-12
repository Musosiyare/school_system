import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "./ui/ConfirmProvider";
import NotificationBell from "./NotificationBell";
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
  BellRing,
  UserCog,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const ROLE_META = {
  superuser: { label: "Superuser", accent: "bg-violet-600", text: "text-violet-600", ring: "ring-violet-200", tint: "bg-violet-50 border-violet-100", hover: "hover:bg-violet-100/70" },
  manager: { label: "Manager", accent: "bg-brand-500", text: "text-brand-500", ring: "ring-brand-200", tint: "bg-brand-50 border-brand-100", hover: "hover:bg-brand-100/70" },
  // Same palette as manager — teacher used to have its own teal theme, but
  // the design is meant to be identical across roles (only the nav items
  // and page content differ).
  teacher: { label: "Teacher", accent: "bg-brand-500", text: "text-brand-500", ring: "ring-brand-200", tint: "bg-brand-50 border-brand-100", hover: "hover:bg-brand-100/70" },
};

const NAV = {
  superuser: [
    { to: "/superuser", label: "Schools", icon: School },
    { to: "/superuser/profile", label: "Profile", icon: UserCog },
  ],
  manager: [
    { to: "/manager", label: "Dashboard", icon: LayoutDashboard },
    { to: "/manager/academic-years", label: "Academic Years", icon: CalendarRange },
    { to: "/manager/classes", label: "Classes", icon: Layers },
    { to: "/manager/modules", label: "Modules", icon: BookOpen },
    { to: "/manager/teachers", label: "Teachers", icon: Users },
    { to: "/manager/students", label: "Students", icon: GraduationCap },
    { to: "/manager/assignments", label: "Assignments", icon: ClipboardList },
    { to: "/manager/reports", label: "Reports", icon: FileText },
    { to: "/manager/profile", label: "Profile", icon: UserCog },
  ],
  teacher: [
    { to: "/teacher", label: "Dashboard", icon: LayoutDashboard },
    { to: "/teacher/marks", label: "Record Marks", icon: PencilLine },
    { to: "/teacher/marks-status", label: "Marks Status", icon: BellRing },
    { to: "/teacher/reports", label: "Reports", icon: FileText },
    { to: "/teacher/profile", label: "Profile", icon: UserCog },
  ],
};

// Drives the top page header: one line, no filler. Titles/subtitles can be a
// plain string or a fn(user) for pages that personalize the greeting.
const PAGE_META = {
  "/superuser": { title: "Schools", subtitle: "Every school on the platform.", icon: School },
  "/superuser/profile": { title: "Profile", subtitle: "Manage your account settings.", icon: UserCog },
  "/manager": {
    title: (user) => `Welcome back, ${user.name?.split(" ")[0] || ""}`,
    subtitle: "Here's your school at a glance.",
    icon: LayoutDashboard,
  },
  "/manager/academic-years": {
    title: "Academic Years",
    subtitle: "Each year auto-creates its three terms.",
    icon: CalendarRange,
  },
  "/manager/classes": { title: "Classes", subtitle: "Classes for the current academic year.", icon: Layers },
  "/manager/modules": { title: "Modules", subtitle: "Your school's subject catalog.", icon: BookOpen },
  "/manager/teachers": { title: "Teachers", subtitle: "Teacher accounts in your school.", icon: Users },
  "/manager/students": { title: "Students", subtitle: "Pick a class to manage its students.", icon: GraduationCap },
  "/manager/assignments": {
    title: "Assignments",
    subtitle: "Assign teachers to modules by class.",
    icon: ClipboardList,
  },
  "/manager/reports": { title: "Reports", subtitle: "Class rankings and printable report cards.", icon: FileText },
  "/manager/profile": { title: "Profile", subtitle: "Your account and school settings.", icon: UserCog },
  "/teacher": {
    title: (user) => `Welcome back, ${user.name?.split(" ")[0] || ""}`,
    subtitle: "What you're teaching this year.",
    icon: LayoutDashboard,
  },
  "/teacher/marks": { title: "Record Marks", subtitle: "Enter or update scores for your modules.", icon: PencilLine },
  "/teacher/marks-status": {
    title: "Marks Status",
    subtitle: "Who hasn't finished recording marks yet.",
    icon: BellRing,
  },
  "/teacher/reports": { title: "Reports", subtitle: "Class rankings and report cards.", icon: FileText },
  "/teacher/profile": { title: "Profile", subtitle: "Manage your account settings.", icon: UserCog },
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "1"
  );

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

  const meta = ROLE_META[user.role];
  const navItems = NAV[user.role] || [];
  const pageMeta = PAGE_META[location.pathname] || {};
  const pageTitle =
    typeof pageMeta.title === "function" ? pageMeta.title(user) : pageMeta.title || meta.label;
  const PageIcon = pageMeta.icon;

  async function handleLogout() {
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

  function renderSidebarContent(isCollapsed) {
    return (
      <>
        <div className={`h-14 flex items-center gap-2 px-5 ${meta.accent} ${isCollapsed ? "justify-center px-0" : "justify-between"}`}>
          <div className="flex items-center gap-2 min-w-0">
            <School size={20} className="text-white shrink-0" />
            {!isCollapsed && (
              <span className="text-white font-semibold text-sm leading-tight truncate">
                Mid-Term Reporting
              </span>
            )}
          </div>
          <button
            className="md:hidden text-white/90 hover:text-white"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto flex flex-col">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={isCollapsed ? item.label : undefined}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors
                    ${isCollapsed ? "justify-center px-2" : "px-3"}
                    ${active ? `${meta.accent} text-white` : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <Icon size={17} className="shrink-0" />
                  {!isCollapsed && item.label}
                </Link>
              );
            })}
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
        className={`hidden md:flex md:sticky md:top-0 md:h-screen shrink-0 bg-white border-r border-slate-200 flex-col transition-[width] duration-200
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
          <aside className="relative z-50 w-64 max-w-[80vw] bg-white border-r border-slate-200 flex flex-col h-full">
            {renderSidebarContent(false)}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Page header: hamburger (mobile only) + icon/title/subtitle + date. Sticky so it stays visible while the page content scrolls. */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 backdrop-blur px-4 sm:px-6 lg:px-8 py-3.5 shrink-0">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden text-slate-500 hover:text-slate-700 -ml-1"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <button
            onClick={toggleCollapsed}
            className="hidden md:flex text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 -ml-1.5 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>

          {PageIcon && (
            <div
              className={`hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tint} border ${meta.text}`}
            >
              <PageIcon size={19} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-semibold text-slate-800 truncate">
              {pageTitle}
            </h1>
            {pageMeta.subtitle && (
              <p className="hidden sm:block text-xs text-slate-500 truncate">{pageMeta.subtitle}</p>
            )}
          </div>

          {(user.role === "teacher" || user.role === "manager") && <NotificationBell />}

          <div
            className={`hidden md:flex items-center gap-2 rounded-lg ${meta.tint} border px-3 py-1.5 text-xs font-medium ${meta.text}`}
          >
            {new Date().toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
