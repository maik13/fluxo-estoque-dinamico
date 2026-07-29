import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  CheckCircle,
  Clock,
  Pause,
  Play,
  RotateCcw,
  Search,
  Trash2,
  Unlock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/usePermissions';
import { useOrdensProducao, formatarNumeroOrdemProducao } from '@/hooks/useOrdensProducao';
import { useProcessosProducao, type ResumoExclusaoProcessoProducao } from '@/hooks/useProcessosProducao';
import { FormProcessoProducao } from './FormProcessoProducao';
import { FormRetificarProcesso } from './FormRetificarProcesso';
import { FormOrdemProducao } from './FormOrdemProducao';
import { MateriaisEtapaProducao } from './MateriaisEtapaProducao';
import { MateriaisOrdemProducao } from './MateriaisOrdemProducao';
import { ModalFinalizarProcesso } from './ModalFinalizarProcesso';
import { ModalExcluirProcesso } from './ModalExcluirProcesso';
import type { ProducaoOrdemProducao, ProducaoProcesso } from '@/types/producao';

const pedirJustificativa = (texto: string) => {
  const valor = window.prompt(texto);
  return valor?.trim() || null;
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

export const ProcessosProducao = () => {
  const [busca, setBusca] = useState('');
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const [processoParaFinalizar, setProcessoParaFinalizar] = useState<ProducaoProcesso | null>(null);
  const [processoParaExcluir, setProcessoParaExcluir] = useState<ProducaoProcesso | null>(null);
  const [resumoExclusao, setResumoExclusao] = useState<ResumoExclusaoProcessoProducao | null>(null);
  const [carregandoResumoExclusao, setCarregandoResumoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
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
  const {
    ordens,
    listarOrdens,
    criarOrdem,
    transicaoOrdem,
  } = useOrdensProducao();

  useEffect(() => {
    void Promise.all([listarProcessos(), listarOrdens()]);
  }, [listarOrdens, listarProcessos]);

  const ordensPorProcesso = useMemo(() => ordens.reduce<Record<string, ProducaoOrdemProducao[]>>((acc, ordem) => {
    acc[ordem.processo_id] = acc[ordem.processo_id] ?? [];
    acc[ordem.processo_id].push(ordem);
    return acc;
  }, {}), [ordens]);

  const processosFiltrados = useMemo(() => processos.filter((p) => {
    const aberto = ['planejado', 'em_andamento', 'pausado', 'bloqueado'].includes(p.status);
    if (!mostrarEncerrados && !aberto) return false;
    const termo = busca.toLowerCase();
    return [p.codigo, p.nome, p.projeto?.nome, p.projeto?.cidade, p.projeto?.uf]
      .filter(Boolean)
      .some((valor) => String(valor).toLowerCase().includes(termo));
  }), [busca, mostrarEncerrados, processos]);

  const executarComJustificativa = async (
    processo: ProducaoProcesso,
    acao: 'pausar' | 'bloquear' | 'desbloquear' | 'cancelar' | 'reabrir',
    pergunta: string,
  ) => {
    const justificativa = pedirJustificativa(pergunta);
    if (!justificativa) return;
    try {
      await transicaoProcesso(processo.id, acao, justificativa);
    } catch (error) {
      toast.error(mensagemErro(error, `Não foi possível ${acao} a etapa.`));
    }
  };

  const executarAcaoOp = async (
    ordem: ProducaoOrdemProducao,
    acao: 'iniciar' | 'concluir' | 'cancelar' | 'reabrir',
  ) => {
    let justificativa: string | null = null;
    if (acao === 'cancelar' || acao === 'reabrir') {
      justificativa = pedirJustificativa(`Justificativa para ${acao} ${formatarNumeroOrdemProducao(ordem.numero)}:`);
      if (!justificativa) return;
    }
    if (acao === 'concluir' && ordem.quantidade_realizada < ordem.quantidade_planejada) {
      justificativa = pedirJustificativa('A quantidade realizada é menor que a planejada. Informe a justificativa para concluir:');
      if (!justificativa) return;
    }
    try {
      await transicaoOrdem(ordem.id, acao, justificativa);
      await listarProcessos();
      toast.success(`${formatarNumeroOrdemProducao(ordem.numero)} atualizada.`);
    } catch (error) {
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
      toast.error(mensagemErro(error, 'Não foi possível preparar a exclusão da etapa.'));
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
      toast.success(`Etapa ${processoParaExcluir.codigo} excluída e registrada na auditoria.`);
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
            A Etapa organiza o planejamento. As OPs são emitidas dentro dela e recebem os apontamentos da execução.
          </p>
        </div>
        <FormProcessoProducao onSuccess={() => void listarProcessos()} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código, etapa, projeto ou cidade..." className="pl-8" />
        </div>
        <Button variant="outline" onClick={() => setMostrarEncerrados((v) => !v)}>
          {mostrarEncerrados ? 'Ocultar encerradas' : 'Mostrar encerradas'}
        </Button>
      </div>

      {loading ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">Carregando etapas...</div>
      ) : processosFiltrados.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground"><Activity className="mx-auto mb-3 h-8 w-8 opacity-50" />Nenhuma etapa encontrada.</div>
      ) : (
        <div className="grid gap-4">
          {processosFiltrados.map((processo) => {
            const ordensDaEtapa = ordensPorProcesso[processo.id] ?? [];
            const etapaAberta = ['planejado', 'em_andamento', 'pausado', 'bloqueado'].includes(processo.status);
            return (
              <div key={processo.id} className="rounded-lg border bg-card p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 sm:flex-row">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-2 py-1 text-xs font-medium">{processo.codigo}</span>
                      <h4 className="text-lg font-semibold">{processo.nome}</h4>
                      <span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold">{processo.status.replace('_', ' ')}</span>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{processo.prioridade}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Projeto: <span className="font-medium text-foreground">{processo.projeto?.nome ?? '—'}</span>
                      {processo.projeto?.cidade ? ` · ${processo.projeto.cidade}/${processo.projeto.uf ?? ''}` : ''}
                    </p>
                    {processo.descricao && <p className="text-sm text-muted-foreground">{processo.descricao}</p>}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Criada em {new Date(processo.created_at).toLocaleString('pt-BR')}</span>
                      {processo.data_inicio_real && <span>Iniciada em {new Date(`${processo.data_inicio_real}T12:00:00`).toLocaleDateString('pt-BR')}</span>}
                      <span>{ordensDaEtapa.length} OP(s) emitida(s)</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {etapaAberta && canConfigurarProducao() && (
                      <FormRetificarProcesso
                        processo={processo}
                        temOps={ordensDaEtapa.length > 0}
                        onSuccess={async () => {
                          await Promise.all([listarProcessos(), listarOrdens()]);
                        }}
                      />
                    )}
                    {etapaAberta && (
                      <FormOrdemProducao processo={processo} ordens={ordens} onEmitir={criarOrdem} />
                    )}
                    {processo.status === 'planejado' && <Button size="sm" onClick={() => void transicaoProcesso(processo.id, 'iniciar')}><Play className="mr-2 h-4 w-4" />Iniciar etapa</Button>}
                    {processo.status === 'em_andamento' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => void executarComJustificativa(processo, 'pausar', 'Justificativa para pausar a etapa:')}><Pause className="mr-2 h-4 w-4" />Pausar</Button>
                        <Button size="sm" variant="outline" onClick={() => void executarComJustificativa(processo, 'bloquear', 'Justificativa para bloquear a etapa:')}><Ban className="mr-2 h-4 w-4" />Bloquear</Button>
                        <Button size="sm" onClick={() => setProcessoParaFinalizar(processo)}><CheckCircle className="mr-2 h-4 w-4" />Finalizar etapa</Button>
                      </>
                    )}
                    {processo.status === 'pausado' && <Button size="sm" onClick={() => void transicaoProcesso(processo.id, 'retomar')}><Play className="mr-2 h-4 w-4" />Retomar</Button>}
                    {processo.status === 'bloqueado' && <Button size="sm" onClick={() => void executarComJustificativa(processo, 'desbloquear', 'Justificativa para desbloquear a etapa:')}><Unlock className="mr-2 h-4 w-4" />Desbloquear</Button>}
                    {etapaAberta && <Button size="sm" variant="destructive" onClick={() => void executarComJustificativa(processo, 'cancelar', 'Justificativa para cancelar a etapa:')}>Cancelar</Button>}
                    {['finalizado', 'cancelado'].includes(processo.status) && <Button size="sm" variant="outline" onClick={() => void executarComJustificativa(processo, 'reabrir', 'Justificativa para reabrir a etapa:')}><RotateCcw className="mr-2 h-4 w-4" />Reabrir</Button>}
                    {isAdmin() && (
                      <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => void abrirExclusao(processo)}>
                        <Trash2 className="mr-2 h-4 w-4" />Excluir
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
                    <p className="text-sm font-medium">Ordens de Produção da etapa</p>
                    <p className="text-xs text-muted-foreground">Os apontamentos alimentam o progresso de cada OP.</p>
                  </div>
                  {ordensDaEtapa.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma OP emitida. A etapa ainda não está liberada operacionalmente para apontamentos planejados.</p>
                  ) : (
                    <div className="space-y-3">
                      {ordensDaEtapa.map((ordem) => (
                        <div key={ordem.id} className="rounded-lg border bg-muted/10 p-4">
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{formatarNumeroOrdemProducao(ordem.numero)}</span>
                                <span className="rounded-full border px-2 py-0.5 text-xs">{statusOpLabel[ordem.status] ?? ordem.status}</span>
                                <span className="text-xs text-muted-foreground">{ordem.local_tipo}</span>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {ordem.quantidade_realizada} de {ordem.quantidade_planejada} {ordem.unidade_medida ?? ''} · {ordem.percentual_realizado}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(`${ordem.data_inicio_prevista}T12:00:00`).toLocaleDateString('pt-BR')} a {new Date(`${ordem.data_fim_prevista}T12:00:00`).toLocaleDateString('pt-BR')}
                                {ordem.responsavel_nome_snapshot ? ` · Responsável: ${ordem.responsavel_nome_snapshot}` : ''}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {ordem.status === 'liberada' && <Button size="sm" onClick={() => void executarAcaoOp(ordem, 'iniciar')}><Play className="mr-2 h-4 w-4" />Iniciar OP</Button>}
                              {ordem.status === 'em_execucao' && <Button size="sm" onClick={() => void executarAcaoOp(ordem, 'concluir')}><CheckCircle className="mr-2 h-4 w-4" />Concluir OP</Button>}
                              {['liberada', 'em_execucao'].includes(ordem.status) && <Button size="sm" variant="outline" onClick={() => void executarAcaoOp(ordem, 'cancelar')}>Cancelar OP</Button>}
                              {['concluida', 'cancelada'].includes(ordem.status) && <Button size="sm" variant="outline" onClick={() => void executarAcaoOp(ordem, 'reabrir')}><RotateCcw className="mr-2 h-4 w-4" />Reabrir OP</Button>}
                            </div>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ordem.percentual_realizado)}%` }} />
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

      <ModalFinalizarProcesso
        processo={processoParaFinalizar}
        obterResumo={obterResumoFinalizacao}
        onClose={() => setProcessoParaFinalizar(null)}
        onConfirm={async (justificativa) => {
          if (!processoParaFinalizar) return;
          await transicaoProcesso(processoParaFinalizar.id, 'finalizar', justificativa);
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
