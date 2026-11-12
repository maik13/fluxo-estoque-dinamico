// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import {
  buildProductionLogTimeSnapshot,
  calculateProductionTime,
  getDateInTimeZone,
  type ProductionTimeCalculationResult,
  type WorkScheduleBreakConfig,
  type WorkScheduleDayConfig,
  type WorkScheduleProfileConfig,
} from "./productionTimeCalculation";

type SupabaseLike = { from: (table: string) => any; rpc?: (fn: string, args?: Record<string, unknown>) => any };

interface WorkScheduleContextInput {
  funcionarioNome?: string | null;
  dataISO?: string | null;
}

interface CalculateFimSnapshotInput extends WorkScheduleContextInput {
  supabase: SupabaseLike;
  startedAt?: string | null;
  endedAt?: string | null;
  dataInicioISO?: string | null;
  dataFimISO?: string | null;
  horaInicio?: string | null;
  horaFim?: string | null;
  qtdOperadores?: number | string | null;
}

export interface WorkScheduleContext {
  profile: WorkScheduleProfileConfig | null;
  breaks: WorkScheduleBreakConfig[];
  days: WorkScheduleDayConfig[];
  custoMinuto: number;
  alertas: string[];
}

/**
 * Resolve o custo de forma compatível com as duas gerações do sistema:
 * 1. RPC versionada por colaborador/data (modelo novo);
 * 2. settings.custo_funcionario (legado);
 * 3. custo geral de financial_settings.
 *
 * A data é importante: alterações futuras de valor não devem reescrever o custo
 * de ciclos que já pertencem a uma vigência anterior.
 */
async function resolveLaborCostPerMinute(
  supabase: SupabaseLike,
  funcionarioNome: string | null | undefined,
  dataISO: string,
  legacyRows: any,
  financialSettings: any,
): Promise<number> {
  try {
    if (typeof supabase.rpc === "function") {
      const { data, error } = await supabase.rpc("resolve_employee_labor_cost_per_minute", {
        p_funcionario_nome: funcionarioNome ?? "",
        p_data: dataISO,
      });
      const resolved = Number(data);
      if (!error && Number.isFinite(resolved) && resolved > 0) return resolved;
    }
  } catch {
    // Compatibilidade para ambientes que ainda não receberam a migration.
  }

  const legacy = getEmployeeCostPerMinute(legacyRows, funcionarioNome);
  if (legacy > 0) return legacy;
  return getFinancialCostPerMinute(financialSettings);
}

export async function fetchWorkScheduleContext(supabase: SupabaseLike, input: WorkScheduleContextInput): Promise<WorkScheduleContext> {
  const alertas: string[] = [];
  const dataISO = input.dataISO || new Date().toISOString().slice(0, 10);

  const [profilesResult, breaksResult, daysResult, assignmentsResult, financialResult, employeeCostsResult] = await Promise.all([
    supabase.from("work_schedule_profiles").select("*").eq("ativo", true).order("padrao", { ascending: false }),
    supabase.from("work_schedule_breaks").select("*").eq("ativo", true).order("ordem", { ascending: true }),
    supabase.from("work_schedule_profile_days").select("*").order("dia_semana", { ascending: true }),
    supabase.from("employee_work_schedules").select("*").eq("ativo", true),
    supabase.from("financial_settings").select("*").limit(1).maybeSingle(),
    supabase.from("settings").select("valor, created_at").eq("tipo", "custo_funcionario").order("created_at", { ascending: true }),
  ]);

  const profiles = Array.isArray(profilesResult.data) ? profilesResult.data : [];
  const allBreaks = Array.isArray(breaksResult.data) ? breaksResult.data : [];
  const allDays = Array.isArray(daysResult.data) ? daysResult.data : [];
  const assignments = Array.isArray(assignmentsResult.data) ? assignmentsResult.data : [];
  if (profilesResult.error) alertas.push("Perfis de jornada indisponíveis; usando cálculo bruto");
  if (breaksResult.error) alertas.push("Pausas programadas indisponíveis; usando cálculo bruto");
  if (daysResult.error) alertas.push("Dias da jornada indisponíveis; usando configuração legada");

  const profile = resolveApplicableWorkScheduleProfile({
    profiles,
    assignments,
    funcionarioNome: input.funcionarioNome,
    dataISO,
  });

  const days = profile ? allDays.filter((item: any) => item.work_schedule_profile_id === profile.id) : [];
  const profileWithDays = profile ? { ...profile, days } : null;
  const breaks = profile ? allBreaks.filter((item: any) => item.work_schedule_profile_id === profile.id) : [];
  const custoMinuto = await resolveLaborCostPerMinute(
    supabase,
    input.funcionarioNome,
    dataISO,
    employeeCostsResult.data,
    financialResult.data,
  );
  return { profile: profileWithDays, breaks, days, custoMinuto, alertas };
}

