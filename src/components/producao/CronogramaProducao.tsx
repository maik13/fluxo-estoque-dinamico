import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameDay,
  isSaturday,
  isSunday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Printer,
  RotateCcw,
  RefreshCw,
  Search,
  Settings2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useCronogramaProducao,
  type ConfiguracaoCronogramaProducao,
  type GanttEtapaProducao,
  type GanttOrdemProducao,
} from '@/hooks/useCronogramaProducao';
import { formatarIdentificacaoOrdemProducao, formatarNumeroOrdemProducao } from '@/hooks/useOrdensProducao';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { importarMSProjectNatal2026V24, resumoImportacaoMSProjectNatal2026V24 } from '@/services/producao/importacaoMSProjectNatal2026V24';
import { PlanoDiarioProducao } from './PlanoDiarioProducao';
import { AgendaPlanejamentoCronograma } from './AgendaPlanejamentoCronograma';

const TASK_COLUMN_WIDTH = 330;
const COMPACT_TASK_COLUMN_WIDTH = 390;
const ASSIGNEE_COLUMN_WIDTH = 150;
const WORKFORCE_COLUMN_WIDTH = 250;
const PROGRESS_COLUMN_WIDTH = 100;
const STATE_COLUMN_WIDTH = 140;
const LABEL_WIDTH =
  TASK_COLUMN_WIDTH + ASSIGNEE_COLUMN_WIDTH + WORKFORCE_COLUMN_WIDTH + PROGRESS_COLUMN_WIDTH + STATE_COLUMN_WIDTH;
const ROW_HEIGHT_ETAPA = 52;
const ROW_HEIGHT_OP = 52;
const ROW_HEIGHT_PECA = 60;
const GANTT_HEADER_HEIGHT = 76;

type Visualizacao = '14dias' | 'semana' | 'mes';

const PIXELS_POR_DIA: Record<Visualizacao, number> = {
  '14dias': 84,
  semana: 120,
  mes: 68,
};

const statusEtapaClass: Record<string, string> = {
  planejado: 'bg-slate-500',
  em_andamento: 'bg-emerald-500',
  pausado: 'bg-amber-500',
  bloqueado: 'bg-red-500',
  finalizado: 'bg-blue-500',
  cancelado: 'bg-zinc-500',
};

const statusEtapaLabel: Record<string, string> = {
  planejado: 'Planejada',
  em_andamento: 'Em andamento',
  pausado: 'Pausada',
  bloqueado: 'Bloqueada',
  finalizado: 'Concluída',
  cancelado: 'Cancelada',
};

const statusOpClass: Record<string, string> = {
  rascunho: 'bg-slate-400',
  liberada: 'bg-indigo-500',
  em_execucao: 'bg-emerald-600',
  concluida: 'bg-blue-600',
  cancelada: 'bg-zinc-500',
};

const statusOpLabel: Record<string, string> = {
  rascunho: 'A programar',
  liberada: 'Programada',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

interface Intervalo {
  inicio: Date;
  fim: Date;
  origem: 'real' | 'prevista';
}

type TipoEdicaoBarra = 'mover' | 'inicio' | 'fim';

interface InteracaoBarra {
  ordemId: string;
  tipo: TipoEdicaoBarra;
  clientXInicial: number;
  intervaloInicial: Intervalo;
  intervaloAnterior: Intervalo;
  intervaloAtual: Intervalo;
}

interface ResumoEdicaoBarra {
  ordem: GanttOrdemProducao;
  tipo: TipoEdicaoBarra;
  anterior: Intervalo;
  novo: Intervalo;
}

interface LinhaEtapa {
  tipo: 'etapa';
  id: string;
  etapa: GanttEtapaProducao;
}

interface LinhaOp {
  tipo: 'op';
  id: string;
  etapa: GanttEtapaProducao;
  ordem: GanttOrdemProducao;
}

interface LinhaPeca {
  tipo: 'peca';
  id: string;
  projetoId: string;
  projetoNome: string;
}

type LinhaGantt = LinhaPeca | LinhaEtapa | LinhaOp;

const formatarQuantidadeMaoDeObra = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(valor ?? 0));

const resumoMaoDeObraUtilizada = (ordem: GanttOrdemProducao) =>
  ordem.mao_de_obra_utilizada == null ? null : `${ordem.mao_de_obra_utilizada} pessoa(s) utilizada(s)`;

interface PicoMaoDeObraEtapa {
  data: Date;
  mestres: number;
  oficiais: number;
  ajudantes: number;
  total: number;
}

const obterPicoMaoDeObraEtapa = (
  etapa: GanttEtapaProducao,
  configuracao: ConfiguracaoCronogramaProducao | null,
): PicoMaoDeObraEtapa | null => {
  const porDia = new Map<string, Omit<PicoMaoDeObraEtapa, 'data'>>();

  etapa.ordens
    .filter((ordem) => ordem.status !== 'cancelada' && Number(ordem.mao_de_obra?.total ?? 0) > 0)
    .forEach((ordem) => {
      const inicio = dataValida(ordem.data_inicio_prevista ?? ordem.data_inicio_real);
      const fimBruto = dataValida(ordem.data_fim_prevista ?? ordem.data_fim_real) ?? inicio;
      if (!inicio || !fimBruto) return;
      const fim = fimBruto.getTime() < inicio.getTime() ? inicio : fimBruto;

      for (let data = inicio; data.getTime() <= fim.getTime(); data = addDays(data, 1)) {
        if (isSaturday(data) && configuracao?.trabalha_sabado === false) continue;
        if (isSunday(data) && configuracao?.trabalha_domingo === false) continue;
        const chave = format(data, 'yyyy-MM-dd');
        const atual = porDia.get(chave) ?? { mestres: 0, oficiais: 0, ajudantes: 0, total: 0 };
        atual.mestres += Number(ordem.mao_de_obra.mestres ?? 0);
        atual.oficiais += Number(ordem.mao_de_obra.oficiais ?? 0);
        atual.ajudantes += Number(ordem.mao_de_obra.ajudantes ?? 0);
        atual.total = atual.mestres + atual.oficiais + atual.ajudantes;
        porDia.set(chave, atual);
      }
    });

  return [...porDia.entries()]
    .map(([data, valores]) => ({ data: parseISO(data), ...valores }))
    .sort((a, b) => b.total - a.total || a.data.getTime() - b.data.getTime())[0] ?? null;
};

