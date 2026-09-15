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
  const podeVerGerencialProducao = canViewBIProducao();

  // Quando o usuário tem acesso ao gerencial do almoxarifado, o próprio
  // PainelGerencial funciona como a tela de entrada: inicialmente exibe
  // somente os dois cards de acesso e só carrega conteúdo após a escolha.
  if (podeVerGerencialAlmoxarifado) {
    return <PainelGerencial />;
  }

  // Usuários com acesso exclusivo à produção entram diretamente no
  // respectivo gerencial, sem misturar dados do almoxarifado.
  if (podeVerGerencialProducao) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 p-2.5">
            <BarChart3 className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Gerencial de Produção</h2>
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
