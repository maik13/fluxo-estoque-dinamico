// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/planejamento-v2-original/supabaseClient";
import { toast } from "sonner";
import { useRealtimeInvalidation } from "@/planejamento-v2-original/hooks/useRealtimeInvalidation";
import type {
  AppControlProcess,
  AppControlProject,
  CreatePlanejamentoV2TaskInput,
  PlanejamentoV2Dependency,
  PlanejamentoV2Task,
  PlanejamentoV2Workspace,
  UpdatePlanejamentoV2TaskDatesInput,
} from "@/planejamento-v2-original/types/planejamento-v2";

const sb = supabase as any;
const PROJECTS_QUERY_KEY = ["planejamento-v2", "projects"] as const;

function workspaceQueryKey(workspaceId?: string) {
  return ["planejamento-v2", "workspace", workspaceId] as const;
}

function errorMessage(error: any, fallback: string) {
  return String(error?.message || error?.details || error?.hint || fallback);
}

function mapProject(row: any): AppControlProject {
  return {
    id: String(row.id),
    name: String(row.valor || "Projeto sem nome"),
    active: row.ativo !== false,
    order: Number(row.ordem || 0),
  };
}

function mapProcess(row: any): AppControlProcess {
  return {
    id: String(row.id),
    name: String(row.valor || "Processo sem nome"),
    active: row.ativo !== false,
    order: Number(row.ordem || 0),
  };
}

function mapWorkspace(row: any): PlanejamentoV2Workspace {
  return {
    id: String(row.id),
    appProjectSettingId: String(row.app_project_setting_id),
    projectNameSnapshot: String(row.project_name_snapshot || "Projeto"),
    status: row.status,
    description: row.description,
    startDate: row.start_date,
    targetEndDate: row.target_end_date,
    ownerId: row.owner_id,
    archivedAt: row.archived_at,
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTask(row: any): PlanejamentoV2Task {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    parentTaskId: row.parent_task_id,
    sourceProcessSettingId: row.source_process_setting_id,
    sourceProcessNameSnapshot: row.source_process_name_snapshot,
    title: String(row.title),
    description: row.description,
    taskType: row.task_type,
    status: row.status,
    priority: row.priority,
    position: Number(row.position || 0),
    startDate: row.start_date,
    endDate: row.end_date,
    durationDays: row.duration_days == null ? null : Number(row.duration_days),
    progress: Number(row.progress || 0),
    quantity: row.quantity == null ? null : Number(row.quantity),
    unit: row.unit,
    responsibleId: row.responsible_id,
    manualStartLocked: Boolean(row.manual_start_locked),
    manualEndLocked: Boolean(row.manual_end_locked),
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDependency(row: any): PlanejamentoV2Dependency {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    predecessorTaskId: String(row.predecessor_task_id),
    successorTaskId: String(row.successor_task_id),
    dependencyType: row.dependency_type,
    lagValue: Number(row.lag_value || 0),
    lagUnit: row.lag_unit,
    createdAt: row.created_at,
  };
}

export function usePlanejamentoV2Projects() {
  useRealtimeInvalidation(["planejamento-v2"]);
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: async () => {
      const [projectsResult, workspacesResult] = await Promise.all([
        sb
          .from("settings")
          .select("id, valor, ordem, ativo")
          .eq("tipo", "projeto")
          .eq("ativo", true)
          .order("ordem", { ascending: true })
          .order("valor", { ascending: true }),
        sb
          .from("planejamento_v2_workspaces")
          .select("*")
          .is("archived_at", null)
          .order("updated_at", { ascending: false }),
      ]);

      if (projectsResult.error) throw projectsResult.error;
      if (workspacesResult.error) throw workspacesResult.error;

      return {
        projects: (projectsResult.data || []).map(mapProject),
        workspaces: (workspacesResult.data || []).map(mapWorkspace),
      };
    },
  });
}

export function useCreatePlanejamentoV2Workspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (project: AppControlProject) => {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const userId = userResult.user?.id || null;
      const { data, error } = await sb
        .from("planejamento_v2_workspaces")
        .insert({
          app_project_setting_id: project.id,
          project_name_snapshot: project.name,
          owner_id: userId,
          created_by: userId,
          updated_by: userId,
          status: "draft",
        })
        .select("*")
        .single();

      if (error) throw error;
      return mapWorkspace(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
      toast.success("Planejamento 2.0 criado");
    },
    onError: (error: any) => {
      const message = errorMessage(error, "Não foi possível criar o Planejamento 2.0");
      if (message.includes("planejamento_v2_one_active_workspace_per_project")) {
        toast.error("Este projeto já possui um Planejamento 2.0 ativo");
        return;
      }
      toast.error(message);
      console.error("Erro ao criar Planejamento 2.0:", error);
    },
  });
}

export function useCreateAppControlProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const normalizedName = name.trim();
      if (!normalizedName) throw new Error("Informe o nome do projeto");
      const { data: existing, error: lookupError } = await sb.from("settings").select("id, valor, ordem, ativo").eq("tipo", "projeto").ilike("valor", normalizedName).limit(1);
      if (lookupError) throw lookupError;
      if (existing?.length) return mapProject(existing[0]);
      const { data: last } = await sb.from("settings").select("ordem").eq("tipo", "projeto").order("ordem", { ascending: false }).limit(1);
      const { data, error } = await sb.from("settings").insert({ tipo: "projeto", valor: normalizedName, ordem: Number(last?.[0]?.ordem || 0) + 1, ativo: true }).select("id, valor, ordem, ativo").single();
      if (error) throw error;
      return mapProject(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }),
    onError: (error: any) => toast.error(errorMessage(error, "Não foi possível cadastrar o projeto")),
  });
}

