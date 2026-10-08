import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  List,
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
  ordemProducaoEDePintura,
  useOrdensProducao,
} from '@/hooks/useOrdensProducao';
import {
  finalizarOrdemProducaoComConferencia,
  FinalizacaoParcialOrdemProducaoError,
} from '@/services/producao/finalizarOrdemProducao';
import {
  iniciarJornadaOp,
  listarJornadasOpAbertas,
  type ContextoFechamentoJornadaOp,
  type JornadaOpAberta,
} from '@/services/producao/jornadasOrdemProducao';
import type {
  ProducaoMembro,
  ProducaoOrdemProducao,
  ProducaoProcesso,
  ProducaoProjeto,
  ProducaoTarefa,
} from '@/types/producao';
import { ControlesJornadaOp } from './ControlesJornadaOp';
import { FormEditarOrdemProducao } from './FormEditarOrdemProducao';
import { FormOrdemProducao } from './FormOrdemProducao';
import { FormProcessoProducao } from './FormProcessoProducao';
import { FormRetificarProcesso } from './FormRetificarProcesso';
import { MateriaisEtapaProducao } from './MateriaisEtapaProducao';
import { MateriaisOrdemProducao } from './MateriaisOrdemProducao';
import { ExcluirProjetoProducao } from './ExcluirProjetoProducao';
import { ModalExcluirProcesso } from './ModalExcluirProcesso';
import { ModalFinalizarProcesso } from './ModalFinalizarProcesso';
import {
  ModalIniciarOpComEquipe,
  type OcupacaoMembroProducao,
} from './ModalIniciarOpComEquipe';

