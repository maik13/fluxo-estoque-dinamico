import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Building2,
  CloudRain,
  CloudSun,
  Droplets,
  FileClock,
  MapPin,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Wind,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useEstoqueContext } from '@/contexts/EstoqueContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import type { EstoqueItem, Movimentacao } from '@/types/estoque';
import { cn } from '@/lib/utils';

type VisaoGeralEstoqueProps = {
  onAbrirEstoque?: () => void;
  onAbrirMovimentacoes?: () => void;
  onAbrirMenu?: () => void;
  onAbrirProjetos?: () => void;
};

type WeatherState = {
  temperature: number;
  apparent: number;
  humidity: number;
  wind: number;
  rain: number;
  weatherCode: number;
  forecast: Array<{ date: string; max: number; min: number; rain: number }>;
};

const normalizeDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const isToday = (isoDate: string) => normalizeDateKey(new Date(isoDate)) === normalizeDateKey(new Date());

const lastDays = (days: number) => {
  const result: string[] = [];
  const today = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    result.push(normalizeDateKey(date));
  }
  return result;
};

const withinDays = (isoDate: string, days: number) => {
  const timestamp = new Date(isoDate).getTime();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return timestamp >= cutoff;
};

const weatherLabel = (code: number) => {
  if (code === 0) return 'Céu limpo';
  if (code <= 3) return 'Parcialmente nublado';
  if (code <= 48) return 'Neblina';
  if (code <= 57) return 'Garoa';
  if (code <= 67) return 'Chuva';
  if (code <= 82) return 'Pancadas de chuva';
  if (code >= 95) return 'Trovoadas';
  return 'Condições variáveis';
};

const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);

function MiniBars({ values, tone = 'primary' }: { values: number[]; tone?: 'primary' | 'success' | 'warning' }) {
  const max = Math.max(...values, 1);
  const color = tone === 'success' ? 'bg-emerald-400' : tone === 'warning' ? 'bg-amber-400' : 'bg-primary';

  return (
    <div className="flex h-8 items-end gap-1" aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={`${index}-${value}`}
          className={cn('w-1.5 rounded-sm opacity-80', color)}
          style={{ height: `${Math.max(4, (value / max) * 30)}px` }}
        />
      ))}
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = 'primary',
  trend,
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: typeof Boxes;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  trend?: number[];
  onClick?: () => void;
}) {
  const toneClasses = {
    primary: 'border-primary/20 bg-primary/5 text-primary',
    success: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
    warning: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
    danger: 'border-red-500/20 bg-red-500/5 text-red-400',
    info: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400',
  } as const;

  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="min-w-0 text-left disabled:cursor-default">
      <Card className="h-full border-border/70 bg-card/80 transition hover:border-primary/30">
        <CardContent className="flex h-full items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', toneClasses[tone])}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate text-xs font-medium text-muted-foreground">{title}</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {trend && trend.length > 0 && <MiniBars values={trend} tone={tone === 'success' ? 'success' : tone === 'warning' || tone === 'danger' ? 'warning' : 'primary'} />}
        </CardContent>
      </Card>
    </button>
  );
}

