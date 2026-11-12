// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/planejamento-v2-original/supabaseClient";
import { useUserPermissions } from "@/planejamento-v2-original/hooks/useUserPermissions";
import { recalculatePlanejamentoV2Capacity } from "@/planejamento-v2-original/lib/planejamentoV2Capacity";

const sb = supabase as any;

const WEEK_DAYS = [
  { value: 0, short: "Dom", label: "Domingo" },
  { value: 1, short: "Seg", label: "Segunda-feira" },
  { value: 2, short: "Ter", label: "Terça-feira" },
  { value: 3, short: "Qua", label: "Quarta-feira" },
  { value: 4, short: "Qui", label: "Quinta-feira" },
  { value: 5, short: "Sex", label: "Sexta-feira" },
  { value: 6, short: "Sáb", label: "Sábado" },
];

type ProjectSettingsForm = {
  projectStartDate: string;
  projectEndDate: string;
  teamSize: string;
  projectLocation: string;
  workWeekDays: number[];
  workdayStartTime: string;
  workdayEndTime: string;
  breakStartTime: string;
  breakEndTime: string;
  automaticScheduling: boolean;
  automaticBudgetCalculation: boolean;
  durationStep: "hours" | "days";
  progressCalculation: "manual" | "duration" | "completed_tasks";
  workloadCalculation: "fixed_estimate" | "planned_hours" | "task_duration";
  resourceCalendarEnabled: boolean;
  maxConcurrentLabor: string;
};

const DEFAULT_FORM: ProjectSettingsForm = {
  projectStartDate: "",
  projectEndDate: "",
  teamSize: "",
  projectLocation: "",
  workWeekDays: [1, 2, 3, 4, 5],
  workdayStartTime: "09:00",
  workdayEndTime: "18:00",
  breakStartTime: "13:00",
  breakEndTime: "14:00",
  automaticScheduling: true,
  automaticBudgetCalculation: false,
  durationStep: "hours",
  progressCalculation: "duration",
  workloadCalculation: "fixed_estimate",
  resourceCalendarEnabled: true,
  maxConcurrentLabor: "1",
};

function normalizeTime(value: string | null | undefined, fallback: string) {
  return value ? value.slice(0, 5) : fallback;
}

