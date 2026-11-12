// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { supabase } from "@/planejamento-v2-original/supabaseClient";
import type { MultiMeasureRow } from "@/planejamento-v2-original/components/production/MultiMeasureEditor";
import {
  parseMeasureRows,
  validateOperationalMeasureRows,
} from "@/planejamento-v2-original/lib/opMeasureValidation";

export {
  parseMeasureRows,
  resolveProductionLogLength,
  sumMeasureQuantities,
  validateOperationalMeasureRows,
} from "@/planejamento-v2-original/lib/opMeasureValidation";

const db = supabase as any;

export type OPMeasure = {
  id: string;
  ordem_producao_id: string;
  comprimento: number;
  quantidade_planejada: number | null;
  ordem: number;
  ativo?: boolean;
};

export type ProductionLogMeasure = {
  id: string;
  production_log_id: string;
  ordem_producao_medida_id: string | null;
  comprimento: number;
  quantidade_produzida: number;
  perdas: number;
  ordem: number;
};

export type TargetMeasure = {
  id: string;
  target_id: string;
  comprimento: number;
  quantidade_meta: number;
  ordem: number;
};

export async function fetchOPMeasures(opId: string): Promise<OPMeasure[]> {
  const { data, error } = await db
    .from("ordem_producao_medidas")
    .select("id,ordem_producao_id,comprimento,quantidade_planejada,ordem,ativo")
    .eq("ordem_producao_id", opId)
    .eq("ativo", true)
    .order("ordem")
    .order("comprimento");
  if (error) throw error;
  return (data || []) as OPMeasure[];
}

export async function replaceOPMeasures(opId: string, rows: MultiMeasureRow[]) {
  const parsed = parseMeasureRows(rows);
  const { error: deleteError } = await db
    .from("ordem_producao_medidas")
    .delete()
    .eq("ordem_producao_id", opId);
  if (deleteError) throw deleteError;

  if (!parsed.length) return [];

  const { data, error } = await db
    .from("ordem_producao_medidas")
    .insert(parsed.map((row) => ({
      ordem_producao_id: opId,
      comprimento: row.comprimento,
      quantidade_planejada: row.quantidade,
      ordem: row.ordem,
    })))
    .select("id,ordem_producao_id,comprimento,quantidade_planejada,ordem");
  if (error) throw error;
  return (data || []) as OPMeasure[];
}

export async function syncOPMeasuresFromRows(opId: string, rows: MultiMeasureRow[]) {
  const parsed = validateOperationalMeasureRows(rows);

  const { data: existingData, error: existingError } = await db
    .from("ordem_producao_medidas")
    .select("id,ordem_producao_id,comprimento,quantidade_planejada,ordem,ativo")
    .eq("ordem_producao_id", opId);
  if (existingError) throw existingError;

  const existing = (existingData || []) as OPMeasure[];
  const desiredKeys = new Set(parsed.map((row) => row.comprimento.toFixed(3)));

  const { error: upsertError } = await db
    .from("ordem_producao_medidas")
    .upsert(
      parsed.map((row) => ({
        ordem_producao_id: opId,
        comprimento: row.comprimento,
        ordem: row.ordem,
        ativo: true,
      })),
      { onConflict: "ordem_producao_id,comprimento" },
    );
  if (upsertError) throw upsertError;

  const toDeactivate = existing
    .filter(
      (measure) =>
        measure.ativo !== false &&
        !desiredKeys.has(Number(measure.comprimento).toFixed(3)),
    )
    .map((measure) => measure.id);

  if (toDeactivate.length) {
    const { error: deactivateError } = await db
      .from("ordem_producao_medidas")
      .update({ ativo: false })
      .in("id", toDeactivate);
    if (deactivateError) throw deactivateError;
  }

  return fetchOPMeasures(opId);
}

export async function fetchTargetMeasures(targetId: string): Promise<TargetMeasure[]> {
  const { data, error } = await db
    .from("project_production_target_medidas")
    .select("id,target_id,comprimento,quantidade_meta,ordem")
    .eq("target_id", targetId)
    .order("ordem")
    .order("comprimento");
  if (error) throw error;
  return (data || []) as TargetMeasure[];
}

export async function replaceTargetMeasures(targetId: string, rows: MultiMeasureRow[]) {
  const parsed = parseMeasureRows(rows);
  const { error: deleteError } = await db
    .from("project_production_target_medidas")
    .delete()
    .eq("target_id", targetId);
  if (deleteError) throw deleteError;

  if (!parsed.length) return [];

  for (const row of parsed) {
    if (row.quantidade == null || row.quantidade <= 0) {
      throw new Error("Informe uma meta maior que zero para cada medida.");
    }
  }

  const { data, error } = await db
    .from("project_production_target_medidas")
    .insert(parsed.map((row) => ({
      target_id: targetId,
      comprimento: row.comprimento,
      quantidade_meta: row.quantidade,
      ordem: row.ordem,
    })))
    .select("id,target_id,comprimento,quantidade_meta,ordem");
  if (error) throw error;
  return (data || []) as TargetMeasure[];
}

export async function fetchProductionLogMeasures(logIds: string[]): Promise<ProductionLogMeasure[]> {
  if (!logIds.length) return [];
  const all: ProductionLogMeasure[] = [];
  const chunkSize = 500;
  for (let index = 0; index < logIds.length; index += chunkSize) {
    const chunk = logIds.slice(index, index + chunkSize);
    const { data, error } = await db
      .from("production_log_medidas")
      .select("id,production_log_id,ordem_producao_medida_id,comprimento,quantidade_produzida,perdas,ordem")
      .in("production_log_id", chunk)
      .order("ordem")
      .order("comprimento");
    if (error) throw error;
    all.push(...((data || []) as ProductionLogMeasure[]));
  }
  return all;
}

export async function replaceProductionLogMeasures(
  productionLogId: string,
  opMeasures: OPMeasure[],
  rows: MultiMeasureRow[],
) {
  const parsed = parseMeasureRows(rows);
  const { error: deleteError } = await db
    .from("production_log_medidas")
    .delete()
    .eq("production_log_id", productionLogId);
  if (deleteError) throw deleteError;

  if (!parsed.length) return [];

  const byLength = new Map(
    opMeasures.map((measure) => [Number(measure.comprimento).toFixed(3), measure]),
  );

  const { data, error } = await db
    .from("production_log_medidas")
    .insert(parsed.map((row) => ({
      production_log_id: productionLogId,
      ordem_producao_medida_id: byLength.get(row.comprimento.toFixed(3))?.id || null,
      comprimento: row.comprimento,
      quantidade_produzida: row.quantidade || 0,
      perdas: 0,
      ordem: row.ordem,
    })))
    .select("id,production_log_id,ordem_producao_medida_id,comprimento,quantidade_produzida,perdas,ordem");
  if (error) throw error;
  return (data || []) as ProductionLogMeasure[];
}
