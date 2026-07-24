import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { normalizePhone } from "@/lib/phone";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Download, Upload, Building2, AlertTriangle, LogOut } from "lucide-react";
import { LeadStagesSettings, LeadTemplatesSettings } from "@/components/lead-settings";
import { RecentlyDeleted } from "@/components/recently-deleted";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Fitness Dream" },
      { name: "description", content: "Gym settings, plans, and backup." },
    ],
  }),
  component: SettingsPage,
});

type BackupMember = {
  full_name: string;
  phone: string;
  email?: string;
  address?: string;
  plan_type?: string;
  total_fee?: number;
  amount_paid?: number;
  start_date?: string;
  expiry_date?: string;
  notes?: string;
};

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: gym } = useQuery({
    queryKey: ["gym-settings"],
    queryFn: async () => (await supabase.from("gym_settings").select("*").maybeSingle()).data,
  });
  const { data: plans } = useQuery({
    queryKey: ["plans-all"],
    queryFn: async () => (await supabase.from("plans").select("*").order("duration_months")).data ?? [],
  });

  const [gymForm, setGymForm] = useState({ name: "", tagline: "", phone: "", email: "", address: "", currency_symbol: "₹", whatsapp_country_code: "+91", invoice_terms: "" });
  useEffect(() => {
    if (gym) setGymForm({
      name: gym.name ?? "", tagline: gym.tagline ?? "", phone: gym.phone ?? "",
      email: gym.email ?? "", address: gym.address ?? "",
      currency_symbol: gym.currency_symbol ?? "₹", whatsapp_country_code: gym.whatsapp_country_code ?? "+91",
      invoice_terms: (gym as any).invoice_terms ?? "",
    });
  }, [gym]);

  const saveGym = async () => {
    if (!gym?.id) return;
    const { error } = await supabase.from("gym_settings").update({
      ...gymForm, updated_at: new Date().toISOString(),
    }).eq("id", gym.id);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["gym-settings"] });
  };

  // Plan CRUD
  const [newPlan, setNewPlan] = useState({ name: "", duration_months: 1, price: 0 });
  const addPlan = async () => {
    if (!newPlan.name) return toast.error("Name required");
    await supabase.from("plans").insert({ ...newPlan, active: true });
    setNewPlan({ name: "", duration_months: 1, price: 0 });
    qc.invalidateQueries({ queryKey: ["plans-all"] });
  };
  const togglePlan = async (id: string, active: boolean) => {
    await supabase.from("plans").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["plans-all"] });
  };

  // Backup export
  const exportJson = async () => {
    const [mem, staff, pay, inv, plansAll, gymAll] = await Promise.all([
      supabase.from("members").select("*").is("deleted_at", null),
      supabase.from("staff").select("*").is("deleted_at", null),
      supabase.from("payments").select("*").is("deleted_at", null),
      supabase.from("invoices").select("*, invoice_items(*)").is("deleted_at", null),
      supabase.from("plans").select("*"),
      supabase.from("gym_settings").select("*"),
    ]);
    const backup = {
      version: 1,
      exported_at: new Date().toISOString(),
      gym: gymAll.data,
      plans: plansAll.data,
      members: mem.data,
      staff: staff.data,
      invoices: inv.data,
      payments: pay.data,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fitness-dream-backup-${fmtDate(new Date()).replace(/\s+/g, "-")}.json`;
    a.click();
    toast.success("Backup downloaded");
  };

  // Restore preview
  type FlaggedRow = { name: string; phone: string; reason: string };
  const [restore, setRestore] = useState<{
    totalInFile: number;
    toAdd: (BackupMember & { phone_normalized: string })[];
    allValid: (BackupMember & { phone_normalized: string })[];
    toUpdate: FlaggedRow[];
    dupInFile: FlaggedRow[];
    invalid: FlaggedRow[];
  } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [forceAll, setForceAll] = useState(false);
  const [importResult, setImportResult] = useState<{
    read: number;
    inserted: number;
    skippedExisting: number;
    skippedDupInFile: number;
    skippedInvalid: number;
    invalid: FlaggedRow[];
    skippedExistingList: FlaggedRow[];
    dupInFile: FlaggedRow[];
  } | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const members: BackupMember[] = data.members ?? [];
      if (!Array.isArray(members)) throw new Error("Invalid backup: members array missing");

      const totalInFile = members.length;
      const invalid: FlaggedRow[] = [];
      const valid: (BackupMember & { phone_normalized: string })[] = [];
      for (const m of members) {
        const phone_normalized = normalizePhone(m.phone);
        if (!m.full_name || !phone_normalized) {
          invalid.push({
            name: m.full_name || "(no name)",
            phone: m.phone || "(no phone)",
            reason: !m.full_name ? "missing name" : "missing/invalid phone",
          });
          continue;
        }
        valid.push({ ...m, phone_normalized });
      }

      const phones = valid.map(m => m.phone_normalized);
      const { data: existing } = phones.length
        ? await supabase.from("members").select("phone_normalized").in("phone_normalized", phones)
        : { data: [] as { phone_normalized: string }[] };
      const existingSet = new Set((existing ?? []).map(x => x.phone_normalized));

      const seen = new Set<string>();
      const toAdd: (BackupMember & { phone_normalized: string })[] = [];
      const toUpdate: FlaggedRow[] = [];
      const dupInFile: FlaggedRow[] = [];
      for (const m of valid) {
        if (seen.has(m.phone_normalized)) {
          dupInFile.push({ name: m.full_name, phone: m.phone, reason: "duplicate phone in file" });
          continue;
        }
        seen.add(m.phone_normalized);
        if (existingSet.has(m.phone_normalized)) {
          toUpdate.push({ name: m.full_name, phone: m.phone, reason: "already exists in database" });
        } else {
          toAdd.push(m);
        }
      }
      setImportResult(null);
      setRestore({ totalInFile, toAdd, allValid: valid, toUpdate, dupInFile, invalid });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doRestore = async () => {
    if (!restore) return;
    setRestoring(true);
    const source = forceAll ? restore.allValid : restore.toAdd;
    const rows = source.map(m => ({
      full_name: m.full_name,
      phone: m.phone,
      phone_normalized: m.phone_normalized,
      email: m.email || null,
      address: m.address || null,
      plan_type: m.plan_type || null,
      total_fee: Number(m.total_fee ?? 0),
      amount_paid: Number(m.amount_paid ?? 0),
      balance_due: Math.max(0, Number(m.total_fee ?? 0) - Number(m.amount_paid ?? 0)),
      start_date: m.start_date || new Date().toISOString().slice(0,10),
      expiry_date: m.expiry_date || new Date().toISOString().slice(0,10),
      notes: m.notes || null,
    }));
    let inserted = 0;
    if (rows.length) {
      const { error, count } = await supabase.from("members").insert(rows, { count: "exact" });
      if (error) { setRestoring(false); return toast.error(error.message); }
      inserted = count ?? rows.length;
    }
    setRestoring(false);
    setImportResult({
      read: restore.totalInFile,
      inserted,
      skippedExisting: forceAll ? 0 : restore.toUpdate.length,
      skippedDupInFile: forceAll ? 0 : restore.dupInFile.length,
      skippedInvalid: restore.invalid.length,
      invalid: restore.invalid,
      skippedExistingList: forceAll ? [] : restore.toUpdate,
      dupInFile: forceAll ? [] : restore.dupInFile,
    });
    setRestore(null);
    setForceAll(false);
    toast.success(`Restored ${inserted} members`);
    qc.invalidateQueries();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Gym profile, plans, and data tools."
        actions={<Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Sign out</Button>}
      />

      <Tabs defaultValue="gym">
        <TabsList>
          <TabsTrigger value="gym"><Building2 className="h-3.5 w-3.5 mr-1" /> Gym</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="member-templates">Member templates</TabsTrigger>
          <TabsTrigger value="stages">Lead pipeline</TabsTrigger>
          <TabsTrigger value="lead-templates">Lead templates</TabsTrigger>
          <TabsTrigger value="backup">Backup & restore</TabsTrigger>
          <TabsTrigger value="trash">Recently deleted</TabsTrigger>
        </TabsList>

        <TabsContent value="gym">
          <Card>
            <CardHeader><CardTitle className="text-base">Gym profile</CardTitle><CardDescription>Shown on invoices and WhatsApp templates.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Gym name</Label><Input value={gymForm.name} onChange={(e) => setGymForm(f => ({...f, name: e.target.value}))} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Tagline</Label><Input value={gymForm.tagline} onChange={(e) => setGymForm(f => ({...f, tagline: e.target.value}))} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={gymForm.phone} onChange={(e) => setGymForm(f => ({...f, phone: e.target.value}))} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={gymForm.email} onChange={(e) => setGymForm(f => ({...f, email: e.target.value}))} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Textarea value={gymForm.address} onChange={(e) => setGymForm(f => ({...f, address: e.target.value}))} /></div>
              <div className="space-y-2"><Label>Currency symbol</Label><Input value={gymForm.currency_symbol} onChange={(e) => setGymForm(f => ({...f, currency_symbol: e.target.value}))} /></div>
              <div className="space-y-2"><Label>WhatsApp country code</Label><Input value={gymForm.whatsapp_country_code} onChange={(e) => setGymForm(f => ({...f, whatsapp_country_code: e.target.value}))} /></div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Invoice terms & conditions</Label>
                <Textarea
                  rows={8}
                  value={gymForm.invoice_terms}
                  onChange={(e) => setGymForm(f => ({...f, invoice_terms: e.target.value}))}
                  placeholder="One item per line. Shown at the bottom of every invoice PDF."
                />
                <p className="text-xs text-muted-foreground">Appears on every invoice PDF (membership, PT, ad-hoc). Use short bullet lines.</p>
              </div>
              <div className="sm:col-span-2 flex justify-end"><Button className="gradient-primary text-primary-foreground" onClick={saveGym}>Save</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader><CardTitle className="text-base">Membership plans</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {(plans ?? []).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.duration_months} mo · ₹{p.price}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={p.active ? "border-success/30 text-success" : "text-muted-foreground"}>{p.active ? "Active" : "Off"}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => togglePlan(p.id, p.active)}>{p.active ? "Disable" : "Enable"}</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t pt-6">
                <div className="text-sm font-semibold mb-2">Add plan</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <Input placeholder="Name" value={newPlan.name} onChange={(e) => setNewPlan(p => ({...p, name: e.target.value}))} />
                  <Input type="number" placeholder="Months" value={newPlan.duration_months} onChange={(e) => setNewPlan(p => ({...p, duration_months: Number(e.target.value)}))} />
                  <Input type="number" placeholder="Price" value={newPlan.price} onChange={(e) => setNewPlan(p => ({...p, price: Number(e.target.value)}))} />
                  <Button onClick={addPlan} className="gradient-primary text-primary-foreground">Add plan</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="member-templates">
          <MemberTemplatesEditor gym={gym as unknown as { id?: number; templates?: Record<string, string> } | null | undefined} onSaved={() => qc.invalidateQueries({ queryKey: ["gym-settings"] })} />
        </TabsContent>

        <TabsContent value="stages">
          <LeadStagesSettings />
        </TabsContent>

        <TabsContent value="lead-templates">
          <LeadTemplatesSettings />
        </TabsContent>



        <TabsContent value="backup">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Export</CardTitle>
                <CardDescription>Download all data as JSON. Store it safely.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={exportJson} className="gradient-primary text-primary-foreground"><Download className="h-4 w-4 mr-1" /> Download backup</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Restore</CardTitle>
                <CardDescription>Import from a JSON backup. Duplicates are detected by phone.</CardDescription>
              </CardHeader>
              <CardContent>
                <input ref={fileRef} type="file" accept="application/json" onChange={onFile} className="hidden" />
                <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Choose file…</Button>
              </CardContent>
            </Card>
          </div>

          {restore && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Restore preview — {restore.totalInFile} records read</AlertTitle>
              <AlertDescription className="space-y-3">
                <div className="text-sm">
                  <strong>{restore.toAdd.length}</strong> new to insert ·{" "}
                  <strong>{restore.toUpdate.length}</strong> already in database (skip) ·{" "}
                  <strong>{restore.dupInFile.length}</strong> duplicate phones in file ·{" "}
                  <strong>{restore.invalid.length}</strong> missing required fields
                </div>

                {restore.invalid.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium text-destructive">
                      Missing required fields ({restore.invalid.length})
                    </summary>
                    <ul className="mt-2 max-h-40 overflow-auto space-y-0.5 pl-4 list-disc">
                      {restore.invalid.map((r, i) => (
                        <li key={i}>{r.name} — {r.phone} <span className="text-muted-foreground">({r.reason})</span></li>
                      ))}
                    </ul>
                  </details>
                )}
                {restore.dupInFile.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">
                      Duplicate phones in file ({restore.dupInFile.length})
                    </summary>
                    <ul className="mt-2 max-h-40 overflow-auto space-y-0.5 pl-4 list-disc">
                      {restore.dupInFile.map((r, i) => (
                        <li key={i}>{r.name} — {r.phone}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {restore.toUpdate.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">
                      Already exist in database ({restore.toUpdate.length})
                    </summary>
                    <ul className="mt-2 max-h-40 overflow-auto space-y-0.5 pl-4 list-disc">
                      {restore.toUpdate.map((r, i) => (
                        <li key={i}>{r.name} — {r.phone}</li>
                      ))}
                    </ul>
                  </details>
                )}

                <label className="flex items-center gap-2 text-xs mt-2 cursor-pointer">
                  <input type="checkbox" checked={forceAll} onChange={(e) => setForceAll(e.target.checked)} />
                  <span>Force insert all valid rows (ignore duplicates — will create duplicate members you can clean up later)</span>
                </label>

                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={doRestore} disabled={restoring} className="gradient-primary text-primary-foreground">
                    {restoring ? "Restoring…" : `Restore ${forceAll ? restore.allValid.length : restore.toAdd.length} members`}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setRestore(null); setForceAll(false); }}>Cancel</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {importResult && (
            <Alert className="mt-4">
              <AlertTitle>Import audit log</AlertTitle>
              <AlertDescription className="space-y-3">
                <div className="text-sm grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div><div className="text-xs text-muted-foreground">Read from file</div><div className="font-semibold">{importResult.read}</div></div>
                  <div><div className="text-xs text-muted-foreground">Inserted</div><div className="font-semibold text-success">{importResult.inserted}</div></div>
                  <div><div className="text-xs text-muted-foreground">Skipped (exists)</div><div className="font-semibold">{importResult.skippedExisting}</div></div>
                  <div><div className="text-xs text-muted-foreground">Dup in file</div><div className="font-semibold">{importResult.skippedDupInFile}</div></div>
                  <div><div className="text-xs text-muted-foreground">Invalid</div><div className="font-semibold text-destructive">{importResult.skippedInvalid}</div></div>
                </div>
                {importResult.invalid.length > 0 && (
                  <details className="text-xs" open>
                    <summary className="cursor-pointer font-medium text-destructive">
                      Skipped — missing required fields ({importResult.invalid.length})
                    </summary>
                    <ul className="mt-2 max-h-56 overflow-auto space-y-0.5 pl-4 list-disc">
                      {importResult.invalid.map((r, i) => (
                        <li key={i}>{r.name} — {r.phone} <span className="text-muted-foreground">({r.reason})</span></li>
                      ))}
                    </ul>
                  </details>
                )}
                {importResult.dupInFile.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">
                      Skipped — duplicate phone in file ({importResult.dupInFile.length})
                    </summary>
                    <ul className="mt-2 max-h-56 overflow-auto space-y-0.5 pl-4 list-disc">
                      {importResult.dupInFile.map((r, i) => (<li key={i}>{r.name} — {r.phone}</li>))}
                    </ul>
                  </details>
                )}
                {importResult.skippedExistingList.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">
                      Skipped — already exists in database ({importResult.skippedExistingList.length})
                    </summary>
                    <ul className="mt-2 max-h-56 overflow-auto space-y-0.5 pl-4 list-disc">
                      {importResult.skippedExistingList.map((r, i) => (<li key={i}>{r.name} — {r.phone}</li>))}
                    </ul>
                  </details>
                )}
                <Button size="sm" variant="ghost" onClick={() => setImportResult(null)}>Dismiss</Button>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="trash">
          <RecentlyDeleted />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const TEMPLATE_META: { key: string; label: string; hint: string }[] = [
  { key: "welcome", label: "Welcome", hint: "Sent after a new member joins. Variables: {{name}}, {{plan}}, {{expiry}}, {{gym}}" },
  { key: "renewal", label: "Renewal reminder (dynamic)", hint: "Used for any upcoming expiry. {{days_left}} is calculated live from today's date every time you open the message — never stored. Variables: {{name}}, {{plan_type}}, {{expiry_date}}, {{days_left}}, {{gym}}" },
  { key: "renewal_expired", label: "Membership expired (dynamic)", hint: "Auto-picked when you choose the renewal template for a member whose expiry has already passed. Variables: {{name}}, {{plan_type}}, {{expiry_date}}, {{days_overdue}}, {{gym}}" },
  { key: "invoice", label: "Invoice share", hint: "Variables: {{name}}, {{invoice_number}}, {{amount}}, {{currency}}, {{invoice_link}}, {{gym}}" },
  { key: "payment_due", label: "Payment due", hint: "Variables: {{name}}, {{balance}}, {{currency}}, {{gym}}" },
];

function MemberTemplatesEditor({ gym, onSaved }: { gym: { id?: number; templates?: Record<string, string> } | null | undefined; onSaved: () => void }) {
  const initial: Record<string, string> = (gym?.templates as Record<string, string>) ?? {};
  const [drafts, setDrafts] = useState<Record<string, string>>(initial);
  useEffect(() => { setDrafts((gym?.templates as Record<string, string>) ?? {}); }, [gym]);

  const save = async (key: string) => {
    if (!gym?.id) return;
    const next = { ...((gym.templates as Record<string, string>) ?? {}), [key]: drafts[key] ?? "" };
    const { error } = await supabase.from("gym_settings").update({ templates: next, updated_at: new Date().toISOString() }).eq("id", gym.id);
    if (error) return toast.error(error.message);
    toast.success(`${key} saved`);
    onSaved();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Member WhatsApp templates</CardTitle>
        <CardDescription>Edit wording freely — variables in double braces are filled in live each time a message is generated. {"{{days_left}}"} is always calculated from today's date and the member's expiry.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {TEMPLATE_META.map(t => (
          <div key={t.key} className="p-3 rounded-lg border space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-[10px]">{t.key}</Badge>
              <span className="text-sm font-medium">{t.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t.hint}</p>
            <Textarea
              rows={3}
              value={drafts[t.key] ?? ""}
              onChange={(e) => setDrafts(d => ({ ...d, [t.key]: e.target.value }))}
              className="font-mono text-sm"
            />
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => save(t.key)}>Save {t.key}</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

