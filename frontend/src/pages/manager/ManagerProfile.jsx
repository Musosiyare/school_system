import { useEffect, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import { Field, Input } from "../../components/ui/FormField";
import { ErrorText, SuccessText } from "../../components/ui/Alerts";
import ChangePasswordCard from "../../components/ChangePasswordCard";
import AccountNameCard from "../../components/AccountNameCard";
import { Building2, UserCircle, KeyRound } from "lucide-react";

const emptyForm = { name: "", address: "", phone: "", email: "", logoUrl: "" };

const TABS = [
  { value: "school", label: "School Info", icon: Building2 },
  { value: "account", label: "My Account", icon: UserCircle },
  { value: "password", label: "Password", icon: KeyRound },
];

export default function ManagerProfile() {
  const [tab, setTab] = useState("school");
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/schools/me");
      setForm({
        name: data.school.name || "",
        address: data.school.address || "",
        phone: data.school.phone || "",
        email: data.school.email || "",
        logoUrl: data.school.logoUrl || "",
      });
      setStatus(data.school.status);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await api.patch("/schools/me", form);
      setSuccess("School information updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-6">
        <Badge tone={status === "active" ? "pass" : "fail"}>{status}</Badge>
      </div>

      <div className="mb-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === "school" && (
        <Card
          title="School Information"
          subtitle="Visible to teachers and shown on generated reports."
          actions={<Building2 size={18} className="text-slate-400" />}
          className="ring-2 ring-brand-300"
        >
          {loading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : (
            <form noValidate onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <Field label="School Name" className="sm:col-span-2">
                <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} required autoFocus />
              </Field>
              <Field label="School Email">
                <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input value={form.address} onChange={(e) => updateField("address", e.target.value)} />
              </Field>
              <Field label="Logo URL" className="sm:col-span-2">
                <Input value={form.logoUrl} onChange={(e) => updateField("logoUrl", e.target.value)} />
              </Field>
              <div className="sm:col-span-2 flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <ErrorText>{error}</ErrorText>
                <SuccessText>{success}</SuccessText>
              </div>
            </form>
          )}
        </Card>
      )}

      {tab === "account" && <AccountNameCard className="ring-2 ring-brand-300" />}

      {tab === "password" && <ChangePasswordCard className="ring-2 ring-brand-300" />}
    </div>
  );
}
