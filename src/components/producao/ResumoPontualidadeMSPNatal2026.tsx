import { useEffect } from 'react';
import { CalendarClock, CheckCircle2, CircleAlert, Loader2, RefreshCcw, TrendingUp } from 'lucide-react';
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

/** Resumo gerencial das peças cuja programação veio do Natal 2026 v24.mpp. */
export const ResumoPontualidadeMSPNatal2026 = () => {
  const { loading, error, resumo, carregar } = usePontualidadeMSPNatal2026();

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const comAtraso = resumo.iniciadosAtrasados + resumo.atrasadosParaIniciar;

  return (
    <Card>
      <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" />
            Ritmo do Project — Natal 2026
          </CardTitle>
          <CardDescription className="mt-1 max-w-3xl">
            Compara o primeiro início previsto das OPs importadas com o primeiro apontamento válido da peça, incluindo apontamentos preservados em OPs legadas.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void carregar()} disabled={loading} className="print:hidden">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
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
            <p className="text-xs text-muted-foreground">Peças importadas</p>
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
                        <div className="text-xs text-muted-foreground">{peca.opsImportadas} OP(s) importada(s){peca.cidade ? ` · ${peca.cidade}` : ''}</div>
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
        )}
        <p className="text-xs text-muted-foreground">
          “Atrasado para iniciar” significa que a data prevista já passou e não há apontamento válido na peça. Dias são corridos e não representam quantidade, equipe ou percentual de produção.
        </p>
      </CardContent>
    </Card>
  );
};
