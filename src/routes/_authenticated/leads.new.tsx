import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { normalizePhone } from "@/lib/phone";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leads/new")({
  head: () => ({
    meta: [
      { title: "Add lead — Fitness Dream" },
      { name: "description", content: "Capture a new prospect and add them to your lead pipeline." },
    ],
  }),
  component: NewLeadPage,
});

const sources = [
  { v: "walk_in", l: "Walk-in" },
  { v: "phone_inquiry", l: "Phone Inquiry" },
  { v: "referral", l: "Referral" },
  { v: "instagram", l: "Instagram" },
  { v: "google", l: "Google" },
  { v: "whatsapp_inquiry", l: "WhatsApp inquiry" },
  { v: "other", l: "Other" },
] as const;

function NewLeadPage() {
  const navigate = useNavigate();
  const { data: plans } = useQuery({
    queryKey: ["plans-active"],
    queryFn: async () => (await supabase.from("plans").select("*").eq("active", true).order("duration_months")).data ?? [],
  });
  const { data: stages } = useQuery({
    queryKey: ["lead-stages"],
    queryFn: async () => (await supabase.from("lead_stages").select("*").order("order_index")).data ?? [],
  });
  const firstStageId = stages?.[0]?.id ?? "";

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    source: "walk_in" as (typeof sources)[number]["v"],
    interested_plan_id: "",
    stage_id: "",
    next_follow_up_at: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (firstStageId && !form.stage_id) setForm(f => ({ ...f, stage_id: firstStageId }));
  }, [firstStageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    setSaving(true);
    const plan = plans?.find(p => p.id === form.interested_plan_id);
    const { data, error } = await supabase.from("leads").insert({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      phone_normalized: normalizePhone(form.phone),
      email: form.email || null,
      source: form.source,
      interested_plan_id: form.interested_plan_id || null,
      interested_plan_name: plan?.name ?? null,
      stage_id: form.stage_id || null,
      next_follow_up_at: form.next_follow_up_at || null,
      notes: form.notes || null,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Lead added");
    navigate({ to: "/leads/$id", params: { id: data.id } });
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add lead" description="Capture a new prospect." />
      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required /></div>
            <div className="space-y-2"><Label>Phone *</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} required placeholder="+91 98765 43210" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Pipeline</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => set("source", v as typeof form.source)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{sources.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={form.stage_id} onValueChange={(v) => set("stage_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>{stages?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Interested plan</Label>
              <Select value={form.interested_plan_id} onValueChange={(v) => set("interested_plan_id", v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{plans?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Next follow-up</Label>
              <Input type="datetime-local" value={form.next_follow_up_at} onChange={(e) => set("next_follow_up_at", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything relevant — goals, availability, referrer…" /></div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/leads" })}>Cancel</Button>
          <Button type="submit" className="gradient-primary text-primary-foreground" disabled={saving}>{saving ? "Saving…" : "Create lead"}</Button>
        </div>
      </form>
    </div>
  );
}
