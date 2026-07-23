import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { fmtDateTime, initials } from "@/lib/format";
import { toast } from "sonner";
import { CheckCircle2, Search, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Fitness Dream" },
      { name: "description", content: "Check-ins and daily traffic." },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: members } = useQuery({
    queryKey: ["members-search", q],
    queryFn: async () => {
      if (!q.trim()) return [];
      const term = `%${q.trim()}%`;
      const { data } = await supabase.from("members_with_status")
        .select("id, full_name, phone, status, photo_url")
        .or(`full_name.ilike.${term},phone.ilike.${term}`)
        .limit(8);
      return data ?? [];
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0,0,0,0);
      const { data } = await supabase.from("attendance")
        .select("id, check_in, check_out, subject_id, members!attendance_member_fk(full_name, phone)")
        .eq("subject_type", "member")
        .gte("check_in", start.toISOString())
        .order("check_in", { ascending: false });
      return data ?? [];
    },
  });

  const checkIn = async (memberId: string, name: string) => {
    const { error } = await supabase.from("attendance").insert({ subject_id: memberId, subject_type: "member" });
    if (error) return toast.error(error.message);
    toast.success(`${name} checked in`);
    setQ("");
    qc.invalidateQueries({ queryKey: ["attendance-today"] });
  };
  const checkOut = async (attId: string) => {
    await supabase.from("attendance").update({ check_out: new Date().toISOString() }).eq("id", attId);
    qc.invalidateQueries({ queryKey: ["attendance-today"] });
  };

  return (
    <div>
      <PageHeader title="Attendance" description="Log check-ins from the front desk." />

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Quick check-in</CardTitle></CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search member by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-12 text-base" />
          </div>
          {q && (
            <div className="mt-3 grid gap-2">
              {(members ?? []).map((m) => (
                <button key={m.id} onClick={() => checkIn(m.id!, m.full_name!)} className="text-left">
                  <Card className="card-hover"><CardContent className="p-3 flex items-center gap-3">
                    <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-primary">{initials(m.full_name)}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{m.full_name}</div>
                      <div className="text-xs text-muted-foreground">{m.phone}</div>
                    </div>
                    <Badge variant="outline" className="capitalize">{String(m.status).replace("_"," ")}</Badge>
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </CardContent></Card>
                </button>
              ))}
              {q && (members?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground p-3 text-center">No match</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Today's check-ins ({recent?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(recent?.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No check-ins yet today.</div>
          ) : (
            <div className="divide-y">
              {recent!.map((r) => {
                const mem = r.members as { full_name?: string; phone?: string } | null;
                return (
                  <div key={r.id} className="flex items-center justify-between p-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-primary">{initials(mem?.full_name)}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{mem?.full_name ?? "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">In {fmtDateTime(r.check_in)}{r.check_out ? ` · Out ${fmtDateTime(r.check_out)}` : ""}</div>
                      </div>
                    </div>
                    {r.check_out ? (
                      <Badge variant="outline">Complete</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => checkOut(r.id)}><LogOut className="h-3.5 w-3.5 mr-1" /> Check out</Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
