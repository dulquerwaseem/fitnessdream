import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { BiometricDeviceTable, type BiometricDeviceRow } from "@/components/biometric-device-table";
import { DEVICE_IPS, floorLabel, isDeviceOnline } from "@/lib/biometric";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/biometric-devices")({
  head: () => ({
    meta: [
      { title: "Biometric Devices — Fitness Dream" },
      { name: "description", content: "F22 device enrollment status for members and staff." },
    ],
  }),
  component: BiometricDevicesPage,
});

function BiometricDevicesPage() {
  const { data } = useQuery({
    queryKey: ["biometric-device-enrollment"],
    queryFn: async () =>
      (await supabase
        .from("biometric_device_enrollment")
        .select("id, device_ip, enrolled, synced_at, member_id, staff_id, members(full_name, biometric_uid, biometric_active), staff(full_name, biometric_uid, biometric_active)")
        .in("device_ip", DEVICE_IPS)).data ?? [],
  });

  const rows = (data ?? []) as unknown as BiometricDeviceRow[];

  const byDevice = useMemo(() => {
    return DEVICE_IPS.map((ip) => {
      const deviceRows = rows.filter((r) => r.device_ip === ip);
      const lastSyncedAt = deviceRows
        .map((r) => r.synced_at)
        .filter((s): s is string => !!s)
        .sort()
        .slice(-1)[0] ?? null;
      return {
        ip,
        rows: deviceRows,
        totalEnrolled: deviceRows.filter((r) => r.enrolled).length,
        lastSyncedAt,
        online: isDeviceOnline(lastSyncedAt),
      };
    });
  }, [rows]);

  return (
    <div>
      <PageHeader title="Biometric Devices" description="F22 device enrollment status for members and staff." />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {byDevice.map((d) => (
          <Card key={d.ip}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{floorLabel(d.ip)}</CardTitle>
                <div className="text-xs text-muted-foreground">{d.ip}</div>
              </div>
              <Badge
                variant="outline"
                className={d.online ? "bg-success/15 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}
              >
                {d.online ? "Online" : "Offline"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>Total enrolled: <span className="font-medium">{d.totalEnrolled}</span></div>
              <div className="text-muted-foreground">Last synced: {d.lastSyncedAt ? fmtDateTime(d.lastSyncedAt) : "—"}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue={DEVICE_IPS[0]}>
        <TabsList>
          {byDevice.map((d) => (
            <TabsTrigger key={d.ip} value={d.ip}>{floorLabel(d.ip)}</TabsTrigger>
          ))}
        </TabsList>
        {byDevice.map((d) => (
          <TabsContent key={d.ip} value={d.ip}>
            <Card>
              <CardContent className="p-0">
                <BiometricDeviceTable rows={d.rows} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
