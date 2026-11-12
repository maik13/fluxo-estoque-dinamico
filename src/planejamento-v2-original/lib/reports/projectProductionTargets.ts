// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import type { ProductionReportRow } from "@/planejamento-v2-original/lib/reports/productionReport";

export type ProjectProductionCapacityPeriod = "hora" | "dia";

export type ProjectProductionProcessCapacity = {
  processo: string;
  capacidade: number;
  unidade: string;
  base_tempo: ProjectProductionCapacityPeriod;
};

export type ProjectProductionTargetMeasure = {
  id?: string;
  target_id?: string;
  comprimento: number;
  quantidade_meta: number;
  ordem: number;
};

export type ProjectProductionTarget = {
  id: string;
  project_setting_id?: string | null;
  projeto: string;
  descricao: string;
  lote_codigo: string | null;
  categoria: string | null;
  subcategoria: string | null;
  comprimento: number | null;
  unidade: string;
  quantidade_meta: number;
  processo_apuracao: string;
  especie: string | null;
  diametro: string | null;
  tipo_tratamento: string | null;
  capacidades_processos: ProjectProductionProcessCapacity[];
  ativo: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  medidas?: ProjectProductionTargetMeasure[];
};

export type ProjectProductionTargetInput = Omit<
  ProjectProductionTarget,
  "id" | "created_at" | "updated_at"
>;

export type ProjectProductionProcessBreakdown = {
  processo: string;
  produzido: number;
  perdas: number;
  ciclos: number;
};

export type ProjectProductionSourceOP = {
  op: string;
  produzido: number;
  perdas: number;
  ciclos: number;
};

export type ProjectProductionOtherLength = {
  comprimento: string;
  produzido: number;
  ciclos: number;
};

export type ProjectProductionMeasureSummary = {
  comprimento: number;
  meta: number;
  produzido: number;
  faltante: number;
  excedente: number;
  percentual: number;
  ciclos: number;
};

export type ProjectProductionTargetSummary = ProjectProductionTarget & {
  produzido: number;
  perdas: number;
  faltante: number;
  excedente: number;
  percentual: number;
  ciclos: number;
  breakdown: ProjectProductionProcessBreakdown[];
  sourceOps: ProjectProductionSourceOP[];
  otherLengths: ProjectProductionOtherLength[];
  categoryFilterApplied: boolean;
  categoryFallbackUsed: boolean;
  measureSummaries: ProjectProductionMeasureSummary[];
};

const normalize = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const sameOptionalText = (
  expected: string | null | undefined,
  actual: string | null | undefined,
) => !normalize(expected) || normalize(expected) === normalize(actual);

const sameLength = (expected: number | null | undefined, actual: string | null | undefined) => {
  if (expected == null || !Number.isFinite(Number(expected))) return true;
  const actualNumber = Number(String(actual ?? "").replace(",", "."));
  if (!Number.isFinite(actualNumber)) return false;
  return Math.abs(Number(expected) - actualNumber) < 0.001;
};

