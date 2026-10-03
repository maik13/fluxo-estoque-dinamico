import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Plus, RefreshCw, Search, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { PlanejamentoComposicaoDialog, type EstrategiaAtendimento } from './PlanejamentoComposicaoDialog';

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
  estrategiaAtendimento: EstrategiaAtendimento;
  componentesConfigurados: number;
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

const numero = (valor: unknown) => Number(valor || 0);

const formatarDataHora = (valor: string | null | undefined) => {
  if (!valor) return 'Ainda não sincronizado';
  return new Date(valor).toLocaleString('pt-BR');
};

export const PlanejamentoProducao = () => {
  const { canConfigurarProducao } = usePermissions();
  const podeConfigurar = canConfigurarProducao();

  const [dados, setDados] = useState<PlanejamentoPayload>({ projetos: [], itens: [], fonte: null });
  const [loading, setLoading] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [buscaPeca, setBuscaPeca] = useState('');
  const [cidadeSelecionadaId, setCidadeSelecionadaId] = useState('');
  const [itemConfiguracao, setItemConfiguracao] = useState<ItemPlanejamento | null>(null);

  const [novaCidade, setNovaCidade] = useState('');
  const [novaPecaNome, setNovaPecaNome] = useState('');
  const [novaPecaCodigo, setNovaPecaCodigo] = useState('');
  const [novaPecaQuantidade, setNovaPecaQuantidade] = useState('0');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const planejamentoResult = await (supabase.rpc as any)('listar_planejamento_producao_v2');
      if (planejamentoResult.error) throw planejamentoResult.error;
      const payload = (planejamentoResult.data ?? { projetos: [], itens: [], fonte: null }) as PlanejamentoPayload;
      setDados(payload);
      setCidadeSelecionadaId((atual) => {
        if (atual && payload.projetos.some((projeto) => projeto.id === atual)) return atual;
        return payload.projetos.find((projeto) => projeto.ativoCalculo)?.id ?? '';
      });
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
      const projetoSelecionado = dados.projetos.find((projeto) => projeto.id === cidadeSelecionadaId);
      const necessidade = projetoSelecionado
        ? numero(item.demandas?.[projetoSelecionado.chave])
        : projetosAtivos.reduce(
            (soma, projeto) => soma + numero(item.demandas?.[projeto.chave]),
            0,
          );
      const estoque = numero(item.qtdEstoqueAtual);
      const reservado = numero(item.qtdReservada);
      const disponivel = numero(item.qtdDisponivelAtual);
      const deficit = Math.max(0, necessidade - disponivel);
      return { ...item, necessidade, estoque, reservado, disponivel, deficit };
    }),
    [dados.itens, projetosAtivos, dados.projetos, cidadeSelecionadaId],
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

  const resumo = useMemo(() => ({
    pecas: linhas.filter((linha) => linha.necessidade > 0).length,
    unidades: linhas.reduce((soma, linha) => soma + linha.necessidade, 0),
    produzir: linhas.reduce((soma, linha) => soma + linha.deficit, 0),
  }), [linhas]);

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

  const salvarQuantidadeCidade = async (item: ItemPlanejamento, valor: string) => {
    const projeto = dados.projetos.find((cidade) => cidade.id === cidadeSelecionadaId);
    if (!projeto || !podeConfigurar) return;
    const quantidade = Number(valor.replace(',', '.'));
    if (!Number.isFinite(quantidade) || quantidade < 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }
    if (quantidade === numero(item.demandas?.[projeto.chave])) return;

    setSalvandoId(`demanda-${item.id}`);
    try {
      const { error } = await (supabase.rpc as any)('salvar_demanda_planejamento_cidade_v1', {
        p_planejamento_projeto_id: projeto.id,
        p_planejamento_item_id: item.id,
        p_quantidade: quantidade,
      });
      if (error) throw error;
      toast.success(quantidade > 0
        ? `${item.nome}: ${quantidade} un. em ${projeto.nome}. Projeto sincronizado automaticamente.`
        : `${item.nome} retirada do planejamento de ${projeto.nome}.`);
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a peça na cidade.');
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
    if (!cidadeSelecionadaId) {
      toast.error('Selecione uma cidade primeiro.');
      return;
    }
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
        p_planejamento_projeto_id: cidadeSelecionadaId,
        p_quantidade: quantidade,
        p_codigo: novaPecaCodigo.trim() || null,
      });
      if (error) throw error;

      setNovaPecaNome('');
      setNovaPecaCodigo('');
      setNovaPecaQuantidade('0');
      toast.success('Peça cadastrada. Se a cidade estiver ativa, ela já foi encaminhada para Projetos.');
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível cadastrar a peça.');
    } finally {
      setSalvandoId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <h3 className="text-lg font-semibold">Planejamento de Acervo e Peças</h3>
          <p className="text-sm text-muted-foreground">
            Selecione a cidade que deseja parametrizar. As peças com quantidade maior que zero entram automaticamente em Projetos.
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
        <div className="space-y-2">
          <Label>Cidade / projeto em edição</Label>
          <SearchableSelect
            value={cidadeSelecionadaId}
            onValueChange={(value) => {
              setCidadeSelecionadaId(value);
              const projeto = dados.projetos.find((item) => item.id === value);
              if (projeto && !projeto.ativoCalculo) void alternarProjeto(projeto, true);
            }}
            placeholder="Selecione a cidade..."
            searchPlaceholder="Buscar cidade..."
            options={dados.projetos.map((projeto) => ({ value: projeto.id, label: projeto.nome }))}
          />
          <p className="text-xs text-muted-foreground">
            Ao selecionar uma cidade, ela entra no planejamento e é integrada a Projetos automaticamente.
          </p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3">
          <p className="font-medium">Cidades do planejamento</p>
          <p className="text-xs text-muted-foreground">
            Marque as cidades que fazem parte do planejamento. Uma mesma peça pode estar direcionada para várias cidades.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {dados.projetos.map((projeto) => (
            <label key={projeto.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={projeto.ativoCalculo}
                disabled={!podeConfigurar || salvandoId === projeto.id}
                onCheckedChange={(checked) => void alternarProjeto(projeto, checked === true)}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{projeto.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {projeto.ativoCalculo ? 'Selecionada' : 'Não selecionada'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {podeConfigurar && (
        <div className="flex flex-col gap-2 sm:flex-row">
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

      {podeConfigurar && cidadeSelecionadaId && (
        <Card className="p-4">
          <div className="mb-3">
            <p className="font-medium">Adicionar peça à cidade selecionada</p>
            <p className="text-xs text-muted-foreground">
              O código segue o padrão CÓDIGO - Nome usado nos Locais de Utilização. Se o código não for informado, o sistema gera um código alfanumérico interno.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 xl:col-span-2">
              <Label>Nome da peça</Label>
              <Input value={novaPecaNome} onChange={(e) => setNovaPecaNome(e.target.value)} placeholder="Ex.: Estrela 3D 5 Pontas 1m" />
            </div>
            <div className="space-y-1.5">
              <Label>Código (opcional)</Label>
              <Input value={novaPecaCodigo} onChange={(e) => setNovaPecaCodigo(e.target.value.toUpperCase())} placeholder="Ex.: E3D" />
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Peças da cidade</p><p className="text-2xl font-bold">{resumo.pecas}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Unidades planejadas</p><p className="text-2xl font-bold">{resumo.unidades}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Produzir / transformar</p><p className="text-2xl font-bold">{resumo.produzir}</p></Card>
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
          <table className="w-full min-w-[1250px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Peça</th>
                <th className="p-3">Cidades da peça</th>
                <th className="p-3 text-right">Qtd. cidade</th>
                <th className="p-3 text-right">Existente</th>
                <th className="p-3 text-right">Disponível</th>
                <th className="p-3 text-right">Produzir / transformar</th>
                <th className="p-3">Parametrização</th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map((linha) => {
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
                    <td className="p-3">
                      <div className="flex max-w-[320px] flex-wrap gap-1">
                        {dados.projetos
                          .filter((projeto) => numero(linha.demandas?.[projeto.chave]) > 0)
                          .map((projeto) => (
                            <span key={projeto.id} className="rounded-md border bg-muted/40 px-2 py-1 text-xs">
                              {projeto.nome}: {numero(linha.demandas?.[projeto.chave])}
                            </span>
                          ))}
                        {!dados.projetos.some((projeto) => numero(linha.demandas?.[projeto.chave]) > 0) && (
                          <span className="text-xs text-muted-foreground">Sem cidade</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Input
                        key={`${cidadeSelecionadaId}-${linha.id}-${linha.necessidade}`}
                        defaultValue={linha.necessidade}
                        inputMode="decimal"
                        disabled={!cidadeSelecionadaId || !podeConfigurar || salvandoId === `demanda-${linha.id}`}
                        onBlur={(event) => void salvarQuantidadeCidade(linha, event.target.value)}
                        className="ml-auto w-24 text-right"
                      />
                    </td>
                    <td className="p-3 text-right">{linha.estoque}</td>
                    <td className="p-3 text-right font-medium">{linha.disponivel}</td>
                    <td className={`p-3 text-right font-bold ${linha.deficit > 0 ? 'text-destructive' : ''}`}>{linha.deficit}</td>
                    <td className="p-3">
                      <Button variant="outline" size="sm" onClick={() => setItemConfiguracao(linha)}>
                        <Settings2 className="mr-2 h-4 w-4" />
                        Parametrizar{linha.componentesConfigurados > 0 ? ` (${linha.componentesConfigurados})` : ''}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <PlanejamentoComposicaoDialog
        item={itemConfiguracao}
        onClose={() => setItemConfiguracao(null)}
        onSaved={() => void carregar()}
      />

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
