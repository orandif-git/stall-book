import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { admin } = useAuth();
  if (!admin) return <Navigate to="/login" replace />;
  if (admin.role !== "SUPER_ADMIN") return <Navigate to="/events" replace />;
  return <>{children}</>;
}
