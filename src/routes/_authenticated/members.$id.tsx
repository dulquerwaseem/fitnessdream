import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppButton } from "@/components/whatsapp-button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { fmtCurrency, fmtDate, fmtDateTime, initials, addMonthsISO, todayISO } from "@/lib/format";
import { normalizePhone, openWhatsApp, renderTemplate } from "@/lib/phone";
import { downloadInvoicePdf, generateInvoicePdf } from "@/lib/pdf";
import { softDelete } from "@/lib/soft-delete";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { MoneyInput } from "@/components/money-input";
import { toast } from "sonner";
import {
  ArrowLeft, Phone, Mail, MapPin, Cake, Snowflake, Play, RefreshCcw,
  Pencil, Plus, FileText, Download, Send, MessageCircle, Activity, Trash2,
} from "lucide-react";

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

function computeStatus(m: any): string {
  if (!m) return "expired";
  if (m.frozen_at) return "frozen";
  const today = todayISO();
  if (!m.expiry_date) return "expired";
  if (m.expiry_date < today) return "expired";
  const soon = new Date(); soon.setDate(soon.getDate() + 7);
  if (m.expiry_date <= soon.toISOString().slice(0, 10)) return "expiring_soon";
  return "active";
}

function MemberDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: m, isLoading } = useQuery({
    queryKey: ["member", id],
    queryFn: async () => (await supabase.from("members").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: invoices } = useQuery({
    queryKey: ["member-invoices", id],
    queryFn: async () => (await supabase.from("invoices").select("*").eq("member_id", id).is("deleted_at", null).order("issued_at", { ascending: false })).data ?? [],
  });
  const { data: payments } = useQuery({
    queryKey: ["member-payments", id],
    queryFn: async () => (await supabase.from("payments").select("*").eq("member_id", id).is("deleted_at", null).order("paid_at", { ascending: false })).data ?? [],
  });
  const { data: plans } = useQuery({
    queryKey: ["plans-active"],
    queryFn: async () => (await supabase.from("plans").select("*").eq("active", true).order("duration_months")).data ?? [],
  });
  const { data: trainers } = useQuery({
    queryKey: ["trainers"],
    queryFn: async () => (await supabase.from("staff").select("id, full_name").is("deleted_at", null).eq("active", true)).data ?? [],
  });
  const { data: ptPackages } = useQuery({
    queryKey: ["pt-packages-active"],
    queryFn: async () => (await supabase.from("pt_packages").select("*").eq("active", true)).data ?? [],
  });
  const { data: ptEnrollments } = useQuery({
    queryKey: ["member-pt", id],
    queryFn: async () => (await supabase.from("pt_enrollments").select("*").eq("member_id", id).is("deleted_at", null).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: ptSessions } = useQuery({
    queryKey: ["member-pt-sessions", id],
    queryFn: async () => {
      const { data: enrolls } = await supabase.from("pt_enrollments").select("id").eq("member_id", id).is("deleted_at", null);
      const ids = (enrolls ?? []).map(e => e.id);
      if (!ids.length) return [];
      return (await supabase.from("pt_sessions").select("*").in("enrollment_id", ids).is("deleted_at", null).order("scheduled_at", { ascending: false })).data ?? [];
    },
  });
  const { data: messages } = useQuery({
    queryKey: ["member-messages", id],
    queryFn: async () => (await supabase.from("messages_log").select("*").eq("member_id", id).order("sent_at", { ascending: false })).data ?? [],
  });
  const { data: gym } = useQuery({
    queryKey: ["gym-settings"],
    queryFn: async () => (await supabase.from("gym_settings").select("*").eq("id", 1).maybeSingle()).data,
  });

  // Dialog states
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewPlan, setRenewPlan] = useState("");
  const [renewPaid, setRenewPaid] = useState(0);
  const [renewMode, setRenewMode] = useState<"today" | "extend">("today");

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState<"cash" | "card" | "upi" | "bank_transfer">("cash");
  const [payDate, setPayDate] = useState<string>(todayISO());

  const [invOpen, setInvOpen] = useState(false);
  const [invDesc, setInvDesc] = useState("");
  const [invAmount, setInvAmount] = useState(0);

  const [ptOpen, setPtOpen] = useState(false);
  const [ptPkg, setPtPkg] = useState("");
  const [ptTrainer, setPtTrainer] = useState("");
  const [ptPaid, setPtPaid] = useState(0);

  const [msgOpen, setMsgOpen] = useState(false);
  const [msgTemplateKey, setMsgTemplateKey] = useState<string>("");
  const [msgBody, setMsgBody] = useState("");

  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const status = useMemo(() => computeStatus(m), [m]);
  const currency = gym?.currency_symbol ?? "₹";
  const templates: Record<string, string> = (gym?.templates as any) ?? {};

  const activity = useMemo(() => {
    const events: Array<{ at: string; text: string; icon?: string }> = [];
    if (m?.created_at) events.push({ at: m.created_at, text: `Joined Fitness Dream` });
    if (m?.frozen_at) events.push({ at: m.frozen_at, text: `Membership frozen` });
    (payments ?? []).forEach(p => events.push({ at: p.paid_at, text: `Payment received: ${fmtCurrency(p.amount, currency)} (${p.mode})` }));
    (invoices ?? []).forEach(i => events.push({ at: i.issued_at, text: `Invoice ${i.number} issued: ${fmtCurrency(i.total, currency)} (${i.status})` }));
    (ptEnrollments ?? []).forEach(e => events.push({ at: e.created_at, text: `PT package enrolled (${e.sessions_total} sessions)` }));
    (messages ?? []).forEach(x => events.push({ at: x.sent_at, text: `WhatsApp sent${x.template_key ? ` · ${x.template_key}` : ""}` }));
    return events.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [m, payments, invoices, ptEnrollments, messages, currency]);

  if (isLoading) return <div><Skeleton className="h-40 rounded-xl" /></div>;
  if (!m) return <div className="text-center py-16 text-muted-foreground">Member not found. <Link to="/members" className="text-primary story-link">Back to list</Link></div>;

  const balanceDue = Number(m.balance_due ?? 0);


  const freezeToggle = async () => {
    const isFrozen = !!m.frozen_at;
    const { error } = await supabase.from("members").update({ frozen_at: isFrozen ? null : new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(isFrozen ? "Membership resumed" : "Membership frozen");
    qc.invalidateQueries({ queryKey: ["member", id] });
  };


  const handleRenew = async () => {
    const plan = plans?.find((p) => p.id === renewPlan);
    if (!plan) return toast.error("Select a plan");
    const baseDate = renewMode === "extend" && m.expiry_date && m.expiry_date > todayISO() ? m.expiry_date : todayISO();
    const expiry = addMonthsISO(baseDate, plan.duration_months);
    const start = renewMode === "extend" ? m.start_date : todayISO();
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
      frozen_at: null,
    }).eq("id", id);

    const { data: inv } = await supabase.from("invoices").insert({
      member_id: id, subtotal: total, total, amount_paid: paid,
      status: paid <= 0 ? "unpaid" : paid >= total ? "paid" : "partial",
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

  const openEdit = () => {
    setEditForm({
      full_name: m.full_name ?? "",
      phone: m.phone ?? "",
      email: m.email ?? "",
      address: m.address ?? "",
      dob: m.dob ?? "",
      emergency_contact: m.emergency_contact ?? "",
    });
    setEditOpen(true);
  };
  const saveEdit = async () => {
    if (!editForm.full_name.trim() || !editForm.phone.trim()) return toast.error("Name and phone are required");
    const { error } = await supabase.from("members").update({
      full_name: editForm.full_name.trim(),
      phone: editForm.phone.trim(),
      phone_normalized: normalizePhone(editForm.phone),
      email: editForm.email || null,
      address: editForm.address || null,
      dob: editForm.dob || null,
      emergency_contact: editForm.emergency_contact || null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Details updated");
    setEditOpen(false);
    qc.invalidateQueries({ queryKey: ["member", id] });
  };

  const openPayForInvoice = (inv: any) => {
    setPayInvoiceId(inv.id);
    setPayAmount(Math.max(0, Number(inv.total) - Number(inv.amount_paid)));
    setPayMode("cash");
    setPayDate(todayISO());
    setPayOpen(true);
  };
  const openPayGeneric = () => {
    setPayInvoiceId(null);
    setPayAmount(balanceDue);
    setPayMode("cash");
    setPayDate(todayISO());
    setPayOpen(true);
  };
  const savePayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return toast.error("Enter an amount");
    const paidAt = new Date(payDate + "T" + new Date().toISOString().slice(11, 19)).toISOString();
    const { error } = await supabase.from("payments").insert({
      member_id: id, invoice_id: payInvoiceId, amount, mode: payMode, paid_at: paidAt,
    });
    if (error) return toast.error(error.message);

    if (payInvoiceId) {
      const inv = invoices?.find(i => i.id === payInvoiceId);
      if (inv) {
        const newPaid = Number(inv.amount_paid) + amount;
        const status = newPaid >= Number(inv.total) ? "paid" : newPaid > 0 ? "partial" : "unpaid";
        await supabase.from("invoices").update({ amount_paid: newPaid, status }).eq("id", inv.id);
      }
    }
    // recalc member balance
    const newMemberPaid = Number(m.amount_paid ?? 0) + amount;
    const newBalance = Math.max(0, Number(m.total_fee ?? 0) - newMemberPaid);
    await supabase.from("members").update({ amount_paid: newMemberPaid, balance_due: newBalance }).eq("id", id);

    toast.success("Payment recorded");
    setPayOpen(false);
    qc.invalidateQueries();
  };

  const createInvoice = async () => {
    if (!invDesc.trim() || !invAmount) return toast.error("Description and amount required");
    const total = Number(invAmount);
    const { data: inv } = await supabase.from("invoices").insert({
      member_id: id, subtotal: total, total, amount_paid: 0, status: "unpaid", notes: invDesc.trim(),
    }).select("id").single();
    if (inv) {
      await supabase.from("invoice_items").insert({
        invoice_id: inv.id, description: invDesc.trim(), qty: 1, unit_price: total, amount: total,
      });
    }
    await supabase.from("members").update({
      total_fee: Number(m.total_fee ?? 0) + total,
      balance_due: Number(m.balance_due ?? 0) + total,
    }).eq("id", id);
    toast.success("Invoice created");
    setInvOpen(false); setInvDesc(""); setInvAmount(0);
    qc.invalidateQueries();
  };

  const downloadInvoice = async (invId: string) => {
    const { data: inv } = await supabase.from("invoices").select("*").eq("id", invId).single();
    const { data: items } = await supabase.from("invoice_items").select("*").eq("invoice_id", invId);
    if (!inv) return;
    downloadInvoicePdf({
      invoice: inv as any,
      items: (items ?? []) as any,
      member: { full_name: m.full_name ?? undefined, phone: m.phone ?? undefined },
      gym: gym as any,
    });
  };

  const shareInvoice = async (inv: any) => {
    const t = toast.loading("Preparing invoice link…");
    let invoiceLink = "";
    try {
      const { data: items } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id);
      const doc = generateInvoicePdf({
        gymName: gym?.name ?? "Fitness Dream",
        gymTagline: (gym as any)?.tagline ?? null,
        gymAddress: gym?.address ?? null,
        gymPhone: gym?.phone ?? null,
        gymEmail: (gym as any)?.email ?? null,
        currencySymbol: gym?.currency_symbol ?? "₹",
        number: inv.number,
        issuedAt: inv.issued_at,
        memberName: m.full_name ?? "Walk-in",
        memberPhone: m.phone ?? null,
        items: (items ?? []) as any,
        subtotal: Number(inv.subtotal),
        total: Number(inv.total),
        amountPaid: Number(inv.amount_paid),
        notes: inv.notes,
        terms: (gym as any)?.invoice_terms ?? null,
      });
      const blob = doc.output("blob");
      const path = `${id}/invoice-${inv.number}.pdf`;
      const up = await supabase.storage.from("invoices").upload(path, blob, {
        contentType: "application/pdf", upsert: true,
      });
      if (up.error) throw up.error;
      const signed = await supabase.storage.from("invoices").createSignedUrl(path, 60 * 60 * 24 * 60);
      if (signed.error) throw signed.error;
      invoiceLink = signed.data.signedUrl;
    } catch (e: any) {
      toast.dismiss(t);
      toast.error("Could not create invoice link: " + (e?.message ?? "unknown"));
      return;
    }
    toast.dismiss(t);
    const tpl = templates.invoice ?? "Hi {{name}}, your invoice #{{invoice_number}} for {{currency}}{{amount}} at {{gym}} is ready.\n\nView / download: {{invoice_link}}";
    const withLink = tpl.includes("{{invoice_link}}") ? tpl : `${tpl}\n\nView / download: {{invoice_link}}`;
    const msg = renderTemplate(withLink, {
      name: m.full_name ?? "",
      invoice_number: inv.number,
      currency,
      amount: Number(inv.total).toLocaleString("en-IN"),
      gym: gym?.name ?? "Fitness Dream",
      invoice_link: invoiceLink,
    });
    openWhatsApp(m.phone ?? "", msg, gym?.whatsapp_country_code ?? "91");
    supabase.from("messages_log").insert({
      member_id: id, channel: "whatsapp", template_key: "invoice", body: msg,
    }).then(() => qc.invalidateQueries({ queryKey: ["member-messages", id] }));
  };

  const addPtPackage = async () => {
    const pkg = ptPackages?.find(p => p.id === ptPkg);
    if (!pkg) return toast.error("Select a package");
    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + Number(pkg.validity_days ?? 60));
    await supabase.from("pt_enrollments").insert({
      member_id: id,
      package_id: pkg.id,
      trainer_id: ptTrainer || null,
      sessions_total: pkg.sessions,
      sessions_used: 0,
      starts_on: todayISO(),
      expires_on: expiresOn.toISOString().slice(0, 10),
    });
    const total = Number(pkg.price);
    const paid = Number(ptPaid);
    const { data: inv } = await supabase.from("invoices").insert({
      member_id: id, subtotal: total, total, amount_paid: paid,
      status: paid <= 0 ? "unpaid" : paid >= total ? "paid" : "partial",
      notes: `PT: ${pkg.name}`,
    }).select("id").single();
    if (inv) {
      await supabase.from("invoice_items").insert({
        invoice_id: inv.id, description: `PT — ${pkg.name}`, qty: 1, unit_price: total, amount: total,
      });
      if (paid > 0) await supabase.from("payments").insert({ member_id: id, invoice_id: inv.id, amount: paid, mode: "cash" });
    }
    toast.success("PT package added");
    setPtOpen(false); setPtPkg(""); setPtTrainer(""); setPtPaid(0);
    qc.invalidateQueries();
  };

  const logPtSession = async (enrollId: string, trainerId: string | null) => {
    await supabase.from("pt_sessions").insert({
      enrollment_id: enrollId,
      trainer_id: trainerId,
      scheduled_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    const enr = ptEnrollments?.find(e => e.id === enrollId);
    if (enr) {
      await supabase.from("pt_enrollments").update({ sessions_used: (enr.sessions_used ?? 0) + 1 }).eq("id", enrollId);
    }
    toast.success("Session logged");
    qc.invalidateQueries();
  };

  const openMsg = () => {
    setMsgTemplateKey("");
    setMsgBody(`Hi ${m.full_name}, this is ${gym?.name ?? "Fitness Dream"}.`);
    setMsgOpen(true);
  };
  const applyTemplate = (key: string) => {
    // Dynamic days-left calc; auto-switch renewal -> renewal_expired when past expiry.
    let daysLeft = 0;
    let hasExpiry = false;
    if (m.expiry_date) {
      hasExpiry = true;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const exp = new Date(m.expiry_date); exp.setHours(0, 0, 0, 0);
      daysLeft = Math.round((exp.getTime() - today.getTime()) / 86400000);
    }
    let effectiveKey = key;
    if (key === "renewal" && hasExpiry && daysLeft < 0 && templates["renewal_expired"]) {
      effectiveKey = "renewal_expired";
    }
    setMsgTemplateKey(effectiveKey);
    const tpl = templates[effectiveKey] ?? "";
    const daysLeftLabel = daysLeft === 0 ? "today" : daysLeft === 1 ? "1 day" : daysLeft > 0 ? `${daysLeft} days` : `${Math.abs(daysLeft)} day(s) ago`;
    const body = renderTemplate(tpl, {
      name: m.full_name ?? "",
      plan: m.plan_type ?? "",
      plan_type: m.plan_type ?? "",
      expiry: m.expiry_date ? fmtDate(m.expiry_date) : "",
      expiry_date: m.expiry_date ? fmtDate(m.expiry_date) : "",
      days_left: daysLeftLabel,
      days_overdue: daysLeft < 0 ? String(Math.abs(daysLeft)) : "0",
      balance: Number(m.balance_due ?? 0).toLocaleString("en-IN"),
      currency,
      gym: gym?.name ?? "Fitness Dream",
      invoice_number: "",
      amount: "",
    });
    setMsgBody(body);
  };
  const sendMsg = async () => {
    if (!msgBody.trim()) return toast.error("Message body is empty");
    openWhatsApp(m.phone ?? "", msgBody, gym?.whatsapp_country_code ?? "91");
    await supabase.from("messages_log").insert({
      member_id: id, channel: "whatsapp", template_key: msgTemplateKey || null, body: msgBody,
    });
    toast.success("Logged");
    setMsgOpen(false);
    qc.invalidateQueries({ queryKey: ["member-messages", id] });
  };

  const addNote = async () => {
    if (!noteDraft.trim()) return;
    setSavingNote(true);
    const existing = m.notes ? `${m.notes}\n` : "";
    const stamp = new Date().toLocaleString();
    const updated = `${existing}[${stamp}] ${noteDraft.trim()}`;
    await supabase.from("members").update({ notes: updated }).eq("id", id);
    setNoteDraft("");
    setSavingNote(false);
    qc.invalidateQueries({ queryKey: ["member", id] });
  };

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/members" })} className="mb-2 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      {/* HEADER */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20 shrink-0">
                {m.photo_url ? <img src={m.photo_url} alt={m.full_name!} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-display font-bold">{initials(m.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-display font-bold truncate">{m.full_name}</h1>
                  <Badge variant="outline" className={`capitalize ${statusStyles[status]}`}>
                    {status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {m.phone}</span>
                  {m.email ? <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {m.email}</span> : null}
                  {m.address ? <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {m.address}</span> : null}
                  {m.dob ? <span className="flex items-center gap-1"><Cake className="h-3.5 w-3.5" /> {fmtDate(m.dob)}</span> : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => { setRenewPlan(""); setRenewPaid(0); setRenewMode("today"); setRenewOpen(true); }}>
                <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Renew
              </Button>
              <Button size="sm" variant="outline" onClick={openPayGeneric}><Plus className="h-3.5 w-3.5 mr-1" /> Add payment</Button>
              <Button size="sm" variant="outline" onClick={freezeToggle}>
                {m.frozen_at ? <><Play className="h-3.5 w-3.5 mr-1" /> Unfreeze</> : <><Snowflake className="h-3.5 w-3.5 mr-1" /> Freeze</>}
              </Button>
              <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
              <Button size="sm" variant="outline" onClick={openMsg}><MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp</Button>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="membership">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="membership">Membership</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="pt">Personal Training</TabsTrigger>
          
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="notes">Notes & Activity</TabsTrigger>
        </TabsList>

        {/* MEMBERSHIP */}
        <TabsContent value="membership" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Plan" value={m.plan_type ?? "—"} />
            <Stat label="Start" value={fmtDate(m.start_date)} />
            <Stat label="Expiry" value={fmtDate(m.expiry_date)} />
            <Stat label="Total fee" value={fmtCurrency(m.total_fee, currency)} />
            <Stat label="Amount paid" value={fmtCurrency(m.amount_paid, currency)} />
            <Stat label="Balance due" value={fmtCurrency(m.balance_due, currency)} tone={balanceDue > 0 ? "danger" : "success"} />
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Membership history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(invoices?.filter(i => (i.notes ?? "").toLowerCase().includes("renewal") || (i.notes ?? "").toLowerCase().includes("membership")).length ?? 0) === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No membership records yet.</div>
              ) : (
                <div className="divide-y">
                  {invoices!.filter(i => (i.notes ?? "").toLowerCase().includes("renewal") || (i.notes ?? "").toLowerCase().includes("membership")).map(i => (
                    <div key={i.id} className="flex items-center justify-between p-4">
                      <div>
                        <div className="font-medium">{i.notes}</div>
                        <div className="text-xs text-muted-foreground">{fmtDateTime(i.issued_at)} · Invoice {i.number}</div>
                      </div>
                      <div className="text-sm font-medium">{fmtCurrency(i.total, currency)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BILLING */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Invoices</CardTitle>
              <Button size="sm" onClick={() => setInvOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Create invoice</Button>
            </CardHeader>
            <CardContent className="p-0">
              {(invoices?.length ?? 0) === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No invoices yet.</div>
              ) : (
                <div className="divide-y">
                  {invoices!.map(i => {
                    const due = Math.max(0, Number(i.total) - Number(i.amount_paid));
                    return (
                      <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">#{i.number}</span>
                            <Badge variant="outline" className={
                              i.status === "paid" ? "bg-success/15 text-success border-success/30" :
                              i.status === "partial" ? "bg-warning/15 text-warning border-warning/30" :
                              "bg-destructive/10 text-destructive border-destructive/30"
                            }>{i.status}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {fmtDate(i.issued_at)} · Total {fmtCurrency(i.total, currency)} · Paid {fmtCurrency(i.amount_paid, currency)}{due > 0 ? ` · Due ${fmtCurrency(due, currency)}` : ""}
                          </div>
                          {i.notes ? <div className="text-xs mt-1">{i.notes}</div> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {due > 0 ? <Button size="sm" variant="outline" onClick={() => openPayForInvoice(i)}>Record payment</Button> : null}
                          <Button size="sm" variant="outline" onClick={() => shareInvoice(i)}><Send className="h-3.5 w-3.5 mr-1" /> WhatsApp</Button>
                          <Button size="sm" variant="outline" onClick={() => downloadInvoice(i.id)}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Payment history</CardTitle></CardHeader>
            <CardContent className="p-0">
              {(payments?.length ?? 0) === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No payments yet.</div>
              ) : (
                <div className="divide-y">
                  {payments!.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4">
                      <div>
                        <div className="font-medium">{fmtCurrency(p.amount, currency)}</div>
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

        {/* PT */}
        <TabsContent value="pt" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">PT packages</CardTitle>
              <Button size="sm" onClick={() => setPtOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add PT package</Button>
            </CardHeader>
            <CardContent className="p-0">
              {(ptEnrollments?.length ?? 0) === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No PT packages.</div>
              ) : (
                <div className="divide-y">
                  {ptEnrollments!.map(e => {
                    const trainerName = trainers?.find(t => t.id === e.trainer_id)?.full_name ?? "—";
                    const remaining = Math.max(0, (e.sessions_total ?? 0) - (e.sessions_used ?? 0));
                    const pct = e.sessions_total ? Math.round(((e.sessions_used ?? 0) / e.sessions_total) * 100) : 0;
                    return (
                      <div key={e.id} className="p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">Trainer: {trainerName}</div>
                            <div className="text-xs text-muted-foreground">Starts {fmtDate(e.starts_on)} · Expires {fmtDate(e.expires_on)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{e.sessions_used ?? 0}/{e.sessions_total} used · {remaining} left</span>
                            <Button size="sm" variant="outline" disabled={remaining === 0} onClick={() => logPtSession(e.id, e.trainer_id)}>Mark session done</Button>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Session log</CardTitle></CardHeader>
            <CardContent className="p-0">
              {(ptSessions?.length ?? 0) === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No sessions logged.</div>
              ) : (
                <div className="divide-y">
                  {ptSessions!.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 text-sm">
                      <span>{fmtDateTime(s.scheduled_at)}</span>
                      {s.completed_at ? <Badge className="bg-success/15 text-success border-success/30" variant="outline">Completed</Badge> : <Badge variant="outline">Scheduled</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>




        {/* MESSAGES */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">WhatsApp history</CardTitle>
              <Button size="sm" onClick={openMsg}><MessageCircle className="h-3.5 w-3.5 mr-1" /> Send message</Button>
            </CardHeader>
            <CardContent className="p-0">
              {(messages?.length ?? 0) === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No messages sent yet.</div>
              ) : (
                <div className="divide-y">
                  {messages!.map(x => (
                    <div key={x.id} className="p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span>{fmtDateTime(x.sent_at)}</span>
                        {x.template_key ? <Badge variant="outline" className="text-xs">{x.template_key}</Badge> : null}
                        <Badge variant="outline" className="text-xs capitalize">{x.channel}</Badge>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{x.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTES & ACTIVITY */}
        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {m.notes ? (
                <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/40 p-3 rounded-md">{m.notes}</pre>
              ) : (
                <div className="text-sm text-muted-foreground">No notes yet.</div>
              )}
              <div className="flex gap-2">
                <Textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} placeholder="Add a note (injury info, preferences…)" />
                <Button onClick={addNote} disabled={savingNote || !noteDraft.trim()}>Add</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Activity timeline</CardTitle></CardHeader>
            <CardContent className="p-0">
              {activity.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No activity yet.</div>
              ) : (
                <div className="divide-y max-h-[500px] overflow-auto">
                  {activity.map((e, i) => (
                    <div key={i} className="flex items-start gap-3 p-4">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{e.text}</div>
                        <div className="text-xs text-muted-foreground">{fmtDateTime(e.at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Renew Dialog */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renew membership</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={renewPlan} onValueChange={(v) => setRenewPlan(v)}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>{plans?.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {currency}{p.price}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start from</Label>
              <Select value={renewMode} onValueChange={(v) => setRenewMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today ({fmtDate(todayISO())})</SelectItem>
                  <SelectItem value="extend">Extend from current expiry ({fmtDate(m.expiry_date)})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Amount paid</Label><MoneyInput value={renewPaid} onChange={setRenewPaid} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>Cancel</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleRenew}>Renew</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit member details</DialogTitle></DialogHeader>
          {editForm && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Full name</Label><Input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></div>
              <div className="space-y-2"><Label>Date of birth</Label><Input type="date" value={editForm.dob ?? ""} onChange={e => setEditForm({ ...editForm, dob: e.target.value })} /></div>
              <div className="space-y-2"><Label>Emergency contact</Label><Input value={editForm.emergency_contact} onChange={e => setEditForm({ ...editForm, emergency_contact: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2"><Label>Amount</Label><MoneyInput value={payAmount} onChange={setPayAmount} /></div>
            <div className="space-y-2">
              <Label>Payment mode</Label>
              <Select value={payMode} onValueChange={(v) => setPayMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={savePayment}>Save payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ad-hoc Invoice Dialog */}
      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create invoice</DialogTitle><DialogDescription>Ad-hoc charge (late fee, merchandise, etc.)</DialogDescription></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2"><Label>Description</Label><Input value={invDesc} onChange={e => setInvDesc(e.target.value)} /></div>
            <div className="space-y-2"><Label>Amount</Label><MoneyInput value={invAmount} onChange={setInvAmount} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvOpen(false)}>Cancel</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={createInvoice}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PT Add Dialog */}
      <Dialog open={ptOpen} onOpenChange={setPtOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add PT package</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Package</Label>
              <Select value={ptPkg} onValueChange={(v) => { setPtPkg(v); const p = ptPackages?.find(pk => pk.id === v); if (p) setPtPaid(Number(p.price)); }}>
                <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                <SelectContent>{ptPackages?.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.sessions} sessions · {currency}{p.price}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trainer</Label>
              <Select value={ptTrainer} onValueChange={setPtTrainer}>
                <SelectTrigger><SelectValue placeholder="Assign trainer" /></SelectTrigger>
                <SelectContent>{trainers?.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Amount paid</Label><Input type="number" value={ptPaid} onChange={e => setPtPaid(Number(e.target.value))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPtOpen(false)}>Cancel</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={addPtPackage}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send WhatsApp message</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={msgTemplateKey} onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue placeholder="Pick a template (optional)" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(templates).map(k => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Message</Label><Textarea rows={6} value={msgBody} onChange={e => setMsgBody(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsgOpen(false)}>Cancel</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={sendMsg}><Send className="h-3.5 w-3.5 mr-1" /> Open WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this member?"
        description={`${m?.full_name ?? "This member"} will be moved to Recently Deleted. You can restore them from Settings within 30 days.`}
        confirmLabel="Delete member"
        financialAmount={m && Number(m.balance_due) > 0 ? `Outstanding balance: ₹${Number(m.balance_due).toLocaleString("en-IN")}` : null}
        typeToConfirm={m?.full_name ?? undefined}
        askReason
        onConfirm={async (reason) => {
          try {
            await softDelete({
              table: "members", id: id, memberId: id, reason,
              summary: `Deleted member ${m?.full_name ?? ""}`.trim(),
            });
            toast.success("Member moved to Recently Deleted");
            qc.invalidateQueries();
            navigate({ to: "/members" });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
          }
        }}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`font-semibold ${tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
