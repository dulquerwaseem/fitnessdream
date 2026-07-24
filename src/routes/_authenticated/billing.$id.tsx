import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { MoneyInput } from "@/components/money-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtCurrency, fmtDate, fmtDateTime } from "@/lib/format";
import { downloadInvoicePdf } from "@/lib/pdf";
import { toast } from "sonner";
import { ArrowLeft, Download, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing/$id")({
  head: () => ({ meta: [{ title: "Invoice — Fitness Dream" }] }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [payAmt, setPayAmt] = useState(0);
  const [payMode, setPayMode] = useState("cash");

  const { data: inv, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => (await supabase.from("invoices").select("*, members(full_name, phone, email), invoice_items(*)").eq("id", id).maybeSingle()).data,
  });
  const { data: pays } = useQuery({
    queryKey: ["invoice-payments", id],
    queryFn: async () => (await supabase.from("payments").select("*").eq("invoice_id", id).is("deleted_at", null).order("paid_at", { ascending: false })).data ?? [],
  });
  const { data: gym } = useQuery({
    queryKey: ["gym-settings"],
    queryFn: async () => (await supabase.from("gym_settings").select("*").maybeSingle()).data,
  });

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (!inv) return <div>Not found. <Link to="/billing" className="text-primary story-link">Back</Link></div>;

  const balance = Number(inv.total) - Number(inv.amount_paid);
  const member = inv.members as { full_name?: string; phone?: string; email?: string } | null;

  const recordPayment = async () => {
    if (payAmt <= 0) return toast.error("Enter amount");
    const newPaid = Number(inv.amount_paid) + payAmt;
    const status = newPaid <= 0 ? "unpaid" : newPaid >= Number(inv.total) ? "paid" : "partial";
    await supabase.from("payments").insert({ invoice_id: id, member_id: inv.member_id, amount: payAmt, mode: payMode as "cash" | "upi" | "card" | "bank_transfer" | "unknown" });
    await supabase.from("invoices").update({ amount_paid: newPaid, status }).eq("id", id);
    if (inv.member_id) {
      const { data: mem } = await supabase.from("members").select("amount_paid, total_fee").eq("id", inv.member_id).maybeSingle();
      if (mem) {
        const newAmt = Number(mem.amount_paid) + payAmt;
        await supabase.from("members").update({ amount_paid: newAmt, balance_due: Math.max(0, Number(mem.total_fee) - newAmt) }).eq("id", inv.member_id);
      }
    }
    toast.success("Payment recorded");
    setPayOpen(false); setPayAmt(0);
    qc.invalidateQueries();
  };

  const items = (inv.invoice_items ?? []) as Array<{ description: string; qty: number; unit_price: number; amount: number }>;

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/billing" })} className="mb-2 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>
      <PageHeader
        title={`Invoice #${inv.number}`}
        description={`Issued ${fmtDate(inv.issued_at)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => downloadInvoicePdf({ invoice: inv, items, member, gym })}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
            {balance > 0 && (
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> Record payment</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-1"><Label>Amount</Label><MoneyInput value={payAmt} onChange={setPayAmt} /></div>
                    <div className="space-y-1"><Label>Mode</Label>
                      <Select value={payMode} onValueChange={setPayMode}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="bank">Bank transfer</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">Outstanding: {fmtCurrency(balance)}</p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
                    <Button className="gradient-primary text-primary-foreground" onClick={recordPayment}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Line items</CardTitle>
            <Badge variant="outline" className="capitalize">{inv.status}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {items.map((it, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">{it.description}</div>
                    <div className="text-xs text-muted-foreground">{it.qty} × {fmtCurrency(it.unit_price)}</div>
                  </div>
                  <div className="font-semibold">{fmtCurrency(it.amount)}</div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex justify-between items-center">
              <span className="text-muted-foreground">Total</span>
              <span className="text-xl font-display font-bold">{fmtCurrency(inv.total)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card><CardContent className="p-4 space-y-2 text-sm">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Billed to</div>
            <div className="font-semibold">{member?.full_name ?? "Walk-in"}</div>
            {member?.phone && <div className="text-muted-foreground">{member.phone}</div>}
            {member?.email && <div className="text-muted-foreground">{member.email}</div>}
          </CardContent></Card>

          <Card><CardContent className="p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="text-success font-medium">{fmtCurrency(inv.amount_paid)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span className={balance > 0 ? "text-destructive font-medium" : "text-success font-medium"}>{fmtCurrency(balance)}</span></div>
          </CardContent></Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Payments</CardTitle></CardHeader>
            <CardContent className="p-0">
              {(pays?.length ?? 0) === 0 ? (
                <div className="p-4 text-xs text-muted-foreground text-center">No payments yet</div>
              ) : (
                <div className="divide-y">
                  {pays!.map(p => (
                    <div key={p.id} className="p-3 flex justify-between items-center text-sm">
                      <div><div>{fmtCurrency(p.amount)}</div><div className="text-xs text-muted-foreground">{fmtDateTime(p.paid_at)} · {p.mode}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
