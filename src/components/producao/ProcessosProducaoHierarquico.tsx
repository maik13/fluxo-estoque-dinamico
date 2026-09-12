import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  FolderKanban,
  Loader2,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import {
  useProcessosProducao,
  type ResumoExclusaoProcessoProducao,
} from '@/hooks/useProcessosProducao';
import {
  formatarIdentificacaoOrdemProducao,
  useOrdensProducao,
} from '@/hooks/useOrdensProducao';
import {
  finalizarOrdemProducaoComConferencia,
  FinalizacaoParcialOrdemProducaoError,
} from '@/services/producao/finalizarOrdemProducao';
import type {
  ProducaoOrdemProducao,
  ProducaoProcesso,
  ProducaoProjeto,
  ProducaoTarefa,
} from '@/types/producao';
import { FormEditarOrdemProducao } from './FormEditarOrdemProducao';
import { FormOrdemProducao } from './FormOrdemProducao';
import { FormProcessoProducao } from './FormProcessoProducao';
import { FormRetificarProcesso } from './FormRetificarProcesso';
import { MateriaisEtapaProducao } from './MateriaisEtapaProducao';
import { MateriaisOrdemProducao } from './MateriaisOrdemProducao';
import { ModalExcluirProcesso } from './ModalExcluirProcesso';
import { ModalFinalizarProcesso } from './ModalFinalizarProcesso';

interface Props {
  tarefas: ProducaoTarefa[];
}

const statusEtapaLabel: Record<string, string> = {
  planejado: 'Planejada',
  em_andamento: 'Em andamento',
  pausado: 'Pausada',
  bloqueado: 'Bloqueada',
  finalizado: 'Concluída',
  cancelado: 'Cancelada',
};

const statusOpLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  liberada: 'Liberada',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const statusProjetoClassName = (status: string) => {
  if (status === 'Em andamento') {
    return 'border-primary/30 bg-primary/10 text-primary';
  }
  if (status === 'Concluído') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  }
  return 'border-border/70 bg-muted/40 text-muted-foreground';
};

const formatarData = (data: string | null | undefined) =>
  data
    ? new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR')
    : 'Não definida';

const clampPercent = (valor: number) => Math.max(0, Math.min(100, Math.round(valor)));

