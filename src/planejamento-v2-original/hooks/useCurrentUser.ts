// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useState, useEffect } from "react";
import { supabase } from "@/planejamento-v2-original/supabaseClient";
import { getSessionWithTimeout } from "@/planejamento-v2-original/lib/authSession";

interface CurrentUser {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const session = await getSessionWithTimeout();
        
        if (!session?.user) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, email, full_name, avatar_url")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          setUser(profile);
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, isLoading };
}
