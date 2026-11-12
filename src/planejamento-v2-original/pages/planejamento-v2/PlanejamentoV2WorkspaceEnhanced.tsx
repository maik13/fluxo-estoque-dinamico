// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import PlanejamentoV2WorkspaceRecovery from "./PlanejamentoV2WorkspaceRecovery";
import PlanejamentoV2WorkspaceSync from "./PlanejamentoV2WorkspaceSync";
import "./planejamento-v2-workspace.css";

export default function PlanejamentoV2WorkspaceEnhanced() {
  return (
    <div className="planejamento-v2-workspace">
      <PlanejamentoV2WorkspaceSync>
        <PlanejamentoV2WorkspaceRecovery />
      </PlanejamentoV2WorkspaceSync>
    </div>
  );
}
