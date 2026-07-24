import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, Undo2 } from "lucide-react";
import { restoreRecord, hardDelete } from "@/lib/soft-delete";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { fmtDate } from "@/lib/format";
import { useSession } from "@/hooks/use-session";

type TrashTable = "members" | "leads" | "invoices" | "payments" | "pt_enrollments" | "pt_sessions" | "staff";

const TABS: { key: TrashTable; label: string; describe: (r: Record<string, unknown>) => { title: string; sub: string } }[] = [
  { key: "members", label: "Members", describe: (r) => ({ title: String(r.full_name ?? "Member"), sub: String(r.phone ?? "") }) },
  { key: "leads", label: "Leads", describe: (r) => ({ title: String(r.full_name ?? "Lead"), sub: String(r.phone ?? "") }) },
  { key: "invoices", label: "Invoices", describe: (r) => ({ title: `#${r.number ?? ""}`, sub: `₹${Number(r.total ?? 0).toLocaleString("en-IN")}` }) },
  { key: "payments", label: "Payments", describe: (r) => ({ title: `₹${Number(r.amount ?? 0).toLocaleString("en-IN")}`, sub: String(r.mode ?? "") }) },
  { key: "pt_enrollments", label: "PT packages", describe: (r) => ({ title: "PT enrollment", sub: `${r.sessions_used ?? 0}/${r.sessions_total ?? 0} used` }) },
  { key: "pt_sessions", label: "PT sessions", describe: (r) => ({ title: "PT session", sub: r.scheduled_at ? fmtDate(String(r.scheduled_at)) : "" }) },
  { key: "staff", label: "Staff", describe: (r) => ({ title: String(r.full_name ?? "Staff"), sub: String(r.role_label ?? "") }) },
];

export function RecentlyDeleted() {
  const qc = useQueryClient();
  const { isAdmin } = useSession();
  const [tab, setTab] = useState<TrashTable>("members");
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; label: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["recently-deleted", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tab)
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const describe = useMemo(() => TABS.find(t => t.key === tab)!.describe, [tab]);

  const handleRestore = async (row: Record<string, unknown>) => {
    try {
      const desc = describe(row);
      await restoreRecord({
        table: tab,
        id: String(row.id),
        memberId: (row.member_id as string | undefined) ?? (tab === "members" ? String(row.id) : null),
        summary: `Restored ${tab.replace("_", " ")}: ${desc.title}`,
      });
      toast.success("Restored");
      refetch();
      qc.invalidateQueries();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Restore failed";
      toast.error(msg);
    }
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    const row = (data ?? []).find(r => r.id === purgeTarget.id) as Record<string, unknown> | undefined;
    if (!row) return;
    try {
      await hardDelete({
        table: tab,
        id: String(row.id),
        memberId: (row.member_id as string | undefined) ?? null,
        summary: `Permanently deleted ${tab.replace("_", " ")}: ${purgeTarget.label}`,
      });
      toast.success("Permanently deleted");
      setPurgeTarget(null);
      refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      toast.error(msg);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Recently deleted</CardTitle>
        <CardDescription>Items are automatically removed 30 days after deletion. Restore anything, or (admin only) permanently delete now.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TrashTable)}>
          <TabsList className="flex-wrap h-auto">
            {TABS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-6">Loading…</div>
            ) : (data ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Nothing here. Deleted items appear here for 30 days.</div>
            ) : (
              <div className="space-y-2">
                {(data ?? []).map((row) => {
                  const desc = describe(row);
                  const deletedAt = row.deleted_at as string | null;
                  const daysLeft = deletedAt ? Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000)) : 30;
                  return (
                    <div key={String(row.id)} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{desc.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{desc.sub}</span>
                          {deletedAt && <span>· deleted {fmtDate(deletedAt)}</span>}
                          <Badge variant={daysLeft <= 3 ? "destructive" : "secondary"}>{daysLeft}d left</Badge>
                        </div>
                        {row.deleted_reason ? <div className="text-xs italic text-muted-foreground mt-0.5">"{String(row.deleted_reason)}"</div> : null}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleRestore(row)}>
                          <Undo2 className="h-3.5 w-3.5 mr-1" /> Restore
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setPurgeTarget({ id: String(row.id), label: desc.title })}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete now
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <ConfirmActionDialog
        open={!!purgeTarget}
        onOpenChange={(v) => !v && setPurgeTarget(null)}
        title="Permanently delete?"
        description={`This cannot be undone. "${purgeTarget?.label ?? ""}" will be permanently removed.`}
        confirmLabel="Delete permanently"
        typeToConfirm="DELETE"
        onConfirm={handlePurge}
      />
    </Card>
  );
}
