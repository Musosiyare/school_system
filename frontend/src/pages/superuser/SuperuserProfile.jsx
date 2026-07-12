import { useState } from "react";
import ChangePasswordCard from "../../components/ChangePasswordCard";
import AccountNameCard from "../../components/AccountNameCard";
import { UserCircle, KeyRound, ChevronDown, ChevronUp } from "lucide-react";

export default function SuperuserProfile() {
  // Both forms start hidden — each is revealed only by tapping its own
  // trigger row, rather than always showing both at once.
  const [openPanel, setOpenPanel] = useState(null); // null | "account" | "password"

  function toggle(panel) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  const triggers = [
    { key: "account", label: "My Account", icon: UserCircle },
    { key: "password", label: "Password", icon: KeyRound },
  ];

  return (
    <div className="space-y-3">
      {triggers.map(({ key, label, icon: Icon }) => {
        const active = openPanel === key;
        return (
          <div key={key}>
            <button
              onClick={() => toggle(key)}
              className={`w-full flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition
                ${
                  active
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50/50"
                }`}
            >
              <span className="flex items-center gap-2">
                <Icon size={16} />
                {label}
              </span>
              {active ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {active && (
              <div className="mt-3">
                {key === "account" && <AccountNameCard className="ring-2 ring-violet-300" allowEmailEdit />}
                {key === "password" && <ChangePasswordCard className="ring-2 ring-violet-300" />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
