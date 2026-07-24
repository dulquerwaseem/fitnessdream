import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";

export function LeadStagesSettings() {
  const qc = useQueryClient();
  const { data: stages } = useQuery({
    queryKey: ["lead-stages"],
    queryFn: async () => (await supabase.from("lead_stages").select("*").order("order_index")).data ?? [],
  });
  const [newStage, setNewStage] = useState({ name: "", follow_up_days: 3 });

  const refresh = () => qc.invalidateQueries({ queryKey: ["lead-stages"] });

  const add = async () => {
    if (!newStage.name.trim()) return toast.error("Name required");
    const nextOrder = (stages?.length ?? 0) + 1;
    const { error } = await supabase.from("lead_stages").insert({
      name: newStage.name.trim(),
      order_index: nextOrder,
      follow_up_days: newStage.follow_up_days || null,
      color: "slate",
    });
    if (error) return toast.error(error.message);
    setNewStage({ name: "", follow_up_days: 3 });
    refresh();
  };
  const rename = async (id: string, name: string) => {
    await supabase.from("lead_stages").update({ name }).eq("id", id);
    refresh();
  };
  const setDays = async (id: string, days: number | null) => {
    await supabase.from("lead_stages").update({ follow_up_days: days }).eq("id", id);
    refresh();
  };
  const move = async (id: string, dir: -1 | 1) => {
    const list = stages ?? [];
    const idx = list.findIndex(s => s.id === id);
    const swap = list[idx + dir];
    if (!swap) return;
    await supabase.from("lead_stages").update({ order_index: swap.order_index }).eq("id", id);
    await supabase.from("lead_stages").update({ order_index: list[idx].order_index }).eq("id", swap.id);
    refresh();
  };
  const del = async (id: string) => {
    const { error } = await supabase.from("lead_stages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lead pipeline stages</CardTitle>
        <CardDescription>Rename stages, reorder, and set follow-up reminder thresholds.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {(stages ?? []).map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 p-3 rounded-lg border">
            <div className="flex flex-col">
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => move(s.id, -1)} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => move(s.id, 1)} disabled={i === (stages?.length ?? 0) - 1}><ArrowDown className="h-3 w-3" /></Button>
            </div>
            <Input defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && rename(s.id, e.target.value)} className="max-w-[220px]" />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Follow-up after</span>
              <Input
                type="number"
                min={0}
                defaultValue={s.follow_up_days ?? ""}
                onBlur={(e) => setDays(s.id, e.target.value ? Number(e.target.value) : null)}
                className="h-8 w-16"
              />
              <span>days</span>
            </div>
            {s.is_converted && <Badge variant="outline" className="border-success/30 text-success">Converted</Badge>}
            {s.is_lost && <Badge variant="outline">Lost</Badge>}
            <div className="flex-1" />
            {!s.is_converted && !s.is_lost && (
              <Button size="icon" variant="ghost" onClick={() => del(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            )}
          </div>
        ))}
        <div className="mt-6 border-t pt-6">
          <div className="text-sm font-semibold mb-2">Add stage</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input placeholder="Name" value={newStage.name} onChange={(e) => setNewStage(s => ({ ...s, name: e.target.value }))} />
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Follow-up days</Label>
              <Input type="number" min={0} value={newStage.follow_up_days} onChange={(e) => setNewStage(s => ({ ...s, follow_up_days: Number(e.target.value) }))} />
            </div>
            <Button onClick={add} className="gradient-primary text-primary-foreground">Add stage</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const SOURCE_OPTS: { v: string; l: string }[] = [
  { v: "all", l: "All sources" },
  { v: "walk_in", l: "Walk-in" },
  { v: "phone_inquiry", l: "Phone Inquiry" },
  { v: "referral", l: "Referral" },
  { v: "instagram", l: "Instagram" },
  { v: "google", l: "Google" },
  { v: "whatsapp_inquiry", l: "WhatsApp Inquiry" },
  { v: "other", l: "Other" },
];

