// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/planejamento-v2-original/supabaseClient";
import {
  buildDetailedRows,
  type ProductionReportLog,
  type ProductionReportRow,
  type ProductionReportSettings,
} from "@/planejamento-v2-original/lib/reports/productionReport";
import { fetchProductionLogMeasures } from "@/planejamento-v2-original/lib/opMeasures";
import {
  expandProductionRowsByMeasures,
  normalizeProcessCapacities,
  summarizeProjectProductionTargets,
  type ProjectProductionTarget,
  type ProjectProductionTargetInput,
} from "@/planejamento-v2-original/lib/reports/projectProductionTargets";

const sb = supabase as any;

export type ProjectProductionProjectOption = {
  id: string;
  name: string;
  legacy?: boolean;
};

export type ProjectProductionTargetOptions = {
  projetos: ProjectProductionProjectOption[];
  processos: string[];
  categorias: string[];
  subcategorias: string[];
  especies: string[];
  diametros: string[];
  lotes: string[];
};

export type ProjectOperationalOP = {
  id: string;
  codigoOp: string;
  processo: string;
  status: string;
  quantidadePlanejada: number;
  produzido: number;
  perdas: number;
  ciclos: number;
};

export type ProjectOperationalTotals = {
  opCount: number;
  ciclos: number;
  produzido: number;
  perdas: number;
};

export type ProjectProductionOverview = {
  id: string;
  name: string;
  legacy?: boolean;
  opCount: number;
  ciclos: number;
  produzido: number;
  perdas: number;
  targetCount: number;
  lastActivityAt: string | null;
};

const REPORT_SETTINGS: ProductionReportSettings = {
  defaultLaborCostPerMinute: 0,
  employeeLaborCostPerMinute: {},
  rawSettings: {},
};

const normalize = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const unique = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right, "pt-BR"),
  );

