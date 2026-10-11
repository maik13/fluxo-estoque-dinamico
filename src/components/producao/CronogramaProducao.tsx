import { useEffect, useMemo, useRef, useState } from 'react';
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
  RefreshCw,
  Search,
  Settings2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useCronogramaProducao,
  type ConfiguracaoCronogramaProducao,
  type GanttOrdemProducao,
} from '@/hooks/useCronogramaProducao';
import { formatarIdentificacaoOrdemProducao, formatarNumeroOrdemProducao } from '@/hooks/useOrdensProducao';
import { cn } from '@/lib/utils';
import { PlanoDiarioProducao } from './PlanoDiarioProducao';
import { AgendaPlanejamentoCronograma } from './AgendaPlanejamentoCronograma';
import { CronogramaMSProjectImportado } from './CronogramaMSProjectImportado';

const TASK_COLUMN_WIDTH = 330;
const ASSIGNEE_COLUMN_WIDTH = 150;
const PROGRESS_COLUMN_WIDTH = 100;
const STATE_COLUMN_WIDTH = 140;
const LABEL_WIDTH =
  TASK_COLUMN_WIDTH + ASSIGNEE_COLUMN_WIDTH + PROGRESS_COLUMN_WIDTH + STATE_COLUMN_WIDTH;
const ROW_HEIGHT_PROJETO = 42;
const ROW_HEIGHT_OP = 52;
const GANTT_HEADER_HEIGHT = 76;

type Visualizacao = '14dias' | 'semana' | 'mes';

const PIXELS_POR_DIA: Record<Visualizacao, number> = {
  '14dias': 84,
  semana: 120,
  mes: 68,
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

interface LinhaProjeto {
  tipo: 'projeto';
  id: string;
  projetoId: string;
  projetoNome: string;
  cidade: string | null;
}

interface LinhaOp {
  tipo: 'op';
  id: string;
  projetoId: string;
  projetoNome: string;
  ordem: GanttOrdemProducao;
}

type LinhaGantt = LinhaProjeto | LinhaOp;

const dataValida = (valor: string | null | undefined) => valor ? parseISO(valor) : null;

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

  const inicio = encerrado ? inicioReal ?? inicioPrevisto : inicioPrevisto ?? inicioReal;
  const fimBruto = encerrado ? fimReal ?? fimPrevisto ?? inicio : fimPrevisto ?? fimReal ?? inicio;
  if (!inicio || !fimBruto) return null;
  return {
    inicio,
    fim: fimBruto.getTime() < inicio.getTime() ? inicio : fimBruto,
    origem: encerrado && Boolean(inicioReal || fimReal) ? 'real' : 'prevista',
  };
};

