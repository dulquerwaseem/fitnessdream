import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtDate, initials } from "@/lib/format";
import { softDelete } from "@/lib/soft-delete";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { StaffBiometricTab } from "@/components/staff-biometric-tab";
import { StaffAttendanceTab } from "@/components/staff-attendance-tab";
import { toast } from "sonner";
import { ArrowLeft, Phone, Mail, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Staff — Fitness Dream` },
      { name: "description", content: `Staff profile ${params.id}` },
    ],
  }),
  component: StaffDetail,
});

function StaffDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: s, isLoading } = useQuery({
    queryKey: ["staff", id],
    queryFn: async () => (await supabase.from("staff").select("*").eq("id", id).maybeSingle()).data,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <div><Skeleton className="h-40 rounded-xl" /></div>;
  if (!s) return <div className="text-center py-16 text-muted-foreground">Staff member not found.</div>;

  const openEdit = () => {
    setEditForm({
      full_name: s.full_name ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      role_label: s.role_label ?? "trainer",
      shift_start: s.shift_start ?? "",
      shift_end: s.shift_end ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.full_name.trim() || !editForm.phone.trim()) return toast.error("Name and phone are required");
    const { error } = await supabase.from("staff").update({
      full_name: editForm.full_name.trim(),
      phone: editForm.phone.trim(),
      email: editForm.email || null,
      role_label: editForm.role_label,
      shift_start: editForm.shift_start || null,
      shift_end: editForm.shift_end || null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Details updated");
    setEditOpen(false);
    qc.invalidateQueries({ queryKey: ["staff", id] });
  };

  const toggleActive = async () => {
    const { error } = await supabase.from("staff").update({ active: !s.active }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff", id] });
  };

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/staff" })} className="mb-2 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20 shrink-0">
                {s.photo_url ? <img src={s.photo_url} alt={s.full_name} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-display font-bold">{initials(s.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-display font-bold truncate">{s.full_name}</h1>
                  <Badge variant="outline" className={s.active ? "border-success/30 text-success" : "border-border text-muted-foreground"}>
                    {s.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground capitalize">
                  <span>{s.role_label.replace("_", " ")}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {s.phone ? <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {s.phone}</span> : null}
                  {s.email ? <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {s.email}</span> : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
              <Button size="sm" variant="outline" onClick={toggleActive}>{s.active ? "Deactivate" : "Activate"}</Button>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="biometric">Biometric</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Role" value={s.role_label.replace("_", " ")} />
            <Stat label="Joined" value={fmtDate(s.created_at)} />
            <Stat label="Shift start" value={s.shift_start ?? "—"} />
            <Stat label="Shift end" value={s.shift_end ?? "—"} />
          </div>
        </TabsContent>

        <TabsContent value="biometric">
          <StaffBiometricTab staff={s} staffId={id} />
        </TabsContent>

        <TabsContent value="attendance">
          <StaffAttendanceTab staffId={id} />
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit staff details</DialogTitle></DialogHeader>
          {editForm && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Full name</Label><Input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editForm.role_label} onValueChange={(v) => setEditForm({ ...editForm, role_label: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trainer">Trainer</SelectItem>
                    <SelectItem value="front_desk">Front desk</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Shift start</Label><Input type="time" value={editForm.shift_start ?? ""} onChange={e => setEditForm({ ...editForm, shift_start: e.target.value })} /></div>
              <div className="space-y-2"><Label>Shift end</Label><Input type="time" value={editForm.shift_end ?? ""} onChange={e => setEditForm({ ...editForm, shift_end: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this staff member?"
        description={`${s.full_name} will be moved to Recently Deleted. You can restore them from Settings within 30 days.`}
        confirmLabel="Delete staff"
        typeToConfirm={s.full_name}
        askReason
        onConfirm={async (reason) => {
          try {
            await softDelete({
              table: "staff", id, reason,
              summary: `Deleted staff ${s.full_name}`.trim(),
            });
            toast.success("Staff member moved to Recently Deleted");
            qc.invalidateQueries();
            navigate({ to: "/staff" });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
          }
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-semibold capitalize">{value}</div>
      </CardContent>
    </Card>
  );
}
