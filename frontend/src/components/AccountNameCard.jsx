import { useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { Field, Input } from "./ui/FormField";
import { ErrorText, SuccessText } from "./ui/Alerts";
import { UserCircle } from "lucide-react";

// Self-service "your name" editor, used from the Profile pages. Separate
// from School Information (manager-only, school-wide) — this changes the
// signed-in user's own display name, which shows up in things like class
// teacher assignments and report bylines.
export default function AccountNameCard({ className = "" }) {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
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
    setSaving(true);
    try {
      const { data } = await api.patch("/auth/me", { name: name.trim() });
      updateUser({ name: data.user.name });
      setSuccess("Name updated successfully.");
    } catch (err) {
      setError(err.message || "Failed to update name");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="My Account"
      subtitle="Update the name shown across the app for your account."
      actions={<UserCircle size={18} className="text-slate-400" />}
      className={className}
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <Field label="Your Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <ErrorText>{error}</ErrorText>
        <SuccessText>{success}</SuccessText>
        <Button type="submit" disabled={saving || name.trim() === (user?.name || "")}>
          {saving ? "Saving..." : "Save Name"}
        </Button>
      </form>
    </Card>
  );
}
