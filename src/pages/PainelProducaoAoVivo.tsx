import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Expand,
  Factory,
  Loader2,
  MonitorUp,
  Pause,
  Play,
  Printer,
  RefreshCcw,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import { useCronogramaProducao } from '@/hooks/useCronogramaProducao';
import { useProducaoGerencial } from '@/hooks/useProducaoGerencial';
import { supabase } from '@/integrations/supabase/client';

type TipoGrafico = 'barras' | 'linha' | 'rosca';

interface CustoMateriaisProjeto {
  total: number;
  incompleto: boolean;
}

const moeda = (valor: number | null) =>
  valor === null
    ? 'Incompleto'
    : valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const numero = (valor: number) =>
  valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const normalizar = (valor: string) =>
  valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

const PainelProducaoAoVivo = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { canViewBIProducao, loading: permissionsLoading } = usePermissions();
  const { projetos, listarProjetos } = useProjetosProducao();
  const { etapas, listarCronograma, loading: cronogramaLoading } = useCronogramaProducao();
  const {
    dadosConsolidados,
    carregarIndicadores,
    loading: indicadoresLoading,
  } = useProducaoGerencial();

  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('barras');
  const [rotacaoAutomatica, setRotacaoAutomatica] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [custoMateriais, setCustoMateriais] = useState<CustoMateriaisProjeto>({
    total: 0,
    incompleto: false,
  });

  const projetoParam = searchParams.get('projeto');
  const projetosAtivos = useMemo(
    () => projetos.filter((projeto) => projeto.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [projetos],
  );

  const projetoSelecionado = useMemo(() => {
    if (projetosAtivos.length === 0) return null;
    if (!projetoParam) return projetosAtivos[0];
    return (
      projetosAtivos.find(
        (projeto) =>
          projeto.id === projetoParam || projeto.local_utilizacao_id === projetoParam,
      ) ?? projetosAtivos[0]
    );
  }, [projetoParam, projetosAtivos]);

  const carregarCustoMateriais = useCallback(async (localId: string) => {
    const { data: materiais, error: materiaisError } = await supabase
      .from('producao_materiais_projeto')
      .select('item_id,quantidade,tipo')
      .eq('projeto_local_id', localId);

    if (materiaisError) throw materiaisError;

    const itemIds = [
      ...new Set(
        (materiais ?? [])
          .map((material) => material.item_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (itemIds.length === 0) {
      setCustoMateriais({ total: 0, incompleto: false });
      return;
    }

    const { data: itens, error: itensError } = await supabase
      .from('items')
      .select('id,valor')
      .in('id', itemIds);

    if (itensError) throw itensError;

    const valorPorItem = new Map(
      (itens ?? []).map((item) => [item.id, item.valor === null ? null : Number(item.valor)]),
    );

    let total = 0;
    let incompleto = false;

    (materiais ?? []).forEach((material) => {
      if (!material.item_id) return;
      const tipo = normalizar(material.tipo ?? '');
      const sinal = tipo === 'SAIDA' ? 1 : tipo === 'ENTRADA' ? -1 : 0;
      if (sinal === 0) return;

      const valorUnitario = valorPorItem.get(material.item_id);
      if (valorUnitario === null || valorUnitario === undefined) {
        incompleto = true;
        return;
      }

      total += sinal * Number(material.quantidade ?? 0) * valorUnitario;
    });

    setCustoMateriais({ total: Math.max(0, total), incompleto });
  }, []);

  const recarregarProjeto = useCallback(async () => {
    if (!projetoSelecionado) return;
    await Promise.allSettled([
      listarCronograma(),
      carregarIndicadores({ projeto_local_id: projetoSelecionado.local_utilizacao_id }),
      carregarCustoMateriais(projetoSelecionado.local_utilizacao_id),
    ]);
    setUltimaAtualizacao(new Date());
  }, [
    carregarCustoMateriais,
    carregarIndicadores,
    listarCronograma,
    projetoSelecionado,
  ]);

  useEffect(() => {
    void listarProjetos(true);
  }, [listarProjetos]);

  useEffect(() => {
    if (!projetoSelecionado) return;
    if (projetoParam !== projetoSelecionado.id) {
      setSearchParams({ projeto: projetoSelecionado.id }, { replace: true });
      return;
    }
    void recarregarProjeto();
  }, [projetoParam, projetoSelecionado, recarregarProjeto, setSearchParams]);

  useEffect(() => {
    if (!projetoSelecionado) return;

    const atualizar = () => void recarregarProjeto();
    const channel = supabase
      .channel(`painel-producao-ao-vivo-${projetoSelecionado.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_apontamentos' }, atualizar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_apontamento_membros' }, atualizar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_materiais_projeto' }, atualizar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_ordens_producao' }, atualizar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_processos' }, atualizar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_projetos' }, () => {
        void listarProjetos(true);
        atualizar();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locais_utilizacao' }, () => {
        void listarProjetos(true);
        atualizar();
      })
      .subscribe();

    const intervalo = window.setInterval(atualizar, 30000);

    return () => {
      window.clearInterval(intervalo);
      void supabase.removeChannel(channel);
    };
  }, [listarProjetos, projetoSelecionado, recarregarProjeto]);

  useEffect(() => {
    if (!rotacaoAutomatica || projetosAtivos.length <= 1 || !projetoSelecionado) return;
    const intervalo = window.setInterval(() => {
      const indiceAtual = projetosAtivos.findIndex((projeto) => projeto.id === projetoSelecionado.id);
      const proximo = projetosAtivos[(indiceAtual + 1) % projetosAtivos.length];
      if (proximo) setSearchParams({ projeto: proximo.id });
    }, 20000);

    return () => window.clearInterval(intervalo);
  }, [projetoSelecionado, projetosAtivos, rotacaoAutomatica, setSearchParams]);

  const etapasProjeto = useMemo(
    () =>
      projetoSelecionado
        ? etapas
            .filter(
              (etapa) =>
                etapa.projeto_id === projetoSelecionado.id && etapa.status !== 'cancelado',
            )
            .sort((a, b) => a.sequencia - b.sequencia)
        : [],
    [etapas, projetoSelecionado],
  );

  const progressoGeral = useMemo(() => {
    if (etapasProjeto.length === 0) return 0;
    const soma = etapasProjeto.reduce(
      (total, etapa) => total + Math.min(100, Math.max(0, Number(etapa.percentual_realizado ?? 0))),
      0,
    );
    return Number((soma / etapasProjeto.length).toFixed(1));
  }, [etapasProjeto]);

  const etapaAtual = useMemo(() => {
    const emAndamento = etapasProjeto.find((etapa) => etapa.status === 'em_andamento');
    if (emAndamento) return emAndamento;
    return etapasProjeto.find(
      (etapa) => !['finalizado', 'cancelado'].includes(etapa.status),
    ) ?? null;
  }, [etapasProjeto]);

  const etapasConcluidas = etapasProjeto.filter((etapa) => etapa.status === 'finalizado').length;
  const indicadorProjeto = dadosConsolidados.por_projeto.find(
    (projeto) => projeto.projeto_local_id === projetoSelecionado?.local_utilizacao_id,
  );
  const custoMaoObra = dadosConsolidados.custo_total_mao_obra;
  const custoTotal =
    custoMaoObra === null || custoMateriais.incompleto
      ? null
      : custoMaoObra + custoMateriais.total;

  const dadosEtapas = etapasProjeto.map((etapa) => ({
    nome: etapa.codigo ? `${etapa.codigo} · ${etapa.etapa_nome}` : etapa.etapa_nome,
    percentual: Number(Number(etapa.percentual_realizado ?? 0).toFixed(1)),
  }));

  const dadosRosca = [
    { nome: 'Concluído', valor: progressoGeral, fill: 'hsl(var(--primary))' },
    { nome: 'Restante', valor: Math.max(0, 100 - progressoGeral), fill: 'hsl(var(--muted))' },
  ];

  const dadosCusto = [
    { nome: 'Mão de obra', valor: Math.max(0, custoMaoObra ?? 0), fill: 'hsl(var(--primary))' },
    { nome: 'Materiais', valor: Math.max(0, custoMateriais.total), fill: 'hsl(var(--muted-foreground))' },
  ].filter((item) => item.valor > 0);

  const carregando = cronogramaLoading || indicadoresLoading;

  const abrirTelaCheia = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  };

  if (authLoading || permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!canViewBIProducao()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Acesso não permitido</CardTitle>
            <CardDescription>
              Seu perfil não possui permissão para visualizar o Gerencial de Produção.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>Voltar ao sistema</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-6 xl:p-8">
      <style>{`
        @media print {
          .painel-monitor-controles { display: none !important; }
          body { background: white !important; }
          main { padding: 0 !important; }
        }
      `}</style>

      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border bg-card p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <MonitorUp className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Painel ao vivo da produção
                </p>
                <h1 className="truncate text-2xl font-bold md:text-3xl">
                  {projetoSelecionado?.nome ?? 'Selecione um projeto'}
                </h1>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Atualização automática ativa
              </span>
              {ultimaAtualizacao && (
                <span>Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR')}</span>
              )}
            </div>
          </div>

          <div className="painel-monitor-controles flex flex-wrap items-center gap-2">
            <Select
              value={projetoSelecionado?.id ?? ''}
              onValueChange={(valor) => setSearchParams({ projeto: valor })}
            >
              <SelectTrigger className="w-[280px] max-w-full">
                <SelectValue placeholder="Selecionar projeto" />
              </SelectTrigger>
              <SelectContent>
                {projetosAtivos.map((projeto) => (
                  <SelectItem key={projeto.id} value={projeto.id}>
                    {projeto.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setRotacaoAutomatica((ativo) => !ativo)}
            >
              {rotacaoAutomatica ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {rotacaoAutomatica ? 'Pausar rotação' : 'Rodar projetos'}
            </Button>
            <Button variant="outline" onClick={() => void recarregarProjeto()} disabled={carregando}>
              {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Atualizar
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir / PDF
            </Button>
            <Button variant="outline" onClick={() => void abrirTelaCheia()}>
              <Expand className="mr-2 h-4 w-4" />
              Tela cheia
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </header>

        {projetosAtivos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum projeto ativo de Produção foi encontrado.
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    Progresso do projeto
                    <Factory className="h-4 w-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{numero(progressoGeral)}%</div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, progressoGeral))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Média do progresso das etapas não canceladas.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    Custo realizado
                    <WalletCards className="h-4 w-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{moeda(custoTotal)}</div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    M.O. {moeda(custoMaoObra)} · Materiais {moeda(custoMateriais.incompleto ? null : custoMateriais.total)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Materiais avaliados pelo valor atual do cadastro.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    Mão de obra utilizada
                    <Users className="h-4 w-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{numero(dadosConsolidados.horas_homem)} h-h</div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {indicadorProjeto?.total_membros_distintos ?? 0} pessoas únicas envolvidas.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Etapa atual</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold leading-tight">
                    {etapaAtual?.etapa_nome ?? 'Sem etapa em andamento'}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {etapasConcluidas} de {etapasProjeto.length} etapas concluídas.
                  </p>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
              <Card>
                <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Progresso por etapa</CardTitle>
                    <CardDescription>
                      Visualização do avanço físico das etapas do projeto.
                    </CardDescription>
                  </div>
                  <div className="painel-monitor-controles">
                    <Select value={tipoGrafico} onValueChange={(valor) => setTipoGrafico(valor as TipoGrafico)}>
                      <SelectTrigger className="w-[170px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="barras">Barras</SelectItem>
                        <SelectItem value="linha">Linha</SelectItem>
                        <SelectItem value="rosca">Rosca</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {dadosEtapas.length === 0 ? (
                    <div className="flex h-[360px] items-center justify-center text-muted-foreground">
                      Nenhuma etapa cadastrada para este projeto.
                    </div>
                  ) : tipoGrafico === 'barras' ? (
                    <div className="h-[420px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dadosEtapas} layout="vertical" margin={{ left: 18, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis type="number" domain={[0, 100]} unit="%" />
                          <YAxis type="category" dataKey="nome" width={180} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(valor: number) => [`${numero(Number(valor))}%`, 'Progresso']} />
                          <Bar dataKey="percentual" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : tipoGrafico === 'linha' ? (
                    <div className="h-[420px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dadosEtapas} margin={{ left: 10, right: 20, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="nome" interval={0} angle={-30} textAnchor="end" height={90} tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} unit="%" />
                          <Tooltip formatter={(valor: number) => [`${numero(Number(valor))}%`, 'Progresso']} />
                          <Line type="monotone" dataKey="percentual" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="relative h-[420px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dadosRosca}
                            dataKey="valor"
                            nameKey="nome"
                            innerRadius="62%"
                            outerRadius="82%"
                            startAngle={90}
                            endAngle={-270}
                            isAnimationActive={false}
                          />
                          <Tooltip formatter={(valor: number) => `${numero(Number(valor))}%`} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-5xl font-bold">{numero(progressoGeral)}%</div>
                          <div className="text-sm text-muted-foreground">concluído</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Composição do custo</CardTitle>
                  <CardDescription>
                    Mão de obra e materiais vinculados ao projeto.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {dadosCusto.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                      Ainda não há custo mensurado para este projeto.
                    </div>
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dadosCusto}
                            dataKey="valor"
                            nameKey="nome"
                            innerRadius="52%"
                            outerRadius="78%"
                            isAnimationActive={false}
                          />
                          <Tooltip formatter={(valor: number) => moeda(Number(valor))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <span className="text-muted-foreground">Mão de obra</span>
                      <div className="font-semibold">{moeda(custoMaoObra)}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <span className="text-muted-foreground">Materiais</span>
                      <div className="font-semibold">
                        {moeda(custoMateriais.incompleto ? null : custoMateriais.total)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Etapas do projeto</CardTitle>
                <CardDescription>
                  Leitura rápida para acompanhamento em monitor de fábrica.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {etapasProjeto.map((etapa) => (
                  <div key={etapa.etapa_id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{etapa.etapa_nome}</p>
                        <p className="text-xs text-muted-foreground">{etapa.codigo}</p>
                      </div>
                      <span className="text-lg font-bold">{numero(Number(etapa.percentual_realizado ?? 0))}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, Number(etapa.percentual_realizado ?? 0)))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
};

export default PainelProducaoAoVivo;
