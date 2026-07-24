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
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { openWhatsApp, renderTemplate } from "@/lib/phone";
import { toast } from "sonner";
import { ArrowLeft, Phone, Mail, MessageCircle, CheckCircle2, StickyNote, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leads/$id")({
  head: () => ({
    meta: [
      { title: "Lead — Fitness Dream" },
      { name: "description", content: "Lead profile, activity timeline, and follow-ups." },
    ],
  }),
  component: LeadDetail,
});

const sourceLabels: Record<string, string> = {
  walk_in: "Walk-in", phone_inquiry: "Phone Inquiry", referral: "Referral", instagram: "Instagram",
  google: "Google", whatsapp_inquiry: "WhatsApp", other: "Other",
};

function LeadDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => (await supabase.from("leads").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: stages } = useQuery({
    queryKey: ["lead-stages"],
    queryFn: async () => (await supabase.from("lead_stages").select("*").order("order_index")).data ?? [],
  });
  const { data: templates } = useQuery({
    queryKey: ["lead-templates"],
    queryFn: async () => (await supabase.from("lead_templates").select("*").order("name")).data ?? [],
  });
  const { data: activities } = useQuery({
    queryKey: ["lead-activities", id],
    queryFn: async () => (await supabase.from("lead_activities").select("*").eq("lead_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const [note, setNote] = useState("");
  const [waOpen, setWaOpen] = useState(false);
  const [tplId, setTplId] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [showAllTpls, setShowAllTpls] = useState(false);

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (!lead) return <div className="text-center py-16 text-muted-foreground">Lead not found. <Link to="/leads" className="text-primary story-link">Back to leads</Link></div>;

  const stage = stages?.find(s => s.id === lead.stage_id);

  const changeStage = async (newStageId: string) => {
    const target = stages?.find(s => s.id === newStageId);
    const updates: { stage_id: string; converted_at?: string } = { stage_id: newStageId };
    if (target?.is_converted) updates.converted_at = new Date().toISOString();
    await supabase.from("leads").update(updates).eq("id", id);
    await supabase.from("lead_activities").insert({ lead_id: id, kind: "stage_change", body: `Moved to ${target?.name}` });
    qc.invalidateQueries({ queryKey: ["lead", id] });
    qc.invalidateQueries({ queryKey: ["lead-activities", id] });
    qc.invalidateQueries({ queryKey: ["leads-all"] });
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await supabase.from("lead_activities").insert({ lead_id: id, kind: "note", body: note.trim() });
    await supabase.from("leads").update({ last_contacted_at: new Date().toISOString() }).eq("id", id);
    setNote("");
    qc.invalidateQueries({ queryKey: ["lead-activities", id] });
    qc.invalidateQueries({ queryKey: ["lead", id] });
  };

  const pickTemplate = (tplIdVal: string) => {
    setTplId(tplIdVal);
    const t = templates?.find(x => x.id === tplIdVal);
    if (t) setWaMsg(renderTemplate(t.body, { name: lead.full_name.split(" ")[0], offer: "" }));
  };

  const sendWhatsApp = async () => {
    if (!waMsg.trim()) return;
    const tpl = templates?.find(x => x.id === tplId);
    openWhatsApp(lead.phone, waMsg);
    await supabase.from("lead_activities").insert({
      lead_id: id,
      kind: "whatsapp",
      template_key: tpl?.key ?? null,
      body: waMsg,
    });
    await supabase.from("leads").update({ last_contacted_at: new Date().toISOString() }).eq("id", id);
    toast.success("WhatsApp opened, activity logged");
    setWaOpen(false);
    setTplId("");
    setWaMsg("");
    qc.invalidateQueries({ queryKey: ["lead-activities", id] });
    qc.invalidateQueries({ queryKey: ["lead", id] });
  };

  const convertToMember = () => {
    navigate({ to: "/members/new", search: { leadId: id } as never });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/leads"><ArrowLeft className="h-4 w-4 mr-1" /> Leads</Link></Button>
      </div>

      <PageHeader
        title={lead.full_name}
        description={`Lead since ${fmtDate(lead.created_at)} · Source: ${sourceLabels[lead.source]}`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Dialog open={waOpen} onOpenChange={setWaOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><MessageCircle className="h-4 w-4 mr-1" /> Send WhatsApp</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Send WhatsApp to {lead.full_name}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Template (matching {sourceLabels[lead.source]})</Label>
                      <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => setShowAllTpls(v => !v)}>
                        {showAllTpls ? "Filter to source" : "Show all templates"}
                      </button>
                    </div>
                    <Select value={tplId} onValueChange={pickTemplate}>
                      <SelectTrigger><SelectValue placeholder="Pick a template (optional)" /></SelectTrigger>
                      <SelectContent>{(templates ?? []).filter(t => {
                        if (showAllTpls) return true;
                        const cats = (t as { source_categories?: string[] }).source_categories ?? ["all"];
                        return cats.includes("all") || cats.includes(lead.source);
                      }).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Message</Label>
                    <Textarea rows={5} value={waMsg} onChange={(e) => setWaMsg(e.target.value)} placeholder="Type your message…" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setWaOpen(false)}>Cancel</Button>
                  <Button className="gradient-primary text-primary-foreground" onClick={sendWhatsApp} disabled={!waMsg.trim()}>Open WhatsApp</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {!lead.converted_member_id ? (
              <Button className="gradient-primary text-primary-foreground" onClick={convertToMember}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Convert to member
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link to="/members/$id" params={{ id: lead.converted_member_id }}>View member <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {lead.phone}</div>
            {lead.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {lead.email}</div>}
            <div className="pt-2 border-t space-y-1">
              <div className="text-xs text-muted-foreground">Interested plan</div>
              <div>{lead.interested_plan_name ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Last contact</div>
              <div>{lead.last_contacted_at ? fmtDateTime(lead.last_contacted_at) : "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Next follow-up</div>
              <Input
                type="datetime-local"
                defaultValue={lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toISOString().slice(0, 16) : ""}
                onBlur={async (e) => {
                  const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                  await supabase.from("leads").update({ next_follow_up_at: v }).eq("id", id);
                  qc.invalidateQueries({ queryKey: ["lead", id] });
                  qc.invalidateQueries({ queryKey: ["leads-all"] });
                  toast.success("Follow-up updated");
                }}
                className="h-8 text-sm"
              />
            </div>
            {lead.notes && (
              <div className="pt-2 border-t space-y-1">
                <div className="text-xs text-muted-foreground">Notes</div>
                <div className="whitespace-pre-wrap">{lead.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Pipeline stage</CardTitle>
              {stage && <Badge variant="outline">{stage.name}</Badge>}
            </CardHeader>
            <CardContent>
              <Select value={lead.stage_id ?? ""} onValueChange={changeStage}>
                <SelectTrigger className="w-full sm:w-[260px]"><SelectValue /></SelectTrigger>
                <SelectContent>{stages?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Log activity</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea rows={2} placeholder="Add a note (phone call summary, visit outcome, etc.)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex justify-end"><Button size="sm" onClick={addNote} disabled={!note.trim()}><StickyNote className="h-4 w-4 mr-1" /> Save note</Button></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
            <CardContent>
              {(activities ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">No activity yet.</div>
              ) : (
                <div className="space-y-3">
                  {activities!.map(a => (
                    <div key={a.id} className="flex gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${a.kind === "whatsapp" ? "bg-success/10 text-success" : a.kind === "stage_change" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {a.kind === "whatsapp" ? <MessageCircle className="h-4 w-4" /> : a.kind === "stage_change" ? <ArrowRight className="h-4 w-4" /> : <StickyNote className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="capitalize">{a.kind.replace("_", " ")}</span>
                          {a.template_key && <Badge variant="outline" className="text-[10px]">{a.template_key}</Badge>}
                          <span>· {fmtDateTime(a.created_at)}</span>
                        </div>
                        {a.body && <div className="text-sm whitespace-pre-wrap mt-0.5">{a.body}</div>}
                      </div>
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