interface Props {
  tarefas: ProducaoTarefa[];
  membros: ProducaoMembro[];
  estoqueAtivoId?: string | null;
  estoqueAtivoNome?: string | null;
  onFecharJornada: (contexto: ContextoFechamentoJornadaOp) => void;
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
  rascunho: 'A programar',
  liberada: 'Programada',
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

const formatarData = (data: string | null | undefined) => {
  if (!data) return 'Não definida';
  const dataNormalizada = data.includes('T') ? data : `${data}T12:00:00`;
  const dataConvertida = new Date(dataNormalizada);
  return Number.isNaN(dataConvertida.getTime())
    ? 'Não definida'
    : dataConvertida.toLocaleDateString('pt-BR');
};

const clampPercent = (valor: number) => Math.max(0, Math.min(100, Math.round(valor)));

const BarraProgresso = ({ valor }: { valor: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
    <div
      className="h-full rounded-full bg-primary transition-all"
      style={{ width: `${clampPercent(valor)}%` }}
    />
  </div>
);

const FotoProjetoLista = ({ caminho, nome }: { caminho?: string; nome: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    setUrl(null);
    if (caminho) {
      void supabase.storage.from('producao-apontamentos').createSignedUrl(caminho, 3600)
        .then(({ data, error }) => { if (ativo && !error) setUrl(data?.signedUrl ?? null); });
    }
    return () => { ativo = false; };
  }, [caminho]);
  return url ? <img src={url} alt={`Foto vinculada a ${nome}`} loading="lazy" onError={() => setUrl(null)} className="h-10 w-10 shrink-0 rounded-md object-cover" /> :
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted"><FolderKanban className="h-5 w-5 text-muted-foreground" /></span>;
};

const pertenceAoProjeto = (processo: ProducaoProcesso, projeto: ProducaoProjeto) =>
  processo.projeto_id === projeto.config_id ||
  processo.projeto?.local_utilizacao_id === projeto.local_utilizacao_id;

const pesoEsforcoOp = (ordem: ProducaoOrdemProducao) => {
  const esforco = Number(ordem.esforco_estimado_horas_homem || 0);
  return esforco > 0 ? esforco : 1;
};

const percentualExecucaoOp = (ordem: ProducaoOrdemProducao) =>
  ordem.status === 'concluida'
    ? 100
    : Number(ordem.percentual_realizado || 0);

const todasOpsTemEsforco = (ordens: ProducaoOrdemProducao[]) =>
  ordens.every((ordem) => Number(ordem.esforco_estimado_horas_homem || 0) > 0);

const progressoPonderadoOps = (ordens: ProducaoOrdemProducao[]) => {
  const validas = ordens.filter((ordem) => ordem.status !== 'cancelada');
  if (validas.length === 0) return 0;

  if (!todasOpsTemEsforco(validas)) {
    return clampPercent(
      validas.reduce((soma, ordem) => soma + percentualExecucaoOp(ordem), 0) /
        validas.length,
    );
  }

  const pesoTotal = validas.reduce((soma, ordem) => soma + pesoEsforcoOp(ordem), 0);
  return clampPercent(
    validas.reduce(
      (soma, ordem) =>
        soma + percentualExecucaoOp(ordem) * pesoEsforcoOp(ordem),
      0,
    ) / pesoTotal,
  );
};

const percentualProgramadoOps = (ordens: ProducaoOrdemProducao[]) => {
  const validas = ordens.filter((ordem) => ordem.status !== 'cancelada');
  if (validas.length === 0) return 0;

  const programadas = validas.filter(
    (ordem) => Boolean(ordem.data_inicio_prevista && ordem.data_fim_prevista),
  );

  if (!todasOpsTemEsforco(validas)) {
    return clampPercent((programadas.length / validas.length) * 100);
  }

  const pesoTotal = validas.reduce((soma, ordem) => soma + pesoEsforcoOp(ordem), 0);
  const pesoProgramado = programadas.reduce(
    (soma, ordem) => soma + pesoEsforcoOp(ordem),
    0,
  );
  return clampPercent((pesoProgramado / pesoTotal) * 100);
};

const progressoEtapa = (
  processo: ProducaoProcesso,
  ordens: ProducaoOrdemProducao[],
) => {
  if (processo.status === 'finalizado') return 100;
  if (processo.status === 'cancelado') return 0;
  return progressoPonderadoOps(ordens);
};

export const ProcessosProducaoHierarquico = ({
  tarefas,
  membros,
  estoqueAtivoId = null,
  estoqueAtivoNome = null,
  onFecharJornada,
}: Props) => {
  const [visualizacao, setVisualizacao] = useState<'cards' | 'lista'>(() => {
    try { return localStorage.getItem('producao-projetos-visualizacao') === 'lista' ? 'lista' : 'cards'; }
    catch { return 'cards'; }
  });
  const [projetosExpandidos, setProjetosExpandidos] = useState<Set<string>>(new Set());
  const [fotoPorOp, setFotoPorOp] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState('');
  useEffect(() => {
    try { localStorage.setItem('producao-projetos-visualizacao', visualizacao); } catch { /* Preferência opcional. */ }
  }, [visualizacao]);

  const [mostrarConcluidos, setMostrarConcluidos] = useState(false);
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState<string | null>(null);
  const [processoSelecionadoId, setProcessoSelecionadoId] = useState<string | null>(null);
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null);
  const [etapaGrupoSelecionada, setEtapaGrupoSelecionada] = useState<string | null>(null);
  const [processoParaFinalizar, setProcessoParaFinalizar] = useState<ProducaoProcesso | null>(null);
  const [processoParaExcluir, setProcessoParaExcluir] = useState<ProducaoProcesso | null>(null);
  const [resumoExclusao, setResumoExclusao] = useState<ResumoExclusaoProcessoProducao | null>(null);
  const [carregandoResumoExclusao, setCarregandoResumoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [executandoId, setExecutandoId] = useState<string | null>(null);
  const [opsComImagem, setOpsComImagem] = useState<Set<string>>(new Set());
  const [jornadasAbertas, setJornadasAbertas] = useState<JornadaOpAberta[]>([]);
  const [ordemParaIniciar, setOrdemParaIniciar] = useState<ProducaoOrdemProducao | null>(null);

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

  const carregarJornadas = async () => {
    try {
      const jornadas = await listarJornadasOpAbertas();
      setJornadasAbertas(jornadas);
    } catch {
      setJornadasAbertas([]);
    }
  };

  const recarregar = async () => {
    await Promise.all([
      listarProjetos(),
      listarProcessos(),
      listarOrdens(),
      carregarJornadas(),
    ]);
  };

  useEffect(() => {
    void recarregar().catch(() => undefined);
  }, []);

  useEffect(() => {
    const carregarOpsComImagem = async () => {
      const { data: anexos, error: anexosError } = await supabase
        .from('producao_apontamento_anexos')
        .select('apontamento_id,file_path')
        .order('created_at', { ascending: false });

      if (anexosError || !anexos?.length) {
        setOpsComImagem(new Set());
        return;
      }

      const apontamentoIds = [...new Set(anexos.map((anexo) => anexo.apontamento_id).filter(Boolean))];
      if (apontamentoIds.length === 0) {
        setOpsComImagem(new Set());
        return;
      }

      const { data: apontamentos, error: apontamentosError } = await supabase
        .from('producao_apontamentos')
        .select('id,ordem_producao_id')
        .in('id', apontamentoIds)
        .not('ordem_producao_id', 'is', null);

      if (apontamentosError) return;

      const opPorApontamento = new Map((apontamentos ?? []).map((a) => [a.id, a.ordem_producao_id]));
      const caminhos: Record<string, string> = {};
      for (const anexo of anexos) {
        const opId = opPorApontamento.get(anexo.apontamento_id);
        if (opId && !caminhos[opId]) caminhos[opId] = anexo.file_path;
      }
      setFotoPorOp(caminhos);
      setOpsComImagem(
        new Set(
          (apontamentos ?? [])
            .map((apontamento) => apontamento.ordem_producao_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
    };

    void carregarOpsComImagem().catch(() => undefined);
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

  const jornadasPorOp = useMemo(
    () => Object.fromEntries(jornadasAbertas.map((jornada) => [jornada.ordem_producao_id, jornada])),
    [jornadasAbertas],
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
        const opsValidasProjeto = ops.filter(
          (ordem) => ordem.status !== 'cancelada',
        );
        const percentual = concluido ? 100 : progressoPonderadoOps(opsValidasProjeto);
        const percentualProgramado = concluido
          ? 100
          : percentualProgramadoOps(opsValidasProjeto);
        const opsSemEstimativa = opsValidasProjeto.filter(
          (ordem) => Number(ordem.esforco_estimado_horas_homem || 0) <= 0,
        ).length;
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
          percentualProgramado,
          opsSemEstimativa,
          status: concluido ? 'Concluído' : iniciado ? 'Em andamento' : 'Planejado',
          dataInicioReal: datasInicioReal[0] ?? null,
          dataFimReal: concluido ? datasFimReal.at(-1) ?? null : null,
        };
      }),
    [ordensPorProcesso, processos, projetos],
  );

  const gruposProducao = useMemo(() => {
    const mapa = new Map<string, {
      id: string;
      nome: string;
      cidade: string | null;
      projetos: typeof resumosProjetos;
      etapas: ProducaoProcesso[];
      ops: ProducaoOrdemProducao[];
      percentual: number;
      status: string;
    }>();

    resumosProjetos.forEach((resumo) => {
      const chave = resumo.projeto.group_id
        ?? (resumo.projeto.cidade ? `cidade:${resumo.projeto.cidade.trim().toLocaleLowerCase('pt-BR')}` : `projeto:${resumo.projeto.id}`);
      const nome = resumo.projeto.grupo_nome?.trim()
        || resumo.projeto.cidade?.trim()
        || resumo.projeto.nome;

      const atual = mapa.get(chave) ?? {
        id: chave,
        nome,
        cidade: resumo.projeto.cidade,
        projetos: [],
        etapas: [],
        ops: [],
        percentual: 0,
        status: 'Planejado',
      };

      atual.projetos.push(resumo);
      atual.etapas.push(...resumo.etapas);
      atual.ops.push(...resumo.ops);
      mapa.set(chave, atual);
    });

    return [...mapa.values()]
      .map((grupo) => {
        const opsValidas = grupo.ops.filter((op) => op.status !== 'cancelada');
        const percentual = progressoPonderadoOps(opsValidas);
        const concluido = grupo.etapas.length > 0 && grupo.etapas
          .filter((etapa) => etapa.status !== 'cancelado')
          .every((etapa) => etapa.status === 'finalizado');
        const iniciado = grupo.etapas.some((etapa) =>
          ['em_andamento', 'pausado', 'bloqueado', 'finalizado'].includes(etapa.status),
        );
        return {
          ...grupo,
          percentual: concluido ? 100 : percentual,
          status: concluido ? 'Concluído' : iniciado ? 'Em andamento' : 'Planejado',
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [resumosProjetos]);

  const gruposFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return gruposProducao.filter((grupo) => {
      if (!mostrarConcluidos && grupo.status === 'Concluído') return false;
      if (!termo) return true;
      return [grupo.nome, grupo.cidade, ...grupo.projetos.flatMap((resumo) => [
        resumo.projeto.nome,
        resumo.projeto.cliente,
      ])]
        .filter(Boolean)
        .some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo));
    });
  }, [busca, gruposProducao, mostrarConcluidos]);

  const grupoSelecionado = gruposProducao.find((grupo) => grupo.id === grupoSelecionadoId) ?? null;

  const etapasDoGrupo = useMemo(() => {
    if (!grupoSelecionado) return [];
    const mapa = new Map<string, {
      chave: string;
      nome: string;
      processos: ProducaoProcesso[];
      ops: ProducaoOrdemProducao[];
      percentual: number;
    }>();

    grupoSelecionado.etapas.forEach((processo) => {
      const chave = processo.nome.trim().toLocaleLowerCase('pt-BR');
      const atual = mapa.get(chave) ?? {
        chave,
        nome: processo.nome.trim(),
        processos: [],
        ops: [],
        percentual: 0,
      };
      atual.processos.push(processo);
      atual.ops.push(...(ordensPorProcesso[processo.id] ?? []));
      mapa.set(chave, atual);
    });

    return [...mapa.values()]
      .map((etapa) => ({
        ...etapa,
        percentual: progressoPonderadoOps(etapa.ops),
      }))
      .sort((a, b) => {
        const sa = Math.min(...a.processos.map((p) => Number(p.sequencia || 9999)));
        const sb = Math.min(...b.processos.map((p) => Number(p.sequencia || 9999)));
        return sa - sb || a.nome.localeCompare(b.nome, 'pt-BR');
      });
  }, [grupoSelecionado, ordensPorProcesso]);

  const etapaGrupoAtual = etapasDoGrupo.find((etapa) => etapa.chave === etapaGrupoSelecionada) ?? null;

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
    setEtapaGrupoSelecionada(null);
    setGrupoSelecionadoId(null);
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

  const ocupacoesMembros = useMemo(() => {
    const resultado: Record<string, OcupacaoMembroProducao> = {};
    jornadasAbertas.forEach((jornada) => {
      if (jornada.interrompida_em) return;
      const op = ordens.find((ordem) => ordem.id === jornada.ordem_producao_id);
      if (!op) return;
      jornada.membros_ids.forEach((membroId) => {
        resultado[membroId] = {
          ordemNumero: op.numero,
          atividade:
            op.tarefa_nome_snapshot ||
            op.descricao ||
            `OP ${String(op.numero).padStart(5, '0')}`,
        };
      });
    });
    return resultado;
  }, [jornadasAbertas, ordens]);

  const iniciarTrabalhoOp = (ordem: ProducaoOrdemProducao) => {
    setOrdemParaIniciar(ordem);
  };

  const confirmarInicioTrabalhoOp = async (membrosIds: string[]) => {
    const ordem = ordemParaIniciar;
    if (!ordem) return;

    setExecutandoId(ordem.id);
    try {
      await iniciarJornadaOp(ordem.id, membrosIds);
      setOrdemParaIniciar(null);
      await recarregar();
      toast.success(
        `${formatarIdentificacaoOrdemProducao(ordem)} iniciada com ${membrosIds.length} membro(s). O horário real foi registrado automaticamente.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar o trabalho na OP.',
      );
      await carregarJornadas();
    } finally {
      setExecutandoId(null);
    }
  };

  const executarOp = async (
    ordem: ProducaoOrdemProducao,
    acao: 'concluir' | 'cancelar' | 'reabrir',
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
        const precisaJustificativa = acao === 'cancelar';
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

  if (!projetoSelecionadoId) {
    if (grupoSelecionado && etapaGrupoAtual) {
      const opsEtapa = [...etapaGrupoAtual.ops].sort((a, b) => a.numero - b.numero);
      const processosAbertosDaEtapa = etapaGrupoAtual.processos.filter((processo) =>
        ['planejado', 'em_andamento', 'pausado', 'bloqueado'].includes(processo.status),
      );
      return (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" onClick={() => {
              setEtapaGrupoSelecionada(null);
              setGrupoSelecionadoId(null);
            }}>
              Projetos
            </Button>
            <ChevronRight className="h-4 w-4" />
            <Button variant="ghost" size="sm" onClick={() => setEtapaGrupoSelecionada(null)}>
              {grupoSelecionado.nome}
            </Button>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">{etapaGrupoAtual.nome}</span>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {grupoSelecionado.nome}
                </p>
                <h3 className="mt-1 text-xl font-semibold">{etapaGrupoAtual.nome}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {etapaGrupoAtual.processos.length} peça(s)/processo(s) · {opsEtapa.length} OP(s)
                </p>
              </div>
              <div className="min-w-40">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progresso</span><strong>{etapaGrupoAtual.percentual}%</strong>
                </div>
                <BarraProgresso valor={etapaGrupoAtual.percentual} />
              </div>
            </div>
            {processosAbertosDaEtapa.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-4" aria-label="Ações desta etapa">
                <FormOrdemProducao
                  processo={processosAbertosDaEtapa[0]}
                  processosDisponiveis={processosAbertosDaEtapa}
                  ordens={ordens}
                  tarefas={tarefas}
                  onEmitir={criarOrdem}
                />
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-3 text-base font-semibold">Ordens de Produção</h4>
            {opsEtapa.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhuma OP emitida para {etapaGrupoAtual.nome}.
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {opsEtapa.map((op) => {
                  const processo = processos.find((p) => p.id === op.processo_id);
                  const projeto = processo
                    ? grupoSelecionado.projetos.find((r) =>
                        pertenceAoProjeto(processo, r.projeto)
                      )?.projeto
                    : null;
                  const progresso = op.status === 'cancelada' ? 0 : clampPercent(percentualExecucaoOp(op));
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => {
                        if (projeto) setProjetoSelecionadoId(projeto.id);
                        setProcessoSelecionadoId(op.processo_id);
                      }}
                      className="rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/50 hover:bg-muted/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{formatarIdentificacaoOrdemProducao(op)}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {projeto?.nome ?? op.projeto_nome}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{statusOpLabel[op.status] ?? op.status}</span>
                        <span>{op.quantidade_realizada} de {op.quantidade_planejada}</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Progresso</span><span>{progresso}%</span>
                        </div>
                        <BarraProgresso valor={progresso} />
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

    if (grupoSelecionado) {
      return (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => setGrupoSelecionadoId(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos projetos
            </Button>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Projeto</p>
                <h3 className="mt-1 text-xl font-semibold">{grupoSelecionado.nome}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {grupoSelecionado.projetos.length} peça(s) · {grupoSelecionado.ops.length} OP(s)
                </p>
              </div>
              <div className="min-w-40 text-right">
                <p className="text-xs text-muted-foreground">Progresso global</p>
                <p className="text-2xl font-bold">{grupoSelecionado.percentual}%</p>
              </div>
            </div>
            <div className="mt-4"><BarraProgresso valor={grupoSelecionado.percentual} /></div>
          </div>

          <div>
            <h4 className="mb-3 text-base font-semibold">Etapas do projeto</h4>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {etapasDoGrupo.map((etapa) => {
                const opsValidas = etapa.ops.filter((op) => op.status !== 'cancelada');
                const concluidas = opsValidas.filter((op) => op.status === 'concluida').length;
                return (
                  <button
                    key={etapa.chave}
                    type="button"
                    onClick={() => setEtapaGrupoSelecionada(etapa.chave)}
                    className="rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/50 hover:bg-muted/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{etapa.processos.length} peça(s)</p>
                        <h5 className="mt-1 font-semibold">{etapa.nome}</h5>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      {opsValidas.length} OP(s) · {concluidas} concluída(s)
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Progresso</span><span>{etapa.percentual}%</span>
                      </div>
                      <BarraProgresso valor={etapa.percentual} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-medium">Etapas de Produção</h3>
          <p className="text-sm text-muted-foreground">
            Selecione o projeto. Dentro dele você verá as etapas e, em seguida, as OPs.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar projeto, peça, cliente ou cidade..."
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
        ) : gruposFiltrados.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            <FolderKanban className="mx-auto mb-3 h-9 w-9 opacity-50" />
            Nenhum projeto encontrado.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {gruposFiltrados.map((grupo) => (
              <button
                key={grupo.id}
                type="button"
                onClick={() => setGrupoSelecionadoId(grupo.id)}
                className="group rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Projeto</p>
                    <h4 className="mt-1 truncate text-lg font-semibold">{grupo.nome}</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {grupo.projetos.length} peça(s) · {grupo.etapas.length} processo(s) · {grupo.ops.length} OP(s)
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                  <span className={`rounded-full border px-2.5 py-1 ${statusProjetoClassName(grupo.status)}`}>
                    {grupo.status}
                  </span>
                  <strong>{grupo.percentual}%</strong>
                </div>
                <div className="mt-2"><BarraProgresso valor={grupo.percentual} /></div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

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
              {ordensDaEtapa.map((ordem) => {
                const jornada = jornadasPorOp[ordem.id] ?? null;
                return (
                  <div
                    key={ordem.id}
                    className={
                      ordemProducaoEDePintura(ordem) && ordem.pendencia_consumo_tinta
                        ? 'animate-pulse rounded-xl border-2 border-lime-400 bg-lime-300/30 p-4 shadow-lg shadow-lime-400/40 ring-2 ring-lime-400/60'
                        : 'rounded-xl border bg-card p-4 shadow-sm'
                    }
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{formatarIdentificacaoOrdemProducao(ordem)}</span>
                          {ordemProducaoEDePintura(ordem) && (
                            <span className="rounded-full bg-lime-400 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-black shadow shadow-lime-400/70">
                              PINTURA
                            </span>
                          )}
                          <span className="rounded-full border px-2 py-0.5 text-xs">
                            {statusOpLabel[ordem.status] ?? ordem.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {ordem.quantidade_realizada} de {ordem.quantidade_planejada} {ordem.unidade_medida ?? ''}
                        </p>
                        <BarraProgresso valor={Number(ordem.percentual_realizado || 0)} />
                        <p className="text-xs text-muted-foreground">
                          {ordem.data_inicio_prevista && ordem.data_fim_prevista
                            ? `${formatarData(ordem.data_inicio_prevista)} → ${formatarData(ordem.data_fim_prevista)}`
                            : 'A programar'}
                          {ordem.duracao_estimada_horas
                            ? ` · ${ordem.duracao_estimada_horas} h`
                            : ' · estimativa de tempo pendente'}
                          {ordem.equipe_prevista
                            ? ` · ${ordem.equipe_prevista} pessoa(s)`
                            : ''}
                          {ordem.esforco_estimado_horas_homem
                            ? ` · ${ordem.esforco_estimado_horas_homem} h-h`
                            : ''}
                          {ordem.responsavel_nome_snapshot ? ` · ${ordem.responsavel_nome_snapshot}` : ''}
                        </p>
                      </div>
                      <div className="flex max-w-full flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                        {canConfigurarProducao() && (
                          <FormEditarOrdemProducao ordem={ordem} onSuccess={recarregar} />
                        )}
                        <ControlesJornadaOp
                          ordem={ordem}
                          jornada={jornada}
                          executando={executandoId === ordem.id}
                          onIniciar={(item) => void iniciarTrabalhoOp(item)}
                          onFechar={onFecharJornada}
                          onFinalizarLegado={(item) => void executarOp(item, 'concluir')}
                        />
                        {['concluida', 'cancelada'].includes(ordem.status) && (
                          <Button variant="outline" size="sm" onClick={() => void executarOp(ordem, 'reabrir')} disabled={executandoId === ordem.id}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Reabrir
                          </Button>
                        )}
                        {['rascunho', 'liberada', 'em_execucao'].includes(ordem.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => void executarOp(ordem, 'cancelar')}
                            disabled={executandoId === ordem.id || Boolean(jornada)}
                            title={jornada ? 'Encerre o apontamento aberto antes de cancelar a OP' : 'Cancelar OP'}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                    <MateriaisOrdemProducao
                      ordem={ordem}
                      estoqueAtivoId={estoqueAtivoId}
                      estoqueAtivoNome={estoqueAtivoNome}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ModalIniciarOpComEquipe
        ordem={ordemParaIniciar}
        membros={membros}
        ocupacoes={ocupacoesMembros}
        iniciando={Boolean(ordemParaIniciar && executandoId === ordemParaIniciar.id)}
        onOpenChange={(open) => {
          if (!open && !executandoId) setOrdemParaIniciar(null);
        }}
        onConfirmar={(membrosIds) => void confirmarInicioTrabalhoOp(membrosIds)}
      />

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
    const {
      projeto,
      etapas,
      ops,
      percentual,
      percentualProgramado,
      opsSemEstimativa,
      status,
      dataInicioReal,
      dataFimReal,
    } = resumoProjetoSelecionado;

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
          <div className="mt-4 space-y-2">
            <BarraProgresso valor={percentual} />
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>Falta executar: <strong className="text-foreground">{Math.max(0, 100 - percentual)}%</strong></span>
              <span>Trabalho já programado: <strong className="text-foreground">{percentualProgramado}%</strong></span>
              {opsSemEstimativa > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {opsSemEstimativa} OP(s) ainda sem estimativa de esforço
                </span>
              )}
            </div>
          </div>
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
        <div className="flex gap-1" role="group" aria-label="Visualização dos projetos">
          <Button variant={visualizacao === 'cards' ? 'default' : 'outline'} aria-pressed={visualizacao === 'cards'} onClick={() => setVisualizacao('cards')}>
            <LayoutGrid className="mr-2 h-4 w-4" /> Cards
          </Button>
          <Button variant={visualizacao === 'lista' ? 'default' : 'outline'} aria-pressed={visualizacao === 'lista'} onClick={() => setVisualizacao('lista')}>
            <List className="mr-2 h-4 w-4" /> Lista
          </Button>
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
      ) : visualizacao === 'lista' ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          {projetosFiltrados.map(({ projeto, etapas, ops, percentual, status }) => {
            const expandido = projetosExpandidos.has(projeto.id);
            const foto = ops.map((op) => fotoPorOp[op.id]).find(Boolean);
            return (
              <div key={projeto.id} className="border-b last:border-b-0">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button type="button" aria-expanded={expandido} aria-controls={`ops-projeto-${projeto.id}`}
                    onClick={() => setProjetosExpandidos((atuais) => {
                      const novos = new Set(atuais);
                      if (novos.has(projeto.id)) novos.delete(projeto.id); else novos.add(projeto.id);
                      return novos;
                    })}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-label={`${expandido ? 'Recolher' : 'Expandir'} OPs de ${projeto.nome}`}>
                    {expandido ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <FotoProjetoLista caminho={foto} nome={projeto.nome} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{projeto.nome}</span>
                      <span className="block text-xs text-muted-foreground">{projeto.cidade || projeto.grupo_nome || 'Local não informado'} · {ops.length} OP(s)</span>
                    </span>
                  </button>
                  <div className="w-44 shrink-0 space-y-1">
                    <div className="flex justify-between text-xs"><span>Progresso</span><strong>{percentual}%</strong></div>
                    <BarraProgresso valor={percentual} />
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${statusProjetoClassName(status)}`}>{status}</span>
                  <Button variant="ghost" size="sm" onClick={() => setProjetoSelecionadoId(projeto.id)}>Abrir projeto</Button>
                  {isAdmin() && <ExcluirProjetoProducao projeto={projeto} onSuccess={recarregar} />}
                </div>
                {expandido && (
                  <div id={`ops-projeto-${projeto.id}`} className="border-t bg-muted/15 px-4 py-2">
                    {ops.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Este projeto ainda não possui OPs.</p> :
                      [...ops].sort((a, b) => a.numero - b.numero).map((op) => {
                        const etapa = etapas.find((e) => e.id === op.processo_id);
                        const progresso = op.status === 'cancelada' ? 0 : clampPercent(percentualExecucaoOp(op));
                        return (
                          <div key={op.id} className="flex flex-wrap items-center gap-3 border-b py-3 pl-7 last:border-b-0">
                            <button type="button" className="min-w-0 flex-1 text-left hover:text-primary"
                              onClick={() => { setProjetoSelecionadoId(projeto.id); setProcessoSelecionadoId(op.processo_id); }}>
                              <span className="block font-medium">{formatarIdentificacaoOrdemProducao(op)}</span>
                              <span className="text-xs text-muted-foreground">{etapa?.nome || 'Etapa não informada'}{op.responsavel_nome_snapshot ? ` · ${op.responsavel_nome_snapshot}` : ''}</span>
                            </button>
                            <span className="text-xs text-muted-foreground">{statusOpLabel[op.status] || op.status}</span>
                            <div className="w-44 shrink-0 space-y-1">
                              <div className="flex justify-between text-xs"><span>Progresso da OP</span><strong>{progresso}%</strong></div>
                              <BarraProgresso valor={progresso} />
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projetosFiltrados.map((resumo) => {
            const {
              projeto,
              etapas,
              ops,
              percentual,
              percentualProgramado,
              opsSemEstimativa,
              status,
              dataInicioReal,
              dataFimReal,
            } = resumo;
            const possuiImagem = ops.some((ordem) => opsComImagem.has(ordem.id));

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
                              aria-label="Este projeto possui OP com imagem vinculada"
                            >
                              <Camera className="h-3.5 w-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Este projeto possui OP com imagem vinculada.
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
                  <div className="mt-2 flex justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>Falta {Math.max(0, 100 - percentual)}%</span>
                    <span>Programado {percentualProgramado}%</span>
                  </div>
                  {opsSemEstimativa > 0 && (
                    <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                      {opsSemEstimativa} OP(s) sem duração/equipe estimada
                    </p>
                  )}
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

                {isAdmin() && (
                  <div className="mt-3" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                    <ExcluirProjetoProducao projeto={projeto} onSuccess={async () => {
                      setProjetoSelecionadoId(null);
                      await recarregar();
                    }} />
                  </div>
                )}
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
