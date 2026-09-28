import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Database,
  ExternalLink,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { PendenciasIntegracaoPlanejamento } from './PendenciasIntegracaoPlanejamento';

type ProjetoPlanejamento = {
  id: string;
  chave: string;
  nome: string;
  ativoCalculo: boolean;
  ordem: number;
  projectGroupId: string | null;
};

type ItemPlanejamento = {
  id: string;
  fonteLinha: number;
  nome: string;
  acervoId: string | null;
  acervoCodigo: string | null;
  qtdEstoqueReferencia: number;
  qtdEstoqueAtual: number;
  qtdReservada: number;
  qtdDisponivelAtual: number;
  statusPlanilha: string | null;
  demandas: Record<string, number>;
  acervoNome: string | null;
  acervoCategoria: string | null;
};

type Fonte = {
  chave: string;
  nome: string;
  url: string | null;
  modo: string;
  status: string;
  ultimaSincronizacao: string | null;
  ultimoResultado: Record<string, unknown> | null;
} | null;

type PlanejamentoPayload = {
  projetos: ProjetoPlanejamento[];
  itens: ItemPlanejamento[];
  fonte: Fonte;
};

type Acervo = {
  id: string;
  codigo: string;
  categoria: string | null;
  nome: string;
  especificacoes: string | null;
  quantidade_estoque: number;
  status: string | null;
};

type Reserva = {
  id: string;
  acervo_id: string;
  acervo_codigo: string;
  acervo_nome: string;
  project_group_id: string;
  projeto_nome: string;
  quantidade: number;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  observacoes: string | null;
};

type Parametro = {
  id: string;
  tipologia: string;
  detalhamento: string | null;
  tempo_unitario_texto: string | null;
  ritmo_padrao: string | null;
  dias_cronograma: string | null;
  complexidade: string | null;
  gargalos_criticos: string | null;
};

const numero = (valor: unknown) => Number(valor || 0);

const formatarDataHora = (valor: string | null | undefined) => {
  if (!valor) return 'Ainda não sincronizado';
  return new Date(valor).toLocaleString('pt-BR');
};

const statusPlanejamento = (deficit: number, necessidade: number) => {
  if (necessidade <= 0) return { label: 'Fora do cálculo', variant: 'outline' as const };
  if (deficit > 0) return { label: 'Déficit', variant: 'destructive' as const };
  return { label: 'Coberto pelo acervo', variant: 'secondary' as const };
};

