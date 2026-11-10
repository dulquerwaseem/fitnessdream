import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { fmtDateTime } from "@/lib/format";
import { DEVICE_IPS, floorLabel, getNextStaffBiometricUid } from "@/lib/biometric";

type BiometricStatus = "not_enrolled" | "pending" | "active" | "removed";

const statusMeta: Record<BiometricStatus, { label: string; className: string }> = {
  not_enrolled: { label: "Not Enrolled", className: "bg-muted text-muted-foreground border-border" },
  pending: { label: "Pending Fingerprint Scan", className: "bg-warning/15 text-warning border-warning/30" },
  active: { label: "Active", className: "bg-success/15 text-success border-success/30" },
  removed: { label: "Removed", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

export function StaffBiometricTab({ staff, staffId }: { staff: any; staffId: string }) {
  const qc = useQueryClient();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const { data: enrollments } = useQuery({
    queryKey: ["staff-biometric-enrollment", staffId],
    queryFn: async () =>
      (await supabase.from("biometric_device_enrollment").select("*").eq("staff_id", staffId)).data ?? [],
  });

  const rows = enrollments ?? [];
  const enrolledIps = new Set(rows.filter((r) => r.enrolled).map((r) => r.device_ip));
  const bothEnrolled = DEVICE_IPS.every((ip) => enrolledIps.has(ip));

  const status: BiometricStatus =
    staff.biometric_uid == null
      ? "not_enrolled"
      : !staff.biometric_active
        ? "removed"
        : bothEnrolled
          ? "active"
          : "pending";

  const enrolledAt = rows
    .filter((r) => r.enrolled && r.synced_at)
    .map((r) => r.synced_at as string)
    .sort()[0];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["staff", staffId] });
    qc.invalidateQueries({ queryKey: ["staff-biometric-enrollment", staffId] });
  };

  const enroll = async () => {
    setEnrolling(true);
    try {
      const uid = await getNextStaffBiometricUid();
      const { data: updated, error: updateError } = await supabase
        .from("staff")
        .update({ biometric_uid: uid, biometric_active: true })
        .eq("id", staffId)
        .is("biometric_uid", null)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw new Error("Update failed — check permissions.");

      const { error: insertError } = await supabase.from("biometric_device_enrollment").insert(
        DEVICE_IPS.map((device_ip) => ({ staff_id: staffId, device_ip, enrolled: false })),
      );
      if (insertError) throw insertError;

      toast.success("Biometric ID assigned. Take staff member to F22 device to scan fingerprint.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not enroll biometric");
    } finally {
      setEnrolling(false);
      invalidate();
    }
  };

  const remove = async () => {
    const { error } = await supabase.from("staff").update({ biometric_active: false }).eq("id", staffId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed from device");
    invalidate();
  };

  const reEnable = async () => {
    const { error } = await supabase.from("staff").update({ biometric_active: true }).eq("id", staffId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Biometric access re-enabled");
    invalidate();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Fingerprint className="h-4 w-4" /> Biometric access
          </CardTitle>
          <Badge variant="outline" className={statusMeta[status].className}>{statusMeta[status].label}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "not_enrolled" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">This staff member has not been enrolled for biometric access.</p>
              <Button size="sm" onClick={enroll} disabled={enrolling}>
                {enrolling ? "Enrolling…" : "Enroll Biometric"}
              </Button>
            </div>
          )}

          {status === "pending" && (
            <div className="space-y-2 text-sm">
              <div>Biometric ID: <span className="font-mono font-medium">{staff.biometric_uid}</span></div>
              <p className="text-muted-foreground">Take the staff member to the F22 device to scan their fingerprint.</p>
            </div>
          )}

          {status === "active" && (
            <div className="space-y-1 text-sm">
              <div>Biometric ID: <span className="font-mono font-medium">{staff.biometric_uid}</span></div>
              <div>Enrolled on: {enrolledAt ? fmtDateTime(enrolledAt) : "—"}</div>
            </div>
          )}

          {status === "removed" && (
            <div className="space-y-2 text-sm">
              <div>Biometric ID: <span className="font-mono font-medium">{staff.biometric_uid}</span></div>
              <p className="text-muted-foreground">Biometric access has been removed. Re-enable to restore device access with the same biometric ID.</p>
            </div>
          )}

          {(status === "pending" || status === "active") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DEVICE_IPS.map((ip) => {
                const row = rows.find((r) => r.device_ip === ip);
                return (
                  <div key={ip} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="font-medium text-sm">{floorLabel(ip)}</div>
                      <div className="text-xs text-muted-foreground">{ip}</div>
                    </div>
                    <Badge variant="outline" className={row?.enrolled ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground border-border"}>
                      {row?.enrolled ? "Enrolled" : "Not enrolled"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}

          {(status === "pending" || status === "active") && (
            <div className="border-t pt-3">
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRemoveOpen(true)}>
                Remove from Device
              </Button>
            </div>
          )}

          {status === "removed" && (
            <div className="border-t pt-3">
              <Button size="sm" onClick={reEnable}>Re-enable Biometric</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove biometric access?"
        description="This marks the staff member's biometric access as removed. Their biometric ID is kept so access can be re-enabled later without re-scanning."
        confirmLabel="Remove from device"
        onConfirm={remove}
      />
    </div>
  );
}
