export default function Tabs({ tabs, active, onChange, className = "" }) {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all
              ${
                isActive
                  ? "bg-brand-500 text-white shadow-sm shadow-brand-500/30"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/60"
              }`}
          >
            {tab.icon && <tab.icon size={15} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
