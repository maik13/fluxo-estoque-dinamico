import { AppControleSessionGate } from "@/components/integracoes/AppControleSessionGate";
import { PlanejamentoV2App } from "@/planejamento-v2-original/PlanejamentoV2App";

/** Planejamento 2.0 dentro do Fluxo: o mesmo módulo do App Controle, no banco oficial dele. */
export function Planejamento2Integrado() {
  return (
    <AppControleSessionGate moduleName="Planejamento 2.0">
      <PlanejamentoV2App />
    </AppControleSessionGate>
  );
}
