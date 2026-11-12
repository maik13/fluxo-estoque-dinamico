// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
export const DEFAULT_WORK_SCHEDULE_TIMEZONE = "America/Sao_Paulo";
export const PRODUCTION_TIME_CALCULATION_VERSION = "work-schedule-v3";
export const SEM_PERFIL_JORNADA_ALERT = "SEM_PERFIL_JORNADA";
export const OPERADORES_NAO_IDENTIFICADOS_ALERT = "OPERADORES_NAO_IDENTIFICADOS";

export type WorkScheduleBreakType = "ALMOÇO" | "INTERVALO";

export interface WorkScheduleDayConfig {
  id?: string | null;
  work_schedule_profile_id?: string | null;
  diaSemana?: number | null;
  dia_semana?: number | null;
  trabalha?: boolean | null;
  entrada1?: string | null;
  entrada_1?: string | null;
  saida1?: string | null;
  saida_1?: string | null;
  entrada2?: string | null;
  entrada_2?: string | null;
  saida2?: string | null;
  saida_2?: string | null;
  intervaloEntrePeriodosEAlmoco?: boolean | null;
  intervalo_entre_periodos_e_almoco?: boolean | null;
}

export interface WorkScheduleBreakConfig {
  id?: string | null;
  work_schedule_profile_id?: string | null;
  nome?: string | null;
  tipo?: WorkScheduleBreakType | string | null;
  horaInicio?: string | null;
  horaFim?: string | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  ativo?: boolean | null;
  ordem?: number | null;
  diasSemana?: number[] | null;
  dias_semana?: number[] | null;
  descontarTempoProdutivo?: boolean | null;
  descontar_tempo_produtivo?: boolean | null;
}

export interface WorkScheduleProfileConfig {
  id?: string | null;
  nome?: string | null;
  descricao?: string | null;
  ativo?: boolean | null;
  padrao?: boolean | null;
  timezone?: string | null;
  horaEntrada?: string | null;
  horaSaida?: string | null;
  hora_entrada?: string | null;
  hora_saida?: string | null;
  diasSemana?: number[] | null;
  dias_semana?: number[] | null;
  vigenciaInicio?: string | null;
  vigenciaFim?: string | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  descontarIntervalos?: boolean | null;
  descontar_intervalos?: boolean | null;
  aplicarTodosFuncionarios?: boolean | null;
  aplicar_todos_funcionarios?: boolean | null;
  days?: WorkScheduleDayConfig[] | null;
  dias?: WorkScheduleDayConfig[] | null;
  profileDays?: WorkScheduleDayConfig[] | null;
  work_schedule_profile_days?: WorkScheduleDayConfig[] | null;
}

export interface AppliedInterval {
  nome: string;
  tipo: string;
  inicio: string;
  fim: string;
  minutos: number;
  origens?: string[];
}

export interface ProductionTimeCalculationInput {
  startedAt?: string | Date | null;
  endedAt?: string | Date | null;
  dateInicioISO?: string | null;
  dateFimISO?: string | null;
  horaInicio?: string | null;
  horaFim?: string | null;
  timezone?: string | null;
  profile?: WorkScheduleProfileConfig | null;
  breaks?: WorkScheduleBreakConfig[] | null;
  qtdOperadores?: number | string | null;
  custoMinuto?: number | string | null;
  operadoresIdentificados?: boolean | null;
}

export interface ProductionTimeCalculationResult {
  startedAt: string | null;
  endedAt: string | null;
  duracaoBrutaMin: number;
  duracaoIntervalosMin: number;
  duracaoLiquidaMin: number;
  duracaoDentroJornadaMin: number;
  duracaoForaJornadaMin: number;
  duracaoAlmocoMin: number;
  duracaoPausasMin: number;
  regularMinutes: number;
  overtimeMinutes: number;
  horaHomemMin: number;
  regularLaborMinutes: number;
  overtimeLaborMinutes: number;
  custoMaoObra: number;
  regularLaborCost: number;
  overtimeLaborCost: number;
  capacityMinutes: number;
  qtdOperadores: number;
  intervalosAplicados: AppliedInterval[];
  effectiveIntervals: AppliedInterval[];
  regularIntervals: AppliedInterval[];
  overtimeIntervals: AppliedInterval[];
  perfilJornadaId: string | null;
  alertas: string[];
  fonteDoCalculo: "configuracao_jornada" | "sem_perfil_jornada" | "sem_desconto_intervalos" | "dados_invalidos";
  versaoDoCalculo: string;
}