const resumoPicoMaoDeObraEtapa = (pico: PicoMaoDeObraEtapa | null) => pico
  ? `Pico M ${formatarQuantidadeMaoDeObra(pico.mestres)} · O ${formatarQuantidadeMaoDeObra(pico.oficiais)} · A ${formatarQuantidadeMaoDeObra(pico.ajudantes)} · Total ${formatarQuantidadeMaoDeObra(pico.total)}`
  : 'Sem MO planejada nas OPs';

const obterPicoMaoDeObraPeca = (
  etapas: GanttEtapaProducao[],
  configuracao: ConfiguracaoCronogramaProducao | null,
) => obterPicoMaoDeObraEtapa({
  ...etapas[0],
  ordens: etapas.flatMap((etapa) => etapa.ordens),
}, configuracao);

const dataValida = (valor: string | null | undefined) => valor ? parseISO(valor) : null;

const numeroDaEtapa = (nome: string) => {
  const resultado = nome.match(/^Etapa\s+(\d+)\b/i);
  return resultado ? Number(resultado[1]) : null;
};

const compararEtapasDaPeca = (a: GanttEtapaProducao, b: GanttEtapaProducao) => {
  const numeroA = numeroDaEtapa(a.etapa_nome);
  const numeroB = numeroDaEtapa(b.etapa_nome);
  if (numeroA !== null && numeroB !== null && numeroA !== numeroB) return numeroA - numeroB;
  if (numeroA !== null && numeroB === null) return -1;
  if (numeroA === null && numeroB !== null) return 1;
  return Number(a.sequencia ?? 9999) - Number(b.sequencia ?? 9999)
    || a.etapa_nome.localeCompare(b.etapa_nome, 'pt-BR');
};

const compararOpsDaEtapa = (a: GanttOrdemProducao, b: GanttOrdemProducao) =>
  (a.data_inicio_prevista ?? '9999-12-31').localeCompare(b.data_inicio_prevista ?? '9999-12-31')
  || a.numero - b.numero;

const normalizarIntervalo = (
  inicioRealTexto: string | null | undefined,
  fimRealTexto: string | null | undefined,
  inicioPrevistoTexto: string | null | undefined,
  fimPrevistoTexto: string | null | undefined,
  encerrado: boolean,
): Intervalo | null => {
  const inicioReal = dataValida(inicioRealTexto ?? fimRealTexto);
  const fimReal = dataValida(fimRealTexto ?? inicioRealTexto);
  const inicioPrevisto = dataValida(inicioPrevistoTexto ?? fimPrevistoTexto);
  const fimPrevisto = dataValida(fimPrevistoTexto ?? inicioPrevistoTexto);

  // Os APs não deslocam as datas originais da barra de planejamento.
  const inicio = inicioPrevisto ?? inicioReal;
  const fimBruto = fimPrevisto ?? fimReal ?? inicio;
  if (!inicio || !fimBruto) return null;
  return {
    inicio,
    fim: fimBruto.getTime() < inicio.getTime() ? inicio : fimBruto,
    origem: inicioPrevisto && fimPrevisto ? 'prevista' : 'real',
  };
};

const intervaloEtapa = (etapa: GanttEtapaProducao) => normalizarIntervalo(
  etapa.data_inicio_real,
  etapa.data_fim_real,
  etapa.data_inicio_prevista ?? etapa.data_inicio_desejada,
  etapa.data_fim_prevista ?? etapa.data_limite,
  etapa.status === 'finalizado' || etapa.status === 'cancelado',
);

const intervaloOrdem = (ordem: GanttOrdemProducao) => normalizarIntervalo(
  ordem.data_inicio_real,
  ordem.data_fim_real,
  ordem.data_inicio_prevista,
  ordem.data_fim_prevista,
  ordem.status === 'concluida' || ordem.status === 'cancelada',
);

const classePrazo = (status: string, fimPrevisto: string | null | undefined, fimReal: string | null | undefined, hoje: Date) => {
  const fim = dataValida(fimPrevisto);
  const concluido = status === 'concluida' || status === 'finalizado';
  const real = dataValida(fimReal);
  if (fim && ((concluido && real && differenceInCalendarDays(real, fim) > 0)
    || (!concluido && differenceInCalendarDays(hoje, fim) > 0))) return 'bg-red-600';
  if (status === 'em_execucao' || status === 'em_andamento') return 'bg-emerald-600';
  if (status === 'cancelada' || status === 'cancelado') return 'bg-zinc-500';
  return fim ? 'bg-blue-600' : 'bg-slate-500';
};

const limitarData = (data: Date, minimo: Date, maximo: Date) => {
  if (data.getTime() < minimo.getTime()) return minimo;
  if (data.getTime() > maximo.getTime()) return maximo;
  return data;
};

const calcularPeriodo = (visualizacao: Visualizacao, deslocamento: number) => {
  const hoje = new Date();
  if (visualizacao === 'semana') {
    const inicio = startOfWeek(addDays(hoje, deslocamento * 7), { weekStartsOn: 1 });
    return { inicio, fim: addDays(inicio, 6) };
  }
  if (visualizacao === 'mes') {
    const inicio = startOfMonth(addMonths(hoje, deslocamento));
    return { inicio, fim: endOfMonth(inicio) };
  }
  const inicio = addDays(hoje, deslocamento * 14);
  return { inicio, fim: addDays(inicio, 13) };
};

