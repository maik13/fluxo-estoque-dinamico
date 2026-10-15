import { useEffect } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { CalendarClock, CheckCircle2, CircleAlert, FileSpreadsheet, FileText, Loader2, RefreshCcw, TrendingUp } from 'lucide-react';
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
  usePontualidadeMSPNatal2026,
} from '@/hooks/usePontualidadeMSPNatal2026';
import {
  exportarRelatorioPontualidadeExcel,
  exportarRelatorioPontualidadePdf,
} from '@/utils/relatorioPontualidadeProducao';

const dataPt = (data: string | null) => {
  if (!data) return 'Sem apontamento';
  const [ano, mes, dia] = data.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
};

const apresentacao: Record<SituacaoPontualidadeMSP, { rotulo: string; classe: string }> = {
  antecipado: {
    rotulo: 'Antecipado',
    classe: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  iniciado_no_prazo: {
    rotulo: 'No prazo',
    classe: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  iniciado_atrasado: {
    rotulo: 'Iniciado após o previsto',
    classe: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
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

const LinhaDoTempoInicios = ({ pecas }: { pecas: ReturnType<typeof usePontualidadeMSPNatal2026>['resumo']['pecas'] }) => {
  const datas = pecas.flatMap((peca) => [peca.inicioPlanejado, peca.primeiroApontamento].filter(Boolean) as string[]);
  if (datas.length === 0) return null;

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const menorData = datas.reduce((menor, data) => (data < menor ? data : menor));
  const maiorData = [...datas, hoje].reduce((maior, data) => (data > maior ? data : maior));
  const inicioFaixa = subDays(parseISO(menorData), 5);
  const fimFaixa = addDays(parseISO(maiorData), 5);
  const totalDias = Math.max(1, differenceInCalendarDays(fimFaixa, inicioFaixa));
  const posicao = (data: string) => limitar(differenceInCalendarDays(parseISO(data), inicioFaixa) / totalDias * 100);
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((parte) => ({
    posicao: parte * 100,
    rotulo: format(addDays(inicioFaixa, Math.round(totalDias * parte)), 'dd/MM'),
  }));

  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="min-w-[760px] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span><i className="mr-1 inline-block h-3 w-0.5 bg-sky-500 align-middle" />Início previsto</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 align-middle" />Apontamento antes/no prazo</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500 align-middle" />Apontamento após o previsto</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-destructive align-middle" />Hoje, quando segue sem início</span>
        </div>
        <div className="grid grid-cols-[minmax(235px,30%)_1fr] gap-x-3">
          <div className="pb-5 text-xs font-medium text-muted-foreground">Peça / projeto</div>
          <div className="relative h-5 border-b">
            {marcas.map((marca) => (
              <span key={marca.posicao} className="absolute -translate-x-1/2 text-[10px] text-muted-foreground" style={{ left: `${marca.posicao}%` }}>{marca.rotulo}</span>
            ))}
          </div>
          {pecas.map((peca) => {
            const previsto = posicao(peca.inicioPlanejado);
            const referenciaReal = peca.primeiroApontamento ?? (peca.situacao === 'atrasado_para_iniciar' ? hoje : null);
            const real = referenciaReal ? posicao(referenciaReal) : null;
            const inicioVariacao = real === null ? previsto : Math.min(previsto, real);
            const larguraVariacao = real === null ? 0 : Math.abs(real - previsto);
            const classeVariacao = peca.situacao === 'antecipado'
              ? 'bg-emerald-500/60'
              : peca.situacao === 'atrasado_para_iniciar'
                ? 'bg-destructive/60'
                : peca.situacao === 'iniciado_atrasado'
                  ? 'bg-amber-500/60'
                  : 'bg-sky-500/40';
            const classeMarco = peca.situacao === 'atrasado_para_iniciar'
              ? 'bg-destructive'
              : peca.situacao === 'iniciado_atrasado'
                ? 'bg-amber-500'
                : 'bg-emerald-500';
            return (
              <div key={peca.projetoId} className="contents">
                <div className="border-t py-2 pr-2 text-xs">
                  <p className="truncate font-medium" title={peca.projetoNome}>{peca.projetoNome}</p>
                  <p className="text-muted-foreground">{apresentacao[peca.situacao].rotulo}{peca.diferencaDias ? ` · ${impacto(peca.situacao, peca.diferencaDias)}` : ''}</p>
                </div>
                <div className="relative border-t" aria-label={`${peca.projetoNome}: previsto ${dataPt(peca.inicioPlanejado)}, ${dataPt(peca.primeiroApontamento)}`}>
                  {marcas.map((marca) => <span key={marca.posicao} className="absolute inset-y-0 border-l border-dashed border-muted" style={{ left: `${marca.posicao}%` }} />)}
                  {real !== null && larguraVariacao > 0 && <span className={`absolute top-1/2 h-1 -translate-y-1/2 rounded ${classeVariacao}`} style={{ left: `${inicioVariacao}%`, width: `${larguraVariacao}%` }} />}
                  <span className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-sky-500" style={{ left: `${previsto}%` }} title={`Previsto: ${dataPt(peca.inicioPlanejado)}`} />
                  {real !== null && <span className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background ${classeMarco}`} style={{ left: `${real}%` }} title={peca.primeiroApontamento ? `Primeiro apontamento: ${dataPt(peca.primeiroApontamento)}` : 'Hoje: ainda sem apontamento'} />}
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
    <Card>
      <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" />
            Pontualidade da produção
          </CardTitle>
          <CardDescription className="mt-1 max-w-3xl">
            Compara o primeiro início previsto das OPs de cada peça com o primeiro apontamento válido, incluindo o histórico preservado em OPs anteriores.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" size="sm" onClick={() => exportarRelatorioPontualidadeExcel(resumo)} disabled={!exportacaoDisponivel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => exportarRelatorioPontualidadePdf(resumo)} disabled={!exportacaoDisponivel}>
            <FileText className="mr-2 h-4 w-4" />
            PDF
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Peças programadas</p>
            <p className="mt-1 text-2xl font-bold">{resumo.total}</p>
          </div>
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
            <p className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300"><TrendingUp className="h-3.5 w-3.5" /> Antecipadas</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{resumo.antecipados}</p>
          </div>
          <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-3">
            <p className="flex items-center gap-1 text-xs text-sky-700 dark:text-sky-300"><CheckCircle2 className="h-3.5 w-3.5" /> Início no prazo</p>
            <p className="mt-1 text-2xl font-bold text-sky-700 dark:text-sky-300">{resumo.noPrazo}</p>
          </div>
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300">Com atraso</p>
            <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">{comAtraso}</p>
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
            Comparando Project e apontamentos...
          </div>
        ) : (
          <div className="space-y-4">
            {resumo.pecas.length > 0 && (
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">Linha do tempo dos inícios</p>
                  <p className="text-xs text-muted-foreground">A barra mostra apenas a diferença entre a data prevista e o primeiro apontamento; não representa duração da produção.</p>
                </div>
                <LinhaDoTempoInicios pecas={resumo.pecas} />
              </div>
            )}

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peça / projeto</TableHead>
                    <TableHead>Início previsto</TableHead>
                    <TableHead>Primeiro apontamento</TableHead>
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
                        <TableCell>{dataPt(peca.primeiroApontamento)}</TableCell>
                        <TableCell><Badge variant="outline" className={item.classe}>{item.rotulo}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{impacto(peca.situacao, peca.diferencaDias)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!error && resumo.pecas.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhuma OP do Natal 2026 v24 foi encontrada.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          “Atrasado para iniciar” significa que a data prevista já passou e não há apontamento válido na peça. Dias são corridos e não representam quantidade, equipe ou percentual de produção.
        </p>
      </CardContent>
    </Card>
  );
};
