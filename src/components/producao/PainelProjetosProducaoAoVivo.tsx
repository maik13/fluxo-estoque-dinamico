import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Expand,
  Factory,
  LineChart as LineChartIcon,
  MonitorUp,
  Printer,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

type TipoGrafico = 'barras' | 'linha';

type OpPainel = {
  id: string;
  numero: number;
  atividade: string;
  status: string;
  local_tipo: string;
  quantidade_planejada: number;
  quantidade_realizada: number;
  percentual_realizado: number;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
};

type EtapaPainel = {
  id: string;
  codigo: string | null;
  nome: string;
  status: string;
  percentual_realizado: number;
  ops_total: number;
  ops_concluidas: number;
  ordens: OpPainel[];
};

type ProjetoPainel = {
  projeto_id: string;
  local_utilizacao_id: string;
  projeto_nome: string;
  cliente: string | null;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  percentual_realizado: number;
  etapas_total: number;
  etapas_concluidas: number;
  ops_total: number;
  ops_concluidas: number;
  horas_homem: number;
  membros_distintos: number;
  custo_mao_obra: number | null;
  custo_mao_obra_incompleto: boolean;
  custo_materiais: number | null;
  custo_materiais_incompleto: boolean;
  ultima_atualizacao: string;
  etapas: EtapaPainel[];
};

