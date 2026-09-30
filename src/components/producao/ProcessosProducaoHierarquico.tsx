import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  FolderKanban,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import { useProcessosProducao } from '@/hooks/useProcessosProducao';
import { useOrdensProducao } from '@/hooks/useOrdensProducao';
import type {
  ProducaoMembro,
  ProducaoOrdemProducao,
  ProducaoProcesso,
  ProducaoProjeto,
  ProducaoTarefa,
} from '@/types/producao';
import { FormEditarOrdemProducao } from './FormEditarOrdemProducao';

interface Props {
  tarefas: ProducaoTarefa[];
  membros: ProducaoMembro[];
  onFecharJornada: (contexto: any) => void;
}

const statusProjeto = (etapas: ProducaoProcesso[]) => {
  if (etapas.length === 0) return 'Sem etapas';
  if (etapas.every((item) => item.status === 'finalizado')) return 'Concluído';
  if (etapas.some((item) => ['em_andamento', 'pausado', 'bloqueado'].includes(item.status))) {
    return 'Em andamento';
  }
  return 'Planejado';
};

const nomeSeguro = (valor: unknown, fallback = 'Sem nome') => {
  if (typeof valor === 'string' && valor.trim()) return valor.trim();
  return fallback;
};

const pertenceAoProjeto = (
  processo: ProducaoProcesso,
  projeto: ProducaoProjeto,
) =>
  processo.projeto_id === projeto.config_id ||
  processo.projeto_id === projeto.id ||
  processo.projeto?.local_utilizacao_id === projeto.local_utilizacao_id;

