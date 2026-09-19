import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Droplets,
  Expand,
  Factory,
  ListFilter,
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
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  consumo_tinta_ml: number;
  registros_tinta: number;
  custo_mao_obra: number | null;
  custo_mao_obra_incompleto: boolean;
  custo_materiais: number | null;
  custo_materiais_incompleto: boolean;
  ultima_atualizacao: string;
  etapas: EtapaPainel[];
};

const STORAGE_PROJETOS = 'gerencial-producao-projetos-exibidos-v1';
const STORAGE_SOMENTE_COM_OPS = 'gerencial-producao-somente-com-ops-v1';
const STORAGE_SOMENTE_COM_TINTA = 'gerencial-producao-somente-com-tinta-v1';

const numero = (valor: number) =>
  Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const moeda = (valor: number | null) =>
  valor === null
    ? 'Restrito'
    : Number(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      });

const nomeCurto = (nome: string) =>
  nome.replace(/^RFM-|^BNO\s*-\s*|^BPE\s*-\s*|^E2D\s*-\s*/i, '').trim();

const statusOpLabel: Record<string, string> = {
  rascunho: 'A programar',
  liberada: 'Programada',
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

const MiniBars = ({ values }: { values: number[] }) => {
  const base = values.length > 0 ? values : [0];
  const max = Math.max(...base, 1);

  return (
    <div className="flex h-9 min-w-16 items-end justify-end gap-1" aria-hidden="true">
      {base.slice(0, 12).map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="w-1.5 rounded-t-sm bg-primary/70"
          style={{ height: `${Math.max((Math.max(0, value) / max) * 100, 12)}%` }}
        />
      ))}
    </div>
  );
};

const KpiCompacto = ({
  titulo,
  valor,
  apoio,
  bars,
  icon: Icon,
}: {
  titulo: string;
  valor: string;
  apoio: string;
  bars: number[];
  icon: typeof Factory;
}) => (
  <Card className="border-border/70 bg-card/80 shadow-sm">
    <CardContent className="flex h-[82px] items-center justify-between gap-3 p-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="truncate">{titulo}</span>
        </div>
        <div className="mt-1 truncate text-2xl font-bold leading-none">{valor}</div>
        <p className="mt-1 truncate text-[10px] text-muted-foreground">{apoio}</p>
      </div>
      <MiniBars values={bars} />
    </CardContent>
  </Card>
);