interface IntervalMs {
  startMs: number;
  endMs: number;
  nome: string;
  tipo: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function normalizeOPCode(value: string | number | null | undefined): string {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (/^OP[-_]/i.test(normalized)) return normalized;
  const withoutRepeatedPrefix = normalized.replace(/^(?:OP(?:\s+|(?=\d)))+/i, "").trim();
  return withoutRepeatedPrefix ? `OP ${withoutRepeatedPrefix.replace(/^OP\s+/i, "").trim()}` : "";
}

export function normalizeOPCodeForPersistence(value: string | number | null | undefined): string | null {
  return normalizeOPCode(value) || null;
}

export function prepareOPPersistencePayload<T extends Record<string, unknown>>(payload: T): T {
  if (!Object.prototype.hasOwnProperty.call(payload, "codigo_op")) return payload;
  return {
    ...payload,
    codigo_op: normalizeOPCodeForPersistence(payload.codigo_op as string | number | null | undefined),
  };
}

export function buildZonedTimestamp(dateISO: string | null | undefined, timeHHmm: string | null | undefined, timezone: string = DEFAULT_WORK_SCHEDULE_TIMEZONE): string {
  const date = String(dateISO ?? "").trim();
  const time = String(timeHHmm ?? "").trim();
  if (!ISO_DATE_RE.test(date)) throw new Error(`Data inválida para cálculo de produção: ${date || "vazia"}`);
  const timeMatch = time.match(TIME_RE);
  if (!timeMatch) throw new Error(`Hora inválida para cálculo de produção: ${time || "vazia"}`);

  const [year, month, day] = date.split("-").map(Number);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? 0);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timezone);
  const firstUtc = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(firstUtc), timezone);
  return new Date(utcGuess - secondOffset).toISOString();
}

export function getDateInTimeZone(value: string | Date, timezone: string = DEFAULT_WORK_SCHEDULE_TIMEZONE): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Data/hora inválida para conversão de fuso horário");
  const parts = getZonedParts(date, timezone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function getMinutesBetween(startedAt: string | Date, endedAt: string | Date): number {
  const startMs = toValidMs(startedAt);
  const endMs = toValidMs(endedAt);
  if (startMs == null || endMs == null || endMs <= startMs) return 0;
  return Math.round((endMs - startMs) / 60000);
}

export function validateWorkScheduleBreaks(breaks: WorkScheduleBreakConfig[]): string[] {
  const alertas: string[] = [];
  const activeBreaks = breaks.filter((item) => item.ativo !== false);

  for (const item of activeBreaks) {
    const start = getBreakStart(item);
    const end = getBreakEnd(item);
    if (!start || !end || end <= start) alertas.push(`Intervalo inválido: ${item.nome || "sem nome"}`);
    if (getBreakDays(item).length === 0) alertas.push(`Intervalo sem dia aplicável: ${item.nome || "sem nome"}`);
  }

  const ordered = activeBreaks
    .map((item) => ({ item, start: getBreakStart(item), end: getBreakEnd(item), days: getBreakDays(item) }))
    .filter((item): item is { item: WorkScheduleBreakConfig; start: string; end: string; days: number[] } => Boolean(item.start && item.end && item.end > item.start))
    .sort((a, b) => a.start.localeCompare(b.start));

  for (let index = 1; index < ordered.length; index += 1) {
    const current = ordered[index];
    for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
      const previous = ordered[previousIndex];
      if (!daysIntersect(previous.days, current.days)) continue;
      if (current.start < previous.end && current.end > previous.start) {
        alertas.push(`Intervalos sobrepostos: ${previous.item.nome || previous.start} / ${current.item.nome || current.start}`);
        break;
      }
    }
  }

  return alertas;
}

