import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isSaturday, isSunday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Printer, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCronogramaProducao } from '@/hooks/useCronogramaProducao';
import { cn } from '@/lib/utils';

const DIAS = 60;

export const PlanoDiarioProducao = () => {
  const { planoDiario, listarPlanoDiario, configuracao } = useCronogramaProducao();
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [projetoId, setProjetoId] = useState('todos');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    void listarPlanoDiario(dataInicio, DIAS).finally(() => setLoading(false));
  }, [dataInicio, listarPlanoDiario]);

  const dias = useMemo(() => Array.from({ length: DIAS }, (_, index) => addDays(parseISO(dataInicio), index)), [dataInicio]);
  const projetos = useMemo(() => {
    const mapa = new Map<string, string>();
    planoDiario.forEach((item) => mapa.set(item.projeto_id, item.projeto_nome));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [planoDiario]);

  const linhas = useMemo(() => {
    const mapa = new Map<string, {
      etapa_id: string;
      codigo: string;
      etapa_nome: string;
      projeto_id: string;
      projeto_nome: string;
      grupo: string | null;
      unidade: string | null;
      alocacoes: Map<string, { planejado: number; realizado: number; pessoas: number }>;
    }>();

    planoDiario
      .filter((item) => projetoId === 'todos' || item.projeto_id === projetoId)
      .forEach((item) => {
        const atual = mapa.get(item.etapa_id) ?? {
          etapa_id: item.etapa_id,
          codigo: item.codigo,
          etapa_nome: item.etapa_nome,
          projeto_id: item.projeto_id,
          projeto_nome: item.projeto_nome,
          grupo: item.grupo_cronograma,
          unidade: item.unidade_medida,
          alocacoes: new Map(),
        };
        atual.alocacoes.set(item.data, {
          planejado: Number(item.quantidade_planejada) || 0,
          realizado: Number(item.quantidade_realizada) || 0,
          pessoas: Number(item.pessoas_planejadas) || 0,
        });
        mapa.set(item.etapa_id, atual);
      });

    return [...mapa.values()];
  }, [planoDiario, projetoId]);

  const resumoDia = useMemo(() => {
    const mapa = new Map<string, { pessoas: number; processos: number }>();
    planoDiario
      .filter((item) => projetoId === 'todos' || item.projeto_id === projetoId)
      .forEach((item) => {
        const atual = mapa.get(item.data) ?? { pessoas: 0, processos: 0 };
        atual.pessoas += Number(item.pessoas_planejadas) || 0;
        atual.processos += 1;
        mapa.set(item.data, atual);
      });
    return mapa;
  }, [planoDiario, projetoId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" size="icon" onClick={() => setDataInicio(format(addDays(parseISO(dataInicio), -14), 'yyyy-MM-dd'))}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} className="w-[170px]" />
        <Button variant="outline" size="icon" onClick={() => setDataInicio(format(addDays(parseISO(dataInicio), 14), 'yyyy-MM-dd'))}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={() => setDataInicio(format(new Date(), 'yyyy-MM-dd'))}><CalendarDays className="mr-2 h-4 w-4" />Hoje</Button>
        <Select value={projetoId} onValueChange={setProjetoId}>
          <SelectTrigger className="w-[230px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os projetos</SelectItem>{projetos.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" className="ml-auto" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir / PDF</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 print:hidden">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Equipe disponível/dia</p><p className="text-2xl font-bold">{configuracao?.equipe_disponivel_por_dia ?? '—'}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Etapas na janela</p><p className="text-2xl font-bold">{linhas.length}</p></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Users className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Maior equipe alocada</p><p className="text-2xl font-bold">{Math.max(0, ...[...resumoDia.values()].map((item) => item.pessoas))}</p></div></CardContent></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: '68vh' }}>
          <table className="w-max min-w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 w-[290px] min-w-[290px] border-b border-r bg-muted p-2 text-left">Projeto / etapa</th>
                {dias.map((dia) => {
                  const chave = format(dia, 'yyyy-MM-dd');
                  const fimSemana = isSaturday(dia) || isSunday(dia);
                  const pessoas = resumoDia.get(chave)?.pessoas ?? 0;
                  const sobrecarga = configuracao && pessoas > configuracao.equipe_disponivel_por_dia;
                  return (
                    <th key={chave} className={cn('sticky top-0 z-20 min-w-[78px] border-b border-r bg-muted p-1.5 text-center', fimSemana && 'bg-red-500/10', sobrecarga && 'bg-destructive/20')}>
                      <span className="block text-[9px] font-normal uppercase text-muted-foreground">{format(dia, 'EEE', { locale: ptBR })}</span>
                      <span className="text-primary">{format(dia, 'dd/MM')}</span>
                      <span className={cn('block text-[9px]', sobrecarga ? 'font-bold text-destructive' : 'text-muted-foreground')}>{pessoas} pessoas</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.etapa_id} className="hover:bg-muted/20">
                  <td className="sticky left-0 z-10 border-b border-r bg-card p-2">
                    <span className="block font-semibold">{linha.etapa_nome}</span>
                    <span className="block text-[9px] text-muted-foreground">{linha.projeto_nome}{linha.grupo ? ` · ${linha.grupo}` : ''}</span>
                  </td>
                  {dias.map((dia) => {
                    const chave = format(dia, 'yyyy-MM-dd');
                    const alocacao = linha.alocacoes.get(chave);
                    return (
                      <td key={chave} className={cn('border-b border-r p-1 text-center', (isSaturday(dia) || isSunday(dia)) && 'bg-muted/30')}>
                        {alocacao ? (
                          <div>
                            <span className="block font-semibold text-primary">{Number(alocacao.planejado.toFixed(2)).toLocaleString('pt-BR')}</span>
                            <span className="block text-[9px] text-muted-foreground">{alocacao.pessoas} M.O.</span>
                            {alocacao.realizado > 0 && <span className={cn('block text-[9px] font-medium', alocacao.realizado >= alocacao.planejado ? 'text-emerald-500' : 'text-amber-500')}>Real: {Number(alocacao.realizado.toFixed(2)).toLocaleString('pt-BR')}</span>}
                          </div>
                        ) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!loading && linhas.length === 0 && <tr><td colSpan={DIAS + 1} className="p-10 text-center text-muted-foreground">Nenhuma alocação calculada. Preencha quantidade, capacidade e equipe nas etapas e clique em Recalcular.</td></tr>}
              {loading && <tr><td colSpan={DIAS + 1} className="p-10 text-center text-muted-foreground">Carregando plano diário...</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
