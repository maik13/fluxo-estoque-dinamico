import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState } from '@/utils/authCleanup';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    // Then get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    cleanupAuthState();
    try {
      try { await supabase.auth.signOut({ scope: 'global' }); } catch {}
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      window.location.href = '/';
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao entrar');
    }
  };

  const signUp = async (email: string, password: string) => {
    setError(null);
    cleanupAuthState();
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl }
      });
      
      if (error) {
        throw error;
      }
      // Most Supabase projects need email confirmation depending on settings
      // We still reload to ensure clean state
      window.location.href = '/';
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao cadastrar');
    }
  };

  const signOut = async () => {
    cleanupAuthState();
    try { await supabase.auth.signOut({ scope: 'global' }); } catch {}
    window.location.href = '/auth';
  };

  return { user, session, loading, error, signIn, signUp, signOut };
};
