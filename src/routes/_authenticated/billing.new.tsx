import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { MoneyInput } from "@/components/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtCurrency } from "@/lib/format";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/billing/new")({
  head: () => ({ meta: [{ title: "New invoice — Fitness Dream" }] }),
  component: NewInvoicePage,
});

type Line = { description: string; qty: number; unit_price: number };

function NewInvoicePage() {
  const navigate = useNavigate();
  const { data: members } = useQuery({
    queryKey: ["members-brief"],
    queryFn: async () => (await supabase.from("members").select("id, full_name, phone").is("deleted_at", null).order("full_name")).data ?? [],
  });

  const [memberId, setMemberId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ description: "Membership", qty: 1, unit_price: 0 }]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);

  const save = async () => {
    if (subtotal <= 0) return toast.error("Add at least one line");
    setSaving(true);
    const status = amountPaid <= 0 ? "unpaid" : amountPaid >= subtotal ? "paid" : "partial";
    const { data: inv, error } = await supabase.from("invoices").insert({
      member_id: memberId || null,
      subtotal, total: subtotal, amount_paid: amountPaid, status, notes: notes || null,
    }).select("id").single();
    if (error || !inv) { setSaving(false); return toast.error(error?.message ?? "Failed"); }

    await supabase.from("invoice_items").insert(
      lines.map(l => ({ invoice_id: inv.id, description: l.description, qty: l.qty, unit_price: l.unit_price, amount: l.qty * l.unit_price }))
    );
    if (amountPaid > 0) {
      await supabase.from("payments").insert({ member_id: memberId || null, invoice_id: inv.id, amount: amountPaid, mode: "cash" });
    }
    toast.success("Invoice created");
    navigate({ to: "/billing/$id", params: { id: inv.id } });
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="New invoice" />
      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Member (optional)</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger><SelectValue placeholder="Walk-in / no member" /></SelectTrigger>
              <SelectContent>{members?.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name} · {m.phone}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-6" placeholder="Description" value={l.description} onChange={(e) => setLines(ls => ls.map((x,j) => j===i ? {...x, description: e.target.value} : x))} />
                <MoneyInput className="col-span-2" placeholder="Qty" value={l.qty} onChange={(v) => setLines(ls => ls.map((x,j) => j===i ? {...x, qty: v} : x))} />
                <MoneyInput className="col-span-3" placeholder="Price" value={l.unit_price} onChange={(v) => setLines(ls => ls.map((x,j) => j===i ? {...x, unit_price: v} : x))} />
                <Button size="icon" variant="ghost" className="col-span-1" onClick={() => setLines(ls => ls.filter((_,j) => j!==i))} disabled={lines.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setLines(ls => [...ls, { description: "", qty: 1, unit_price: 0 }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add line
            </Button>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-xl font-display font-bold">{fmtCurrency(subtotal)}</span>
          </div>

          <div className="space-y-2"><Label>Amount paid now</Label><MoneyInput value={amountPaid} onChange={setAmountPaid} /></div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline" onClick={() => navigate({ to: "/billing" })}>Cancel</Button>
        <Button className="gradient-primary text-primary-foreground" onClick={save} disabled={saving}>{saving ? "Saving…" : "Create invoice"}</Button>
      </div>
    </div>
  );
}