export const PainelProjetosProducaoAoVivo = () => {
  const [projetos, setProjetos] = useState<ProjetoPainel[]>([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('barras');
  const [somenteComOps, setSomenteComOps] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_SOMENTE_COM_OPS) === 'true';
  });
  const [somenteComTinta, setSomenteComTinta] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_SOMENTE_COM_TINTA) === 'true';
  });
  const [projetosSelecionados, setProjetosSelecionados] = useState<string[] | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const salvo = window.localStorage.getItem(STORAGE_PROJETOS);
      if (!salvo) return null;
      const ids = JSON.parse(salvo);
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : null;
    } catch {
      return null;
    }
  });
  const painelRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoadingInicial(true);
    else setSincronizando(true);

    try {
      const [
        { data, error },
        { data: consumosTinta, error: erroTinta },
      ] = await Promise.all([
        (supabase.rpc as any)('listar_painel_gerencial_producao_v1'),
        (supabase.rpc as any)('listar_consumo_tinta_por_projeto_v1'),
      ]);

      if (error) throw error;
      if (erroTinta) throw erroTinta;

      const tintaPorProjeto = new Map(
        (consumosTinta ?? []).map((item: any) => [
          String(item.projeto_id),
          {
            consumo_tinta_ml: Number(item.consumo_tinta_ml ?? 0),
            registros_tinta: Number(item.registros_tinta ?? 0),
          },
        ]),
      );

      const proximo = ((data ?? []) as ProjetoPainel[]).map((projeto) => {
        const tinta = tintaPorProjeto.get(projeto.projeto_id) ?? {
          consumo_tinta_ml: 0,
          registros_tinta: 0,
        };

        return {
          ...projeto,
          percentual_realizado: Number(projeto.percentual_realizado ?? 0),
          horas_homem: Number(projeto.horas_homem ?? 0),
          membros_distintos: Number(projeto.membros_distintos ?? 0),
          consumo_tinta_ml: tinta.consumo_tinta_ml,
          registros_tinta: tinta.registros_tinta,
          custo_mao_obra:
            projeto.custo_mao_obra === null ? null : Number(projeto.custo_mao_obra ?? 0),
          custo_materiais:
            projeto.custo_materiais === null ? null : Number(projeto.custo_materiais ?? 0),
          etapas: (Array.isArray(projeto.etapas) ? projeto.etapas : []).map((etapa) => ({
            ...etapa,
            percentual_realizado: Number(etapa.percentual_realizado ?? 0),
            ordens: (Array.isArray(etapa.ordens) ? etapa.ordens : []).map((op) => ({
              ...op,
              percentual_realizado: Number(op.percentual_realizado ?? 0),
              quantidade_planejada: Number(op.quantidade_planejada ?? 0),
              quantidade_realizada: Number(op.quantidade_realizada ?? 0),
            })),
          })),
        };
      });

      // Só troca o snapshot depois que a leitura completa chega. Enquanto
      // sincroniza, a TV continua exibindo o último estado válido.
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
      .channel('gerencial-producao-visao-ao-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_projetos' }, agendarAtualizacao)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_processos' }, agendarAtualizacao)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_ordens_producao' }, agendarAtualizacao)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_apontamentos' }, agendarAtualizacao)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_apontamento_membros' }, agendarAtualizacao)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producao_consumos_tinta' }, agendarAtualizacao)
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (projetosSelecionados === null) {
      window.localStorage.removeItem(STORAGE_PROJETOS);
    } else {
      window.localStorage.setItem(STORAGE_PROJETOS, JSON.stringify(projetosSelecionados));
    }
  }, [projetosSelecionados]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_SOMENTE_COM_OPS, String(somenteComOps));
  }, [somenteComOps]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      STORAGE_SOMENTE_COM_TINTA,
      String(somenteComTinta),
    );
  }, [somenteComTinta]);

  const projetosElegiveis = useMemo(() => {
    let resultado = projetos;
    if (somenteComOps) {
      resultado = resultado.filter(
        (projeto) => Number(projeto.ops_total ?? 0) > 0,
      );
    }
    if (somenteComTinta) {
      resultado = resultado.filter(
        (projeto) => Number(projeto.consumo_tinta_ml ?? 0) > 0,
      );
    }
    return resultado;
  }, [projetos, somenteComOps, somenteComTinta]);

  const projetosExibidos = useMemo(() => {
    if (projetosSelecionados === null) return projetosElegiveis;
    const ids = new Set(projetosSelecionados);
    return projetosElegiveis.filter((projeto) => ids.has(projeto.projeto_id));
  }, [projetosElegiveis, projetosSelecionados]);

  const alternarProjeto = (projetoId: string) => {
    setProjetosSelecionados((atual) => {
      const base = atual === null ? projetos.map((projeto) => projeto.projeto_id) : atual;
      const marcado = base.includes(projetoId);
      const proximo = marcado ? base.filter((id) => id !== projetoId) : [...base, projetoId];
      return proximo.length === 0 ? base : proximo;
    });
  };

  const graficoProjetos = useMemo(
    () =>
      projetosExibidos.map((projeto) => ({
        nome: nomeCurto(projeto.projeto_nome),
        percentual: projeto.percentual_realizado,
      })),
    [projetosExibidos],
  );

  const totais = useMemo(() => {
    const horasHomem = projetosExibidos.reduce((total, projeto) => total + projeto.horas_homem, 0);
    const progressoMedio = projetosExibidos.length
      ? projetosExibidos.reduce((total, projeto) => total + projeto.percentual_realizado, 0) /
        projetosExibidos.length
      : 0;
    const custosPermitidos = projetosExibidos.every(
      (projeto) => projeto.custo_mao_obra !== null && projeto.custo_materiais !== null,
    );
    const custo = custosPermitidos
      ? projetosExibidos.reduce(
          (total, projeto) =>
            total + Number(projeto.custo_mao_obra ?? 0) + Number(projeto.custo_materiais ?? 0),
          0,
        )
      : null;
    const consumoTintaMl = projetosExibidos.reduce(
      (total, projeto) => total + Number(projeto.consumo_tinta_ml ?? 0),
      0,
    );
    const opsAbertas = projetosExibidos.reduce(
      (total, projeto) =>
        total +
        projeto.etapas.flatMap((etapa) => etapa.ordens ?? []).filter(
          (op) => !['concluida', 'cancelada'].includes(op.status),
        ).length,
      0,
    );
    return { horasHomem, progressoMedio, custo, consumoTintaMl, opsAbertas };
  }, [projetosExibidos]);

  const custosPorProjeto = projetosExibidos.map((projeto) =>
    projeto.custo_mao_obra === null || projeto.custo_materiais === null
      ? 0
      : projeto.custo_mao_obra + projeto.custo_materiais,
  );
  const progressos = projetosExibidos.map((projeto) => projeto.percentual_realizado);
  const horasPorProjeto = projetosExibidos.map((projeto) => projeto.horas_homem);
  const tintaPorProjeto = projetosExibidos.map(
    (projeto) => projeto.consumo_tinta_ml,
  );
  const opsPorProjeto = projetosExibidos.map((projeto) =>
    projeto.etapas.flatMap((etapa) => etapa.ordens ?? []).filter(
      (op) => !['concluida', 'cancelada'].includes(op.status),
    ).length,
  );

  const abrirTelaCheia = async () => {
    const alvo = painelRef.current;
    if (!alvo) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await alvo.requestFullscreen();
  };

  if (loadingInicial && projetos.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
          Carregando a visão ao vivo dos projetos...
        </CardContent>
      </Card>
    );
  }

  return (
    <div ref={painelRef} className="gerencial-producao-live space-y-3 bg-background text-foreground">
      <style>{`
        @media print {
          .gerencial-producao-live-controles { display: none !important; }
          .gerencial-producao-live { padding: 0 !important; }
          .gerencial-producao-live .projeto-live-card { break-inside: avoid; }
        }
        .gerencial-producao-live:fullscreen {
          min-height: 100vh;
          overflow: auto;
          padding: 16px;
        }
        .gerencial-producao-live:fullscreen .projeto-live-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      `}</style>

      <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card/75 px-3.5 py-2.5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-base font-bold">Visão ao vivo dos projetos</h3>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Atualização automática
            </span>
            {ultimaAtualizacao && (
              <span className="text-[11px] text-muted-foreground">
                {ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {sincronizando && <span className="text-[11px] text-primary">Sincronizando…</span>}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Selecione quais projetos ficam expostos. O painel se atualiza sozinho conforme a Produção é apontada.
          </p>
        </div>

        <div className="gerencial-producao-live-controles flex flex-wrap items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <ListFilter className="h-3.5 w-3.5" />
                Projetos {projetosExibidos.length}/{projetos.length}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Projetos exibidos no monitor</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={somenteComOps}
                onCheckedChange={(checked) => setSomenteComOps(checked === true)}
                onSelect={(event) => event.preventDefault()}
              >
                Somente projetos com OP
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={somenteComTinta}
                onCheckedChange={(checked) => setSomenteComTinta(checked === true)}
                onSelect={(event) => event.preventDefault()}
              >
                Somente projetos com consumo de tinta
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={projetosSelecionados === null}
                onCheckedChange={() => setProjetosSelecionados(null)}
                onSelect={(event) => event.preventDefault()}
              >
                Mostrar todos automaticamente
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {projetos.map((projeto) => (
                <DropdownMenuCheckboxItem
                  key={projeto.projeto_id}
                  checked={
                    projetosSelecionados === null || projetosSelecionados.includes(projeto.projeto_id)
                  }
                  onCheckedChange={() => alternarProjeto(projeto.projeto_id)}
                  onSelect={(event) => event.preventDefault()}
                >
                  <span className="truncate" title={projeto.projeto_nome}>{projeto.projeto_nome}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select value={tipoGrafico} onValueChange={(valor) => setTipoGrafico(valor as TipoGrafico)}>
            <SelectTrigger className="h-8 w-[138px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="barras">Barras</SelectItem>
              <SelectItem value="linha">Linha</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" className="h-8" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            PDF
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => void abrirTelaCheia()}>
            <Expand className="mr-1.5 h-3.5 w-3.5" />
            Tela cheia
          </Button>
        </div>
      </div>

      {erro && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm">Falha na última sincronização</AlertTitle>
          <AlertDescription className="text-xs">
            {erro}. O último snapshot válido continua visível.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <KpiCompacto
          titulo="Projetos exibidos"
          valor={String(projetosExibidos.length)}
          apoio={`${totais.opsAbertas} OPs abertas agora`}
          bars={opsPorProjeto}
          icon={Factory}
        />
        <KpiCompacto
          titulo="Progresso médio"
          valor={`${numero(totais.progressoMedio)}%`}
          apoio="Média dos projetos selecionados"
          bars={progressos}
          icon={BarChart3}
        />
        <KpiCompacto
          titulo="Custo realizado"
          valor={moeda(totais.custo)}
          apoio="Mão de obra + materiais apropriados"
          bars={custosPorProjeto}
          icon={WalletCards}
        />
        <KpiCompacto
          titulo="Mão de obra"
          valor={`${numero(totais.horasHomem)} h-h`}
          apoio="Horas-homem acumuladas"
          bars={horasPorProjeto}
          icon={Users}
        />
        <KpiCompacto
          titulo="Consumo de tinta"
          valor={`${numero(totais.consumoTintaMl)} mL`}
          apoio="Volume registrado nas OPs de pintura"
          bars={tintaPorProjeto}
          icon={Droplets}
        />
      </div>

      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardContent className="p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Progresso dos projetos</p>
              <p className="text-[10px] text-muted-foreground">Comparação visual do percentual concluído</p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {projetosExibidos.length} visíveis
            </Badge>
          </div>
          <div className="h-[170px]">
            {graficoProjetos.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhum projeto selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {tipoGrafico === 'linha' ? (
                  <LineChart data={graficoProjetos} margin={{ top: 10, right: 12, left: -12, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} height={38} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(valor) => `${valor}%`} />
                    <Tooltip formatter={(valor: number) => [`${numero(valor)}%`, 'Conclusão']} />
                    <Line type="monotone" dataKey="percentual" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                ) : (
                  <BarChart data={graficoProjetos} margin={{ top: 10, right: 12, left: -12, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} height={38} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(valor) => `${valor}%`} />
                    <Tooltip formatter={(valor: number) => [`${numero(valor)}%`, 'Conclusão']} />
                    <Bar dataKey="percentual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="projeto-live-grid grid items-start gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
        {projetosExibidos.map((projeto) => {
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
          const etapasGrafico = projeto.etapas.map((etapa) => etapa.percentual_realizado);

          return (
            <Card key={projeto.projeto_id} className="projeto-live-card overflow-hidden border-border/70 bg-card/85 shadow-sm">
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {projeto.cliente || 'Cliente não informado'}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-base font-bold leading-tight" title={projeto.projeto_nome}>
                      {projeto.projeto_nome}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-end gap-2">
                    <MiniBars values={etapasGrafico} />
                    <div className="text-right">
                      <div className="text-2xl font-bold leading-none">{numero(projeto.percentual_realizado)}%</div>
                      <p className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">concluído</p>
                    </div>
                  </div>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.max(0, Math.min(100, projeto.percentual_realizado))}%` }}
                  />
                </div>

                <div className="mt-2.5 grid grid-cols-5 gap-1.5">
                  <div className="rounded-md bg-muted/45 px-2 py-1.5">
                    <p className="text-[9px] uppercase text-muted-foreground">Custo</p>
                    <p className="truncate text-xs font-bold" title={moeda(custoTotal)}>{moeda(custoTotal)}</p>
                  </div>
                  <div className="rounded-md bg-muted/45 px-2 py-1.5">
                    <p className="text-[9px] uppercase text-muted-foreground">Mão de obra</p>
                    <p className="text-xs font-bold">{numero(projeto.horas_homem)} h-h</p>
                  </div>
                  <div className="rounded-md bg-muted/45 px-2 py-1.5">
                    <p className="text-[9px] uppercase text-muted-foreground">Etapas</p>
                    <p className="text-xs font-bold">{projeto.etapas_concluidas}/{projeto.etapas_total}</p>
                  </div>
                  <div className="rounded-md bg-muted/45 px-2 py-1.5">
                    <p className="text-[9px] uppercase text-muted-foreground">OPs</p>
                    <p className="text-xs font-bold">{projeto.ops_concluidas}/{projeto.ops_total}</p>
                  </div>
                  <div className="rounded-md bg-muted/45 px-2 py-1.5">
                    <p className="text-[9px] uppercase text-muted-foreground">Tinta</p>
                    <p className="text-xs font-bold">{numero(projeto.consumo_tinta_ml)} mL</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Etapa atual</p>
                    <p className="truncate text-xs font-medium" title={etapaAtual?.nome}>
                      {etapaAtual ? etapaAtual.nome : projeto.etapas_total === 0 ? 'Ainda não planejada' : 'Sem etapa em execução'}
                    </p>
                  </div>
                  {etapaAtual && (
                    <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[9px]">
                      {statusEtapaLabel[etapaAtual.status] ?? etapaAtual.status}
                    </Badge>
                  )}
                </div>

                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Factory className="h-3 w-3 text-primary" /> OPs atuais
                    </p>
                    <span className="text-[10px] font-semibold">{opsAtivas.length} abertas</span>
                  </div>

                  {opsAtivas.length === 0 ? (
                    <p className="rounded-md border border-dashed px-2 py-1.5 text-[10px] text-muted-foreground">
                      {projeto.ops_total === 0 ? 'Projeto sem OPs cadastradas.' : 'Nenhuma OP aberta agora.'}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {opsAtivas.map((op) => (
                        <div key={op.id} className="grid grid-cols-[auto_minmax(0,1fr)_64px_38px] items-center gap-1.5 rounded-md border border-border/55 px-2 py-1">
                          <span className="text-[9px] font-bold text-primary">OP {String(op.numero).padStart(4, '0')}</span>
                          <div className="min-w-0">
                            <p className="truncate text-[10px] font-medium" title={`${op.atividade} · ${op.etapaNome}`}>
                              {op.atividade}
                            </p>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(0, Math.min(100, op.percentual_realizado))}%` }}
                            />
                          </div>
                          <span className="text-right text-[9px] font-bold">{numero(op.percentual_realizado)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {custoIncompleto && (
                  <p className="mt-1.5 text-[9px] text-amber-600">Custo parcial: existem itens ou horas sem valor cadastrado.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