export function LeadTemplatesSettings() {
  const qc = useQueryClient();
  const { data: templates } = useQuery({
    queryKey: ["lead-templates"],
    queryFn: async () => (await supabase.from("lead_templates").select("*").order("name")).data ?? [],
  });
  const [newTpl, setNewTpl] = useState<{ key: string; name: string; body: string; source_categories: string[] }>({
    key: "", name: "", body: "", source_categories: ["all"],
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["lead-templates"] });

  const add = async () => {
    if (!newTpl.key.trim() || !newTpl.name.trim() || !newTpl.body.trim()) return toast.error("All fields required");
    const { error } = await supabase.from("lead_templates").insert({
      ...newTpl,
      source_categories: newTpl.source_categories.length ? newTpl.source_categories : ["all"],
    });
    if (error) return toast.error(error.message);
    setNewTpl({ key: "", name: "", body: "", source_categories: ["all"] });
    refresh();
  };
  const update = async (id: string, patch: Partial<{ name: string; body: string; source_categories: string[] }>) => {
    await supabase.from("lead_templates").update(patch).eq("id", id);
    refresh();
  };
  const del = async (id: string) => {
    await supabase.from("lead_templates").delete().eq("id", id);
    refresh();
  };

  const toggleCat = (current: string[], v: string): string[] => {
    if (v === "all") return ["all"];
    const next = current.filter(c => c !== "all");
    return next.includes(v) ? next.filter(c => c !== v) : [...next, v];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lead WhatsApp templates</CardTitle>
        <CardDescription>Group templates by lead source. Use {"{{name}}"} for the lead's first name.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(templates ?? []).map(t => {
          const cats: string[] = (t as { source_categories?: string[] }).source_categories ?? ["all"];
          return (
            <div key={t.id} className="p-3 rounded-lg border space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-[10px]">{t.key}</Badge>
                <Input defaultValue={t.name} onBlur={(e) => e.target.value !== t.name && update(t.id, { name: e.target.value })} className="max-w-[280px]" />
                <div className="flex-1" />
                <Button size="icon" variant="ghost" onClick={() => del(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {SOURCE_OPTS.map(s => {
                  const active = cats.includes(s.v);
                  return (
                    <button
                      type="button"
                      key={s.v}
                      onClick={() => update(t.id, { source_categories: toggleCat(cats, s.v) })}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                    >
                      {s.l}
                    </button>
                  );
                })}
              </div>
              <textarea
                defaultValue={t.body}
                onBlur={(e) => e.target.value !== t.body && update(t.id, { body: e.target.value })}
                rows={3}
                className="w-full text-sm rounded-md border bg-background p-2 font-mono"
              />
            </div>
          );
        })}
        <div className="mt-6 border-t pt-6 space-y-2">
          <div className="text-sm font-semibold">Add template</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input placeholder="Key (e.g. thanks_visit)" value={newTpl.key} onChange={(e) => setNewTpl(t => ({ ...t, key: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} />
            <Input placeholder="Name" value={newTpl.name} onChange={(e) => setNewTpl(t => ({ ...t, name: e.target.value }))} />
          </div>
          <div className="flex flex-wrap gap-1">
            {SOURCE_OPTS.map(s => {
              const active = newTpl.source_categories.includes(s.v);
              return (
                <button
                  type="button"
                  key={s.v}
                  onClick={() => setNewTpl(t => ({ ...t, source_categories: toggleCat(t.source_categories, s.v) }))}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                >
                  {s.l}
                </button>
              );
            })}
          </div>
          <textarea
            rows={3}
            placeholder="Message body, use {{name}} for personalization"
            value={newTpl.body}
            onChange={(e) => setNewTpl(t => ({ ...t, body: e.target.value }))}
            className="w-full text-sm rounded-md border bg-background p-2"
          />
          <Button onClick={add} className="gradient-primary text-primary-foreground">Add template</Button>
        </div>
      </CardContent>
    </Card>
  );
}
