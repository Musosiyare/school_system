import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Field, Input } from "../components/ui/FormField";
import { ErrorText } from "../components/ui/Alerts";
import Button from "../components/ui/Button";
import { KeyRound } from "lucide-react";

export default function ChangePassword() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/change-password", { newPassword });
      updateUser({ mustChangePassword: false });
      if (user.role === "superuser") navigate("/superuser");
      else if (user.role === "manager") navigate("/manager");
      else navigate("/teacher");
    } catch (err) {
      setError(err.message || "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-brand-500 flex items-center justify-center mb-3">
            <KeyRound size={22} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800 text-center">Set a New Password</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            This is your first login. Choose a new password to continue.
          </p>
        </div>

        <form noValidate onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
          <Field label="New Password (min 8 characters)">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              autoFocus
            />
          </Field>
          <Field label="Confirm Password">
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Saving..." : "Save Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
