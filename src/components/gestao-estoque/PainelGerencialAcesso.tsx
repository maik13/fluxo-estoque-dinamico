import { BarChart3 } from 'lucide-react';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { usePermissions } from '@/hooks/usePermissions';
import { PainelProducaoGerencial } from '@/components/producao/PainelProducaoGerencial';
import { ResumoJornadaProducao } from '@/components/producao/ResumoJornadaProducao';
import { PainelGerencial } from './PainelGerencial';

export const PainelGerencialAcesso = () => {
  const { canAccessManagerial, canViewBIProducao } = usePermissions();
  const { locaisUtilizacao } = useConfiguracoes();

  const podeVerGerencialAlmoxarifado = canAccessManagerial();
  const podeVerBIProducao = canViewBIProducao();

  if (podeVerGerencialAlmoxarifado) {
    return (
      <div className="space-y-8">
        <PainelGerencial />
        {podeVerBIProducao && <ResumoJornadaProducao />}
      </div>
    );
  }

  if (podeVerBIProducao) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 p-2.5">
            <BarChart3 className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">BI Produção</h2>
            <p className="text-sm text-muted-foreground">
              Visão gerencial dos apontamentos, materiais, mão de obra, jornada e registros da produção.
            </p>
          </div>
        </div>
        <ResumoJornadaProducao />
        <PainelProducaoGerencial locais={locaisUtilizacao} />
      </div>
    );
  }

  return null;
};