export function validateWorkScheduleDays(days: WorkScheduleDayConfig[]): string[] {
  const alertas: string[] = [];
  const seenDays = new Set<number>();
  for (const item of days) {
    const day = getScheduleDayNumber(item);
    if (!ALL_WEEK_DAYS.includes(day)) {
      alertas.push(`Dia inválido na jornada: ${day}`);
      continue;
    }
    if (seenDays.has(day)) alertas.push(`Dia duplicado na jornada: ${day}`);
    seenDays.add(day);
    if (item.trabalha === false) continue;

    const periods = getWorkPeriodsForDay(item);
    if (periods.length === 0) alertas.push(`Dia trabalhado sem horários válidos: ${day}`);

    const entrada2 = normalizeTime(item.entrada2 ?? item.entrada_2);
    const saida2 = normalizeTime(item.saida2 ?? item.saida_2);
    if (Boolean(entrada2) !== Boolean(saida2)) {
      alertas.push(`Segundo período incompleto no dia ${day}`);
    }

    const firstEnd = normalizeTime(item.saida1 ?? item.saida_1);
    const secondStart = entrada2;
    if (periods.length > 1 && secondStart && firstEnd && secondStart < firstEnd) {
      alertas.push(`Períodos sobrepostos no dia ${day}`);
    }
    if (isLunchEnabled(item) && (!firstEnd || !secondStart || secondStart <= firstEnd)) {
      alertas.push(`Almoço inválido no dia ${day}`);
    }
  }
  return alertas;
}

