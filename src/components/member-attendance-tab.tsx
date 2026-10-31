import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, fmtDateTime, localISO } from "@/lib/format";
import { floorLabel } from "@/lib/biometric";

function fmtTime(d: string): string {
  return new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function MemberAttendanceTab({ memberId }: { memberId: string }) {
  const { data: records } = useQuery({
    queryKey: ["member-attendance", memberId],
    queryFn: async () =>
      (await supabase
        .from("biometric_attendance")
        .select("*")
        .eq("member_id", memberId)
        .order("punch_time", { ascending: false })).data ?? [],
  });

  const rows = records ?? [];

  const { visitsThisMonth, lastVisit } = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const days = new Set<string>();
    for (const r of rows) {
      const day = localISO(new Date(r.punch_time));
      if (day.startsWith(monthKey)) days.add(day);
    }
    return { visitsThisMonth: days.size, lastVisit: rows[0]?.punch_time ?? null };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Visits this month</div>
            <div className="font-semibold text-xl">{visitsThisMonth}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Last visit</div>
            <div className="font-semibold">{lastVisit ? fmtDateTime(lastVisit) : "—"}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Attendance records</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No attendance records yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Floor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtDate(r.punch_time)}</TableCell>
                    <TableCell>{fmtTime(r.punch_time)}</TableCell>
                    <TableCell>{floorLabel(r.device_ip)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
