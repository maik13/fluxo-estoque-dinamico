// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { MainLayout } from "@/planejamento-v2-original/MainLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/planejamento-v2-original/supabaseClient";
import PlanejamentoV2WorkspaceComplete from "./PlanejamentoV2WorkspaceComplete";

const sb = supabase as any;

type ProbeFailure = {
  source: string;
  message: string;
  code?: string;
};

function errorText(error: any) {
  return String(error?.message || error?.details || error?.hint || "Erro desconhecido");
}

/**
 * Verifica a base única exigida pelo Planejamento 2.0.
 *
 * O módulo não troca mais silenciosamente para outra implementação quando
 * membros, alocações ou horários estão indisponíveis. Todos os projetos usam
 * o mesmo workspace e recebem as mesmas funções. Quando a estrutura do banco
 * está incompleta, a tela informa exatamente o requisito que precisa ser
 * corrigido antes de abrir o projeto.
 */
export default function PlanejamentoV2WorkspaceRecovery() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const probe = useQuery({
    queryKey: ["planejamento-v2", "recovery-probe", workspaceId],
    enabled: Boolean(workspaceId),
    retry: 1,
    queryFn: async () => {
      if (!workspaceId) throw new Error("Planejamento não informado");

      const checks = await Promise.all([
        sb
          .from("planejamento_v2_workspaces")
          .select("id, project_name_snapshot, status, owner_id")
          .eq("id", workspaceId)
          .maybeSingle(),
        sb
          .from("planejamento_v2_tasks")
          .select("id, workspace_id, title, position, start_date, start_time, end_date, end_time, budget")
          .eq("workspace_id", workspaceId)
          .order("position"),
        sb
          .from("planejamento_v2_dependencies")
          .select("id, workspace_id, predecessor_task_id, successor_task_id")
          .eq("workspace_id", workspaceId),
        sb
          .from("settings")
          .select("id, valor")
          .eq("tipo", "processo")
          .eq("ativo", true)
          .order("ordem"),
        sb
          .from("profiles")
          .select("id, full_name, email, avatar_url, ativo")
          .eq("ativo", true)
          .order("full_name"),
        sb
          .from("colaboradores_operacionais_v")
          .select("id, nome, cargo, ativo")
          .eq("ativo", true)
          .order("nome"),
        sb
          .from("planejamento_v2_project_members")
          .select("id, workspace_id, profile_id, colaborador_id, display_name, email, member_type, project_role, capacity_hours_per_day, active")
          .eq("workspace_id", workspaceId)
          .eq("active", true)
          .order("display_name"),
        sb
          .from("planejamento_v2_task_assignments")
          .select("id, workspace_id, task_id, member_id, allocated_minutes")
          .eq("workspace_id", workspaceId),
      ]);

      const names = [
        "projeto",
        "atividades com datas e horários",
        "dependências",
        "processos do App Controle",
        "usuários",
        "colaboradores da produção",
        "pessoas do projeto",
        "alocações de carga de trabalho",
      ];

      const failures: ProbeFailure[] = checks
        .map((result: any, index) => result.error ? ({
          source: names[index],
          message: errorText(result.error),
          code: result.error?.code,
        }) : null)
        .filter(Boolean) as ProbeFailure[];

      if (!checks[0].error && !checks[0].data) {
        failures.unshift({
          source: "projeto",
          message: "O projeto solicitado não existe ou o usuário não possui acesso.",
        });
      }

      return { failures };
    },
  });

  if (probe.isLoading) {
    return (
      <MainLayout title="Planejamento 2.0" subtitle="Verificando a base única do projeto...">
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const failures = probe.data?.failures || [];

  if (probe.error || failures.length) {
    const visibleFailures = probe.error
      ? [{ source: "carregamento", message: errorText(probe.error) }]
      : failures;

    return (
      <MainLayout title="Planejamento 2.0" subtitle="Estrutura obrigatória indisponível">
        <div className="mx-auto mt-8 max-w-4xl rounded-lg border border-destructive/40 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-destructive">
                O projeto não será aberto em uma versão incompleta
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Todos os projetos do Planejamento 2.0 utilizam a mesma base funcional. Corrija os requisitos abaixo e tente novamente.
              </p>
              <div className="mt-4 space-y-2">
                {visibleFailures.map((failure) => (
                  <div key={`${failure.source}:${failure.message}`} className="rounded border bg-background/70 p-3">
                    <div className="text-sm font-medium">{failure.source}</div>
                    <div className="mt-1 break-words text-xs text-muted-foreground">{failure.message}</div>
                  </div>
                ))}
              </div>
              <Button className="mt-4 gap-2" variant="outline" onClick={() => probe.refetch()} disabled={probe.isFetching}>
                {probe.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Verificar novamente
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return <PlanejamentoV2WorkspaceComplete />;
}
