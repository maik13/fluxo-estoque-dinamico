export const DEFAULT_DAILY_MINUTES = 8 * 60;

export interface PointTimeEntry {
  hora_entrada_1?: string | null;
  hora_saida_1?: string | null;
  hora_entrada_2?: string | null;
  hora_saida_2?: string | null;
  hora_entrada_3?: string | null;
  hora_saida_3?: string | null;
}

export interface OvertimeBreakdown {
  extra50: number;
  extraNoturno: number;
  extra100: number;
}

export interface PointDaySummary extends OvertimeBreakdown {
  extraPJ: number;
  workedMinutes: number;
  regularMinutes: number;
  missingMinutes: number;
  baseMinutes: number;
  incomplete: boolean;
}

export interface FinancialDayInput extends PointDaySummary {
  isSunday?: boolean;
  isHoliday?: boolean;
}

export interface FinancialCalculationInput {
  contractType: string | null | undefined;
  contractValue: number | null | undefined;
  salary?: number | null;
  days: FinancialDayInput[];
  expectedMonthMinutes?: number;
  overtimeGeneratesValue?: boolean;
  basePaymentRatio?: number;
}

export interface FinancialCalculationResult {
  salarioBase: number;
  valorExtra50: number;
  valorExtraNoturno: number;
  valorExtra100: number;
  valorExtraPJ: number;
  descontoFalta: number;
  totalBruto: number;
  valorHoraReferencia: number;
  minutosNormais: number;
  minutosExtraPJ: number;
  diasTrabalhados: number;
}

export function normalizeContractType(contractType: string | null | undefined): string {
  const raw = (contractType || "").trim();
  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]+/g, "");

  if (!normalized) return "clt";
  if (compact === "pj" || normalized.startsWith("pj ") || normalized.includes("pessoa juridica")) return "pj";
  if (normalized.includes("diarista")) return "diarista";
  if (normalized.includes("horista")) return "horista";
  if (normalized.includes("clt")) return "clt";
  return normalized;
}

export function isPJContract(contractType: string | null | undefined): boolean {
  return normalizeContractType(contractType) === "pj";
}

export function resolvePJDailyBaseMinutes({
  configuredDayMinutes,
  weeklyHours,
  fallbackDailyMinutes = DEFAULT_DAILY_MINUTES,
}: {
  configuredDayMinutes: number | null | undefined;
  weeklyHours: number | null | undefined;
  fallbackDailyMinutes?: number;
}): number {
  const configured = Number(configuredDayMinutes ?? 0);
  const validConfigured = Number.isFinite(configured) && configured > 0
    ? configured
    : fallbackDailyMinutes;
  const weekly = Number(weeklyHours ?? 0);
  const weeklyDailyBase = Number.isFinite(weekly) && weekly > 0
    ? Math.round((weekly * 60) / 5)
    : DEFAULT_DAILY_MINUTES;
  const pjDailyLimit = Math.min(DEFAULT_DAILY_MINUTES, Math.max(1, weeklyDailyBase));

  return Math.min(validConfigured, pjDailyLimit);
}

const PUNCH_PAIRS: Array<[
  keyof PointTimeEntry,
  keyof PointTimeEntry,
]> = [
  ["hora_entrada_1", "hora_saida_1"],
  ["hora_entrada_2", "hora_saida_2"],
  ["hora_entrada_3", "hora_saida_3"],
];

export function timeToMinutes(time: string | null | undefined): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function hasAnyPunch(entry: PointTimeEntry | null | undefined): boolean {
  if (!entry) return false;
  return PUNCH_PAIRS.some(([entryKey, exitKey]) => Boolean(entry[entryKey] || entry[exitKey]));
}

export function isCompleteTimeEntry(entry: PointTimeEntry | null | undefined): boolean {
  if (!entry || !hasAnyPunch(entry)) return false;

  return PUNCH_PAIRS.every(([entryKey, exitKey]) => {
    const hasEntry = Boolean(entry[entryKey]);
    const hasExit = Boolean(entry[exitKey]);
    return hasEntry === hasExit;
  });
}

function periodMinutes(entryTime: string | null | undefined, exitTime: string | null | undefined): number {
  if (!entryTime || !exitTime) return 0;
  const start = timeToMinutes(entryTime);
  let end = timeToMinutes(exitTime);
  if (end < start) end += 24 * 60;
  return Math.max(0, end - start);
}

export function calculateWorkedMinutes(entry: PointTimeEntry): number {
  if (!isCompleteTimeEntry(entry)) return 0;

  return PUNCH_PAIRS.reduce(
    (total, [entryKey, exitKey]) => total + periodMinutes(entry[entryKey], entry[exitKey]),
    0,
  );
}

function overlapMinutes(start: number, end: number, windowStart: number, windowEnd: number): number {
  return Math.max(0, Math.min(end, windowEnd) - Math.max(start, windowStart));
}

