// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
export type CapacityCalendar = {
  workWeekDays: number[];
  workdayStartTime: string;
  workdayEndTime: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
};

export type CapacityProcess = {
  processId: string;
  unit?: string | null;
  crewSize: number;
  outputPerShift: number;
  referenceHours: number;
  maxParallelTeams: number;
};

export type CapacityTask = {
  id: string;
  processId: string;
  title: string;
  quantity: number;
  unit?: string | null;
  position: number;
  notBeforeDate?: string | null;
  notBeforeTime?: string | null;
};

export type CapacityDependency = {
  predecessorTaskId: string;
  successorTaskId: string;
};

export type ExternalTaskWindow = {
  id: string;
  endDate?: string | null;
  endTime?: string | null;
};

export type CapacityScheduleInput = {
  tasks: CapacityTask[];
  processes: CapacityProcess[];
  dependencies: CapacityDependency[];
  externalTasks?: ExternalTaskWindow[];
  calendar: CapacityCalendar;
  maxConcurrentLabor: number;
  slotMinutes?: number;
  horizonDays?: number;
  today?: string;
};

export type ScheduledCapacityTask = {
  taskId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  requiredMinutes: number;
  crewSize: number;
};

export type CapacityScheduleIssue = {
  taskId: string;
  code:
    | "MISSING_PROCESS_CAPACITY"
    | "INVALID_QUANTITY"
    | "UNIT_MISMATCH"
    | "LABOR_LIMIT"
    | "DEPENDENCY_WITHOUT_END"
    | "DEPENDENCY_CYCLE"
    | "HORIZON_EXCEEDED";
  message: string;
};

export type CapacityScheduleResult = {
  scheduled: ScheduledCapacityTask[];
  issues: CapacityScheduleIssue[];
};

const DAY_MS = 86_400_000;

