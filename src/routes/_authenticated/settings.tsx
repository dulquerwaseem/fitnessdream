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

  const [gymForm, setGymForm] = useState({ name: "", tagline: "", phone: "", email: "", address: "", currency_symbol: "₹", whatsapp_country_code: "+91" });
  useEffect(() => {
    if (gym) setGymForm({
      name: gym.name ?? "", tagline: gym.tagline ?? "", phone: gym.phone ?? "",
      email: gym.email ?? "", address: gym.address ?? "",
      currency_symbol: gym.currency_symbol ?? "₹", whatsapp_country_code: gym.whatsapp_country_code ?? "+91",
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
      supabase.from("members").select("*"),
      supabase.from("staff").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("invoices").select("*, invoice_items(*)"),
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
  const [restore, setRestore] = useState<{ members: BackupMember[]; preview: { toAdd: BackupMember[]; toSkip: BackupMember[]; toUpdate: BackupMember[] } } | null>(null);
  const [restoring, setRestoring] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const members: BackupMember[] = data.members ?? [];
      if (!Array.isArray(members)) throw new Error("Invalid backup: members array missing");

      // Dedupe by normalized phone
      const norm = members.map(m => ({ ...m, phone_normalized: normalizePhone(m.phone) })).filter(m => m.phone_normalized);
      const phones = norm.map(m => m.phone_normalized);
      const { data: existing } = await supabase.from("members").select("phone_normalized").in("phone_normalized", phones);
      const existingSet = new Set((existing ?? []).map(x => x.phone_normalized));

      const seen = new Set<string>();
      const toAdd: BackupMember[] = [];
      const toSkip: BackupMember[] = [];
      const toUpdate: BackupMember[] = [];
      for (const m of norm) {
        if (seen.has(m.phone_normalized)) { toSkip.push(m); continue; }
        seen.add(m.phone_normalized);
        if (existingSet.has(m.phone_normalized)) toUpdate.push(m);
        else toAdd.push(m);
      }
      setRestore({ members: norm, preview: { toAdd, toSkip, toUpdate } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doRestore = async () => {
    if (!restore) return;
    setRestoring(true);
    const rows = restore.preview.toAdd.map(m => ({
      full_name: m.full_name,
      phone: m.phone,
      phone_normalized: normalizePhone(m.phone),
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
    if (rows.length) {
      const { error } = await supabase.from("members").insert(rows);
      if (error) { setRestoring(false); return toast.error(error.message); }
    }
    setRestoring(false);
    setRestore(null);
    toast.success(`Restored ${rows.length} members`);
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
          <TabsTrigger value="stages">Lead pipeline</TabsTrigger>
          <TabsTrigger value="lead-templates">Lead templates</TabsTrigger>
          <TabsTrigger value="backup">Backup & restore</TabsTrigger>
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
              <AlertTitle>Restore preview</AlertTitle>
              <AlertDescription className="space-y-2">
                <div className="text-sm">
                  <strong>{restore.preview.toAdd.length}</strong> new · <strong>{restore.preview.toUpdate.length}</strong> already exist (will skip to protect current data) · <strong>{restore.preview.toSkip.length}</strong> duplicate phones in file
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={doRestore} disabled={restoring} className="gradient-primary text-primary-foreground">
                    {restoring ? "Restoring…" : `Restore ${restore.preview.toAdd.length} members`}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRestore(null)}>Cancel</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
