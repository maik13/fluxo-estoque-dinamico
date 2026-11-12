// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
export type PlanejamentoV2TimeInput = {
  hours?: number | string | null;
  minutes?: number | string | null;
  startTime?: string | null;
  endTime?: string | null;
};

function numberValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function minutesBetweenTimes(startTime?: string | null, endTime?: string | null) {
  if (!startTime || !endTime) return 0;
  const [startHour, startMinute] = startTime.slice(0, 5).split(":").map(Number);
  const [endHour, endMinute] = endTime.slice(0, 5).split(":").map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return Math.max(end - start, 0);
}

export function resolveTimeEntryMinutes(input: PlanejamentoV2TimeInput) {
  const intervalMinutes = minutesBetweenTimes(input.startTime, input.endTime);
  if (input.startTime || input.endTime) {
    if (!input.startTime || !input.endTime) {
      throw new Error("Informe o horário inicial e o horário final");
    }
    if (intervalMinutes <= 0) {
      throw new Error("O horário final deve ser posterior ao horário inicial");
    }
    return intervalMinutes;
  }

  const hours = numberValue(input.hours);
  const minutes = numberValue(input.minutes);
  const total = Math.round(hours * 60 + minutes);
  if (total <= 0) throw new Error("Informe um tempo realizado maior que zero");
  return total;
}

export function formatPlanejamentoV2Minutes(value?: number | null) {
  const minutes = Math.max(Math.round(Number(value || 0)), 0);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}min`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${String(rest).padStart(2, "0")}min`;
}

export function comparePlannedAndActual(plannedMinutes: number, actualMinutes: number) {
  const planned = Math.max(Math.round(Number(plannedMinutes || 0)), 0);
  const actual = Math.max(Math.round(Number(actualMinutes || 0)), 0);
  return {
    planned,
    actual,
    variance: actual - planned,
    percent: planned > 0 ? Math.round((actual / planned) * 100) : actual > 0 ? 100 : 0,
  };
}