export function usePlanejamentoV2Workspace(workspaceId?: string) {
  return useQuery({
    queryKey: workspaceQueryKey(workspaceId),
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const { data: workspaceRow, error: workspaceError } = await sb
        .from("planejamento_v2_workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single();

      if (workspaceError) throw workspaceError;
      const workspace = mapWorkspace(workspaceRow);

      const [projectResult, tasksResult, processesResult, dependenciesResult] = await Promise.all([
        sb
          .from("settings")
          .select("id, valor, ordem, ativo")
          .eq("id", workspace.appProjectSettingId)
          .single(),
        sb
          .from("planejamento_v2_tasks")
          .select("*")
          .eq("workspace_id", workspace.id)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
        sb
          .from("settings")
          .select("id, valor, ordem, ativo")
          .eq("tipo", "processo")
          .eq("ativo", true)
          .order("ordem", { ascending: true })
          .order("valor", { ascending: true }),
        sb
          .from("planejamento_v2_dependencies")
          .select("*")
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: true }),
      ]);

      if (projectResult.error) throw projectResult.error;
      if (tasksResult.error) throw tasksResult.error;
      if (processesResult.error) throw processesResult.error;
      if (dependenciesResult.error) throw dependenciesResult.error;

      return {
        workspace,
        project: mapProject(projectResult.data),
        tasks: (tasksResult.data || []).map(mapTask),
        processes: (processesResult.data || []).map(mapProcess),
        dependencies: (dependenciesResult.data || []).map(mapDependency),
      };
    },
  });
}

export function useCreatePlanejamentoV2Task(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePlanejamentoV2TaskInput) => {
      if (!workspaceId) throw new Error("Workspace não informado");

      const [{ data: userResult, error: userError }, positionResult] = await Promise.all([
        supabase.auth.getUser(),
        sb
          .from("planejamento_v2_tasks")
          .select("position")
          .eq("workspace_id", workspaceId)
          .order("position", { ascending: false })
          .limit(1),
      ]);

      if (userError) throw userError;
      if (positionResult.error) throw positionResult.error;

      const lastPosition = Number(positionResult.data?.[0]?.position || 0);
      const userId = userResult.user?.id || null;
      const isMilestone = input.taskType === "milestone";

      const { data, error } = await sb
        .from("planejamento_v2_tasks")
        .insert({
          workspace_id: workspaceId,
          source_process_setting_id: input.sourceProcessSettingId || null,
          source_process_name_snapshot: input.sourceProcessNameSnapshot?.trim() || null,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          task_type: input.taskType,
          start_date: input.startDate || null,
          end_date: isMilestone ? input.startDate || null : input.endDate || null,
          duration_days: isMilestone
            ? 0
            : input.startDate && input.endDate
              ? Math.max(
                  Math.round(
                    (new Date(`${input.endDate}T00:00:00`).getTime()
                      - new Date(`${input.startDate}T00:00:00`).getTime())
                      / 86_400_000,
                  ) + 1,
                  1,
                )
              : null,
          quantity: input.quantity ?? null,
          unit: input.unit?.trim() || null,
          position: lastPosition + 1000,
          created_by: userId,
          updated_by: userId,
        })
        .select("*")
        .single();

      if (error) throw error;
      return mapTask(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKey(workspaceId) });
      toast.success("Atividade adicionada");
    },
    onError: (error: any) => {
      const message = errorMessage(error, "Não foi possível adicionar a atividade");
      toast.error(message);
      console.error("Erro ao criar atividade do Planejamento 2.0:", error);
    },
  });
}

export function useCreatePlanejamentoV2Dependency(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ predecessorTaskId, successorTaskId }: {
      predecessorTaskId: string;
      successorTaskId: string;
    }) => {
      if (!workspaceId) throw new Error("Workspace não informado");

      const { data, error } = await sb.rpc("create_planejamento_v2_fs_dependency", {
        _workspace_id: workspaceId,
        _predecessor_task_id: predecessorTaskId,
        _successor_task_id: successorTaskId,
      });

      if (error) throw error;
      return String(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKey(workspaceId) });
      toast.success("Atividades vinculadas");
    },
    onError: (error: any) => {
      const message = errorMessage(error, "Não foi possível criar o vínculo");
      toast.error(message);
      console.error("Erro ao criar dependência do Planejamento 2.0:", error);
    },
  });
}

export function useDeletePlanejamentoV2Dependency(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dependencyId: string) => {
      const { error } = await sb
        .from("planejamento_v2_dependencies")
        .delete()
        .eq("id", dependencyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKey(workspaceId) });
      toast.success("Vínculo removido");
    },
    onError: (error: any) => {
      const message = errorMessage(error, "Não foi possível remover o vínculo");
      toast.error(message);
      console.error("Erro ao remover dependência do Planejamento 2.0:", error);
    },
  });
}

export function useUpdatePlanejamentoV2TaskDates(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePlanejamentoV2TaskDatesInput) => {
      const { error } = await sb.rpc("update_planejamento_v2_task_dates", {
        _task_id: input.taskId,
        _start_date: input.startDate,
        _end_date: input.endDate,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceQueryKey(workspaceId) });
      toast.success("Cronograma atualizado");
    },
    onError: (error: any) => {
      const message = errorMessage(error, "Não foi possível atualizar as datas");
      toast.error(message);
      console.error("Erro ao atualizar datas do Planejamento 2.0:", error);
    },
  });
}
