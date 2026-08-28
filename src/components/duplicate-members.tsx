import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { logAudit } from "@/lib/audit";

type Row = {
  id: string;
  full_name: string;
  phone: string;
  phone_normalized: string | null;
  start_date: string | null;
  expiry_date: string | null;
  created_at: string | null;
};

type Group = { key: string; name: string; phone: string; rows: Row[] };

/** Finds live members sharing the same name + phone so front-desk duplicates
 *  (usually created by a legacy import) can be removed one pair at a time.
 *  Removal is a soft delete — restorable from Recently deleted for 30 days. */
export function DuplicateMembers() {
  const qc = useQueryClient();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const scan = async () => {
    setScanning(true);
    try {
      const all: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("members")
          .select("id, full_name, phone, phone_normalized, start_date, expiry_date, created_at")
          .is("deleted_at", null)
          .order("created_at")
          .range(from, from + 999);
        if (error) throw error;
        all.push(...((data ?? []) as Row[]));
        if (!data || data.length < 1000) break;
      }

      const byPerson = new Map<string, Row[]>();
      for (const r of all) {
        const key = `${(r.full_name ?? "").trim().toLowerCase()}|${r.phone_normalized ?? r.phone ?? ""}`;
        byPerson.set(key, [...(byPerson.get(key) ?? []), r]);
      }
      const found: Group[] = [];
      for (const [key, rows] of byPerson) {
        if (rows.length < 2) continue;
        const sorted = [...rows].sort((a, b) => (a.expiry_date ?? "").localeCompare(b.expiry_date ?? ""));
        found.push({ key, name: rows[0]!.full_name, phone: rows[0]!.phone, rows: sorted });
      }
      setGroups(found);
      toast.success(found.length === 0 ? "No duplicate members found" : `${found.length} possible duplicate${found.length === 1 ? "" : "s"} found`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const removeOlder = async (g: Group) => {
    // Keep the record with the latest expiry; remove the rest.
    const keep = g.rows[g.rows.length - 1]!;
    const drop = g.rows.slice(0, -1);
    setBusy(g.key);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("members")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userRes.user?.id ?? null,
          deleted_reason: "Duplicate member record (kept the latest expiry)",
        })
        .in("id", drop.map(r => r.id));
      if (error) throw error;
      await logAudit({
        action: "soft_delete",
        entity_type: "member",
        summary: `Removed ${drop.length} duplicate record(s) for ${g.name} — kept the record expiring ${keep.expiry_date ? fmtDate(keep.expiry_date) : "—"}`,
        metadata: { kept: keep.id, removed: drop.map(r => r.id) },
      });
      setGroups(prev => (prev ?? []).filter(x => x.key !== g.key));
      toast.success(`Duplicate removed for ${g.name} — restorable from Recently deleted`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove duplicate");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Copy className="h-4 w-4" /> Find duplicate members
        </CardTitle>
        <CardDescription>
          Lists members with the same name and phone number — usually the same person entered twice during an import.
          Removing keeps the record with the latest expiry; the other stays in “Recently deleted” for 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" size="sm" onClick={scan} disabled={scanning}>
          {scanning ? "Scanning…" : "Scan for duplicates"}
        </Button>

        {groups && groups.length === 0 && (
          <p className="text-sm text-muted-foreground">No duplicate members found.</p>
        )}

        {groups && groups.length > 0 && (
          <ul className="space-y-2">
            {groups.map(g => (
              <li key={g.key} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.phone} · {g.rows.length} records</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/50 text-destructive"
                    disabled={busy === g.key}
                    onClick={() => removeOlder(g)}
                  >
                    {busy === g.key ? "Removing…" : "Keep latest, remove others"}
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.rows.map((r, i) => (
                    <Badge key={r.id} variant={i === g.rows.length - 1 ? "default" : "secondary"} className="font-normal">
                      {r.start_date ? fmtDate(r.start_date) : "—"} → {r.expiry_date ? fmtDate(r.expiry_date) : "—"}
                      {i === g.rows.length - 1 ? " (keep)" : ""}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
