import { useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { Field, Input } from "./ui/FormField";
import { ErrorText, SuccessText } from "./ui/Alerts";
import { UserCircle } from "lucide-react";

// Self-service "your name" (and, for superuser, "your email") editor, used
// from the Profile pages. Separate from School Information (manager-only,
// school-wide) — this changes the signed-in user's own display name (and
// login email, superuser only), which shows up in things like class teacher
// assignments and report bylines.
//
// allowEmailEdit is superuser-only by convention: managers/teachers have
// their email set by whoever created their account, so letting them change
// it themselves would let a suspended/departing staff member quietly
// redirect their own login identity. The backend enforces this too.
export default function AccountNameCard({ className = "", allowEmailEdit = false }) {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (allowEmailEdit && !email.trim()) {
      setError("Email is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim() };
      if (allowEmailEdit) payload.email = email.trim();
      const { data } = await api.patch("/auth/me", payload);
      updateUser({ name: data.user.name, email: data.user.email });
      if (allowEmailEdit) setEmail(data.user.email);
      setSuccess("Account details updated successfully.");
    } catch (err) {
      setError(err.message || "Failed to update account details");
    } finally {
      setSaving(false);
    }
  }

  const unchanged =
    name.trim() === (user?.name || "") && (!allowEmailEdit || email.trim() === (user?.email || ""));

  return (
    <Card
      title="My Account"
      subtitle={
        allowEmailEdit
          ? "Update the name and email used for your account."
          : "Update the name shown across the app for your account."
      }
      actions={<UserCircle size={18} className="text-slate-400" />}
      className={className}
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <Field label="Your Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        {allowEmailEdit && (
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
        )}
        <ErrorText>{error}</ErrorText>
        <SuccessText>{success}</SuccessText>
        <Button type="submit" disabled={saving || unchanged}>
          {saving ? "Saving..." : allowEmailEdit ? "Save Changes" : "Save Name"}
        </Button>
      </form>
    </Card>
  );
}
