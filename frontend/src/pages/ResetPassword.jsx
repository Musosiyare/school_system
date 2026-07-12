import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../api/client";
import { Field } from "../components/ui/FormField";
import { ErrorText } from "../components/ui/Alerts";
import Button from "../components/ui/Button";
import { KeyRound, Lock, Eye, EyeOff, ArrowLeft, ShieldAlert } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      navigate("/login", { state: { resetSuccess: true } });
    } catch (err) {
      setError(err.message || "This reset link is invalid or has expired");
    } finally {
      setSubmitting(false);
    }
  }

  const cardWrap = "relative bg-white rounded-[24px] shadow-[0_30px_70px_-20px_rgba(43,58,103,0.25)] px-7 pt-7 pb-7";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-gradient-to-br from-white via-teal-50 to-teal-100">
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-teal-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-slate-900/10 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(circle, #000000 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center mb-3 shadow-lg shadow-brand-500/25">
            <KeyRound size={22} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800 text-center">Choose a New Password</h1>
        </div>

        {!token ? (
          <div className={cardWrap}>
            <div className="flex flex-col items-center text-center py-2">
              <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center mb-4 ring-1 ring-rose-100">
                <ShieldAlert size={22} className="text-rose-600" />
              </div>
              <h2 className="font-semibold text-slate-800 mb-1.5">Link missing or invalid</h2>
              <p className="text-sm text-slate-500 mb-5">
                This reset link is incomplete. Request a new one to continue.
              </p>
              <Link
                to="/forgot-password"
                className="text-sm font-semibold text-brand-600 hover:text-brand-700 transition"
              >
                Request a new link
              </Link>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={handleSubmit} className={`${cardWrap} space-y-4`}>
            <Field label="New Password (min 8 characters)">
              <div className="relative">
                <Lock size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  autoFocus
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
            </Field>
            <Field label="Confirm Password">
              <div className="relative">
                <Lock size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="form-field w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 py-3 text-sm text-slate-800
                    placeholder:text-slate-400 outline-none transition
                    focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                />
              </div>
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Saving..." : "Save Password"}
            </Button>
          </form>
        )}

        <Link
          to="/login"
          className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-brand-600 transition mt-5"
        >
          <ArrowLeft size={13} /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
