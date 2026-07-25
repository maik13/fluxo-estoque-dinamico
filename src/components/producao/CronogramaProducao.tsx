import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSaturday,
  isSunday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Printer, Search, RefreshCw, Settings2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCronogramaProducao, type ConfiguracaoCronogramaProducao, type GanttEtapaProducao } from '@/hooks/useCronogramaProducao';
import { cn } from '@/lib/utils';
import { PlanoDiarioProducao } from './PlanoDiarioProducao';

const LABEL_WIDTH = 300;
const ROW_HEIGHT = 58;

type Zoom = 'dia' | 'semana' | 'mes';

const ESCALAS: Record<Zoom, { pixelsPorDia: number; minimoDias: number; passoNavegacao: number; margem: number }> = {
  dia: { pixelsPorDia: 58, minimoDias: 45, passoNavegacao: 14, margem: 3 },
  semana: { pixelsPorDia: 18, minimoDias: 112, passoNavegacao: 28, margem: 7 },
  mes: { pixelsPorDia: 6, minimoDias: 365, passoNavegacao: 90, margem: 31 },
};

const statusClass: Record<string, string> = {
  planejado: 'bg-slate-500',
  em_andamento: 'bg-emerald-500',
  pausado: 'bg-amber-500',
  bloqueado: 'bg-red-500',
  finalizado: 'bg-blue-500',
  cancelado: 'bg-zinc-500',
};

const statusLabel: Record<string, string> = {
  planejado: 'Planejada',
  em_andamento: 'Em andamento',
  pausado: 'Pausada',
  bloqueado: 'Bloqueada',
  finalizado: 'Concluída',
  cancelado: 'Cancelada',
};

interface IntervaloEtapa {
  inicio: Date;
  fim: Date;
  origem: 'real' | 'prevista';
}

interface SegmentoTempo {
  chave: string;
  inicio: Date;
  fim: Date;
  largura: number;
  titulo: string;
  subtitulo: string;
  diaUnico: boolean;
}

const obterIntervaloEtapa = (etapa: GanttEtapaProducao): IntervaloEtapa | null => {
  const encerrada = etapa.status === 'finalizado' || etapa.status === 'cancelado';

  const inicioReal = etapa.data_inicio_real ?? etapa.data_fim_real;
  const fimReal = etapa.data_fim_real ?? etapa.data_inicio_real;
  const inicioPrevisto = etapa.data_inicio_prevista ?? etapa.data_inicio_desejada;
  const fimPrevisto = etapa.data_fim_prevista ?? etapa.data_limite ?? inicioPrevisto;

  const inicioTexto = encerrada
    ? inicioReal ?? inicioPrevisto
    : inicioPrevisto ?? inicioReal;
  const fimTexto = encerrada
    ? fimReal ?? fimPrevisto ?? inicioTexto
    : fimPrevisto ?? fimReal ?? inicioTexto;

  if (!inicioTexto || !fimTexto) return null;

  const inicio = parseISO(inicioTexto);
  const fimCalculado = parseISO(fimTexto);
  const fim = fimCalculado.getTime() < inicio.getTime() ? inicio : fimCalculado;

  return {
    inicio,
    fim,
    origem: encerrada && Boolean(inicioReal || fimReal) ? 'real' : 'prevista',
  };
};

const limitarData = (data: Date, minimo: Date, maximo: Date) => {
  if (data.getTime() < minimo.getTime()) return minimo;
  if (data.getTime() > maximo.getTime()) return maximo;
  return data;
};

