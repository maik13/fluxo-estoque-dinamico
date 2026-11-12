import { MemoryRouter, Navigate, Route, Routes, UNSAFE_LocationContext } from "react-router-dom";
import { PlanejamentoV2Navigation } from "@/planejamento-v2-original/pages/planejamento-v2/PlanejamentoV2Navigation";
import PlanejamentoV2Projetos from "@/planejamento-v2-original/pages/planejamento-v2/PlanejamentoV2Projetos";
import PlanejamentoV2WorkspaceEnhanced from "@/planejamento-v2-original/pages/planejamento-v2/PlanejamentoV2WorkspaceEnhanced";
import PlanejamentoV2GlobalSection from "@/planejamento-v2-original/pages/planejamento-v2/PlanejamentoV2GlobalSection";
import "@/planejamento-v2-original/pages/planejamento-v2/planejamento-v2-workspace.css";

/**
 * Planejamento 2.0 original do App Controle, com as mesmas rotas internas.
 * Roda num roteador próprio (em memória) para não interferir nas abas do Fluxo.
 */
export function PlanejamentoV2App() {
  return (
    // Reseta o contexto do roteador externo para permitir um roteador interno isolado.
    <UNSAFE_LocationContext.Provider value={null as never}>
      <MemoryRouter initialEntries={["/planejamento-2"]}>
        <Routes>
          <Route element={<PlanejamentoV2Navigation />}>
            <Route path="/planejamento-2" element={<PlanejamentoV2Projetos />} />
            <Route path="/planejamento-2/projetos/:workspaceId" element={<PlanejamentoV2WorkspaceEnhanced />} />
            <Route path="/planejamento-2/:section" element={<PlanejamentoV2GlobalSection />} />
          </Route>
          <Route path="*" element={<Navigate to="/planejamento-2" replace />} />
        </Routes>
      </MemoryRouter>
    </UNSAFE_LocationContext.Provider>
  );
}
