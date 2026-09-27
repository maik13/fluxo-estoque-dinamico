import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  Database,
  ExternalLink,
  PackageSearch,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';

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
  acervoCodigo: string | null;
  qtdEstoqueReferencia: number;
  qtdEstoqueAtual: number;
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

type Agenda = {
  id: string;
  tipo: 'turno' | 'marco' | 'gargalo';
  data: string;
  turno: string | null;
  projeto_chave: string | null;
  frente: string | null;
  descricao: string | null;
  meta: string | null;
  responsavel: string | null;
  status: string | null;
  prioridade: string | null;
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

const statusPlanejamento = (saldo: number, necessidade: number, estoque: number) => {
  if (necessidade <= 0) return { label: 'Fora do cálculo', variant: 'outline' as const };
  if (estoque <= 0) return { label: 'Produzir', variant: 'destructive' as const };
  if (saldo < 0) return { label: 'Déficit', variant: 'destructive' as const };
  return { label: 'Coberto pelo acervo', variant: 'secondary' as const };
};

export const PlanejamentoProducao = () => {
  const { canConfigurarProducao } = usePermissions();
  const podeConfigurar = canConfigurarProducao();
  const [dados, setDados] = useState<PlanejamentoPayload>({ projetos: [], itens: [], fonte: null });
  const [acervo, setAcervo] = useState<Acervo[]>([]);
  const [agenda, setAgenda] = useState<Agenda[]>([]);
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [planejamentoResult, acervoResult, agendaResult, parametrosResult] = await Promise.all([
        (supabase.rpc as any)('listar_planejamento_producao_v1'),
        (supabase as any).from('producao_acervo_cenografico').select('id,codigo,categoria,nome,especificacoes,quantidade_estoque,status').eq('ativo', true).order('codigo'),
        (supabase as any).from('producao_planejamento_agenda').select('id,tipo,data,turno,projeto_chave,frente,descricao,meta,responsavel,status,prioridade').order('data').order('fonte_linha'),
        (supabase as any).from('producao_parametros_padrao').select('id,tipologia,detalhamento,tempo_unitario_texto,ritmo_padrao,dias_cronograma,complexidade,gargalos_criticos').eq('ativo', true).order('fonte_linha'),
      ]);

      if (planejamentoResult.error) throw planejamentoResult.error;
      if (acervoResult.error) throw acervoResult.error;
      if (agendaResult.error) throw agendaResult.error;
      if (parametrosResult.error) throw parametrosResult.error;

      setDados((planejamentoResult.data ?? { projetos: [], itens: [], fonte: null }) as PlanejamentoPayload);
      setAcervo((acervoResult.data ?? []) as Acervo[]);
      setAgenda((agendaResult.data ?? []) as Agenda[]);
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

  const linhas = useMemo(
    () => dados.itens.map((item) => {
      const necessidade = projetosAtivos.reduce(
        (soma, projeto) => soma + numero(item.demandas?.[projeto.chave]),
        0,
      );
      const estoque = numero(item.qtdEstoqueAtual);
      const saldo = estoque - necessidade;
      return {
        ...item,
        necessidade,
        estoque,
        saldo,
        faltaProduzir: Math.max(0, necessidade - estoque),
      };
    }),
    [dados.itens, projetosAtivos],
  );

  const resumo = useMemo(() => ({
    projetos: projetosAtivos.length,
    necessidades: linhas.filter((linha) => linha.necessidade > 0).length,
    deficit: linhas.filter((linha) => linha.faltaProduzir > 0).length,
    unidadesFaltantes: linhas.reduce((soma, linha) => soma + linha.faltaProduzir, 0),
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
      setDados((atual) => ({
        ...atual,
        projetos: atual.projetos.map((item) => (
          item.id === projeto.id ? { ...item, ativoCalculo: ativo } : item
        )),
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar o projeto.');
    } finally {
      setSalvandoId(null);
    }
  };

  const agendaFutura = agenda.filter((item) => item.status !== 'Concluido').slice(0, 80);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <h3 className="text-lg font-semibold">Planejamento de Necessidades</h3>
          <p className="text-sm text-muted-foreground">
            Selecione os projetos que entram no cálculo. Esta tela não cria, altera ou conclui OPs automaticamente.
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
            <p className="text-xs text-muted-foreground">Independente do status operacional do projeto na Produção.</p>
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
          <TabsTrigger value="matriz"><PackageSearch className="mr-2 h-4 w-4" />Matriz</TabsTrigger>
          <TabsTrigger value="acervo"><Boxes className="mr-2 h-4 w-4" />Acervo</TabsTrigger>
          <TabsTrigger value="agenda"><CalendarClock className="mr-2 h-4 w-4" />Agenda</TabsTrigger>
          <TabsTrigger value="parametros"><Database className="mr-2 h-4 w-4" />Parâmetros</TabsTrigger>
        </TabsList>

        <TabsContent value="matriz" className="mt-4">
          <Card className="overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Peça</th>
                    <th className="p-3 text-right">Necessário</th>
                    <th className="p-3 text-right">Acervo</th>
                    <th className="p-3 text-right">Saldo</th>
                    <th className="p-3 text-right">Falta produzir</th>
                    <th className="p-3">Situação</th>
                    <th className="p-3">Ref.</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => {
                    const situacao = statusPlanejamento(linha.saldo, linha.necessidade, linha.estoque);
                    return (
                      <tr key={linha.id} className="border-t">
                        <td className="p-3 font-medium">{linha.nome}</td>
                        <td className="p-3 text-right">{linha.necessidade}</td>
                        <td className="p-3 text-right">{linha.estoque}</td>
                        <td className={`p-3 text-right font-medium ${linha.saldo < 0 ? 'text-destructive' : ''}`}>{linha.saldo}</td>
                        <td className={`p-3 text-right font-bold ${linha.faltaProduzir > 0 ? 'text-destructive' : ''}`}>{linha.faltaProduzir}</td>
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
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr><th className="p-3">Código</th><th className="p-3">Categoria</th><th className="p-3">Elemento</th><th className="p-3">Especificação</th><th className="p-3 text-right">Disponível</th><th className="p-3">Status</th></tr>
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

        <TabsContent value="agenda" className="mt-4">
          <div className="space-y-2">
            {agendaFutura.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex flex-col justify-between gap-2 md:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.tipo === 'gargalo' ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CalendarClock className="h-4 w-4" />}
                      <span className="font-medium">{item.frente || item.descricao || 'Atividade'}</span>
                      <Badge variant="outline">{item.tipo}</Badge>
                      {item.prioridade && <Badge variant={item.prioridade === 'Alta' ? 'destructive' : 'secondary'}>{item.prioridade}</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.descricao || item.meta || 'Sem descrição adicional.'}</p>
                  </div>
                  <div className="text-sm md:text-right">
                    <p className="font-medium">{new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')}</p>
                    <p className="text-muted-foreground">{item.turno || item.responsavel || '—'}</p>
                  </div>
                </div>
              </Card>
            ))}
            {!loading && agendaFutura.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhum compromisso futuro encontrado.</p>}
          </div>
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
          <p>A execução continua sendo governada por Etapas, OPs, Jornadas e Apontamentos. O Planejamento apenas calcula necessidade e déficit.</p>
        </div>
      </Card>
    </div>
  );
};
