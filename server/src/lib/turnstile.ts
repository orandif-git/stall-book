// Cloudflare Turnstile server-side verification — the human-check gate in front of
// /api/public/otp/request, the one public endpoint that actually costs money (WhatsApp send)
// and touches a real person's phone. Configured entirely via WA Setup (Super Admin only, see
// server/src/routes/waSettings.ts) — the keys live in WhatsAppSettings, not .env, so they can
// be rotated without a deploy. Optional: if no secret key has been saved yet, verification is
// skipped so the public flow still works before an admin configures it.
import { prisma } from "./prisma.js";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function getTurnstileSiteKey(): Promise<string | null> {
  const row = await prisma.whatsAppSettings.findFirst();
  if (!row?.turnstileEnabled) return null;
  return row?.turnstileSiteKey ?? null;
}

export async function isTurnstileConfigured(): Promise<boolean> {
  const row = await prisma.whatsAppSettings.findFirst();
  return !!row?.turnstileEnabled && !!row?.turnstileSecretKey;
}

export async function verifyTurnstileToken(token: string, remoteIp: string): Promise<boolean> {
  const row = await prisma.whatsAppSettings.findFirst();
  const secret = row?.turnstileSecretKey;
  if (!secret) return true;
  if (!token) return false;

  const form = new URLSearchParams();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteIp && remoteIp !== "unknown") form.append("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body: form });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    // Can't reach Cloudflare to verify — fail closed (treat as unverified) since this is a
    // security gate, not a best-effort feature. A brief Cloudflare outage blocking OTP
    // requests is a far smaller problem than the gate silently doing nothing.
    return false;
  }
}
