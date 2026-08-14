import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { admin } = useAuth();
  if (!admin) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
