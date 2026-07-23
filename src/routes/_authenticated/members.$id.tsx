import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { fmtCurrency, fmtDate, fmtDateTime, initials, addMonthsISO, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Phone, Mail, MapPin, Cake, Snowflake, Play, RefreshCcw, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/members/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Member — Fitness Dream` },
      { name: "description", content: `Member profile ${params.id}` },
    ],
  }),
  component: MemberDetail,
});

const statusStyles: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  expiring_soon: "bg-warning/15 text-warning border-warning/30",
  expired: "bg-destructive/10 text-destructive border-destructive/30",
  frozen: "bg-muted text-muted-foreground border-border",
};

function MemberDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: m, isLoading } = useQuery({
    queryKey: ["member", id],
    queryFn: async () => (await supabase.from("members_with_status").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: payments } = useQuery({
    queryKey: ["member-payments", id],
    queryFn: async () => (await supabase.from("payments").select("*").eq("member_id", id).order("paid_at", { ascending: false })).data ?? [],
  });
  const { data: att } = useQuery({
    queryKey: ["member-att", id],
    queryFn: async () => (await supabase.from("attendance").select("*").eq("subject_id", id).eq("subject_type", "member").order("check_in", { ascending: false }).limit(30)).data ?? [],
  });
  const { data: plans } = useQuery({
    queryKey: ["plans-active"],
    queryFn: async () => (await supabase.from("plans").select("*").eq("active", true).order("duration_months")).data ?? [],
  });

  const [renewOpen, setRenewOpen] = useState(false);
  const [renewPlan, setRenewPlan] = useState("");
  const [renewPaid, setRenewPaid] = useState(0);

  if (isLoading) return <div><Skeleton className="h-40 rounded-xl" /></div>;
  if (!m) return <div className="text-center py-16 text-muted-foreground">Member not found. <Link to="/members" className="text-primary story-link">Back to list</Link></div>;

  const freezeToggle = async () => {
    const next = !m.frozen;
    const { error } = await supabase.from("members").update({ frozen: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(next ? "Membership frozen" : "Membership resumed");
    qc.invalidateQueries({ queryKey: ["member", id] });
  };

  const quickCheckIn = async () => {
    const { error } = await supabase.from("attendance").insert({ subject_id: id, subject_type: "member" });
    if (error) return toast.error(error.message);
    toast.success("Checked in");
    qc.invalidateQueries({ queryKey: ["member-att", id] });
  };

  const handleRenew = async () => {
    const plan = plans?.find((p) => p.id === renewPlan);
    if (!plan) return toast.error("Select a plan");
    const start = todayISO();
    const expiry = addMonthsISO(start, plan.duration_months);
    const total = Number(plan.price);
    const paid = Number(renewPaid);
    const balance = Math.max(0, total - paid);

    await supabase.from("members").update({
      plan_id: plan.id,
      plan_type: plan.name,
      start_date: start,
      expiry_date: expiry,
      total_fee: total,
      amount_paid: paid,
      balance_due: balance,
      frozen: false,
    }).eq("id", id);

    const { data: inv } = await supabase.from("invoices").insert({
      member_id: id,
      subtotal: total,
      total,
      amount_paid: paid,
      status: balance === 0 ? "paid" : paid > 0 ? "partial" : "unpaid",
      notes: `Renewal: ${plan.name}`,
    }).select("id").single();
    if (inv) {
      await supabase.from("invoice_items").insert({
        invoice_id: inv.id, description: `Renewal — ${plan.name}`, qty: 1, unit_price: total, amount: total,
      });
    }
    if (paid > 0) {
      await supabase.from("payments").insert({ member_id: id, invoice_id: inv?.id ?? null, amount: paid, mode: "cash" });
    }
    toast.success("Membership renewed");
    setRenewOpen(false);
    qc.invalidateQueries();
  };

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/members" })} className="mb-2 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="p-6 text-center">
            <Avatar className="h-24 w-24 mx-auto mb-4">
              {m.photo_url ? <img src={m.photo_url} alt={m.full_name!} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-display font-bold">{initials(m.full_name)}</AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-display font-bold">{m.full_name}</h2>
            <Badge variant="outline" className={`mt-2 capitalize ${statusStyles[m.status!] ?? ""}`}>
              {String(m.status).replace("_", " ")}
            </Badge>

            <div className="mt-6 space-y-2 text-left text-sm">
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {m.phone}</div>
              {m.email ? <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {m.email}</div> : null}
              {m.address ? <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground shrink-0" /> <span className="truncate">{m.address}</span></div> : null}
              {m.dob ? <div className="flex items-center gap-2"><Cake className="h-4 w-4 text-muted-foreground" /> {fmtDate(m.dob)}</div> : null}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <WhatsAppButton phone={m.phone!} memberId={m.id!} message={`Hi ${m.full_name}, this is Fitness Dream.`} />
              <Button size="sm" variant="outline" onClick={quickCheckIn}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Check-in</Button>
              <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gradient-primary text-primary-foreground col-span-2"><RefreshCcw className="h-3.5 w-3.5 mr-1" /> Renew</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Renew membership</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Plan</Label>
                      <Select value={renewPlan} onValueChange={(v) => { setRenewPlan(v); const p = plans?.find(pl => pl.id === v); if (p) setRenewPaid(Number(p.price)); }}>
                        <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                        <SelectContent>{plans?.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — ₹{p.price}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Amount paid</Label><Input type="number" value={renewPaid} onChange={(e) => setRenewPaid(Number(e.target.value))} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRenewOpen(false)}>Cancel</Button>
                    <Button className="gradient-primary text-primary-foreground" onClick={handleRenew}>Renew</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button size="sm" variant="outline" onClick={freezeToggle} className="col-span-2">
                {m.frozen ? <><Play className="h-3.5 w-3.5 mr-1" /> Resume</> : <><Snowflake className="h-3.5 w-3.5 mr-1" /> Freeze</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Plan</div><div className="font-semibold">{m.plan_type ?? "—"}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Expiry</div><div className="font-semibold">{fmtDate(m.expiry_date)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total fee</div><div className="font-semibold">{fmtCurrency(m.total_fee)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Balance due</div><div className={`font-semibold ${Number(m.balance_due) > 0 ? "text-destructive" : "text-success"}`}>{fmtCurrency(m.balance_due)}</div></CardContent></Card>
          </div>

          <Tabs defaultValue="payments">
            <TabsList>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="payments">
              <Card>
                <CardHeader><CardTitle className="text-base">Payment history</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {(payments?.length ?? 0) === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">No payments yet.</div>
                  ) : (
                    <div className="divide-y">
                      {payments!.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-4">
                          <div>
                            <div className="font-medium">{fmtCurrency(p.amount)}</div>
                            <div className="text-xs text-muted-foreground">{fmtDateTime(p.paid_at)} · {p.mode}</div>
                          </div>
                          <Badge variant="outline">Paid</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="attendance">
              <Card>
                <CardHeader><CardTitle className="text-base">Recent check-ins</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {(att?.length ?? 0) === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">No check-ins recorded.</div>
                  ) : (
                    <div className="divide-y">
                      {att!.map((a) => (
                        <div key={a.id} className="flex items-center justify-between p-4">
                          <div className="text-sm">{fmtDateTime(a.check_in)}</div>
                          {a.check_out ? <Badge variant="outline">Out {fmtDateTime(a.check_out)}</Badge> : <Badge className="bg-success/15 text-success border-success/30" variant="outline">In</Badge>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="notes">
              <Card><CardContent className="p-6 text-sm whitespace-pre-wrap min-h-[80px]">{m.notes || <span className="text-muted-foreground">No notes.</span>}</CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