export function calculateProductionTime(input: ProductionTimeCalculationInput): ProductionTimeCalculationResult {
  const profile = input.profile ?? null;
  const timezone = profile?.timezone || input.timezone || DEFAULT_WORK_SCHEDULE_TIMEZONE;
  const alertas: string[] = [];
  const qtdOperadores = Math.max(1, toFiniteNumber(input.qtdOperadores, 1));
  const custoMinuto = Math.max(0, toFiniteNumber(input.custoMinuto, 0));
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  if (qtdOperadores > 1 && input.operadoresIdentificados === false) {
    alertas.push(OPERADORES_NAO_IDENTIFICADOS_ALERT);
  }
  try {
    startedAt = input.startedAt ? toIsoTimestamp(input.startedAt) : buildZonedTimestamp(input.dateInicioISO, input.horaInicio, timezone);
    endedAt = input.endedAt ? toIsoTimestamp(input.endedAt) : buildZonedTimestamp(input.dateFimISO || input.dateInicioISO, input.horaFim, timezone);
  } catch (error) {
    alertas.push(error instanceof Error ? error.message : "Dados inválidos para cálculo de produção");
    return emptyResult(startedAt, endedAt, qtdOperadores, alertas);
  }
  const startMs = toValidMs(startedAt);
  const endMs = toValidMs(endedAt);
  if (startMs == null || endMs == null) {
    alertas.push("Data/hora inválida para cálculo de produção");
    return emptyResult(startedAt, endedAt, qtdOperadores, alertas);
  }
  if (endMs <= startMs) {
    alertas.push("FIM anterior ou igual ao início; duração zerada");
    return emptyResult(startedAt, endedAt, qtdOperadores, alertas);
  }
  const duracaoBrutaMin = Math.round((endMs - startMs) / 60000);
  const brutoIntervals: IntervalMs[] = [{ startMs, endMs, nome: "Tempo bruto", tipo: "BRUTO" }];
  const descontarIntervalos = Boolean(profile && (profile.descontarIntervalos ?? profile.descontar_intervalos ?? true));
  const breaks = input.breaks ?? [];
  const profileDays = profile ? getProfileDays(profile) : [];
  alertas.push(...validateWorkScheduleBreaks(breaks));
  if (profileDays.length) alertas.push(...validateWorkScheduleDays(profileDays));
  let intervalosAplicados: AppliedInterval[] = [];
  let effectiveIntervals: AppliedInterval[] = brutoIntervals.map(intervalToApplied);
  let regularIntervals: AppliedInterval[] = brutoIntervals.map((item) => intervalToApplied({ ...item, nome: "Tempo normal", tipo: "NORMAL" }));
  let overtimeIntervals: AppliedInterval[] = [];
  let duracaoIntervalosMin = 0;
  let duracaoDentroJornadaMin = duracaoBrutaMin;
  let duracaoForaJornadaMin = 0;
  let duracaoAlmocoMin = 0;
  let duracaoPausasMin = 0;
  let regularMinutes = duracaoBrutaMin;
  let overtimeMinutes = 0;
  let capacityMinutes = 0;
  let fonteDoCalculo: ProductionTimeCalculationResult["fonteDoCalculo"] = "sem_perfil_jornada";
  if (profile && profileDays.length > 0) {
    fonteDoCalculo = descontarIntervalos ? "configuracao_jornada" : "sem_desconto_intervalos";
    const workIntervals = mergeIntervals(collectWorkPeriodOverlaps(startMs, endMs, profileDays, timezone, alertas));
    const lunchIntervals = descontarIntervalos
      ? mergeIntervals(collectLunchOverlaps(startMs, endMs, profileDays, timezone, alertas))
      : [];
    const rawPauseIntervals = descontarIntervalos
      ? mergeIntervals(collectBreakOverlaps(startMs, endMs, breaks, timezone, alertas))
      : [];
    const pauseIntervals = subtractIntervals(rawPauseIntervals, lunchIntervals);
    const discountIntervals = mergeIntervals([...lunchIntervals, ...pauseIntervals]);
    const effectiveIntervalSet = subtractIntervals(brutoIntervals, discountIntervals, "Tempo efetivo", "EFETIVO");
    const regularIntervalSet = intersectIntervalSets(effectiveIntervalSet, workIntervals, "Tempo normal", "NORMAL");
    const overtimeIntervalSet = subtractIntervals(effectiveIntervalSet, workIntervals, "Tempo extra", "EXTRA");
    duracaoDentroJornadaMin = sumIntervals(workIntervals);
    duracaoAlmocoMin = sumIntervals(lunchIntervals);
    duracaoPausasMin = sumIntervals(pauseIntervals);
    duracaoIntervalosMin = sumIntervals(discountIntervals);
    regularMinutes = sumIntervals(regularIntervalSet);
    overtimeMinutes = sumIntervals(overtimeIntervalSet);
    duracaoForaJornadaMin = overtimeMinutes;
    intervalosAplicados = discountIntervals.map(intervalToApplied);
    effectiveIntervals = effectiveIntervalSet.map(intervalToApplied);
    regularIntervals = regularIntervalSet.map(intervalToApplied);
    overtimeIntervals = overtimeIntervalSet.map(intervalToApplied);
    capacityMinutes = calculateDailyCapacityMinutes({
      dateISO: getDateInTimeZone(startedAt, timezone),
      profile: { ...profile, days: profileDays },
      breaks,
      timezone,
      alertas,
    });
  } else if (profile && descontarIntervalos) {
    fonteDoCalculo = "configuracao_jornada";
    const discountIntervals = mergeIntervals(collectBreakOverlaps(startMs, endMs, breaks, timezone, alertas));
    const effectiveIntervalSet = subtractIntervals(brutoIntervals, discountIntervals, "Tempo efetivo", "EFETIVO");
    duracaoIntervalosMin = sumIntervals(discountIntervals);
    duracaoAlmocoMin = sumIntervals(discountIntervals.filter((item) => item.tipo === "ALMOÇO"));
    duracaoPausasMin = Math.max(0, duracaoIntervalosMin - duracaoAlmocoMin);
    regularMinutes = sumIntervals(effectiveIntervalSet);
    overtimeMinutes = 0;
    duracaoDentroJornadaMin = regularMinutes;
    duracaoForaJornadaMin = 0;
    intervalosAplicados = discountIntervals.map(intervalToApplied);
    effectiveIntervals = effectiveIntervalSet.map(intervalToApplied);
    regularIntervals = effectiveIntervalSet.map((item) => intervalToApplied({ ...item, nome: "Tempo normal", tipo: "NORMAL" }));
    overtimeIntervals = [];
  } else if (profile && !descontarIntervalos) {
    fonteDoCalculo = "sem_desconto_intervalos";
  } else {
    alertas.push(SEM_PERFIL_JORNADA_ALERT);
  }
  const duracaoLiquidaMin = Math.max(0, regularMinutes + overtimeMinutes);
  const regularLaborMinutes = regularMinutes * qtdOperadores;
  const overtimeLaborMinutes = overtimeMinutes * qtdOperadores;
  const horaHomemMin = regularLaborMinutes + overtimeLaborMinutes;
  const regularLaborCost = roundCurrency(regularLaborMinutes * custoMinuto);
  const overtimeLaborCost = roundCurrency(overtimeLaborMinutes * custoMinuto);
  const custoMaoObra = roundCurrency(regularLaborCost + overtimeLaborCost);
  return {
    startedAt,
    endedAt,
    duracaoBrutaMin,
    duracaoIntervalosMin,
    duracaoLiquidaMin,
    duracaoDentroJornadaMin,
    duracaoForaJornadaMin,
    duracaoAlmocoMin,
    duracaoPausasMin,
    regularMinutes,
    overtimeMinutes,
    horaHomemMin,
    regularLaborMinutes,
    overtimeLaborMinutes,
    custoMaoObra,
    regularLaborCost,
    overtimeLaborCost,
    capacityMinutes,
    qtdOperadores,
    intervalosAplicados,
    effectiveIntervals,
    regularIntervals,
    overtimeIntervals,
    perfilJornadaId: profile?.id ?? null,
    alertas,
    fonteDoCalculo,
    versaoDoCalculo: PRODUCTION_TIME_CALCULATION_VERSION,
  };
}
export function calculateDailyCapacityMinutes(input: {
  dateISO: string;
  profile?: WorkScheduleProfileConfig | null;
  breaks?: WorkScheduleBreakConfig[] | null;
  timezone?: string | null;
  alertas?: string[];
}) {
  const profile = input.profile ?? null;
  if (!profile) return 0;
  const timezone = profile.timezone || input.timezone || DEFAULT_WORK_SCHEDULE_TIMEZONE;
  const profileDays = getProfileDays(profile);
  if (!profileDays.length) return 0;
  const dayStartMs = toValidMs(buildZonedTimestamp(input.dateISO, "00:00", timezone));
  const dayEndMs = toValidMs(buildZonedTimestamp(addDays(input.dateISO, 1), "00:00", timezone));
  if (dayStartMs == null || dayEndMs == null || dayEndMs <= dayStartMs) return 0;
  const alerts = input.alertas ?? [];
  const workIntervals = mergeIntervals(collectWorkPeriodOverlaps(dayStartMs, dayEndMs, profileDays, timezone, alerts));
  if (!workIntervals.length) return 0;
  const breakIntervals = mergeIntervals(collectBreakOverlaps(dayStartMs, dayEndMs, input.breaks ?? [], timezone, alerts));
  const breaksInsideWork = intersectIntervalSets(breakIntervals, workIntervals, "Pausa em jornada", "INTERVALO");
  return sumIntervals(subtractIntervals(workIntervals, breaksInsideWork));
}
export function buildProductionLogTimeSnapshot(result: ProductionTimeCalculationResult) {
  return {
    started_at: result.startedAt,
    ended_at: result.endedAt,
    duracao_bruta_min: result.duracaoBrutaMin,
    duracao_intervalos_min: result.duracaoIntervalosMin,
    duracao_liquida_min: result.duracaoLiquidaMin,
    duracao_min: result.duracaoLiquidaMin,
    work_schedule_profile_id: result.perfilJornadaId,
    intervalos_aplicados: result.intervalosAplicados,
    calculation_version: result.versaoDoCalculo,
    calculation_alerts: result.alertas,
    labor_minutes: result.horaHomemMin,
    labor_cost: result.custoMaoObra,
    regular_minutes: result.regularMinutes,
    overtime_minutes: result.overtimeMinutes,
    regular_labor_minutes: result.regularLaborMinutes,
    overtime_labor_minutes: result.overtimeLaborMinutes,
    regular_labor_cost: result.regularLaborCost,
    overtime_labor_cost: result.overtimeLaborCost,
    capacity_minutes: result.capacityMinutes,
    calculation_source: result.fonteDoCalculo,
  };
}
export function detectOPCodeNormalizationCollisions(values: Array<string | number | null | undefined>) {
  const groups = new Map<string, string[]>();
  for (const value of values) {
    const original = String(value ?? "").trim();
    const normalized = normalizeOPCode(original);
    if (!normalized) continue;
    const existing = groups.get(normalized) ?? [];
    if (!existing.includes(original)) existing.push(original);
    groups.set(normalized, existing);
  }
  return Array.from(groups.entries())
    .filter(([, originals]) => originals.length > 1)
    .map(([codigoNormalizado, originais]) => ({ codigoNormalizado, originais }));
}

