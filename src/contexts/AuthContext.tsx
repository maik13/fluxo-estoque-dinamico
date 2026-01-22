import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { cleanupAuthState } from "@/utils/authCleanup";

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Força re-login quando detectar sessão/token inválido (evita loops). */
  forceReauth: (reason?: string) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const redirectingRef = useRef(false);

  const forceReauth = (reason?: string) => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    console.warn("Forçando reautenticação:", reason);
    cleanupAuthState();
    setSession(null);
    setUser(null);
    // Evita ficar preso em loading em hooks dependentes
    setLoading(false);
    window.location.href = "/auth";
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // TOKEN_REFRESHED só ocorre em sucesso; em falha pode vir SIGNED_OUT ou erro no getSession
      if (event === "SIGNED_OUT") {
        cleanupAuthState();
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      if (event === "TOKEN_REFRESHED" && !newSession) {
        forceReauth("token_refresh_failed");
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error("Error getting session:", error);
          forceReauth("getSession_error");
          return;
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to get session:", err);
        forceReauth("getSession_exception");
      });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    cleanupAuthState();
    redirectingRef.current = false;
    try {
      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch {}

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = "/";
    } catch (e: any) {
      setError(e?.message ?? "Falha ao entrar");
    }
  };

  const signUp = async (email: string, password: string) => {
    setError(null);
    cleanupAuthState();
    redirectingRef.current = false;
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl },
      });

      if (error) throw error;
      window.location.href = "/";
    } catch (e: any) {
      setError(e?.message ?? "Falha ao cadastrar");
    }
  };

  const signOut = async () => {
    cleanupAuthState();
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {}
    window.location.href = "/auth";
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, session, loading, error, signIn, signUp, signOut, forceReauth }),
    [user, session, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};