const intervaloOrdem = (ordem: GanttOrdemProducao) => normalizarIntervalo(
  ordem.data_inicio_real,
  ordem.data_fim_real,
  ordem.data_inicio_prevista,
  ordem.data_fim_prevista,
  ordem.status === 'concluida' || ordem.status === 'cancelada',
);

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
  const [projetosRecolhidos, setProjetosRecolhidos] = useState<Set<string>>(() => new Set());
  const [larguraViewport, setLarguraViewport] = useState(0);
  const ganttViewportRef = useRef<HTMLDivElement>(null);
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

  const opsProgramadas = useMemo<LinhaOp[]>(() => etapasFiltradas.flatMap((etapa) =>
    etapa.ordens
      .filter((ordem) => ordem.status !== 'cancelada' && Boolean(intervaloOrdem(ordem)))
      .map((ordem) => ({
        tipo: 'op' as const,
        id: `op-${ordem.id}`,
        projetoId: etapa.projeto_id,
        projetoNome: etapa.projeto_nome,
        ordem,
      })),
  ), [etapasFiltradas]);

  const semProgramacao = useMemo(() => etapasFiltradas.flatMap((etapa) => {
    const ordensAtivas = etapa.ordens.filter((ordem) => ordem.status !== 'cancelada');
    return ordensAtivas
      .filter((ordem) => !intervaloOrdem(ordem))
      .map((ordem) => ({
        id: `op-${ordem.id}`,
        titulo: formatarIdentificacaoOrdemProducao(ordem),
        projeto: etapa.projeto_nome,
        etapa: 'OP sem período definido',
      }));
  }), [etapasFiltradas]);

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

  const alternarProjeto = (projetoId: string) => {
    setProjetosRecolhidos((atuais) => {
      const proximo = new Set(atuais);
      if (proximo.has(projetoId)) proximo.delete(projetoId);
      else proximo.add(projetoId);
      return proximo;
    });
  };

  const expandirTudo = () => setProjetosRecolhidos(new Set());
  const recolherTudo = () => setProjetosRecolhidos(new Set(opsProgramadas.map((op) => op.projetoId)));

  const larguraMinima = dias.length * pixelsPorDiaBase;
  const larguraTimelineDisponivel = Math.max(0, larguraViewport - LABEL_WIDTH);
  const pixelsPorDia = visualizacao === 'semana' && larguraTimelineDisponivel > larguraMinima
    ? larguraTimelineDisponivel / dias.length
    : pixelsPorDiaBase;
  const largura = dias.length * pixelsPorDia;
  const hojeIndice = differenceInCalendarDays(new Date(), periodo.inicio);
  const hojeOffset = hojeIndice * pixelsPorDia;
  const hojeNaFaixa = hojeIndice >= 0 && hojeIndice < dias.length;
  const opsVisiveis = useMemo(
    () => opsProgramadas.filter((linha) => {
      const intervalo = intervaloOrdem(linha.ordem);
      return Boolean(
        (mostrarConcluidas || linha.ordem.status !== 'concluida')
        && intervalo
        && intervalo.fim.getTime() >= periodo.inicio.getTime()
        && intervalo.inicio.getTime() <= periodo.fim.getTime(),
      );
    }),
    [mostrarConcluidas, opsProgramadas, periodo.fim, periodo.inicio],
  );

  const linhas = useMemo<LinhaGantt[]>(() => {
    const porProjeto = new Map<string, LinhaOp[]>();
    opsVisiveis.forEach((op) => {
      const grupo = porProjeto.get(op.projetoId) ?? [];
      grupo.push(op);
      porProjeto.set(op.projetoId, grupo);
    });

    return [...porProjeto.entries()]
      .sort(([, opsA], [, opsB]) => opsA[0].projetoNome.localeCompare(opsB[0].projetoNome, 'pt-BR'))
      .flatMap(([id, ops]) => {
        const ordenadas = [...ops].sort((a, b) => {
          const inicioA = intervaloOrdem(a.ordem)?.inicio.getTime() ?? 0;
          const inicioB = intervaloOrdem(b.ordem)?.inicio.getTime() ?? 0;
          return inicioA - inicioB || a.ordem.numero - b.ordem.numero;
        });
        const cabecalho: LinhaProjeto = {
          tipo: 'projeto',
          id: `projeto-${id}`,
          projetoId: id,
          projetoNome: ordenadas[0].projetoNome,
          cidade: etapasFiltradas.find((etapa) => etapa.projeto_id === id)?.cidade ?? null,
        };
        return [cabecalho, ...(projetosRecolhidos.has(id) ? [] : ordenadas)];
      });
  }, [etapasFiltradas, opsVisiveis, projetosRecolhidos]);
  const alertasAltos = alertas.filter((alerta) => alerta.severidade === 'alta').length;

  const salvarConfig = async () => {
    if (!Number.isFinite(configForm.equipe_disponivel_por_dia) || configForm.equipe_disponivel_por_dia < 0) {
      alert('Equipe disponível inválida.');
      return;
    }
    await salvarConfiguracao(configForm);
    setConfigAberta(false);
  };

  const selecionarVisualizacao = (valor: string) => {
    setVisualizacao(valor as Visualizacao);
    setDeslocamento(0);
  };

  const alturaLinha = (linha: LinhaGantt) => linha.tipo === 'projeto' ? ROW_HEIGHT_PROJETO : ROW_HEIGHT_OP;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Cronograma de Produção</h3>
          <p className="text-sm text-muted-foreground">
            Visão operacional por projeto: mostra somente as OPs programadas ou em execução. Concluídas podem ser exibidas pelo filtro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setConfigAberta(true)}><Settings2 className="mr-2 h-4 w-4" />Capacidade e calendário</Button>
          <Button onClick={() => void recalcularCronograma()} disabled={recalculando}><RefreshCw className={cn('mr-2 h-4 w-4', recalculando && 'animate-spin')} />Recalcular</Button>
        </div>
      </div>

      {erro && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{erro}. Confirme se as migrations do cronograma e das OPs foram aplicadas.</AlertDescription></Alert>}
      {alertasAltos > 0 && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>O cronograma possui {alertasAltos} alerta(s) crítico(s). Verifique prazo, capacidade e quantidade não alocada.</AlertDescription></Alert>}

      <div className="grid gap-3 sm:grid-cols-4 print:hidden">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Equipe disponível/dia</p><p className="text-2xl font-bold">{configuracao?.equipe_disponivel_por_dia ?? '—'}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">OPs programadas no período</p><p className="text-2xl font-bold">{opsVisiveis.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Sem programação</p><p className="text-2xl font-bold">{semProgramacao.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Alertas críticos</p><p className={cn('text-2xl font-bold', alertasAltos > 0 && 'text-destructive')}>{alertasAltos}</p></Card>
      </div>

      <Tabs defaultValue="gantt">
        <TabsList>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
          <TabsTrigger value="project">Plano do Project</TabsTrigger>
          <TabsTrigger value="plano-diario">Plano Diário</TabsTrigger>
          <TabsTrigger value="agenda">Marcos</TabsTrigger>
        </TabsList>

        <TabsContent value="gantt" className="mt-4">
          <Card className="gantt-print-area overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b p-3 print:hidden">
              <Button variant="ghost" size="sm" onClick={expandirTudo}>
                <ChevronsDown className="mr-2 h-4 w-4" />Expandir projetos
              </Button>
              <Button variant="ghost" size="sm" onClick={recolherTudo}>
                <ChevronsUp className="mr-2 h-4 w-4" />Recolher projetos
              </Button>
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
                <Input className="pl-9" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar OP, projeto, responsável ou cidade" />
              </div>
              <Select value={visualizacao} onValueChange={selecionarVisualizacao}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="14dias">14 dias</SelectItem><SelectItem value="semana">Semana</SelectItem><SelectItem value="mes">Mês</SelectItem></SelectContent>
              </Select>
              <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                <Checkbox checked={mostrarConcluidas} onCheckedChange={(checked) => setMostrarConcluidas(checked === true)} />
                Mostrar concluídas
              </label>
              <Button variant="outline" size="icon" onClick={() => setDeslocamento((valor) => valor - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => setDeslocamento(0)}><CalendarDays className="mr-2 h-4 w-4" />Hoje</Button>
              <Button variant="outline" size="icon" onClick={() => setDeslocamento((valor) => valor + 1)}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir / PDF</Button>
            </div>

            <div className="border-b bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
              {format(periodo.inicio, "dd 'de' MMMM", { locale: ptBR })} a {format(periodo.fim, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · cada coluna representa um dia
            </div>

            <div ref={ganttViewportRef} className="gantt-scroll max-h-[76vh] overflow-auto">
              <div className="flex" style={{ width: LABEL_WIDTH + largura }}>
                <div className="sticky left-0 z-30 shrink-0 border-r bg-card" style={{ width: LABEL_WIDTH }}>
                  <div
                    className="sticky top-0 z-40 grid border-b bg-muted/70 text-xs font-semibold backdrop-blur"
                    style={{
                      height: GANTT_HEADER_HEIGHT,
                      gridTemplateColumns: `${TASK_COLUMN_WIDTH}px ${ASSIGNEE_COLUMN_WIDTH}px ${PROGRESS_COLUMN_WIDTH}px ${STATE_COLUMN_WIDTH}px`,
                    }}
                  >
                    <div className="flex items-end border-r px-3 pb-3">Nome da tarefa</div>
                    <div className="flex items-end border-r px-3 pb-3">Atribuído</div>
                    <div className="flex items-end border-r px-3 pb-3">Progresso</div>
                    <div className="flex items-end px-3 pb-3">Estado</div>
                  </div>

                  {linhas.map((linha) => {
                    if (linha.tipo === 'projeto') {
                      const recolhido = projetosRecolhidos.has(linha.projetoId);
                      return (
                        <div
                          key={linha.id}
                          className="grid border-b bg-muted/35 text-xs font-medium"
                          style={{
                            height: alturaLinha(linha),
                            gridTemplateColumns: `${TASK_COLUMN_WIDTH}px ${ASSIGNEE_COLUMN_WIDTH}px ${PROGRESS_COLUMN_WIDTH}px ${STATE_COLUMN_WIDTH}px`,
                          }}
                        >
                          <div className="col-span-4 flex min-w-0 items-center gap-2 px-3">
                            <button
                              type="button"
                              onClick={() => alternarProjeto(linha.projetoId)}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-muted"
                              aria-label={recolhido ? 'Expandir projeto' : 'Recolher projeto'}
                            >
                              <ChevronDown className={cn('h-4 w-4 transition-transform', recolhido && '-rotate-90')} />
                            </button>
                            <span className="truncate font-semibold" title={linha.projetoNome}>{linha.projetoNome}</span>
                            {linha.cidade && <span className="truncate text-[11px] text-muted-foreground">· {linha.cidade}</span>}
                          </div>
                        </div>
                      );
                    }

                    const percentual = Math.min(100, Math.max(0, Number(linha.ordem.percentual_realizado ?? 0)));
                    const estado = linha.ordem.status === 'em_execucao' && percentual >= 100
                      ? '100% · aguardando conclusão'
                      : statusOpLabel[linha.ordem.status] ?? linha.ordem.status;
                    const responsavel = linha.ordem.responsavel_nome || 'não atribuído';
                    const classeEstado = statusOpClass[linha.ordem.status] ?? 'bg-indigo-500';

                    return (
                      <div
                        key={linha.id}
                        className="grid border-b bg-card text-xs"
                        style={{
                          height: alturaLinha(linha),
                          gridTemplateColumns: `${TASK_COLUMN_WIDTH}px ${ASSIGNEE_COLUMN_WIDTH}px ${PROGRESS_COLUMN_WIDTH}px ${STATE_COLUMN_WIDTH}px`,
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-2 border-r px-3">
                          <span className="ml-2 h-2 w-2 shrink-0 rounded-full border border-primary/70" />
                          <div className="min-w-0">
                            <div className="truncate font-medium" title={`${formatarNumeroOrdemProducao(linha.ordem.numero)} — ${linha.ordem.tarefa_nome_snapshot ?? 'Atividade'}`}>
                              {formatarNumeroOrdemProducao(linha.ordem.numero)} — {linha.ordem.tarefa_nome_snapshot ?? 'Atividade'}
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">{linha.ordem.local_tipo}</div>
                          </div>
                        </div>
                        <div className="flex min-w-0 items-center border-r px-3 text-muted-foreground"><span className="truncate" title={responsavel}>{responsavel}</span></div>
                        <div className="flex items-center border-r px-3 font-semibold tabular-nums">{Math.round(percentual)}%</div>
                        <div className="flex min-w-0 items-center gap-2 px-3"><span className={cn('h-2 w-2 shrink-0 rounded-full', classeEstado)} /><span className="truncate" title={estado}>{estado}</span></div>
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
                    if (linha.tipo === 'projeto') {
                      return (
                        <div
                          key={linha.id}
                          className="relative border-b bg-muted/20"
                          style={{ height: alturaLinha(linha) }}
                        >
                          {dias.map((dia, indice) => (
                            <div
                              key={dia.toISOString()}
                              className="absolute inset-y-0 border-r"
                              style={{ left: indice * pixelsPorDia, width: pixelsPorDia }}
                            />
                          ))}
                        </div>
                      );
                    }

                    const intervalo = intervaloOrdem(linha.ordem);
                    const intersecta = intervalo && intervalo.fim.getTime() >= periodo.inicio.getTime() && intervalo.inicio.getTime() <= periodo.fim.getTime();
                    const antesDoPeriodo = Boolean(intervalo && intervalo.fim.getTime() < periodo.inicio.getTime());
                    const inicioVisivel = intervalo && intersecta ? limitarData(intervalo.inicio, periodo.inicio, periodo.fim) : null;
                    const fimVisivel = intervalo && intersecta ? limitarData(intervalo.fim, periodo.inicio, periodo.fim) : null;
                    const esquerda = inicioVisivel ? differenceInCalendarDays(inicioVisivel, periodo.inicio) * pixelsPorDia : 0;
                    const larguraBarra = inicioVisivel && fimVisivel
                      ? Math.max(pixelsPorDia, (differenceInCalendarDays(fimVisivel, inicioVisivel) + 1) * pixelsPorDia)
                      : 0;
                    const percentual = Math.min(100, Math.max(0, Number(linha.ordem.percentual_realizado ?? 0)));
                    const titulo = formatarNumeroOrdemProducao(linha.ordem.numero);
                    const classe = statusOpClass[linha.ordem.status] ?? 'bg-indigo-500';

                    return (
                      <div
                        key={linha.id}
                        className="relative border-b bg-card"
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
                              'absolute top-2.5 flex h-7 items-center overflow-hidden rounded-md text-[11px] font-bold text-white shadow-sm',
                              classe,
                            )}
                            style={{ left: esquerda + 4, width: Math.max(28, larguraBarra - 8) }}
                            title={`${titulo} · ${format(intervalo.inicio, 'dd/MM/yyyy')} a ${format(intervalo.fim, 'dd/MM/yyyy')} · ${Math.round(percentual)}% realizado`}
                          >
                            <span
                              className="absolute inset-y-0 left-0 bg-black/20"
                              style={{ width: `${percentual}%` }}
                            />
                            <span className="relative z-10 w-full truncate px-2 text-center">
                              {Math.round(percentual)}%
                            </span>
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

          {!loading && semProgramacao.length > 0 && (
            <Card className="mt-4 p-4 print:hidden">
              <div className="mb-3">
                <h4 className="text-sm font-semibold">Sem programação ({semProgramacao.length})</h4>
                <p className="text-xs text-muted-foreground">Itens sem início e fim definidos não ocupam linhas do cronograma visual.</p>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {semProgramacao.map((item) => (
                  <div key={item.id} className="rounded-md border bg-muted/10 px-3 py-2">
                    <div className="truncate text-sm font-medium">{item.titulo}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.projeto} · {item.etapa}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="project" className="mt-4">
          <CronogramaMSProjectImportado />
        </TabsContent>

        <TabsContent value="plano-diario" className="mt-4"><PlanoDiarioProducao /></TabsContent>
        <TabsContent value="agenda" className="mt-4">
          <AgendaPlanejamentoCronograma />
        </TabsContent>
      </Tabs>

      <Dialog open={configAberta} onOpenChange={setConfigAberta}>
        <DialogContent>
          <DialogHeader><DialogTitle>Capacidade e calendário</DialogTitle><DialogDescription>Esses parâmetros apoiam o planejamento das OPs nos dias disponíveis.</DialogDescription></DialogHeader>
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