function collectWorkPeriodOverlaps(startMs: number, endMs: number, days: WorkScheduleDayConfig[], timezone: string, alertas: string[]): IntervalMs[] {
  const intervals: IntervalMs[] = [];
  for (const currentDate of enumerateDates(getDateInTimeZone(new Date(startMs), timezone), getDateInTimeZone(new Date(endMs), timezone))) {
    const dayConfig = findDayConfig(days, currentDate);
    if (!dayConfig || dayConfig.trabalha === false) continue;
    for (const period of getWorkPeriodsForDay(dayConfig)) {
      const interval = buildIntervalForDate(currentDate, period.start, period.end, timezone, period.label, "JORNADA", alertas);
      if (!interval) continue;
      const clipped = clipInterval(interval, startMs, endMs);
      if (clipped) intervals.push(clipped);
    }
  }
  return intervals;
}

function collectLunchOverlaps(startMs: number, endMs: number, days: WorkScheduleDayConfig[], timezone: string, alertas: string[]): IntervalMs[] {
  const intervals: IntervalMs[] = [];
  for (const currentDate of enumerateDates(getDateInTimeZone(new Date(startMs), timezone), getDateInTimeZone(new Date(endMs), timezone))) {
    const dayConfig = findDayConfig(days, currentDate);
    if (!dayConfig || dayConfig.trabalha === false || !isLunchEnabled(dayConfig)) continue;
    const start = normalizeTime(dayConfig.saida1 ?? dayConfig.saida_1);
    const end = normalizeTime(dayConfig.entrada2 ?? dayConfig.entrada_2);
    if (!start || !end || end <= start) continue;
    const interval = buildIntervalForDate(currentDate, start, end, timezone, "Almoço", "ALMOÇO", alertas);
    if (!interval) continue;
    const clipped = clipInterval(interval, startMs, endMs);
    if (clipped) intervals.push(clipped);
  }
  return intervals;
}