function WeatherCard() {
  const [consent, setConsent] = useState(() => localStorage.getItem('almoxarifado-weather-consent') === '1');
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!consent) return;
    if (!navigator.geolocation) {
      setError('Localização indisponível neste navegador.');
      return;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const url = new URL('https://api.open-meteo.com/v1/forecast');
          url.search = new URLSearchParams({
            latitude: String(Math.round(coords.latitude * 100) / 100),
            longitude: String(Math.round(coords.longitude * 100) / 100),
            current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
            daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
            timezone: 'auto',
            forecast_days: '4',
          }).toString();

          const response = await fetch(url);
          if (!response.ok) throw new Error('Clima indisponível');
          const data = await response.json();

          setWeather({
            temperature: Math.round(data.current.temperature_2m),
            apparent: Math.round(data.current.apparent_temperature),
            humidity: Math.round(data.current.relative_humidity_2m),
            wind: Math.round(data.current.wind_speed_10m),
            rain: Math.round(data.daily.precipitation_probability_max?.[0] || 0),
            weatherCode: Number(data.current.weather_code || 0),
            forecast: (data.daily.time || []).slice(0, 4).map((date: string, index: number) => ({
              date,
              max: Math.round(data.daily.temperature_2m_max[index]),
              min: Math.round(data.daily.temperature_2m_min[index]),
              rain: Math.round(data.daily.precipitation_probability_max[index] || 0),
            })),
          });
        } catch (weatherError) {
          console.error('Erro ao carregar clima do almoxarifado:', weatherError);
          setError('Não foi possível consultar o clima agora.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setError('Permita a localização do navegador para exibir o clima.');
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 15 * 60 * 1000 },
    );
  }, [consent, refreshKey]);

  if (!consent) {
    return (
      <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-card to-card">
        <CardContent className="flex min-h-[150px] items-center justify-between gap-4 p-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-300">
              <MapPin className="h-4 w-4" /> Clima do almoxarifado
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">Ative sua localização para acompanhar temperatura, chuva, umidade e vento.</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              localStorage.setItem('almoxarifado-weather-consent', '1');
              setConsent(true);
            }}
          >
            <CloudSun className="mr-2 h-4 w-4" /> Ativar clima
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-card to-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-cyan-300">
              <MapPin className="h-3.5 w-3.5" /> Na sua localização
            </div>
            {weather ? (
              <div className="mt-2 flex items-center gap-3">
                {weather.weatherCode >= 51 ? <CloudRain className="h-9 w-9 text-cyan-300" /> : <CloudSun className="h-9 w-9 text-cyan-300" />}
                <div>
                  <div className="text-4xl font-light text-foreground">{weather.temperature}°</div>
                  <div className="text-xs text-muted-foreground">{weatherLabel(weather.weatherCode)} · sensação {weather.apparent}°</div>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">{loading ? 'Consultando clima…' : error || 'Clima indisponível.'}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRefreshKey((value) => value + 1)} aria-label="Atualizar clima">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>

        {weather && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Droplets className="h-3.5 w-3.5" /> {weather.humidity}%</span>
              <span className="flex items-center gap-1"><CloudRain className="h-3.5 w-3.5" /> {weather.rain}%</span>
              <span className="flex items-center gap-1"><Wind className="h-3.5 w-3.5" /> {weather.wind} km/h</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {weather.forecast.map((day, index) => (
                <div key={day.date} className="rounded-lg bg-background/40 px-2 py-2 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground">{index === 0 ? 'Hoje' : new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`)).replace('.', '')}</div>
                  <div className="mt-1 text-xs font-medium text-foreground">{day.max}° <span className="text-muted-foreground">{day.min}°</span></div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const buildSevenDaySeries = (movements: Movimentacao[], type: 'ENTRADA' | 'SAIDA') => {
  const keys = lastDays(7);
  const counts = new Map(keys.map((key) => [key, 0]));
  movements.forEach((movement) => {
    if (movement.tipo !== type) return;
    const key = normalizeDateKey(new Date(movement.dataHora));
    if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return keys.map((key) => counts.get(key) || 0);
};

export const VisaoGeralEstoque = ({ onAbrirEstoque, onAbrirMovimentacoes, onAbrirMenu, onAbrirProjetos }: VisaoGeralEstoqueProps) => {
  const { obterEstoque, movimentacoes, loading } = useEstoqueContext();
  const { obterEstoqueAtivoInfo } = useConfiguracoes();
  const { canManageStock, canSolicitacaoMaterial, canPedidoCompra } = usePermissions();

  const itens = obterEstoque();
  const estoqueInfo = obterEstoqueAtivoInfo();
  const estoqueId = estoqueInfo?.id;
  const podeVerEstoque = canManageStock();
  const podeVerSolicitacoes = canSolicitacaoMaterial();
  const podeVerCompras = canPedidoCompra();

  const [pendentes, setPendentes] = useState<number | null>(null);
  const [pedidosAbertos, setPedidosAbertos] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;

    const carregarContadores = async () => {
      if (podeVerSolicitacoes) {
        let query = supabase
          .from('solicitacoes_material')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendente');
        if (estoqueId) query = query.eq('estoque_id', estoqueId);
        const { count, error } = await query;
        if (ativo) setPendentes(error ? null : count || 0);
      } else if (ativo) {
        setPendentes(null);
      }

      if (podeVerCompras) {
        let query = supabase
          .from('pedidos_compra')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'aberto');
        if (estoqueId) query = query.eq('estoque_id', estoqueId);
        const { count, error } = await query;
        if (ativo) setPedidosAbertos(error ? null : count || 0);
      } else if (ativo) {
        setPedidosAbertos(null);
      }
    };

    void carregarContadores();

    const channel = supabase
      .channel(`visao-geral-estoque-${estoqueId || 'principal'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_material' }, carregarContadores)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_compra' }, carregarContadores)
      .subscribe();

    return () => {
      ativo = false;
      void supabase.removeChannel(channel);
    };
  }, [estoqueId, podeVerCompras, podeVerSolicitacoes]);

  const dashboard = useMemo(() => {
    const ativos = itens.filter((item) => item.ativo !== false);
    const comSaldo = ativos.filter((item) => item.estoqueAtual > 0);
    const comMinimo = ativos.filter((item) => Number(item.quantidadeMinima || 0) > 0);
    const criticos = comMinimo
      .filter((item) => item.estoqueAtual <= Number(item.quantidadeMinima))
      .sort((a, b) => {
        const ratioA = a.estoqueAtual / Math.max(Number(a.quantidadeMinima), 1);
        const ratioB = b.estoqueAtual / Math.max(Number(b.quantidadeMinima), 1);
        return ratioA - ratioB;
      });

    const entradasHoje = movimentacoes.filter((movement) => movement.tipo === 'ENTRADA' && isToday(movement.dataHora));
    const saidasHoje = movimentacoes.filter((movement) => movement.tipo === 'SAIDA' && isToday(movement.dataHora));
    const ultimosSeteDias = movimentacoes.filter((movement) => withinDays(movement.dataHora, 7));

    const saidasPorItem = new Map<string, { item: EstoqueItem | undefined; quantity: number; movements: number }>();
    const itemMap = new Map(itens.map((item) => [item.id, item]));
    ultimosSeteDias.filter((movement) => movement.tipo === 'SAIDA').forEach((movement) => {
      const current = saidasPorItem.get(movement.itemId) || { item: itemMap.get(movement.itemId), quantity: 0, movements: 0 };
      current.quantity += Number(movement.quantidade || 0);
      current.movements += 1;
      saidasPorItem.set(movement.itemId, current);
    });

    const topSaidas = Array.from(saidasPorItem.entries())
      .map(([itemId, aggregate]) => ({
        itemId,
        name: aggregate.item?.nome || ultimosSeteDias.find((movement) => movement.itemId === itemId)?.itemSnapshot?.nome || 'Item não identificado',
        unit: aggregate.item?.unidade || ultimosSeteDias.find((movement) => movement.itemId === itemId)?.itemSnapshot?.unidade || '',
        quantity: aggregate.quantity,
        movements: aggregate.movements,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const saidasPorProjeto = new Map<string, { movements: number; uniqueItems: Set<string> }>();
    ultimosSeteDias.filter((movement) => movement.tipo === 'SAIDA' && movement.localUtilizacaoNome).forEach((movement) => {
      const name = movement.localUtilizacaoNome!;
      const current = saidasPorProjeto.get(name) || { movements: 0, uniqueItems: new Set<string>() };
      current.movements += 1;
      current.uniqueItems.add(movement.itemId);
      saidasPorProjeto.set(name, current);
    });

    const projetoMaisMovimentado = Array.from(saidasPorProjeto.entries())
      .map(([name, aggregate]) => ({ name, movements: aggregate.movements, uniqueItems: aggregate.uniqueItems.size }))
      .sort((a, b) => b.movements - a.movements)[0];

    const recentes = movimentacoes
      .filter((movement) => movement.tipo !== 'CADASTRO')
      .slice()
      .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
      .slice(0, 5);

    return {
      ativos,
      comSaldo,
      comMinimo,
      criticos,
      entradasHoje,
      saidasHoje,
      topSaidas,
      projetoMaisMovimentado,
      recentes,
      entradaSeries: buildSevenDaySeries(movimentacoes, 'ENTRADA'),
      saidaSeries: buildSevenDaySeries(movimentacoes, 'SAIDA'),
    };
  }, [itens, movimentacoes]);

  const statusDia = dashboard.criticos.length > 0
    ? { title: 'Atenção ao estoque', description: `${dashboard.criticos.length} item(ns) atingiram ou ficaram abaixo do mínimo configurado.`, className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' }
    : dashboard.entradasHoje.length + dashboard.saidasHoje.length === 0
      ? { title: 'Sem movimentações hoje', description: 'O almoxarifado ainda não registrou entradas ou saídas no dia.', className: 'border-border bg-muted/20 text-muted-foreground' }
      : { title: 'Operação estável', description: 'Há movimentação no dia e nenhum item está abaixo do mínimo configurado.', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' };

  const maxTopExit = Math.max(...dashboard.topSaidas.map((item) => item.quantity), 1);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="flex min-h-[150px] flex-col justify-center rounded-xl border border-border/70 bg-card/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estoque / Almoxarifado</div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Visão Geral do Almoxarifado</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Acompanhe estoque, movimentações, requisições e pontos de atenção do {estoqueInfo?.nome || 'almoxarifado ativo'} em uma única leitura.</p>
        </div>
        <WeatherCard />
      </div>

      {podeVerEstoque && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Itens com saldo" value={loading ? '—' : dashboard.comSaldo.length} subtitle={`${dashboard.ativos.length} itens ativos cadastrados`} icon={Boxes} onClick={onAbrirEstoque} />
          <KpiCard
            title="Abaixo do mínimo"
            value={loading ? '—' : dashboard.criticos.length}
            subtitle={dashboard.comMinimo.length > 0 ? `${dashboard.comMinimo.length} itens possuem mínimo configurado` : 'Nenhum mínimo configurado ainda'}
            icon={AlertTriangle}
            tone={dashboard.criticos.length > 0 ? 'danger' : 'success'}
            onClick={onAbrirEstoque}
          />
          <KpiCard title="Saídas hoje" value={dashboard.saidasHoje.length} subtitle="movimentações registradas" icon={ArrowUpFromLine} tone="info" trend={dashboard.saidaSeries} onClick={onAbrirMovimentacoes} />
          {podeVerSolicitacoes && <KpiCard title="Requisições pendentes" value={pendentes ?? '—'} subtitle="aguardando atendimento" icon={FileClock} tone={(pendentes || 0) > 0 ? 'warning' : 'success'} onClick={onAbrirMenu} />}
          {podeVerCompras && <KpiCard title="Pedidos de compra" value={pedidosAbertos ?? '—'} subtitle="pedidos em aberto" icon={ShoppingCart} tone={(pedidosAbertos || 0) > 0 ? 'warning' : 'primary'} onClick={onAbrirMenu} />}
        </div>
      )}

      {podeVerEstoque && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="border-border/70 bg-card/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm"><Building2 className="h-4 w-4 text-primary" />Projeto / local mais movimentado</CardTitle>
              {onAbrirProjetos && <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={onAbrirProjetos}>Ver todos</Button>}
            </CardHeader>
            <CardContent>
              {dashboard.projetoMaisMovimentado ? (
                <div className="rounded-lg border border-border/70 bg-background/30 p-4">
                  <div className="text-base font-semibold text-foreground">{dashboard.projetoMaisMovimentado.name}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Últimos 7 dias</p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/30 p-3"><div className="text-2xl font-bold text-foreground">{dashboard.projetoMaisMovimentado.movements}</div><div className="text-xs text-muted-foreground">retiradas</div></div>
                    <div className="rounded-lg bg-muted/30 p-3"><div className="text-2xl font-bold text-foreground">{dashboard.projetoMaisMovimentado.uniqueItems}</div><div className="text-xs text-muted-foreground">itens diferentes</div></div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[150px] items-center justify-center text-sm text-muted-foreground">Nenhuma saída vinculada a projeto/local nos últimos 7 dias.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm"><PackageCheck className="h-4 w-4 text-cyan-400" />Itens com maior saída</CardTitle>
              <span className="text-[11px] text-muted-foreground">Últimos 7 dias</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.topSaidas.length > 0 ? dashboard.topSaidas.map((item, index) => (
                <div key={item.itemId} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0">
                    <div className="truncate text-foreground">{item.name}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(5, (item.quantity / maxTopExit) * 100)}%` }} /></div>
                  </div>
                  <span className="whitespace-nowrap font-medium text-foreground">{formatNumber(item.quantity)} {item.unit}</span>
                </div>
              )) : <div className="flex min-h-[150px] items-center justify-center text-sm text-muted-foreground">Nenhuma saída registrada nos últimos 7 dias.</div>}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-red-400" />Estoque crítico</CardTitle>
              {onAbrirEstoque && <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={onAbrirEstoque}>Ver estoque</Button>}
            </CardHeader>
            <CardContent className="space-y-2">
              {dashboard.criticos.length > 0 ? dashboard.criticos.slice(0, 5).map((item) => {
                const min = Number(item.quantidadeMinima || 0);
                const severe = item.estoqueAtual <= 0 || item.estoqueAtual <= min * 0.5;
                return (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border/50 py-2 last:border-0">
                    <div className="min-w-0"><div className="truncate text-xs font-medium text-foreground">{item.nome}</div><div className="text-[10px] text-muted-foreground">mínimo {formatNumber(min)} {item.unidade}</div></div>
                    <div className={cn('text-xs font-bold', severe ? 'text-red-400' : 'text-amber-400')}>{formatNumber(item.estoqueAtual)} {item.unidade}</div>
                    <span className={cn('rounded-md border px-2 py-0.5 text-[10px]', severe ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400')}>{severe ? 'Crítico' : 'Atenção'}</span>
                  </div>
                );
              }) : (
                <div className="flex min-h-[150px] items-center justify-center text-center text-sm text-muted-foreground">
                  {dashboard.comMinimo.length === 0 ? 'Configure quantidades mínimas nos itens para ativar este alerta.' : 'Nenhum item abaixo do mínimo.'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {podeVerEstoque && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          <Card className="border-border/70 bg-card/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm">Movimentações recentes</CardTitle>
              {onAbrirMovimentacoes && <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={onAbrirMovimentacoes}>Ver todas</Button>}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead><tr className="border-b border-border text-muted-foreground"><th className="pb-2 font-medium">Data/Hora</th><th className="pb-2 font-medium">Tipo</th><th className="pb-2 font-medium">Item</th><th className="pb-2 font-medium">Quantidade</th><th className="pb-2 font-medium">Projeto/Local</th></tr></thead>
                  <tbody>
                    {dashboard.recentes.map((movement) => {
                      const currentItem = itens.find((item) => item.id === movement.itemId);
                      const unit = currentItem?.unidade || movement.itemSnapshot?.unidade || '';
                      return (
                        <tr key={movement.id} className="border-b border-border/40 last:border-0">
                          <td className="py-2.5 text-muted-foreground">{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(movement.dataHora))}</td>
                          <td className="py-2.5"><span className={cn('rounded-md border px-2 py-0.5 text-[10px]', movement.tipo === 'ENTRADA' ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400')}>{movement.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}</span></td>
                          <td className="max-w-[240px] truncate py-2.5 text-foreground">{currentItem?.nome || movement.itemSnapshot?.nome || 'Item não identificado'}</td>
                          <td className="py-2.5 text-foreground">{formatNumber(movement.quantidade)} {unit}</td>
                          <td className="max-w-[190px] truncate py-2.5 text-muted-foreground">{movement.localUtilizacaoNome || '—'}</td>
                        </tr>
                      );
                    })}
                    {dashboard.recentes.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Nenhuma movimentação registrada.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Resumo do dia</CardTitle></CardHeader>
            <CardContent>
              <div className={cn('rounded-lg border p-3', statusDia.className)}>
                <div className="text-sm font-semibold">{statusDia.title}</div>
                <p className="mt-1 text-xs opacity-80">{statusDia.description}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/25 p-3"><ArrowDownToLine className="mb-2 h-4 w-4 text-cyan-400" /><div className="text-xl font-bold text-foreground">{dashboard.entradasHoje.length}</div><div className="text-xs text-muted-foreground">entradas hoje</div><div className="mt-2"><MiniBars values={dashboard.entradaSeries} /></div></div>
                <div className="rounded-lg bg-muted/25 p-3"><ArrowUpFromLine className="mb-2 h-4 w-4 text-emerald-400" /><div className="text-xl font-bold text-foreground">{dashboard.saidasHoje.length}</div><div className="text-xs text-muted-foreground">saídas hoje</div><div className="mt-2"><MiniBars values={dashboard.saidaSeries} tone="success" /></div></div>
              </div>
              {(podeVerSolicitacoes || podeVerCompras) && (
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  {podeVerSolicitacoes && <div className="rounded-lg border border-border/60 p-3"><div className="text-muted-foreground">Requisições</div><div className="mt-1 text-lg font-bold text-foreground">{pendentes ?? '—'}</div></div>}
                  {podeVerCompras && <div className="rounded-lg border border-border/60 p-3"><div className="text-muted-foreground">Pedidos abertos</div><div className="mt-1 text-lg font-bold text-foreground">{pedidosAbertos ?? '—'}</div></div>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!podeVerEstoque && (
        <Card className="border-border/70 bg-card/80"><CardContent className="p-6 text-sm text-muted-foreground">A Visão Geral respeita as permissões do usuário. Os indicadores operacionais de estoque ficam disponíveis para perfis autorizados.</CardContent></Card>
      )}
    </div>
  );
};