export const CronogramaProducao = () => {
  const { isAdmin } = usePermissions();
  const {
    etapas,
    configuracao,
    alertas,
    loading,
    recalculando,
    erro,
    listarCronograma,
    recalcularCronograma,
    salvarConfiguracao,
  } = useCronogramaProducao();
  const [projetoId, setProjetoId] = useState('todos');
  const [busca, setBusca] = useState('');
  const [visualizacao, setVisualizacao] = useState<Visualizacao>('semana');
  const [deslocamento, setDeslocamento] = useState(0);
  const [configAberta, setConfigAberta] = useState(false);
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
  const [confirmarImportacaoMSP, setConfirmarImportacaoMSP] = useState(false);
  const [importandoMSP, setImportandoMSP] = useState(false);
  const [resultadoImportacaoMSP, setResultadoImportacaoMSP] = useState<string | null>(null);
  const [erroImportacaoMSP, setErroImportacaoMSP] = useState<string | null>(null);
  const [etapasRecolhidas, setEtapasRecolhidas] = useState<Set<string>>(() => new Set());
  const [ganttAmpliado, setGanttAmpliado] = useState(true);
  const [periodosSimulados, setPeriodosSimulados] = useState<Record<string, Intervalo>>({});
  const [resumoEdicao, setResumoEdicao] = useState<ResumoEdicaoBarra | null>(null);
  const [larguraViewport, setLarguraViewport] = useState(0);
  const ganttViewportRef = useRef<HTMLDivElement>(null);
  const interacaoBarraRef = useRef<InteracaoBarra | null>(null);
  const [configForm, setConfigForm] = useState<ConfiguracaoCronogramaProducao>({
    equipe_disponivel_por_dia: 5,
    trabalha_sabado: false,
    trabalha_domingo: false,
    horizonte_dias: 365,
  });

  useEffect(() => { void listarCronograma().catch(() => undefined); }, [listarCronograma]);
  useEffect(() => { if (configuracao) setConfigForm(configuracao); }, [configuracao]);
  useEffect(() => {
    const elemento = ganttViewportRef.current;
    if (!elemento) return;

    const atualizarLargura = () => setLarguraViewport(elemento.clientWidth);
    atualizarLargura();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(atualizarLargura);
    observer.observe(elemento);
    return () => observer.disconnect();
  }, []);

  const projetos = useMemo(() => {
    const mapa = new Map<string, string>();
    etapas.forEach((etapa) => mapa.set(etapa.projeto_id, etapa.projeto_nome));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [etapas]);

  const picoMaoDeObraPorPeca = useMemo(() => {
    const mapa = new Map<string, PicoMaoDeObraEtapa | null>();
    projetos.forEach(([id]) => {
      const etapasDaPeca = etapas.filter((etapa) => etapa.projeto_id === id);
      mapa.set(id, etapasDaPeca.length > 0 ? obterPicoMaoDeObraPeca(etapasDaPeca, configuracao) : null);
    });
    return mapa;
  }, [configuracao, etapas, projetos]);

  const etapasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return etapas.filter((etapa) => {
      if (projetoId !== 'todos' && etapa.projeto_id !== projetoId) return false;
      if (!termo) return true;
      const valores = [
        etapa.codigo,
        etapa.etapa_nome,
        etapa.projeto_nome,
        etapa.grupo_cronograma,
        etapa.cidade,
        etapa.uf,
        ...etapa.ordens.flatMap((ordem) => [
          formatarNumeroOrdemProducao(ordem.numero),
          ordem.tarefa_nome_snapshot,
          ordem.local_tipo,
          ordem.responsavel_nome,
        ]),
      ];
      return valores.filter(Boolean).some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo));
    });
  }, [busca, etapas, projetoId]);

  const linhasProgramadas = useMemo<LinhaGantt[]>(() => {
    const etapasPorPeca = new Map<string, GanttEtapaProducao[]>();
    etapasFiltradas.forEach((etapa) => {
      const etapasDaPeca = etapasPorPeca.get(etapa.projeto_id) ?? [];
      etapasDaPeca.push(etapa);
      etapasPorPeca.set(etapa.projeto_id, etapasDaPeca);
    });

    return [...etapasPorPeca.entries()]
      .sort(([, etapasA], [, etapasB]) =>
        etapasA[0].projeto_nome.localeCompare(etapasB[0].projeto_nome, 'pt-BR'))
      .flatMap(([projetoId, etapasDaPeca]): LinhaGantt[] => [
        {
          tipo: 'peca',
          id: `peca-${projetoId}`,
          projetoId,
          projetoNome: etapasDaPeca[0].projeto_nome,
        },
        ...etapasDaPeca
          .sort(compararEtapasDaPeca)
          .flatMap((etapa): LinhaGantt[] => {
            const ordensAtivas = etapa.ordens.filter((ordem) => ordem.status !== 'cancelada');
            const ordensProgramadas = ordensAtivas
              .filter((ordem) => Boolean(intervaloOrdem(ordem)))
              .sort(compararOpsDaEtapa)
              .map((ordem) => ({ tipo: 'op' as const, id: `op-${ordem.id}`, etapa, ordem }));
            const linhaEtapa = intervaloEtapa(etapa)
              ? [{ tipo: 'etapa' as const, id: `etapa-${etapa.etapa_id}`, etapa }]
              : [];

            return [
              ...linhaEtapa,
              ...(etapasRecolhidas.has(etapa.etapa_id) ? [] : ordensProgramadas),
            ];
          }),
      ]);
  }, [etapasFiltradas, etapasRecolhidas]);

  const periodo = useMemo(() => calcularPeriodo(visualizacao, deslocamento), [deslocamento, visualizacao]);
  const pixelsPorDiaBase = PIXELS_POR_DIA[visualizacao];
  const dias = useMemo(() => {
    const total = differenceInCalendarDays(periodo.fim, periodo.inicio) + 1;
    return Array.from({ length: total }, (_, indice) => addDays(periodo.inicio, indice));
  }, [periodo]);
  const gruposMeses = useMemo(() => {
    const grupos: Array<{ chave: string; label: string; quantidade: number }> = [];
    dias.forEach((dia) => {
      const chave = format(dia, 'yyyy-MM');
      const ultimo = grupos[grupos.length - 1];
      if (ultimo?.chave === chave) {
        ultimo.quantidade += 1;
      } else {
        grupos.push({
          chave,
          label: format(dia, 'MMMM yyyy', { locale: ptBR }),
          quantidade: 1,
        });
      }
    });
    return grupos;
  }, [dias]);

  const alternarEtapa = (etapaId: string) => {
    setEtapasRecolhidas((atuais) => {
      const proximo = new Set(atuais);
      if (proximo.has(etapaId)) proximo.delete(etapaId);
      else proximo.add(etapaId);
      return proximo;
    });
  };

  const expandirTudo = () => setEtapasRecolhidas(new Set());
  const recolherTudo = () => setEtapasRecolhidas(new Set(etapasFiltradas.map((etapa) => etapa.etapa_id)));

  const larguraPainelLateral = ganttAmpliado ? COMPACT_TASK_COLUMN_WIDTH : LABEL_WIDTH;
  const colunasPainelLateral = ganttAmpliado
    ? `${COMPACT_TASK_COLUMN_WIDTH}px`
    : `${TASK_COLUMN_WIDTH}px ${ASSIGNEE_COLUMN_WIDTH}px ${WORKFORCE_COLUMN_WIDTH}px ${PROGRESS_COLUMN_WIDTH}px ${STATE_COLUMN_WIDTH}px`;
  const larguraMinima = dias.length * pixelsPorDiaBase;
  const larguraTimelineDisponivel = Math.max(0, larguraViewport - larguraPainelLateral);
  const pixelsPorDia = visualizacao === 'semana' && larguraTimelineDisponivel > larguraMinima
    ? larguraTimelineDisponivel / dias.length
    : pixelsPorDiaBase;
  const largura = dias.length * pixelsPorDia;
  const hojeIndice = differenceInCalendarDays(new Date(), periodo.inicio);
  const hojeOffset = hojeIndice * pixelsPorDia;
  const hojeNaFaixa = hojeIndice >= 0 && hojeIndice < dias.length;
  const linhasOperacionais = useMemo(() => {
    const linhasVisiveis: LinhaGantt[] = [];
    let cabecalhoDaPeca: LinhaPeca | null = null;

    linhasProgramadas.forEach((linha) => {
      if (linha.tipo === 'peca') {
        cabecalhoDaPeca = linha;
        return;
      }

      const intervalo = linha.tipo === 'etapa' ? intervaloEtapa(linha.etapa) : intervaloOrdem(linha.ordem);
      const concluida = linha.tipo === 'etapa'
        ? linha.etapa.status === 'finalizado'
        : linha.ordem.status === 'concluida';
      const visivel = Boolean(
        (mostrarConcluidas || deslocamento < 0 || !concluida)
        && intervalo
        && intervalo.fim.getTime() >= periodo.inicio.getTime()
        && intervalo.inicio.getTime() <= periodo.fim.getTime(),
      );

      if (!visivel) return;
      if (cabecalhoDaPeca) {
        linhasVisiveis.push(cabecalhoDaPeca);
        cabecalhoDaPeca = null;
      }
      linhasVisiveis.push(linha);
    });

    return linhasVisiveis;
  }, [deslocamento, linhasProgramadas, mostrarConcluidas, periodo.fim, periodo.inicio]);
  const linhas = linhasOperacionais;
  const alertasAltos = alertas.filter((alerta) => alerta.severidade === 'alta').length;

  const salvarConfig = async () => {
    if (!Number.isFinite(configForm.equipe_disponivel_por_dia) || configForm.equipe_disponivel_por_dia < 0) {
      alert('Equipe disponível inválida.');
      return;
    }
    await salvarConfiguracao(configForm);
    setConfigAberta(false);
  };

  const executarImportacaoMSP = async () => {
    setErroImportacaoMSP(null);
    setImportandoMSP(true);
    try {
      const resultado = await importarMSProjectNatal2026V24();
      setResultadoImportacaoMSP(
        `${resultado.criadas} OPs criadas, ${resultado.mantidas} mantidas e ${resultado.etapas_criadas} etapas criadas.`,
      );
      setConfirmarImportacaoMSP(false);
      await listarCronograma();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'A importação não foi executada.';
      setErroImportacaoMSP(mensagem);
      setResultadoImportacaoMSP(`Importação não executada: ${mensagem}`);
    } finally {
      setImportandoMSP(false);
    }
  };

  const selecionarVisualizacao = (valor: string) => {
    setVisualizacao(valor as Visualizacao);
    setDeslocamento(0);
  };

  const intervaloDaOrdem = (ordem: GanttOrdemProducao) => periodosSimulados[ordem.id] ?? intervaloOrdem(ordem);

  const intervaloDaEtapa = (etapa: GanttEtapaProducao) => {
    const intervaloOriginal = intervaloEtapa(etapa);
    const intervalosDasOrdens = etapa.ordens
      .filter((ordem) => ordem.status !== 'cancelada')
      .map(intervaloDaOrdem)
      .filter((intervalo): intervalo is Intervalo => Boolean(intervalo));
    if (intervalosDasOrdens.length === 0) return intervaloOriginal;
    return {
      inicio: new Date(Math.min(...intervalosDasOrdens.map((intervalo) => intervalo.inicio.getTime()))),
      fim: new Date(Math.max(...intervalosDasOrdens.map((intervalo) => intervalo.fim.getTime()))),
      origem: intervalosDasOrdens.some((intervalo) => intervalo.origem === 'prevista') ? 'prevista' : 'real',
    } satisfies Intervalo;
  };

  const intervaloLinha = (linha: LinhaGantt) => {
    if (linha.tipo === 'peca') return null;
    if (linha.tipo === 'etapa') return intervaloDaEtapa(linha.etapa);
    return intervaloDaOrdem(linha.ordem);
  };

  const iniciarEdicaoBarra = (
    event: ReactPointerEvent<HTMLDivElement>,
    linha: LinhaOp,
    tipo: TipoEdicaoBarra,
  ) => {
    if (linha.ordem.status === 'concluida' || linha.ordem.status === 'cancelada') return;
    const intervalo = intervaloDaOrdem(linha.ordem);
    if (!intervalo) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    interacaoBarraRef.current = {
      ordemId: linha.ordem.id,
      tipo,
      clientXInicial: event.clientX,
      intervaloInicial: intervalo,
      intervaloAnterior: intervalo,
      intervaloAtual: intervalo,
    };
  };

  const moverEdicaoBarra = (event: ReactPointerEvent<HTMLDivElement>, linha: LinhaOp) => {
    const interacao = interacaoBarraRef.current;
    if (!interacao || interacao.ordemId !== linha.ordem.id) return;
    const deslocamentoDias = Math.round((event.clientX - interacao.clientXInicial) / pixelsPorDia);
    let inicio = interacao.intervaloInicial.inicio;
    let fim = interacao.intervaloInicial.fim;
    if (interacao.tipo === 'mover') {
      inicio = addDays(inicio, deslocamentoDias);
      fim = addDays(fim, deslocamentoDias);
    } else if (interacao.tipo === 'inicio') {
      inicio = limitarData(addDays(inicio, deslocamentoDias), inicio, fim);
    } else {
      fim = limitarData(addDays(fim, deslocamentoDias), inicio, addDays(inicio, 3650));
    }
    const intervaloAtual = { inicio, fim, origem: 'prevista' as const };
    interacao.intervaloAtual = intervaloAtual;
    setPeriodosSimulados((atuais) => ({
      ...atuais,
      [linha.ordem.id]: intervaloAtual,
    }));
  };

  const finalizarEdicaoBarra = (event: ReactPointerEvent<HTMLDivElement>, linha: LinhaOp) => {
    const interacao = interacaoBarraRef.current;
    if (!interacao || interacao.ordemId !== linha.ordem.id) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const novo = interacao.intervaloAtual;
    interacaoBarraRef.current = null;
    if (novo.inicio.getTime() !== interacao.intervaloAnterior.inicio.getTime()
      || novo.fim.getTime() !== interacao.intervaloAnterior.fim.getTime()) {
      setResumoEdicao({ ordem: linha.ordem, tipo: interacao.tipo, anterior: interacao.intervaloAnterior, novo });
    }
  };

  const percentualLinha = (linha: LinhaGantt) => {
    if (linha.tipo === 'peca') return 0;
    if (linha.tipo === 'etapa') return linha.etapa.percentual_realizado;
    return linha.ordem.percentual_realizado;
  };

  const statusLinha = (linha: LinhaGantt) => {
    if (linha.tipo === 'peca') return '';
    if (linha.tipo === 'etapa') return linha.etapa.status;
    return linha.ordem.status;
  };

  const alturaLinha = (linha: LinhaGantt) =>
    linha.tipo === 'peca' ? ROW_HEIGHT_PECA : linha.tipo === 'etapa' ? ROW_HEIGHT_ETAPA : ROW_HEIGHT_OP;

  const larguraImpressao = larguraPainelLateral + largura;
  const alturaImpressao = GANTT_HEADER_HEIGHT + linhas.reduce((total, linha) => total + alturaLinha(linha), 0) + 65;
  const escalaImpressao = Math.min(1, 1050 / larguraImpressao, 700 / alturaImpressao);

  return (
    <div className="space-y-4 gantt-print-root" style={{ '--gantt-print-scale': escalaImpressao } as React.CSSProperties}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Cronograma de Produção</h3>
          <p className="text-sm text-muted-foreground">
            Visão operacional: mostra por padrão somente o que ainda está programado ou em execução. Concluídas podem ser exibidas pelo filtro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setConfigAberta(true)}><Settings2 className="mr-2 h-4 w-4" />Capacidade e calendário</Button>
          <Button onClick={() => void recalcularCronograma()} disabled={recalculando}><RefreshCw className={cn('mr-2 h-4 w-4', recalculando && 'animate-spin')} />Recalcular</Button>
        </div>
      </div>

      {erro && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{erro}. Confirme se as migrations do cronograma e das OPs foram aplicadas.</AlertDescription></Alert>}
      {alertasAltos > 0 && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>O cronograma possui {alertasAltos} alerta(s) crítico(s). Verifique prazo, capacidade e quantidade não alocada.</AlertDescription></Alert>}
      <div className="grid gap-3 sm:grid-cols-3 print:hidden">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Equipe disponível/dia</p><p className="text-2xl font-bold">{configuracao?.equipe_disponivel_por_dia ?? '—'}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Programados no período</p><p className="text-2xl font-bold">{linhas.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Alertas críticos</p><p className={cn('text-2xl font-bold', alertasAltos > 0 && 'text-destructive')}>{alertasAltos}</p></Card>
      </div>

      <Tabs defaultValue="gantt">
        <TabsList>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
          <TabsTrigger value="plano-diario">Plano Diário</TabsTrigger>
          <TabsTrigger value="agenda">Marcos</TabsTrigger>
        </TabsList>

        <TabsContent value="gantt" className="mt-4">
          <Card className="gantt-print-area overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b p-3 print:hidden">
              {isAdmin() && (
                <Button onClick={() => { setErroImportacaoMSP(null); setConfirmarImportacaoMSP(true); }} disabled={importandoMSP}>
                  {importandoMSP && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Importar MSP v24 · {resumoImportacaoMSProjectNatal2026V24.aptas} OPs aptas
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={expandirTudo}>
                <ChevronsDown className="mr-2 h-4 w-4" />Expandir
              </Button>
              <Button variant="ghost" size="sm" onClick={recolherTudo}>
                <ChevronsUp className="mr-2 h-4 w-4" />Recolher
              </Button>
              <Button
                variant={ganttAmpliado ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setGanttAmpliado((valor) => !valor)}
              >
                {ganttAmpliado ? 'Mostrar detalhes' : 'Ampliar Gantt'}
              </Button>
              {Object.keys(periodosSimulados).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setPeriodosSimulados({}); setResumoEdicao(null); }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Limpar simulação ({Object.keys(periodosSimulados).length})
                </Button>
              )}
              <SearchableSelect
                value={projetoId}
                onValueChange={setProjetoId}
                className="w-[220px]"
                searchPlaceholder="Buscar projeto..."
                options={[
                  { value: 'todos', label: 'Todos os projetos' },
                  ...projetos.map(([id, nome]) => ({ value: id, label: nome })),
                ]}
              />
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar etapa, OP, projeto, responsável ou cidade" />
              </div>
              <Select value={visualizacao} onValueChange={selecionarVisualizacao}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="14dias">14 dias</SelectItem><SelectItem value="semana">Semana</SelectItem><SelectItem value="mes">Mês</SelectItem></SelectContent>
              </Select>
              <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                <Checkbox checked={mostrarConcluidas} onCheckedChange={(checked) => setMostrarConcluidas(checked === true)} />
                Mostrar concluídas
              </label>
              <Button variant="outline" onClick={() => setDeslocamento((valor) => valor - 1)}><ChevronLeft className="mr-2 h-4 w-4" />Período anterior</Button>
              <Button variant="outline" onClick={() => setDeslocamento(0)}><CalendarDays className="mr-2 h-4 w-4" />Hoje</Button>
              <Button variant="outline" onClick={() => setDeslocamento((valor) => valor + 1)}>Próximo período<ChevronRight className="ml-2 h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir / PDF</Button>
            </div>

            {resultadoImportacaoMSP && (
              <Alert className="mx-4 mt-3">
                <AlertDescription>{resultadoImportacaoMSP}</AlertDescription>
              </Alert>
            )}

            <div className="border-b bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
              {format(periodo.inicio, "dd 'de' MMMM", { locale: ptBR })} a {format(periodo.fim, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · cada coluna representa um dia
            </div>
            <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900 print:hidden">
              <strong>Simulação local:</strong> arraste uma barra de OP para mudar o período ou puxe suas extremidades para alterar a duração. Nenhuma alteração é gravada no banco.
            </div>

            <div ref={ganttViewportRef} className="gantt-scroll max-h-[76vh] overflow-auto">
              <div className="flex" style={{ width: larguraPainelLateral + largura }}>
                <div className="sticky left-0 z-30 shrink-0 border-r bg-card" style={{ width: larguraPainelLateral }}>
                  <div
                    className="sticky top-0 z-40 grid border-b bg-muted/70 text-xs font-semibold backdrop-blur"
                    style={{
                      height: GANTT_HEADER_HEIGHT,
                      gridTemplateColumns: colunasPainelLateral,
                    }}
                  >
                    <div className="flex items-end border-r px-3 pb-3">Nome da tarefa</div>
                    {!ganttAmpliado && <div className="flex items-end border-r px-3 pb-3">Atribuído</div>}
                    {!ganttAmpliado && <div className="flex items-end border-r px-3 pb-3">Mão de obra</div>}
                    {!ganttAmpliado && <div className="flex items-end border-r px-3 pb-3">Progresso</div>}
                    {!ganttAmpliado && <div className="flex items-end px-3 pb-3">Estado</div>}
                  </div>

                  {linhas.map((linha) => {
                    const percentual = Math.min(100, Math.max(0, Number(percentualLinha(linha) ?? 0)));
                    const status = statusLinha(linha);
                    if (linha.tipo === 'peca') {
                      return (
                        <div
                          key={linha.id}
                          className="grid border-b bg-primary/10 text-xs"
                          style={{
                            height: alturaLinha(linha),
                            gridTemplateColumns: colunasPainelLateral,
                          }}
                        >
                          <div className={cn('flex min-w-0 items-center gap-3 px-3', !ganttAmpliado && 'col-span-5')}>
                            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                              Peça
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-semibold" title={linha.projetoNome}>
                                {linha.projetoNome}
                              </div>
                              <div
                                className="mt-0.5 truncate text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
                                title={`${resumoPicoMaoDeObraEtapa(picoMaoDeObraPorPeca.get(linha.projetoId) ?? null)} · dimensionamento máximo simultâneo da peça`}
                              >
                                {picoMaoDeObraPorPeca.get(linha.projetoId)
                                  ? `Equipe dimensionada: ${resumoPicoMaoDeObraEtapa(picoMaoDeObraPorPeca.get(linha.projetoId) ?? null).replace('Pico ', '')}`
                                  : 'Equipe dimensionada: —'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const estado = linha.tipo === 'etapa'
                        ? statusEtapaLabel[status] ?? status
                        : linha.ordem.status === 'em_execucao' && percentual >= 100
                          ? '100% · aguardando conclusão'
                          : statusOpLabel[status] ?? status;
                    const responsavel = linha.tipo === 'op'
                      ? linha.ordem.responsavel_nome || 'não atribuído'
                      : '—';
                    const classeEstado = linha.tipo === 'etapa'
                        ? statusEtapaClass[status] ?? 'bg-slate-500'
                        : statusOpClass[status] ?? 'bg-indigo-500';
                    const picoMaoDeObraEtapa = linha.tipo === 'etapa'
                      ? obterPicoMaoDeObraEtapa(linha.etapa, configuracao)
                      : null;

                    return (
                      <div
                        key={linha.id}
                        className={cn(
                          'grid border-b text-xs',
                          linha.tipo === 'etapa' ? 'bg-muted/25 font-medium' : 'bg-card',
                        )}
                        style={{
                          height: alturaLinha(linha),
                          gridTemplateColumns: colunasPainelLateral,
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-2 border-r px-3">
                          {linha.tipo === 'etapa' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => alternarEtapa(linha.etapa.etapa_id)}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-muted"
                                aria-label={etapasRecolhidas.has(linha.etapa.etapa_id) ? 'Expandir etapa' : 'Recolher etapa'}
                              >
                                <ChevronDown
                                  className={cn(
                                    'h-4 w-4 transition-transform',
                                    etapasRecolhidas.has(linha.etapa.etapa_id) && '-rotate-90',
                                  )}
                                />
                              </button>
                              <div className="min-w-0">
                                <div className="truncate font-semibold" title={`${linha.etapa.projeto_nome} · ${linha.etapa.etapa_nome}`}>
                                  {linha.etapa.etapa_nome}
                                </div>
                                <div className="truncate text-[11px] text-muted-foreground">
                                  {linha.etapa.projeto_nome}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="ml-8 h-2 w-2 shrink-0 rounded-full border border-primary/70" />
                              <div className="min-w-0">
                                <div
                                  className="truncate font-medium"
                                  title={`${formatarNumeroOrdemProducao(linha.ordem.numero)} — ${linha.ordem.tarefa_nome_snapshot ?? 'Atividade'}`}
                                >
                                  {formatarNumeroOrdemProducao(linha.ordem.numero)} — {linha.ordem.tarefa_nome_snapshot ?? 'Atividade'}
                                </div>
                                <div className="truncate text-[11px] text-muted-foreground">
                                  {linha.etapa.etapa_nome}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {!ganttAmpliado && (
                          <div className="flex min-w-0 items-center border-r px-3 text-muted-foreground">
                            <span className="truncate" title={responsavel}>{responsavel}</span>
                          </div>
                        )}

                        {!ganttAmpliado && <div className="flex min-w-0 items-center border-r px-3">
                          {linha.tipo === 'op' ? (
                            <div className="min-w-0">
                              <div
                                className={cn(
                                  'truncate font-semibold tabular-nums',
                                  linha.ordem.mao_de_obra_utilizada != null ? 'text-foreground' : 'text-muted-foreground',
                                )}
                                title={resumoMaoDeObraUtilizada(linha.ordem) ?? 'A OP ainda não possui equipe utilizada registrada'}
                              >
                                {resumoMaoDeObraUtilizada(linha.ordem) ?? '—'}
                              </div>
                            </div>
                          ) : linha.tipo === 'etapa' ? (
                            <div className="min-w-0">
                              <div
                                className={cn(
                                  'truncate font-semibold tabular-nums',
                                  picoMaoDeObraEtapa ? 'text-foreground' : 'text-muted-foreground',
                                )}
                                title={`${resumoPicoMaoDeObraEtapa(picoMaoDeObraEtapa)}${picoMaoDeObraEtapa ? ` · Pico em ${format(picoMaoDeObraEtapa.data, 'dd/MM/yyyy')}` : ''}`}
                              >
                                {resumoPicoMaoDeObraEtapa(picoMaoDeObraEtapa)}
                              </div>
                              {picoMaoDeObraEtapa && (
                                <div className="truncate text-[10px] text-muted-foreground">
                                  pico em {format(picoMaoDeObraEtapa.data, 'dd/MM/yyyy')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>}

                        {!ganttAmpliado && (
                          <div className="flex items-center border-r px-3 font-semibold tabular-nums">
                            {`${Math.round(percentual)}%`}
                          </div>
                        )}

                        {!ganttAmpliado && (
                          <div className="flex min-w-0 items-center gap-2 px-3">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', classeEstado)} />
                            <span className="truncate" title={estado}>{estado}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="relative" style={{ width: largura }}>
                  <div
                    className="sticky top-0 z-20 border-b bg-muted/70 backdrop-blur"
                    style={{ height: GANTT_HEADER_HEIGHT }}
                  >
                    <div className="flex h-7 border-b">
                      {gruposMeses.map((grupo) => (
                        <div
                          key={grupo.chave}
                          className="flex shrink-0 items-center justify-center border-r px-2 text-[11px] font-semibold capitalize"
                          style={{ width: grupo.quantidade * pixelsPorDia }}
                        >
                          {grupo.label}
                        </div>
                      ))}
                    </div>
                    <div className="flex" style={{ height: GANTT_HEADER_HEIGHT - 28 }}>
                      {dias.map((dia) => (
                        <div
                          key={dia.toISOString()}
                          className={cn(
                            'flex shrink-0 flex-col items-center justify-center border-r text-center',
                            (isSaturday(dia) || isSunday(dia)) && 'bg-muted/60',
                            isSameDay(dia, new Date()) && 'bg-emerald-500/15',
                          )}
                          style={{ width: pixelsPorDia }}
                        >
                          <span className="text-[11px] font-semibold">{format(dia, 'dd')}</span>
                          <span className="text-[10px] uppercase text-muted-foreground">
                            {format(dia, 'EEEEE', { locale: ptBR })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {linhas.map((linha) => {
                    const intervalo = intervaloLinha(linha);
                    const intersecta = intervalo && intervalo.fim.getTime() >= periodo.inicio.getTime() && intervalo.inicio.getTime() <= periodo.fim.getTime();
                    const antesDoPeriodo = Boolean(intervalo && intervalo.fim.getTime() < periodo.inicio.getTime());
                    const inicioVisivel = intervalo && intersecta ? limitarData(intervalo.inicio, periodo.inicio, periodo.fim) : null;
                    const fimVisivel = intervalo && intersecta ? limitarData(intervalo.fim, periodo.inicio, periodo.fim) : null;
                    const esquerda = inicioVisivel ? differenceInCalendarDays(inicioVisivel, periodo.inicio) * pixelsPorDia : 0;
                    const larguraBarra = inicioVisivel && fimVisivel
                      ? Math.max(pixelsPorDia, (differenceInCalendarDays(fimVisivel, inicioVisivel) + 1) * pixelsPorDia)
                      : 0;
                    const percentual = Math.min(100, Math.max(0, Number(percentualLinha(linha) ?? 0)));
                    const status = statusLinha(linha);
                    const titulo = linha.tipo === 'peca'
                        ? linha.projetoNome
                        : linha.tipo === 'etapa'
                        ? linha.etapa.etapa_nome
                        : formatarNumeroOrdemProducao(linha.ordem.numero);
                    const classe = linha.tipo === 'etapa'
                        ? classePrazo(status, linha.etapa.data_fim_prevista, linha.etapa.data_fim_real, new Date())
                        : linha.tipo === 'op'
                          ? classePrazo(status, linha.ordem.data_fim_prevista, linha.ordem.data_fim_real, new Date())
                          : 'bg-slate-500';
                    const prazoExcedido = classe === 'bg-red-600';

                    return (
                      <div
                        key={linha.id}
                        className={cn(
                          'relative border-b',
                          linha.tipo === 'peca' ? 'bg-primary/5' : linha.tipo === 'etapa' ? 'bg-muted/10' : 'bg-card',
                        )}
                        style={{ height: alturaLinha(linha) }}
                      >
                        {dias.map((dia, indice) => (
                          <div
                            key={dia.toISOString()}
                            className={cn(
                              'absolute inset-y-0 border-r',
                              (isSaturday(dia) || isSunday(dia)) && 'bg-muted/20',
                            )}
                            style={{ left: indice * pixelsPorDia, width: pixelsPorDia }}
                          />
                        ))}
                        {hojeNaFaixa && (
                          <div
                            className="absolute inset-y-0 bg-emerald-500/10"
                            style={{ left: hojeOffset, width: pixelsPorDia }}
                          />
                        )}

                        {intervalo && intersecta && (
                          <div
                            className={cn(
                              'absolute top-2.5 flex h-7 select-none items-center overflow-hidden rounded-md text-[11px] font-bold text-white shadow-sm',
                              classe,
                              linha.tipo === 'etapa' && 'opacity-80',
                              linha.tipo === 'op' && linha.ordem.status !== 'concluida' && linha.ordem.status !== 'cancelada'
                                && 'cursor-grab active:cursor-grabbing',
                              linha.tipo === 'op' && periodosSimulados[linha.ordem.id] && 'ring-2 ring-amber-300 ring-offset-1',
                            )}
                            style={{ left: esquerda + 4, width: Math.max(28, larguraBarra - 8), touchAction: 'none' }}
                            title={`${titulo} · ${format(intervalo.inicio, 'dd/MM/yyyy')} a ${format(intervalo.fim, 'dd/MM/yyyy')} · ${Math.round(percentual)}% realizado${prazoExcedido ? ' · Prazo excedido' : ''}${linha.tipo === 'op' && resumoMaoDeObraUtilizada(linha.ordem) ? ` · ${resumoMaoDeObraUtilizada(linha.ordem)}` : ''}`}
                            onPointerDown={linha.tipo === 'op'
                              && linha.ordem.status !== 'concluida' && linha.ordem.status !== 'cancelada'
                              ? (event) => iniciarEdicaoBarra(event, linha, 'mover')
                              : undefined}
                            onPointerMove={linha.tipo === 'op' ? (event) => moverEdicaoBarra(event, linha) : undefined}
                            onPointerUp={linha.tipo === 'op' ? (event) => finalizarEdicaoBarra(event, linha) : undefined}
                            onPointerCancel={linha.tipo === 'op' ? (event) => finalizarEdicaoBarra(event, linha) : undefined}
                          >
                            {linha.tipo === 'op' && linha.ordem.status !== 'concluida' && linha.ordem.status !== 'cancelada' && (
                              <span
                                className="absolute inset-y-0 left-0 z-20 w-2 cursor-ew-resize bg-white/35 hover:bg-white/70"
                                onPointerDown={(event) => iniciarEdicaoBarra(event, linha, 'inicio')}
                                aria-label="Alterar início da OP"
                              />
                            )}
                            <span
                              className="absolute inset-y-0 left-0 bg-black/20"
                              style={{ width: `${percentual}%` }}
                            />
                            <span className="relative z-10 w-full truncate px-3 text-center">
                              {linha.tipo === 'op'
                                ? `${Math.round(percentual)}%${linha.ordem.mao_de_obra_utilizada != null ? ` · ${linha.ordem.mao_de_obra_utilizada}p` : ''}`
                                : `${Math.round(percentual)}%`}
                            </span>
                            {linha.tipo === 'op' && linha.ordem.status !== 'concluida' && linha.ordem.status !== 'cancelada' && (
                              <span
                                className="absolute inset-y-0 right-0 z-20 w-2 cursor-ew-resize bg-white/35 hover:bg-white/70"
                                onPointerDown={(event) => iniciarEdicaoBarra(event, linha, 'fim')}
                                aria-label="Alterar fim da OP"
                              />
                            )}
                          </div>
                        )}

                        {intervalo && !intersecta && (
                          <span
                            className={cn(
                              'absolute top-1/2 z-[1] -translate-y-1/2 rounded border bg-card/95 px-2 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm',
                              antesDoPeriodo ? 'left-2' : 'right-2',
                            )}
                            title={`${titulo} · fora do período exibido · ${format(intervalo.inicio, 'dd/MM/yyyy')} a ${format(intervalo.fim, 'dd/MM/yyyy')}`}
                          >
                            {antesDoPeriodo ? `← ${format(intervalo.fim, 'dd/MM')}` : `${format(intervalo.inicio, 'dd/MM')} →`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {!loading && linhas.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma atividade programada neste período.</div>}
              {loading && <div className="p-10 text-center text-sm text-muted-foreground">Carregando cronograma...</div>}
            </div>
          </Card>

        </TabsContent>

        <TabsContent value="plano-diario" className="mt-4"><PlanoDiarioProducao /></TabsContent>
        <TabsContent value="agenda" className="mt-4">
          <AgendaPlanejamentoCronograma />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmarImportacaoMSP} onOpenChange={setConfirmarImportacaoMSP}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar atividades reais do MS Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Foram analisadas {resumoImportacaoMSProjectNatal2026V24.analisadas} atividades do Natal 2026 v24.mpp. Serão importadas somente as {resumoImportacaoMSProjectNatal2026V24.aptas} aptas, com as datas do Project:
              {' '}{resumoImportacaoMSProjectNatal2026V24.porEtapa.etapa2} na Etapa 2,
              {' '}{resumoImportacaoMSProjectNatal2026V24.porEtapa.etapa3} na Etapa 3,
              {' '}{resumoImportacaoMSProjectNatal2026V24.porEtapa.etapa4} na Etapa 4 e
              {' '}{resumoImportacaoMSProjectNatal2026V24.porEtapa.etapa5} na Etapa 5. As {resumoImportacaoMSProjectNatal2026V24.bloqueadasPorConciliacao} demais foram bloqueadas: têm somente correspondência por semelhança com OPs já apontadas e não serão duplicadas.
              A operação é única e transacional; OPs, APs, histórico e PCP existentes não serão alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {erroImportacaoMSP && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Importação não executada: {erroImportacaoMSP}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importandoMSP}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void executarImportacaoMSP(); }} disabled={importandoMSP}>
              {importandoMSP && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Importar {resumoImportacaoMSProjectNatal2026V24.aptas} OPs aptas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(resumoEdicao)} onOpenChange={(aberta) => { if (!aberta) setResumoEdicao(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prévia do reajuste</DialogTitle>
            <DialogDescription>
              Esta alteração existe somente neste navegador e ainda não foi gravada no sistema.
            </DialogDescription>
          </DialogHeader>
          {resumoEdicao && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <p className="font-semibold">{formatarNumeroOrdemProducao(resumoEdicao.ordem.numero)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {resumoEdicao.tipo === 'mover' ? 'Período deslocado' : resumoEdicao.tipo === 'inicio' ? 'Data de início alterada' : 'Data de término alterada'}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Antes</p>
                    <p>{format(resumoEdicao.anterior.inicio, 'dd/MM/yyyy')} a {format(resumoEdicao.anterior.fim, 'dd/MM/yyyy')}</p>
                  </div>
                  <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-950">
                    <p className="text-xs font-semibold uppercase">Simulado</p>
                    <p>{format(resumoEdicao.novo.inicio, 'dd/MM/yyyy')} a {format(resumoEdicao.novo.fim, 'dd/MM/yyyy')}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                A etapa que contém esta OP foi redimensionada automaticamente na visualização. A gravação definitiva e o recálculo das dependências permanecerão desativados até sua aprovação do comportamento no localhost.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPeriodosSimulados((atuais) => {
                      const proximos = { ...atuais };
                      delete proximos[resumoEdicao.ordem.id];
                      return proximos;
                    });
                    setResumoEdicao(null);
                  }}
                >
                  Desfazer esta alteração
                </Button>
                <Button onClick={() => setResumoEdicao(null)}>Continuar simulando</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={configAberta} onOpenChange={setConfigAberta}>
        <DialogContent>
          <DialogHeader><DialogTitle>Capacidade e calendário</DialogTitle><DialogDescription>Esses parâmetros distribuem automaticamente as Etapas nos dias disponíveis. As OPs detalham a liberação operacional.</DialogDescription></DialogHeader>
          <div className="space-y-4 pt-3">
            <div className="space-y-2"><Label>Equipe disponível por dia</Label><Input type="number" min="0" step="0.5" value={configForm.equipe_disponivel_por_dia} onChange={(event) => setConfigForm((atual) => ({ ...atual, equipe_disponivel_por_dia: Number(event.target.value) }))} /></div>
            <div className="space-y-2"><Label>Horizonte de cálculo em dias</Label><Input type="number" min="30" max="1825" value={configForm.horizonte_dias} onChange={(event) => setConfigForm((atual) => ({ ...atual, horizonte_dias: Number(event.target.value) }))} /></div>
            <label className="flex items-center gap-3 rounded-lg border p-3"><Checkbox checked={configForm.trabalha_sabado} onCheckedChange={(checked) => setConfigForm((atual) => ({ ...atual, trabalha_sabado: checked === true }))} /><span className="text-sm">Planejar produção aos sábados</span></label>
            <label className="flex items-center gap-3 rounded-lg border p-3"><Checkbox checked={configForm.trabalha_domingo} onCheckedChange={(checked) => setConfigForm((atual) => ({ ...atual, trabalha_domingo: checked === true }))} /><span className="text-sm">Planejar produção aos domingos</span></label>
            <div className="flex justify-end"><Button onClick={() => void salvarConfig()} disabled={recalculando}>{recalculando && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}Salvar e recalcular</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
