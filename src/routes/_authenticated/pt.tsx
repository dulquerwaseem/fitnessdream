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
import { fmtCurrency, fmtDate, fmtDateTime, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Dumbbell, CalendarClock } from "lucide-react";
import { z } from "zod";

const ptSearchSchema = z.object({
  today: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/pt")({
  validateSearch: (s) => ptSearchSchema.parse(s),
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
  const search = Route.useSearch();
  const todayOnly = !!search.today;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ member_id: "", trainer_id: "", package_id: "", starts_on: todayISO() });

  const { data: todaySessions } = useQuery({
    queryKey: ["pt-sessions-today"],
    enabled: todayOnly,
    queryFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const { data } = await supabase.from("pt_sessions")
        .select("id, scheduled_at, completed_at, notes, trainer:staff!pt_sessions_trainer_id_fkey(full_name), enrollment:pt_enrollments!pt_sessions_enrollment_id_fkey(member:members!pt_enrollments_member_id_fkey(full_name, phone))")
        .is("deleted_at", null)
        .gte("scheduled_at", start)
        .lt("scheduled_at", end)
        .order("scheduled_at");
      return data ?? [];
    },
  });

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["pt-enrollments"],
    queryFn: async () => (await supabase.from("pt_enrollments")
      .select("*, member:members!pt_enrollments_member_id_fkey(full_name, phone), trainer:staff!pt_enrollments_trainer_id_fkey(full_name), package:pt_packages!pt_enrollments_package_id_fkey(name, price)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })).data ?? [],
  });
  const { data: members } = useQuery({
    queryKey: ["members-brief"],
    queryFn: async () => (await supabase.from("members").select("id, full_name, phone").is("deleted_at", null).order("full_name")).data ?? [],
  });
  const { data: trainers } = useQuery({
    queryKey: ["trainers-active"],
    queryFn: async () => (await supabase.from("staff").select("id, full_name").is("deleted_at", null).eq("active", true).eq("role_label", "trainer")).data ?? [],
  });
  const { data: packages } = useQuery({
    queryKey: ["pt-packages"],
    queryFn: async () => (await supabase.from("pt_packages").select("*").eq("active", true)).data ?? [],
  });

  const create = async () => {
    if (!form.member_id || !form.trainer_id || !form.package_id) return toast.error("Select member, trainer, and package");
    const pkg = packages?.find((p) => p.id === form.package_id);
    if (!pkg) return;
    const expires = new Date(form.starts_on);
    expires.setDate(expires.getDate() + pkg.validity_days);
    const { error } = await supabase.from("pt_enrollments").insert({
      member_id: form.member_id,
      trainer_id: form.trainer_id,
      package_id: form.package_id,
      sessions_total: pkg.sessions,
      sessions_used: 0,
      starts_on: form.starts_on,
      expires_on: expires.toISOString().slice(0, 10),
    });
    if (error) return toast.error(error.message);
    toast.success("Enrollment created");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["pt-enrollments"] });
  };

  const logSession = async (enrollmentId: string, remaining: number, used: number) => {
    if (remaining <= 0) return toast.error("No sessions left");
    await supabase.from("pt_sessions").insert({
      enrollment_id: enrollmentId,
      scheduled_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    await supabase.from("pt_enrollments").update({ sessions_used: used + 1 }).eq("id", enrollmentId);
    toast.success("Session logged");
    qc.invalidateQueries({ queryKey: ["pt-enrollments"] });
  };

  return (
    <div>
      <PageHeader
        title="Personal Training"
        description="Enrollments, sessions, and trainer allocations."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> New enrollment</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New PT enrollment</DialogTitle></DialogHeader>
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
                <div className="space-y-1"><Label>Package</Label>
                  <Select value={form.package_id} onValueChange={(v) => setForm(f=>({...f, package_id:v}))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{packages?.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.sessions} sessions</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Start date</Label><Input type="date" value={form.starts_on} onChange={(e) => setForm(f=>({...f, starts_on:e.target.value}))} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button className="gradient-primary text-primary-foreground" onClick={create}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {todayOnly && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Today's sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(todaySessions?.length ?? 0) === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No sessions scheduled today.</div>
            ) : (
              <div className="divide-y">
                {todaySessions!.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-4 gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{s.enrollment?.member?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDateTime(s.scheduled_at)} · Trainer: {s.trainer?.full_name ?? "—"}
                      </div>
                    </div>
                    <Badge variant="outline" className={s.completed_at ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30"}>
                      {s.completed_at ? "Completed" : "Scheduled"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {isLoading ? (
        <div className="grid gap-3">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (enrollments?.length ?? 0) === 0 ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center">
          <Dumbbell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No PT enrollments yet.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {enrollments!.map((e) => {
            const remaining = e.sessions_total - e.sessions_used;
            const pct = e.sessions_total ? (e.sessions_used / e.sessions_total) * 100 : 0;
            const mem = e.member as { full_name?: string; phone?: string } | null;
            const tr = e.trainer as { full_name?: string } | null;
            const pkg = e.package as { name?: string; price?: number } | null;
            return (
              <Card key={e.id} className="card-hover">
                <CardHeader className="pb-2 flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{mem?.full_name}</CardTitle>
                    <p className="text-xs text-muted-foreground">with {tr?.full_name} · expires {fmtDate(e.expires_on)}</p>
                  </div>
                  <Badge variant="outline">{pkg?.name}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <div className="text-2xl font-display font-bold">{remaining}<span className="text-sm text-muted-foreground">/{e.sessions_total}</span></div>
                      <div className="text-xs text-muted-foreground">sessions left</div>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                    <div className="h-full gradient-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => logSession(e.id, remaining, e.sessions_used)} disabled={remaining <= 0}>
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
