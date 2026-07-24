import { supabase } from "@/integrations/supabase/client";
import { logAudit, type AuditEntityType } from "./audit";

type Table = "members" | "leads" | "invoices" | "payments" | "pt_enrollments" | "pt_sessions" | "staff";

const TABLE_TO_ENTITY: Record<Table, AuditEntityType> = {
  members: "member",
  leads: "lead",
  invoices: "invoice",
  payments: "payment",
  pt_enrollments: "pt_enrollment",
  pt_sessions: "pt_session",
  staff: "staff",
};

export async function softDelete(args: {
  table: Table;
  id: string;
  memberId?: string | null;
  reason?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  const actor = await logAudit({
    action: "soft_delete",
    entity_type: TABLE_TO_ENTITY[args.table],
    entity_id: args.id,
    member_id: args.memberId ?? null,
    summary: args.summary,
    metadata: args.metadata,
  });
  const { error } = await supabase
    .from(args.table)
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: actor.id,
      deleted_reason: args.reason ?? null,
    })
    .eq("id", args.id);
  if (error) throw error;
}

export async function restoreRecord(args: {
  table: Table;
  id: string;
  memberId?: string | null;
  summary: string;
}) {
  await logAudit({
    action: "restore",
    entity_type: TABLE_TO_ENTITY[args.table],
    entity_id: args.id,
    member_id: args.memberId ?? null,
    summary: args.summary,
  });
  const { error } = await supabase
    .from(args.table)
    .update({ deleted_at: null, deleted_by: null, deleted_reason: null })
    .eq("id", args.id);
  if (error) throw error;
}

export async function hardDelete(args: {
  table: Table;
  id: string;
  memberId?: string | null;
  summary: string;
}) {
  await logAudit({
    action: "purge",
    entity_type: TABLE_TO_ENTITY[args.table],
    entity_id: args.id,
    member_id: args.memberId ?? null,
    summary: args.summary,
  });
  const { error } = await supabase.from(args.table).delete().eq("id", args.id);
  if (error) throw error;
}
