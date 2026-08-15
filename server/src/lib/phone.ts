// Ported from the BNI RollCall project's src/lib/phone.ts — same normalization/validation
// rules for Indian mobile numbers, reused here for the public booking portal's OTP flow.

/// Strips to digits, removes leading 91/+91 only if number has country code length, keeps last 10 digits.
export function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length >= 12 && digits.startsWith("91")) return digits.slice(2).slice(-10);
  if (digits.length === 11 && digits.startsWith("91")) return digits.slice(0, 10);
  return digits.slice(-10);
}

/// Validates mobile is exactly 10 digits after normalization.
export function validateMobile(raw: string): { valid: boolean; mobile?: string; error?: string } {
  const normalized = normalizeMobile(raw);
  if (normalized.length !== 10) {
    return { valid: false, error: "Mobile number must be exactly 10 digits" };
  }
  if (!/^[6-9]\d{9}$/.test(normalized)) {
    return { valid: false, error: "Invalid Indian mobile number: must start with 6, 7, 8, or 9" };
  }
  return { valid: true, mobile: normalized };
}

/// Prepends 91 country code for WhatsApp sending.
export function toWhatsAppPhone(mobile: string): string {
  return `91${normalizeMobile(mobile)}`;
}
