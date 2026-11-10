import { supabase } from "@/integrations/supabase/client";

export const DEVICE_IPS = ["192.168.1.7", "192.168.1.202"] as const;

const FLOOR_LABELS: Record<string, string> = {
  "192.168.1.7": "1st Floor",
  "192.168.1.202": "2nd Floor",
};

export function floorLabel(deviceIp: string): string {
  return FLOOR_LABELS[deviceIp] ?? deviceIp;
}

const MIN_UID = 1;
const MAX_UID = 3000;

/** Mirrors the bridge's own uid-assignment query (select max, +1) for consistency. */
export async function nextBiometricUid(): Promise<number> {
  const { data, error } = await supabase
    .from("members")
    .select("biometric_uid")
    .not("biometric_uid", "is", null)
    .order("biometric_uid", { ascending: false })
    .limit(1);
  if (error) throw error;
  const next = (data?.[0]?.biometric_uid ?? 0) + 1;
  if (next > MAX_UID) throw new Error(`No free biometric UID left (${MIN_UID}-${MAX_UID}).`);
  return next;
}

const DEVICE_STALE_MS = 15 * 60 * 1000; // ~3x the bridge's default 5-minute poll interval

/** The bridge has no heartbeat — synced_at only advances on a successful sync
 * cycle — so "online" is inferred from how recently a device last synced. */
export function isDeviceOnline(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return false;
  return Date.now() - new Date(lastSyncedAt).getTime() < DEVICE_STALE_MS;
}

/** Same as nextBiometricUid, but takes the max across members AND staff so the
 * two never get assigned clashing device UIDs. */
export async function getNextStaffBiometricUid(): Promise<number> {
  const [{ data: memberRows, error: memberError }, { data: staffRows, error: staffError }] = await Promise.all([
    supabase.from("members").select("biometric_uid").not("biometric_uid", "is", null).order("biometric_uid", { ascending: false }).limit(1),
    supabase.from("staff").select("biometric_uid").not("biometric_uid", "is", null).order("biometric_uid", { ascending: false }).limit(1),
  ]);
  if (memberError) throw memberError;
  if (staffError) throw staffError;
  const maxUid = Math.max(memberRows?.[0]?.biometric_uid ?? 0, staffRows?.[0]?.biometric_uid ?? 0);
  const next = maxUid + 1;
  if (next > MAX_UID) throw new Error(`No free biometric UID left (${MIN_UID}-${MAX_UID}).`);
  return next;
}