const BarraProgresso = ({ valor }: { valor: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
    <div
      className="h-full rounded-full bg-primary transition-all"
      style={{ width: `${clampPercent(valor)}%` }}
    />
  </div>
);

const pertenceAoProjeto = (processo: ProducaoProcesso, projeto: ProducaoProjeto) =>
  processo.projeto_id === projeto.config_id ||
  processo.projeto?.local_utilizacao_id === projeto.local_utilizacao_id;

const progressoEtapa = (
  processo: ProducaoProcesso,
  ordens: ProducaoOrdemProducao[],
) => {
  if (processo.status === 'finalizado') return 100;
  if (processo.status === 'cancelado') return 0;
  const validas = ordens.filter((ordem) => ordem.status !== 'cancelada');
  if (validas.length === 0) return 0;
  return clampPercent(
    validas.reduce(
      (soma, ordem) => soma + Number(ordem.percentual_realizado || 0),
      0,
    ) / validas.length,
  );
};

export const ProcessosProducaoHierarquico = ({ tarefas }: Props) => {
  const [busca, setBusca] = useState('');
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false);
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState<string | null>(null);
  const [processoSelecionadoId, setProcessoSelecionadoId] = useState<string | null>(null);
  const [processoParaFinalizar, setProcessoParaFinalizar] = useState<ProducaoProcesso | null>(null);
  const [processoParaExcluir, setProcessoParaExcluir] = useState<ProducaoProcesso | null>(null);
  const [resumoExclusao, setResumoExclusao] = useState<ResumoExclusaoProcessoProducao | null>(null);
  const [carregandoResumoExclusao, setCarregandoResumoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [executandoId, setExecutandoId] = useState<string | null>(null);
  const [projetosComImagem, setProjetosComImagem] = useState<Set<string>>(new Set());

  const { isAdmin, canConfigurarProducao } = usePermissions();
  const { projetos, loading: loadingProjetos, listarProjetos } = useProjetosProducao();
  const {
    processos,
    loading: loadingProcessos,
    listarProcessos,
    transicaoProcesso,
    obterResumoFinalizacao,
    obterResumoExclusao,
    excluirProcesso,
  } = useProcessosProducao();
  const { ordens, listarOrdens, criarOrdem, transicaoOrdem } = useOrdensProducao();

  const recarregar = async () => {
    await Promise.all([listarProjetos(), listarProcessos(), listarOrdens()]);
  };

  useEffect(() => {
    void recarregar().catch(() => undefined);
  }, []);

  useEffect(() => {
    const carregarProjetosComImagem = async () => {
      const { data: anexos, error: anexosError } = await supabase
        .from('producao_apontamento_anexos')
        .select('apontamento_id');

      if (anexosError || !anexos?.length) {
        setProjetosComImagem(new Set());
        return;
      }

      const apontamentoIds = [...new Set(anexos.map((anexo) => anexo.apontamento_id).filter(Boolean))];
      if (apontamentoIds.length === 0) {
        setProjetosComImagem(new Set());
        return;
      }

      const { data: apontamentos, error: apontamentosError } = await supabase
        .from('producao_apontamentos')
        .select('id,projeto_local_id')
        .in('id', apontamentoIds)
        .not('projeto_local_id', 'is', null);

      if (apontamentosError) return;

      setProjetosComImagem(
        new Set(
          (apontamentos ?? [])
            .map((apontamento) => apontamento.projeto_local_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
    };

    void carregarProjetosComImagem().catch(() => undefined);
  }, []);

  const ordensPorProcesso = useMemo(
    () =>
      ordens.reduce<Record<string, ProducaoOrdemProducao[]>>((acc, ordem) => {
        acc[ordem.processo_id] = acc[ordem.processo_id] ?? [];
        acc[ordem.processo_id].push(ordem);
        return acc;
      }, {}),
    [ordens],
  );

  const resumosProjetos = useMemo(
    () =>
      projetos.map((projeto) => {
        const etapas = processos.filter((processo) => pertenceAoProjeto(processo, projeto));
        const etapasValidas = etapas.filter((processo) => processo.status !== 'cancelado');
        const ops = etapas.flatMap((etapa) => ordensPorProcesso[etapa.id] ?? []);
        const concluido =
          etapasValidas.length > 0 &&
          etapasValidas.every((processo) => processo.status === 'finalizado');
        const iniciado = etapasValidas.some((processo) =>
          ['em_andamento', 'pausado', 'bloqueado', 'finalizado'].includes(processo.status),
        );
        const percentual =
          etapasValidas.length === 0
            ? 0
            : clampPercent(
                etapasValidas.reduce(
                  (soma, etapa) =>
                    soma + progressoEtapa(etapa, ordensPorProcesso[etapa.id] ?? []),
                  0,
                ) / etapasValidas.length,
              );
        const datasInicioReal = etapasValidas
          .map((etapa) => etapa.data_inicio_real)
          .filter((data): data is string => Boolean(data))
          .sort();
        const datasFimReal = etapasValidas
          .map((etapa) => etapa.data_fim_real)
          .filter((data): data is string => Boolean(data))
          .sort();

        return {
          projeto,
          etapas,
          ops,
          percentual,
          status: concluido ? 'Concluído' : iniciado ? 'Em andamento' : 'Planejado',
          dataInicioReal: datasInicioReal[0] ?? null,
          dataFimReal: concluido ? datasFimReal.at(-1) ?? null : null,
        };
      }),
    [ordensPorProcesso, processos, projetos],
  );

  const projetosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return resumosProjetos.filter((resumo) => {
      if (!mostrarConcluidos && resumo.status === 'Concluído') return false;
      if (!termo) return true;
      return [
        resumo.projeto.nome,
        resumo.projeto.grupo_nome,
        resumo.projeto.cliente,
        resumo.projeto.cidade,
        resumo.projeto.uf,
      ]
        .filter(Boolean)
        .some((valor) =>
          String(valor).toLocaleLowerCase('pt-BR').includes(termo),
        );
    });
  }, [busca, mostrarConcluidos, resumosProjetos]);

  const resumoProjetoSelecionado = resumosProjetos.find(
    (resumo) => resumo.projeto.id === projetoSelecionadoId,
  );
  const processoSelecionado = processos.find(
    (processo) => processo.id === processoSelecionadoId,
  );

  const voltarProjetos = () => {
    setProcessoSelecionadoId(null);
    setProjetoSelecionadoId(null);
  };

  const voltarEtapas = () => setProcessoSelecionadoId(null);

  const executarEtapa = async (
    processo: ProducaoProcesso,
    acao: 'iniciar' | 'pausar' | 'retomar' | 'desbloquear' | 'reabrir',
  ) => {
    const precisaJustificativa = ['pausar', 'desbloquear', 'reabrir'].includes(acao);
    const justificativa = precisaJustificativa
      ? window.prompt('Informe a justificativa para esta alteração:')?.trim()
      : undefined;
    if (precisaJustificativa && !justificativa) return;

    setExecutandoId(processo.id);
    try {
      await transicaoProcesso(processo.id, acao, justificativa);
      await recarregar();
      toast.success(`Etapa ${processo.codigo} atualizada.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar a etapa.');
    } finally {
      setExecutandoId(null);
    }
  };

  const finalizarEtapa = async (justificativa: string) => {
    if (!processoParaFinalizar) return;
    await transicaoProcesso(processoParaFinalizar.id, 'finalizar', justificativa);
    setProcessoParaFinalizar(null);
    await recarregar();
    toast.success('Etapa finalizada. O status global do projeto foi recalculado.');
  };

  const executarOp = async (
    ordem: ProducaoOrdemProducao,
    acao: 'iniciar' | 'concluir' | 'cancelar' | 'reabrir',
  ) => {
    setExecutandoId(ordem.id);
    try {
      if (acao === 'concluir') {
        try {
          await finalizarOrdemProducaoComConferencia(ordem.id, null);
        } catch (error) {
          if (!(error instanceof FinalizacaoParcialOrdemProducaoError)) throw error;
          const motivo = window.prompt('A produção ficará parcial. Informe o motivo para finalizar a OP:')?.trim();
          if (!motivo) return;
          await finalizarOrdemProducaoComConferencia(ordem.id, motivo);
        }
      } else {
        const precisaJustificativa = ['cancelar', 'reabrir'].includes(acao);
        const justificativa = precisaJustificativa
          ? window.prompt('Informe a justificativa para esta alteração da OP:')?.trim()
          : null;
        if (precisaJustificativa && !justificativa) return;
        await transicaoOrdem(ordem.id, acao, justificativa);
      }
      await recarregar();
      toast.success(`${formatarIdentificacaoOrdemProducao(ordem)} atualizada.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar a OP.');
    } finally {
      setExecutandoId(null);
    }
  };

  const abrirExclusao = async (processo: ProducaoProcesso) => {
    setProcessoParaExcluir(processo);
    setResumoExclusao(null);
    setCarregandoResumoExclusao(true);
    try {
      setResumoExclusao(await obterResumoExclusao(processo.id));
    } catch (error) {
      setProcessoParaExcluir(null);
      toast.error(error instanceof Error ? error.message : 'Não foi possível preparar a exclusão.');
    } finally {
      setCarregandoResumoExclusao(false);
    }
  };

  const confirmarExclusao = async (codigo: string, justificativa: string) => {
    if (!processoParaExcluir) return;
    setExcluindo(true);
    try {
      await excluirProcesso(processoParaExcluir.id, codigo, justificativa);
      setProcessoParaExcluir(null);
      setResumoExclusao(null);
      setProcessoSelecionadoId(null);
      await recarregar();
      toast.success('Etapa excluída.');
    } finally {
      setExcluindo(false);
    }
  };

  if (processoSelecionado && resumoProjetoSelecionado) {
    const ordensDaEtapa = ordensPorProcesso[processoSelecionado.id] ?? [];
    const etapaAberta = ['planejado', 'em_andamento', 'pausado', 'bloqueado'].includes(
      processoSelecionado.status,
    );
    const percentualEtapa = progressoEtapa(processoSelecionado, ordensDaEtapa);

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={voltarProjetos}>
            Projetos
          </Button>
          <ChevronRight className="h-4 w-4" />
          <Button variant="ghost" size="sm" onClick={voltarEtapas}>
            {resumoProjetoSelecionado.projeto.nome}
          </Button>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">{processoSelecionado.nome}</span>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-muted px-2 py-1 text-xs font-semibold">
                  {processoSelecionado.codigo}
                </span>
                <h3 className="text-xl font-semibold">{processoSelecionado.nome}</h3>
                <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">
                  {statusEtapaLabel[processoSelecionado.status] ?? processoSelecionado.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {resumoProjetoSelecionado.projeto.nome} · {ordensDaEtapa.length} OP(s)
              </p>
              <div className="max-w-xl space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progresso da etapa</span>
                  <span>{percentualEtapa}%</span>
                </div>
                <BarraProgresso valor={percentualEtapa} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {etapaAberta && canConfigurarProducao() && (
                <FormRetificarProcesso
                  processo={processoSelecionado}
                  temOps={ordensDaEtapa.length > 0}
                  onSuccess={recarregar}
                />
              )}
              {etapaAberta && (
                <FormOrdemProducao
                  processo={processoSelecionado}
                  ordens={ordens}
                  tarefas={tarefas}
                  onEmitir={criarOrdem}
                />
              )}
              {processoSelecionado.status === 'planejado' && (
                <Button size="sm" onClick={() => void executarEtapa(processoSelecionado, 'iniciar')}>
                  <Play className="mr-2 h-4 w-4" /> Iniciar etapa
                </Button>
              )}
              {processoSelecionado.status === 'em_andamento' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => void executarEtapa(processoSelecionado, 'pausar')}>
                    <Pause className="mr-2 h-4 w-4" /> Pausar
                  </Button>
                  <Button size="sm" onClick={() => setProcessoParaFinalizar(processoSelecionado)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar etapa
                  </Button>
                </>
              )}
              {processoSelecionado.status === 'pausado' && (
                <Button size="sm" onClick={() => void executarEtapa(processoSelecionado, 'retomar')}>
                  <Play className="mr-2 h-4 w-4" /> Retomar
                </Button>
              )}
              {processoSelecionado.status === 'bloqueado' && (
                <Button size="sm" onClick={() => void executarEtapa(processoSelecionado, 'desbloquear')}>
                  <Play className="mr-2 h-4 w-4" /> Desbloquear
                </Button>
              )}
              {['finalizado', 'cancelado'].includes(processoSelecionado.status) && (
                <Button variant="outline" size="sm" onClick={() => void executarEtapa(processoSelecionado, 'reabrir')}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reabrir etapa
                </Button>
              )}
              {isAdmin() && (
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => void abrirExclusao(processoSelecionado)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Início previsto</p>
              <p className="font-semibold">{formatarData(processoSelecionado.data_inicio_prevista ?? processoSelecionado.data_inicio_desejada)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Término previsto</p>
              <p className="font-semibold">{formatarData(processoSelecionado.data_fim_prevista ?? processoSelecionado.data_limite)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">OPs</p>
              <p className="font-semibold">{ordensDaEtapa.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Prioridade</p>
              <p className="font-semibold capitalize">{processoSelecionado.prioridade}</p>
            </div>
          </div>

          <MateriaisEtapaProducao
            processo={processoSelecionado}
            podeEditar={etapaAberta && canConfigurarProducao()}
          />
        </div>

        <div>
          <h4 className="mb-3 text-base font-semibold">Ordens de Produção</h4>
          {ordensDaEtapa.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhuma OP emitida para esta etapa.
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {ordensDaEtapa.map((ordem) => (
                <div key={ordem.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{formatarIdentificacaoOrdemProducao(ordem)}</span>
                        <span className="rounded-full border px-2 py-0.5 text-xs">
                          {statusOpLabel[ordem.status] ?? ordem.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {ordem.quantidade_realizada} de {ordem.quantidade_planejada} {ordem.unidade_medida ?? ''}
                      </p>
                      <BarraProgresso valor={Number(ordem.percentual_realizado || 0)} />
                      <p className="text-xs text-muted-foreground">
                        {formatarData(ordem.data_inicio_prevista)} → {formatarData(ordem.data_fim_prevista)}
                        {ordem.responsavel_nome_snapshot ? ` · ${ordem.responsavel_nome_snapshot}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                      {canConfigurarProducao() && (
                        <FormEditarOrdemProducao ordem={ordem} onSuccess={recarregar} />
                      )}
                      {ordem.status === 'liberada' && (
                        <Button size="sm" onClick={() => void executarOp(ordem, 'iniciar')} disabled={executandoId === ordem.id}>
                          {executandoId === ordem.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                          Iniciar OP
                        </Button>
                      )}
                      {ordem.status === 'em_execucao' && (
                        <Button size="sm" onClick={() => void executarOp(ordem, 'concluir')} disabled={executandoId === ordem.id}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar OP
                        </Button>
                      )}
                      {['concluida', 'cancelada'].includes(ordem.status) && (
                        <Button variant="outline" size="sm" onClick={() => void executarOp(ordem, 'reabrir')} disabled={executandoId === ordem.id}>
                          <RotateCcw className="mr-2 h-4 w-4" /> Reabrir
                        </Button>
                      )}
                      {['liberada', 'em_execucao'].includes(ordem.status) && (
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => void executarOp(ordem, 'cancelar')} disabled={executandoId === ordem.id}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                  <MateriaisOrdemProducao ordem={ordem} />
                </div>
              ))}
            </div>
          )}
        </div>

        <ModalFinalizarProcesso
          processo={processoParaFinalizar}
          onClose={() => setProcessoParaFinalizar(null)}
          onConfirm={finalizarEtapa}
          obterResumo={obterResumoFinalizacao}
        />
        <ModalExcluirProcesso
          processo={processoParaExcluir}
          resumo={resumoExclusao}
          carregandoResumo={carregandoResumoExclusao}
          excluindo={excluindo}
          onClose={() => {
            setProcessoParaExcluir(null);
            setResumoExclusao(null);
          }}
          onConfirm={confirmarExclusao}
        />
      </div>
    );
  }

  if (resumoProjetoSelecionado) {
    const { projeto, etapas, ops, percentual, status, dataInicioReal, dataFimReal } =
      resumoProjetoSelecionado;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={voltarProjetos}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos projetos
          </Button>
          <FormProcessoProducao onSuccess={() => void recarregar()} />
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              {projeto.grupo_nome && (
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {projeto.grupo_nome}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold">{projeto.nome}</h3>
                <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">{status}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {projeto.cidade ? `${projeto.cidade}${projeto.uf ? `/${projeto.uf}` : ''}` : 'Local não informado'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Progresso global</p>
              <p className="text-2xl font-bold">{percentual}%</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Etapas</p>
              <p className="text-lg font-semibold">{etapas.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">OPs</p>
              <p className="text-lg font-semibold">{ops.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Início previsto</p>
              <p className="font-semibold">{formatarData(projeto.data_inicio_prevista)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Término previsto</p>
              <p className="font-semibold">{formatarData(projeto.data_fim_prevista)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Execução real</p>
              <p className="font-semibold">
                {dataInicioReal ? formatarData(dataInicioReal) : 'Não iniciada'}
                {dataFimReal ? ` → ${formatarData(dataFimReal)}` : ''}
              </p>
            </div>
          </div>
          <div className="mt-4"><BarraProgresso valor={percentual} /></div>
        </div>

        <div>
          <h4 className="mb-3 text-base font-semibold">Etapas do projeto</h4>
          {etapas.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Este projeto ainda não possui etapas.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {etapas.map((processo) => {
                const opsEtapa = ordensPorProcesso[processo.id] ?? [];
                const opsValidas = opsEtapa.filter((ordem) => ordem.status !== 'cancelada');
                const opsConcluidas = opsValidas.filter(
                  (ordem) => ordem.status === 'concluida',
                ).length;
                const percentualEtapa = progressoEtapa(processo, opsEtapa);
                return (
                  <button
                    key={processo.id}
                    type="button"
                    onClick={() => setProcessoSelecionadoId(processo.id)}
                    className="rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/50 hover:bg-muted/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{processo.codigo}</p>
                        <h5 className="mt-1 font-semibold">{processo.nome}</h5>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{statusEtapaLabel[processo.status] ?? processo.status}</span>
                      <span>{opsValidas.length} OP(s)</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {opsConcluidas} de {opsValidas.length} OP(s) concluída(s)
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Progresso</span><span>{percentualEtapa}%</span>
                      </div>
                      <BarraProgresso valor={percentualEtapa} />
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
      <div>
        <h3 className="text-lg font-medium">Etapas de Produção</h3>
        <p className="text-sm text-muted-foreground">
          Selecione primeiro o projeto. Dentro dele você verá as etapas e, depois, as OPs.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar projeto, cliente ou cidade..."
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={() => setMostrarConcluidos((valor) => !valor)}>
          {mostrarConcluidos ? 'Ocultar concluídos' : 'Mostrar concluídos'}
        </Button>
      </div>

      {loadingProjetos || loadingProcessos ? (
        <div className="rounded-xl border p-10 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Carregando projetos...
        </div>
      ) : projetosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          <FolderKanban className="mx-auto mb-3 h-9 w-9 opacity-50" />
          Nenhum projeto encontrado.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projetosFiltrados.map((resumo) => {
            const { projeto, etapas, ops, percentual, status, dataInicioReal, dataFimReal } = resumo;
            const possuiImagem = projetosComImagem.has(projeto.local_utilizacao_id);

            return (
              <div
                key={projeto.id}
                role="button"
                tabIndex={0}
                onClick={() => setProjetoSelecionadoId(projeto.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') setProjetoSelecionadoId(projeto.id);
                }}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/[0.04] p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {projeto.grupo_nome && (
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {projeto.grupo_nome}
                      </p>
                    )}
                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <h4 className="truncate text-lg font-semibold tracking-tight">{projeto.nome}</h4>
                      {possuiImagem && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary"
                              aria-label="Este projeto possui imagens vinculadas"
                            >
                              <Camera className="h-3.5 w-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Este projeto possui imagens vinculadas.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {projeto.cidade ? `${projeto.cidade}${projeto.uf ? `/${projeto.uf}` : ''}` : 'Local não informado'}
                      </span>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusProjetoClassName(status)}`}>
                    {status}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/70 bg-background/40 px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Etapas</span>
                      <FolderKanban className="h-3.5 w-3.5 text-muted-foreground/70" />
                    </div>
                    <p className="mt-1 text-xl font-bold tracking-tight">{etapas.length}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/40 px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">OPs</span>
                      <span className="text-xs font-medium text-muted-foreground/70">#</span>
                    </div>
                    <p className="mt-1 text-xl font-bold tracking-tight">{ops.length}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-border/70 bg-muted/15 p-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-muted-foreground">Progresso geral</span>
                    <span className="text-lg font-bold leading-none text-primary">{percentual}%</span>
                  </div>
                  <BarraProgresso valor={percentual} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-border/60 bg-background/30 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" /> Início
                    </div>
                    <p className="font-semibold">{formatarData(projeto.data_inicio_prevista)}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/30 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" /> Término
                    </div>
                    <p className="font-semibold">{formatarData(projeto.data_fim_prevista)}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3 border-t border-border/50 pt-3">
                  <div className="min-w-0">
                    {dataInicioReal ? (
                      <p className="truncate text-xs text-muted-foreground">
                        Execução real: {formatarData(dataInicioReal)}{dataFimReal ? ` → ${formatarData(dataFimReal)}` : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/70">Execução ainda não iniciada</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
                    Abrir projeto <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};