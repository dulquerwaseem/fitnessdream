import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { MoneyInput } from "@/components/money-input";
import { normalizePhone } from "@/lib/phone";
import { addMonthsISO, fmtCurrency, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({ leadId: z.string().optional() });

export const Route = createFileRoute("/_authenticated/members/new")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Add member — Fitness Dream" },
      { name: "description", content: "Add a new member to Fitness Dream." },
    ],
  }),
  component: NewMemberPage,
});

function NewMemberPage() {
  const navigate = useNavigate();
  const { leadId } = Route.useSearch();
  const { data: plans } = useQuery({
    queryKey: ["plans-active"],
    queryFn: async () => (await supabase.from("plans").select("*").eq("active", true).order("duration_months")).data ?? [],
  });
  const { data: trainers } = useQuery({
    queryKey: ["trainers"],
    queryFn: async () => (await supabase.from("staff").select("id, full_name").is("deleted_at", null).eq("active", true)).data ?? [],
  });
  const { data: lead } = useQuery({
    queryKey: ["lead-for-convert", leadId],
    enabled: !!leadId,
    queryFn: async () => (await supabase.from("leads").select("*").eq("id", leadId!).maybeSingle()).data,
  });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    dob: "",
    emergency_contact: "",
    plan_id: "",
    total_fee: 0,
    paid_cash: 0,
    paid_upi: 0,
    bonus_months: 0,
    start_date: todayISO(),
    trainer_id: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setForm(f => ({
        ...f,
        full_name: lead.full_name ?? f.full_name,
        phone: lead.phone ?? f.phone,
        email: lead.email ?? f.email,
        plan_id: lead.interested_plan_id ?? f.plan_id,
        notes: lead.notes ?? f.notes,
      }));
    }
  }, [lead]);

  const chosenPlan = plans?.find((p) => p.id === form.plan_id);
  const expiry = chosenPlan && form.start_date ? addMonthsISO(form.start_date, chosenPlan.duration_months + form.bonus_months) : "";
  const amountPaid = Number(form.paid_cash) + Number(form.paid_upi);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    setSaving(true);
    const balance = Math.max(0, Number(form.total_fee) - amountPaid);
    const { data: member, error } = await supabase
      .from("members")
      .insert({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        phone_normalized: normalizePhone(form.phone),
        email: form.email || null,
        address: form.address || null,
        dob: form.dob || null,
        emergency_contact: form.emergency_contact || null,
        plan_id: form.plan_id || null,
        plan_type: chosenPlan?.name ?? null,
        total_fee: Number(form.total_fee),
        amount_paid: amountPaid,
        balance_due: balance,
        start_date: form.start_date,
        expiry_date: expiry || addMonthsISO(form.start_date, 1 + form.bonus_months),
        bonus_months: form.bonus_months,
        trainer_id: form.trainer_id || null,
        notes: form.notes || null,
      })
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    // Auto-create invoice + payment
    if (Number(form.total_fee) > 0) {
      const { data: inv } = await supabase
        .from("invoices")
        .insert({
          member_id: member.id,
          subtotal: Number(form.total_fee),
          total: Number(form.total_fee),
          amount_paid: amountPaid,
          status: amountPaid <= 0 ? "unpaid" : amountPaid >= Number(form.total_fee) ? "paid" : "partial",
          notes: `Membership: ${chosenPlan?.name ?? "custom"}${form.bonus_months ? ` (+${form.bonus_months} bonus month${form.bonus_months > 1 ? "s" : ""})` : ""}`,
          period_start: form.start_date,
          period_end: expiry || addMonthsISO(form.start_date, 1 + form.bonus_months),
          paid_cash: Number(form.paid_cash),
          paid_upi: Number(form.paid_upi),
        })
        .select("id")
        .single();
      if (inv) {
        await supabase.from("invoice_items").insert({
          invoice_id: inv.id,
          description: `Membership — ${chosenPlan?.name ?? "custom"}`,
          qty: 1,
          unit_price: Number(form.total_fee),
          amount: Number(form.total_fee),
        });
      }
      const payRows = [
        ...(form.paid_cash > 0 ? [{ member_id: member.id, invoice_id: inv?.id ?? null, amount: Number(form.paid_cash), mode: "cash" as const }] : []),
        ...(form.paid_upi > 0 ? [{ member_id: member.id, invoice_id: inv?.id ?? null, amount: Number(form.paid_upi), mode: "upi" as const }] : []),
      ];
      if (payRows.length) await supabase.from("payments").insert(payRows);
    }

    if (leadId) {
      // Find converted stage and link the lead
      const { data: convertedStage } = await supabase.from("lead_stages").select("id").eq("is_converted", true).limit(1).maybeSingle();
      await supabase.from("leads").update({
        converted_member_id: member.id,
        converted_at: new Date().toISOString(),
        stage_id: convertedStage?.id ?? undefined,
      }).eq("id", leadId);
      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        kind: "system",
        body: `Converted to member ${form.full_name}`,
      });
    }

    setSaving(false);
    toast.success(leadId ? "Lead converted to member" : "Member added");
    navigate({ to: "/members/$id", params: { id: member.id } });
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add member" description="Create a new membership record." />
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required /></div>
            <div className="space-y-2"><Label>Phone *</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} required placeholder="+91 98765 43210" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div className="space-y-2"><Label>Date of birth</Label><Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} /></div>
            <div className="space-y-2"><Label>Emergency contact</Label><Input value={form.emergency_contact} onChange={(e) => set("emergency_contact", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Membership</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={form.plan_id} onValueChange={(v) => set("plan_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>{plans?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assigned trainer</Label>
              <Select value={form.trainer_id} onValueChange={(v) => set("trainer_id", v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{trainers?.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Extra / bonus months</Label>
              <Select value={String(form.bonus_months)} onValueChange={(v) => set("bonus_months", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : `+${n} month${n > 1 ? "s" : ""} (free)`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>End date (auto)</Label><Input value={expiry} readOnly className="bg-muted/50" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Total plan fee</Label><MoneyInput step="0.01" value={form.total_fee} onChange={(v) => set("total_fee", v)} /></div>
            <div className="space-y-2"><Label>Amount paid in Cash (INR)</Label><MoneyInput step="0.01" value={form.paid_cash} onChange={(v) => set("paid_cash", v)} /></div>
            <div className="space-y-2"><Label>Amount paid via UPI (INR)</Label><MoneyInput step="0.01" value={form.paid_upi} onChange={(v) => set("paid_upi", v)} /></div>
            <div className="sm:col-span-2 flex items-center justify-between text-sm border-t pt-3">
              <span className="text-muted-foreground">Amount paid now</span>
              <span className="font-semibold tabular-nums">{fmtCurrency(amountPaid)}</span>
            </div>
            <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/members" })}>Cancel</Button>
          <Button type="submit" className="gradient-primary text-primary-foreground" disabled={saving}>{saving ? "Saving…" : "Create member"}</Button>
        </div>
      </form>
    </div>
  );
}
