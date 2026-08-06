import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useOrdensProducao,
  formatarNumeroOrdemProducao,
} from '@/hooks/useOrdensProducao';
import {
  useProcessosProducao,
  type ResumoExclusaoProcessoProducao,
} from '@/hooks/useProcessosProducao';
import {
  finalizarOrdemProducaoComConferencia,
  FinalizacaoParcialOrdemProducaoError,
} from '@/services/producao/finalizarOrdemProducao';
import { FormProcessoProducao } from './FormProcessoProducao';
import { FormRetificarProcesso } from './FormRetificarProcesso';
import { FormOrdemProducao } from './FormOrdemProducao';
import { FormEditarOrdemProducao } from './FormEditarOrdemProducao';
import { MateriaisEtapaProducao } from './MateriaisEtapaProducao';
import { MateriaisOrdemProducao } from './MateriaisOrdemProducao';
import { ModalFinalizarProcesso } from './ModalFinalizarProcesso';
import { ModalExcluirProcesso } from './ModalExcluirProcesso';
import type {
  ProducaoOrdemProducao,
  ProducaoProcesso,
} from '@/types/producao';

type AcaoEtapaComJustificativa = 'pausar' | 'desbloquear' | 'reabrir';

type AcaoOpComJustificativa = 'concluir' | 'cancelar' | 'reabrir';

type AcaoPendente =
  | {
      tipo: 'etapa';
      processo: ProducaoProcesso;
      acao: AcaoEtapaComJustificativa;
      titulo: string;
      descricao: string;
      rotuloConfirmar: string;
      destrutiva: boolean;
    }
  | {
      tipo: 'op';
      ordem: ProducaoOrdemProducao;
      acao: AcaoOpComJustificativa;
      titulo: string;
      descricao: string;
      rotuloConfirmar: string;
      destrutiva: boolean;
    };

const mensagemErro = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const statusOpLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  liberada: 'Liberada',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const configuracaoAcaoEtapa: Record<
  AcaoEtapaComJustificativa,
  Pick<
    Extract<AcaoPendente, { tipo: 'etapa' }>,
    'titulo' | 'descricao' | 'rotuloConfirmar' | 'destrutiva'
  >
> = {
  pausar: {
    titulo: 'Pausar etapa?',
    descricao:
      'A etapa ficará temporariamente interrompida. As OPs e os registros existentes serão preservados.',
    rotuloConfirmar: 'Pausar etapa',
    destrutiva: false,
  },
  desbloquear: {
    titulo: 'Retomar etapa bloqueada?',
    descricao:
      'Esta ação recupera uma etapa que tenha sido bloqueada anteriormente e a devolve ao fluxo operacional.',
    rotuloConfirmar: 'Retomar etapa',
    destrutiva: false,
  },
  reabrir: {
    titulo: 'Reabrir etapa?',
    descricao:
      'A etapa voltará ao fluxo operacional e poderá receber novas Ordens de Produção.',
    rotuloConfirmar: 'Reabrir etapa',
    destrutiva: false,
  },
};

const configuracaoAcaoOp: Record<
  AcaoOpComJustificativa,
  Pick<
    Extract<AcaoPendente, { tipo: 'op' }>,
    'titulo' | 'descricao' | 'rotuloConfirmar' | 'destrutiva'
  >
> = {
  concluir: {
    titulo: 'Finalizar OP com produção parcial?',
    descricao:
      'Os apontamentos pendentes desta OP serão conferidos automaticamente. Como a produção confirmada continuará menor que a quantidade planejada, registre o motivo para finalizar com saldo parcial.',
    rotuloConfirmar: 'Finalizar OP',
    destrutiva: false,
  },
  cancelar: {
    titulo: 'Cancelar Ordem de Produção?',
    descricao:
      'A OP será encerrada. Apontamentos ativos precisam ser cancelados ou excluídos antes.',
    rotuloConfirmar: 'Cancelar OP',
    destrutiva: true,
  },
  reabrir: {
    titulo: 'Reabrir Ordem de Produção?',
    descricao:
      'A OP voltará para o fluxo operacional. Sem apontamentos ativos, ela será reaberta como Liberada.',
    rotuloConfirmar: 'Reabrir OP',
    destrutiva: false,
  },
};