function collectBreakOverlaps(startMs: number, endMs: number, breaks: WorkScheduleBreakConfig[], timezone: string, alertas: string[]): IntervalMs[] {
  const intervals: IntervalMs[] = [];
  const activeBreaks = breaks
    .filter((item) => item.ativo !== false && shouldDiscountBreak(item))
    .sort((a, b) => toFiniteNumber(a.ordem, 0) - toFiniteNumber(b.ordem, 0));
  if (activeBreaks.length === 0) return intervals;

  const startDate = getDateInTimeZone(new Date(startMs), timezone);
  const endDate = getDateInTimeZone(new Date(endMs), timezone);

  for (const currentDate of enumerateDates(startDate, endDate)) {
    const dayOfWeek = getDayOfWeekFromISO(currentDate);
    for (const item of activeBreaks) {
      if (!getBreakDays(item).includes(dayOfWeek)) continue;
      const start = getBreakStart(item);
      const end = getBreakEnd(item);
      if (!start || !end || end <= start) continue;
      const interval = buildIntervalForDate(currentDate, start, end, timezone, item.nome || "Pausa", item.tipo || "INTERVALO", alertas);
      if (!interval) continue;
      const clipped = clipInterval(interval, startMs, endMs);
      if (clipped) intervals.push(clipped);
    }
  }

  return intervals;
}