const criarSegmentos = (inicio: Date, fim: Date, zoom: Zoom, pixelsPorDia: number): SegmentoTempo[] => {
  const segmentos: SegmentoTempo[] = [];
  let cursor = zoom === 'semana'
    ? startOfWeek(inicio, { weekStartsOn: 1 })
    : zoom === 'mes'
      ? startOfMonth(inicio)
      : inicio;

  while (cursor.getTime() <= fim.getTime()) {
    const fimBruto = zoom === 'semana'
      ? endOfWeek(cursor, { weekStartsOn: 1 })
      : zoom === 'mes'
        ? endOfMonth(cursor)
        : cursor;

    const inicioSegmento = limitarData(cursor, inicio, fim);
    const fimSegmento = limitarData(fimBruto, inicio, fim);
    const dias = differenceInCalendarDays(fimSegmento, inicioSegmento) + 1;

    let titulo: string;
    let subtitulo: string;

    if (zoom === 'dia') {
      titulo = format(inicioSegmento, 'EEE', { locale: ptBR }).replace('.', '');
      subtitulo = format(inicioSegmento, 'dd/MM');
    } else if (zoom === 'semana') {
      titulo = `Semana ${format(cursor, 'II')}`;
      subtitulo = `${format(inicioSegmento, 'dd MMM', { locale: ptBR })} – ${format(fimSegmento, 'dd MMM', { locale: ptBR })}`;
    } else {
      titulo = format(cursor, 'MMMM yyyy', { locale: ptBR });
      subtitulo = `${dias} dia${dias === 1 ? '' : 's'} visíveis`;
    }

    segmentos.push({
      chave: `${zoom}-${cursor.toISOString()}`,
      inicio: inicioSegmento,
      fim: fimSegmento,
      largura: dias * pixelsPorDia,
      titulo,
      subtitulo,
      diaUnico: zoom === 'dia',
    });

    cursor = addDays(fimBruto, 1);
  }

  return segmentos;
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
  const [zoom, setZoom] = useState<Zoom>('semana');
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

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return etapas.filter((etapa) =>
      (projetoId === 'todos' || etapa.projeto_id === projetoId) &&
      (!termo || [etapa.codigo, etapa.etapa_nome, etapa.projeto_nome, etapa.grupo_cronograma, etapa.cidade, etapa.uf]
        .filter(Boolean)
        .some((valor) => String(valor).toLocaleLowerCase('pt-BR').includes(termo))),
    );
  }, [busca, etapas, projetoId]);

  const escala = ESCALAS[zoom];

  const linhaDoTempo = useMemo(() => {
    const hoje = new Date();
    const intervalos = filtradas
      .map(obterIntervaloEtapa)
      .filter((intervalo): intervalo is IntervaloEtapa => Boolean(intervalo));

    const datas = intervalos.flatMap((intervalo) => [intervalo.inicio, intervalo.fim]);
    const menorData = datas.length
      ? new Date(Math.min(hoje.getTime(), ...datas.map((data) => data.getTime())))
      : hoje;
    const maiorData = datas.length
      ? new Date(Math.max(hoje.getTime(), ...datas.map((data) => data.getTime())))
      : hoje;

    const inicioBruto = addDays(menorData, -escala.margem + deslocamento);
    const inicio = zoom === 'semana'
      ? startOfWeek(inicioBruto, { weekStartsOn: 1 })
      : zoom === 'mes'
        ? startOfMonth(inicioBruto)
        : inicioBruto;

    const fimMinimo = addDays(inicio, escala.minimoDias - 1);
    const fimDosDados = addDays(maiorData, escala.margem);
    const fim = fimDosDados.getTime() > fimMinimo.getTime() ? fimDosDados : fimMinimo;
    const totalDias = differenceInCalendarDays(fim, inicio) + 1;
    const largura = totalDias * escala.pixelsPorDia;

    return {
      inicio,
      fim,
      largura,
      segmentos: criarSegmentos(inicio, fim, zoom, escala.pixelsPorDia),
    };
  }, [deslocamento, escala, filtradas, zoom]);

  const alertasAltos = alertas.filter((alerta) => alerta.severidade === 'alta').length;
  const hojeOffset = differenceInCalendarDays(new Date(), linhaDoTempo.inicio) * escala.pixelsPorDia;
  const hojeNaFaixa = hojeOffset >= 0 && hojeOffset < linhaDoTempo.largura;

  const salvarConfig = async () => {
    if (!Number.isFinite(configForm.equipe_disponivel_por_dia) || configForm.equipe_disponivel_por_dia < 0) {
      alert('Equipe disponível inválida.');
      return;
    }
    await salvarConfiguracao(configForm);
    setConfigAberta(false);
  };

  const alterarZoom = (valor: string) => {
    setZoom(valor as Zoom);
    setDeslocamento(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Cronograma de Produção</h3>
          <p className="text-sm text-muted-foreground">Etapas são a fonte única; o sistema calcula Gantt, capacidade e Plano Diário.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setConfigAberta(true)}><Settings2 className="mr-2 h-4 w-4" />Capacidade e calendário</Button>
          <Button onClick={() => void recalcularCronograma()} disabled={recalculando}><RefreshCw className={cn('mr-2 h-4 w-4', recalculando && 'animate-spin')} />Recalcular</Button>
        </div>
      </div>

      {erro && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{erro}. Confirme se as migrations do cronograma foram aplicadas.</AlertDescription></Alert>}
      {alertasAltos > 0 && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>O cronograma possui {alertasAltos} alerta(s) crítico(s). Verifique etapas sem parâmetros, prazo ultrapassado ou quantidade não alocada.</AlertDescription></Alert>}

      <div className="grid gap-3 sm:grid-cols-4 print:hidden">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Equipe disponível/dia</p><p className="text-2xl font-bold">{configuracao?.equipe_disponivel_por_dia ?? '—'}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Etapas no cronograma</p><p className="text-2xl font-bold">{etapas.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Alertas críticos</p><p className={cn('text-2xl font-bold', alertasAltos > 0 && 'text-destructive')}>{alertasAltos}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Calendário</p><p className="text-sm font-semibold">Sáb: {configuracao?.trabalha_sabado ? 'Sim' : 'Não'} · Dom: {configuracao?.trabalha_domingo ? 'Sim' : 'Não'}</p></Card>
      </div>

      <Tabs defaultValue="gantt">
        <TabsList>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
          <TabsTrigger value="plano-diario">Plano Diário</TabsTrigger>
        </TabsList>

        <TabsContent value="gantt" className="mt-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b p-3 print:hidden">
              <Select value={projetoId} onValueChange={setProjetoId}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todos os projetos</SelectItem>{projetos.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}</SelectContent>
              </Select>
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar etapa, grupo, projeto ou cidade" />
              </div>
              <Select value={zoom} onValueChange={alterarZoom}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">Dias</SelectItem>
                  <SelectItem value="semana">Semanas</SelectItem>
                  <SelectItem value="mes">Meses</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => setDeslocamento((valor) => valor - escala.passoNavegacao)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => setDeslocamento(0)}><CalendarDays className="mr-2 h-4 w-4" />Hoje</Button>
              <Button variant="outline" size="icon" onClick={() => setDeslocamento((valor) => valor + escala.passoNavegacao)}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir / PDF</Button>
            </div>

            <div className="max-h-[70vh] overflow-auto">
              <div className="flex" style={{ width: LABEL_WIDTH + linhaDoTempo.largura }}>
                <div className="sticky left-0 z-20 shrink-0 border-r bg-card" style={{ width: LABEL_WIDTH }}>
                  <div className="flex h-16 items-end border-b bg-muted/50 px-3 pb-2 text-xs font-semibold">Projeto / etapa</div>
                  {filtradas.map((etapa) => (
                    <div key={etapa.etapa_id} className="flex flex-col justify-center border-b px-3" style={{ height: ROW_HEIGHT }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold">{etapa.etapa_nome}</span>
                        <span className="shrink-0 text-[9px] text-muted-foreground">{statusLabel[etapa.status] ?? etapa.status}</span>
                      </div>
                      <span className="truncate text-[10px] text-muted-foreground">{etapa.projeto_nome}{etapa.grupo_cronograma ? ` · ${etapa.grupo_cronograma}` : ''}</span>
                    </div>
                  ))}
                </div>

                <div className="relative" style={{ width: linhaDoTempo.largura }}>
                  <div className="sticky top-0 z-10 flex h-16 border-b bg-muted/50">
                    {linhaDoTempo.segmentos.map((segmento) => (
                      <div
                        key={segmento.chave}
                        className={cn(
                          'flex shrink-0 flex-col items-center justify-center border-r px-1 text-center',
                          segmento.diaUnico && (isSaturday(segmento.inicio) || isSunday(segmento.inicio)) && 'bg-muted',
                          segmento.diaUnico && isSameDay(segmento.inicio, new Date()) && 'bg-emerald-500/15',
                        )}
                        style={{ width: segmento.largura }}
                      >
                        <span className={cn('font-semibold', zoom === 'dia' ? 'text-[9px]' : 'text-xs', zoom === 'mes' && 'capitalize')}>{segmento.titulo}</span>
                        <span className="text-[9px] text-muted-foreground">{segmento.subtitulo}</span>
                      </div>
                    ))}
                  </div>

                  {filtradas.map((etapa) => {
                    const intervalo = obterIntervaloEtapa(etapa);
                    const intersecta = intervalo && intervalo.fim.getTime() >= linhaDoTempo.inicio.getTime() && intervalo.inicio.getTime() <= linhaDoTempo.fim.getTime();
                    const inicioVisivel = intervalo && intersecta ? limitarData(intervalo.inicio, linhaDoTempo.inicio, linhaDoTempo.fim) : null;
                    const fimVisivel = intervalo && intersecta ? limitarData(intervalo.fim, linhaDoTempo.inicio, linhaDoTempo.fim) : null;
                    const esquerda = inicioVisivel ? differenceInCalendarDays(inicioVisivel, linhaDoTempo.inicio) * escala.pixelsPorDia : 0;
                    const largura = inicioVisivel && fimVisivel
                      ? Math.max(escala.pixelsPorDia, (differenceInCalendarDays(fimVisivel, inicioVisivel) + 1) * escala.pixelsPorDia)
                      : 0;

                    return (
                      <div key={etapa.etapa_id} className="relative border-b" style={{ height: ROW_HEIGHT }}>
                        {linhaDoTempo.segmentos.map((segmento, index) => {
                          const esquerdaSegmento = linhaDoTempo.segmentos
                            .slice(0, index)
                            .reduce((soma, item) => soma + item.largura, 0);
                          return <div key={segmento.chave} className="absolute inset-y-0 border-r" style={{ left: esquerdaSegmento, width: segmento.largura }} />;
                        })}
                        {hojeNaFaixa && <div className="absolute inset-y-0 bg-emerald-500/10" style={{ left: hojeOffset, width: escala.pixelsPorDia }} />}
                        {intervalo && intersecta && (
                          <div
                            className={cn('absolute top-3 flex h-8 items-center overflow-hidden rounded text-[10px] font-semibold text-white shadow-sm', statusClass[etapa.status] ?? 'bg-slate-500')}
                            style={{ left: esquerda, width: largura }}
                            title={`${etapa.etapa_nome} · ${statusLabel[etapa.status] ?? etapa.status} · ${intervalo.origem === 'real' ? 'período realizado' : 'período previsto'} · ${format(intervalo.inicio, 'dd/MM/yyyy')} a ${format(intervalo.fim, 'dd/MM/yyyy')} · ${etapa.percentual_realizado}% realizado`}
                          >
                            <span className="relative z-10 truncate px-2">{etapa.percentual_realizado}% · {statusLabel[etapa.status] ?? etapa.status}</span>
                            <span className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${etapa.percentual_realizado}%` }} />
                          </div>
                        )}
                        {!intervalo && <span className="absolute left-3 top-5 text-[10px] text-muted-foreground">Sem datas de planejamento ou execução</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              {!loading && filtradas.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma etapa encontrada para os filtros informados.</div>}
              {loading && <div className="p-10 text-center text-sm text-muted-foreground">Carregando cronograma...</div>}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="plano-diario" className="mt-4"><PlanoDiarioProducao /></TabsContent>
      </Tabs>

      <Dialog open={configAberta} onOpenChange={setConfigAberta}>
        <DialogContent>
          <DialogHeader><DialogTitle>Capacidade e calendário</DialogTitle><DialogDescription>Esses parâmetros distribuem automaticamente as etapas nos dias disponíveis.</DialogDescription></DialogHeader>
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
