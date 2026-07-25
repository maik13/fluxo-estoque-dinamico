import { useEffect, useMemo, useState } from 'react';
import { Clock3, Gauge, TimerOff, TimerReset, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { JornadaProducaoGerencialLinha } from '@/types/producao';
import { formatarErroSupabase } from '@/utils/supabaseError';

const horas = (minutos: number | null | undefined) => {
  if (minutos === null || minutos === undefined) return 'Não informada';
  return `${(minutos / 60).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h`;
};

const percentual = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? '—'
    : `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export const ResumoJornadaProducao = () => {
  const [linhas, setLinhas] = useState<JornadaProducaoGerencialLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      setErro(null);
      const fim = new Date();
      const inicio = new Date();
      inicio.setDate(fim.getDate() - 29);

      const { data, error } = await (supabase.rpc as any)('listar_jornada_producao_gerencial', {
        p_data_inicio: inicio.toISOString().slice(0, 10),
        p_data_fim: fim.toISOString().slice(0, 10),
        p_membro_id: null,
      });

      if (error) {
        setErro(formatarErroSupabase(error, 'Não foi possível carregar os indicadores de jornada.'));
        setLinhas([]);
      } else {
        setLinhas((data ?? []) as JornadaProducaoGerencialLinha[]);
      }
      setLoading(false);
    };

    void carregar();
  }, []);

  const resumo = useMemo(() => {
    const validas = linhas.filter((linha) => linha.jornada_prevista_minutos !== null);
    const jornada = validas.reduce((soma, linha) => soma + (linha.jornada_prevista_minutos ?? 0), 0);
    const apontados = validas.reduce((soma, linha) => soma + linha.minutos_apontados, 0);
    const produtivos = validas.reduce((soma, linha) => soma + linha.minutos_produtivos, 0);
    const improdutivos = validas.reduce((soma, linha) => soma + linha.minutos_improdutivos, 0);
    const semApontamento = validas.reduce((soma, linha) => soma + (linha.minutos_sem_apontamento ?? 0), 0);
    const extras = validas.reduce((soma, linha) => soma + (linha.minutos_extras ?? 0), 0);
    return {
      jornada,
      apontados,
      produtivos,
      improdutivos,
      semApontamento,
      extras,
      ocupacao: jornada > 0 ? (apontados / jornada) * 100 : null,
      aproveitamento: jornada > 0 ? (produtivos / jornada) * 100 : null,
      eficiencia: apontados > 0 ? (produtivos / apontados) * 100 : null,
      pessoas: new Set(validas.map((linha) => linha.membro_id)).size,
    };
  }, [linhas]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando indicadores de jornada...</p>;
  }

  if (erro) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Jornada da Produção indisponível</AlertTitle>
        <AlertDescription>{erro}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold">Jornada da equipe — últimos 30 dias</h3>
        <p className="text-sm text-muted-foreground">
          Compara a jornada cadastrada com horas apontadas, produtivas, improdutivas, sem apontamento e extras.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardDescription>Jornada prevista</CardDescription><CardTitle className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{horas(resumo.jornada)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{resumo.pessoas} membro(s)</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Horas apontadas</CardDescription><CardTitle>{horas(resumo.apontados)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Ocupação: {percentual(resumo.ocupacao)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Horas produtivas</CardDescription><CardTitle className="flex items-center gap-2"><Gauge className="h-4 w-4" />{horas(resumo.produtivos)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Aproveitamento: {percentual(resumo.aproveitamento)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Sem apontamento</CardDescription><CardTitle className="flex items-center gap-2"><TimerOff className="h-4 w-4" />{horas(resumo.semApontamento)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Não é classificado automaticamente como improdutivo</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Horas extras</CardDescription><CardTitle className="flex items-center gap-2"><TimerReset className="h-4 w-4" />{horas(resumo.extras)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Eficiência: {percentual(resumo.eficiencia)}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Jornada por colaborador e dia</CardTitle><CardDescription>Registros sem jornada histórica aparecem como “Não informada”.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Membro</TableHead><TableHead>Jornada</TableHead><TableHead>Apontado</TableHead><TableHead>Produtivo</TableHead><TableHead>Improdutivo</TableHead><TableHead>Sem apontamento</TableHead><TableHead>Extra</TableHead><TableHead>Aproveitamento</TableHead></TableRow></TableHeader>
            <TableBody>
              {linhas.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nenhum apontamento com equipe no período.</TableCell></TableRow>
              ) : linhas.slice(0, 100).map((linha) => (
                <TableRow key={`${linha.membro_id}-${linha.data}`}>
                  <TableCell>{new Date(`${linha.data}T12:00:00`).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="font-medium">{linha.membro_nome}</TableCell>
                  <TableCell>{horas(linha.jornada_prevista_minutos)}</TableCell>
                  <TableCell>{horas(linha.minutos_apontados)}</TableCell>
                  <TableCell>{horas(linha.minutos_produtivos)}</TableCell>
                  <TableCell>{horas(linha.minutos_improdutivos)}</TableCell>
                  <TableCell>{horas(linha.minutos_sem_apontamento)}</TableCell>
                  <TableCell>{horas(linha.minutos_extras)}</TableCell>
                  <TableCell>{percentual(linha.aproveitamento_percentual)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
};
