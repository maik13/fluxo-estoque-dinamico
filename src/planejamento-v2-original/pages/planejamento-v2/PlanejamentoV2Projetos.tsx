// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/planejamento-v2-original/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight,
  CalendarRange,
  FolderKanban,
  GanttChartSquare,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  useCreatePlanejamentoV2Workspace,
  usePlanejamentoV2Projects,
} from "@/planejamento-v2-original/hooks/usePlanejamentoV2";
import { useUserPermissions } from "@/planejamento-v2-original/hooks/useUserPermissions";
import { supabase } from "@/planejamento-v2-original/supabaseClient";

type PhaseSetup = { name: string; location: string; teamSize: string };
const DEFAULT_PHASES: PhaseSetup[] = [
  { name: "Usina", location: "", teamSize: "" },
  { name: "Montagem", location: "", teamSize: "" },
  { name: "Instalação", location: "", teamSize: "" },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  paused: "Pausado",
  completed: "Concluído",
  archived: "Arquivado",
};

function formatDateTime(value?: string | null) {
  if (!value) return "Sem atualização registrada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function PlanejamentoV2Projetos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [phases, setPhases] = useState<PhaseSetup[]>(DEFAULT_PHASES);
  const { data, isLoading, error } = usePlanejamentoV2Projects();
  const createWorkspace = useCreatePlanejamentoV2Workspace();
  const { hasPermission, isAdmin } = useUserPermissions();

  const canEdit =
    isAdmin ||
    hasPermission("planejamento_v2_edit") ||
    hasPermission("planejamento_v2_admin");

  useEffect(() => {
    if (searchParams.get("novo") !== "1") return;
    setNewDialogOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("novo");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const plannedProjectIds = useMemo(
    () => new Set((data?.workspaces || []).map((workspace) => workspace.appProjectSettingId)),
    [data?.workspaces],
  );

  const availableProjects = useMemo(
    () => (data?.projects || []).filter((project) => !plannedProjectIds.has(project.id)),
    [data?.projects, plannedProjectIds],
  );

  const workspaceByProjectId = useMemo(
    () => new Map((data?.workspaces || []).map((workspace) => [workspace.appProjectSettingId, workspace])),
    [data?.workspaces],
  );

  const projectEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return (data?.projects || [])
      .map((project) => ({
        project,
        workspace: workspaceByProjectId.get(project.id),
      }))
      .filter(({ project }) => project.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
  }, [data?.projects, search, workspaceByProjectId]);

  const openWorkspace = (workspaceId: string) => {
    navigate(`/planejamento-2/projetos/${workspaceId}`);
  };

  const openProjectSetup = (projectId: string) => {
    setSelectedProjectId(projectId);
    setNewDialogOpen(true);
  };

  const createAndOpen = async () => {
    const project = availableProjects.find((item) => item.id === selectedProjectId);
    if (!project) return;

    const workspace = await createWorkspace.mutateAsync(project);
    const configuredPhases = phases.map((phase) => ({ name: phase.name.trim(), location: phase.location.trim(), teamSize: Number(phase.teamSize) || null })).filter((phase) => phase.name);
    const setupDescription = [teamSize && `Equipe prevista: ${teamSize} pessoa(s)`, projectLocation.trim() && `Local principal: ${projectLocation.trim()}`].filter(Boolean).join(" · ");
    const { error: setupError } = await (supabase.from("planejamento_v2_workspaces") as any).update({ description: setupDescription || null }).eq("id", workspace.id);
    if (setupError) throw setupError;
    if (configuredPhases.length) {
      const { error: phasesError } = await (supabase.from("planejamento_v2_tasks") as any).insert(configuredPhases.map((phase, index) => ({
        workspace_id: workspace.id,
        title: phase.name,
        description: [phase.location && `Local: ${phase.location}`, phase.teamSize && `Equipe prevista: ${phase.teamSize} pessoa(s)`].filter(Boolean).join(" · ") || null,
        task_type: "summary",
        status: "not_started",
        priority: "normal",
        position: (index + 1) * 1000,
        progress: 0,
      })));
      if (phasesError) throw phasesError;
    }
    setNewDialogOpen(false);
    setSelectedProjectId("");
    setTeamSize("");
    setProjectLocation("");
    setPhases(DEFAULT_PHASES);
    openWorkspace(workspace.id);
  };

  return (
    <MainLayout
      title="Planejamento 2.0"
      subtitle="Ambiente independente de planejamento vinculado aos projetos do App Controle"
    >
      <div className="space-y-5">
        <Card className="overflow-hidden border-primary/20">
          <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-3xl items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Planejamento independente</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada planejamento usa somente o cadastro corporativo do projeto. Tarefas, datas,
                  dependências e cenários ficam isolados do Planejamento atual.
                </p>
              </div>
            </div>

          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Planejamentos</h2>
            <p className="text-sm text-muted-foreground">
              Abra um ambiente existente ou crie um novo a partir de um projeto do App Controle.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar planejamento..."
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar os planejamentos</AlertTitle>
            <AlertDescription>Verifique a migration e as permissões do Planejamento 2.0.</AlertDescription>
          </Alert>
        ) : projectEntries.length ? (
          <div className="space-y-3">
            {projectEntries.map(({ project, workspace }) => (
              <Card key={project.id} className="transition-colors hover:border-primary/40">
                <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-lg border bg-muted/30 p-2.5 text-primary">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">{project.name}</h3>
                        {workspace ? (
                          <Badge variant={workspace.status === "active" ? "default" : "secondary"}>
                            {STATUS_LABELS[workspace.status] || workspace.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pronto para planejar</Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <GanttChartSquare className="h-3.5 w-3.5" />
                          {workspace
                            ? "Planejamento 2.0 vinculado ao projeto corporativo"
                            : "Projeto corporativo localizado automaticamente"}
                        </span>
                        {workspace && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarRange className="h-3.5 w-3.5" />
                            Atualizado em {formatDateTime(workspace.updatedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {workspace ? (
                    <Button onClick={() => openWorkspace(workspace.id)} className="shrink-0">
                      Abrir planejamento
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : canEdit ? (
                    <Button onClick={() => openProjectSetup(project.id)} className="shrink-0">
                      Configurar planejamento
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Badge variant="secondary">Aguardando configuração</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex min-h-60 flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary">
                <GanttChartSquare className="h-7 w-7" />
              </div>
              <h3 className="font-semibold">
                {search ? "Nenhum planejamento encontrado" : "Nenhum planejamento criado"}
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {search
                  ? "Tente outro termo de busca."
                  : "Cadastre primeiro um projeto no App Controle. Ele aparecerá aqui automaticamente."}
              </p>
              {!search && canEdit && availableProjects.length > 0 && (
                <Button className="mt-5" onClick={() => setNewDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeiro planejamento
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Novo Planejamento 2.0</DialogTitle>
            <DialogDescription>Configure o Planejamento 2.0 de um projeto já cadastrado no App Controle.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-5 overflow-y-auto py-2 pr-1">
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O projeto é cadastrado uma única vez no App Controle. Aqui você configura somente o Planejamento 2.0.
              </p>
              {!availableProjects.length && (
                <p className="text-sm text-muted-foreground">
                  Todos os projetos ativos já possuem um Planejamento 2.0.
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Quantidade prevista de pessoas</Label><Input type="number" min="1" value={teamSize} onChange={(event) => setTeamSize(event.target.value)} placeholder="Ex.: 12" /></div><div className="space-y-2"><Label>Local principal do projeto</Label><Input value={projectLocation} onChange={(event) => setProjectLocation(event.target.value)} placeholder="Cidade, obra ou unidade" /></div></div>
            <div className="space-y-3"><div><Label>Grupos/etapas do projeto</Label><p className="text-xs text-muted-foreground">Cada grupo será criado como uma tarefa-resumo e aparecerá como opção ao classificar as atividades.</p></div>{phases.map((phase, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_120px_36px]"><Input value={phase.name} onChange={(event) => setPhases((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="Nome da etapa" /><Input value={phase.location} onChange={(event) => setPhases((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, location: event.target.value } : item))} placeholder="Local da etapa" /><Input type="number" min="1" value={phase.teamSize} onChange={(event) => setPhases((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, teamSize: event.target.value } : item))} placeholder="Pessoas" /><Button type="button" variant="ghost" size="icon" onClick={() => setPhases((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</Button></div>)}<Button type="button" variant="outline" onClick={() => setPhases((current) => [...current, { name: "", location: "", teamSize: "" }])}><Plus className="mr-2 h-4 w-4" />Adicionar grupo/etapa</Button></div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={createAndOpen}
              disabled={!selectedProjectId || createWorkspace.isPending}
            >
              Criar e abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