export async function calculateFimProductionTimeSnapshot(
  input: CalculateFimSnapshotInput,
): Promise<{ result: ProductionTimeCalculationResult; fields: ReturnType<typeof buildProductionLogTimeSnapshot> }> {
  const dateISO = input.dataFimISO || input.dataInicioISO || (input.endedAt ? getDateInTimeZone(input.endedAt) : new Date().toISOString().slice(0, 10));
  const context = await fetchWorkScheduleContext(input.supabase, { funcionarioNome: input.funcionarioNome, dataISO: dateISO });
  const result = calculateProductionTime({
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    dateInicioISO: input.dataInicioISO,
    dateFimISO: input.dataFimISO || input.dataInicioISO,
    horaInicio: input.horaInicio,
    horaFim: input.horaFim,
    profile: context.profile,
    breaks: context.breaks,
    qtdOperadores: input.qtdOperadores,
    custoMinuto: context.custoMinuto,
  });
  result.alertas.push(...context.alertas);
  return { result, fields: buildProductionLogTimeSnapshot(result) };
}

export type WorkScheduleProfileResolutionInput = {
  profiles: WorkScheduleProfileConfig[];
  assignments: Array<{
    funcionario_nome?: string | null;
    funcionario_id?: string | null;
    work_schedule_profile_id?: string | null;
    ativo?: boolean | null;
    vigencia_inicio?: string | null;
    vigencia_fim?: string | null;
  }>;
  funcionarioNome?: string | null;
  dataISO: string;
};

export function resolveApplicableWorkScheduleProfile(input: WorkScheduleProfileResolutionInput): WorkScheduleProfileConfig | null {
  const funcionarioNome = normalizeName(input.funcionarioNome);
  const applicableProfiles = input.profiles.filter((profile) => isProfileActiveOnDate(profile, input.dataISO));
  const matchingAssignments = input.assignments
    .filter((assignment) => {
      if (!isAssignmentActiveOnDate(assignment, input.dataISO)) return false;
      return normalizeName(assignment.funcionario_nome) === funcionarioNome;
    })
    .sort((left, right) => String(right.vigencia_inicio ?? "").localeCompare(String(left.vigencia_inicio ?? "")));
  const matchingAssignment = matchingAssignments[0];

  const individualProfile = matchingAssignment?.work_schedule_profile_id
    ? applicableProfiles.find((profile) => profile.id === matchingAssignment.work_schedule_profile_id)
    : null;
  if (individualProfile) return individualProfile;

  const profilesForEveryone = applicableProfiles.filter(
    (profile) => Boolean(profile.aplicar_todos_funcionarios),
  );
  const collectiveProfile = profilesForEveryone.find((profile) => Boolean(profile.padrao))
    || profilesForEveryone[0]
    || null;
  if (collectiveProfile) return collectiveProfile;

  return applicableProfiles.find((profile) => Boolean(profile.padrao)) || null;
}

export type DefaultProfileRange = {
  id?: string | null;
  ativo?: boolean | null;
  padrao?: boolean | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
};

export function dateRangesOverlap(
  startA?: string | null,
  endA?: string | null,
  startB?: string | null,
  endB?: string | null,
): boolean {
  const aStart = startA || "0001-01-01";
  const aEnd = endA || "9999-12-31";
  const bStart = startB || "0001-01-01";
  const bEnd = endB || "9999-12-31";
  return aStart <= bEnd && bStart <= aEnd;
}

export function findOverlappingDefaultProfile(
  profiles: DefaultProfileRange[],
  candidate: DefaultProfileRange,
  editingId?: string | null,
): DefaultProfileRange | null {
  if (candidate.ativo === false || !candidate.padrao) return null;
  return profiles.find((profile) => {
    if (profile.id && editingId && profile.id === editingId) return false;
    if (profile.ativo === false || !profile.padrao) return false;
    return dateRangesOverlap(
      profile.vigencia_inicio,
      profile.vigencia_fim,
      candidate.vigencia_inicio,
      candidate.vigencia_fim,
    );
  }) || null;
}

function isProfileActiveOnDate(profile: any, dataISO: string): boolean {
  const inicio = profile.vigencia_inicio;
  const fim = profile.vigencia_fim;
  if (inicio && dataISO < inicio) return false;
  if (fim && dataISO > fim) return false;
  return profile.ativo !== false;
}

function isAssignmentActiveOnDate(assignment: any, dataISO: string): boolean {
  const inicio = assignment.vigencia_inicio;
  const fim = assignment.vigencia_fim;
  if (inicio && dataISO < inicio) return false;
  if (fim && dataISO > fim) return false;
  return assignment.ativo !== false;
}

function getEmployeeCostPerMinute(rawRows: any, funcionarioNome?: string | null): number {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const target = normalizeName(funcionarioNome);
  let result = 0;
  for (const row of rows) {
    const [nome, valorBaseRaw, horasBaseRaw] = String(row?.valor ?? "").split("|");
    if (normalizeName(nome) !== target) continue;
    const valorBase = Number(valorBaseRaw);
    const horasBase = Number(horasBaseRaw);
    if (Number.isFinite(valorBase) && valorBase >= 0 && Number.isFinite(horasBase) && horasBase > 0) {
      // A última linha por created_at vence. Isso preserva o comportamento do
      // legado, inclusive para o espelho de modalidade diária/hora.
      result = valorBase / (horasBase * 60);
    }
  }
  return result;
}

function getFinancialCostPerMinute(settings: any): number {
  const direct = Number(settings?.custo_minuto_mo);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const monthly = Number(settings?.custo_mensal_mo);
  const days = Number(settings?.dias_trabalho);
  const hours = Number(settings?.horas_diarias);
  if (Number.isFinite(monthly) && Number.isFinite(days) && Number.isFinite(hours) && days > 0 && hours > 0) return monthly / (days * hours * 60);
  return 0;
}

function normalizeName(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}
