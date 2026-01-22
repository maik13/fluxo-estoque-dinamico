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
      console.log('Auth state change:', event);
      
      // Se ocorrer TOKEN_REFRESHED com falha ou SIGNED_OUT, limpar estado
      if (event === 'TOKEN_REFRESHED' && !newSession) {
        console.log('Token refresh failed, cleaning up...');
        cleanupAuthState();
        setSession(null);
        setUser(null);
        window.location.href = '/auth';
        return;
      }
      
      // Se o token expirou sem conseguir renovar
      if (event === 'SIGNED_OUT') {
        cleanupAuthState();
        setSession(null);
        setUser(null);
        return;
      }
      
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    // Then get current session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        // Se erro ao obter sessão, limpar e redirecionar
        cleanupAuthState();
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      console.error('Failed to get session:', err);
      cleanupAuthState();
      setSession(null);
      setUser(null);
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
