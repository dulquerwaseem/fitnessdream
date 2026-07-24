import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtDate, fmtDateTime, initials } from "@/lib/format";
import { renderTemplate, waLink } from "@/lib/phone";
import { Plus, Search, Sparkles, MessageCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Fitness Dream" },
      { name: "description", content: "Lead pipeline: track prospects from first inquiry to conversion." },
    ],
  }),
  component: LeadsPage,
});

type Lead = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  source: string;
  interested_plan_name: string | null;
  notes: string | null;
  stage_id: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  converted_member_id: string | null;
  created_at: string;
};
type Stage = { id: string; name: string; order_index: number; is_converted: boolean; is_lost: boolean; follow_up_days: number | null; color: string | null };
type Template = { id: string; key: string; name: string; body: string };

const sourceLabels: Record<string, string> = {
  walk_in: "Walk-in",
  referral: "Referral",
  instagram: "Instagram",
  google: "Google",
  whatsapp_inquiry: "WhatsApp",
  other: "Other",
};

const stageTone: Record<string, string> = {
  orange: "bg-primary/10 text-primary border-primary/30",
  blue: "bg-info/10 text-info border-info/30",
  violet: "bg-violet-500/10 text-violet-600 border-violet-500/30 dark:text-violet-400",
  amber: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400",
  green: "bg-success/10 text-success border-success/30",
  slate: "bg-muted text-muted-foreground border-border",
};

function isFollowUpDue(lead: Lead, stages: Stage[]): boolean {
  if (lead.converted_member_id) return false;
  const now = Date.now();
  if (lead.next_follow_up_at && new Date(lead.next_follow_up_at).getTime() <= now) return true;
  const stage = stages.find(s => s.id === lead.stage_id);
  if (!stage?.follow_up_days) return false;
  const anchor = lead.last_contacted_at ?? lead.created_at;
  return now - new Date(anchor).getTime() > stage.follow_up_days * 86400000;
}

function LeadsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [q, setQ] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTplId, setBulkTplId] = useState<string>("");

  const { data: stages } = useQuery({
    queryKey: ["lead-stages"],
    queryFn: async () => {
      const { data } = await supabase.from("lead_stages").select("*").order("order_index");
      return (data ?? []) as Stage[];
    },
  });
  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads-all"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Lead[];
    },
  });
  const { data: templates } = useQuery({
    queryKey: ["lead-templates"],
    queryFn: async () => (await supabase.from("lead_templates").select("*").order("name")).data as Template[] | null,
  });

  const moveMut = useMutation({
    mutationFn: async ({ leadId, stageId }: { leadId: string; stageId: string }) => {
      const stage = stages?.find(s => s.id === stageId);
      const updates: { stage_id: string; converted_at?: string } = { stage_id: stageId };
      if (stage?.is_converted) updates.converted_at = new Date().toISOString();
      const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
      if (error) throw error;
      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        kind: "stage_change",
        body: `Moved to ${stage?.name ?? "stage"}`,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads-all"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = leads ?? [];
    const term = q.trim().toLowerCase();
    return list.filter(l => {
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (dueOnly && !isFollowUpDue(l, stages ?? [])) return false;
      if (!term) return true;
      return (
        l.full_name.toLowerCase().includes(term) ||
        l.phone.toLowerCase().includes(term) ||
        (l.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [leads, q, sourceFilter, dueOnly, stages]);

  const byStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    (stages ?? []).forEach(s => map.set(s.id, []));
    for (const l of filtered) {
      if (l.stage_id && map.has(l.stage_id)) map.get(l.stage_id)!.push(l);
    }
    return map;
  }, [filtered, stages]);

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const lead = leads?.find(l => l.id === id);
    if (!lead || lead.stage_id === stageId) return;
    moveMut.mutate({ leadId: id, stageId });
  };

  const toggleSel = (id: string) => {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sendBulk = async () => {
    const tpl = templates?.find(t => t.id === bulkTplId);
    if (!tpl) return;
    const chosen = (leads ?? []).filter(l => selected.has(l.id));
    for (const lead of chosen) {
      const body = renderTemplate(tpl.body, { name: lead.full_name.split(" ")[0], offer: "" });
      window.open(waLink(lead.phone, body), "_blank", "noopener,noreferrer");
      await supabase.from("lead_activities").insert({
        lead_id: lead.id,
        kind: "whatsapp",
        template_key: tpl.key,
        body,
      });
      await supabase.from("leads").update({ last_contacted_at: new Date().toISOString() }).eq("id", lead.id);
    }
    toast.success(`Opened WhatsApp for ${chosen.length} leads`);
    setBulkOpen(false);
    setBulkTplId("");
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["leads-all"] });
  };

  const dueCount = (leads ?? []).filter(l => isFollowUpDue(l, stages ?? [])).length;

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Track prospects and convert them into members."
        actions={
          <div className="flex gap-2">
            {selected.size > 0 && (
              <Button variant="outline" onClick={() => setBulkOpen(true)}>
                <MessageCircle className="h-4 w-4 mr-1" /> Bulk WhatsApp ({selected.size})
              </Button>
            )}
            <Button asChild className="gradient-primary text-primary-foreground">
              <Link to="/leads/new"><Plus className="h-4 w-4 mr-1" /> Add lead</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {Object.entries(sourceLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={dueOnly ? "default" : "outline"} onClick={() => setDueOnly(v => !v)} className={dueOnly ? "gradient-primary text-primary-foreground" : ""}>
          <AlertCircle className="h-4 w-4 mr-1" /> Follow-up due {dueCount > 0 && <Badge variant="secondary" className="ml-1">{dueCount}</Badge>}
        </Button>
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : (leads ?? []).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display font-semibold">No leads yet</h3>
              <p className="text-sm text-muted-foreground">Capture your first prospect to start the pipeline.</p>
            </div>
            <Button asChild className="gradient-primary text-primary-foreground"><Link to="/leads/new">Add lead</Link></Button>
          </CardContent>
        </Card>
      ) : view === "kanban" ? (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 animate-fade-in">
          {(stages ?? []).map(stage => {
            const items = byStage.get(stage.id) ?? [];
            return (
              <div
                key={stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, stage.id)}
                className="rounded-xl border bg-card/50 flex flex-col min-h-[300px]"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${stageTone[stage.color ?? "slate"]?.split(" ")[0] ?? "bg-muted"}`} />
                    <span className="font-semibold text-sm">{stage.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="flex-1 p-2 space-y-2">
                  {items.map(lead => {
                    const due = isFollowUpDue(lead, stages ?? []);
                    return (
                      <Link
                        key={lead.id}
                        to="/leads/$id"
                        params={{ id: lead.id }}
                        draggable
                        onDragStart={(e) => onDragStart(e, lead.id)}
                        className="block"
                      >
                        <Card className="card-hover cursor-grab active:cursor-grabbing">
                          <CardContent className="p-3 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center">
                                {initials(lead.full_name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm truncate">{lead.full_name}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{lead.phone}</div>
                              </div>
                              {due && <span className="h-2 w-2 rounded-full bg-warning animate-pulse" title="Follow-up due" />}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>{sourceLabels[lead.source]}</span>
                              <span>{fmtDate(lead.created_at)}</span>
                            </div>
                            {lead.interested_plan_name && (
                              <div className="text-[11px]"><Badge variant="outline" className="font-normal">{lead.interested_plan_name}</Badge></div>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                  {items.length === 0 && <div className="text-center text-[11px] text-muted-foreground py-6">Drop here</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-2 animate-fade-in">
          {filtered.map(l => {
            const stage = stages?.find(s => s.id === l.stage_id);
            const due = isFollowUpDue(l, stages ?? []);
            return (
              <Card key={l.id} className="card-hover">
                <CardContent className="flex items-center gap-3 p-3">
                  <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSel(l.id)} onClick={(e) => e.stopPropagation()} />
                  <Link to="/leads/$id" params={{ id: l.id }} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                      {initials(l.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{l.full_name}</span>
                        {stage && <Badge variant="outline" className={stageTone[stage.color ?? "slate"]}>{stage.name}</Badge>}
                        {due && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Follow-up due</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-1">
                        <span>{l.phone}</span>
                        <span>Source: {sourceLabels[l.source]}</span>
                        <span>Added {fmtDate(l.created_at)}</span>
                        {l.last_contacted_at && <span>Last contact {fmtDateTime(l.last_contacted_at)}</span>}
                      </div>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send WhatsApp to {selected.size} leads</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Pick a template — each lead's name is auto-filled. One WhatsApp tab opens per lead.</p>
            <Select value={bulkTplId} onValueChange={setBulkTplId}>
              <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
              <SelectContent>{templates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={sendBulk} disabled={!bulkTplId}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
