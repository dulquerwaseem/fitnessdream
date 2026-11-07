import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, localISO, todayISO } from "@/lib/format";

function fmtTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmtHours(checkIn: string, checkOut: string | null): string {
  if (!checkOut) return "—";
  const hours = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3_600_000;
  if (!isFinite(hours) || hours < 0) return "—";
  return `${hours.toFixed(1)} hrs`;
}

export function StaffAttendanceTab({ staffId }: { staffId: string }) {
  const { data: records } = useQuery({
    queryKey: ["staff-attendance", staffId],
    queryFn: async () =>
      (await supabase
        .from("staff_attendance")
        .select("*")
        .eq("staff_id", staffId)
        .order("check_in", { ascending: false })).data ?? [],
  });

  const rows = records ?? [];

  const { todayCheckIn, todayCheckOut, daysThisMonth } = useMemo(() => {
    const today = todayISO();
    const monthKey = today.slice(0, 7);
    const todaysRows = rows.filter((r) => localISO(new Date(r.check_in)) === today);
    const days = new Set<string>();
    for (const r of rows) {
      const day = localISO(new Date(r.check_in));
      if (day.startsWith(monthKey)) days.add(day);
    }
    const checkIn = todaysRows.length ? todaysRows.map((r) => r.check_in).sort()[0] : null;
    const checkOuts = todaysRows.map((r) => r.check_out).filter((c): c is string => !!c);
    const checkOut = checkOuts.length ? checkOuts.sort().slice(-1)[0] : null;
    return { todayCheckIn: checkIn, todayCheckOut: checkOut, daysThisMonth: days.size };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Today's check-in</div>
            <div className="font-semibold text-xl">{fmtTime(todayCheckIn)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Today's check-out</div>
            <div className="font-semibold text-xl">{fmtTime(todayCheckOut)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Days worked this month</div>
            <div className="font-semibold text-xl">{daysThisMonth}</div>
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
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Hours worked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtDate(r.check_in)}</TableCell>
                    <TableCell>{fmtTime(r.check_in)}</TableCell>
                    <TableCell>{fmtTime(r.check_out)}</TableCell>
                    <TableCell>{fmtHours(r.check_in, r.check_out)}</TableCell>
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
