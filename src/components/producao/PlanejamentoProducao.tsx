import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Plus, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
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

type NecessidadeFabricacao = {
  id: string;
  planejamento_item_id: string;
  item_nome: string;
  quantidade: number;
  status: 'a_programar' | 'programada' | 'atendida' | 'cancelada';
};

const numero = (valor: unknown) => Number(valor || 0);

const formatarDataHora = (valor: string | null | undefined) => {
  if (!valor) return 'Ainda não sincronizado';
  return new Date(valor).toLocaleString('pt-BR');
};

const statusPlanejamento = (deficit: number, necessidade: number) => {
  if (necessidade <= 0) return { label: 'Fora do cálculo', variant: 'outline' as const };
  if (deficit > 0) return { label: 'Déficit', variant: 'destructive' as const };
  return { label: 'Coberto', variant: 'secondary' as const };
};

export const PlanejamentoProducao = () => {
  const { canConfigurarProducao } = usePermissions();
  const podeConfigurar = canConfigurarProducao();

  const [dados, setDados] = useState<PlanejamentoPayload>({ projetos: [], itens: [], fonte: null });
  const [necessidadesFabricacao, setNecessidadesFabricacao] = useState<NecessidadeFabricacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [buscaPeca, setBuscaPeca] = useState('');

  const [novaCidade, setNovaCidade] = useState('');
  const [novaPecaNome, setNovaPecaNome] = useState('');
  const [novaPecaCodigo, setNovaPecaCodigo] = useState('');
  const [novaPecaProjetoId, setNovaPecaProjetoId] = useState('');
  const [novaPecaQuantidade, setNovaPecaQuantidade] = useState('0');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [planejamentoResult, necessidadesResult] = await Promise.all([
        (supabase.rpc as any)('listar_planejamento_producao_v2'),
        (supabase.rpc as any)('listar_necessidades_fabricacao_v1'),
      ]);

      if (planejamentoResult.error) throw planejamentoResult.error;
      if (necessidadesResult.error) throw necessidadesResult.error;

      setDados((planejamentoResult.data ?? { projetos: [], itens: [], fonte: null }) as PlanejamentoPayload);
      setNecessidadesFabricacao((necessidadesResult.data ?? []) as NecessidadeFabricacao[]);
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

  const normalizarBusca = (valor: string | null | undefined) =>
    (valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

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

  const linhasFiltradas = useMemo(() => {
    const termo = normalizarBusca(buscaPeca);
    if (!termo) return linhas;

    return linhas.filter((linha) => {
      const campos = [
        linha.nome,
        linha.acervoNome,
        linha.acervoCodigo,
        linha.acervoCategoria,
        linha.statusPlanilha,
      ];
      return campos.some((campo) => normalizarBusca(campo).includes(termo));
    });
  }, [buscaPeca, linhas]);

  const necessidadeAbertaPorItem = useMemo(
    () => new Map(
      necessidadesFabricacao
        .filter((item) => item.status === 'a_programar')
        .map((item) => [item.planejamento_item_id, item]),
    ),
    [necessidadesFabricacao],
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
      toast.success(
        ativo
          ? `${projeto.nome} incluído. As peças foram garantidas na estrutura oficial de Projetos.`
          : `${projeto.nome} retirado do cálculo. Nenhum Projeto, Etapa ou OP foi excluído.`,
      );
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar o projeto.');
    } finally {
      setSalvandoId(null);
    }
  };

  const cadastrarCidade = async () => {
    if (!novaCidade.trim()) {
      toast.error('Informe o nome da cidade/projeto.');
      return;
    }
    setSalvandoId('nova-cidade');
    try {
      const { error } = await (supabase.rpc as any)('criar_cidade_planejamento_v1', {
        p_nome: novaCidade.trim(),
      });
      if (error) throw error;
      setNovaCidade('');
      toast.success('Cidade cadastrada no Planejamento e vinculada ao Grupo de Projeto oficial.');
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível cadastrar a cidade.');
    } finally {
      setSalvandoId(null);
    }
  };

  const cadastrarPeca = async () => {
    const quantidade = Number(novaPecaQuantidade.replace(',', '.'));
    if (!novaPecaNome.trim()) {
      toast.error('Informe o nome da peça.');
      return;
    }
    if (!Number.isFinite(quantidade) || quantidade < 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }

    setSalvandoId('nova-peca');
    try {
      const { error } = await (supabase.rpc as any)('criar_peca_planejamento_v1', {
        p_nome: novaPecaNome.trim(),
        p_planejamento_projeto_id: novaPecaProjetoId || null,
        p_quantidade: quantidade,
        p_codigo: novaPecaCodigo.trim() || null,
      });
      if (error) throw error;

      setNovaPecaNome('');
      setNovaPecaCodigo('');
      setNovaPecaProjetoId('');
      setNovaPecaQuantidade('0');
      toast.success('Peça cadastrada. Se a cidade estiver ativa, ela já foi encaminhada para Projetos.');
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível cadastrar a peça.');
    } finally {
      setSalvandoId(null);
    }
  };

  const enviarNecessidadeFabricacao = async (itemId: string) => {
    setSalvandoId(`necessidade-${itemId}`);
    try {
      const { error } = await (supabase.rpc as any)('enviar_necessidade_fabricacao_v1', {
        p_planejamento_item_id: itemId,
        p_quantidade: null,
        p_observacoes: null,
      });
      if (error) throw error;
      toast.success('Déficit enviado à Produção como necessidade A programar.');
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a necessidade.');
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
            Selecione as cidades que entram no cálculo. Ao ativar uma cidade, suas peças são garantidas na estrutura oficial de Projetos, sem criar Etapas ou OPs automaticamente.
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
            <p className="text-xs text-muted-foreground">
              Marcar inclui a cidade e provisiona suas peças na estrutura oficial. Desmarcar não exclui nada já produzido.
            </p>
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
                  {projeto.ativoCalculo ? 'Incluído no cálculo e vinculado a Projetos' : 'Fora do cálculo'}
                </p>
              </div>
            </label>
          ))}
        </div>

        {podeConfigurar && (
          <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row">
            <Input
              value={novaCidade}
              onChange={(e) => setNovaCidade(e.target.value)}
              placeholder="Nova cidade/projeto"
              className="max-w-md"
            />
            <Button onClick={() => void cadastrarCidade()} disabled={salvandoId === 'nova-cidade'}>
              <Plus className="mr-2 h-4 w-4" />Cadastrar cidade
            </Button>
          </div>
        )}
      </Card>

      {podeConfigurar && (
        <Card className="p-4">
          <div className="mb-3">
            <p className="font-medium">Cadastrar nova peça</p>
            <p className="text-xs text-muted-foreground">
              O código segue o padrão CÓDIGO - Nome usado nos Locais de Utilização. Se o código não for informado, o sistema gera um código alfanumérico interno.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5 xl:col-span-2">
              <Label>Nome da peça</Label>
              <Input value={novaPecaNome} onChange={(e) => setNovaPecaNome(e.target.value)} placeholder="Ex.: Estrela 3D 5 Pontas 1m" />
            </div>
            <div className="space-y-1.5">
              <Label>Código (opcional)</Label>
              <Input value={novaPecaCodigo} onChange={(e) => setNovaPecaCodigo(e.target.value.toUpperCase())} placeholder="Ex.: E3D" />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade/projeto</Label>
              <SearchableSelect
                value={novaPecaProjetoId}
                onValueChange={setNovaPecaProjetoId}
                placeholder="Sem cidade"
                searchPlaceholder="Buscar cidade/projeto..."
                options={dados.projetos.map((projeto) => ({ value: projeto.id, label: projeto.nome }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input value={novaPecaQuantidade} onChange={(e) => setNovaPecaQuantidade(e.target.value)} inputMode="decimal" />
            </div>
          </div>
          <div className="mt-3">
            <Button onClick={() => void cadastrarPeca()} disabled={salvandoId === 'nova-peca'}>
              <Plus className="mr-2 h-4 w-4" />Cadastrar peça
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Projetos ativos</p><p className="text-2xl font-bold">{resumo.projetos}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Peças com demanda</p><p className="text-2xl font-bold">{resumo.necessidades}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Tipologias com déficit</p><p className="text-2xl font-bold">{resumo.deficit}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Unidades a produzir</p><p className="text-2xl font-bold">{resumo.unidadesFaltantes}</p></Card>
      </div>

      <Card className="p-4">
        <div className="space-y-2">
          <Label htmlFor="busca-peca-planejamento">Buscar peça / referência</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="busca-peca-planejamento"
              value={buscaPeca}
              onChange={(e) => setBuscaPeca(e.target.value)}
              placeholder="Digite o nome da peça, código TEC, referência ou categoria..."
              className="pl-9"
            />
          </div>
          {buscaPeca.trim() && (
            <p className="text-xs text-muted-foreground">
              {linhasFiltradas.length} referência(s) encontrada(s). O nome principal é o usado no Planejamento; abaixo dele aparece o vínculo com o acervo quando existir.
            </p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Peça</th>
                <th className="p-3 text-right">Necessário</th>
                <th className="p-3 text-right">Existente</th>
                <th className="p-3 text-right">Disponível</th>
                <th className="p-3 text-right">Produzir</th>
                <th className="p-3">Situação</th>
                <th className="p-3">Produção</th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map((linha) => {
                const situacao = statusPlanejamento(linha.deficit, linha.necessidade);
                const necessidadeAberta = necessidadeAbertaPorItem.get(linha.id);
                return (
                  <tr key={linha.id} className="border-t">
                    <td className="p-3">
                      <p className="font-medium">{linha.nome}</p>
                      {(linha.acervoCodigo || linha.acervoNome) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Referência: {linha.acervoCodigo ?? '—'}{linha.acervoNome ? ` · ${linha.acervoNome}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right">{linha.necessidade}</td>
                    <td className="p-3 text-right">{linha.estoque}</td>
                    <td className="p-3 text-right font-medium">{linha.disponivel}</td>
                    <td className={`p-3 text-right font-bold ${linha.deficit > 0 ? 'text-destructive' : ''}`}>{linha.deficit}</td>
                    <td className="p-3"><Badge variant={situacao.variant}>{situacao.label}</Badge></td>
                    <td className="p-3">
                      {necessidadeAberta ? (
                        <Badge variant="secondary">{numero(necessidadeAberta.quantidade)} un. aguardando programação</Badge>
                      ) : linha.deficit > 0 && podeConfigurar ? (
                        <Button
                          size="sm"
                          onClick={() => void enviarNecessidadeFabricacao(linha.id)}
                          disabled={salvandoId === `necessidade-${linha.id}`}
                        >
                          Enviar para Produção
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-dashed p-4 text-sm text-muted-foreground">
        <div className="flex gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Planejamento, Projetos, Gerencial e Produção usam agora a mesma estrutura oficial de Grupo do Projeto e Local de Utilização. Ativar cidade ou cadastrar peça é aditivo; nenhum histórico, Etapa, OP ou apontamento existente é apagado.
          </p>
        </div>
      </Card>
    </div>
  );
};
