// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import {
  PRODUCTION_TIME_CALCULATION_VERSION,
  buildZonedTimestamp,
  calculateProductionTime,
  getDateInTimeZone,
  normalizeOPCode,
  type AppliedInterval,
  type WorkScheduleBreakConfig,
  type WorkScheduleDayConfig,
  type WorkScheduleProfileConfig,
} from "../productionTimeCalculation";
import { resolveApplicableWorkScheduleProfile } from "../workScheduleData";

export type ProductionReportLog = {
  id: string;
  ordem_producao_id: string | null;
  codigo_op: string | null;
  projeto: string | null;
  processo: string | null;
  funcionario: string | null;
  funcionario_id?: string | null;
  atividade: string | null;
  data_registro: string;
  scheduled_date?: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  duracao_min: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  duracao_bruta_min?: number | null;
  duracao_intervalos_min?: number | null;
  duracao_liquida_min?: number | null;
  regular_minutes?: number | null;
  overtime_minutes?: number | null;
  regular_labor_minutes?: number | null;
  overtime_labor_minutes?: number | null;
  regular_labor_cost?: number | null;
  overtime_labor_cost?: number | null;
  capacity_minutes?: number | null;
  calculation_source?: string | null;
  work_schedule_profile_id?: string | null;
  intervalos_aplicados?: unknown;
  calculation_version?: string | null;
  calculation_alerts?: string[] | null;
  labor_minutes?: number | null;
  total: number | null;
  qtd_produzida: number | null;
  quantidade_entrada: number | null;
  quantity_loss: number | null;
  qtd_operadores: number | null;
  labor_cost: number | null;
  custo_log: number | null;
  lote_codigo: string | null;
  categoria: string | null;
  subcategoria: string | null;
  observacao: string | null;
  comprimento?: number | string | null;
  diametro?: string | null;
  especie?: string | null;
};

export type ProductionReportSettings = {
  defaultLaborCostPerMinute: number;
  employeeLaborCostPerMinute: Record<string, number>;
  rawSettings: Record<string, string[]>;
  trackEmployees?: string[];
  workScheduleProfiles?: WorkScheduleProfileConfig[];
  workScheduleProfileDays?: WorkScheduleDayConfig[];
  workScheduleBreaks?: WorkScheduleBreakConfig[];
  employeeWorkSchedules?: Array<{
    funcionario_nome?: string | null;
    funcionario_id?: string | null;
    work_schedule_profile_id?: string | null;
    ativo?: boolean | null;
    vigencia_inicio?: string | null;
    vigencia_fim?: string | null;
  }>;
  forceRecalculateSnapshots?: boolean;
};

export type ProductionReportRow = {
  id: string;
  startLogId: string | null;
  endLogId: string;
  dataInicio: string;
  dataFim: string;
  op: string;
  ordemProducaoId: string | null;
  projeto: string;
  processo: string;
  funcionario: string;
  lote: string;
  categoria: string;
  subcategoria: string;
  quantidadeProduzida: number;
  perdas: number;
  qtdOperadores: number;
  tempoMinutos: number;
  duracaoBrutaMinutos: number;
  duracaoIntervalosMinutos: number;
  duracaoLiquidaMinutos: number;
  duracaoAlmocoMinutos: number;
  duracaoPausasMinutos: number;
  regularMinutes: number;
  overtimeMinutes: number;
  horaHomemMinutos: number;
  regularLaborMinutes: number;
  overtimeLaborMinutes: number;
  horaHomemNaoIdentificadaMinutos: number;
  capacityMinutes: number;
  perfilJornadaId: string | null;
  fonteCalculo: string;
  calculationAlerts: string[];
  horaHomem: number;
  horaHomemNormal: number;
  horaHomemExtra: number;
  horaMaquinaProxy: number;
  custoMO: number;
  custoMONormal: number;
  custoMOExtra: number;
  custoUnitario: number;
  produtividadeUnHora: number;
  observacao: string;
  comprimento: string;
  diametro: string;
  especie: string;
  effectiveIntervals: AppliedInterval[];
  regularIntervals: AppliedInterval[];
  overtimeIntervals: AppliedInterval[];
};

export type ProcessSummary = {
  processo: string;
  projeto: string;
  quantidadeProduzida: number;
  perdas: number;
  ciclosConcluidos: number;
  tempoTotalMinutos: number;
  duracaoBrutaMinutos: number;
  duracaoAlmocoMinutos: number;
  duracaoPausasMinutos: number;
  regularMinutes: number;
  overtimeMinutes: number;
  horaHomem: number;
  horaHomemNormal: number;
  horaHomemExtra: number;
  horaMaquinaProxy: number;
  custoMO: number;
  custoMONormal: number;
  custoMOExtra: number;
  custoMedioPorCiclo: number;
  custoUnitario: number;
  produtividadeUnHora: number;
};

