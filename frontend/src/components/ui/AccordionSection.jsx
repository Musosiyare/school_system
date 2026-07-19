import { useState } from "react";
import { ChevronDown } from "lucide-react";

// A collapsible, styled section used to break up data-heavy pages (like
// Statistics) into chunks the user opens one at a time instead of being
// handed everything at once. Multiple sections can be open together — this
// isn't exclusive tabs, just a toggle per section.
//
// `actions` renders on the header row (e.g. a term selector) and stops
// propagation so clicking it doesn't also toggle the section open/closed.
export default function AccordionSection({
  icon: Icon,
  title,
  subtitle,
  actions,
  accent = "from-brand-400 to-brand-600",
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  children,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  // Controlled mode is opt-in: pass `open` + `onToggle` together to drive this
  // from outside (e.g. a stat card elsewhere on the page expanding it).
  // Omit both and it behaves exactly as before, managing its own state.
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  function toggle() {
    if (isControlled) onToggle?.(!open);
    else setUncontrolledOpen((o) => !o);
  }

  return (
    <section
      className={`bg-white border rounded-2xl shadow-sm mb-6 overflow-hidden transition-all duration-300 ${
        open ? "border-slate-200 shadow-md" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div
              className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${accent} text-white shadow-sm`}
            >
              <Icon size={19} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {actions && (
            <div onClick={(e) => e.stopPropagation()} className="flex flex-wrap gap-2">
              {actions}
            </div>
          )}
          <span
            className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center border transition-all duration-300 ${
              open
                ? "rotate-180 bg-slate-100 border-slate-300 text-slate-600"
                : "border-slate-200 text-slate-400"
            }`}
          >
            <ChevronDown size={16} />
          </span>
        </div>
      </div>

      {/* CSS-grid height trick: animates 0fr -> 1fr so the collapse/expand
          transition works smoothly without measuring scrollHeight in JS,
          and stays correct even if the content's height changes later. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 sm:px-6 pb-5 sm:pb-6 pt-4 border-t border-slate-100">{children}</div>
        </div>
      </div>
    </section>
  );
}
