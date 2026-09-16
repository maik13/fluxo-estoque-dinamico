import { ArrowLeft, BarChart3, Factory, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    <div className="space-y-4">
      <style>{`
        .gerencial-producao-analises #bi-producao-impressao > div:first-child h2 {
          font-size: 0 !important;
        }
        .gerencial-producao-analises #bi-producao-impressao > div:first-child h2::after {
          content: 'Gerencial de Produção';
          font-size: 1.5rem;
          line-height: 2rem;
          font-weight: 700;
        }
      `}</style>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 p-2.5">
            <Factory className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Gerencial de Produção</h2>
            <p className="text-sm text-muted-foreground">
              Visão executiva ao vivo e análises detalhadas da operação.
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

      <Tabs defaultValue="visao" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="visao" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Visão ao vivo
          </TabsTrigger>
          <TabsTrigger value="analises" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Análises
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="mt-0">
          <PainelProjetosProducaoAoVivo />
        </TabsContent>

        <TabsContent value="analises" className="gerencial-producao-analises mt-0">
          <PainelProducaoGerencial locais={locais} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