export type EmployeeSummary = {
  funcionario: string;
  quantidadeProduzida: number;
  horasTrabalhadas: number;
  horaHomem: number;
  horaHomemNormal: number;
  horaHomemExtra: number;
  horaHomemNaoIdentificada: number;
  custoMO: number;
  custoMONormal: number;
  custoMOExtra: number;
  capacidadeProdutivaMinutos: number;
  tempoApropriadoNormalMinutos: number;
  tempoExtraMinutos: number;
  tempoNaoApropriadoMinutos: number;
  taxaApropriacao: number;
  alertas: string[];
  produtividadeUnHora: number;
};

export type EmployeeDaySummary = {
  funcionario: string;
  data: string;
  capacidadeProdutivaMinutos: number;
  tempoApropriadoNormalMinutos: number;
  tempoExtraMinutos: number;
  tempoNaoApropriadoMinutos: number;
  taxaApropriacao: number;
  horaHomemNormal: number;
  horaHomemExtra: number;
  custoMONormal: number;
  custoMOExtra: number;
  alertas: string[];
};

export type OpSummary = {
  op: string;
  projeto: string;
  quantidadeProduzida: number;
  tempoTotalMinutos: number;
  duracaoBrutaMinutos: number;
  duracaoAlmocoMinutos: number;
  duracaoPausasMinutos: number;
  regularMinutes: number;
  overtimeMinutes: number;
  horaHomem: number;
  horaHomemNormal: number;
  horaHomemExtra: number;
  custoMO: number;
  custoMONormal: number;
  custoMOExtra: number;
  custoUnitario: number;
};

export type ProjectSummary = ProcessSummary & {
  projeto: string;
};

export type ProductionReport = {
  rows: ProductionReportRow[];
  byProcess: ProcessSummary[];
  byEmployee: EmployeeSummary[];
  byEmployeeDay: EmployeeDaySummary[];
  byOp: OpSummary[];
  byProject: ProjectSummary[];
};

export type ProductionRecalculationPreviewFilters = {
  dataInicio?: string;
  dataFim?: string;
  op?: string;
  funcionario?: string;
  somenteAntigos?: boolean;
};

export type ProductionRecalculationPreviewRow = {
  endLogId: string;
  startLogId: string | null;
  op: string;
  funcionario: string;
  dataFim: string;
  fonteAtual: string;
  fonteRecalculada: string;
  minutosAtuais: number;
  minutosRecalculados: number;
  diferencaMinutos: number;
  horaHomemAtual: number;
  horaHomemRecalculada: number;
  diferencaHoraHomem: number;
  custoAtual: number;
  custoRecalculado: number;
  diferencaCusto: number;
  alertas: string[];
};

const MAX_VALID_DURATION_MINUTES = 24 * 60;
const RECALCULATION_SOURCE = "recalculo_jornada_historica";

const clean = (value: string | null | undefined, fallback = "-") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const normalizeKey = (value: string | null | undefined) =>
  clean(value, "").toUpperCase();

const toNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const normalizeActivity = (activity: string | null | undefined) => {
  const normalized = normalizeKey(activity);
  if (normalized === "INICIO") return "ENTRADA";
  return normalized;
};

export const getProducedQuantity = (log: ProductionReportLog) => {
  const total = toNumber(log.total);
  if (total > 0) return total;
  return Math.max(0, toNumber(log.qtd_produzida));
};

const getOpKey = (log: ProductionReportLog) =>
  normalizeKey(log.ordem_producao_id || normalizeOPCode(log.codigo_op));

const getCompatibilityKey = (log: ProductionReportLog) =>
  [
    getOpKey(log),
    normalizeKey(log.processo),
    normalizeKey(log.funcionario),
    normalizeKey(log.lote_codigo),
    normalizeKey(log.projeto),
    normalizeKey(String(log.comprimento || "")),
  ].join("|");

const isCompatibleOptionalKey = (
  startValue: string | null | undefined,
  endValue: string | null | undefined
) => {
  const startKey = normalizeKey(startValue);
  const endKey = normalizeKey(endValue);
  return !startKey || !endKey || startKey === endKey;
};

const isSameOpReference = (
  startLog: ProductionReportLog,
  endLog: ProductionReportLog
) => {
  const startId = normalizeKey(startLog.ordem_producao_id);
  const endId = normalizeKey(endLog.ordem_producao_id);
  const startCode = normalizeKey(normalizeOPCode(startLog.codigo_op));
  const endCode = normalizeKey(normalizeOPCode(endLog.codigo_op));

  if (startId && endId && startId === endId) return true;
  if (startCode && endCode && startCode === endCode) return true;
  return false;
};