const proximoPassoOp = (ordem: ProducaoOrdemProducao) => {
  switch (ordem.status) {
    case 'rascunho':
      return 'Revise os dados e libere a OP para iniciar a execução.';
    case 'liberada':
      return 'A OP já está criada e salva. Clique em “Iniciar OP”. Ela só aparecerá no Histórico depois do primeiro apontamento.';
    case 'em_execucao':
      return 'Registre a execução em Produção → Apontamentos. Depois clique em “Finalizar OP”; os apontamentos pendentes serão conferidos automaticamente.';
    case 'concluida':
      return 'A OP foi finalizada. Consulte os registros no Histórico apenas para rastreabilidade ou reabra a OP quando houver correção operacional.';
    case 'cancelada':
      return 'A OP está cancelada. Reabra esta OP ou emita uma nova OP.';
    default:
      return 'Consulte o status da OP antes de prosseguir.';
  }
};

export const ProcessosProducao = () => {
  const [busca, setBusca] = useState('');
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const [processoParaFinalizar, setProcessoParaFinalizar] =
    useState<ProducaoProcesso | null>(null);
  const [processoParaExcluir, setProcessoParaExcluir] =
    useState<ProducaoProcesso | null>(null);
  const [resumoExclusao, setResumoExclusao] =
    useState<ResumoExclusaoProcessoProducao | null>(null);
  const [carregandoResumoExclusao, setCarregandoResumoExclusao] =
    useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [acaoPendente, setAcaoPendente] = useState<AcaoPendente | null>(null);
  const [justificativaAcao, setJustificativaAcao] = useState('');
  const [executandoAcao, setExecutandoAcao] = useState(false);

  const { isAdmin, canConfigurarProducao } = usePermissions();
  const {
    processos,
    loading,
    listarProcessos,
    transicaoProcesso,
    obterResumoFinalizacao,
    obterResumoExclusao,
    excluirProcesso,
  } = useProcessosProducao();
  const { ordens, listarOrdens, criarOrdem, transicaoOrdem } =
    useOrdensProducao();

  useEffect(() => {
    void Promise.all([listarProcessos(), listarOrdens()]);
  }, [listarOrdens, listarProcessos]);

  const ordensPorProcesso = useMemo(
    () =>
      ordens.reduce<Record<string, ProducaoOrdemProducao[]>>((acc, ordem) => {
        acc[ordem.processo_id] = acc[ordem.processo_id] ?? [];
        acc[ordem.processo_id].push(ordem);
        return acc;
      }, {}),
    [ordens],
  );

  const processosFiltrados = useMemo(
    () =>
      processos.filter((processo) => {
        const aberto = [
          'planejado',
          'em_andamento',
          'pausado',
          'bloqueado',
        ].includes(processo.status);
        if (!mostrarEncerrados && !aberto) return false;
        const termo = busca.toLowerCase();
        return [
          processo.codigo,
          processo.nome,
          processo.projeto?.nome,
          processo.projeto?.cidade,
          processo.projeto?.uf,
        ]
          .filter(Boolean)
          .some((valor) => String(valor).toLowerCase().includes(termo));
      }),
    [busca, mostrarEncerrados, processos],
  );

  const fecharAcao = () => {
    if (executandoAcao) return;
    setAcaoPendente(null);
    setJustificativaAcao('');
  };

  const abrirAcaoEtapa = (
    processo: ProducaoProcesso,
    acao: AcaoEtapaComJustificativa,
  ) => {
    setJustificativaAcao('');
    setAcaoPendente({
      tipo: 'etapa',
      processo,
      acao,
      ...configuracaoAcaoEtapa[acao],
    });
  };

  const abrirAcaoOp = (
    ordem: ProducaoOrdemProducao,
    acao: AcaoOpComJustificativa,
  ) => {
    setJustificativaAcao('');
    setAcaoPendente({
      tipo: 'op',
      ordem,
      acao,
      ...configuracaoAcaoOp[acao],
    });
  };

  const recarregarFluxo = async () => {
    await Promise.all([listarProcessos(), listarOrdens()]);
  };

  const finalizarOp = async (
    ordem: ProducaoOrdemProducao,
    justificativa?: string | null,
  ) => {
    const resultado = await finalizarOrdemProducaoComConferencia(
      ordem.id,
      justificativa,
    );
    await recarregarFluxo();
    toast.success(
      resultado.apontamentos_conferidos > 0
        ? `${formatarNumeroOrdemProducao(ordem.numero)} finalizada. ${resultado.apontamentos_conferidos} apontamento(s) pendente(s) foram conferidos automaticamente.`
        : `${formatarNumeroOrdemProducao(ordem.numero)} finalizada.`,
    );
  };

  const confirmarAcao = async () => {
    if (!acaoPendente) return;
    const justificativa = justificativaAcao.trim();
    if (!justificativa) {
      toast.error('Informe a justificativa para continuar.');
      return;
    }

    setExecutandoAcao(true);
    try {
      if (acaoPendente.tipo === 'etapa') {
        await transicaoProcesso(
          acaoPendente.processo.id,
          acaoPendente.acao,
          justificativa,
        );
        await recarregarFluxo();
        toast.success(`Etapa ${acaoPendente.processo.codigo} atualizada.`);
      } else if (acaoPendente.acao === 'concluir') {
        await finalizarOp(acaoPendente.ordem, justificativa);
      } else {
        await transicaoOrdem(
          acaoPendente.ordem.id,
          acaoPendente.acao,
          justificativa,
        );
        await recarregarFluxo();
        toast.success(
          `${formatarNumeroOrdemProducao(acaoPendente.ordem.numero)} atualizada.`,
        );
      }

      setAcaoPendente(null);
      setJustificativaAcao('');
    } catch (error) {
      toast.error(
        mensagemErro(
          error,
          acaoPendente.tipo === 'etapa'
            ? 'Não foi possível alterar a etapa.'
            : 'Não foi possível alterar a OP.',
        ),
      );
    } finally {
      setExecutandoAcao(false);
    }
  };

  const executarEtapaDireta = async (
    processo: ProducaoProcesso,
    acao: 'iniciar' | 'retomar',
  ) => {
    try {
      await transicaoProcesso(processo.id, acao);
      await recarregarFluxo();
      toast.success(
        acao === 'iniciar'
          ? `Etapa ${processo.codigo} iniciada.`
          : `Etapa ${processo.codigo} retomada.`,
      );
    } catch (error) {
      toast.error(mensagemErro(error, 'Não foi possível alterar a etapa.'));
    }
  };

  const executarOpDireta = async (
    ordem: ProducaoOrdemProducao,
    acao: 'iniciar' | 'concluir',
  ) => {
    try {
      if (acao === 'concluir') {
        await finalizarOp(ordem, null);
        return;
      }

      await transicaoOrdem(ordem.id, acao, null);
      await recarregarFluxo();
      toast.success(
        `${formatarNumeroOrdemProducao(ordem.numero)} iniciada. Registre agora os apontamentos da execução.`,
      );
    } catch (error) {
      if (
        acao === 'concluir' &&
        error instanceof FinalizacaoParcialOrdemProducaoError
      ) {
        abrirAcaoOp(ordem, 'concluir');
        return;
      }
      toast.error(mensagemErro(error, 'Não foi possível alterar a OP.'));
    }
  };

  const abrirExclusao = async (processo: ProducaoProcesso) => {
    setProcessoParaExcluir(processo);
    setResumoExclusao(null);
    setCarregandoResumoExclusao(true);
    try {
      const resumo = await obterResumoExclusao(processo.id);
      setResumoExclusao(resumo);
    } catch (error) {
      toast.error(
        mensagemErro(error, 'Não foi possível preparar a exclusão da etapa.'),
      );
      setProcessoParaExcluir(null);
    } finally {
      setCarregandoResumoExclusao(false);
    }
  };

  const confirmarExclusao = async (codigo: string, justificativa: string) => {
    if (!processoParaExcluir) return;
    setExcluindo(true);
    try {
      await excluirProcesso(processoParaExcluir.id, codigo, justificativa);
      await listarOrdens();
      toast.success(`Etapa ${processoParaExcluir.codigo} excluída.`);
      setProcessoParaExcluir(null);
      setResumoExclusao(null);
    } catch (error) {
      toast.error(mensagemErro(error, 'Não foi possível excluir a etapa.'));
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Etapas de Produção</h3>
          <p className="text-sm text-muted-foreground">
            A Etapa organiza o planejamento. As OPs são emitidas dentro dela e
            recebem os apontamentos da execução.
          </p>
        </div>
        <FormProcessoProducao onSuccess={() => void listarProcessos()} />
      </div>

      <div className="rounded-lg border bg-muted/10 p-4">
        <p className="mb-3 text-sm font-semibold">Fluxo da Ordem de Produção</p>
        <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <span className="font-semibold">1. Emitir nova OP</span>
            <p className="text-xs text-muted-foreground">
              Cria e salva a ordem com status Liberada.
            </p>
          </div>
          <div>
            <span className="font-semibold">2. Iniciar OP</span>
            <p className="text-xs text-muted-foreground">
              Marca o início real da execução.
            </p>
          </div>
          <div>
            <span className="font-semibold">3. Criar apontamentos</span>
            <p className="text-xs text-muted-foreground">
              Registre quantidades e equipe na aba Apontamentos.
            </p>
          </div>
          <div>
            <span className="font-semibold">4. Finalizar OP</span>
            <p className="text-xs text-muted-foreground">
              Confere os apontamentos pendentes e encerra a OP na própria Etapa.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por código, etapa, projeto ou cidade..."
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setMostrarEncerrados((valor) => !valor)}
        >
          {mostrarEncerrados ? 'Ocultar encerradas' : 'Mostrar encerradas'}
        </Button>
      </div>

      {loading ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Carregando etapas...
        </div>
      ) : processosFiltrados.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <Activity className="mx-auto mb-3 h-8 w-8 opacity-50" />
          Nenhuma etapa encontrada.
        </div>
      ) : (
        <div className="grid gap-4">
          {processosFiltrados.map((processo) => {
            const ordensDaEtapa = ordensPorProcesso[processo.id] ?? [];
            const etapaAberta = [
              'planejado',
              'em_andamento',
              'pausado',
              'bloqueado',
            ].includes(processo.status);

            return (
              <div
                key={processo.id}
                className="rounded-lg border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-2 py-1 text-xs font-medium">
                        {processo.codigo}
                      </span>
                      <h4 className="text-lg font-semibold">{processo.nome}</h4>
                      <span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                        {processo.status.replace('_', ' ')}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {processo.prioridade}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Projeto:{' '}
                      <span className="font-medium text-foreground">
                        {processo.projeto?.nome ?? '—'}
                      </span>
                      {processo.projeto?.cidade
                        ? ` · ${processo.projeto.cidade}/${processo.projeto.uf ?? ''}`
                        : ''}
                    </p>
                    {processo.descricao && (
                      <p className="text-sm text-muted-foreground">
                        {processo.descricao}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Criada em{' '}
                        {new Date(processo.created_at).toLocaleString('pt-BR')}
                      </span>
                      {processo.data_inicio_real && (
                        <span>
                          Iniciada em{' '}
                          {new Date(
                            `${processo.data_inicio_real}T12:00:00`,
                          ).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      <span>{ordensDaEtapa.length} OP(s) emitida(s)</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {etapaAberta && canConfigurarProducao() && (
                      <FormRetificarProcesso
                        processo={processo}
                        temOps={ordensDaEtapa.length > 0}
                        onSuccess={async () => {
                          await recarregarFluxo();
                        }}
                      />
                    )}
                    {etapaAberta && (
                      <FormOrdemProducao
                        processo={processo}
                        ordens={ordens}
                        onEmitir={criarOrdem}
                      />
                    )}
                    {processo.status === 'planejado' && (
                      <Button
                        size="sm"
                        onClick={() =>
                          void executarEtapaDireta(processo, 'iniciar')
                        }
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Iniciar etapa
                      </Button>
                    )}
                    {processo.status === 'em_andamento' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirAcaoEtapa(processo, 'pausar')}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pausar etapa
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setProcessoParaFinalizar(processo)}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Finalizar etapa
                        </Button>
                      </>
                    )}
                    {processo.status === 'pausado' && (
                      <Button
                        size="sm"
                        onClick={() =>
                          void executarEtapaDireta(processo, 'retomar')
                        }
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Retomar etapa
                      </Button>
                    )}
                    {processo.status === 'bloqueado' && (
                      <Button
                        size="sm"
                        onClick={() => abrirAcaoEtapa(processo, 'desbloquear')}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Retomar etapa
                      </Button>
                    )}
                    {['finalizado', 'cancelado'].includes(processo.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirAcaoEtapa(processo, 'reabrir')}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reabrir etapa
                      </Button>
                    )}
                    {isAdmin() && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => void abrirExclusao(processo)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </Button>
                    )}
                  </div>
                </div>

                <MateriaisEtapaProducao
                  processo={processo}
                  podeEditar={etapaAberta && canConfigurarProducao()}
                />

                <div className="mt-4 border-t pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      Ordens de Produção da etapa
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ao finalizar a OP, os apontamentos pendentes são conferidos automaticamente.
                    </p>
                  </div>

                  {ordensDaEtapa.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Nenhuma OP emitida. Clique em “Emitir nova OP” para criar e
                      salvar a ordem antes de iniciar a execução.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {ordensDaEtapa.map((ordem) => (
                        <div
                          key={ordem.id}
                          className="rounded-lg border bg-muted/10 p-4"
                        >
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">
                                  {formatarNumeroOrdemProducao(ordem.numero)}
                                </span>
                                <span className="rounded-full border px-2 py-0.5 text-xs">
                                  {statusOpLabel[ordem.status] ?? ordem.status}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {ordem.local_tipo}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {ordem.quantidade_realizada} de{' '}
                                {ordem.quantidade_planejada}{' '}
                                {ordem.unidade_medida ?? ''} ·{' '}
                                {ordem.percentual_realizado}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(
                                  `${ordem.data_inicio_prevista}T12:00:00`,
                                ).toLocaleDateString('pt-BR')}{' '}
                                a{' '}
                                {new Date(
                                  `${ordem.data_fim_prevista}T12:00:00`,
                                ).toLocaleDateString('pt-BR')}
                                {ordem.responsavel_nome_snapshot
                                  ? ` · Responsável: ${ordem.responsavel_nome_snapshot}`
                                  : ''}
                              </p>
                              <p className="mt-3 rounded-md border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                                <strong className="text-foreground">
                                  Próximo passo:
                                </strong>{' '}
                                {proximoPassoOp(ordem)}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {['liberada', 'em_execucao'].includes(
                                ordem.status,
                              ) &&
                                canConfigurarProducao() && (
                                  <FormEditarOrdemProducao
                                    ordem={ordem}
                                    onSuccess={async () => {
                                      await recarregarFluxo();
                                    }}
                                  />
                                )}
                              {ordem.status === 'liberada' && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    void executarOpDireta(ordem, 'iniciar')
                                  }
                                >
                                  <Play className="mr-2 h-4 w-4" />
                                  Iniciar OP
                                </Button>
                              )}
                              {ordem.status === 'em_execucao' && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    void executarOpDireta(ordem, 'concluir')
                                  }
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Finalizar OP
                                </Button>
                              )}
                              {['liberada', 'em_execucao'].includes(
                                ordem.status,
                              ) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => abrirAcaoOp(ordem, 'cancelar')}
                                >
                                  Cancelar OP
                                </Button>
                              )}
                              {['concluida', 'cancelada'].includes(
                                ordem.status,
                              ) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => abrirAcaoOp(ordem, 'reabrir')}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Reabrir OP
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${Math.min(
                                  100,
                                  ordem.percentual_realizado,
                                )}%`,
                              }}
                            />
                          </div>
                          <MateriaisOrdemProducao ordem={ordem} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(acaoPendente)}
        onOpenChange={(open) => {
          if (!open) fecharAcao();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{acaoPendente?.titulo}</DialogTitle>
            <DialogDescription>{acaoPendente?.descricao}</DialogDescription>
          </DialogHeader>

          {acaoPendente && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                {acaoPendente.tipo === 'etapa' ? (
                  <>
                    <p>
                      <strong>Etapa:</strong> {acaoPendente.processo.codigo} ·{' '}
                      {acaoPendente.processo.nome}
                    </p>
                    <p>
                      <strong>Projeto:</strong>{' '}
                      {acaoPendente.processo.projeto?.nome ?? 'Não identificado'}
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <strong>Ordem de Produção:</strong>{' '}
                      {formatarNumeroOrdemProducao(acaoPendente.ordem.numero)}
                    </p>
                    <p>
                      <strong>Etapa:</strong>{' '}
                      {acaoPendente.ordem.processo_codigo} ·{' '}
                      {acaoPendente.ordem.processo_nome}
                    </p>
                  </>
                )}
              </div>

              {acaoPendente.destrutiva && (
                <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p>
                    Esta ação altera o fluxo operacional e ficará registrada na
                    rastreabilidade do sistema.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="justificativa-acao-producao">
                  Justificativa obrigatória
                </Label>
                <Textarea
                  id="justificativa-acao-producao"
                  value={justificativaAcao}
                  onChange={(event) => setJustificativaAcao(event.target.value)}
                  placeholder="Descreva o motivo desta alteração..."
                  rows={4}
                  disabled={executandoAcao}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={fecharAcao}
              disabled={executandoAcao}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant={acaoPendente?.destrutiva ? 'destructive' : 'default'}
              onClick={() => void confirmarAcao()}
              disabled={executandoAcao || !justificativaAcao.trim()}
            >
              {executandoAcao && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {acaoPendente?.rotuloConfirmar ?? 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModalFinalizarProcesso
        processo={processoParaFinalizar}
        obterResumo={obterResumoFinalizacao}
        onClose={() => setProcessoParaFinalizar(null)}
        onConfirm={async (justificativa) => {
          if (!processoParaFinalizar) return;
          await transicaoProcesso(
            processoParaFinalizar.id,
            'finalizar',
            justificativa,
          );
          setProcessoParaFinalizar(null);
        }}
      />

      <ModalExcluirProcesso
        processo={processoParaExcluir}
        resumo={resumoExclusao}
        carregandoResumo={carregandoResumoExclusao}
        excluindo={excluindo}
        onClose={() => {
          if (excluindo) return;
          setProcessoParaExcluir(null);
          setResumoExclusao(null);
        }}
        onConfirm={confirmarExclusao}
      />
    </div>
  );
};
