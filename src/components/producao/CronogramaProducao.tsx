import { useEffect, useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, format, isSameDay, isSaturday, isSunday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Printer, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCronogramaProducao } from '@/hooks/useCronogramaProducao';
import { cn } from '@/lib/utils';

const LABEL_WIDTH = 280;
const ROW_HEIGHT = 42;
const DAY_WIDTH = { dia: 58, semana: 38, mes: 24 } as const;
type Zoom = keyof typeof DAY_WIDTH;

const statusClass: Record<string, string> = {
  planejado: 'bg-slate-500',
  em_andamento: 'bg-emerald-500',
  pausado: 'bg-amber-500',
  bloqueado: 'bg-red-500',
  finalizado: 'bg-blue-500',
  cancelado: 'bg-zinc-500',
};

export const CronogramaProducao = () => {
  const { etapas, loading, erro, listarCronograma } = useCronogramaProducao();
  const [projetoId, setProjetoId] = useState('todos');
  const [busca, setBusca] = useState('');
  const [zoom, setZoom] = useState<Zoom>('semana');
  const [deslocamento, setDeslocamento] = useState(0);

  useEffect(() => { void listarCronograma().catch(() => undefined); }, [listarCronograma]);

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

  const { inicio, dias } = useMemo(() => {
    const datas = filtradas.flatMap((etapa) => [etapa.data_inicio_prevista, etapa.data_fim_prevista]).filter(Boolean) as string[];
    const minimo = datas.length ? new Date(Math.min(...datas.map((data) => parseISO(data).getTime()))) : new Date();
    const maximo = datas.length ? new Date(Math.max(...datas.map((data) => parseISO(data).getTime()))) : addDays(new Date(), 30);
    const base = addDays(minimo, -3 + deslocamento);
    const total = Math.max(30, differenceInCalendarDays(maximo, minimo) + 14);
    return { inicio: base, dias: Array.from({ length: total }, (_, index) => addDays(base, index)) };
  }, [deslocamento, filtradas]);

  const larguraDia = DAY_WIDTH[zoom];
  const larguraGrade = dias.length * larguraDia;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Cronograma de Produção</h3>
        <p className="text-sm text-muted-foreground">O Gantt é gerado automaticamente a partir das etapas cadastradas nos projetos.</p>
      </div>

      {erro && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{erro}. Confirme se a migration do cronograma foi aplicada.</AlertDescription></Alert>}

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
          <Select value={zoom} onValueChange={(value) => setZoom(value as Zoom)}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="dia">Dia</SelectItem><SelectItem value="semana">Semana</SelectItem><SelectItem value="mes">Mês</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setDeslocamento((valor) => valor - 14)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => setDeslocamento(0)}><CalendarDays className="mr-2 h-4 w-4" />Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => setDeslocamento((valor) => valor + 14)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir / PDF</Button>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          <div className="flex" style={{ width: LABEL_WIDTH + larguraGrade }}>
            <div className="sticky left-0 z-20 shrink-0 border-r bg-card" style={{ width: LABEL_WIDTH }}>
              <div className="flex h-14 items-end border-b bg-muted/50 px-3 pb-2 text-xs font-semibold">Projeto / etapa</div>
              {filtradas.map((etapa) => <div key={etapa.etapa_id} className="flex flex-col justify-center border-b px-3" style={{ height: ROW_HEIGHT }}><span className="truncate text-xs font-semibold">{etapa.etapa_nome}</span><span className="truncate text-[10px] text-muted-foreground">{etapa.projeto_nome}{etapa.grupo_cronograma ? ` · ${etapa.grupo_cronograma}` : ''}</span></div>)}
            </div>

            <div className="relative" style={{ width: larguraGrade }}>
              <div className="sticky top-0 z-10 flex h-14 border-b bg-muted/50">
                {dias.map((dia) => <div key={dia.toISOString()} className={cn('flex shrink-0 flex-col items-center justify-center border-r text-[9px]', (isSaturday(dia) || isSunday(dia)) && 'bg-muted', isSameDay(dia, new Date()) && 'bg-emerald-500/15')} style={{ width: larguraDia }}><span>{format(dia, 'EEE', { locale: ptBR }).replace('.', '')}</span><strong>{format(dia, 'dd')}</strong></div>)}
              </div>

              {filtradas.map((etapa) => {
                const inicioEtapa = etapa.data_inicio_prevista ? differenceInCalendarDays(parseISO(etapa.data_inicio_prevista), inicio) : null;
                const fimEtapa = etapa.data_fim_prevista ? differenceInCalendarDays(parseISO(etapa.data_fim_prevista), inicio) : inicioEtapa;
                const largura = inicioEtapa === null ? 0 : Math.max(1, (fimEtapa ?? inicioEtapa) - inicioEtapa + 1) * larguraDia;
                return <div key={etapa.etapa_id} className="relative border-b" style={{ height: ROW_HEIGHT }}>{dias.map((dia, index) => <div key={index} className={cn('absolute inset-y-0 border-r', (isSaturday(dia) || isSunday(dia)) && 'bg-muted/35', isSameDay(dia, new Date()) && 'bg-emerald-500/10')} style={{ left: index * larguraDia, width: larguraDia }} />)}{inicioEtapa !== null && <div className={cn('absolute top-2 flex h-6 items-center overflow-hidden rounded text-[10px] font-semibold text-white shadow-sm', statusClass[etapa.status] ?? 'bg-slate-500')} style={{ left: inicioEtapa * larguraDia, width: largura }} title={`${etapa.etapa_nome}: ${etapa.percentual_realizado}% realizado`}><span className="relative z-10 truncate px-2">{etapa.percentual_realizado}%</span><span className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${etapa.percentual_realizado}%` }} /></div>}</div>;
              })}
            </div>
          </div>
          {!loading && filtradas.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma etapa planejada encontrada. Cadastre uma etapa e informe as datas planejadas.</div>}
          {loading && <div className="p-10 text-center text-sm text-muted-foreground">Carregando cronograma...</div>}
        </div>
      </Card>
    </div>
  );
};
