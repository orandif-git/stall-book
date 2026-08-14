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