function subtractIntervals(
  source: Array<Pick<IntervalMs, "startMs" | "endMs"> & Partial<IntervalMs>>,
  blockers: Array<Pick<IntervalMs, "startMs" | "endMs">>,
  nome?: string,
  tipo?: string,
): IntervalMs[] {
  const mergedBlockers = mergeIntervals(
    blockers.map((item) => ({ startMs: item.startMs, endMs: item.endMs, nome: "Desconto", tipo: "INTERVALO" })),
  );
  const result: IntervalMs[] = [];
  for (const item of source) {
    let pieces = [{ startMs: item.startMs, endMs: item.endMs }];
    for (const blocker of mergedBlockers) {
      pieces = pieces.flatMap((piece) => {
        if (blocker.endMs <= piece.startMs || blocker.startMs >= piece.endMs) return [piece];
        const next: Array<{ startMs: number; endMs: number }> = [];
        if (blocker.startMs > piece.startMs) next.push({ startMs: piece.startMs, endMs: blocker.startMs });
        if (blocker.endMs < piece.endMs) next.push({ startMs: blocker.endMs, endMs: piece.endMs });
        return next;
      });
    }
    for (const piece of pieces) {
      if (piece.endMs <= piece.startMs) continue;
      result.push({
        startMs: piece.startMs,
        endMs: piece.endMs,
        nome: nome ?? item.nome ?? "Intervalo",
        tipo: tipo ?? item.tipo ?? "INTERVALO",
      });
    }
  }
  return result;
}
function intersectIntervalSets(
  left: Array<Pick<IntervalMs, "startMs" | "endMs">>,
  right: Array<Pick<IntervalMs, "startMs" | "endMs">>,
  nome: string,
  tipo: string,
): IntervalMs[] {
  const result: IntervalMs[] = [];
  for (const leftItem of left) {
    for (const rightItem of right) {
      const startMs = Math.max(leftItem.startMs, rightItem.startMs);
      const endMs = Math.min(leftItem.endMs, rightItem.endMs);
      if (endMs > startMs) result.push({ startMs, endMs, nome, tipo });
    }
  }
  return mergeIntervals(result);
}
function getProfileDays(profile: WorkScheduleProfileConfig): WorkScheduleDayConfig[] {
  const rawDays = profile.days ?? profile.dias ?? profile.profileDays ?? profile.work_schedule_profile_days ?? [];
  return Array.isArray(rawDays) ? rawDays : [];
}

function getWorkPeriodsForDay(day: WorkScheduleDayConfig): Array<{ start: string; end: string; label: string }> {
  const periods: Array<{ start: string; end: string; label: string }> = [];
  const entrada1 = normalizeTime(day.entrada1 ?? day.entrada_1);
  const saida1 = normalizeTime(day.saida1 ?? day.saida_1);
  const entrada2 = normalizeTime(day.entrada2 ?? day.entrada_2);
  const saida2 = normalizeTime(day.saida2 ?? day.saida_2);
  if (entrada1 && saida1 && saida1 > entrada1) periods.push({ start: entrada1, end: saida1, label: "Período 1" });
  if (entrada2 && saida2 && saida2 > entrada2) periods.push({ start: entrada2, end: saida2, label: "Período 2" });
  return periods;
}

function findDayConfig(days: WorkScheduleDayConfig[], dateISO: string): WorkScheduleDayConfig | null {
  const target = getDayOfWeekFromISO(dateISO);
  return days.find((item) => getScheduleDayNumber(item) === target) || null;
}

function getScheduleDayNumber(day: WorkScheduleDayConfig): number {
  return Number(day.diaSemana ?? day.dia_semana ?? -1);
}

function isLunchEnabled(day: WorkScheduleDayConfig): boolean {
  return Boolean(day.intervaloEntrePeriodosEAlmoco ?? day.intervalo_entre_periodos_e_almoco);
}

function buildIntervalForDate(dateISO: string, start: string, end: string, timezone: string, nome: string, tipo: string, alertas: string[]): IntervalMs | null {
  try {
    const startMs = toValidMs(buildZonedTimestamp(dateISO, start, timezone));
    const endMs = toValidMs(buildZonedTimestamp(dateISO, end, timezone));
    if (startMs == null || endMs == null || endMs <= startMs) return null;
    return { startMs, endMs, nome, tipo };
  } catch (error) {
    alertas.push(error instanceof Error ? error.message : "Intervalo ignorado por data/hora inválida");
    return null;
  }
}

function clipInterval(interval: IntervalMs, startMs: number, endMs: number): IntervalMs | null {
  const overlapStart = Math.max(startMs, interval.startMs);
  const overlapEnd = Math.min(endMs, interval.endMs);
  if (overlapEnd <= overlapStart) return null;
  return { ...interval, startMs: overlapStart, endMs: overlapEnd };
}

