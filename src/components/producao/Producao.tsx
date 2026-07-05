import { useCallback, useEffect } from 'react';
import { AlertCircle, ClipboardList, Factory, History, PackageSearch } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { usePermissions } from '@/hooks/usePermissions';
import { useProducao } from '@/hooks/useProducao';
import { FormApontamentoProducao } from './FormApontamentoProducao';
import { HistoricoApontamentosProducao } from './HistoricoApontamentosProducao';
import { MateriaisProjetoProducao } from './MateriaisProjetoProducao';

export const Producao = () => {
  const {
    tarefas,
    membrosProducao,
    apontamentos,
    loading,
    listarTarefas,
    listarMembrosProducao,
    listarApontamentos,
    criarApontamento,
    editarApontamento,
    cancelarApontamento,
    conferirApontamento,
    listarMembros,
  } = useProducao();
  const { locaisUtilizacao } = useConfiguracoes();
  const {
    canApontarProducao,
    canConferirProducao,
    canViewBIProducao,
    canConfigurarProducao,
  } = usePermissions();

  const podeApontar = canApontarProducao();
  const podeConferir = canConferirProducao();
  const podeAcessar =
    podeApontar ||
    podeConferir ||
    canViewBIProducao() ||
    canConfigurarProducao();

  const carregarDados = useCallback(async () => {
    await Promise.all([
      listarTarefas(),
      listarMembrosProducao(),
      listarApontamentos(),
    ]);
  }, [listarApontamentos, listarMembrosProducao, listarTarefas]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  if (!podeAcessar) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Acesso não autorizado</AlertTitle>
        <AlertDescription>
          Seu perfil não possui permissões para acessar o Módulo de Produção.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Factory className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Produção</h2>
            <p className="text-sm text-muted-foreground">
              Apontamentos produtivos e referências operacionais por projeto.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue={podeApontar ? 'apontamento' : 'historico'} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
          <TabsTrigger value="apontamento" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Apontamento
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="materiais" className="gap-2">
            <PackageSearch className="h-4 w-4" />
            Materiais do Projeto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="apontamento" className="mt-5">
          <FormApontamentoProducao
            tarefas={tarefas}
            locais={locaisUtilizacao}
            membros={membrosProducao}
            podeApontar={podeApontar}
            criarApontamento={criarApontamento}
            editarApontamento={editarApontamento}
            onSuccess={carregarDados}
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-5">
          <HistoricoApontamentosProducao
            apontamentos={apontamentos}
            tarefas={tarefas}
            locais={locaisUtilizacao}
            membros={membrosProducao}
            loading={loading}
            podeApontar={podeApontar}
            podeConferir={podeConferir}
            listarMembros={listarMembros}
            editarApontamento={editarApontamento}
            criarApontamento={criarApontamento}
            cancelarApontamento={cancelarApontamento}
            conferirApontamento={conferirApontamento}
            recarregar={carregarDados}
          />
        </TabsContent>

        <TabsContent value="materiais" className="mt-5">
          <MateriaisProjetoProducao
            locais={locaisUtilizacao}
            podeRegistrar={podeApontar}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
