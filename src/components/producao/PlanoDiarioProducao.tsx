import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isSaturday, isSunday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Printer, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { useCronogramaProducao } from '@/hooks/useCronogramaProducao';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const DIAS = 60;

type ProgramacaoIntegrada = {
  id: string;
  projeto_id: string;
  projeto_nome: string;
  processo_id: string;
  processo_nome: string;
  ordem_producao_id: string | null;
  ordem_numero: number | null;
  data: string;
  turno: string | null;
  atividade_planejada: string;
  meta: string | null;
  equipe_prevista: string | null;
  prioridade: string | null;
  status: string;
};

export const PlanoDiarioProducao = () => {
  const { planoDiario, listarPlanoDiario, configuracao } = useCronogramaProducao();
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [projetoId, setProjetoId] = useState('todos');
  const [loading, setLoading] = useState(false);
  const [programacao, setProgramacao] = useState<ProgramacaoIntegrada[]>([]);

  useEffect(() => {
    setLoading(true);
    void Promise.all([
      listarPlanoDiario(dataInicio, DIAS),
      (async () => {
        const { data, error } = await (supabase.rpc as any)('listar_programacao_diaria_integrada_v1', {
          p_data_inicio: dataInicio,
          p_dias: DIAS,
        });
        if (error) throw error;
        setProgramacao((data ?? []) as ProgramacaoIntegrada[]);
      })(),
    ]).finally(() => setLoading(false));
  }, [dataInicio, listarPlanoDiario]);

  const dias = useMemo(() => Array.from({ length: DIAS }, (_, index) => addDays(parseISO(dataInicio), index)), [dataInicio]);
  const projetos = useMemo(() => {
    const mapa = new Map<string, string>();
    planoDiario.forEach((item) => mapa.set(item.projeto_id, item.projeto_nome));
    programacao.forEach((item) => mapa.set(item.projeto_id, item.projeto_nome));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [planoDiario, programacao]);

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

  const programacaoFiltrada = useMemo(
    () => programacao.filter((item) => projetoId === 'todos' || item.projeto_id === projetoId),
    [programacao, projetoId],
  );

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
        <SearchableSelect
          value={projetoId}
          onValueChange={setProjetoId}
          className="w-[230px]"
          searchPlaceholder="Buscar projeto..."
          options={[
            { value: 'todos', label: 'Todos os projetos' },
            ...projetos.map(([id, nome]) => ({ value: id, label: nome })),
          ]}
        />
        <Button variant="outline" className="ml-auto" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir / PDF</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4 print:hidden">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Equipe disponível/dia</p><p className="text-2xl font-bold">{configuracao?.equipe_disponivel_por_dia ?? '—'}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Etapas na janela</p><p className="text-2xl font-bold">{linhas.length}</p></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Users className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Maior equipe alocada</p><p className="text-2xl font-bold">{Math.max(0, ...[...resumoDia.values()].map((item) => item.pessoas))}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><ClipboardList className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Atividades vinculadas</p><p className="text-2xl font-bold">{programacaoFiltrada.length}</p></div></CardContent></Card>
      </div>

      {programacaoFiltrada.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b p-3">
            <p className="font-medium">Programação diária vinculada às Etapas / OPs</p>
            <p className="text-xs text-muted-foreground">Previsão operacional importada e validada. O realizado continua vindo dos apontamentos.</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="p-3">Data</th><th className="p-3">Turno</th><th className="p-3">Projeto</th><th className="p-3">Etapa / OP</th><th className="p-3">Atividade planejada</th><th className="p-3">Meta</th><th className="p-3">Equipe prevista</th><th className="p-3">Prioridade</th></tr>
              </thead>
              <tbody>
                {programacaoFiltrada.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3 font-medium">{new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3">{item.turno ?? '—'}</td>
                    <td className="p-3">{item.projeto_nome}</td>
                    <td className="p-3">{item.processo_nome}{item.ordem_numero ? ` · OP ${item.ordem_numero}` : ''}</td>
                    <td className="p-3">{item.atividade_planejada}</td>
                    <td className="p-3 text-muted-foreground">{item.meta ?? '—'}</td>
                    <td className="p-3">{item.equipe_prevista ?? '—'}</td>
                    <td className="p-3">{item.prioridade ? <Badge variant={item.prioridade === 'Alta' ? 'destructive' : 'secondary'}>{item.prioridade}</Badge> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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
