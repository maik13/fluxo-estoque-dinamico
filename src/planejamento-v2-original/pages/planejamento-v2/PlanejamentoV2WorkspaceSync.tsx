// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/planejamento-v2-original/supabaseClient";

type Props = {
  children: ReactNode;
};

/**
 * Mantém todas as visualizações do Planejamento 2.0 alinhadas com a mesma fonte
 * de dados. A assinatura cobre alterações feitas em outra aba, por outro usuário
 * e atualizações em cascata produzidas pelos vínculos no banco.
 */
export default function PlanejamentoV2WorkspaceSync({ children }: Props) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshWorkspace = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["planejamento-v2-complete", workspaceId] }),
          queryClient.invalidateQueries({ queryKey: ["planejamento-v2", "workspace", workspaceId] }),
          queryClient.invalidateQueries({ queryKey: ["planejamento-v2", "dependency-settings", workspaceId] }),
          queryClient.invalidateQueries({ queryKey: ["planejamento-v2", "recovery-probe", workspaceId] }),
          queryClient.invalidateQueries({ queryKey: ["planejamento-v2", "projects"] }),
        ]);
      }, 120);
    };

    const channel = supabase
      .channel(`planejamento-v2-workspace-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planejamento_v2_workspaces",
          filter: `id=eq.${workspaceId}`,
        },
        refreshWorkspace,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planejamento_v2_tasks",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        refreshWorkspace,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planejamento_v2_dependencies",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        refreshWorkspace,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planejamento_v2_project_members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        refreshWorkspace,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "planejamento_v2_task_assignments",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        refreshWorkspace,
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, workspaceId]);

  return children;
}
