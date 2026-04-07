import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

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
  organisation_id: string | null;
  avatar_url?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isMockAudit: boolean;
  setMockAudit: (val: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
  super_admin: ["dashboard", "incidents", "risks", "complaints", "policies", "participants", "staff", "training", "audit", "heartbeat", "safeguarding", "privacy", "settings", "controls", "competency", "evidence_room"],
  compliance_officer: ["dashboard", "incidents", "risks", "complaints", "policies", "participants", "staff", "training", "audit", "heartbeat", "safeguarding", "privacy", "controls", "competency", "evidence_room"],
  supervisor: ["dashboard", "incidents", "risks", "complaints", "participants", "staff", "training", "safeguarding"],
  trainer: ["dashboard", "incidents", "complaints", "participants", "training", "safeguarding"],
  support_worker: ["dashboard", "incidents", "participants", "safeguarding"],
  hr_admin: ["dashboard", "staff", "training", "privacy", "competency"],
  executive: ["dashboard", "incidents", "risks", "complaints", "policies", "audit", "controls", "evidence_room"],
  participant: ["dashboard", "training", "complaints"],
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMockAudit, setIsMockAudit] = useState(false);

  const fetchUserProfile = useCallback(async (authUser: User) => {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, email, full_name, avatar_url, team_id, organisation_id")
      .eq("id", authUser.id)
      .single();

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authUser.id)
      .limit(1)
      .single();

    if (profile) {
      setUser({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: (roleData?.role as AppRole) || "support_worker",
        team_id: profile.team_id,
        organisation_id: profile.organisation_id,
        avatar_url: profile.avatar_url ?? undefined,
      });
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          setTimeout(() => fetchUserProfile(newSession.user), 0);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      if (existingSession?.user) {
        fetchUserProfile(existingSession.user);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsMockAudit(false);
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

  const setMockAudit = useCallback((val: boolean) => {
    setIsMockAudit(val);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isAuthenticated: !!session, isLoading, isMockAudit, setMockAudit, login, logout, hasRole, hasModule }}>
      {children}
    </AuthContext.Provider>
  );
}
