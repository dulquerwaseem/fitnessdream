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
import { DEVICE_IPS, floorLabel, nextBiometricUid } from "@/lib/biometric";
import { computeStatus } from "@/lib/member-status";

type BiometricStatus = "not_enrolled" | "pending" | "active" | "blocked" | "removed";

const statusMeta: Record<BiometricStatus, { label: string; className: string }> = {
  not_enrolled: { label: "Not Enrolled", className: "bg-muted text-muted-foreground border-border" },
  pending: { label: "Pending Fingerprint Scan", className: "bg-warning/15 text-warning border-warning/30" },
  active: { label: "Active", className: "bg-success/15 text-success border-success/30" },
  blocked: { label: "Blocked", className: "bg-destructive/10 text-destructive border-destructive/30" },
  removed: { label: "Removed", className: "bg-muted text-muted-foreground border-border" },
};

export function MemberBiometricTab({ member, memberId }: { member: any; memberId: string }) {
  const qc = useQueryClient();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const { data: enrollments } = useQuery({
    queryKey: ["member-biometric-enrollment", memberId],
    queryFn: async () =>
      (await supabase.from("biometric_device_enrollment").select("*").eq("member_id", memberId)).data ?? [],
  });

  const rows = enrollments ?? [];
  const enrolledIps = new Set(rows.filter((r) => r.enrolled).map((r) => r.device_ip));
  const bothEnrolled = DEVICE_IPS.every((ip) => enrolledIps.has(ip));
  const expired = computeStatus(member) === "expired";

  const status: BiometricStatus = expired
    ? "blocked"
    : member.biometric_uid == null
      ? "not_enrolled"
      : member.biometric_active === false
        ? "removed"
        : bothEnrolled
          ? "active"
          : "pending";

  const enrolledAt = rows
    .filter((r) => r.enrolled && r.synced_at)
    .map((r) => r.synced_at as string)
    .sort()[0];

  const showRemove = member.biometric_uid != null && rows.length > 0 && status !== "removed";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["member", memberId] });
    qc.invalidateQueries({ queryKey: ["member-biometric-enrollment", memberId] });
  };

  const enroll = async () => {
    setEnrolling(true);
    try {
      const uid = await nextBiometricUid();
      const { data: updated, error: updateError } = await supabase
        .from("members")
        .update({ biometric_uid: uid, biometric_active: true })
        .eq("id", memberId)
        .is("biometric_uid", null)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw new Error("Biometric ID was already assigned to this member — refreshing.");

      const { error: insertError } = await supabase.from("biometric_device_enrollment").insert(
        DEVICE_IPS.map((device_ip) => ({ member_id: memberId, device_ip, enrolled: false })),
      );
      if (insertError) throw insertError;

      toast.success("Biometric ID assigned. Take member to F22 device to scan fingerprint.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not enroll biometric");
    } finally {
      setEnrolling(false);
      invalidate();
    }
  };

  // Only flag the member as inactive. Enrollment rows are left as-is: the sync
  // bridge looks for enrolled = true rows whose member has biometric_active =
  // false, deletes them from the F22, and then sets enrolled = false itself.
  // Deleting or clearing the rows here would hide the member from the bridge.
  const remove = async () => {
    const { error } = await supabase
      .from("members")
      .update({ biometric_active: false })
      .eq("id", memberId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removal queued. The sync bridge will remove them from the devices within ~5 minutes.");
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
              <p className="text-sm text-muted-foreground">This member has not been enrolled for biometric access.</p>
              <Button size="sm" onClick={enroll} disabled={enrolling}>
                {enrolling ? "Enrolling…" : "Enroll Biometric"}
              </Button>
            </div>
          )}

          {status === "pending" && (
            <div className="space-y-2 text-sm">
              <div>Biometric ID: <span className="font-mono font-medium">{member.biometric_uid}</span></div>
              <p className="text-muted-foreground">Take the member to the F22 device to scan their fingerprint.</p>
            </div>
          )}

          {status === "active" && (
            <div className="space-y-1 text-sm">
              <div>Biometric ID: <span className="font-mono font-medium">{member.biometric_uid}</span></div>
              <div>Enrolled on: {enrolledAt ? fmtDateTime(enrolledAt) : "—"}</div>
            </div>
          )}

          {status === "blocked" && (
            <div className="space-y-2 text-sm">
              {member.biometric_uid != null && (
                <div>Biometric ID: <span className="font-mono font-medium">{member.biometric_uid}</span></div>
              )}
              <p className="text-muted-foreground">Membership has expired — biometric access is automatically removed from both devices by the sync bridge.</p>
            </div>
          )}

          {status === "removed" && (
            <div className="space-y-2 text-sm">
              <div>Biometric ID: <span className="font-mono font-medium">{member.biometric_uid}</span></div>
              <p className="text-muted-foreground">
                {enrolledIps.size > 0
                  ? "Biometric access was turned off. The sync bridge will remove the member from the devices on its next pass (within ~5 minutes)."
                  : "Biometric access is turned off. The member has been removed from the devices."}
              </p>
            </div>
          )}

          {(status === "pending" || status === "active" || status === "blocked" || status === "removed") && (
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

          {showRemove && (
            <div className="border-t pt-3">
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRemoveOpen(true)}>
                Remove from Device
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove biometric access?"
        description="This turns off the member's biometric access. The sync bridge removes them from the F22 devices on its next pass (within ~5 minutes) and will not re-add them. Their biometric ID is kept."
        confirmLabel="Remove from device"
        onConfirm={remove}
      />
    </div>
  );
}
