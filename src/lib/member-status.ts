import { todayISO, localISO } from "@/lib/format";

export function computeStatus(m: any): string {
  if (!m) return "expired";
  if (m.frozen_at) return "frozen";
  const today = todayISO();
  if (!m.expiry_date) return "expired";
  if (m.expiry_date < today) return "expired";
  const soon = new Date(); soon.setDate(soon.getDate() + 7);
  if (m.expiry_date <= localISO(soon)) return "expiring_soon";
  return "active";
}
