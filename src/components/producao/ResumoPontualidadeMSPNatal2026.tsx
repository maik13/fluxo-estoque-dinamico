import { useEffect } from 'react';
import { differenceInCalendarDays, eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { CalendarClock, CheckCircle2, CircleAlert, FileSpreadsheet, FileText, Loader2, Printer, RefreshCcw, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  type SituacaoPontualidadeMSP,
  type PontualidadeMSPPeca,
  usePontualidadeMSPNatal2026,
} from '@/hooks/usePontualidadeMSPNatal2026';
import {
  exportarRelatorioPontualidadeExcel,
  exportarRelatorioPontualidadePdf,
} from '@/utils/relatorioPontualidadeProducao';
import { imprimirSecaoProducao } from '@/utils/producaoExport';

const dataPt = (data: string | null) => {
  if (!data) return 'Sem apontamento';
  const [ano, mes, dia] = data.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
};

const apresentacao: Record<SituacaoPontualidadeMSP, { rotulo: string; classe: string }> = {
  antecipado: {
    rotulo: 'Antecipado',
    classe: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  iniciado_no_prazo: {
    rotulo: 'No prazo',
    classe: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  iniciado_atrasado: {
    rotulo: 'Iniciado após o previsto',
    classe: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  atrasado_para_iniciar: {
    rotulo: 'Atrasado para iniciar',
    classe: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  aguardando_inicio: {
    rotulo: 'Aguardando início',
    classe: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  },
};

const impacto = (situacao: SituacaoPontualidadeMSP, dias: number) => {
  switch (situacao) {
    case 'antecipado':
      return `${Math.abs(dias)} dia(s) antes`;
    case 'iniciado_atrasado':
      return `${dias} dia(s) após`;
    case 'atrasado_para_iniciar':
      return `${dias} dia(s) sem início`;
    default:
      return '—';
  }
};

const limitar = (valor: number) => Math.min(100, Math.max(0, valor));

const classeBarra: Record<SituacaoPontualidadeMSP, string> = {
  antecipado: 'bg-blue-500',
  iniciado_no_prazo: 'bg-emerald-500',
  iniciado_atrasado: 'bg-red-500',
  atrasado_para_iniciar: 'bg-red-500',
  aguardando_inicio: 'bg-slate-400',
};

const LinhaDoTempoProducao = ({ pecas }: { pecas: PontualidadeMSPPeca[] }) => {
  const datas = pecas.flatMap((peca) => [peca.inicioPlanejado, peca.fimPlanejado, peca.primeiroApontamento].filter(Boolean) as string[]);
  if (datas.length === 0) return null;

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const menorData = datas.reduce((menor, data) => (data < menor ? data : menor));
  const maiorData = [...datas, hoje].reduce((maior, data) => (data > maior ? data : maior));
  const inicioFaixa = startOfMonth(parseISO(menorData));
  const fimFaixa = endOfMonth(parseISO(maiorData));
  const dias = eachDayOfInterval({ start: inicioFaixa, end: fimFaixa });
  const totalDias = Math.max(1, dias.length);
  const posicao = (data: string) => limitar(differenceInCalendarDays(parseISO(data), inicioFaixa) / totalDias * 100);
  const larguraPeriodo = (inicio: string, fim: string) => Math.max(0.9, (differenceInCalendarDays(parseISO(fim), parseISO(inicio)) + 1) / totalDias * 100);
  const meses = dias.reduce<Array<{ chave: string; rotulo: string; dias: number }>>((grupos, dia) => {
    const chave = format(dia, 'yyyy-MM');
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.chave === chave) {
      ultimo.dias += 1;
    } else {
      grupos.push({ chave, rotulo: format(dia, 'MM/yyyy'), dias: 1 });
    }
    return grupos;
  }, []);
  const gradeDias = { gridTemplateColumns: `repeat(${totalDias}, minmax(8px, 1fr))` };
  const hojeNaFaixa = hoje >= format(inicioFaixa, 'yyyy-MM-dd') && hoje <= format(fimFaixa, 'yyyy-MM-dd');

  return (
    <div className="pontualidade-timeline-scroll overflow-x-auto rounded-md border">
      <div className="pontualidade-timeline-canvas min-w-[1180px] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span><i className="mr-1 inline-block h-2.5 w-5 rounded bg-emerald-500 align-middle" />Em execução/no prazo</span>
          <span><i className="mr-1 inline-block h-2.5 w-5 rounded bg-blue-500 align-middle" />Antecipada</span>
          <span><i className="mr-1 inline-block h-2.5 w-5 rounded bg-red-500 align-middle" />Atrasada</span>
          <span><i className="mr-1 inline-block h-2.5 w-5 rounded bg-slate-400 align-middle" />Ainda não iniciada</span>
          <span><i className="mr-1 inline-block h-3 w-0.5 bg-foreground align-middle" />Hoje</span>
        </div>
        <div className="pontualidade-timeline-grid grid grid-cols-[minmax(285px,30%)_1fr] gap-x-3">
          <div className="border-b pb-1 text-xs font-medium text-muted-foreground">Peça / projeto</div>
          <div className="border-b">
            <div className="grid text-center text-[10px] font-medium text-muted-foreground" style={gradeDias}>
              {meses.map((mes) => <span key={mes.chave} style={{ gridColumn: `span ${mes.dias}` }} className="border-l border-muted pb-1">{mes.rotulo}</span>)}
            </div>
            <div className="grid border-t text-center text-[8px] text-muted-foreground" style={gradeDias}>
              {dias.map((dia) => <span key={dia.toISOString()} className="border-l border-muted py-0.5">{format(dia, 'd')}</span>)}
            </div>
          </div>
          {pecas.map((peca) => {
            const inicio = posicao(peca.inicioPlanejado);
            const largura = larguraPeriodo(peca.inicioPlanejado, peca.fimPlanejado);
            return (
              <div key={peca.projetoId} className="contents">
                <div className="pontualidade-timeline-linha border-t py-1.5 pr-2 text-xs">
                  <p className="truncate font-medium" title={peca.projetoNome}>{peca.projetoNome}</p>
                  <p className="text-muted-foreground">{dataPt(peca.inicioPlanejado)} - {dataPt(peca.fimPlanejado)} · {apresentacao[peca.situacao].rotulo}</p>
                </div>
                <div className="pontualidade-timeline-linha relative border-t" aria-label={`${peca.projetoNome}: período previsto de ${dataPt(peca.inicioPlanejado)} a ${dataPt(peca.fimPlanejado)}`}>
                  <div className="absolute inset-0 grid pointer-events-none" style={gradeDias}>
                    {dias.map((dia) => <span key={dia.toISOString()} className="border-l border-muted/70" />)}
                  </div>
                  <span className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-sm ${classeBarra[peca.situacao]}`} style={{ left: `${inicio}%`, width: `${largura}%` }} title={`Previsto: ${dataPt(peca.inicioPlanejado)} a ${dataPt(peca.fimPlanejado)}`} />
                  {hojeNaFaixa && <span className="absolute inset-y-0 z-10 w-px bg-foreground/80" style={{ left: `${posicao(hoje)}%` }} title="Hoje" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** Resumo gerencial da pontualidade de todas as peças programadas. */
export const ResumoPontualidadeMSPNatal2026 = () => {
  const { loading, error, resumo, carregar } = usePontualidadeMSPNatal2026();

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const comAtraso = resumo.iniciadosAtrasados + resumo.atrasadosParaIniciar;
  const exportacaoDisponivel = !loading && resumo.total > 0;

  return (
    <Card id="relatorio-pontualidade-impressao" className="pontualidade-print-area">
      <CardHeader className="pontualidade-cabecalho gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" />
            Pontualidade da produção
          </CardTitle>
          <CardDescription className="mt-1 max-w-3xl">
            Compara o início previsto das OPs vigentes com seu primeiro apontamento. O primeiro apontamento histórico é exibido separadamente.
          </CardDescription>
        </div>
        <div className="pontualidade-controles flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" size="sm" onClick={() => exportarRelatorioPontualidadeExcel(resumo)} disabled={!exportacaoDisponivel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => exportarRelatorioPontualidadePdf(resumo)} disabled={!exportacaoDisponivel}>
            <FileText className="mr-2 h-4 w-4" />
            PDF do Gantt
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => imprimirSecaoProducao('relatorio-pontualidade-impressao')} disabled={!exportacaoDisponivel}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir linha do tempo
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="pontualidade-indicadores grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Peças programadas</p>
            <p className="mt-1 text-2xl font-bold">{resumo.total}</p>
          </div>
          <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-3">
            <p className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300"><TrendingUp className="h-3.5 w-3.5" /> Antecipadas</p>
            <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">{resumo.antecipados}</p>
          </div>
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
            <p className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Início no prazo</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{resumo.noPrazo}</p>
          </div>
          <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
            <p className="text-xs text-destructive">Com atraso</p>
            <p className="mt-1 text-2xl font-bold text-destructive">{comAtraso}</p>
            <p className="text-[11px] text-muted-foreground">{resumo.atrasadosParaIniciar} sem início</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Aguardando início</p>
            <p className="mt-1 text-2xl font-bold">{resumo.aguardandoInicio}</p>
          </div>
        </div>

        {loading && resumo.total === 0 ? (
          <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Comparando programação e apontamentos...
          </div>
        ) : (
          <div className="space-y-4">
            {resumo.pecas.length > 0 && (
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">Linha do tempo de produção</p>
                  <p className="text-xs text-muted-foreground">Cada barra representa o período previsto completo da peça. A cor reflete a situação do início frente à programação.</p>
                </div>
                <LinhaDoTempoProducao pecas={resumo.pecas} />
              </div>
            )}

            <div className="pontualidade-detalhe overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peça / projeto</TableHead>
                    <TableHead>Início previsto</TableHead>
                    <TableHead>Fim previsto</TableHead>
                    <TableHead>Primeiro apontamento vigente</TableHead>
                    <TableHead>Primeiro histórico</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Variação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumo.pecas.map((peca) => {
                    const item = apresentacao[peca.situacao];
                    return (
                      <TableRow key={peca.projetoId}>
                        <TableCell>
                          <div className="min-w-64 font-medium">{peca.projetoNome}</div>
                          <div className="text-xs text-muted-foreground">{peca.opsImportadas} OP(s) programada(s){peca.cidade ? ` · ${peca.cidade}` : ''}</div>
                        </TableCell>
                        <TableCell>{dataPt(peca.inicioPlanejado)}</TableCell>
                        <TableCell>{dataPt(peca.fimPlanejado)}</TableCell>
                        <TableCell>{dataPt(peca.primeiroApontamento)}</TableCell>
                        <TableCell>{dataPt(peca.primeiroApontamentoHistorico)}</TableCell>
                        <TableCell><Badge variant="outline" className={item.classe}>{item.rotulo}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{impacto(peca.situacao, peca.diferencaDias)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!error && resumo.pecas.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma peça com OP programada foi encontrada.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        <p className="pontualidade-notas text-xs text-muted-foreground">
          “Atrasado para iniciar” significa que a data prevista já passou e não há apontamento válido na peça. Dias são corridos e não representam quantidade, equipe ou percentual de produção.
        </p>
      </CardContent>
    </Card>
  );
};