async function fetchOptions(): Promise<ProjectProductionTargetOptions> {
  const [settingsResult, opsResult, batchesResult] = await Promise.all([
    sb
      .from("settings")
      .select("id, tipo, valor, ordem")
      .eq("ativo", true)
      .in("tipo", ["projeto", "processo", "categoria", "subcategoria", "especie", "diametro"]),
    sb
      .from("ordens_producao")
      .select("projeto, project_setting_id")
      .not("projeto", "is", null),
    sb.from("batches").select("codigo_lote").not("codigo_lote", "is", null),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (opsResult.error) throw opsResult.error;
  if (batchesResult.error) throw batchesResult.error;

  const settings = settingsResult.data ?? [];
  const projectSettings = settings
    .filter((row: any) => row.tipo === "projeto")
    .map((row: any) => ({
      id: String(row.id),
      name: String(row.valor || "").trim(),
      order: Number(row.ordem || 0),
    }))
    .filter((row: any) => row.name)
    .sort((left: any, right: any) => left.order - right.order || left.name.localeCompare(right.name, "pt-BR"));

  const projectIds = new Set(projectSettings.map((row: any) => row.id));
  const projectNames = new Set(projectSettings.map((row: any) => normalize(row.name)));
  const legacyProjects = new Map<string, ProjectProductionProjectOption>();

  for (const row of opsResult.data ?? []) {
    const name = String((row as any).projeto || "").trim();
    const projectSettingId = (row as any).project_setting_id ? String((row as any).project_setting_id) : "";
    if (!name || (projectSettingId && projectIds.has(projectSettingId)) || projectNames.has(normalize(name))) continue;
    const key = normalize(name);
    if (!legacyProjects.has(key)) {
      legacyProjects.set(key, { id: `legacy:${key}`, name, legacy: true });
    }
  }

  const valuesFor = (tipo: string) =>
    settings.filter((row: any) => row.tipo === tipo).map((row: any) => row.valor);

  return {
    projetos: [
      ...projectSettings.map((row: any) => ({ id: row.id, name: row.name })),
      ...Array.from(legacyProjects.values()).sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    ],
    processos: unique(valuesFor("processo")),
    categorias: unique(valuesFor("categoria")),
    subcategorias: unique(valuesFor("subcategoria")),
    especies: unique(valuesFor("especie")),
    diametros: unique(valuesFor("diametro")),
    lotes: unique((batchesResult.data ?? []).map((row: any) => row.codigo_lote)),
  };
}

async function fetchTargets(project: ProjectProductionProjectOption): Promise<ProjectProductionTarget[]> {
  const queries: PromiseLike<any>[] = [];

  if (!project.legacy) {
    queries.push(
      sb
        .from("project_production_targets")
        .select("*")
        .eq("project_setting_id", project.id)
        .eq("ativo", true)
        .order("created_at", { ascending: true }),
    );
  }

  queries.push(
    sb
      .from("project_production_targets")
      .select("*")
      .is("project_setting_id", null)
      .eq("projeto", project.name)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
  );

  const results = await Promise.all(queries);
  const rows = new Map<string, any>();
  for (const result of results) {
    if (result.error) throw result.error;
    for (const row of result.data ?? []) rows.set(String(row.id), row);
  }

  const targets = Array.from(rows.values()).map((row: any) => ({
    ...row,
    lote_codigo: row.lote_codigo ?? null,
    tipo_tratamento: row.tipo_tratamento ?? null,
    capacidades_processos: normalizeProcessCapacities(row.capacidades_processos),
    medidas: [],
  })) as ProjectProductionTarget[];

  if (!targets.length) return targets;

  const { data: measureRows, error: measureError } = await sb
    .from("project_production_target_medidas")
    .select("id,target_id,comprimento,quantidade_meta,ordem")
    .in("target_id", targets.map((target) => target.id))
    .order("ordem")
    .order("comprimento");
  if (measureError) throw measureError;

  const byTarget = new Map<string, any[]>();
  for (const measure of measureRows ?? []) {
    const key = String((measure as any).target_id);
    const current = byTarget.get(key) ?? [];
    current.push({
      id: String((measure as any).id),
      target_id: key,
      comprimento: Number((measure as any).comprimento),
      quantidade_meta: Number((measure as any).quantidade_meta),
      ordem: Number((measure as any).ordem || 0),
    });
    byTarget.set(key, current);
  }

  return targets.map((target) => ({
    ...target,
    medidas: byTarget.get(target.id) ?? [],
  }));
}

const PROJECT_LOG_SELECT =
  "id, ordem_producao_id, codigo_op, project_setting_id, projeto, processo, funcionario, atividade, data_registro, hora_inicio, hora_fim, duracao_min, total, qtd_produzida, quantidade_entrada, quantity_loss, qtd_operadores, lote_codigo, categoria, subcategoria, observacao, comprimento, diametro, especie";

async function fetchLogPages(configure: (query: any) => any): Promise<ProductionReportLog[]> {
  const allLogs: ProductionReportLog[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    let query = sb
      .from("production_logs")
      .select(PROJECT_LOG_SELECT)
      .order("data_registro", { ascending: true })
      .range(from, from + pageSize - 1);
    query = configure(query);

    const { data, error } = await query;
    if (error) throw error;

    const page = (data ?? []) as ProductionReportLog[];
    allLogs.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return allLogs;
}

async function fetchProjectLogs(project: ProjectProductionProjectOption): Promise<ProductionReportLog[]> {
  const sources: ProductionReportLog[][] = [];

  if (!project.legacy) {
    sources.push(await fetchLogPages((query) => query.eq("project_setting_id", project.id)));
  }

  sources.push(
    await fetchLogPages((query) =>
      query.is("project_setting_id", null).eq("projeto", project.name),
    ),
  );

  const uniqueRows = new Map<string, ProductionReportLog>();
  for (const rows of sources) {
    for (const row of rows) uniqueRows.set(String(row.id), row);
  }
  return Array.from(uniqueRows.values());
}

async function fetchProjectOps(project: ProjectProductionProjectOption) {
  const select = "id, codigo_op, processo, status_op, quantidade_planejada, projeto, project_setting_id";
  const queries: PromiseLike<any>[] = [];

  if (!project.legacy) {
    queries.push(
      sb
        .from("ordens_producao")
        .select(select)
        .eq("project_setting_id", project.id)
        .order("created_at", { ascending: true }),
    );
  }

  queries.push(
    sb
      .from("ordens_producao")
      .select(select)
      .is("project_setting_id", null)
      .eq("projeto", project.name)
      .order("created_at", { ascending: true }),
  );

  const results = await Promise.all(queries);
  const rows = new Map<string, any>();
  for (const result of results) {
    if (result.error) throw result.error;
    for (const row of result.data ?? []) rows.set(String(row.id), row);
  }
  return Array.from(rows.values());
}

export function useProjectProductionTargetOptions() {
  return useQuery({
    queryKey: ["project-production-target-options"],
    queryFn: fetchOptions,
    staleTime: 60_000,
  });
}

async function fetchProjectProductionOverview(
  projects: ProjectProductionProjectOption[],
): Promise<ProjectProductionOverview[]> {
  if (!projects.length) return [];

  const [opsResult, actualsResult, targetsResult] = await Promise.all([
    sb
      .from("ordens_producao")
      .select("id, projeto, project_setting_id, created_at"),
    sb
      .from("project_production_actuals")
      .select("project_setting_id, projeto, ciclos, quantidade_produzida, perdas"),
    sb
      .from("project_production_targets")
      .select("id, project_setting_id, projeto")
      .eq("ativo", true),
  ]);

  if (opsResult.error) throw opsResult.error;
  if (actualsResult.error) throw actualsResult.error;
  if (targetsResult.error) throw targetsResult.error;

  const overview = new Map<string, ProjectProductionOverview>();
  const regularIdByName = new Map<string, string>();

  for (const project of projects) {
    overview.set(project.id, {
      id: project.id,
      name: project.name,
      legacy: project.legacy,
      opCount: 0,
      ciclos: 0,
      produzido: 0,
      perdas: 0,
      targetCount: 0,
      lastActivityAt: null,
    });
    if (!project.legacy) regularIdByName.set(normalize(project.name), project.id);
  }

  const resolveKey = (projectSettingId: unknown, projectName: unknown) => {
    const id = projectSettingId ? String(projectSettingId) : "";
    if (id && overview.has(id)) return id;

    const name = String(projectName || "").trim();
    const normalizedName = normalize(name);
    if (!normalizedName) return null;

    const regularKey = regularIdByName.get(normalizedName);
    if (regularKey) return regularKey;

    const legacyKey = `legacy:${normalizedName}`;
    return overview.has(legacyKey) ? legacyKey : null;
  };

  for (const row of opsResult.data ?? []) {
    const key = resolveKey((row as any).project_setting_id, (row as any).projeto);
    if (!key) continue;
    const current = overview.get(key)!;
    current.opCount += 1;
    const createdAt = (row as any).created_at ? String((row as any).created_at) : null;
    if (createdAt && (!current.lastActivityAt || createdAt > current.lastActivityAt)) {
      current.lastActivityAt = createdAt;
    }
  }

  for (const row of actualsResult.data ?? []) {
    const key = resolveKey((row as any).project_setting_id, (row as any).projeto);
    if (!key) continue;
    const current = overview.get(key)!;
    current.ciclos += Number((row as any).ciclos || 0);
    current.produzido += Number((row as any).quantidade_produzida || 0);
    current.perdas += Number((row as any).perdas || 0);
  }

  for (const row of targetsResult.data ?? []) {
    const key = resolveKey((row as any).project_setting_id, (row as any).projeto);
    if (!key) continue;
    overview.get(key)!.targetCount += 1;
  }

  return projects.map((project) => overview.get(project.id)!).filter(Boolean);
}

export function useProjectProductionOverview(projects: ProjectProductionProjectOption[]) {
  const signature = projects.map((project) => project.id).join("|");
  return useQuery({
    queryKey: ["project-production-overview", signature],
    queryFn: () => fetchProjectProductionOverview(projects),
    enabled: projects.length > 0,
    staleTime: 15_000,
  });
}

export function useProjectProductionTargets(project: ProjectProductionProjectOption | null) {
  const queryClient = useQueryClient();
  const projectKey = project?.id || null;

  const targetsQuery = useQuery({
    queryKey: ["project-production-targets", projectKey],
    queryFn: () => fetchTargets(project as ProjectProductionProjectOption),
    enabled: !!project,
    staleTime: 15_000,
  });

  const logsQuery = useQuery({
    queryKey: ["project-production-target-logs", projectKey],
    queryFn: () => fetchProjectLogs(project as ProjectProductionProjectOption),
    enabled: !!project,
    staleTime: 15_000,
  });

  const logMeasuresQuery = useQuery({
    queryKey: ["project-production-target-log-measures", projectKey],
    queryFn: () => fetchProductionLogMeasures(
      (logsQuery.data ?? []).map((row) => String(row.id)),
    ),
    enabled: !!project && logsQuery.isSuccess,
    staleTime: 15_000,
  });

  const opsQuery = useQuery({
    queryKey: ["project-production-target-ops", projectKey],
    queryFn: () => fetchProjectOps(project as ProjectProductionProjectOption),
    enabled: !!project,
    staleTime: 15_000,
  });

  const rows = useMemo(
    () => buildDetailedRows(logsQuery.data ?? [], REPORT_SETTINGS),
    [logsQuery.data],
  );

  const targetRows = useMemo(
    () => expandProductionRowsByMeasures(rows, logMeasuresQuery.data ?? []),
    [logMeasuresQuery.data, rows],
  );

  const summaries = useMemo(
    () => summarizeProjectProductionTargets(targetsQuery.data ?? [], targetRows),
    [targetRows, targetsQuery.data],
  );

  const operationalOps = useMemo<ProjectOperationalOP[]>(() => {
    const byId = new Map<string, ProjectOperationalOP>();
    const byCode = new Map<string, string>();
    const cyclesByOp = new Map<string, Set<string>>();

    for (const op of opsQuery.data ?? []) {
      const id = String(op.id);
      const codigoOp = String(op.codigo_op || "Sem OP");
      byId.set(id, {
        id,
        codigoOp,
        processo: String(op.processo || "Sem processo"),
        status: String(op.status_op || "aberta"),
        quantidadePlanejada: Number(op.quantidade_planejada || 0),
        produzido: 0,
        perdas: 0,
        ciclos: 0,
      });
      byCode.set(normalize(codigoOp), id);
    }

    for (const row of rows) {
      const formalId = row.ordemProducaoId ? String(row.ordemProducaoId) : "";
      const fallbackId = byCode.get(normalize(row.op));
      const key = (formalId && byId.has(formalId) ? formalId : fallbackId) || `log:${normalize(row.op) || row.id}`;
      const current = byId.get(key) ?? {
        id: key,
        codigoOp: row.op || "Sem OP",
        processo: row.processo || "Sem processo",
        status: "apontada",
        quantidadePlanejada: 0,
        produzido: 0,
        perdas: 0,
        ciclos: 0,
      };

      current.produzido += Number(row.quantidadeProduzida || 0);
      current.perdas += Number(row.perdas || 0);

      const cycleId = String(row.endLogId || row.id).split(":")[0];
      const cycleIds = cyclesByOp.get(key) ?? new Set<string>();
      cycleIds.add(cycleId);
      cyclesByOp.set(key, cycleIds);
      current.ciclos = cycleIds.size;

      if ((!current.processo || current.processo === "Sem processo") && row.processo) current.processo = row.processo;
      byId.set(key, current);
    }

    return Array.from(byId.values()).sort((left, right) =>
      left.codigoOp.localeCompare(right.codigoOp, "pt-BR", { numeric: true }),
    );
  }, [opsQuery.data, targetRows]);

  const operationalTotals = useMemo<ProjectOperationalTotals>(
    () => operationalOps.reduce(
      (acc, op) => ({
        opCount: acc.opCount + 1,
        ciclos: acc.ciclos + op.ciclos,
        produzido: acc.produzido + op.produzido,
        perdas: acc.perdas + op.perdas,
      }),
      { opCount: 0, ciclos: 0, produzido: 0, perdas: 0 },
    ),
    [operationalOps],
  );

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project-production-targets", projectKey] }),
      queryClient.invalidateQueries({ queryKey: ["project-production-target-logs", projectKey] }),
      queryClient.invalidateQueries({ queryKey: ["project-production-target-log-measures", projectKey] }),
      queryClient.invalidateQueries({ queryKey: ["project-production-target-ops", projectKey] }),
    ]);
  };

  const createTarget = useMutation({
    mutationFn: async (input: ProjectProductionTargetInput) => {
      const { data, error } = await sb
        .from("project_production_targets")
        .insert(input)
        .select("*")
        .single();
      if (error) throw error;
      return data as ProjectProductionTarget;
    },
    onSuccess: invalidate,
  });

  const updateTarget = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ProjectProductionTargetInput> }) => {
      const { data, error } = await sb
        .from("project_production_targets")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as ProjectProductionTarget;
    },
    onSuccess: invalidate,
  });

  const deleteTarget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("project_production_targets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    summaries,
    targets: targetsQuery.data ?? [],
    rows,
    operationalOps,
    operationalTotals,
    isLoading: targetsQuery.isLoading || logsQuery.isLoading || logMeasuresQuery.isLoading || opsQuery.isLoading,
    isFetching: targetsQuery.isFetching || logsQuery.isFetching || logMeasuresQuery.isFetching || opsQuery.isFetching,
    error: targetsQuery.error || logsQuery.error || logMeasuresQuery.error || opsQuery.error,
    refetch: async () => {
      await Promise.all([
        targetsQuery.refetch(),
        logsQuery.refetch(),
        logMeasuresQuery.refetch(),
        opsQuery.refetch(),
      ]);
    },
    createTarget,
    updateTarget,
    deleteTarget,
  };
}