function mergeIntervals(intervals: IntervalMs[]): Array<IntervalMs & { origens: string[] }> {
  const ordered = [...intervals].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const merged: Array<IntervalMs & { origens: string[] }> = [];

  for (const interval of ordered) {
    const label = `${interval.nome} (${interval.tipo})`;
    const previous = merged[merged.length - 1];
    if (!previous || interval.startMs > previous.endMs) {
      merged.push({ ...interval, origens: [label] });
      continue;
    }
    previous.endMs = Math.max(previous.endMs, interval.endMs);
    previous.nome = previous.nome === interval.nome ? previous.nome : "Intervalos programados";
    previous.tipo = previous.tipo === interval.tipo ? previous.tipo : "INTERVALO";
    if (!previous.origens.includes(label)) previous.origens.push(label);
  }

  return merged;
}

function intervalToApplied(item: IntervalMs & { origens?: string[] }): AppliedInterval {
  return {
    nome: item.nome,
    tipo: item.tipo,
    inicio: new Date(item.startMs).toISOString(),
    fim: new Date(item.endMs).toISOString(),
    minutos: Math.round((item.endMs - item.startMs) / 60000),
    origens: item.origens,
  };
}

function sumIntervals(intervals: Array<Pick<IntervalMs, "startMs" | "endMs">>): number {
  return intervals.reduce((sum, item) => sum + Math.round((item.endMs - item.startMs) / 60000), 0);
}

function getBreakStart(item: WorkScheduleBreakConfig): string | null {
  return normalizeTime(item.horaInicio ?? item.hora_inicio);
}

function getBreakEnd(item: WorkScheduleBreakConfig): string | null {
  return normalizeTime(item.horaFim ?? item.hora_fim);
}

function getBreakDays(item: WorkScheduleBreakConfig): number[] {
  const days = item.diasSemana ?? item.dias_semana;
  if (!Array.isArray(days) || days.length === 0) return [];
  return days.map(Number).filter((day) => ALL_WEEK_DAYS.includes(day));
}

function shouldDiscountBreak(item: WorkScheduleBreakConfig): boolean {
  return (item.descontarTempoProdutivo ?? item.descontar_tempo_produtivo ?? true) !== false;
}

function daysIntersect(left: number[], right: number[]): boolean {
  return left.some((day) => right.includes(day));
}

function normalizeTime(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  const match = text.match(TIME_RE);
  return match ? `${match[1]}:${match[2]}` : null;
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  let guard = 0;
  while (cursor <= endDate && guard < 370) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

function addDays(dateISO: string, amount: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12, 0, 0));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function getDayOfWeekFromISO(dateISO: string): number {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function toIsoTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Data/hora inválida para cálculo de produção");
  return date.toISOString();
}

function toValidMs(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function getTimeZoneOffsetMs(date: Date, timezone: string): number {
  const parts = getZonedParts(date, timezone);
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUTC - date.getTime();
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date).reduce<Record<string, number>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = Number(part.value);
    return acc;
  }, {});
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second };
}

function emptyResult(startedAt: string | null, endedAt: string | null, qtdOperadores: number, alertas: string[]): ProductionTimeCalculationResult {
  return {
    startedAt,
    endedAt,
    duracaoBrutaMin: 0,
    duracaoIntervalosMin: 0,
    duracaoLiquidaMin: 0,
    duracaoDentroJornadaMin: 0,
    duracaoForaJornadaMin: 0,
    duracaoAlmocoMin: 0,
    duracaoPausasMin: 0,
    regularMinutes: 0,
    overtimeMinutes: 0,
    horaHomemMin: 0,
    regularLaborMinutes: 0,
    overtimeLaborMinutes: 0,
    custoMaoObra: 0,
    regularLaborCost: 0,
    overtimeLaborCost: 0,
    capacityMinutes: 0,
    qtdOperadores,
    intervalosAplicados: [],
    effectiveIntervals: [],
    regularIntervals: [],
    overtimeIntervals: [],
    perfilJornadaId: null,
    alertas,
    fonteDoCalculo: "dados_invalidos",
    versaoDoCalculo: PRODUCTION_TIME_CALCULATION_VERSION,
  };
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
