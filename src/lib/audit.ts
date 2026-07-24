import { supabase } from "@/integrations/supabase/client";

export type AuditEntityType =
  | "member" | "lead" | "invoice" | "payment"
  | "pt_enrollment" | "pt_session" | "staff";

export type AuditAction =
  | "soft_delete" | "restore" | "purge"
  | "void_invoice" | "edit_payment" | "reassign_pt" | "undo_renewal"
  | "renewal" | "payment_recorded" | "note";

async function getActor() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { id: null as string | null, name: "System" };
  const meta = user.user_metadata as Record<string, unknown> | null;
  const fallback = user.email ?? "Staff";
  const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const name = (prof?.full_name as string | undefined) || (meta?.full_name as string | undefined) || fallback;
  return { id: user.id, name };
}

export async function logAudit(entry: {
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id?: string | null;
  member_id?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  const actor = await getActor();
  const { error } = await supabase.from("audit_log").insert({
    actor_id: actor.id,
    actor_name: actor.name,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id ?? null,
    member_id: entry.member_id ?? null,
    summary: entry.summary,
    metadata: (entry.metadata ?? {}) as never,
  });
  if (error) console.warn("audit_log insert failed:", error.message);
  return actor;
}
