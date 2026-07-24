/**
 * Normalize a phone number.
 * Strips spaces, hyphens, parens, and any '+<country>' prefix.
 * Keeps the LAST 10 digits — the local subscriber number.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = String(raw).replace(/[^\d]/g, "");
  return digits.slice(-10);
}

/** Format for display, adding a country code if missing. */
export function displayPhone(raw: string | null | undefined, countryCode = "91"): string {
  const n = normalizePhone(raw);
  if (!n) return "";
  return `+${countryCode} ${n.slice(0, 5)} ${n.slice(5)}`;
}

/** wa.me deep link URL with pre-filled encoded message.
 * Phone format: international digits only, no '+' or spaces (e.g. 919036524262).
 */
export function waLink(phone: string, message: string, countryCode: string = "91"): string {
  const n = normalizePhone(phone);
  const cc = String(countryCode).replace(/\D/g, "") || "91";
  const full = n.length === 10 ? `${cc}${n}` : n;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

/** Substitute {{tokens}} in a template string. */
export function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : "",
  );
}
