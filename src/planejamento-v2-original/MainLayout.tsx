import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { PlanejamentoV2ProjectSettings } from "@/planejamento-v2-original/pages/planejamento-v2/PlanejamentoV2ProjectSettings";
import { PlanejamentoV2TimeTrackingSheet } from "@/planejamento-v2-original/pages/planejamento-v2/PlanejamentoV2TimeTrackingSheet";

interface MainLayoutProps { children: ReactNode; title: string; subtitle?: string }

/** Cabeçalho equivalente ao do App Controle, encaixado no Fluxo de Estoque. */
export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  const location = useLocation();
  const isProject = location.pathname.startsWith("/planejamento-2/projetos/");
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-6 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {isProject && (
          <div className="flex items-center gap-2">
            <PlanejamentoV2TimeTrackingSheet />
            <PlanejamentoV2ProjectSettings />
          </div>
        )}
      </header>
      <main className="workspace-main overflow-x-hidden p-6">{children}</main>
    </>
  );
}