export function calculateMinutesAfter22(entry: PointTimeEntry): number {
  if (!isCompleteTimeEntry(entry)) return 0;

  return PUNCH_PAIRS.reduce((total, [entryKey, exitKey]) => {
    const entryTime = entry[entryKey];
    const exitTime = entry[exitKey];
    if (!entryTime || !exitTime) return total;

    const start = timeToMinutes(entryTime);
    let end = timeToMinutes(exitTime);
    if (end < start) end += 24 * 60;

    const firstNight = overlapMinutes(start, end, 22 * 60, 24 * 60);
    const overnightNight = end > 24 * 60
      ? overlapMinutes(start, end, 24 * 60, 29 * 60)
      : 0;

    return total + firstNight + overnightNight;
  }, 0);
}

export function calculateOvertimeBreakdown(
  entry: PointTimeEntry,
  baseMinutes: number,
  isSunday: boolean,
  isHoliday: boolean,
  specialDayAllHoursAt100 = true,
): OvertimeBreakdown {
  const workedMinutes = calculateWorkedMinutes(entry);
  if (workedMinutes <= 0) {
    return { extra50: 0, extraNoturno: 0, extra100: 0 };
  }

  if (isSunday || isHoliday) {
    return {
      extra50: 0,
      extraNoturno: 0,
      extra100: specialDayAllHoursAt100
        ? workedMinutes
        : Math.max(0, workedMinutes - Math.max(0, baseMinutes)),
    };
  }

  const overtimeMinutes = Math.max(0, workedMinutes - Math.max(0, baseMinutes));
  const nightMinutes = Math.min(overtimeMinutes, calculateMinutesAfter22(entry));

  return {
    extra50: Math.max(0, overtimeMinutes - nightMinutes),
    extraNoturno: nightMinutes,
    extra100: 0,
  };
}

export function summarizePointDay({
  entry,
  expectedMinutes,
  isSunday,
  isHoliday,
  shouldCountAbsence,
  fallbackDailyMinutes = DEFAULT_DAILY_MINUTES,
  specialDayAllHoursAt100 = true,
}: {
  entry: PointTimeEntry | null | undefined;
  expectedMinutes: number | null;
  isSunday: boolean;
  isHoliday: boolean;
  shouldCountAbsence: boolean;
  fallbackDailyMinutes?: number;
  specialDayAllHoursAt100?: boolean;
}): PointDaySummary {
  const baseMinutes = expectedMinutes === null
    ? fallbackDailyMinutes
    : Math.max(0, expectedMinutes);

  if (!entry || !hasAnyPunch(entry)) {
    const missingMinutes = shouldCountAbsence
      && expectedMinutes !== null
      && expectedMinutes > 0
      && !isSunday
      && !isHoliday
      ? expectedMinutes
      : 0;

    return {
      workedMinutes: 0,
      regularMinutes: 0,
      missingMinutes,
      baseMinutes,
      incomplete: false,
      extra50: 0,
      extraNoturno: 0,
      extra100: 0,
      extraPJ: 0,
    };
  }

  if (!isCompleteTimeEntry(entry)) {
    return {
      workedMinutes: 0,
      regularMinutes: 0,
      missingMinutes: 0,
      baseMinutes,
      incomplete: true,
      extra50: 0,
      extraNoturno: 0,
      extra100: 0,
      extraPJ: 0,
    };
  }

  const workedMinutes = calculateWorkedMinutes(entry);
  const overtime = calculateOvertimeBreakdown(
    entry,
    baseMinutes,
    isSunday,
    isHoliday,
    specialDayAllHoursAt100,
  );
  const totalOvertime = overtime.extra50 + overtime.extraNoturno + overtime.extra100;
  const regularMinutes = Math.max(0, workedMinutes - totalOvertime);
  const missingMinutes = shouldCountAbsence
    && expectedMinutes !== null
    && expectedMinutes > 0
    && !isSunday
    && !isHoliday
    && workedMinutes < expectedMinutes
    ? expectedMinutes - workedMinutes
    : 0;

  return {
    workedMinutes,
    regularMinutes,
    missingMinutes,
    baseMinutes,
    incomplete: false,
    ...overtime,
    extraPJ: 0,
  };
}

function sumBy(days: FinancialDayInput[], selector: (day: FinancialDayInput) => number): number {
  return days.reduce((total, day) => total + selector(day), 0);
}

