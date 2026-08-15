// Postgres port of the BNI RollCall project's src/lib/otp/store.ts — same challenge/attempts/
// cooldown semantics (hashed code, attempt-exhaustion, resend cooldown), just backed by a plain
// OtpVerification row instead of a Redis key, since this app has no Redis and doesn't need one
// at this traffic volume. One row per phone, overwritten on each new send.

import crypto from "node:crypto";
import { prisma } from "./prisma.js";

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function generateOtpCode(length: number): string {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += digits[crypto.randomInt(0, digits.length)];
  }
  return code;
}

export async function isOnResendCooldown(phone: string): Promise<boolean> {
  const record = await prisma.otpVerification.findUnique({ where: { phone } });
  return !!record && record.cooldownUntil > new Date();
}

export async function getCooldownSecondsRemaining(phone: string): Promise<number> {
  const record = await prisma.otpVerification.findUnique({ where: { phone } });
  if (!record) return 0;
  const ms = record.cooldownUntil.getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

export async function getRemainingAttempts(phone: string): Promise<number> {
  const record = await prisma.otpVerification.findUnique({ where: { phone } });
  if (!record) return 0;
  return Math.max(0, record.maxAttempts - record.attempts);
}

export async function createOtpChallenge(params: {
  phone: string;
  code: string;
  ttlSeconds: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
}): Promise<void> {
  const now = Date.now();
  const data = {
    codeHash: hashCode(params.code),
    attempts: 0,
    maxAttempts: params.maxAttempts,
    expiresAt: new Date(now + params.ttlSeconds * 1000),
    cooldownUntil: new Date(now + params.resendCooldownSeconds * 1000),
    verifiedAt: null,
  };
  await prisma.otpVerification.upsert({
    where: { phone: params.phone },
    update: data,
    create: { phone: params.phone, ...data },
  });
}

export type OtpVerifyResult = "ok" | "no_challenge" | "expired" | "too_many_attempts" | "mismatch";

/// Verifies a submitted code against the stored challenge. On mismatch, increments the
/// attempt counter so repeated wrong guesses eventually exhaust maxAttempts within the
/// original TTL window. On success, stamps verifiedAt (the row is kept, not deleted — the
/// hold/submit routes check verifiedAt + phone match rather than re-verifying).
export async function verifyOtpChallenge(params: { phone: string; code: string }): Promise<OtpVerifyResult> {
  const record = await prisma.otpVerification.findUnique({ where: { phone: params.phone } });
  if (!record) return "no_challenge";
  if (record.expiresAt < new Date()) return "expired";
  if (record.attempts >= record.maxAttempts) return "too_many_attempts";

  if (record.codeHash !== hashCode(params.code)) {
    const attempts = record.attempts + 1;
    await prisma.otpVerification.update({ where: { phone: params.phone }, data: { attempts } });
    return attempts >= record.maxAttempts ? "too_many_attempts" : "mismatch";
  }

  await prisma.otpVerification.update({ where: { phone: params.phone }, data: { verifiedAt: new Date() } });
  return "ok";
}