const numero = (valor: number) =>
  Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const moeda = (valor: number | null) =>
  valor === null
    ? 'Restrito'
    : Number(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

const statusOpLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  liberada: 'Liberada',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const statusEtapaLabel: Record<string, string> = {
  planejado: 'Planejada',
  em_andamento: 'Em andamento',
  pausado: 'Pausada',
  bloqueado: 'Bloqueada',
  finalizado: 'Finalizada',
};

export const PainelProjetosProducaoAoVivo = () => {
  const [projetos, setProjetos] = useState<ProjetoPainel[]>([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('barras');
  const painelRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoadingInicial(true);
    else setSincronizando(true);

    try {
      const { data, error } = await (supabase.rpc as any)('listar_painel_gerencial_producao_v1');
      if (error) throw error;

      const proximo = ((data ?? []) as ProjetoPainel[]).map((projeto) => ({
        ...projeto,
        percentual_realizado: Number(projeto.percentual_realizado ?? 0),
        horas_homem: Number(projeto.horas_homem ?? 0),
        custo_mao_obra:
          projeto.custo_mao_obra === null ? null : Number(projeto.custo_mao_obra ?? 0),
        custo_materiais:
          projeto.custo_materiais === null ? null : Number(projeto.custo_materiais ?? 0),
        etapas: Array.isArray(projeto.etapas) ? projeto.etapas : [],
      }));

      // O snapshot só substitui a tela depois de chegar inteiro. Isso evita
      // o efeito de cards/gráficos sumindo durante uma atualização em tempo real.
      setProjetos(proximo);
      setErro(null);
      setUltimaAtualizacao(new Date());
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Não foi possível atualizar o painel.';
      setErro(mensagem);
    } finally {
      setLoadingInicial(false);
      setSincronizando(false);
    }
  }, []);

  const agendarAtualizacao = useCallback(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void carregar(true);
    }, 650);
  }, [carregar]);

  useEffect(() => {
    void carregar(false);

    const channel = supabase
      .channel('gerencial-producao-painel-todos-projetos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_projetos' }, agendarAtualizacao)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_processos' }, agendarAtualizacao)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_ordens_producao' }, agendarAtualizacao)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_apontamentos' }, agendarAtualizacao)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_apontamento_membros' }, agendarAtualizacao)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_materiais_projeto' }, agendarAtualizacao)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, agendarAtualizacao)
      .subscribe();

    const fallback = window.setInterval(() => void carregar(true), 30000);

    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [agendarAtualizacao, carregar]);

  const graficoProjetos = useMemo(
    () =>
      projetos.map((projeto) => ({
        nome: projeto.projeto_nome.replace(/^RFM-|^BNO - |^BPE - |^E2D - /, '').trim(),
        percentual: Number(projeto.percentual_realizado ?? 0),
      })),
    [projetos],
  );

  const totais = useMemo(() => {
    const horasHomem = projetos.reduce((total, projeto) => total + projeto.horas_homem, 0);
    const membros = new Set<number>();
    projetos.forEach((projeto) => membros.add(projeto.membros_distintos));
    const custosPermitidos = projetos.every(
      (projeto) => projeto.custo_mao_obra !== null && projeto.custo_materiais !== null,
    );
    const custo = custosPermitidos
      ? projetos.reduce(
          (total, projeto) =>
            total + Number(projeto.custo_mao_obra ?? 0) + Number(projeto.custo_materiais ?? 0),
          0,
        )
      : null;
    return { horasHomem, custo };
  }, [projetos]);

  const abrirTelaCheia = async () => {
    const alvo = painelRef.current;
    if (!alvo) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await alvo.requestFullscreen();
  };

  if (loadingInicial && projetos.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-56 items-center justify-center text-muted-foreground">
          Carregando o acompanhamento dos projetos...
        </CardContent>
      </Card>
    );
  }

  return (
    <div ref={painelRef} className="gerencial-producao-live space-y-5 bg-background text-foreground">
      <style>{`
        @media print {
          .gerencial-producao-live-controles { display: none !important; }
          .gerencial-producao-live { padding: 0 !important; }
          .gerencial-producao-live .projeto-live-card { break-inside: avoid; }
        }
        .gerencial-producao-live:fullscreen {
          overflow: auto;
          padding: 24px;
        }
      `}</style>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <MonitorUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Acompanhamento ao vivo
              </p>
              <h2 className="text-2xl font-bold">Todos os projetos de Produção</h2>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Atualização automática
            </span>
            <span>{projetos.length} projetos ativos</span>
            {ultimaAtualizacao && (
              <span>Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR')}</span>
            )}
            {sincronizando && <span>Sincronizando novos apontamentos…</span>}
          </div>
        </div>

        <div className="gerencial-producao-live-controles flex flex-wrap items-center gap-2">
          <Select value={tipoGrafico} onValueChange={(valor) => setTipoGrafico(valor as TipoGrafico)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="barras">Gráfico de barras</SelectItem>
              <SelectItem value="linha">Gráfico de linha</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
          <Button variant="outline" onClick={() => void abrirTelaCheia()}>
            <Expand className="mr-2 h-4 w-4" />
            Tela cheia
          </Button>
        </div>
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Falha ao atualizar o painel</AlertTitle>
          <AlertDescription>
            {erro}. Os últimos dados válidos permanecem na tela até a próxima sincronização.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Projetos ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{projetos.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <WalletCards className="h-4 w-4" /> Custo realizado consolidado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{moeda(totais.custo)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> Mão de obra acumulada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{numero(totais.horasHomem)} h-h</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="h-5 w-5 text-primary" />
            Progresso geral dos projetos
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {graficoProjetos.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Nenhum projeto ativo encontrado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {tipoGrafico === 'linha' ? (
                <LineChart data={graficoProjetos} margin={{ top: 12, right: 18, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nome" angle={-18} textAnchor="end" interval={0} height={62} />
                  <YAxis domain={[0, 100]} tickFormatter={(valor) => `${valor}%`} />
                  <Tooltip formatter={(valor: number) => [`${numero(valor)}%`, 'Conclusão']} />
                  <Line type="monotone" dataKey="percentual" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              ) : (
                <BarChart data={graficoProjetos} margin={{ top: 12, right: 18, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nome" angle={-18} textAnchor="end" interval={0} height={62} />
                  <YAxis domain={[0, 100]} tickFormatter={(valor) => `${valor}%`} />
                  <Tooltip formatter={(valor: number) => [`${numero(valor)}%`, 'Conclusão']} />
                  <Bar dataKey="percentual" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {projetos.map((projeto) => {
          const custoRestrito = projeto.custo_mao_obra === null || projeto.custo_materiais === null;
          const custoIncompleto = projeto.custo_mao_obra_incompleto || projeto.custo_materiais_incompleto;
          const custoTotal = custoRestrito
            ? null
            : Number(projeto.custo_mao_obra ?? 0) + Number(projeto.custo_materiais ?? 0);
          const opsAtivas = projeto.etapas.flatMap((etapa) =>
            (etapa.ordens ?? [])
              .filter((op) => !['concluida', 'cancelada'].includes(op.status))
              .map((op) => ({ ...op, etapaNome: etapa.nome })),
          );
          const etapaAtual =
            projeto.etapas.find((etapa) => etapa.status === 'em_andamento') ??
            projeto.etapas.find((etapa) => !['finalizado', 'cancelado'].includes(etapa.status)) ??
            null;

          return (
            <Card key={projeto.projeto_id} className="projeto-live-card overflow-hidden">
              <CardHeader className="space-y-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {projeto.cliente || 'Cliente não informado'}
                    </p>
                    <CardTitle className="mt-1 text-xl leading-tight">{projeto.projeto_nome}</CardTitle>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-3xl font-bold">{numero(projeto.percentual_realizado)}%</div>
                    <p className="text-xs text-muted-foreground">concluído</p>
                  </div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.max(0, Math.min(100, projeto.percentual_realizado))}%` }}
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Custo realizado</p>
                    <p className="mt-1 font-semibold">{moeda(custoTotal)}</p>
                    {custoIncompleto && <p className="mt-1 text-[11px] text-amber-600">Cadastro de custo incompleto</p>}
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Mão de obra</p>
                    <p className="mt-1 font-semibold">{numero(projeto.horas_homem)} h-h</p>
                    <p className="text-[11px] text-muted-foreground">{projeto.membros_distintos} pessoas</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Etapas</p>
                    <p className="mt-1 font-semibold">{projeto.etapas_concluidas}/{projeto.etapas_total}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">OPs</p>
                    <p className="mt-1 font-semibold">{projeto.ops_concluidas}/{projeto.ops_total}</p>
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Etapa atual</p>
                      <p className="font-medium">
                        {etapaAtual ? etapaAtual.nome : projeto.etapas_total === 0 ? 'Ainda não planejada' : 'Projeto sem etapa em execução'}
                      </p>
                    </div>
                    {etapaAtual && (
                      <Badge variant="outline">{statusEtapaLabel[etapaAtual.status] ?? etapaAtual.status}</Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Factory className="h-4 w-4 text-primary" /> OPs atuais
                    </p>
                    <span className="text-xs text-muted-foreground">{opsAtivas.length} abertas</span>
                  </div>

                  {opsAtivas.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                      {projeto.ops_total === 0
                        ? 'Projeto ainda sem OPs cadastradas.'
                        : 'Nenhuma OP aberta neste momento.'}
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {opsAtivas.map((op) => (
                        <div key={op.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-primary">OP {String(op.numero).padStart(6, '0')}</p>
                              <p className="truncate text-sm font-medium" title={op.atividade}>{op.atividade}</p>
                              <p className="truncate text-[11px] text-muted-foreground" title={op.etapaNome}>{op.etapaNome}</p>
                            </div>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {statusOpLabel[op.status] ?? op.status}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.max(0, Math.min(100, Number(op.percentual_realizado ?? 0)))}%` }}
                              />
                            </div>
                            <span className="w-12 text-right text-xs font-semibold">{numero(op.percentual_realizado)}%</span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {numero(op.quantidade_realizada)} / {numero(op.quantidade_planejada)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
