import React, { createContext, useContext, useState, useCallback } from "react";

export type AppRole =
  | "super_admin"
  | "compliance_officer"
  | "supervisor"
  | "trainer"
  | "support_worker"
  | "hr_admin"
  | "executive"
  | "participant";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  team_id: string | null;
  organisation_id: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: AppRole | AppRole[]) => boolean;
  hasModule: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

const ROLE_MODULES: Record<AppRole, string[]> = {
  super_admin: ["dashboard", "incidents", "risks", "complaints", "policies", "participants", "staff", "training", "audit", "settings"],
  compliance_officer: ["dashboard", "incidents", "risks", "complaints", "policies", "participants", "staff", "training", "audit"],
  supervisor: ["dashboard", "incidents", "risks", "complaints", "participants", "staff", "training"],
  trainer: ["dashboard", "incidents", "complaints", "participants", "training"],
  support_worker: ["dashboard", "incidents", "participants"],
  hr_admin: ["dashboard", "staff", "training"],
  executive: ["dashboard", "incidents", "risks", "complaints", "policies", "audit"],
  participant: ["dashboard", "training", "complaints"],
};

// Demo user for development
const DEMO_USER: UserProfile = {
  id: "demo-001",
  email: "admin@dgtg.com.au",
  full_name: "DGTG Admin",
  role: "super_admin",
  team_id: null,
  organisation_id: "org-001",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(DEMO_USER);

  const login = useCallback(async (_email: string, _password: string) => {
    // TODO: Replace with Supabase auth
    setUser(DEMO_USER);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (role: AppRole | AppRole[]) => {
      if (!user) return false;
      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(user.role);
    },
    [user]
  );

  const hasModule = useCallback(
    (module: string) => {
      if (!user) return false;
      return ROLE_MODULES[user.role]?.includes(module) ?? false;
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, hasRole, hasModule }}>
      {children}
    </AuthContext.Provider>
  );
}