const normalizeLengthLabel = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "Sem comprimento";
  const numeric = Number(raw.replace(",", "."));
  if (!Number.isFinite(numeric)) return raw;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(numeric)} m`;
};

const cycleKey = (row: ProductionReportRow) =>
  String(row.endLogId || row.id).split(":")[0];

export type ProductionLogMeasureForExpansion = {
  id: string;
  production_log_id: string;
  comprimento: number;
  quantidade_produzida: number;
  perdas: number;
};

export function expandProductionRowsByMeasures(
  rows: ProductionReportRow[],
  measures: ProductionLogMeasureForExpansion[],
): ProductionReportRow[] {
  const measuresByLog = new Map<string, ProductionLogMeasureForExpansion[]>();
  for (const measure of measures) {
    const current = measuresByLog.get(measure.production_log_id) ?? [];
    current.push(measure);
    measuresByLog.set(measure.production_log_id, current);
  }

  const expanded: ProductionReportRow[] = [];
  for (const row of rows) {
    const rowMeasures = measuresByLog.get(String(row.endLogId)) ?? [];
    if (!rowMeasures.length) {
      expanded.push(row);
      continue;
    }

    for (const measure of rowMeasures) {
      expanded.push({
        ...row,
        id: `${row.id}:${measure.id}`,
        comprimento: String(measure.comprimento),
        quantidadeProduzida: Number(measure.quantidade_produzida || 0),
        perdas: Number(measure.perdas || 0),
      });
    }
  }

  return expanded;
}

export function normalizeProcessCapacities(
  value: unknown,
): ProjectProductionProcessCapacity[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = item as Partial<ProjectProductionProcessCapacity> | null;
      const processo = String(row?.processo ?? "").trim();
      const capacidade = Number(row?.capacidade);
      const unidade = String(row?.unidade ?? "").trim();
      const baseTempo = row?.base_tempo === "hora" ? "hora" : "dia";

      if (!processo || !Number.isFinite(capacidade) || capacidade <= 0 || !unidade) return null;
      return {
        processo,
        capacidade,
        unidade,
        base_tempo: baseTempo,
      } satisfies ProjectProductionProcessCapacity;
    })
    .filter((item): item is ProjectProductionProcessCapacity => item !== null);
}

/**
 * Conferência técnica completa. Mantém todos os parâmetros cadastrados disponíveis
 * para auditoria, inclusive os que ainda não fazem parte da apuração principal.
 */
export function rowMatchesTargetMaterial(
  row: ProductionReportRow,
  target: ProjectProductionTarget,
) {
  return (
    normalize(row.projeto) === normalize(target.projeto) &&
    sameOptionalText(target.lote_codigo, row.lote) &&
    sameOptionalText(target.categoria, row.categoria) &&
    sameOptionalText(target.subcategoria, row.subcategoria) &&
    sameOptionalText(target.especie, row.especie) &&
    sameOptionalText(target.diametro, row.diametro) &&
    sameLength(target.comprimento, row.comprimento)
  );
}

export function rowMatchesTargetProcess(
  row: ProductionReportRow,
  target: ProjectProductionTarget,
) {
  return (
    normalize(row.projeto) === normalize(target.projeto) &&
    normalize(row.processo) === normalize(target.processo_apuracao)
  );
}

/**
 * Subcategoria é um filtro técnico confiável quando informada na meta.
 * Categoria é resolvida no contexto do conjunto de apontamentos porque parte
 * do histórico antigo não possui categoria, ou registra a classificação de entrada.
 */
export function rowMatchesTargetClassification(
  row: ProductionReportRow,
  target: ProjectProductionTarget,
) {
  return sameOptionalText(target.subcategoria, row.subcategoria);
}

/**
 * Correspondência-base do realizado: projeto + processo + comprimento + subcategoria.
 * A categoria é aplicada por summarizeProjectProductionTarget somente quando existe
 * correspondência histórica confiável para a categoria informada na meta.
 */
export function rowMatchesTargetOutput(
  row: ProductionReportRow,
  target: ProjectProductionTarget,
) {
  return (
    rowMatchesTargetProcess(row, target) &&
    rowMatchesTargetClassification(row, target) &&
    sameLength(target.comprimento, row.comprimento)
  );
}

export function summarizeProjectProductionTarget(
  target: ProjectProductionTarget,
  rows: ProductionReportRow[],
): ProjectProductionTargetSummary {
  const processRows = rows.filter((row) => rowMatchesTargetProcess(row, target));
  const classifiedRows = processRows.filter((row) => rowMatchesTargetClassification(row, target));

  const hasCategory = !!normalize(target.categoria);
  const categoryRows = hasCategory
    ? classifiedRows.filter((row) => normalize(row.categoria) === normalize(target.categoria))
    : classifiedRows;
  const categoryFilterApplied = hasCategory && categoryRows.length > 0;
  const categoryFallbackUsed = hasCategory && classifiedRows.length > 0 && categoryRows.length === 0;
  const sourceRows = categoryFilterApplied ? categoryRows : classifiedRows;

  const configuredMeasures = (target.medidas || [])
    .filter((measure) => Number.isFinite(Number(measure.comprimento)) && Number(measure.comprimento) > 0)
    .sort((left, right) => left.ordem - right.ordem || left.comprimento - right.comprimento);

  let outputRows: ProductionReportRow[];
  let meta: number;
  let measureSummaries: ProjectProductionMeasureSummary[] = [];

  if (configuredMeasures.length > 0) {
    measureSummaries = configuredMeasures.map((measure) => {
      const matchingRows = sourceRows.filter((row) => sameLength(measure.comprimento, row.comprimento));
      const produzido = matchingRows.reduce((sum, row) => sum + row.quantidadeProduzida, 0);
      const perdas = matchingRows.reduce((sum, row) => sum + row.perdas, 0);
      const measureMeta = Math.max(0, Number(measure.quantidade_meta) || 0);
      return {
        comprimento: Number(measure.comprimento),
        meta: measureMeta,
        produzido,
        faltante: Math.max(0, measureMeta - produzido),
        excedente: Math.max(0, produzido - measureMeta),
        percentual: measureMeta > 0 ? (produzido / measureMeta) * 100 : 0,
        ciclos: new Set(matchingRows.map(cycleKey)).size,
      };
    });

    outputRows = sourceRows.filter((row) =>
      configuredMeasures.some((measure) => sameLength(measure.comprimento, row.comprimento)),
    );
    meta = measureSummaries.reduce((sum, measure) => sum + measure.meta, 0);
  } else {
    outputRows = sourceRows.filter((row) => sameLength(target.comprimento, row.comprimento));
    meta = Math.max(0, Number(target.quantidade_meta) || 0);
  }

  const produzido = outputRows.reduce((sum, row) => sum + row.quantidadeProduzida, 0);
  const perdas = outputRows.reduce((sum, row) => sum + row.perdas, 0);
  const faltante = Math.max(0, meta - produzido);
  const excedente = Math.max(0, produzido - meta);
  const percentual = meta > 0 ? (produzido / meta) * 100 : 0;

  const byProcess = new Map<string, ProjectProductionProcessBreakdown>();
  const processCycles = new Map<string, Set<string>>();
  for (const row of outputRows) {
    const key = normalize(row.processo) || "SEM PROCESSO";
    const current = byProcess.get(key) ?? {
      processo: row.processo || "Sem processo",
      produzido: 0,
      perdas: 0,
      ciclos: 0,
    };
    current.produzido += row.quantidadeProduzida;
    current.perdas += row.perdas;
    const cycles = processCycles.get(key) ?? new Set<string>();
    cycles.add(cycleKey(row));
    processCycles.set(key, cycles);
    current.ciclos = cycles.size;
    byProcess.set(key, current);
  }

  const breakdown = [...byProcess.values()].sort((left, right) =>
    left.processo.localeCompare(right.processo, "pt-BR"),
  );

  const byOp = new Map<string, ProjectProductionSourceOP>();
  const opCycles = new Map<string, Set<string>>();
  for (const row of outputRows) {
    const key = normalize(row.op) || "SEM OP";
    const current = byOp.get(key) ?? {
      op: row.op || "Sem OP",
      produzido: 0,
      perdas: 0,
      ciclos: 0,
    };
    current.produzido += row.quantidadeProduzida;
    current.perdas += row.perdas;
    const cycles = opCycles.get(key) ?? new Set<string>();
    cycles.add(cycleKey(row));
    opCycles.set(key, cycles);
    current.ciclos = cycles.size;
    byOp.set(key, current);
  }

  const sourceOps = [...byOp.values()].sort((left, right) =>
    left.op.localeCompare(right.op, "pt-BR", { numeric: true }),
  );

  const byOtherLength = new Map<string, ProjectProductionOtherLength>();
  if (configuredMeasures.length > 0) {
    for (const row of sourceRows) {
      if (configuredMeasures.some((measure) => sameLength(measure.comprimento, row.comprimento))) continue;
      const label = normalizeLengthLabel(row.comprimento);
      const current = byOtherLength.get(label) ?? {
        comprimento: label,
        produzido: 0,
        ciclos: 0,
      };
      current.produzido += row.quantidadeProduzida;
      current.ciclos += 1;
      byOtherLength.set(label, current);
    }
  } else if (target.comprimento != null && Number.isFinite(Number(target.comprimento))) {
    for (const row of sourceRows) {
      if (sameLength(target.comprimento, row.comprimento)) continue;
      const label = normalizeLengthLabel(row.comprimento);
      const current = byOtherLength.get(label) ?? {
        comprimento: label,
        produzido: 0,
        ciclos: 0,
      };
      current.produzido += row.quantidadeProduzida;
      current.ciclos += 1;
      byOtherLength.set(label, current);
    }
  }

  const otherLengths = [...byOtherLength.values()].sort((left, right) =>
    left.comprimento.localeCompare(right.comprimento, "pt-BR", { numeric: true }),
  );

  return {
    ...target,
    comprimento: configuredMeasures.length > 0 ? null : target.comprimento,
    quantidade_meta: meta,
    capacidades_processos: normalizeProcessCapacities(target.capacidades_processos),
    produzido,
    perdas,
    faltante,
    excedente,
    percentual,
    ciclos: new Set(outputRows.map(cycleKey)).size,
    breakdown,
    sourceOps,
    otherLengths,
    categoryFilterApplied,
    categoryFallbackUsed,
    measureSummaries,
  };
}

export function summarizeProjectProductionTargets(
  targets: ProjectProductionTarget[],
  rows: ProductionReportRow[],
) {
  return targets
    .filter((target) => target.ativo)
    .map((target) => summarizeProjectProductionTarget(target, rows));
}