export const PlanejamentoProducao = () => {
  const { canConfigurarProducao } = usePermissions();
  const podeConfigurar = canConfigurarProducao();
  const [dados, setDados] = useState<PlanejamentoPayload>({ projetos: [], itens: [], fonte: null });
  const [acervo, setAcervo] = useState<Acervo[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [novoAcervoId, setNovoAcervoId] = useState('');
  const [novoGrupoId, setNovoGrupoId] = useState('');
  const [novaQuantidade, setNovaQuantidade] = useState('1');
  const [novaDataInicio, setNovaDataInicio] = useState('');
  const [novaDataFim, setNovaDataFim] = useState('');
  const [novaObservacao, setNovaObservacao] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [planejamentoResult, acervoResult, reservasResult, parametrosResult] = await Promise.all([
        (supabase.rpc as any)('listar_planejamento_producao_v2'),
        (supabase as any).from('producao_acervo_cenografico').select('id,codigo,categoria,nome,especificacoes,quantidade_estoque,status').eq('ativo', true).order('codigo'),
        (supabase.rpc as any)('listar_reservas_acervo_v1'),
        (supabase as any).from('producao_parametros_padrao').select('id,tipologia,detalhamento,tempo_unitario_texto,ritmo_padrao,dias_cronograma,complexidade,gargalos_criticos').eq('ativo', true).order('fonte_linha'),
      ]);

      if (planejamentoResult.error) throw planejamentoResult.error;
      if (acervoResult.error) throw acervoResult.error;
      if (reservasResult.error) throw reservasResult.error;
      if (parametrosResult.error) throw parametrosResult.error;

      setDados((planejamentoResult.data ?? { projetos: [], itens: [], fonte: null }) as PlanejamentoPayload);
      setAcervo((acervoResult.data ?? []) as Acervo[]);
      setReservas((reservasResult.data ?? []) as Reserva[]);
      setParametros((parametrosResult.data ?? []) as Parametro[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar o planejamento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const projetosAtivos = useMemo(
    () => dados.projetos.filter((projeto) => projeto.ativoCalculo),
    [dados.projetos],
  );

  const gruposDisponiveis = useMemo(
    () => dados.projetos.filter((projeto) => projeto.projectGroupId),
    [dados.projetos],
  );

  const linhas = useMemo(
    () => dados.itens.map((item) => {
      const necessidade = projetosAtivos.reduce(
        (soma, projeto) => soma + numero(item.demandas?.[projeto.chave]),
        0,
      );
      const estoque = numero(item.qtdEstoqueAtual);
      const reservado = numero(item.qtdReservada);
      const disponivel = numero(item.qtdDisponivelAtual);
      const deficit = Math.max(0, necessidade - disponivel);
      return { ...item, necessidade, estoque, reservado, disponivel, deficit };
    }),
    [dados.itens, projetosAtivos],
  );

  const resumo = useMemo(() => ({
    projetos: projetosAtivos.length,
    necessidades: linhas.filter((linha) => linha.necessidade > 0).length,
    deficit: linhas.filter((linha) => linha.deficit > 0).length,
    unidadesFaltantes: linhas.reduce((soma, linha) => soma + linha.deficit, 0),
  }), [linhas, projetosAtivos.length]);

  const alternarProjeto = async (projeto: ProjetoPlanejamento, ativo: boolean) => {
    if (!podeConfigurar) return;
    setSalvandoId(projeto.id);
    try {
      const { error } = await (supabase.rpc as any)('atualizar_planejamento_projeto_v1', {
        p_projeto_id: projeto.id,
        p_ativo_calculo: ativo,
      });
      if (error) throw error;
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar o projeto.');
    } finally {
      setSalvandoId(null);
    }
  };

  const salvarReserva = async () => {
    const quantidade = Number(novaQuantidade);
    if (!novoAcervoId || !novoGrupoId || !Number.isFinite(quantidade) || quantidade <= 0) {
      toast.error('Informe peça, projeto e quantidade válida para reservar.');
      return;
    }
    setSalvandoId('reserva');
    try {
      const { error } = await (supabase.rpc as any)('salvar_reserva_acervo_v1', {
        p_reserva_id: null,
        p_acervo_id: novoAcervoId,
        p_project_group_id: novoGrupoId,
        p_quantidade: quantidade,
        p_data_inicio: novaDataInicio || null,
        p_data_fim: novaDataFim || null,
        p_observacoes: novaObservacao || null,
      });
      if (error) throw error;
      setNovoAcervoId('');
      setNovoGrupoId('');
      setNovaQuantidade('1');
      setNovaDataInicio('');
      setNovaDataFim('');
      setNovaObservacao('');
      toast.success('Reserva registrada. A disponibilidade do acervo foi recalculada.');
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a reserva.');
    } finally {
      setSalvandoId(null);
    }
  };

  const cancelarReserva = async (id: string) => {
    setSalvandoId(id);
    try {
      const { error } = await (supabase.rpc as any)('cancelar_reserva_acervo_v1', { p_reserva_id: id });
      if (error) throw error;
      toast.success('Reserva cancelada.');
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar a reserva.');
    } finally {
      setSalvandoId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <h3 className="text-lg font-semibold">Planejamento de Necessidades</h3>
          <p className="text-sm text-muted-foreground">
            Consolida demanda, acervo, reservas, disponibilidade real e déficit. Nenhuma OP é criada ou alterada automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dados.fonte?.url && (
            <Button variant="outline" asChild>
              <a href={dados.fonte.url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />Abrir planilha
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar tela
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">Projetos considerados no cálculo</p>
            <p className="text-xs text-muted-foreground">Este seletor não altera o status operacional do projeto.</p>
          </div>
          <span className="text-xs text-muted-foreground">
            Origem: {dados.fonte?.nome ?? '—'} · {formatarDataHora(dados.fonte?.ultimaSincronizacao)}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {dados.projetos.map((projeto) => (
            <label key={projeto.id} className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={projeto.ativoCalculo}
                disabled={!podeConfigurar || salvandoId === projeto.id}
                onCheckedChange={(checked) => void alternarProjeto(projeto, checked === true)}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{projeto.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {projeto.ativoCalculo ? 'Incluído na necessidade consolidada' : 'Fora do cálculo'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Projetos ativos</p><p className="text-2xl font-bold">{resumo.projetos}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Peças com demanda</p><p className="text-2xl font-bold">{resumo.necessidades}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Tipologias com déficit</p><p className="text-2xl font-bold">{resumo.deficit}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Unidades a produzir</p><p className="text-2xl font-bold">{resumo.unidadesFaltantes}</p></Card>
      </div>

      <Tabs defaultValue="matriz">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="matriz"><PackageSearch className="mr-2 h-4 w-4" />Necessidades</TabsTrigger>
          <TabsTrigger value="acervo"><Boxes className="mr-2 h-4 w-4" />Acervo</TabsTrigger>
          <TabsTrigger value="reservas"><ShieldCheck className="mr-2 h-4 w-4" />Reservas</TabsTrigger>
          <TabsTrigger value="integracao"><RefreshCw className="mr-2 h-4 w-4" />Integração</TabsTrigger>
          <TabsTrigger value="parametros"><Database className="mr-2 h-4 w-4" />Parâmetros</TabsTrigger>
        </TabsList>

        <TabsContent value="matriz" className="mt-4">
          <Card className="overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Peça</th>
                    <th className="p-3 text-right">Necessário</th>
                    <th className="p-3 text-right">Acervo físico</th>
                    <th className="p-3 text-right">Reservado</th>
                    <th className="p-3 text-right">Disponível real</th>
                    <th className="p-3 text-right">Produzir</th>
                    <th className="p-3">Situação</th>
                    <th className="p-3">Ref.</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => {
                    const situacao = statusPlanejamento(linha.deficit, linha.necessidade);
                    return (
                      <tr key={linha.id} className="border-t">
                        <td className="p-3 font-medium">{linha.nome}</td>
                        <td className="p-3 text-right">{linha.necessidade}</td>
                        <td className="p-3 text-right">{linha.estoque}</td>
                        <td className="p-3 text-right">{linha.reservado}</td>
                        <td className="p-3 text-right font-medium">{linha.disponivel}</td>
                        <td className={`p-3 text-right font-bold ${linha.deficit > 0 ? 'text-destructive' : ''}`}>{linha.deficit}</td>
                        <td className="p-3"><Badge variant={situacao.variant}>{situacao.label}</Badge></td>
                        <td className="p-3 text-muted-foreground">{linha.acervoCodigo ?? 'Sem código'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="acervo" className="mt-4">
          <Card className="overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr><th className="p-3">Código</th><th className="p-3">Categoria</th><th className="p-3">Elemento</th><th className="p-3">Especificação</th><th className="p-3 text-right">Físico</th><th className="p-3">Status</th></tr>
                </thead>
                <tbody>
                  {acervo.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3 font-mono text-xs">{item.codigo}</td>
                      <td className="p-3">{item.categoria ?? '—'}</td>
                      <td className="p-3 font-medium">{item.nome}</td>
                      <td className="p-3 text-muted-foreground">{item.especificacoes ?? '—'}</td>
                      <td className="p-3 text-right font-semibold">{numero(item.quantidade_estoque)}</td>
                      <td className="p-3">{item.status ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="reservas" className="mt-4 space-y-4">
          {podeConfigurar && (
            <Card className="p-4">
              <p className="mb-3 font-medium">Nova reserva de acervo</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="space-y-1.5 xl:col-span-2">
                  <Label>Peça do acervo</Label>
                  <Select value={novoAcervoId} onValueChange={setNovoAcervoId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a peça" /></SelectTrigger>
                    <SelectContent>{acervo.map((item) => <SelectItem key={item.id} value={item.id}>{item.codigo} · {item.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Projeto</Label>
                  <Select value={novoGrupoId} onValueChange={setNovoGrupoId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{gruposDisponiveis.map((projeto) => <SelectItem key={projeto.id} value={projeto.projectGroupId!}>{projeto.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Quantidade</Label><Input type="number" min="0.01" step="0.01" value={novaQuantidade} onChange={(e) => setNovaQuantidade(e.target.value)} /></div>
                <div className="flex items-end"><Button className="w-full" onClick={() => void salvarReserva()} disabled={salvandoId === 'reserva'}>Reservar</Button></div>
                <div className="space-y-1.5"><Label>Início</Label><Input type="date" value={novaDataInicio} onChange={(e) => setNovaDataInicio(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Fim</Label><Input type="date" value={novaDataFim} onChange={(e) => setNovaDataFim(e.target.value)} /></div>
                <div className="space-y-1.5 md:col-span-2 xl:col-span-3"><Label>Observação</Label><Input value={novaObservacao} onChange={(e) => setNovaObservacao(e.target.value)} placeholder="Opcional" /></div>
              </div>
            </Card>
          )}
          <Card className="overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr><th className="p-3">Peça</th><th className="p-3">Projeto</th><th className="p-3 text-right">Quantidade</th><th className="p-3">Período</th><th className="p-3">Status</th><th className="p-3">Observação</th>{podeConfigurar && <th className="p-3"></th>}</tr>
                </thead>
                <tbody>
                  {reservas.map((reserva) => (
                    <tr key={reserva.id} className="border-t">
                      <td className="p-3 font-medium">{reserva.acervo_codigo} · {reserva.acervo_nome}</td>
                      <td className="p-3">{reserva.projeto_nome}</td>
                      <td className="p-3 text-right font-semibold">{numero(reserva.quantidade)}</td>
                      <td className="p-3 text-muted-foreground">{reserva.data_inicio ?? '—'} → {reserva.data_fim ?? '—'}</td>
                      <td className="p-3"><Badge variant={reserva.status === 'ativa' ? 'secondary' : 'outline'}>{reserva.status}</Badge></td>
                      <td className="p-3 text-muted-foreground">{reserva.observacoes ?? '—'}</td>
                      {podeConfigurar && <td className="p-3 text-right">{reserva.status === 'ativa' && <Button variant="ghost" size="sm" onClick={() => void cancelarReserva(reserva.id)} disabled={salvandoId === reserva.id}><XCircle className="mr-1 h-4 w-4" />Cancelar</Button>}</td>}
                    </tr>
                  ))}
                  {!loading && reservas.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma reserva registrada.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="integracao" className="mt-4">
          <PendenciasIntegracaoPlanejamento />
        </TabsContent>

        <TabsContent value="parametros" className="mt-4">
          <div className="grid gap-3 lg:grid-cols-2">
            {parametros.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{item.tipologia}</p>
                  {item.complexidade && <Badge variant="outline">{item.complexidade}</Badge>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.detalhamento}</p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <p><span className="text-muted-foreground">Tempo:</span> {item.tempo_unitario_texto ?? '—'}</p>
                  <p><span className="text-muted-foreground">Ritmo:</span> {item.ritmo_padrao ?? '—'}</p>
                  <p><span className="text-muted-foreground">Cronograma:</span> {item.dias_cronograma ?? '—'}</p>
                  <p><span className="text-muted-foreground">Gargalo:</span> {item.gargalos_criticos ?? '—'}</p>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Card className="border-dashed p-4 text-sm text-muted-foreground">
        <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>A execução continua sendo governada por Etapas, OPs, Jornadas e Apontamentos. O Planejamento somente consolida a necessidade e protege o acervo contra dupla alocação.</p>
        </div>
      </Card>
    </div>
  );
};
