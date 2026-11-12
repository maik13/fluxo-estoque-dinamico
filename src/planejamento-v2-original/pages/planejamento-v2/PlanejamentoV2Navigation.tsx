// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, BriefcaseBusiness, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  FileBarChart, Folder, FolderKanban, Gauge, ListChecks, MessageSquare,
  Paperclip, Plus, Search, Settings, UserRound
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/planejamento-v2-original/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/planejamento-v2-original/supabaseClient";

const items = [
  { to: "/planejamento-2", label: "Todos os projetos", icon: Folder, end: true },
  { to: "/planejamento-2/portfolios", label: "Portfólios", icon: BriefcaseBusiness },
  { to: "/planejamento-2/minhas-tarefas", label: "Minhas tarefas", icon: ListChecks },
  { to: "/planejamento-2/registro-tempo", label: "Registro de tempo", icon: Clock3 },
  { to: "/planejamento-2/relatorios", label: "Relatórios", icon: FileBarChart },
  { to: "/planejamento-2/carga-trabalho", label: "Carga de trabalho", icon: Gauge },
  { to: "/planejamento-2/comunicacao", label: "Centro de comunicação", icon: MessageSquare },
  { to: "/planejamento-2/anexos", label: "Anexos", icon: Paperclip },
];

export function PlanejamentoV2Navigation() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  const routeWorkspaceId = location.pathname.match(/\/planejamento-2\/projetos\/([^/]+)/)?.[1];
  const queryWorkspaceId = new URLSearchParams(location.search).get("projeto") || undefined;
  const workspaceId = routeWorkspaceId || queryWorkspaceId;
  const workspaceQuery = useQuery({
    queryKey: ["planejamento-v2", "navigation-project", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("planejamento_v2_workspaces").select("project_name_snapshot").eq("id", workspaceId).single();
      if (error) throw error;
      return data as { project_name_snapshot: string };
    },
  });
  const projectBase = workspaceId ? `/planejamento-2/projetos/${workspaceId}` : "";
  const navigationItems = workspaceId ? [
    { to: projectBase, label: "Projeto aberto", icon: Folder, end: true },
    { to: `${projectBase}?aba=gantt`, label: "Diagrama de Gantt", icon: FolderKanban },
    { to: `${projectBase}?aba=list`, label: "Lista de atividades", icon: ListChecks },
    { to: `${projectBase}?aba=calendar`, label: "Calendário do projeto", icon: Clock3 },
    { to: `${projectBase}?aba=workload`, label: "Carga do projeto", icon: Gauge },
    { to: `/planejamento-2/relatorios?projeto=${workspaceId}`, label: "Relatórios do projeto", icon: FileBarChart },
    { to: `/planejamento-2/anexos?projeto=${workspaceId}`, label: "Anexos do projeto", icon: Paperclip },
  ] : items;

  return (
    <div className="planning-navigation flex min-h-[calc(100dvh-3.5rem)] w-full">
      <aside className={cn(
        "sticky top-0 hidden h-[100dvh] shrink-0 flex-col border-r bg-card transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64",
      )}>
        <div className="flex h-16 items-center justify-between border-b px-3">
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <FolderKanban className="h-5 w-5" />
                <span>{workspaceId ? (workspaceQuery.data?.project_name_snapshot || "Projeto aberto") : "Planejamento 2.0"}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {workspaceId ? "Planejamento 2.0 · projeto atual" : (user?.full_name || user?.email || "Usuário")}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="ml-auto rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {!workspaceId && <div className="p-2">
          <button
            type="button"
            onClick={() => navigate("/planejamento-2?novo=1")}
            className={cn(
              "flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90",
              collapsed ? "gap-0" : "gap-2",
            )}
            title="Configurar novo planejamento"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Novo planejamento</span>}
          </button>
        </div>}

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-1">
          {navigationItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) => cn(
                "flex items-center rounded-md px-3 py-2 text-sm transition-colors",
                collapsed ? "justify-center" : "gap-3",
                isActive ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t p-2">
          <NavLink to="/planejamento-2/notificacoes" title="Notificações" className={({ isActive }) => cn("flex items-center rounded-md px-3 py-2 text-sm", collapsed ? "justify-center" : "gap-3", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
            <Bell className="h-4 w-4" />{!collapsed && <span>Notificações</span>}
          </NavLink>
          <NavLink to="/planejamento-2/busca" title="Buscar" className={({ isActive }) => cn("flex items-center rounded-md px-3 py-2 text-sm", collapsed ? "justify-center" : "gap-3", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
            <Search className="h-4 w-4" />{!collapsed && <span>Buscar</span>}
          </NavLink>
          <NavLink to={workspaceId ? `${projectBase}?configuracoes=1` : "/planejamento-2/configuracoes"} title={workspaceId ? "Configurações do projeto" : "Configurações do Planejamento"} className={({ isActive }) => cn("flex items-center rounded-md px-3 py-2 text-sm", collapsed ? "justify-center" : "gap-3", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
            <Settings className="h-4 w-4 shrink-0" />{!collapsed && <span>{workspaceId ? "Configurações do projeto" : "Configurações do Planejamento"}</span>}
          </NavLink>
          <NavLink to="/planejamento-2/ajuda" title="Ajuda" className={({ isActive }) => cn("flex items-center rounded-md px-3 py-2 text-sm", collapsed ? "justify-center" : "gap-3", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
            <CircleHelp className="h-4 w-4" />{!collapsed && <span>Ajuda</span>}
          </NavLink>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <Outlet />
      </section>
    </div>
  );
}
