// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Loader2, Plus, Trash2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useUserPermissions } from "@/planejamento-v2-original/hooks/useUserPermissions";
import { supabase } from "@/planejamento-v2-original/supabaseClient";
import {
  comparePlannedAndActual,
  formatPlanejamentoV2Minutes,
  resolveTimeEntryMinutes,
} from "@/planejamento-v2-original/lib/planejamentoV2Time";

const sb = supabase as any;

type TaskRow = {
  id: string;
  title: string;
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  status: string;
};

type MemberRow = {
  id: string;
  display_name: string;
  profile_id?: string | null;
  active: boolean;
};

type AssignmentRow = {
  id: string;
  task_id: string;
  member_id: string;
  allocated_minutes: number;
};

type TimeEntryRow = {
  id: string;
  task_id: string;
  member_id?: string | null;
  minutes: number;
  work_date: string;
  start_time?: string | null;
  end_time?: string | null;
  note?: string | null;
  created_at: string;
};

type EntryMode = "interval" | "duration";

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function timeText(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

export function PlanejamentoV2TimeTrackingSheet() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();
  const { hasPermission, isAdmin } = useUserPermissions();
  const canEdit = isAdmin || hasPermission("planejamento_v2_edit") || hasPermission("planejamento_v2_admin");

  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [workDate, setWorkDate] = useState(todayIso());
  const [mode, setMode] = useState<EntryMode>("interval");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:45");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");

  const queryKey = useMemo(
    () => ["planejamento-v2", "time-tracking", workspaceId],
    [workspaceId],
  );

  const dataQuery = useQuery({
    queryKey,
    enabled: Boolean(workspaceId && open),
    queryFn: async () => {
      if (!workspaceId) throw new Error("Projeto não informado");
      const results = await Promise.all([
        sb
          .from("planejamento_v2_tasks")
          .select("id, title, start_date, start_time, end_date, end_time, status")
          .eq("workspace_id", workspaceId)
          .order("position"),
        sb
          .from("planejamento_v2_project_members")
          .select("id, display_name, profile_id, active")
          .eq("workspace_id", workspaceId)
          .eq("active", true)
          .order("display_name"),
        sb
          .from("planejamento_v2_task_assignments")
          .select("id, task_id, member_id, allocated_minutes")
          .eq("workspace_id", workspaceId),
        sb
          .from("planejamento_v2_time_entries")
          .select("id, task_id, member_id, minutes, work_date, start_time, end_time, note, created_at")
          .eq("workspace_id", workspaceId)
          .order("work_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);

      const failed = results.slice(0, 4).find((result: any) => result.error);
      if ((failed as any)?.error) throw (failed as any).error;
      if (results[4].error) throw results[4].error;

      return {
        tasks: (results[0].data || []) as TaskRow[],
        members: (results[1].data || []) as MemberRow[],
        assignments: (results[2].data || []) as AssignmentRow[],
        entries: (results[3].data || []) as TimeEntryRow[],
        currentUserId: results[4].data.user?.id || null,
      };
    },
  });

  const data = dataQuery.data;
  const taskById = useMemo(
    () => new Map((data?.tasks || []).map((task) => [task.id, task])),
    [data?.tasks],
  );
  const memberById = useMemo(
    () => new Map((data?.members || []).map((member) => [member.id, member])),
    [data?.members],
  );
  const plannedByTask = useMemo(() => {
    const map = new Map<string, number>();
    (data?.assignments || []).forEach((assignment) => {
      map.set(assignment.task_id, (map.get(assignment.task_id) || 0) + Number(assignment.allocated_minutes || 0));
    });
    return map;
  }, [data?.assignments]);
  const actualByTask = useMemo(() => {
    const map = new Map<string, number>();
    (data?.entries || []).forEach((entry) => {
      map.set(entry.task_id, (map.get(entry.task_id) || 0) + Number(entry.minutes || 0));
    });
    return map;
  }, [data?.entries]);

  const plannedTotal = useMemo(
    () => (data?.assignments || []).reduce((sum, item) => sum + Number(item.allocated_minutes || 0), 0),
    [data?.assignments],
  );
  const actualTotal = useMemo(
    () => (data?.entries || []).reduce((sum, item) => sum + Number(item.minutes || 0), 0),
    [data?.entries],
  );
  const totalComparison = comparePlannedAndActual(plannedTotal, actualTotal);

  useEffect(() => {
    if (!data || taskId) return;
    const firstTask = data.tasks.find((task) => task.status !== "cancelled") || data.tasks[0];
    if (firstTask) setTaskId(firstTask.id);
  }, [data, taskId]);

  useEffect(() => {
    if (!data || memberId) return;
    const currentMember = data.members.find((member) => member.profile_id === data.currentUserId);
    setMemberId(currentMember?.id || data.members[0]?.id || "");
  }, [data, memberId]);

  useEffect(() => {
    if (!data || !taskId) return;
    const assignment = data.assignments.find((item) => item.task_id === taskId);
    if (assignment) setMemberId(assignment.member_id);
  }, [data, taskId]);

  const registerEntry = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !taskId || !memberId) {
        throw new Error("Selecione a atividade e a pessoa responsável");
      }
      const resolvedMinutes = resolveTimeEntryMinutes(
        mode === "interval"
          ? { startTime, endTime }
          : { hours, minutes },
      );
      const { error } = await sb.rpc("register_planejamento_v2_time_entry", {
        _workspace_id: workspaceId,
        _task_id: taskId,
        _member_id: memberId,
        _work_date: workDate,
        _start_time: mode === "interval" ? startTime : null,
        _end_time: mode === "interval" ? endTime : null,
        _minutes: resolvedMinutes,
        _note: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["planejamento-v2-complete", workspaceId] });
      toast.success("Tempo realizado registrado");
      setHours("");
      setMinutes("");
      setNote("");
    },
    onError: (error: any) => {
      toast.error(String(error?.message || "Não foi possível registrar o tempo"));
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await sb
        .from("planejamento_v2_time_entries")
        .delete()
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Registro removido");
    },
    onError: (error: any) => toast.error(String(error?.message || "Não foi possível remover o registro")),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-secondary"
          title="Registro de tempo do projeto"
          aria-label="Abrir registro de tempo do projeto"
        >
          <Clock3 className="h-5 w-5 text-muted-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Tempo planejado × realizado</SheetTitle>
          <SheetDescription>
            Registre o trabalho efetivo por atividade sem alterar a carga planejada.
          </SheetDescription>
        </SheetHeader>

        {dataQuery.isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando registros...
          </div>
        )}

        {dataQuery.error && (
          <div className="my-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="font-semibold">Estrutura de registro de tempo indisponível</div>
            <div className="mt-1 break-words">
              {String((dataQuery.error as any)?.message || "Aplique a migration obrigatória desta etapa.")}
            </div>
          </div>
        )}

        {data && !dataQuery.error && (
          <div className="space-y-6 py-6">
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Planejado</div>
                <div className="mt-1 text-2xl font-semibold">{formatPlanejamentoV2Minutes(totalComparison.planned)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Realizado</div>
                <div className="mt-1 text-2xl font-semibold">{formatPlanejamentoV2Minutes(totalComparison.actual)}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Diferença</div>
                <div className={`mt-1 text-2xl font-semibold ${totalComparison.variance > 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {totalComparison.variance > 0 ? "+" : ""}{formatPlanejamentoV2Minutes(Math.abs(totalComparison.variance))}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{totalComparison.percent}% do planejado</div>
              </div>
            </section>

            {canEdit && (
              <section className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Plus className="h-4 w-4" />
                  Registrar tempo realizado
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Atividade</Label>
                    <Select value={taskId} onValueChange={setTaskId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {data.tasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pessoa</Label>
                    <Select value={memberId} onValueChange={setMemberId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {data.members.map((member) => <SelectItem key={member.id} value={member.id}>{member.display_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data do trabalho</Label>
                    <Input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Forma de lançamento</Label>
                    <Select value={mode} onValueChange={(value) => setMode(value as EntryMode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interval">Horário inicial e final</SelectItem>
                        <SelectItem value="duration">Quantidade de horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {mode === "interval" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label>Início</Label><Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Término</Label><Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label>Horas</Label><Input type="number" min="0" step="1" value={hours} onChange={(event) => setHours(event.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Minutos</Label><Input type="number" min="0" max="59" step="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Observação</Label>
                  <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="O que foi realizado?" />
                </div>
                <Button onClick={() => registerEntry.mutate()} disabled={registerEntry.isPending || !taskId || !memberId}>
                  {registerEntry.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Registrar tempo
                </Button>
              </section>
            )}

            <section className="space-y-3">
              <h3 className="font-semibold">Por atividade</h3>
              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-[1fr_90px_90px_90px] bg-muted/30 px-3 py-2 text-xs font-medium">
                  <div>Atividade</div><div className="text-right">Planejado</div><div className="text-right">Realizado</div><div className="text-right">Diferença</div>
                </div>
                {data.tasks.map((task) => {
                  const comparison = comparePlannedAndActual(plannedByTask.get(task.id) || 0, actualByTask.get(task.id) || 0);
                  return (
                    <button key={task.id} type="button" onClick={() => setTaskId(task.id)} className="grid w-full grid-cols-[1fr_90px_90px_90px] border-t px-3 py-2 text-left text-sm hover:bg-muted/20">
                      <div className="truncate pr-3">{task.title}</div>
                      <div className="text-right">{formatPlanejamentoV2Minutes(comparison.planned)}</div>
                      <div className="text-right">{formatPlanejamentoV2Minutes(comparison.actual)}</div>
                      <div className={`text-right ${comparison.variance > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {comparison.variance > 0 ? "+" : comparison.variance < 0 ? "−" : ""}{formatPlanejamentoV2Minutes(Math.abs(comparison.variance))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">Registros recentes</h3>
              <div className="space-y-2">
                {data.entries.slice(0, 30).map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{taskById.get(entry.task_id)?.title || "Atividade removida"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {memberById.get(entry.member_id || "")?.display_name || "Pessoa não identificada"} · {formatDate(entry.work_date)} · {formatPlanejamentoV2Minutes(entry.minutes)}
                        {entry.start_time && entry.end_time ? ` · ${timeText(entry.start_time)}–${timeText(entry.end_time)}` : ""}
                      </div>
                      {entry.note && <div className="mt-1 text-xs text-muted-foreground">{entry.note}</div>}
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir registro"
                        onClick={() => window.confirm("Excluir este registro de tempo?") && deleteEntry.mutate(entry.id)}
                        disabled={deleteEntry.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {!data.entries.length && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhum tempo realizado foi registrado neste projeto.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
