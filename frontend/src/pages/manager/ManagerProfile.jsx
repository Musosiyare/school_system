import { useEffect, useRef, useState } from "react";
import api from "../../api/client";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import { Field, Input, IconInput } from "../../components/ui/FormField";
import { ErrorText, SuccessText } from "../../components/ui/Alerts";
import ChangePasswordCard from "../../components/ChangePasswordCard";
import AccountNameCard from "../../components/AccountNameCard";
import { Building2, UserCircle, KeyRound, Mail, Phone, MapPin, Image as ImageIcon, Upload, X } from "lucide-react";

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
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState("");
  const logoInputRef = useRef(null);

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

  // Uploads the file straight away (rather than waiting for the "Save
  // Changes" button below, which only PATCHes the plain text fields) since
  // it needs multipart/form-data, not JSON. Immediate feedback here also
  // means the preview updates the moment the upload finishes.
  async function handleLogoFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setLogoError("");
    setLogoBusy(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const { data } = await api.post("/schools/me/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((f) => ({ ...f, logoUrl: data.school.logoUrl || "" }));
    } catch (err) {
      setLogoError(err.message);
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleRemoveLogo() {
    setLogoError("");
    setLogoBusy(true);
    try {
      await api.patch("/schools/me", { ...form, logoUrl: "" });
      setForm((f) => ({ ...f, logoUrl: "" }));
    } catch (err) {
      setLogoError(err.message);
    } finally {
      setLogoBusy(false);
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
                <IconInput icon={Building2} value={form.name} onChange={(e) => updateField("name", e.target.value)} required autoFocus />
              </Field>
              <Field label="School Email">
                <IconInput icon={Mail} type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
              </Field>
              <Field label="Phone">
                <IconInput icon={Phone} value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <IconInput icon={MapPin} value={form.address} onChange={(e) => updateField("address", e.target.value)} />
              </Field>
              <Field label="School Logo" className="sm:col-span-2">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="School logo" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon size={22} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={logoBusy}
                        onClick={() => logoInputRef.current?.click()}
                      >
                        <Upload size={14} /> {logoBusy ? "Uploading..." : form.logoUrl ? "Replace" : "Upload logo"}
                      </Button>
                      {form.logoUrl && (
                        <Button type="button" variant="ghost" size="sm" disabled={logoBusy} onClick={handleRemoveLogo}>
                          <X size={14} /> Remove
                        </Button>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">PNG, JPG, or WEBP, up to 2MB.</span>
                    <ErrorText>{logoError}</ErrorText>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoFileChange}
                  />
                </div>
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
