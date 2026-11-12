// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useEffect, useMemo, useState } from "react";
import { normalizePermissionName, roleHasPermission } from "@/planejamento-v2-original/config/permissions";
import { supabase } from "@/planejamento-v2-original/supabaseClient";
import { getSessionWithTimeout } from "@/planejamento-v2-original/lib/authSession";

const PERMISSIONS_TIMEOUT_MS = 8_000;

interface UserPermissionsData {
  permissions: string[];
  role: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
}

interface EffectivePermissionRow {
  permission_name?: string | null;
}

const sb = supabase as any;

const ROLE_PRIORITY = [
  "admin",
  "coordenador",
  "gestor_rh",
  "rh",
  "operador",
  "visualizador",
];

const CRITICAL_PERMISSION_ALIASES: Record<string, string[]> = {
  registrar_ponto: ["registrar_ponto"],
  visualizar_ponto: ["visualizar_ponto", "visualizar_status_ponto"],
  controle_ponto: ["controle_ponto", "controle_de_ponto", "acesso_controle_ponto"],
  aprovar_ponto: ["aprovar_ponto"],
  rh_info: ["rh_info", "informacoes_rh"],
};

function selectEffectiveRole(roles: string[]): string {
  const uniqueRoles = Array.from(new Set(roles.filter(Boolean)));
  return ROLE_PRIORITY.find((role) => uniqueRoles.includes(role)) || uniqueRoles[0] || "visualizador";
}

function normalizePermissionList(names: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(names.map(normalizePermissionName).filter((name): name is string => Boolean(name))),
  );
}

async function fetchCriticalPermissions(userId: string): Promise<string[]> {
  const resolved: string[] = [];

  await Promise.all(
    Object.entries(CRITICAL_PERMISSION_ALIASES).map(async ([canonicalName, aliases]) => {
      for (const alias of aliases) {
        const { data, error } = await sb.rpc("has_permission", {
          _user_id: userId,
          _permission_name: alias,
        });

        if (!error && data === true) {
          resolved.push(canonicalName);
          break;
        }
      }
    }),
  );

  return normalizePermissionList(resolved);
}

export function useUserPermissions(): UserPermissionsData {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let isInitial = true;

    const fetchPermissionsAndRole = async (userId: string, showLoading: boolean) => {
      try {
        if (cancelled) return;
        if (showLoading) setIsLoading(true);

        const { data: roleRows, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (roleError) {
          console.warn("Role lookup error:", roleError.message);
        }

        const userRole = selectEffectiveRole((roleRows || []).map((row) => String(row.role || "")));
        if (!cancelled) setRole(userRole);

        if (userRole === "admin") {
          const { data: allPermissions, error: allPermError } = await supabase
            .from("permissions")
            .select("name");

          if (allPermError) {
            console.warn("Permissions table error:", allPermError.message);
          }

          if (!cancelled) {
            setPermissions(normalizePermissionList((allPermissions || []).map((permission) => permission.name)));
          }
          return;
        }

        // Reconciliacao independente para os acessos de Ponto/RH. Mesmo que o
        // catalogo tenha uma chave antiga, has_permission devolve a decisao final.
        const criticalPermissionsPromise = fetchCriticalPermissions(userId);

        // Fonte principal: uma única função do banco retorna o conjunto efetivo
        // do usuário, incluindo permissões individuais e herança RH/Gestor de RH.
        const { data: effectiveRows, error: effectiveError } = await sb.rpc(
          "get_my_effective_permissions",
        );

        if (!effectiveError) {
          const criticalPermissions = await criticalPermissionsPromise;
          if (!cancelled) {
            setPermissions(
              normalizePermissionList([
                ...((effectiveRows || []) as EffectivePermissionRow[]).map(
                  (row) => row.permission_name,
                ),
                ...criticalPermissions,
              ]),
            );
          }
          return;
        }

        // Compatibilidade temporária enquanto a migration ainda não foi aplicada.
        console.warn(
          "Effective permissions RPC unavailable; using legacy lookup:",
          effectiveError.message,
        );

        const { data: userPermissionRows, error: userPermError } = await supabase
          .from("user_permissions")
          .select("permission_id")
          .eq("user_id", userId);

        if (userPermError) {
          console.warn("User permissions error:", userPermError.message);
        }

        const permissionIds = Array.from(
          new Set((userPermissionRows || []).map((row) => row.permission_id).filter(Boolean)),
        );
        const criticalPermissions = await criticalPermissionsPromise;

        if (permissionIds.length === 0) {
          if (!cancelled) setPermissions(criticalPermissions);
          return;
        }

        const { data: permissionRows, error: permissionError } = await supabase
          .from("permissions")
          .select("name")
          .in("id", permissionIds);

        if (permissionError) throw permissionError;

        if (!cancelled) {
          setPermissions(
            normalizePermissionList([
              ...(permissionRows || []).map((permission) => permission.name),
              ...criticalPermissions,
            ]),
          );
        }
      } catch (error) {
        console.error("Error fetching user permissions:", error);
        if (!cancelled) {
          setPermissions([]);
          setRole("visualizador");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const applySession = async (userId?: string) => {
      if (!userId) {
        setPermissions([]);
        setRole(null);
        setIsLoading(false);
        return;
      }

      const showLoading = isInitial;
      isInitial = false;
      let timeoutId: number | undefined;

      try {
        await Promise.race([
          fetchPermissionsAndRole(userId, showLoading),
          new Promise<void>((resolve) => {
            timeoutId = window.setTimeout(() => {
              if (!cancelled) {
                console.warn("Permission lookup timed out; releasing the interface.");
                setIsLoading(false);
              }
              resolve();
            }, PERMISSIONS_TIMEOUT_MS);
          }),
        ]);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    };

    const refreshPermissions = () => {
      getSessionWithTimeout().then((session) => applySession(session?.user?.id));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshPermissions();
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user?.id);
    });

    getSessionWithTimeout().then((session) => applySession(session?.user?.id));

    // Atualizações explícitas e retorno de foco são suficientes. Um polling por
    // instância deste hook multiplicava as consultas de permissão em toda a UI.
    window.addEventListener("focus", refreshPermissions);
    window.addEventListener("permissions-updated", refreshPermissions);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("focus", refreshPermissions);
      window.removeEventListener("permissions-updated", refreshPermissions);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const isAdmin = role === "admin";

  const hasPermission = useMemo(() => {
    const permissionSet = new Set(permissions);

    return (permission: string): boolean => {
      const normalizedPermission = normalizePermissionName(permission);

      if (isAdmin) return true;
      if (permissionSet.has(normalizedPermission)) return true;

      // Única herança funcional por papel: RH e Gestor de RH veem toda a área RH/Ponto.
      return roleHasPermission(role, normalizedPermission);
    };
  }, [isAdmin, permissions, role]);

  return {
    permissions,
    role,
    isAdmin,
    isLoading,
    hasPermission,
  };
}