export function PlanejamentoV2ProjectSettings() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { hasPermission, isAdmin } = useUserPermissions();
  const canEdit = isAdmin || hasPermission("planejamento_v2_edit") || hasPermission("planejamento_v2_admin");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectSettingsForm>(DEFAULT_FORM);
  const [groups, setGroups] = useState<{ id?: string; name: string; location: string; teamSize: string }[]>([]);

  useEffect(() => { if (workspaceId && searchParams.get("configuracoes") === "1") setOpen(true); }, [searchParams, workspaceId]);
  const changeOpen = (next: boolean) => { setOpen(next); if (!next && searchParams.has("configuracoes")) { const updated = new URLSearchParams(searchParams); updated.delete("configuracoes"); setSearchParams(updated, { replace: true }); } };

  const queryKey = useMemo(() => ["planejamento-v2", "project-settings", workspaceId], [workspaceId]);

  const settingsQuery = useQuery({
    queryKey,
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      if (!workspaceId) throw new Error("Projeto não informado");
      const [workspaceResult, capacityResult, groupsResult] = await Promise.all([
        sb
          .from("planejamento_v2_workspaces")
          .select("id, project_name_snapshot, description, start_date, target_end_date, work_week_days, workday_start_time, workday_end_time, break_start_time, break_end_time, automatic_scheduling, automatic_budget_calculation, duration_step, progress_calculation, workload_calculation, resource_calendar_enabled")
          .eq("id", workspaceId)
          .single(),
        sb
          .from("planejamento_v2_capacity_settings")
          .select("enabled, max_concurrent_labor")
          .eq("workspace_id", workspaceId)
          .maybeSingle(),
        sb.from("planejamento_v2_tasks").select("id, parent_task_id, title, description, position").eq("workspace_id", workspaceId).eq("task_type", "summary").order("position"),
      ]);
      if (workspaceResult.error) throw workspaceResult.error;
      if (capacityResult.error) throw capacityResult.error;
      if (groupsResult.error) throw groupsResult.error;
      return { workspace: workspaceResult.data, capacity: capacityResult.data, groups: groupsResult.data || [] };
    },
  });

  useEffect(() => {
    const result = settingsQuery.data;
    if (!result) return;
    const data = result.workspace;
    const description = String(data.description || "");
    setForm({
      projectStartDate: data.start_date || "",
      projectEndDate: data.target_end_date || "",
      teamSize: description.match(/Equipe prevista:\s*(\d+)/i)?.[1] || "",
      projectLocation: description.match(/Local principal:\s*([^·]+)/i)?.[1]?.trim() || "",
      workWeekDays: Array.isArray(data.work_week_days) && data.work_week_days.length ? data.work_week_days : DEFAULT_FORM.workWeekDays,
      workdayStartTime: normalizeTime(data.workday_start_time, DEFAULT_FORM.workdayStartTime),
      workdayEndTime: normalizeTime(data.workday_end_time, DEFAULT_FORM.workdayEndTime),
      breakStartTime: normalizeTime(data.break_start_time, DEFAULT_FORM.breakStartTime),
      breakEndTime: normalizeTime(data.break_end_time, DEFAULT_FORM.breakEndTime),
      automaticScheduling: data.automatic_scheduling ?? true,
      automaticBudgetCalculation: data.automatic_budget_calculation ?? false,
      durationStep: data.duration_step === "days" ? "days" : "hours",
      progressCalculation: ["manual", "duration", "completed_tasks"].includes(data.progress_calculation)
        ? data.progress_calculation
        : "duration",
      workloadCalculation: ["fixed_estimate", "planned_hours", "task_duration"].includes(data.workload_calculation)
        ? data.workload_calculation
        : "fixed_estimate",
      resourceCalendarEnabled: data.resource_calendar_enabled ?? true,
      maxConcurrentLabor: String(result.capacity?.max_concurrent_labor || DEFAULT_FORM.maxConcurrentLabor),
    });
    const projectName = String(data.project_name_snapshot || "").trim().toLocaleLowerCase("pt-BR");
    const isRoot = (item: any) => String(item.description || "").includes("[PROJECT_ROOT]") || (!item.parent_task_id && ["projeto", projectName].includes(String(item.title || "").trim().toLocaleLowerCase("pt-BR")));
    setGroups((result.groups || []).filter((item: any) => !isRoot(item)).map((item: any) => ({ id: item.id, name: item.title, location: String(item.description || "").match(/Local:\s*([^·]+)/i)?.[1]?.trim() || "", teamSize: String(item.description || "").match(/Equipe prevista:\s*(\d+)/i)?.[1] || "" })));
  }, [settingsQuery.data]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Projeto não informado");
      if (!form.projectStartDate || !form.projectEndDate) throw new Error("Informe o início e o término total do projeto");
      if (form.projectEndDate < form.projectStartDate) throw new Error("O término do projeto deve ser posterior ao início");
      if (!groups.length || groups.some((group) => !group.name.trim())) throw new Error("Cadastre ao menos um grupo/local com nome");
      if (!form.workWeekDays.length) throw new Error("Selecione ao menos um dia de trabalho");
      if (form.workdayEndTime <= form.workdayStartTime) throw new Error("O término da jornada deve ser posterior ao início");
      if (form.breakStartTime && form.breakEndTime) {
        if (form.breakEndTime <= form.breakStartTime) throw new Error("O término do intervalo deve ser posterior ao início");
        if (form.breakStartTime < form.workdayStartTime || form.breakEndTime > form.workdayEndTime) {
          throw new Error("O intervalo deve estar dentro da jornada de trabalho");
        }
      }
      const maxConcurrentLabor = Math.round(Number(form.maxConcurrentLabor));
      if (!Number.isFinite(maxConcurrentLabor) || maxConcurrentLabor < 1 || maxConcurrentLabor > 999) {
        throw new Error("Informe entre 1 e 999 pessoas disponíveis no projeto");
      }

      const { error } = await sb
        .from("planejamento_v2_workspaces")
        .update({
          start_date: form.projectStartDate,
          target_end_date: form.projectEndDate,
          description: [form.teamSize && `Equipe prevista: ${form.teamSize} pessoa(s)`, form.projectLocation.trim() && `Local principal: ${form.projectLocation.trim()}`].filter(Boolean).join(" · ") || null,
          work_week_days: [...form.workWeekDays].sort((a, b) => a - b),
          workday_start_time: form.workdayStartTime,
          workday_end_time: form.workdayEndTime,
          break_start_time: form.breakStartTime || null,
          break_end_time: form.breakEndTime || null,
          automatic_scheduling: form.automaticScheduling,
          default_auto_shift_dependencies: form.automaticScheduling,
          automatic_budget_calculation: form.automaticBudgetCalculation,
          duration_step: form.durationStep,
          progress_calculation: form.progressCalculation,
          workload_calculation: form.workloadCalculation,
          resource_calendar_enabled: form.resourceCalendarEnabled,
        })
        .eq("id", workspaceId);
      if (error) throw error;
      const rootResult = await sb.from("planejamento_v2_tasks").select("id").eq("workspace_id", workspaceId).eq("task_type", "summary").ilike("description", "%[PROJECT_ROOT]%").maybeSingle();
      if (rootResult.error) throw rootResult.error;
      const projectName = String(settingsQuery.data?.workspace?.project_name_snapshot || "").trim().toLocaleLowerCase("pt-BR");
      const inferredRoot = (settingsQuery.data?.groups || []).find((item: any) => !item.parent_task_id && ["projeto", projectName].includes(String(item.title || "").trim().toLocaleLowerCase("pt-BR")));
      let rootId = rootResult.data?.id || inferredRoot?.id;
      const rootPayload = { workspace_id: workspaceId, title: settingsQuery.data?.workspace?.project_name_snapshot || "Projeto", description: "[PROJECT_ROOT] Cronograma total do projeto", task_type: "summary", status: "not_started", priority: "normal", start_date: form.projectStartDate, end_date: form.projectEndDate, duration_days: Math.max(Math.round((new Date(`${form.projectEndDate}T00:00:00`).getTime() - new Date(`${form.projectStartDate}T00:00:00`).getTime()) / 86400000) + 1, 1), progress: 0, position: 100 };
      if (rootId) { const { error: rootError } = await sb.from("planejamento_v2_tasks").update(rootPayload).eq("id", rootId); if (rootError) throw rootError; } else { const { data: createdRoot, error: rootError } = await sb.from("planejamento_v2_tasks").insert(rootPayload).select("id").single(); if (rootError) throw rootError; rootId = createdRoot.id; }
      const existingIds = new Set((settingsQuery.data?.groups || []).filter((item: any) => item.id !== rootId && !String(item.description || "").includes("[PROJECT_ROOT]")).map((item: any) => item.id));
      for (let index = 0; index < groups.length; index += 1) { const group = groups[index]; const payload = { workspace_id: workspaceId, parent_task_id: rootId, title: group.name.trim(), description: `[PROJECT_PHASE] ${[group.location.trim() && `Local: ${group.location.trim()}`, group.teamSize && `Equipe prevista: ${group.teamSize} pessoa(s)`].filter(Boolean).join(" · ")}`, task_type: "summary", status: "not_started", priority: "normal", position: (index + 1) * 1000, progress: 0 }; if (group.id) { existingIds.delete(group.id); const { error: groupError } = await sb.from("planejamento_v2_tasks").update(payload).eq("id", group.id); if (groupError) throw groupError; } else { const { error: groupError } = await sb.from("planejamento_v2_tasks").insert(payload); if (groupError) throw groupError; } }
      if (existingIds.size) { const removedIds = Array.from(existingIds); const { error: moveChildrenError } = await sb.from("planejamento_v2_tasks").update({ parent_task_id: rootId }).in("parent_task_id", removedIds); if (moveChildrenError) throw moveChildrenError; const { error: deleteError } = await sb.from("planejamento_v2_tasks").delete().in("id", removedIds); if (deleteError) throw deleteError; }
      const { error: capacityError } = await sb
        .from("planejamento_v2_capacity_settings")
        .upsert({
          workspace_id: workspaceId,
          enabled: true,
          max_concurrent_labor: maxConcurrentLabor,
        }, { onConflict: "workspace_id" });
      if (capacityError) throw capacityError;

      return recalculatePlanejamentoV2Capacity(sb, workspaceId);
    },
    onSuccess: async (recalculation) => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["planejamento-v2"] });
      toast.success(
        recalculation.updatedTasks > 0
          ? `Configurações salvas e ${recalculation.updatedTasks} atividade(s) recalculada(s)`
          : "Configurações do projeto salvas",
      );
      changeOpen(false);
    },
    onError: (error: any) => toast.error(String(error?.message || "Não foi possível salvar as configurações")),
  });

  const toggleDay = (day: number) => {
    setForm((current) => ({
      ...current,
      workWeekDays: current.workWeekDays.includes(day)
        ? current.workWeekDays.filter((item) => item !== day)
        : [...current.workWeekDays, day],
    }));
  };

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-secondary"
          title="Configurações do projeto"
          aria-label="Abrir configurações do projeto"
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Configurações do projeto</SheetTitle>
          <SheetDescription>
            Defina calendário, agendamento, duração, progresso e cálculo de carga para este planejamento.
          </SheetDescription>
        </SheetHeader>

        {settingsQuery.isLoading && <div className="py-8 text-sm text-muted-foreground">Carregando configurações...</div>}
        {settingsQuery.error && (
          <div className="my-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {String((settingsQuery.error as any)?.message || "Estrutura de configurações indisponível")}
          </div>
        )}

        {!settingsQuery.isLoading && !settingsQuery.error && (
          <div className="space-y-7 py-6">
            <section className="space-y-4"><div><h3 className="font-semibold">Identificação e prazo total</h3><p className="mt-1 text-sm text-muted-foreground">Informações exclusivas do projeto atualmente aberto e linha total exibida no Gantt.</p></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Início total do projeto</Label><Input type="date" value={form.projectStartDate} disabled={!canEdit} onChange={(event) => setForm((current) => ({ ...current, projectStartDate: event.target.value }))} /></div><div className="space-y-1.5"><Label>Término total do projeto</Label><Input type="date" value={form.projectEndDate} disabled={!canEdit} onChange={(event) => setForm((current) => ({ ...current, projectEndDate: event.target.value }))} /></div><div className="space-y-1.5"><Label>Equipe prevista (pessoas)</Label><Input type="number" min="1" value={form.teamSize} disabled={!canEdit} onChange={(event) => setForm((current) => ({ ...current, teamSize: event.target.value }))} /></div><div className="space-y-1.5"><Label>Local principal</Label><Input value={form.projectLocation} disabled={!canEdit} onChange={(event) => setForm((current) => ({ ...current, projectLocation: event.target.value }))} placeholder="Obra, cidade ou unidade" /></div></div></section>
            <section className="space-y-3"><div><h3 className="font-semibold">Grupos e locais do cronograma</h3><p className="mt-1 text-sm text-muted-foreground">Cadastre Indústria, Fábrica, Montagem in loco ou quantos grupos forem necessários. Cada item vira uma linha-resumo separada no Gantt.</p></div>{groups.map((group, index) => <div key={group.id || index} className="space-y-2 rounded-lg border p-3"><Input value={group.name} disabled={!canEdit} onChange={(event) => setGroups((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="Nome do grupo/local" /><div className="grid grid-cols-[1fr_110px_36px] gap-2"><Input value={group.location} disabled={!canEdit} onChange={(event) => setGroups((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, location: event.target.value } : item))} placeholder="Local de execução" /><Input type="number" min="1" value={group.teamSize} disabled={!canEdit} onChange={(event) => setGroups((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, teamSize: event.target.value } : item))} placeholder="Pessoas" /><Button type="button" variant="ghost" size="icon" disabled={!canEdit} onClick={() => setGroups((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</Button></div></div>)}<Button type="button" variant="outline" disabled={!canEdit} onClick={() => setGroups((current) => [...current, { name: "", location: "", teamSize: "" }])}>Adicionar grupo/local</Button></section>
            <section className="space-y-4">
              <div>
                <h3 className="font-semibold">Semana de trabalho</h3>
                <p className="mt-1 text-sm text-muted-foreground">Selecione os dias considerados úteis neste projeto.</p>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {WEEK_DAYS.map((day) => {
                  const active = form.workWeekDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      title={day.label}
                      onClick={() => canEdit && toggleDay(day.value)}
                      disabled={!canEdit}
                      className={`rounded-md border px-1 py-2 text-xs transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary"}`}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Início da jornada</Label><Input type="time" value={form.workdayStartTime} disabled={!canEdit} onChange={(event) => setForm((current) => ({ ...current, workdayStartTime: event.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Término da jornada</Label><Input type="time" value={form.workdayEndTime} disabled={!canEdit} onChange={(event) => setForm((current) => ({ ...current, workdayEndTime: event.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Início do intervalo</Label><Input type="time" value={form.breakStartTime} disabled={!canEdit} onChange={(event) => setForm((current) => ({ ...current, breakStartTime: event.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Término do intervalo</Label><Input type="time" value={form.breakEndTime} disabled={!canEdit} onChange={(event) => setForm((current) => ({ ...current, breakEndTime: event.target.value }))} /></div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="space-y-1.5">
                <Label>Máximo de pessoas simultâneas disponíveis</Label>
                <Input
                  type="number"
                  min="1"
                  max="999"
                  step="1"
                  value={form.maxConcurrentLabor}
                  disabled={!canEdit}
                  onChange={(event) => setForm((current) => ({ ...current, maxConcurrentLabor: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Limite geral de mão de obra que o motor pode distribuir simultaneamente entre as atividades deste projeto.</p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div><Label>Agendamento automático</Label><p className="text-xs text-muted-foreground">Propaga alterações pelas dependências do projeto.</p></div>
                <Switch checked={form.automaticScheduling} disabled={!canEdit} onCheckedChange={(checked) => setForm((current) => ({ ...current, automaticScheduling: checked }))} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div><Label>Cálculo automático do orçamento</Label><p className="text-xs text-muted-foreground">Ativa o cálculo quando custos e recursos estiverem configurados.</p></div>
                <Switch checked={form.automaticBudgetCalculation} disabled={!canEdit} onCheckedChange={(checked) => setForm((current) => ({ ...current, automaticBudgetCalculation: checked }))} />
              </div>
            </section>

            <section className="space-y-4">
              <div className="space-y-1.5"><Label>Passo de duração</Label><Select value={form.durationStep} disabled={!canEdit} onValueChange={(value) => setForm((current) => ({ ...current, durationStep: value as ProjectSettingsForm["durationStep"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hours">Horas</SelectItem><SelectItem value="days">Dias</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Progresso</Label><Select value={form.progressCalculation} disabled={!canEdit} onValueChange={(value) => setForm((current) => ({ ...current, progressCalculation: value as ProjectSettingsForm["progressCalculation"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="duration">Duração</SelectItem><SelectItem value="completed_tasks">Atividades concluídas</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Cálculos de carga de trabalho</Label><Select value={form.workloadCalculation} disabled={!canEdit} onValueChange={(value) => setForm((current) => ({ ...current, workloadCalculation: value as ProjectSettingsForm["workloadCalculation"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed_estimate">Estimativa fixa</SelectItem><SelectItem value="planned_hours">Horas planejadas</SelectItem><SelectItem value="task_duration">Duração da atividade</SelectItem></SelectContent></Select></div>
              <div className="flex items-center justify-between gap-4">
                <div><Label>Calendário de recursos</Label><p className="text-xs text-muted-foreground">Considera a capacidade diária das pessoas.</p></div>
                <Switch checked={form.resourceCalendarEnabled} disabled={!canEdit} onCheckedChange={(checked) => setForm((current) => ({ ...current, resourceCalendarEnabled: checked }))} />
              </div>
            </section>
          </div>
        )}

        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => saveSettings.mutate()} disabled={!canEdit || saveSettings.isPending || Boolean(settingsQuery.error)}>
            {saveSettings.isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
