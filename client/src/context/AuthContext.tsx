import { createContext, useContext, useState, type ReactNode } from "react";
import { api, type AdminUser } from "../lib/api";

interface AuthContextValue {
  admin: AdminUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    const raw = localStorage.getItem("admin");
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  });

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("admin", JSON.stringify(data.admin));
    setAdmin(data.admin);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("admin");
    setAdmin(null);
  }

  return <AuthContext.Provider value={{ admin, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
