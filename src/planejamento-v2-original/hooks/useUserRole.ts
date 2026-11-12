// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/planejamento-v2-original/supabaseClient";
import { ROLE_PERMISSIONS } from "@/planejamento-v2-original/config/permissions";
import { getSessionWithTimeout } from "@/planejamento-v2-original/lib/authSession";

type AppRole = "admin" | "operador" | "visualizador" | "rh" | "gestor_rh" | "coordenador";

interface UserRoleData {
  role: AppRole | null;
  isAdmin: boolean;
  isCoordenador: boolean;
  isRH: boolean;
  isGestorRH: boolean;
  canManageRH: boolean;
  canManageOperations: boolean;
  isLoading: boolean;
  userId: string | null;
}

export function useUserRole(): UserRoleData {
  const [role, setRole] = useState<AppRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const fetchUserRole = async (showLoading: boolean) => {
      try {
        if (showLoading) setIsLoading(true);
        setError(null);
        const session = await getSessionWithTimeout();
        
        if (!session?.user) {
          setRole(null);
          setUserId(null);
          setIsLoading(false);
          return;
        }

        setUserId(session.user.id);

        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (roleError) {
          console.warn("Role table error (using default):", roleError.message);
        }

        setRole((roleData?.role as AppRole) || "visualizador");
      } catch (err) {
        console.error("Error fetching user role:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setRole("visualizador");
      } finally {
        setIsLoading(false);
        initialLoadDone.current = true;
      }
    };

    fetchUserRole(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    role,
    isAdmin: role === "admin",
    isCoordenador: role === "coordenador",
    isRH: role === "rh",
    isGestorRH: role === "gestor_rh",
    canManageRH: role === "admin" || role === "rh" || role === "gestor_rh" || role === "coordenador",
    canManageOperations: role === "admin" || role === "coordenador" || role === "operador",
    isLoading,
    userId,
  };
}