function parseTimeMinutes(value?: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function dateAtMinutes(date: Date, minutes: number) {
  const result = new Date(date);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

function startOfDay(value: Date) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(value: Date, amount: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function parseLocalDateTime(date?: string | null, time?: string | null) {
  if (!date) return null;
  const normalizedTime = time?.slice(0, 5) || "00:00";
  const result = new Date(`${date}T${normalizedTime}:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}

function formatDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatTime(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function normalizeUnit(value?: string | null) {
  return String(value || "").trim().toLocaleLowerCase("pt-BR");
}

function workingSegmentsForDay(date: Date, calendar: CapacityCalendar) {
  const weekdays = calendar.workWeekDays?.length ? calendar.workWeekDays : [1, 2, 3, 4, 5];
  if (!weekdays.includes(date.getDay())) return [] as Array<{ start: Date; end: Date }>;

  const startMinutes = parseTimeMinutes(calendar.workdayStartTime) ?? 8 * 60;
  const endMinutes = parseTimeMinutes(calendar.workdayEndTime) ?? 17 * 60;
  if (endMinutes <= startMinutes) return [] as Array<{ start: Date; end: Date }>;

  const breakStart = parseTimeMinutes(calendar.breakStartTime);
  const breakEnd = parseTimeMinutes(calendar.breakEndTime);
  if (
    breakStart !== null &&
    breakEnd !== null &&
    breakStart > startMinutes &&
    breakEnd > breakStart &&
    breakEnd < endMinutes
  ) {
    return [
      { start: dateAtMinutes(date, startMinutes), end: dateAtMinutes(date, breakStart) },
      { start: dateAtMinutes(date, breakEnd), end: dateAtMinutes(date, endMinutes) },
    ];
  }

  return [{ start: dateAtMinutes(date, startMinutes), end: dateAtMinutes(date, endMinutes) }];
}

function slotStarts(calendar: CapacityCalendar, from: Date, horizonDays: number, slotMinutes: number) {
  const result: Date[] = [];
  const firstDay = startOfDay(from);
  for (let dayIndex = 0; dayIndex <= horizonDays; dayIndex += 1) {
    const day = addDays(firstDay, dayIndex);
    for (const segment of workingSegmentsForDay(day, calendar)) {
      for (let cursor = new Date(segment.start); cursor.getTime() + slotMinutes * 60_000 <= segment.end.getTime(); cursor = new Date(cursor.getTime() + slotMinutes * 60_000)) {
        if (cursor.getTime() >= from.getTime()) result.push(cursor);
      }
    }
  }
  return result;
}

function priorityTasks(tasks: CapacityTask[]) {
  return [...tasks].sort((a, b) => Number(a.position || 0) - Number(b.position || 0) || a.title.localeCompare(b.title, "pt-BR"));
}

export function calculateRequiredCapacityMinutes(task: CapacityTask, process: CapacityProcess) {
  const quantity = Number(task.quantity || 0);
  const output = Number(process.outputPerShift || 0);
  const hours = Number(process.referenceHours || 0);
  if (quantity <= 0 || output <= 0 || hours <= 0) return 0;
  return Math.ceil((quantity / output) * hours * 60);
}

export function schedulePlanejamentoV2Capacity(input: CapacityScheduleInput): CapacityScheduleResult {
  const slotMinutes = Math.max(Math.round(input.slotMinutes || 15), 1);
  const horizonDays = Math.max(Math.round(input.horizonDays || 730), 1);
  const maxLabor = Math.max(Math.round(Number(input.maxConcurrentLabor || 0)), 0);
  const rankedTasks = priorityTasks(input.tasks);
  const rankById = new Map(rankedTasks.map((task, index) => [task.id, index]));
  const processById = new Map(input.processes.map((item) => [item.processId, item]));
  const taskById = new Map(input.tasks.map((item) => [item.id, item]));
  const externalById = new Map((input.externalTasks || []).map((item) => [item.id, item]));
  const predecessors = new Map<string, string[]>();
  input.dependencies.forEach((dependency) => {
    predecessors.set(dependency.successorTaskId, [...(predecessors.get(dependency.successorTaskId) || []), dependency.predecessorTaskId]);
  });

  type RuntimeTask = {
    task: CapacityTask;
    process: CapacityProcess;
    crewSize: number;
    maxParallelTeams: number;
    requiredMinutes: number;
    requiredSlots: number;
    remainingSlots: number;
    earliest: Date;
    allocations: Date[];
    completedAt: Date | null;
    lastAllocatedSlotIndex: number | null;
    blocked: boolean;
    rank: number;
  };

  const issues: CapacityScheduleIssue[] = [];
  const runtimeById = new Map<string, RuntimeTask>();
  const fallbackToday = input.today || formatDate(new Date());
  const fallbackStart = parseLocalDateTime(fallbackToday, input.calendar.workdayStartTime) || new Date();

  const pushIssue = (issue: CapacityScheduleIssue) => {
    if (!issues.some((current) => current.taskId === issue.taskId && current.code === issue.code)) issues.push(issue);
  };

  for (const task of rankedTasks) {
    const process = processById.get(task.processId);
    if (!process) {
      pushIssue({ taskId: task.id, code: "MISSING_PROCESS_CAPACITY", message: "O processo da atividade ainda não possui capacidade produtiva configurada." });
      continue;
    }
    if (Number(task.quantity || 0) <= 0) {
      pushIssue({ taskId: task.id, code: "INVALID_QUANTITY", message: "Informe uma quantidade maior que zero para dimensionar esta atividade." });
      continue;
    }

    const taskUnit = normalizeUnit(task.unit);
    const processUnit = normalizeUnit(process.unit);
    if (taskUnit && processUnit && taskUnit !== processUnit) {
      pushIssue({ taskId: task.id, code: "UNIT_MISMATCH", message: `A unidade da atividade (${task.unit}) difere da capacidade configurada (${process.unit}).` });
      continue;
    }

    const crewSize = Math.max(Math.round(Number(process.crewSize || 0)), 1);
    if (maxLabor <= 0 || crewSize > maxLabor) {
      pushIssue({ taskId: task.id, code: "LABOR_LIMIT", message: `A atividade exige ${crewSize} pessoa(s), acima do limite simultâneo de ${maxLabor}.` });
      continue;
    }

    const requiredMinutes = calculateRequiredCapacityMinutes(task, process);
    if (requiredMinutes <= 0) {
      pushIssue({ taskId: task.id, code: "INVALID_QUANTITY", message: "Não foi possível calcular o tempo produtivo desta atividade." });
      continue;
    }

    runtimeById.set(task.id, {
      task,
      process,
      crewSize,
      maxParallelTeams: Math.max(Math.round(Number(process.maxParallelTeams || 0)), 1),
      requiredMinutes,
      requiredSlots: Math.ceil(requiredMinutes / slotMinutes),
      remainingSlots: Math.ceil(requiredMinutes / slotMinutes),
      earliest: parseLocalDateTime(task.notBeforeDate, task.notBeforeTime) || new Date(fallbackStart),
      allocations: [],
      completedAt: null,
      lastAllocatedSlotIndex: null,
      blocked: false,
      rank: rankById.get(task.id) || 0,
    });
  }

  const cycleNodes = new Set<string>();
  const visitState = new Map<string, 0 | 1 | 2>();
  const visitStack: string[] = [];
  const detectCycle = (taskId: string) => {
    const state = visitState.get(taskId) || 0;
    if (state === 2) return;
    if (state === 1) {
      const cycleStart = visitStack.lastIndexOf(taskId);
      (cycleStart >= 0 ? visitStack.slice(cycleStart) : [taskId]).forEach((id) => cycleNodes.add(id));
      return;
    }
    visitState.set(taskId, 1);
    visitStack.push(taskId);
    for (const predecessorId of predecessors.get(taskId) || []) {
      if (taskById.has(predecessorId)) detectCycle(predecessorId);
    }
    visitStack.pop();
    visitState.set(taskId, 2);
  };
  rankedTasks.forEach((task) => detectCycle(task.id));
  cycleNodes.forEach((taskId) => {
    const runtime = runtimeById.get(taskId);
    if (runtime) runtime.blocked = true;
    pushIssue({ taskId, code: "DEPENDENCY_CYCLE", message: "Há um ciclo de dependências envolvendo esta atividade." });
  });

  for (const runtime of runtimeById.values()) {
    for (const predecessorId of predecessors.get(runtime.task.id) || []) {
      if (taskById.has(predecessorId)) continue;
      const external = externalById.get(predecessorId);
      const end = external ? parseLocalDateTime(external.endDate, external.endTime) : null;
      if (!end) {
        runtime.blocked = true;
        pushIssue({
          taskId: runtime.task.id,
          code: "DEPENDENCY_WITHOUT_END",
          message: "Uma atividade predecessora não possui término definido; o dimensionamento automático foi mantido em aberto.",
        });
        continue;
      }
      if (end.getTime() > runtime.earliest.getTime()) runtime.earliest = end;
    }
  }

  let propagated = true;
  while (propagated) {
    propagated = false;
    for (const runtime of runtimeById.values()) {
      if (runtime.blocked) continue;
      for (const predecessorId of predecessors.get(runtime.task.id) || []) {
        if (!taskById.has(predecessorId)) continue;
        const predecessor = runtimeById.get(predecessorId);
        if (predecessor && !predecessor.blocked) continue;
        runtime.blocked = true;
        propagated = true;
        pushIssue({
          taskId: runtime.task.id,
          code: "DEPENDENCY_WITHOUT_END",
          message: "Uma atividade predecessora não pôde ser dimensionada; esta etapa permanece em aberto.",
        });
        break;
      }
    }
  }

  const activeRuntimes = [...runtimeById.values()].filter((runtime) => !runtime.blocked);
  if (!activeRuntimes.length) return { scheduled: [], issues };
  const globalStart = new Date(Math.min(...activeRuntimes.map((runtime) => runtime.earliest.getTime())));
  const slots = slotStarts(input.calendar, globalStart, horizonDays, slotMinutes);

  const dependenciesSatisfied = (runtime: RuntimeTask, slot: Date) => {
    for (const predecessorId of predecessors.get(runtime.task.id) || []) {
      if (!taskById.has(predecessorId)) continue;
      const predecessor = runtimeById.get(predecessorId);
      if (!predecessor?.completedAt || predecessor.completedAt.getTime() > slot.getTime()) return false;
    }
    return true;
  };

  const processCountKey = (counts: Map<string, number>) =>
    [...counts.entries()].filter(([, count]) => count > 0).sort(([a], [b]) => a.localeCompare(b)).map(([processId, count]) => `${processId}:${count}`).join(",");

  const canFit = (runtime: RuntimeTask, laborUsed: number, processCounts: Map<string, number>) =>
    laborUsed + runtime.crewSize <= maxLabor &&
    (processCounts.get(runtime.task.processId) || 0) + 1 <= runtime.maxParallelTeams;

  const pickBestFill = (candidates: RuntimeTask[], laborAvailable: number, baseProcessCounts: Map<string, number>) => {
    type FillState = {
      labor: number;
      selected: RuntimeTask[];
      processCounts: Map<string, number>;
      priorityScore: number;
    };

    const initial: FillState = {
      labor: 0,
      selected: [],
      processCounts: new Map(baseProcessCounts),
      priorityScore: 0,
    };
    let states = new Map<string, FillState>([[`0|${processCountKey(initial.processCounts)}`, initial]]);

    for (const candidate of [...candidates].sort((a, b) => a.rank - b.rank)) {
      const snapshot = [...states.values()];
      for (const state of snapshot) {
        if (state.labor + candidate.crewSize > laborAvailable) continue;
        const currentProcessCount = state.processCounts.get(candidate.task.processId) || 0;
        if (currentProcessCount + 1 > candidate.maxParallelTeams) continue;

        const nextCounts = new Map(state.processCounts);
        nextCounts.set(candidate.task.processId, currentProcessCount + 1);
        const next: FillState = {
          labor: state.labor + candidate.crewSize,
          selected: [...state.selected, candidate],
          processCounts: nextCounts,
          priorityScore: state.priorityScore + candidate.rank,
        };
        const key = `${next.labor}|${processCountKey(next.processCounts)}`;
        const existing = states.get(key);
        if (
          !existing ||
          next.priorityScore < existing.priorityScore ||
          (next.priorityScore === existing.priorityScore && next.selected.length > existing.selected.length)
        ) {
          states.set(key, next);
        }
      }
    }

    return [...states.values()].sort((a, b) =>
      b.labor - a.labor ||
      a.priorityScore - b.priorityScore ||
      b.selected.length - a.selected.length,
    )[0]?.selected || [];
  };

  for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
    const slot = slots[slotIndex];
    const ready = activeRuntimes
      .filter((runtime) => runtime.remainingSlots > 0 && runtime.earliest.getTime() <= slot.getTime() && dependenciesSatisfied(runtime, slot))
      .sort((a, b) => a.rank - b.rank);
    if (!ready.length) continue;

    const selected: RuntimeTask[] = [];
    const selectedIds = new Set<string>();
    const processCounts = new Map<string, number>();
    let laborUsed = 0;

    const selectRuntime = (runtime: RuntimeTask) => {
      selected.push(runtime);
      selectedIds.add(runtime.task.id);
      laborUsed += runtime.crewSize;
      processCounts.set(runtime.task.processId, (processCounts.get(runtime.task.processId) || 0) + 1);
    };

    const sticky = ready.filter((runtime) => runtime.lastAllocatedSlotIndex === slotIndex - 1);
    for (const runtime of sticky) {
      if (canFit(runtime, laborUsed, processCounts)) selectRuntime(runtime);
    }

    if (!selected.length) {
      const anchor = ready.find((runtime) => canFit(runtime, laborUsed, processCounts));
      if (anchor) selectRuntime(anchor);
    }

    const fillCandidates = ready.filter((runtime) => !selectedIds.has(runtime.task.id));
    const fill = pickBestFill(fillCandidates, Math.max(maxLabor - laborUsed, 0), processCounts);
    fill.forEach((runtime) => selectRuntime(runtime));

    for (const runtime of selected) {
      runtime.allocations.push(slot);
      runtime.remainingSlots -= 1;
      runtime.lastAllocatedSlotIndex = slotIndex;
      if (runtime.remainingSlots <= 0) {
        runtime.completedAt = new Date(slot.getTime() + slotMinutes * 60_000);
      }
    }
  }

  const scheduledById = new Map<string, ScheduledCapacityTask>();
  for (const runtime of activeRuntimes) {
    if (runtime.remainingSlots > 0) {
      pushIssue({ taskId: runtime.task.id, code: "HORIZON_EXCEEDED", message: "Não foi encontrada capacidade suficiente dentro do horizonte de planejamento." });
      continue;
    }
    if (!runtime.allocations.length) continue;
    const first = runtime.allocations[0];
    const last = new Date(runtime.allocations[runtime.allocations.length - 1].getTime() + slotMinutes * 60_000);
    scheduledById.set(runtime.task.id, {
      taskId: runtime.task.id,
      startDate: formatDate(first),
      startTime: formatTime(first),
      endDate: formatDate(last),
      endTime: formatTime(last),
      requiredMinutes: runtime.requiredMinutes,
      crewSize: runtime.crewSize,
    });
  }

  return {
    scheduled: rankedTasks.flatMap((task) => scheduledById.get(task.id) ? [scheduledById.get(task.id)!] : []),
    issues,
  };
}
function isMissingCapacitySchema(error: any) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLocaleLowerCase("pt-BR");
  return code === "42P01" || code === "PGRST205" || message.includes("planejamento_v2_capacity_settings") || message.includes("planejamento_v2_process_capacities") || message.includes("planejamento_v2_capacity_task_rules");
}

export type CapacityRecalculationResult = CapacityScheduleResult & {
  enabled: boolean;
  schemaAvailable: boolean;
  updatedTasks: number;
};

export async function recalculatePlanejamentoV2Capacity(sb: any, workspaceId: string): Promise<CapacityRecalculationResult> {
  const settingsResult = await sb
    .from("planejamento_v2_capacity_settings")
    .select("workspace_id, enabled, max_concurrent_labor")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (settingsResult.error) {
    if (isMissingCapacitySchema(settingsResult.error)) return { enabled: false, schemaAvailable: false, updatedTasks: 0, scheduled: [], issues: [] };
    throw settingsResult.error;
  }

  const settings = settingsResult.data;
  if (!settings?.enabled) return { enabled: false, schemaAvailable: true, updatedTasks: 0, scheduled: [], issues: [] };

  const [workspaceResult, tasksResult, dependenciesResult, processesResult, rulesResult] = await Promise.all([
    sb.from("planejamento_v2_workspaces").select("id, work_week_days, workday_start_time, workday_end_time, break_start_time, break_end_time").eq("id", workspaceId).single(),
    sb.from("planejamento_v2_tasks").select("id, workspace_id, source_process_setting_id, title, quantity, unit, position, start_date, start_time, end_date, end_time, task_type").eq("workspace_id", workspaceId),
    sb.from("planejamento_v2_dependencies").select("predecessor_task_id, successor_task_id").eq("workspace_id", workspaceId),
    sb.from("planejamento_v2_process_capacities").select("process_setting_id, unit, crew_size, output_per_shift, reference_hours, max_parallel_teams, active").eq("workspace_id", workspaceId).eq("active", true),
    sb.from("planejamento_v2_capacity_task_rules").select("task_id, not_before_date, not_before_time, enabled").eq("workspace_id", workspaceId).eq("enabled", true),
  ]);

  const failure = [workspaceResult, tasksResult, dependenciesResult, processesResult, rulesResult].find((result) => result.error);
  if (failure?.error) {
    if (isMissingCapacitySchema(failure.error)) return { enabled: false, schemaAvailable: false, updatedTasks: 0, scheduled: [], issues: [] };
    throw failure.error;
  }

  const workspace = workspaceResult.data;
  const allTasks = tasksResult.data || [];
  const ruleByTask = new Map((rulesResult.data || []).map((rule: any) => [rule.task_id, rule]));
  const managedTasks = allTasks.filter((task: any) => ruleByTask.has(task.id) && task.task_type === "task" && task.source_process_setting_id);
  const managedIds = new Set(managedTasks.map((task: any) => task.id));

  const result = schedulePlanejamentoV2Capacity({
    tasks: managedTasks.map((task: any) => {
      const rule = ruleByTask.get(task.id) as any;
      return {
        id: task.id,
        processId: task.source_process_setting_id,
        title: task.title,
        quantity: Number(task.quantity || 0),
        unit: task.unit,
        position: Number(task.position || 0),
        notBeforeDate: rule?.not_before_date,
        notBeforeTime: rule?.not_before_time,
      };
    }),
    processes: (processesResult.data || []).map((process: any) => ({
      processId: process.process_setting_id,
      unit: process.unit,
      crewSize: Number(process.crew_size || 1),
      outputPerShift: Number(process.output_per_shift || 0),
      referenceHours: Number(process.reference_hours || 0),
      maxParallelTeams: Number(process.max_parallel_teams || 1),
    })),
    dependencies: (dependenciesResult.data || []).map((dependency: any) => ({
      predecessorTaskId: dependency.predecessor_task_id,
      successorTaskId: dependency.successor_task_id,
    })),
    externalTasks: allTasks.filter((task: any) => !managedIds.has(task.id)).map((task: any) => ({ id: task.id, endDate: task.end_date, endTime: task.end_time })),
    calendar: {
      workWeekDays: Array.isArray(workspace.work_week_days) && workspace.work_week_days.length ? workspace.work_week_days : [1, 2, 3, 4, 5],
      workdayStartTime: workspace.workday_start_time?.slice(0, 5) || "08:00",
      workdayEndTime: workspace.workday_end_time?.slice(0, 5) || "18:00",
      breakStartTime: workspace.break_start_time?.slice(0, 5) || null,
      breakEndTime: workspace.break_end_time?.slice(0, 5) || null,
    },
    maxConcurrentLabor: Number(settings.max_concurrent_labor || 0),
  });

  let updatedTasks = 0;
  for (const scheduled of result.scheduled) {
    const current = allTasks.find((task: any) => task.id === scheduled.taskId);
    if (!current) continue;
    const same =
      current.start_date === scheduled.startDate &&
      String(current.start_time || "").slice(0, 5) === scheduled.startTime &&
      current.end_date === scheduled.endDate &&
      String(current.end_time || "").slice(0, 5) === scheduled.endTime;
    if (same) continue;

    const start = new Date(`${scheduled.startDate}T00:00:00`);
    const end = new Date(`${scheduled.endDate}T00:00:00`);
    const durationDays = Math.max(Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1, 1);
    const { error } = await sb
      .from("planejamento_v2_tasks")
      .update({
        start_date: scheduled.startDate,
        start_time: scheduled.startTime,
        end_date: scheduled.endDate,
        end_time: scheduled.endTime,
        duration_days: durationDays,
      })
      .eq("id", scheduled.taskId)
      .eq("workspace_id", workspaceId);
    if (error) throw error;
    updatedTasks += 1;
  }

  return { ...result, enabled: true, schemaAvailable: true, updatedTasks };
}
