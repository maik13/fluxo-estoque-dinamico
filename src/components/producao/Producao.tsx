import { useCallback, useEffect } from 'react';
import { AlertCircle, ClipboardList, Factory, History, Settings, FolderOpen, Activity, BarChart, CalendarRange } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { usePermissions } from '@/hooks/usePermissions';
import { useProducao } from '@/hooks/useProducao';
import { ConfiguracoesProducao } from './ConfiguracoesProducao';
import { CronogramaProducao } from './CronogramaProducao';
import { FormApontamentoProducaoV2 } from './FormApontamentoProducaoV2';
import { HistoricoApontamentosProducaoV2 } from './HistoricoApontamentosProducaoV2';
import { PainelProducaoGerencial } from './PainelProducaoGerencial';
import { ProjetosProducao } from './ProjetosProducao';
import { ProcessosProducao } from './ProcessosProducao';

export const Producao = () => {
  const { tarefas, membrosProducao, apontamentos, loading, listarTarefas, criarTarefa, listarMembrosProducao, criarMembroProducao, editarMembroProducao, inativarMembroProducao, listarApontamentos, criarApontamento, cancelarApontamento, conferirApontamento, listarMembros } = useProducao();
  const { locaisUtilizacao } = useConfiguracoes();
  const { canApontarProducao, canConferirProducao, canViewBIProducao, canConfigurarProducao } = usePermissions();

  const podeApontar = canApontarProducao();
  const podeConferir = canConferirProducao();
  const podeConfigurar = canConfigurarProducao();
  const podeVerBI = canViewBIProducao();
  const podeAcessar = podeApontar || podeConferir || podeVerBI || podeConfigurar;

  const carregarDados = useCallback(async () => {
    await Promise.all([listarTarefas(), listarMembrosProducao(), listarApontamentos()]);
  }, [listarApontamentos, listarMembrosProducao, listarTarefas]);

  useEffect(() => { void carregarDados(); }, [carregarDados]);

  if (!podeAcessar) return <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Acesso não autorizado</AlertTitle><AlertDescription>Seu perfil não possui permissões para acessar o Módulo de Produção.</AlertDescription></Alert>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2.5"><Factory className="h-6 w-6 text-primary" /></div><div><h2 className="text-2xl font-bold">Produção</h2><p className="text-sm text-muted-foreground">Um projeto, vários locais operacionais, etapas, cronograma, execução e BI em uma única fonte.</p></div></div>
      <Tabs defaultValue="projetos" className="w-full">
        <TabsList className={`flex h-auto w-full flex-wrap gap-1 sm:grid ${podeConfigurar ? 'grid-cols-2 sm:grid-cols-4 xl:grid-cols-7' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6'}`}>
          <TabsTrigger value="projetos" className="gap-2"><FolderOpen className="h-4 w-4" /><span className="hidden sm:inline">Projetos</span></TabsTrigger>
          <TabsTrigger value="etapas" className="gap-2"><Activity className="h-4 w-4" /><span className="hidden sm:inline">Etapas</span></TabsTrigger>
          <TabsTrigger value="cronograma" className="gap-2"><CalendarRange className="h-4 w-4" /><span className="hidden sm:inline">Cronograma</span></TabsTrigger>
          <TabsTrigger value="apontamento" className="gap-2"><ClipboardList className="h-4 w-4" /><span className="hidden sm:inline">Apontamentos</span></TabsTrigger>
          <TabsTrigger value="historico" className="gap-2"><History className="h-4 w-4" /><span className="hidden sm:inline">Histórico</span></TabsTrigger>
          {podeVerBI && <TabsTrigger value="bi-producao" className="gap-2"><BarChart className="h-4 w-4" /><span className="hidden sm:inline">BI Produção</span></TabsTrigger>}
          {podeConfigurar && <TabsTrigger value="configuracoes" className="gap-2"><Settings className="h-4 w-4" /><span className="hidden sm:inline">Configurações</span></TabsTrigger>}
        </TabsList>
        <TabsContent value="projetos" className="mt-5"><ProjetosProducao /></TabsContent>
        <TabsContent value="etapas" className="mt-5"><ProcessosProducao /></TabsContent>
        <TabsContent value="cronograma" className="mt-5"><CronogramaProducao /></TabsContent>
        <TabsContent value="apontamento" className="mt-5"><FormApontamentoProducaoV2 tarefas={tarefas} locais={locaisUtilizacao} membros={membrosProducao} podeApontar={podeApontar} criarApontamento={criarApontamento} onSuccess={carregarDados} /></TabsContent>
        <TabsContent value="historico" className="mt-5"><HistoricoApontamentosProducaoV2 apontamentos={apontamentos} tarefas={tarefas} locais={locaisUtilizacao} membros={membrosProducao} loading={loading} podeConferir={podeConferir} listarMembros={listarMembros} cancelarApontamento={cancelarApontamento} conferirApontamento={conferirApontamento} recarregar={carregarDados} /></TabsContent>
        {podeVerBI && <TabsContent value="bi-producao" className="mt-5"><PainelProducaoGerencial locais={locaisUtilizacao} /></TabsContent>}
        {podeConfigurar && <TabsContent value="configuracoes" className="mt-5"><ConfiguracoesProducao membros={membrosProducao} tarefas={tarefas} listarMembros={listarMembrosProducao} criarMembro={criarMembroProducao} editarMembro={editarMembroProducao} inativarMembro={inativarMembroProducao} listarTarefas={listarTarefas} criarTarefa={criarTarefa} /></TabsContent>}
      </Tabs>
    </div>
  );
};