const isSafeFallbackMatch = (
  startLog: ProductionReportLog,
  endLog: ProductionReportLog
) =>
  isSameOpReference(startLog, endLog) &&
  isCompatibleOptionalKey(startLog.processo, endLog.processo) &&
  isCompatibleOptionalKey(startLog.funcionario, endLog.funcionario) &&
  isCompatibleOptionalKey(startLog.lote_codigo, endLog.lote_codigo) &&
  isCompatibleOptionalKey(startLog.projeto, endLog.projeto) &&
  isCompatibleOptionalKey(String(startLog.comprimento || ""), String(endLog.comprimento || ""));

export const getReportTimestamp = (dateValue: string | null | undefined) => {
  const timestamp = new Date(dateValue ?? "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getValidDurationMinutes = (start?: string, end?: string, fallback?: number | null) => {
  const fallbackMinutes = toNumber(fallback);
  if (fallbackMinutes > 0 && fallbackMinutes <= MAX_VALID_DURATION_MINUTES) {
    return fallbackMinutes;
  }

  const startTs = getReportTimestamp(start);
  const endTs = getReportTimestamp(end);
  if (startTs > 0 && endTs > 0 && startTs !== endTs) {
    const diffMinutes = (endTs - startTs) / 60000;
    if (diffMinutes >= 0 && diffMinutes <= MAX_VALID_DURATION_MINUTES) {
      return diffMinutes;
    }
  }

  return 0;
};

const getTimeOnlyDurationMinutes = (horaInicio?: string | null, horaFim?: string | null) => {
  if (!horaInicio || !horaFim) return 0;

  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFim.split(":").map(Number);
  if (![hi, mi, hf, mf].every(Number.isFinite)) return 0;

  let diff = (hf * 60 + mf) - (hi * 60 + mi);
  if (diff < 0) diff += 24 * 60;
  return diff > 0 && diff <= MAX_VALID_DURATION_MINUTES ? diff : 0;
};

const getLaborCostPerMinute = (
  funcionario: string,
  settings: ProductionReportSettings
) =>
  settings.employeeLaborCostPerMinute[normalizeKey(funcionario)] ??
  settings.defaultLaborCostPerMinute ??
  0;

const hasNumber = (value: unknown) => Number.isFinite(Number(value));

const hasCompleteCurrentSnapshot = (log: ProductionReportLog) =>
  log.calculation_version === PRODUCTION_TIME_CALCULATION_VERSION &&
  hasNumber(log.duracao_bruta_min) &&
  hasNumber(log.duracao_intervalos_min) &&
  hasNumber(log.duracao_liquida_min) &&
  hasNumber(log.regular_minutes) &&
  hasNumber(log.overtime_minutes) &&
  hasNumber(log.regular_labor_minutes) &&
  hasNumber(log.overtime_labor_minutes) &&
  hasNumber(log.labor_minutes) &&
  hasNumber(log.capacity_minutes);

const uniqueAlerts = (alerts: Array<string | null | undefined>) =>
  Array.from(new Set(alerts.map((item) => String(item ?? "").trim()).filter(Boolean)));

const getCycleDateISO = (value: string) => {
  try {
    return getDateInTimeZone(value);
  } catch {
    return value.slice(0, 10);
  }
};

/**
 * Data/hora operacional da ENTRADA: usa a mesma regra da tela de Apontamentos
 * (scheduled_date da OP + hora_inicio) para que relatório e tela mostrem
 * exatamente a mesma data, mesmo quando o data_registro foi gravado errado.
 */
const getOperationalStartDate = (
  startLog: ProductionReportLog | null,
  fallback: string,
) => {
  if (!startLog?.scheduled_date || !startLog?.hora_inicio) return fallback;
  try {
    return buildZonedTimestamp(startLog.scheduled_date, startLog.hora_inicio) || fallback;
  } catch {
    return fallback;
  }
};



const getProfileDaysForSettings = (
  profile: WorkScheduleProfileConfig | null,
  settings: ProductionReportSettings
): WorkScheduleDayConfig[] => {
  if (!profile) return [];
  const configured = (settings.workScheduleProfileDays ?? []).filter((day) => day.work_schedule_profile_id === profile.id);
  if (configured.length) return configured;
  const embedded = profile.days ?? profile.dias ?? profile.profileDays ?? profile.work_schedule_profile_days ?? [];
  return Array.isArray(embedded) ? embedded : [];
};

const getProfileBreaksForSettings = (
  profile: WorkScheduleProfileConfig | null,
  settings: ProductionReportSettings
): WorkScheduleBreakConfig[] => {
  if (!profile) return [];
  return (settings.workScheduleBreaks ?? []).filter((item) => !item.work_schedule_profile_id || item.work_schedule_profile_id === profile.id);
};

const resolveScheduleForCycle = (
  funcionario: string,
  cycleDateISO: string,
  settings: ProductionReportSettings
) => {
  const profile = resolveApplicableWorkScheduleProfile({
    profiles: settings.workScheduleProfiles ?? [],
    assignments: settings.employeeWorkSchedules ?? [],
    funcionarioNome: funcionario,
    dataISO: cycleDateISO,
  });
  const days = getProfileDaysForSettings(profile, settings);
  const profileWithDays = profile ? { ...profile, days } : null;
  return {
    profile: profileWithDays,
    breaks: getProfileBreaksForSettings(profile, settings),
  };
};

const safeCalculatedMinutes = (value: number) =>
  value > 0 && value <= MAX_VALID_DURATION_MINUTES ? value : 0;

const makeRow = (
  endLog: ProductionReportLog,
  startLog: ProductionReportLog | null,
  settings: ProductionReportSettings
): ProductionReportRow => {
  const rawStartDate = startLog?.started_at || startLog?.data_registro || endLog.started_at || endLog.data_registro;
  const startDate = getOperationalStartDate(startLog, rawStartDate);
  const endDate = endLog.ended_at || endLog.data_registro;
  const qtdOperadores = Math.max(1, toNumber(endLog.qtd_operadores || startLog?.qtd_operadores, 1));
  const funcionario = clean(endLog.funcionario || startLog?.funcionario);
  const laborCostPerMinute = getLaborCostPerMinute(funcionario, settings);
  const cycleDateISO = getCycleDateISO(startDate || endDate);
  const schedule = resolveScheduleForCycle(funcionario, cycleDateISO, settings);
  const calculated = startLog
    ? calculateProductionTime({
        startedAt: startDate,
        endedAt: endDate,
        horaInicio: startLog?.hora_inicio || endLog.hora_inicio,
        horaFim: endLog.hora_fim,
        profile: schedule.profile,
        breaks: schedule.breaks,
        qtdOperadores,
        custoMinuto: laborCostPerMinute,
        operadoresIdentificados: qtdOperadores <= 1,
      })
    : null;
  const preserveSnapshot = !settings.forceRecalculateSnapshots && hasCompleteCurrentSnapshot(endLog);
  const legacyDuration = getValidDurationMinutes(undefined, undefined, endLog.duracao_min);
  const fallbackTimeOnly = getTimeOnlyDurationMinutes(startLog?.hora_inicio || endLog.hora_inicio, endLog.hora_fim);

  let tempoMinutos = 0;
  let duracaoBrutaMinutos = 0;
  let duracaoIntervalosMinutos = 0;
  let duracaoLiquidaMinutos = 0;
  let duracaoAlmocoMinutos = 0;
  let duracaoPausasMinutos = 0;
  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let horaHomemMinutos = 0;
  let regularLaborMinutes = 0;
  let overtimeLaborMinutes = 0;
  let capacityMinutes = 0;
  let custoMO = 0;
  let custoMONormal = 0;
  let custoMOExtra = 0;
  let perfilJornadaId: string | null = null;
  let fonteCalculo = "historico_compativel";
  let calculationAlerts: string[] = [];
  let effectiveIntervals: AppliedInterval[] = [];
  let regularIntervals: AppliedInterval[] = [];
  let overtimeIntervals: AppliedInterval[] = [];

  if (preserveSnapshot) {
    tempoMinutos = getValidDurationMinutes(undefined, undefined, endLog.duracao_liquida_min);
    duracaoBrutaMinutos = getValidDurationMinutes(undefined, undefined, endLog.duracao_bruta_min) || tempoMinutos;
    duracaoIntervalosMinutos = Math.max(0, toNumber(endLog.duracao_intervalos_min));
    duracaoLiquidaMinutos = tempoMinutos;
    regularMinutes = Math.max(0, toNumber(endLog.regular_minutes));
    overtimeMinutes = Math.max(0, toNumber(endLog.overtime_minutes));
    regularLaborMinutes = Math.max(0, toNumber(endLog.regular_labor_minutes));
    overtimeLaborMinutes = Math.max(0, toNumber(endLog.overtime_labor_minutes));
    horaHomemMinutos = Math.max(0, toNumber(endLog.labor_minutes));
    capacityMinutes = Math.max(0, toNumber(endLog.capacity_minutes));
    custoMONormal = Math.max(0, toNumber(endLog.regular_labor_cost));
    custoMOExtra = Math.max(0, toNumber(endLog.overtime_labor_cost));
    custoMO = toNumber(endLog.labor_cost) || toNumber(endLog.custo_log) || custoMONormal + custoMOExtra;
    perfilJornadaId = endLog.work_schedule_profile_id || null;
    fonteCalculo = endLog.calculation_source || "snapshot_persistido";
    calculationAlerts = endLog.calculation_alerts || [];
    effectiveIntervals = calculated?.effectiveIntervals ?? [];
    regularIntervals = calculated?.regularIntervals ?? [];
    overtimeIntervals = calculated?.overtimeIntervals ?? [];
  } else if (startLog && calculated) {
    const calculatedDuration = safeCalculatedMinutes(calculated.duracaoLiquidaMin);
    const reconstructedDuration = calculatedDuration || getValidDurationMinutes(startDate, endDate, null) || fallbackTimeOnly;
    tempoMinutos = reconstructedDuration;
    duracaoBrutaMinutos = safeCalculatedMinutes(calculated.duracaoBrutaMin) || getValidDurationMinutes(startDate, endDate, null) || fallbackTimeOnly || tempoMinutos;
    duracaoIntervalosMinutos = Math.max(0, calculated.duracaoIntervalosMin);
    duracaoLiquidaMinutos = tempoMinutos;
    duracaoAlmocoMinutos = calculated.duracaoAlmocoMin;
    duracaoPausasMinutos = calculated.duracaoPausasMin;
    regularMinutes = calculatedDuration ? calculated.regularMinutes : 0;
    overtimeMinutes = calculatedDuration ? calculated.overtimeMinutes : 0;
    regularLaborMinutes = regularMinutes * qtdOperadores;
    overtimeLaborMinutes = overtimeMinutes * qtdOperadores;
    horaHomemMinutos = regularLaborMinutes + overtimeLaborMinutes;
    capacityMinutes = calculated.capacityMinutes;
    custoMONormal = calculated.regularLaborCost;
    custoMOExtra = calculated.overtimeLaborCost;
    custoMO = calculated.custoMaoObra || horaHomemMinutos * laborCostPerMinute;
    perfilJornadaId = calculated.perfilJornadaId;
    fonteCalculo = RECALCULATION_SOURCE;
    calculationAlerts = calculated.alertas;
    effectiveIntervals = calculated.effectiveIntervals;
    regularIntervals = calculated.regularIntervals;
    overtimeIntervals = calculated.overtimeIntervals;
  } else {
    tempoMinutos = legacyDuration;
    duracaoBrutaMinutos = legacyDuration;
    duracaoLiquidaMinutos = legacyDuration;
    regularMinutes = legacyDuration;
    regularLaborMinutes = legacyDuration * qtdOperadores;
    horaHomemMinutos = regularLaborMinutes;
    custoMO = toNumber(endLog.labor_cost) || toNumber(endLog.custo_log) || horaHomemMinutos * laborCostPerMinute;
    custoMONormal = custoMO;
  }

  if (qtdOperadores > 1 && !calculationAlerts.includes("OPERADORES_NAO_IDENTIFICADOS")) {
    calculationAlerts = [...calculationAlerts, "OPERADORES_NAO_IDENTIFICADOS"];
  }

  const quantidadeProduzida = getProducedQuantity(endLog);
  const perdas = Math.max(0, toNumber(endLog.quantity_loss));
  const horas = tempoMinutos / 60;
  const horaHomemNaoIdentificadaMinutos = qtdOperadores > 1 ? tempoMinutos * (qtdOperadores - 1) : 0;

  return {
    id: endLog.id,
    startLogId: startLog?.id ?? null,
    endLogId: endLog.id,
    dataInicio: startDate,
    dataFim: endDate,
    op: clean(normalizeOPCode(endLog.codigo_op || startLog?.codigo_op)),
    ordemProducaoId: endLog.ordem_producao_id || startLog?.ordem_producao_id || null,
    projeto: clean(endLog.projeto || startLog?.projeto),
    processo: clean(endLog.processo || startLog?.processo),
    funcionario,
    lote: clean(endLog.lote_codigo || startLog?.lote_codigo),
    categoria: clean(endLog.categoria || startLog?.categoria),
    subcategoria: clean(endLog.subcategoria || startLog?.subcategoria),
    quantidadeProduzida,
    perdas,
    qtdOperadores,
    tempoMinutos,
    duracaoBrutaMinutos,
    duracaoIntervalosMinutos,
    duracaoLiquidaMinutos,
    duracaoAlmocoMinutos,
    duracaoPausasMinutos,
    regularMinutes,
    overtimeMinutes,
    horaHomemMinutos,
    regularLaborMinutes,
    overtimeLaborMinutes,
    horaHomemNaoIdentificadaMinutos,
    capacityMinutes,
    perfilJornadaId,
    fonteCalculo,
    calculationAlerts: uniqueAlerts(calculationAlerts),
    horaHomem: horaHomemMinutos / 60,
    horaHomemNormal: regularLaborMinutes / 60,
    horaHomemExtra: overtimeLaborMinutes / 60,
    horaMaquinaProxy: horas,
    custoMO,
    custoMONormal,
    custoMOExtra,
    custoUnitario: quantidadeProduzida > 0 ? custoMO / quantidadeProduzida : 0,
    produtividadeUnHora: horas > 0 ? quantidadeProduzida / horas : 0,
    observacao: clean(endLog.observacao || startLog?.observacao, ""),
    comprimento: clean(String(endLog.comprimento || startLog?.comprimento || ""), ""),
    diametro: clean(endLog.diametro || startLog?.diametro, ""),
    especie: clean(endLog.especie || startLog?.especie, ""),
    effectiveIntervals,
    regularIntervals,
    overtimeIntervals,
  };
};

export const buildDetailedRows = (
  logs: ProductionReportLog[],
  settings: ProductionReportSettings
) => {
  const orderedLogs = [...logs].sort(
    (a, b) => getReportTimestamp(a.data_registro) - getReportTimestamp(b.data_registro)
  );
  const openEntries = new Map<string, ProductionReportLog[]>();
  const rows: ProductionReportRow[] = [];

  for (const log of orderedLogs) {
    const activity = normalizeActivity(log.atividade);
    const key = getCompatibilityKey(log);

    if (activity === "ENTRADA") {
      const queue = openEntries.get(key) ?? [];
      queue.push(log);
      openEntries.set(key, queue);
      continue;
    }

    if (activity !== "FIM") continue;

    const queue = openEntries.get(key) ?? [];
    let startLog = queue.shift() ?? null;
    if (queue.length) openEntries.set(key, queue);
    else openEntries.delete(key);

    if (!startLog) {
      for (const [fallbackKey, fallbackQueue] of openEntries.entries()) {
        const fallbackIndex = fallbackQueue.findIndex((entry) =>
          isSafeFallbackMatch(entry, log)
        );
        if (fallbackIndex < 0) continue;

        startLog = fallbackQueue.splice(fallbackIndex, 1)[0] ?? null;
        if (fallbackQueue.length) openEntries.set(fallbackKey, fallbackQueue);
        else openEntries.delete(fallbackKey);
        break;
      }
    }

    rows.push(makeRow(log, startLog, settings));
  }

  return rows.sort((a, b) => getReportTimestamp(b.dataFim) - getReportTimestamp(a.dataFim));
};

const sumRows = (rows: ProductionReportRow[]) => ({
  quantidadeProduzida: rows.reduce((acc, row) => acc + row.quantidadeProduzida, 0),
  perdas: rows.reduce((acc, row) => acc + row.perdas, 0),
  tempoTotalMinutos: rows.reduce((acc, row) => acc + row.tempoMinutos, 0),
  duracaoBrutaMinutos: rows.reduce((acc, row) => acc + row.duracaoBrutaMinutos, 0),
  duracaoAlmocoMinutos: rows.reduce((acc, row) => acc + row.duracaoAlmocoMinutos, 0),
  duracaoPausasMinutos: rows.reduce((acc, row) => acc + row.duracaoPausasMinutos, 0),
  regularMinutes: rows.reduce((acc, row) => acc + row.regularMinutes, 0),
  overtimeMinutes: rows.reduce((acc, row) => acc + row.overtimeMinutes, 0),
  horaHomem: rows.reduce((acc, row) => acc + row.horaHomem, 0),
  horaHomemNormal: rows.reduce((acc, row) => acc + row.horaHomemNormal, 0),
  horaHomemExtra: rows.reduce((acc, row) => acc + row.horaHomemExtra, 0),
  horaHomemNaoIdentificada: rows.reduce((acc, row) => acc + row.horaHomemNaoIdentificadaMinutos / 60, 0),
  horaMaquinaProxy: rows.reduce((acc, row) => acc + row.horaMaquinaProxy, 0),
  custoMO: rows.reduce((acc, row) => acc + row.custoMO, 0),
  custoMONormal: rows.reduce((acc, row) => acc + row.custoMONormal, 0),
  custoMOExtra: rows.reduce((acc, row) => acc + row.custoMOExtra, 0),
});

const groupBy = <T extends string>(
  rows: ProductionReportRow[],
  getKey: (row: ProductionReportRow) => T
) => {
  const groups = new Map<T, ProductionReportRow[]>();
  for (const row of rows) {
    const key = getKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
};

const rowDateKey = (row: ProductionReportRow) => getCycleDateISO(row.dataInicio || row.dataFim);

const sumUnionMinutes = (intervals: AppliedInterval[]) => {
  const parsed = intervals
    .map((item) => ({ start: getReportTimestamp(item.inicio), end: getReportTimestamp(item.fim) }))
    .filter((item) => item.start > 0 && item.end > item.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of parsed) {
    const previous = merged[merged.length - 1];
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
      continue;
    }
    previous.end = Math.max(previous.end, interval.end);
  }
  return merged.reduce((sum, item) => sum + Math.round((item.end - item.start) / 60000), 0);
};

export const aggregateByEmployeeDay = (rows: ProductionReportRow[]): EmployeeDaySummary[] =>
  Array.from(groupBy(rows, (row) => row.funcionario + "|" + rowDateKey(row))).map(([key, group]) => {
    const [funcionario, data] = key.split("|");
    const capacity = Math.max(0, ...group.map((row) => row.capacityMinutes || 0));
    const appropriatedNormal = sumUnionMinutes(group.flatMap((row) => row.regularIntervals));
    const fallbackAppropriated = appropriatedNormal || group.reduce((sum, row) => sum + row.regularMinutes, 0);
    const overtime = group.reduce((sum, row) => sum + row.overtimeMinutes, 0);
    const totals = sumRows(group);
    const tempoApropriadoNormalMinutos = Math.min(capacity || fallbackAppropriated, fallbackAppropriated);
    const tempoNaoApropriadoMinutos = Math.max(0, capacity - tempoApropriadoNormalMinutos);
    return {
      funcionario,
      data,
      capacidadeProdutivaMinutos: capacity,
      tempoApropriadoNormalMinutos,
      tempoExtraMinutos: overtime,
      tempoNaoApropriadoMinutos,
      taxaApropriacao: capacity > 0 ? tempoApropriadoNormalMinutos / capacity : 0,
      horaHomemNormal: totals.horaHomemNormal,
      horaHomemExtra: totals.horaHomemExtra,
      custoMONormal: totals.custoMONormal,
      custoMOExtra: totals.custoMOExtra,
      alertas: uniqueAlerts(group.flatMap((row) => row.calculationAlerts)),
    };
  });

export const aggregateByProcess = (rows: ProductionReportRow[]): ProcessSummary[] =>
  Array.from(groupBy(rows, (row) => row.processo + "|" + row.projeto)).map(([key, group]) => {
    const [processo, projeto] = key.split("|");
    const totals = sumRows(group);
    const hours = totals.tempoTotalMinutos / 60;
    return {
      processo,
      projeto,
      ...totals,
      ciclosConcluidos: group.length,
      custoMedioPorCiclo: group.length ? totals.custoMO / group.length : 0,
      custoUnitario: totals.quantidadeProduzida ? totals.custoMO / totals.quantidadeProduzida : 0,
      produtividadeUnHora: hours ? totals.quantidadeProduzida / hours : 0,
    };
  });

export const aggregateByEmployee = (rows: ProductionReportRow[]): EmployeeSummary[] =>
  Array.from(groupBy(rows, (row) => row.funcionario)).map(([funcionario, group]) => {
    const totals = sumRows(group);
    const horasTrabalhadas = totals.tempoTotalMinutos / 60;
    const daySummaries = aggregateByEmployeeDay(group);
    const capacidadeProdutivaMinutos = daySummaries.reduce((sum, day) => sum + day.capacidadeProdutivaMinutos, 0);
    const tempoApropriadoNormalMinutos = daySummaries.reduce((sum, day) => sum + day.tempoApropriadoNormalMinutos, 0);
    return {
      funcionario,
      quantidadeProduzida: totals.quantidadeProduzida,
      horasTrabalhadas,
      horaHomem: totals.horaHomem,
      horaHomemNormal: totals.horaHomemNormal,
      horaHomemExtra: totals.horaHomemExtra,
      horaHomemNaoIdentificada: totals.horaHomemNaoIdentificada,
      custoMO: totals.custoMO,
      custoMONormal: totals.custoMONormal,
      custoMOExtra: totals.custoMOExtra,
      capacidadeProdutivaMinutos,
      tempoApropriadoNormalMinutos,
      tempoExtraMinutos: daySummaries.reduce((sum, day) => sum + day.tempoExtraMinutos, 0),
      tempoNaoApropriadoMinutos: daySummaries.reduce((sum, day) => sum + day.tempoNaoApropriadoMinutos, 0),
      taxaApropriacao: capacidadeProdutivaMinutos > 0 ? tempoApropriadoNormalMinutos / capacidadeProdutivaMinutos : 0,
      alertas: uniqueAlerts(group.flatMap((row) => row.calculationAlerts)),
      produtividadeUnHora: horasTrabalhadas ? totals.quantidadeProduzida / horasTrabalhadas : 0,
    };
  });

export const aggregateByOp = (rows: ProductionReportRow[]): OpSummary[] =>
  Array.from(groupBy(rows, (row) => row.op + "|" + row.projeto)).map(([key, group]) => {
    const [op, projeto] = key.split("|");
    const totals = sumRows(group);
    return {
      op,
      projeto,
      quantidadeProduzida: totals.quantidadeProduzida,
      tempoTotalMinutos: totals.tempoTotalMinutos,
      duracaoBrutaMinutos: totals.duracaoBrutaMinutos,
      duracaoAlmocoMinutos: totals.duracaoAlmocoMinutos,
      duracaoPausasMinutos: totals.duracaoPausasMinutos,
      regularMinutes: totals.regularMinutes,
      overtimeMinutes: totals.overtimeMinutes,
      horaHomem: totals.horaHomem,
      horaHomemNormal: totals.horaHomemNormal,
      horaHomemExtra: totals.horaHomemExtra,
      custoMO: totals.custoMO,
      custoMONormal: totals.custoMONormal,
      custoMOExtra: totals.custoMOExtra,
      custoUnitario: totals.quantidadeProduzida ? totals.custoMO / totals.quantidadeProduzida : 0,
    };
  });

export const aggregateByProject = (rows: ProductionReportRow[]): ProjectSummary[] =>
  Array.from(groupBy(rows, (row) => row.projeto)).map(([projeto, group]) => {
    const totals = sumRows(group);
    const hours = totals.tempoTotalMinutos / 60;
    return {
      projeto,
      processo: "Todos",
      ...totals,
      ciclosConcluidos: group.length,
      custoMedioPorCiclo: group.length ? totals.custoMO / group.length : 0,
      custoUnitario: totals.quantidadeProduzida ? totals.custoMO / totals.quantidadeProduzida : 0,
      produtividadeUnHora: hours ? totals.quantidadeProduzida / hours : 0,
    };
  });

export const buildProductionReport = (
  logs: ProductionReportLog[],
  settings: ProductionReportSettings
): ProductionReport => {
  const rows = buildDetailedRows(logs, settings);
  return {
    rows,
    byProcess: aggregateByProcess(rows),
    byEmployee: aggregateByEmployee(rows),
    byEmployeeDay: aggregateByEmployeeDay(rows),
    byOp: aggregateByOp(rows),
    byProject: aggregateByProject(rows),
  };
};

const previewFilterMatch = (row: ProductionReportRow, filters: ProductionRecalculationPreviewFilters) => {
  const rowTime = getReportTimestamp(row.dataFim);
  const start = filters.dataInicio ? new Date(filters.dataInicio + "T00:00:00").getTime() : null;
  const end = filters.dataFim ? new Date(filters.dataFim + "T23:59:59").getTime() : null;
  if (filters.op && normalizeKey(row.op) !== normalizeKey(filters.op)) return false;
  if (filters.funcionario && normalizeKey(row.funcionario) !== normalizeKey(filters.funcionario)) return false;
  if (start && rowTime < start) return false;
  if (end && rowTime > end) return false;
  if (filters.somenteAntigos && row.fonteCalculo === "snapshot_persistido") return false;
  return true;
};

export const buildProductionRecalculationPreview = (
  logs: ProductionReportLog[],
  settings: ProductionReportSettings,
  filters: ProductionRecalculationPreviewFilters = {}
): ProductionRecalculationPreviewRow[] => {
  const currentRows = buildDetailedRows(logs, settings).filter((row) => previewFilterMatch(row, filters));
  const recalculatedRows = buildDetailedRows(logs, { ...settings, forceRecalculateSnapshots: true });
  const recalculatedByEndLog = new Map(recalculatedRows.map((row) => [row.endLogId, row]));

  return currentRows.map((current) => {
    const recalculated = recalculatedByEndLog.get(current.endLogId) ?? current;
    return {
      endLogId: current.endLogId,
      startLogId: current.startLogId,
      op: current.op,
      funcionario: current.funcionario,
      dataFim: current.dataFim,
      fonteAtual: current.fonteCalculo,
      fonteRecalculada: recalculated.fonteCalculo,
      minutosAtuais: current.tempoMinutos,
      minutosRecalculados: recalculated.tempoMinutos,
      diferencaMinutos: recalculated.tempoMinutos - current.tempoMinutos,
      horaHomemAtual: current.horaHomem,
      horaHomemRecalculada: recalculated.horaHomem,
      diferencaHoraHomem: recalculated.horaHomem - current.horaHomem,
      custoAtual: current.custoMO,
      custoRecalculado: recalculated.custoMO,
      diferencaCusto: recalculated.custoMO - current.custoMO,
      alertas: uniqueAlerts([...current.calculationAlerts, ...recalculated.calculationAlerts]),
    };
  });
};