export const ProcessosProducaoHierarquico = ({
  tarefas: _tarefas,
  membros: _membros,
  onFecharJornada: _onFecharJornada,
}: Props) => {
  const [busca, setBusca] = useState('');
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState<string | null>(null);
  const [processoSelecionadoId, setProcessoSelecionadoId] = useState<string | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const { canConfigurarProducao } = usePermissions();
  const { projetos, listarProjetos } = useProjetosProducao();
  const { processos, listarProcessos } = useProcessosProducao();
  const { ordens, listarOrdens } = useOrdensProducao();

  const carregar = async () => {
    setCarregando(true);
    setErroCarregamento(null);
    try {
      await Promise.all([
        listarProjetos(),
        listarProcessos(),
        listarOrdens(),
      ]);
    } catch (error) {
      console.error('[Etapas] erro ao carregar dados:', error);
      setErroCarregamento(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os dados de Produção.',
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const ordensPorProcesso = useMemo(() => {
    const mapa = new Map<string, ProducaoOrdemProducao[]>();
    for (const ordem of Array.isArray(ordens) ? ordens : []) {
      if (!ordem?.processo_id) continue;
      const lista = mapa.get(ordem.processo_id) ?? [];
      lista.push(ordem);
      mapa.set(ordem.processo_id, lista);
    }
    return mapa;
  }, [ordens]);

  const projetosSeguros = useMemo(
    () => (Array.isArray(projetos) ? projetos.filter(Boolean) : []),
    [projetos],
  );

  const processosSeguros = useMemo(
    () => (Array.isArray(processos) ? processos.filter(Boolean) : []),
    [processos],
  );

  const projetosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');

    return projetosSeguros.filter((projeto) => {
      if (!termo) return true;
      return [
        projeto.nome,
        projeto.grupo_nome,
        projeto.cliente,
        projeto.cidade,
        projeto.uf,
      ].some((valor) =>
        String(valor ?? '').toLocaleLowerCase('pt-BR').includes(termo),
      );
    });
  }, [busca, projetosSeguros]);

  const projetoSelecionado =
    projetosSeguros.find((item) => item.id === projetoSelecionadoId) ?? null;

  const etapasProjeto = projetoSelecionado
    ? processosSeguros.filter((processo) =>
        pertenceAoProjeto(processo, projetoSelecionado),
      )
    : [];

  const processoSelecionado =
    etapasProjeto.find((item) => item.id === processoSelecionadoId) ?? null;

  const ordensEtapa = processoSelecionado
    ? ordensPorProcesso.get(processoSelecionado.id) ?? []
    : [];

  if (carregando && projetosSeguros.length === 0) {
    return (
      <div className="rounded-xl border p-10 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Carregando projetos e OPs...
      </div>
    );
  }

  if (erroCarregamento && projetosSeguros.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
        <p className="font-semibold text-destructive">
          Não foi possível carregar a Produção.
        </p>
        <p className="text-sm text-muted-foreground">{erroCarregamento}</p>
        <Button variant="outline" onClick={() => void carregar()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (processoSelecionado && projetoSelecionado) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProcessoSelecionadoId(null);
              setProjetoSelecionadoId(null);
            }}
          >
            Projetos
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProcessoSelecionadoId(null)}
          >
            {nomeSeguro(projetoSelecionado.nome)}
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {nomeSeguro(processoSelecionado.nome, 'Etapa')}
          </span>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">
            {nomeSeguro(processoSelecionado.codigo, 'Etapa')}
          </p>
          <h3 className="mt-1 text-xl font-semibold">
            {nomeSeguro(processoSelecionado.nome, 'Etapa')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {ordensEtapa.length} OP(s)
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Ordens de Produção</h4>

          {ordensEtapa.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhuma OP cadastrada nesta etapa.
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {ordensEtapa.map((ordem) => (
                <div
                  key={ordem.id}
                  className="rounded-xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        OP {String(ordem.numero ?? '').padStart(6, '0')}
                      </p>
                      <p className="mt-1 text-sm">
                        {nomeSeguro(
                          ordem.tarefa_nome_snapshot || ordem.descricao,
                          'Atividade sem descrição',
                        )}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Status: {nomeSeguro(ordem.status, 'não informado')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Quantidade: {Number(ordem.quantidade_realizada ?? 0)} de{' '}
                        {Number(ordem.quantidade_planejada ?? 0)}{' '}
                        {ordem.unidade_medida ?? ''}
                      </p>
                    </div>

                    {canConfigurarProducao() && (
                      <FormEditarOrdemProducao
                        ordem={ordem}
                        onSuccess={carregar}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (projetoSelecionado) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProjetoSelecionadoId(null);
              setProcessoSelecionadoId(null);
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar aos projetos
          </Button>

          <Button variant="outline" size="sm" onClick={() => void carregar()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-5">
          {projetoSelecionado.grupo_nome && (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {nomeSeguro(projetoSelecionado.grupo_nome)}
            </p>
          )}
          <h3 className="mt-1 text-xl font-semibold">
            {nomeSeguro(projetoSelecionado.nome)}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {projetoSelecionado.cidade
              ? `${projetoSelecionado.cidade}${projetoSelecionado.uf ? `/${projetoSelecionado.uf}` : ''}`
              : 'Local não informado'}
          </p>
          <p className="mt-2 text-sm">
            {etapasProjeto.length} etapa(s)
          </p>
        </div>

        <div>
          <h4 className="mb-3 font-semibold">Etapas do projeto</h4>
          {etapasProjeto.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Este projeto não possui etapas cadastradas.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {etapasProjeto.map((processo) => {
                const ops = ordensPorProcesso.get(processo.id) ?? [];
                return (
                  <button
                    key={processo.id}
                    type="button"
                    onClick={() => setProcessoSelecionadoId(processo.id)}
                    className="rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/50"
                  >
                    <p className="text-xs text-muted-foreground">
                      {nomeSeguro(processo.codigo, 'Etapa')}
                    </p>
                    <h5 className="mt-1 font-semibold">
                      {nomeSeguro(processo.nome, 'Etapa')}
                    </h5>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{nomeSeguro(processo.status, 'não informado')}</span>
                      <span>{ops.length} OP(s)</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h3 className="text-lg font-medium">Etapas de Produção</h3>
          <p className="text-sm text-muted-foreground">
            Selecione um projeto para abrir suas etapas e editar as OPs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void carregar()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar projeto, cliente ou cidade..."
          className="pl-8"
        />
      </div>

      {projetosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          <FolderKanban className="mx-auto mb-3 h-9 w-9 opacity-50" />
          Nenhum projeto encontrado.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projetosFiltrados.map((projeto) => {
            const etapas = processosSeguros.filter((processo) =>
              pertenceAoProjeto(processo, projeto),
            );
            const ops = etapas.flatMap(
              (etapa) => ordensPorProcesso.get(etapa.id) ?? [],
            );

            return (
              <button
                key={projeto.id}
                type="button"
                onClick={() => {
                  setProjetoSelecionadoId(projeto.id);
                  setProcessoSelecionadoId(null);
                }}
                className="rounded-xl border bg-card p-5 text-left shadow-sm transition hover:border-primary/50"
              >
                {projeto.grupo_nome && (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {nomeSeguro(projeto.grupo_nome)}
                  </p>
                )}
                <h4 className="mt-1 text-lg font-semibold">
                  {nomeSeguro(projeto.nome)}
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {projeto.cidade
                    ? `${projeto.cidade}${projeto.uf ? `/${projeto.uf}` : ''}`
                    : 'Local não informado'}
                </p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span>{etapas.length} etapa(s) · {ops.length} OP(s)</span>
                  <span>{statusProjeto(etapas)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
