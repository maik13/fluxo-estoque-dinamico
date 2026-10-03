/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, FolderKanban, LayoutGrid, List, Loader2, RefreshCw } from "lucide-react";
import { appControleSupabase } from "@/integrations/appcontrole/client";
import { supabase } from "@/integrations/supabase/client";
import { AppControleSessionGate } from "@/components/integracoes/AppControleSessionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Progress } from "@/components/ui/progress";

const ac = appControleSupabase as any;
const fluxo = supabase as any;

const n = (value: unknown) => Number(value || 0);
const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();


const percent = (produced: number, planned: number) =>
  planned > 0 ? Math.min(100, Math.max(0, produced / planned * 100)) : null;

async function readAll(makeQuery: () => any) {
  const data: any[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const result = await makeQuery().range(offset, offset + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    data.push(...(result.data || []));
    if ((result.data || []).length < pageSize) return { data, error: null };
  }
}

function ProgressIndicator({ value }: { value: number | null }) {
  return <div className="flex items-center gap-3">
    <Progress value={value ?? 0} className="h-2 flex-1" aria-label="Progresso da produção" />
    <span className="min-w-12 text-right text-sm font-semibold">{value === null ? "Sem meta" : `${Math.round(value)}%`}</span>
  </div>;
}

function calculateOpProduction(op: any, logs: any[]) {
  return logs.filter((log: any) =>
    normalize(log.atividade) === "FIM" &&
    (String(log.ordem_producao_id || "") === String(op.id) ||
      (!log.ordem_producao_id && normalize(log.codigo_op) === normalize(op.codigo_op) &&
        String(log.project_setting_id || "") === String(op.project_setting_id || "")))
  ).reduce((sum: number, log: any) => sum + n(log.total || log.qtd_produzida), 0);
}

type Project = { id: string; name: string };

async function loadOverview() {
  const [projectsResult, opsResult, actualsResult, targetsResult, logsResult] = await Promise.all([
    readAll(() => ac.from("settings").select("id, valor, ordem").eq("tipo", "projeto").eq("ativo", true).order("ordem").order("id")),
    readAll(() => ac.from("ordens_producao").select("id, project_setting_id, projeto, codigo_op, quantidade_planejada, status_op").order("id")),
    readAll(() => ac.from("project_production_actuals").select("project_setting_id, quantidade_produzida, ciclos, perdas").order("id")),
    readAll(() => ac.from("project_production_targets").select("id, project_setting_id, projeto").eq("ativo", true).order("id")),
    readAll(() => ac.from("production_logs").select("id, project_setting_id, ordem_producao_id, codigo_op, atividade, total, qtd_produzida").order("id")),
  ]);

  for (const result of [projectsResult, opsResult, actualsResult, targetsResult, logsResult]) {
    if (result.error) throw result.error;
  }

  const projects: Project[] = (projectsResult.data || []).map((row: any) => ({
    id: String(row.id),
    name: String(row.valor || "Projeto"),
  }));

  const rows = projects.map((project) => {
    const ops = (opsResult.data || []).filter((row: any) => String(row.project_setting_id || "") === project.id);
    const actuals = (actualsResult.data || []).filter((row: any) => String(row.project_setting_id || "") === project.id);
    const targets = (targetsResult.data || []).filter((row: any) =>
      String(row.project_setting_id || "") === project.id ||
      (!row.project_setting_id && normalize(row.projeto) === normalize(project.name)),
    );
    const plannedOps = ops.filter((op: any) => !normalize(op.status_op).startsWith("CANCEL") && n(op.quantidade_planejada) > 0);
    const planned = plannedOps.reduce((sum: number, op: any) => sum + n(op.quantidade_planejada), 0);
    const completed = plannedOps.reduce((sum: number, op: any) =>
      sum + Math.min(n(op.quantidade_planejada), Math.max(0, calculateOpProduction(op, logsResult.data || []))), 0);
    return {
      ...project,
      progress: percent(completed, planned),
      opCount: ops.length,
      produzido: actuals.reduce((sum: number, row: any) => sum + n(row.quantidade_produzida), 0),
      ciclos: actuals.reduce((sum: number, row: any) => sum + n(row.ciclos), 0),
      perdas: actuals.reduce((sum: number, row: any) => sum + n(row.perdas), 0),
      targetCount: targets.length,
    };
  });

  return rows;
}

async function loadProjectDetail(project: Project) {
  const [opsResult, logsResult, targetsResult, fluxoProjectResult] = await Promise.all([
    readAll(() => ac
      .from("ordens_producao")
      .select("id, codigo_op, processo, status_op, quantidade_planejada, created_at")
      .eq("project_setting_id", project.id)
      .order("created_at", { ascending: true }).order("id")),
    readAll(() => ac
      .from("production_logs")
      .select("id, ordem_producao_id, codigo_op, processo, atividade, total, qtd_produzida, quantity_loss")
      .eq("project_setting_id", project.id).order("id")),
    readAll(() => ac
      .from("project_production_targets")
      .select("id, descricao, quantidade_meta, unidade, processo_apuracao, projeto, project_setting_id")
      .eq("ativo", true)
      .eq("project_setting_id", project.id).order("id")),
    fluxo
      .from("producao_projetos")
      .select("id, nome, status, cliente, local_utilizacao_id")
      .ilike("nome", project.name)
      .is("excluido_em", null)
      .limit(1),
  ]);

  if (opsResult.error) throw opsResult.error;
  if (logsResult.error) throw logsResult.error;
  if (targetsResult.error) throw targetsResult.error;
  if (fluxoProjectResult.error) throw fluxoProjectResult.error;

  const logs = logsResult.data || [];
  const ops = (opsResult.data || []).map((op: any) => {
    const opLogs = logs.filter((log: any) =>
      String(log.ordem_producao_id || "") === String(op.id) ||
      (!log.ordem_producao_id && normalize(log.codigo_op) === normalize(op.codigo_op)),
    );
    const finished = opLogs.filter((log: any) => normalize(log.atividade) === "FIM");
    return {
      ...op,
      produzido: finished.reduce(
        (sum: number, row: any) => sum + n(row.total || row.qtd_produzida),
        0,
      ),
      perdas: finished.reduce((sum: number, row: any) => sum + n(row.quantity_loss), 0),
      ciclos: finished.length,
    };
  });

  const fluxoProject = fluxoProjectResult.data?.[0] || null;
  let fluxoOps: any[] = [];
  let fluxoApontamentos: any[] = [];

  if (fluxoProject?.id) {
    const [fluxoOpsResult, fluxoAptsResult] = await Promise.all([
      fluxo
        .from("producao_ordens_producao")
        .select("id, numero, descricao, status, quantidade_planejada, processo_id")
        .eq("projeto_id", fluxoProject.id)
        .order("numero", { ascending: true }),
      fluxo
        .from("producao_apontamentos")
        .select("id, ordem_producao_id, quantidade_produzida, status")
        .eq("projeto_local_id", fluxoProject.local_utilizacao_id)
        .neq("status", "cancelado"),
    ]);
    if (!fluxoOpsResult.error) fluxoOps = fluxoOpsResult.data || [];
    if (!fluxoAptsResult.error) fluxoApontamentos = fluxoAptsResult.data || [];
  }

  return {
    ops,
    targets: targetsResult.data || [],
    fluxoProject,
    fluxoOps,
    fluxoProduzido: fluxoApontamentos.reduce((sum: number, row: any) => sum + n(row.quantidade_produzida), 0),
  };
}

function Inner() {
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<"cards" | "lista">(() => {
    try { return localStorage.getItem("acompanhamento-pedido-visualizacao") === "lista" ? "lista" : "cards"; }
    catch { return "cards"; }
  });
  useEffect(() => {
    try { localStorage.setItem("acompanhamento-pedido-visualizacao", view); } catch { /* Storage unavailable. */ }
  }, [view]);
  const overview = useQuery({
    queryKey: ["integracao-appcontrole-acompanhamento-overview"],
    queryFn: loadOverview,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const selectedProject = useMemo(
    () => overview.data?.find((project: any) => project.id === selectedId) || null,
    [overview.data, selectedId],
  );

  const detail = useQuery({
    queryKey: ["integracao-appcontrole-acompanhamento-detail", selectedProject?.id],
    queryFn: () => loadProjectDetail(selectedProject as Project),
    enabled: !!selectedProject,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  if (overview.isLoading) {
    return <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando pedidos...</div>;
  }

  if (overview.error) {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{String((overview.error as any)?.message || overview.error)}</div>;
  }

  if (!selectedProject) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
          <h2 className="text-xl font-semibold">Acompanhamento do Pedido</h2>
          <p className="text-sm text-muted-foreground">Projetos do App Controle apresentados nativamente dentro do Fluxo de Estoque.</p>
          </div>
          <div className="flex gap-1 rounded-lg border p-1" role="group" aria-label="Visualização dos pedidos">
            <Button size="sm" variant={view === "cards" ? "default" : "ghost"} aria-pressed={view === "cards"} onClick={() => setView("cards")}><LayoutGrid className="mr-2 h-4 w-4" />Cards</Button>
            <Button size="sm" variant={view === "lista" ? "default" : "ghost"} aria-pressed={view === "lista"} onClick={() => setView("lista")}><List className="mr-2 h-4 w-4" />Lista</Button>
          </div>
        </div>
        {view === "lista" ? (
          <div className="space-y-2">
            {(overview.data || []).map((project: any) => (
              <button key={project.id} type="button" onClick={() => setSelectedId(project.id)} className="flex w-full flex-wrap items-center gap-4 rounded-lg border bg-card p-4 text-left hover:border-primary/60">
                <FolderKanban className="h-8 w-8 shrink-0 text-primary" />
                <div className="min-w-0 flex-1"><div className="font-semibold">{project.name}</div><div className="text-xs text-muted-foreground">{project.opCount} OPs · {project.produzido.toLocaleString("pt-BR")} produzido · {project.targetCount} metas</div></div>
                <div className="w-full sm:w-64"><ProgressIndicator value={project.progress} /></div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {(overview.data || []).map((project: any) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setSelectedId(project.id)}
              className="group rounded-xl border bg-card p-4 text-left transition hover:border-primary/60 hover:bg-primary/[0.03]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary"><FolderKanban className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{project.name}</div>
                    <Badge className="mt-1" variant={project.produzido > 0 ? "default" : "secondary"}>
                      {project.opCount === 0 ? "Sem OP" : project.produzido > 0 ? "Em produção" : "OP criada"}
                    </Badge>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-muted-foreground">OPs</div><div className="font-semibold">{project.opCount}</div></div>
                <div><div className="text-muted-foreground">Produzido</div><div className="font-semibold">{project.produzido.toLocaleString("pt-BR")}</div></div>
                <div><div className="text-muted-foreground">Metas</div><div className="font-semibold">{project.targetCount}</div></div>
              </div>
              <div className="mt-4"><ProgressIndicator value={project.progress} /></div>
            </button>
          ))}
        </div>
        )}
        {!(overview.data || []).length && <p className="py-8 text-center text-muted-foreground">Nenhum pedido encontrado.</p>}
      </div>
    );
  }

  const totalApp = (detail.data?.ops || []).reduce((sum: number, op: any) => sum + n(op.produzido), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedId("")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar aos pedidos</Button>
        <Button variant="outline" size="sm" onClick={() => void Promise.all([overview.refetch(), detail.refetch()])}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle>{selectedProject.name}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div><div className="text-xs text-muted-foreground">OPs App Controle</div><div className="text-2xl font-semibold">{detail.data?.ops.length || 0}</div></div>
          <div><div className="text-xs text-muted-foreground">Produzido App Controle</div><div className="text-2xl font-semibold">{totalApp.toLocaleString("pt-BR")}</div></div>
          <div><div className="text-xs text-muted-foreground">Metas</div><div className="text-2xl font-semibold">{detail.data?.targets.length || 0}</div></div>
          <div>
            <div className="text-xs text-muted-foreground">Fluxo de Estoque</div>
            <div className="mt-1">{detail.data?.fluxoProject ? <Badge variant="outline">Projeto localizado</Badge> : <Badge variant="secondary">Sem vínculo por nome</Badge>}</div>
          </div>
        </CardContent>
      </Card>

      {detail.data?.fluxoProject && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Contexto do Fluxo de Estoque</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div><div className="text-xs text-muted-foreground">Projeto</div><div className="font-medium">{detail.data.fluxoProject.nome}</div></div>
            <div><div className="text-xs text-muted-foreground">OPs no Fluxo</div><div className="font-medium">{detail.data.fluxoOps.length}</div></div>
            <div><div className="text-xs text-muted-foreground">Produção apontada no Fluxo</div><div className="font-medium">{detail.data.fluxoProduzido.toLocaleString("pt-BR")}</div></div>
          </CardContent>
        </Card>
      )}

      {detail.error && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{String((detail.error as any)?.message || detail.error)}</div>}
      <div className="overflow-hidden rounded-lg border">
        <div className="border-b bg-muted/20 px-4 py-3"><div className="font-semibold">Execução das OPs — App Controle</div></div>
        {detail.isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>OP</TableHead><TableHead>Processo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Planejado</TableHead><TableHead className="text-right">Produzido</TableHead><TableHead className="text-right">Ciclos</TableHead><TableHead>Progresso</TableHead></TableRow></TableHeader>
            <TableBody>
              {(detail.data?.ops || []).map((op: any) => (
                <TableRow key={op.id}>
                  <TableCell className="font-medium">{op.codigo_op}</TableCell>
                  <TableCell>{op.processo || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{op.status_op || "—"}</Badge></TableCell>
                  <TableCell className="text-right">{n(op.quantidade_planejada).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-semibold">{n(op.produzido).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{op.ciclos}</TableCell><TableCell className="min-w-48"><ProgressIndicator value={percent(n(op.produzido), n(op.quantidade_planejada))} /></TableCell>
                </TableRow>
              ))}
              {!detail.isLoading && !(detail.data?.ops || []).length && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma OP vinculada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

export function AcompanhamentoPedidoIntegrado() {
  return (
    <AppControleSessionGate moduleName="Acompanhamento do Pedido">
      <Inner />
    </AppControleSessionGate>
  );
}
