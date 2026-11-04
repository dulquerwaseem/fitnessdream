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
