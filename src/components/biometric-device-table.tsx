import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { fmtDateTime } from "@/lib/format";

export type BiometricDeviceRow = {
  id: string;
  device_ip: string;
  enrolled: boolean;
  synced_at: string | null;
  member_id: string | null;
  staff_id: string | null;
  members: { full_name: string; biometric_uid: number | null; biometric_active: boolean | null } | null;
  staff: { full_name: string; biometric_uid: number | null; biometric_active: boolean | null } | null;
};

export function BiometricDeviceTable({ rows }: { rows: BiometricDeviceRow[] }) {
  const qc = useQueryClient();
  const [removing, setRemoving] = useState<BiometricDeviceRow | null>(null);

  const remove = async () => {
    if (!removing) return;
    const table = removing.member_id ? "members" : "staff";
    const id = removing.member_id ?? removing.staff_id!;
    const { error } = await supabase.from(table).update({ biometric_active: false }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed from device");
    qc.invalidateQueries({ queryKey: ["biometric-device-enrollment"] });
  };

  if (rows.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">No users enrolled on this device yet.</div>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Biometric ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Enrollment date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const person = row.members ?? row.staff;
            const type = row.member_id ? "Member" : "Staff";
            return (
              <TableRow key={row.id}>
                <TableCell className="font-mono">{person?.biometric_uid ?? "—"}</TableCell>
                <TableCell>{person?.full_name ?? "—"}</TableCell>
                <TableCell>{type}</TableCell>
                <TableCell>{row.synced_at ? fmtDateTime(row.synced_at) : "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={row.enrolled ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}
                  >
                    {row.enrolled ? "Enrolled" : "Pending fingerprint scan"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setRemoving(row)}
                  >
                    Remove from device
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConfirmActionDialog
        open={!!removing}
        onOpenChange={(v) => !v && setRemoving(null)}
        title="Remove biometric access?"
        description="This marks the person's biometric access as removed. Their biometric ID is kept so access can be re-enabled later without re-scanning. The device itself will catch up on its next sync cycle."
        confirmLabel="Remove from device"
        onConfirm={remove}
      />
    </>
  );
}
