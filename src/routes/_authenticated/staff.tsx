import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/format";
import { StaffBiometricTab } from "@/components/staff-biometric-tab";
import { StaffAttendanceTab } from "@/components/staff-attendance-tab";
import { toast } from "sonner";
import { Plus, UserCog, Phone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff — Fitness Dream" },
      { name: "description", content: "Manage trainers, front-desk and admin staff." },
    ],
  }),
  component: StaffPage,
});

function StaffPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", role_label: "trainer" });
  const [selected, setSelected] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => (await supabase.from("staff").select("*").is("deleted_at", null).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: freshSelected } = useQuery({
    queryKey: ["staff", selected?.id],
    queryFn: async () => (await supabase.from("staff").select("*").eq("id", selected!.id).maybeSingle()).data,
    enabled: !!selected,
  });
  const staffForSheet = freshSelected ?? selected;

  const add = async () => {
    if (!form.full_name.trim() || !form.phone.trim()) return toast.error("Name and phone required");
    const { error } = await supabase.from("staff").insert({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email || null,
      role_label: form.role_label,
      active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Staff added");
    setOpen(false);
    setForm({ full_name: "", phone: "", email: "", role_label: "trainer" });
    qc.invalidateQueries({ queryKey: ["staff-list"] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("staff").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["staff-list"] });
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Trainers, front-desk and admins."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> Add staff</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add staff</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="space-y-1">
                  <Label>Role</Label>
                  <Select value={form.role_label} onValueChange={(v) => setForm(f => ({ ...f, role_label: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trainer">Trainer</SelectItem>
                      <SelectItem value="front_desk">Front desk</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button className="gradient-primary text-primary-foreground" onClick={add}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="grid gap-3">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center">
          <UserCog className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No staff yet. Add your first trainer.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((s) => (
            <Card key={s.id} className="card-hover cursor-pointer" onClick={() => setSelected(s)}>
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials(s.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{s.full_name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{s.role_label.replace("_"," ")} · {s.phone}</div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant="outline" className={s.active ? "border-success/30 text-success" : "border-border text-muted-foreground"}>
                    {s.active ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); toggleActive(s.id, s.active); }}
                  >
                    {s.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {staffForSheet && (
            <>
              <SheetHeader className="mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials(staffForSheet.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 text-left">
                    <SheetTitle className="truncate">{staffForSheet.full_name}</SheetTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground capitalize">
                      <span>{staffForSheet.role_label.replace("_", " ")}</span>
                      {staffForSheet.phone ? <span className="flex items-center gap-1 normal-case"><Phone className="h-3.5 w-3.5" /> {staffForSheet.phone}</span> : null}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <Tabs defaultValue="biometric">
                <TabsList>
                  <TabsTrigger value="biometric">Biometric</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                </TabsList>
                <TabsContent value="biometric">
                  <StaffBiometricTab staff={staffForSheet} staffId={staffForSheet.id} />
                </TabsContent>
                <TabsContent value="attendance">
                  <StaffAttendanceTab staffId={staffForSheet.id} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
