import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtCurrency, fmtDate, todayISO, addMonthsISO } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Dumbbell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pt")({
  head: () => ({
    meta: [
      { title: "Personal Training — Fitness Dream" },
      { name: "description", content: "PT packages, sessions and trainer allocations." },
    ],
  }),
  component: PTPage,
});

function PTPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    member_id: "", trainer_id: "", package_name: "12 sessions", total_sessions: 12, price: 0, start_date: todayISO(),
  });

  const { data: packages, isLoading } = useQuery({
    queryKey: ["pt-packages"],
    queryFn: async () => (await supabase.from("pt_packages")
      .select("*, members(full_name, phone), staff(full_name)")
      .order("created_at", { ascending: false })).data ?? [],
  });
  const { data: members } = useQuery({
    queryKey: ["members-brief"],
    queryFn: async () => (await supabase.from("members").select("id, full_name, phone").order("full_name")).data ?? [],
  });
  const { data: trainers } = useQuery({
    queryKey: ["trainers-active"],
    queryFn: async () => (await supabase.from("staff").select("id, full_name").eq("active", true).eq("role", "trainer")).data ?? [],
  });

  const create = async () => {
    if (!form.member_id || !form.trainer_id) return toast.error("Select member and trainer");
    const { error } = await supabase.from("pt_packages").insert({
      member_id: form.member_id,
      trainer_id: form.trainer_id,
      package_name: form.package_name,
      total_sessions: form.total_sessions,
      remaining_sessions: form.total_sessions,
      price: Number(form.price),
      start_date: form.start_date,
      expiry_date: addMonthsISO(form.start_date, 3),
      active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("PT package created");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["pt-packages"] });
  };

  const logSession = async (pkgId: string, remaining: number) => {
    if (remaining <= 0) return toast.error("No sessions left");
    await supabase.from("pt_sessions").insert({ package_id: pkgId });
    await supabase.from("pt_packages").update({ remaining_sessions: remaining - 1 }).eq("id", pkgId);
    toast.success("Session logged");
    qc.invalidateQueries({ queryKey: ["pt-packages"] });
  };

  return (
    <div>
      <PageHeader
        title="Personal Training"
        description="Packages, sessions, and trainer allocations."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> New package</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New PT package</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1"><Label>Member</Label>
                  <Select value={form.member_id} onValueChange={(v) => setForm(f=>({...f, member_id:v}))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{members?.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Trainer</Label>
                  <Select value={form.trainer_id} onValueChange={(v) => setForm(f=>({...f, trainer_id:v}))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{trainers?.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>Package name</Label><Input value={form.package_name} onChange={(e) => setForm(f=>({...f, package_name:e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Sessions</Label><Input type="number" value={form.total_sessions} onChange={(e) => setForm(f=>({...f, total_sessions:Number(e.target.value)}))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>Price</Label><Input type="number" value={form.price} onChange={(e) => setForm(f=>({...f, price:Number(e.target.value)}))} /></div>
                  <div className="space-y-1"><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm(f=>({...f, start_date:e.target.value}))} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button className="gradient-primary text-primary-foreground" onClick={create}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="grid gap-3">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (packages?.length ?? 0) === 0 ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center">
          <Dumbbell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No PT packages yet.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {packages!.map((p) => {
            const mem = p.members as { full_name?: string; phone?: string } | null;
            const tr = p.staff as { full_name?: string } | null;
            const pct = p.total_sessions ? ((p.total_sessions - p.remaining_sessions) / p.total_sessions) * 100 : 0;
            return (
              <Card key={p.id} className="card-hover">
                <CardHeader className="pb-2 flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{mem?.full_name}</CardTitle>
                    <p className="text-xs text-muted-foreground">with {tr?.full_name} · expires {fmtDate(p.expiry_date)}</p>
                  </div>
                  <Badge variant="outline" className={p.active ? "border-success/30 text-success" : ""}>{p.package_name}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <div className="text-2xl font-display font-bold">{p.remaining_sessions}<span className="text-sm text-muted-foreground">/{p.total_sessions}</span></div>
                      <div className="text-xs text-muted-foreground">sessions left</div>
                    </div>
                    <div className="text-sm font-medium">{fmtCurrency(p.price)}</div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                    <div className="h-full gradient-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => logSession(p.id, p.remaining_sessions)} disabled={p.remaining_sessions <= 0}>
                    Log session
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
