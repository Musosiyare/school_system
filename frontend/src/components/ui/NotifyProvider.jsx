import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { AlertTriangle, Lock, Info, XCircle } from "lucide-react";

const NotifyContext = createContext(null);

// Icon + color per tone, so the modal communicates at a glance what kind of
// message this is before the person even reads the text.
const TONE_STYLES = {
  error: { icon: XCircle, iconClass: "text-red-500", ring: "bg-red-50" },
  warning: { icon: AlertTriangle, iconClass: "text-amber-500", ring: "bg-amber-50" },
  restricted: { icon: Lock, iconClass: "text-red-500", ring: "bg-red-50" },
  info: { icon: Info, iconClass: "text-brand-600", ring: "bg-brand-50" },
};

export function NotifyProvider({ children }) {
  const [state, setState] = useState(null); // { title, message, tone, okText }
  const resolver = useRef(null);

  // Usage: const notify = useNotify(); await notify({ title, message, tone });
  // tone: 'error' | 'warning' | 'restricted' | 'info' (default 'error')
  const notify = useCallback((options) => {
    setState({
      title: "Something went wrong",
      message: "",
      tone: "error",
      okText: "OK",
      ...options,
    });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function handleClose() {
    setState(null);
    resolver.current?.(true);
    resolver.current = null;
  }

  const { icon: Icon, iconClass, ring } = TONE_STYLES[state?.tone] || TONE_STYLES.error;

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Modal open={!!state} onClose={handleClose} title={state?.title} size="sm">
        {state && (
          <>
            <div className="flex gap-3 items-start">
              <div className={`shrink-0 rounded-full p-2 ${ring}`}>
                <Icon className={iconClass} size={20} />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed pt-1.5">{state.message}</p>
            </div>
            <div className="flex justify-end mt-5">
              <Button variant="primary" onClick={handleClose}>
                {state.okText}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  return useContext(NotifyContext);
}
