import { useEffect, useMemo, useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useCronogramaProducao,
  type ConfiguracaoCronogramaProducao,
  type GanttEtapaProducao,
  type GanttOrdemProducao,
} from '@/hooks/useCronogramaProducao';
import { formatarNumeroOrdemProducao } from '@/hooks/useOrdensProducao';
import { cn } from '@/lib/utils';
import { PlanoDiarioProducao } from './PlanoDiarioProducao';

const LABEL_WIDTH = 340;
const ROW_HEIGHT_ETAPA = 62;
const ROW_HEIGHT_OP = 54;

type Visualizacao = '14dias' | 'semana' | 'mes';

const PIXELS_POR_DIA: Record<Visualizacao, number> = {
  '14dias': 54,
  semana: 90,
  mes: 36,
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
  rascunho: 'Rascunho',
  liberada: 'Liberada',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

interface Intervalo {
  inicio: Date;
  fim: Date;
  origem: 'real' | 'prevista';
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

type LinhaGantt = LinhaEtapa | LinhaOp;

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
  const [configForm, setConfigForm] = useState<ConfiguracaoCronogramaProducao>({
    equipe_disponivel_por_dia: 5,
    trabalha_sabado: false,
    trabalha_domingo: false,
    horizonte_dias: 365,
  });

  useEffect(() => { void listarCronograma().catch(() => undefined); }, [listarCronograma]);
  useEffect(() => { if (configuracao) setConfigForm(configuracao); }, [configuracao]);

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
          ordem.local_tipo,
          ordem.responsavel_nome,
        ]),
      ];
      return valores.filter(Boolean).some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo));
    });
  }, [busca, etapas, projetoId]);

  const linhas = useMemo<LinhaGantt[]>(() => etapasFiltradas.flatMap((etapa) => [
    { tipo: 'etapa' as const, id: `etapa-${etapa.etapa_id}`, etapa },
    ...etapa.ordens.map((ordem) => ({ tipo: 'op' as const, id: `op-${ordem.id}`, etapa, ordem })),
  ]), [etapasFiltradas]);

  const periodo = useMemo(() => calcularPeriodo(visualizacao, deslocamento), [deslocamento, visualizacao]);
  const pixelsPorDia = PIXELS_POR_DIA[visualizacao];
  const dias = useMemo(() => {
    const total = differenceInCalendarDays(periodo.fim, periodo.inicio) + 1;
    return Array.from({ length: total }, (_, indice) => addDays(periodo.inicio, indice));
  }, [periodo]);
  const largura = dias.length * pixelsPorDia;
  const hojeOffset = differenceInCalendarDays(new Date(), periodo.inicio) * pixelsPorDia;
  const hojeNaFaixa = hojeOffset >= 0 && hojeOffset < largura;
  const totalOps = etapasFiltradas.reduce((soma, etapa) => soma + etapa.ordens.length, 0);
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

  const intervaloLinha = (linha: LinhaGantt) => linha.tipo === 'etapa'
    ? intervaloEtapa(linha.etapa)
    : intervaloOrdem(linha.ordem);

  const percentualLinha = (linha: LinhaGantt) => linha.tipo === 'etapa'
    ? linha.etapa.percentual_realizado
    : linha.ordem.percentual_realizado;

  const statusLinha = (linha: LinhaGantt) => linha.tipo === 'etapa'
    ? linha.etapa.status
    : linha.ordem.status;

  const alturaLinha = (linha: LinhaGantt) => linha.tipo === 'etapa' ? ROW_HEIGHT_ETAPA : ROW_HEIGHT_OP;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Cronograma de Produção</h3>
          <p className="text-sm text-muted-foreground">
            A Etapa consolida o planejamento. Cada OP aparece abaixo dela e recebe o progresso dos apontamentos conferidos.
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
        <Card className="p-4"><p className="text-xs text-muted-foreground">Etapas visíveis</p><p className="text-2xl font-bold">{etapasFiltradas.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">OPs visíveis</p><p className="text-2xl font-bold">{totalOps}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Alertas críticos</p><p className={cn('text-2xl font-bold', alertasAltos > 0 && 'text-destructive')}>{alertasAltos}</p></Card>
      </div>

      <Tabs defaultValue="gantt">
        <TabsList><TabsTrigger value="gantt">Gantt</TabsTrigger><TabsTrigger value="plano-diario">Plano Diário</TabsTrigger></TabsList>

        <TabsContent value="gantt" className="mt-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b p-3 print:hidden">
              <Select value={projetoId} onValueChange={setProjetoId}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todos os projetos</SelectItem>{projetos.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}</SelectContent>
              </Select>
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar etapa, OP, projeto, responsável ou cidade" />
              </div>
              <Select value={visualizacao} onValueChange={selecionarVisualizacao}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="14dias">14 dias</SelectItem><SelectItem value="semana">Semana</SelectItem><SelectItem value="mes">Mês</SelectItem></SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => setDeslocamento((valor) => valor - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => setDeslocamento(0)}><CalendarDays className="mr-2 h-4 w-4" />Hoje</Button>
              <Button variant="outline" size="icon" onClick={() => setDeslocamento((valor) => valor + 1)}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir / PDF</Button>
            </div>

            <div className="border-b bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
              {format(periodo.inicio, "dd 'de' MMMM", { locale: ptBR })} a {format(periodo.fim, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · cada coluna representa um dia
            </div>

            <div className="max-h-[70vh] overflow-auto">
              <div className="flex" style={{ width: LABEL_WIDTH + largura }}>
                <div className="sticky left-0 z-20 shrink-0 border-r bg-card" style={{ width: LABEL_WIDTH }}>
                  <div className="flex h-16 items-end border-b bg-muted/50 px-3 pb-2 text-xs font-semibold">Projeto / Etapa / Ordem de Produção</div>
                  {linhas.map((linha) => (
                    <div key={linha.id} className={cn('flex flex-col justify-center border-b px-3', linha.tipo === 'op' && 'bg-muted/10 pl-9')} style={{ height: alturaLinha(linha) }}>
                      {linha.tipo === 'etapa' ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold">{linha.etapa.codigo} · {linha.etapa.etapa_nome}</span>
                            <span className="shrink-0 text-[9px] text-muted-foreground">{statusEtapaLabel[linha.etapa.status] ?? linha.etapa.status}</span>
                          </div>
                          <span className="truncate text-[10px] text-muted-foreground">{linha.etapa.projeto_nome} · {linha.etapa.ordens.length} OP(s)</span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-medium">↳ {formatarNumeroOrdemProducao(linha.ordem.numero)}</span>
                            <span className="shrink-0 text-[9px] text-muted-foreground">{statusOpLabel[linha.ordem.status] ?? linha.ordem.status}</span>
                          </div>
                          <span className="truncate text-[10px] text-muted-foreground">{linha.ordem.local_tipo}{linha.ordem.responsavel_nome ? ` · ${linha.ordem.responsavel_nome}` : ''} · {linha.ordem.quantidade_realizada}/{linha.ordem.quantidade_planejada}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="relative" style={{ width: largura }}>
                  <div className="sticky top-0 z-10 flex h-16 border-b bg-muted/50">
                    {dias.map((dia) => (
                      <div
                        key={dia.toISOString()}
                        className={cn(
                          'flex shrink-0 flex-col items-center justify-center border-r text-center',
                          (isSaturday(dia) || isSunday(dia)) && 'bg-muted',
                          isSameDay(dia, new Date()) && 'bg-emerald-500/15',
                        )}
                        style={{ width: pixelsPorDia }}
                      >
                        <span className="text-[9px] font-semibold">{format(dia, 'EEE', { locale: ptBR }).replace('.', '')}</span>
                        <span className="text-[9px] text-muted-foreground">{format(dia, 'dd/MM')}</span>
                      </div>
                    ))}
                  </div>

                  {linhas.map((linha) => {
                    const intervalo = intervaloLinha(linha);
                    const intersecta = intervalo && intervalo.fim.getTime() >= periodo.inicio.getTime() && intervalo.inicio.getTime() <= periodo.fim.getTime();
                    const inicioVisivel = intervalo && intersecta ? limitarData(intervalo.inicio, periodo.inicio, periodo.fim) : null;
                    const fimVisivel = intervalo && intersecta ? limitarData(intervalo.fim, periodo.inicio, periodo.fim) : null;
                    const esquerda = inicioVisivel ? differenceInCalendarDays(inicioVisivel, periodo.inicio) * pixelsPorDia : 0;
                    const larguraBarra = inicioVisivel && fimVisivel
                      ? Math.max(pixelsPorDia, (differenceInCalendarDays(fimVisivel, inicioVisivel) + 1) * pixelsPorDia)
                      : 0;
                    const percentual = percentualLinha(linha);
                    const status = statusLinha(linha);
                    const titulo = linha.tipo === 'etapa'
                      ? `${linha.etapa.codigo} · ${linha.etapa.etapa_nome}`
                      : formatarNumeroOrdemProducao(linha.ordem.numero);
                    const classe = linha.tipo === 'etapa'
                      ? statusEtapaClass[status] ?? 'bg-slate-500'
                      : statusOpClass[status] ?? 'bg-indigo-500';

                    return (
                      <div key={linha.id} className={cn('relative border-b', linha.tipo === 'op' && 'bg-muted/5')} style={{ height: alturaLinha(linha) }}>
                        {dias.map((dia, indice) => <div key={dia.toISOString()} className={cn('absolute inset-y-0 border-r', (isSaturday(dia) || isSunday(dia)) && 'bg-muted/20')} style={{ left: indice * pixelsPorDia, width: pixelsPorDia }} />)}
                        {hojeNaFaixa && <div className="absolute inset-y-0 bg-emerald-500/10" style={{ left: hojeOffset, width: pixelsPorDia }} />}
                        {intervalo && intersecta && (
                          <div
                            className={cn('absolute flex items-center overflow-hidden rounded text-[10px] font-semibold text-white shadow-sm', classe, linha.tipo === 'etapa' ? 'top-3 h-9' : 'top-3 h-7')}
                            style={{ left: esquerda, width: larguraBarra }}
                            title={`${titulo} · ${intervalo.origem === 'real' ? 'período realizado' : 'período previsto'} · ${format(intervalo.inicio, 'dd/MM/yyyy')} a ${format(intervalo.fim, 'dd/MM/yyyy')} · ${percentual}% realizado`}
                          >
                            <span className="relative z-10 truncate px-2">{linha.tipo === 'op' ? `${formatarNumeroOrdemProducao(linha.ordem.numero)} · ` : ''}{percentual}%</span>
                            <span className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${Math.min(100, percentual)}%` }} />
                          </div>
                        )}
                        {!intervalo && <span className="absolute left-3 top-5 text-[10px] text-muted-foreground">Sem datas de planejamento ou execução</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              {!loading && linhas.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma etapa ou OP encontrada para os filtros informados.</div>}
              {loading && <div className="p-10 text-center text-sm text-muted-foreground">Carregando cronograma...</div>}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="plano-diario" className="mt-4"><PlanoDiarioProducao /></TabsContent>
      </Tabs>

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
