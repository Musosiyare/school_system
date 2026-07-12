import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { Field, Input } from "../components/ui/FormField";
import { ErrorText } from "../components/ui/Alerts";
import Button from "../components/ui/Button";
import { ShieldCheck, User, Mail, MailCheck, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

const STEPS = [
  { key: "name", label: "Verify identity" },
  { key: "email", label: "Confirm email" },
  { key: "sent", label: "Done" },
];

export default function ForgotPassword() {
  const [step, setStep] = useState("name"); // name -> email -> sent
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  async function handleVerifyName(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password/verify-name", { name });
      setStep("email");
    } catch (err) {
      setError(err.message || "No super admin account found with that name");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyEmail(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password/verify-email", { name, email });
      setStep("sent");
    } catch (err) {
      setError(err.message || "That email doesn't match the account we found");
    } finally {
      setSubmitting(false);
    }
  }

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
            <ShieldCheck size={22} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800 text-center">
            Reset Super Admin Password
          </h1>
          <p className="text-sm text-slate-500 mt-1 text-center max-w-xs">
            We'll verify your identity before sending a reset link.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition
                  ${
                    i < stepIndex
                      ? "bg-teal-500 text-white"
                      : i === stepIndex
                      ? "bg-brand-500 text-white"
                      : "bg-slate-200 text-slate-400"
                  }`}
              >
                {i < stepIndex ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-8 rounded ${i < stepIndex ? "bg-teal-500" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="relative bg-white rounded-[24px] shadow-[0_30px_70px_-20px_rgba(43,58,103,0.25)] px-7 pt-7 pb-7">
          {step === "name" && (
            <form noValidate onSubmit={handleVerifyName} className="space-y-4">
              <Field label="Full Name">
                <div className="relative">
                  <User size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter the super admin's full name"
                    autoComplete="name"
                    autoFocus
                    required
                    className="form-field w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 py-3 text-sm text-slate-800
                      placeholder:text-slate-400 outline-none transition
                      focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  />
                </div>
              </Field>
              <ErrorText>{error}</ErrorText>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Checking..." : (
                  <>
                    Continue <ArrowRight size={15} />
                  </>
                )}
              </Button>
            </form>
          )}

          {step === "email" && (
            <form noValidate onSubmit={handleVerifyEmail} className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <User size={14} className="text-teal-600 shrink-0" />
                <span className="truncate">
                  Verifying as <span className="font-semibold text-slate-700">{name}</span>
                </span>
              </div>
              <Field label="Account Email">
                <div className="relative">
                  <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="superuser@platform.com"
                    autoComplete="email"
                    autoFocus
                    required
                    className="form-field w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 py-3 text-sm text-slate-800
                      placeholder:text-slate-400 outline-none transition
                      focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  />
                </div>
              </Field>
              <ErrorText>{error}</ErrorText>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Sending..." : "Send Reset Link"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep("name");
                  setError("");
                }}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-brand-600 transition"
              >
                <ArrowLeft size={13} /> Back
              </button>
            </form>
          )}

          {step === "sent" && (
            <div className="flex flex-col items-center text-center py-2">
              <div className="h-12 w-12 rounded-full bg-teal-50 flex items-center justify-center mb-4 ring-1 ring-teal-100">
                <MailCheck size={22} className="text-teal-600" />
              </div>
              <h2 className="font-semibold text-slate-800 mb-1.5">Check your email</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                A reset link was sent to <span className="font-semibold text-slate-700">{email}</span>.
                Open it within 30 minutes — after that you'll need to request a new one.
              </p>
            </div>
          )}
        </div>

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
