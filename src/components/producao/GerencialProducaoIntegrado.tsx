import { ArrowLeft, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LocalUtilizacaoConfig } from '@/hooks/useConfiguracoes';
import { PainelProjetosProducaoAoVivo } from './PainelProjetosProducaoAoVivo';
import { PainelProducaoGerencial } from './PainelProducaoGerencial';

interface GerencialProducaoIntegradoProps {
  locais: LocalUtilizacaoConfig[];
  onVoltar?: () => void;
}

export const GerencialProducaoIntegrado = ({
  locais,
  onVoltar,
}: GerencialProducaoIntegradoProps) => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 p-2.5">
            <Factory className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Gerencial de Produção</h2>
            <p className="text-sm text-muted-foreground">
              Acompanhamento executivo ao vivo e análises detalhadas da Produção.
            </p>
          </div>
        </div>
        {onVoltar && (
          <Button variant="outline" onClick={onVoltar}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Gerencial
          </Button>
        )}
      </div>

      <PainelProjetosProducaoAoVivo />

      <div className="border-t pt-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Análises detalhadas</h3>
          <p className="text-sm text-muted-foreground">
            Filtros, fotos, materiais, mão de obra e demais indicadores permanecem disponíveis abaixo.
          </p>
        </div>
        <PainelProducaoGerencial locais={locais} />
      </div>
    </div>
  );
};
