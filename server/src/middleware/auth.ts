import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthedRequest extends Request {
  admin?: { id: string; role: string };
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

export function signToken(payload: { id: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }
  try {
    const token = header.slice("Bearer ".length);
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Everyone gets the same access except user management, which is SUPER_ADMIN only.
export function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.admin?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Only a super admin can do this" });
  }
  next();
}

// Public booking portal: proof a phone number just passed WhatsApp OTP verification. Distinct
// payload shape (`scope`) from the admin token above so the two can never be confused — this
// token grants no admin access, it only lets the public router create/submit a Hold for the
// phone it names. Deliberately longer-lived (30m) than the reservation Hold itself (15m), so a
// customer whose hold lapses mid-form doesn't need to re-verify, just re-select stalls.
interface PublicOtpTokenPayload {
  phone: string;
  scope: "public-otp";
}

export function signPublicOtpToken(phone: string) {
  return jwt.sign({ phone, scope: "public-otp" } satisfies PublicOtpTokenPayload, JWT_SECRET, { expiresIn: "30m" });
}

export function verifyPublicOtpToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as PublicOtpTokenPayload;
    if (decoded.scope !== "public-otp" || !decoded.phone) return null;
    return decoded.phone;
  } catch {
    return null;
  }
}