export function calculateFinancialValues({
  contractType,
  contractValue,
  salary,
  days,
  expectedMonthMinutes = 0,
  overtimeGeneratesValue = true,
  basePaymentRatio = 1,
}: FinancialCalculationInput): FinancialCalculationResult {
  const normalizedType = normalizeContractType(contractType);
  const shouldValueOvertime = overtimeGeneratesValue && normalizedType !== "horista";
  const value = Number(contractValue ?? salary ?? 0);
  const minutosNormais = sumBy(days, (day) => day.regularMinutes);
  const minutosExtra50 = sumBy(days, (day) => day.extra50);
  const minutosExtraNoturno = sumBy(days, (day) => day.extraNoturno);
  const minutosExtra100 = sumBy(days, (day) => day.extra100);
  const minutosExtraPJ = normalizedType === "pj"
    ? sumBy(days, (day) => day.extraPJ || day.extra50 + day.extraNoturno + day.extra100)
    : sumBy(days, (day) => day.extraPJ || 0);
  const minutosFalta = sumBy(days, (day) => day.missingMinutes);
  const diasTrabalhados = days.filter((day) => !day.incomplete && day.workedMinutes > 0).length;

  if (normalizedType === "pj") {
    // PJ não recebe adicionais de hora extra; o excedente fica agrupado como Extra PJ.
    const salarioBase = diasTrabalhados * value;
    const valorExtraPJ = days.reduce((total, day) => {
      const extraMinutes = day.extraPJ || day.extra50 + day.extraNoturno + day.extra100;
      const minuteRate = value / Math.max(1, day.baseMinutes || DEFAULT_DAILY_MINUTES);
      return total + extraMinutes * minuteRate;
    }, 0);

    return {
      salarioBase,
      valorExtra50: 0,
      valorExtraNoturno: 0,
      valorExtra100: 0,
      valorExtraPJ,
      descontoFalta: 0,
      totalBruto: salarioBase + valorExtraPJ,
      valorHoraReferencia: value / (DEFAULT_DAILY_MINUTES / 60),
      minutosNormais,
      minutosExtraPJ,
      diasTrabalhados,
    };
  }

  if (normalizedType === "diarista") {
    const salarioBase = days.reduce((total, day) => {
      const minuteRate = day.baseMinutes > 0 ? value / day.baseMinutes : 0;
      return total + day.regularMinutes * minuteRate;
    }, 0);
    const valorExtra50Calculado = days.reduce((total, day) => {
      const minuteRate = day.baseMinutes > 0 ? value / day.baseMinutes : 0;
      return total + day.extra50 * minuteRate * 1.5;
    }, 0);
    const valorExtraNoturnoCalculado = days.reduce((total, day) => {
      const minuteRate = day.baseMinutes > 0 ? value / day.baseMinutes : 0;
      return total + day.extraNoturno * minuteRate * 1.7;
    }, 0);
    const valorExtra100Calculado = days.reduce((total, day) => {
      const minuteRate = day.baseMinutes > 0 ? value / day.baseMinutes : 0;
      return total + day.extra100 * minuteRate * 2;
    }, 0);

    const valorExtra50 = shouldValueOvertime ? valorExtra50Calculado : 0;
    const valorExtraNoturno = shouldValueOvertime ? valorExtraNoturnoCalculado : 0;
    const valorExtra100 = shouldValueOvertime ? valorExtra100Calculado : 0;
    return {
      salarioBase,
      valorExtra50,
      valorExtraNoturno,
      valorExtra100,
      valorExtraPJ: 0,
      descontoFalta: 0,
      totalBruto: salarioBase + valorExtra50 + valorExtraNoturno + valorExtra100,
      valorHoraReferencia: value / (DEFAULT_DAILY_MINUTES / 60),
      minutosNormais,
      minutosExtraPJ: 0,
      diasTrabalhados,
    };
  }

  if (normalizedType === "horista") {
    const valorHora = value;
    const salarioBase = (minutosNormais / 60) * valorHora;
    const valorExtra50 = shouldValueOvertime ? (minutosExtra50 / 60) * valorHora * 1.5 : 0;
    const valorExtraNoturno = shouldValueOvertime ? (minutosExtraNoturno / 60) * valorHora * 1.7 : 0;
    const valorExtra100 = shouldValueOvertime ? (minutosExtra100 / 60) * valorHora * 2 : 0;

    return {
      salarioBase,
      valorExtra50,
      valorExtraNoturno,
      valorExtra100,
      valorExtraPJ: 0,
      descontoFalta: 0,
      totalBruto: salarioBase + valorExtra50 + valorExtraNoturno + valorExtra100,
      valorHoraReferencia: valorHora,
      minutosNormais,
      minutosExtraPJ: 0,
      diasTrabalhados,
    };
  }

  const salarioMensal = value * Math.min(1, Math.max(0, basePaymentRatio));
  const divisorHours = expectedMonthMinutes > 0 ? expectedMonthMinutes / 60 : 220;
  const valorHora = divisorHours > 0 ? salarioMensal / divisorHours : 0;
  const valorExtra50 = shouldValueOvertime ? (minutosExtra50 / 60) * valorHora * 1.5 : 0;
  const valorExtraNoturno = shouldValueOvertime ? (minutosExtraNoturno / 60) * valorHora * 1.7 : 0;
  const valorExtra100 = shouldValueOvertime ? (minutosExtra100 / 60) * valorHora * 2 : 0;
  const descontoFalta = (minutosFalta / 60) * valorHora;

  return {
    salarioBase: salarioMensal,
    valorExtra50,
    valorExtraNoturno,
    valorExtra100,
    valorExtraPJ: 0,
    descontoFalta,
    totalBruto: Math.max(
      0,
      salarioMensal + valorExtra50 + valorExtraNoturno + valorExtra100 - descontoFalta,
    ),
    valorHoraReferencia: valorHora,
    minutosNormais,
    minutosExtraPJ: 0,
    diasTrabalhados,
  };
}
