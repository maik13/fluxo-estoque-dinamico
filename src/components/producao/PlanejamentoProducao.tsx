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
import { PlanejamentoMatriz } from './PlanejamentoMatriz';

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
  qtdDemandaConfirmada?: number;
  qtdDemandaPotencial?: number;
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

type TemporadaGrupo = {
  id: string;
  nome: string;
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
  const [visaoPlanejamento, setVisaoPlanejamento] = useState<'matriz' | 'detalhado'>('detalhado');

  const [novaCidade, setNovaCidade] = useState('');
  const [novaCidadeGrupoId, setNovaCidadeGrupoId] = useState('');
  const [temporadasGrupos, setTemporadasGrupos] = useState<TemporadaGrupo[]>([]);
  const [novaPecaNome, setNovaPecaNome] = useState('');
  const [novaPecaCodigo, setNovaPecaCodigo] = useState('');
  const [novaPecaQuantidade, setNovaPecaQuantidade] = useState('0');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [planejamentoResult, gruposResult] = await Promise.all([
        (supabase.rpc as any)('listar_planejamento_producao_v2'),
        supabase.from('project_groups').select('id,nome').eq('ativo', true).order('nome'),
      ]);
      if (planejamentoResult.error) throw planejamentoResult.error;
      if (gruposResult.error) throw gruposResult.error;
      const payload = (planejamentoResult.data ?? { projetos: [], itens: [], fonte: null }) as PlanejamentoPayload;
      setDados(payload);
      setTemporadasGrupos((gruposResult.data ?? []) as TemporadaGrupo[]);
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
      const quantidadeCidade = projetoSelecionado
        ? numero(item.demandas?.[projetoSelecionado.chave])
        : 0;

      const demandaConfirmada = item.qtdDemandaConfirmada != null
        ? numero(item.qtdDemandaConfirmada)
        : projetosAtivos.reduce(
            (soma, projeto) => soma + numero(item.demandas?.[projeto.chave]),
            0,
          );

      const demandaPotencial = item.qtdDemandaPotencial != null
        ? numero(item.qtdDemandaPotencial)
        : dados.projetos.reduce(
            (soma, projeto) => soma + numero(item.demandas?.[projeto.chave]),
            0,
          );

      const estoque = numero(item.qtdEstoqueAtual);
      const reservado = numero(item.qtdReservada);
      const disponivel = numero(item.qtdDisponivelAtual);
      const faltaFisica = Math.max(0, demandaConfirmada - estoque);

      let acaoLabel = 'Atender';
      let acaoQuantidade = demandaConfirmada;

      if (item.estrategiaAtendimento === 'acervo') {
        acaoLabel = 'Remanejar';
      } else if (item.estrategiaAtendimento === 'composicao') {
        acaoLabel = 'Compor';
      } else if (item.estrategiaAtendimento === 'transformacao') {
        acaoLabel = 'Transformar';
      } else if (item.estrategiaAtendimento === 'producao_nova') {
        acaoLabel = 'Produzir';
        acaoQuantidade = Math.max(0, demandaConfirmada - estoque);
      }

      return {
        ...item,
        necessidade: quantidadeCidade,
        quantidadeCidade,
        demandaConfirmada,
        demandaPotencial,
        estoque,
        reservado,
        disponivel,
        faltaFisica,
        acaoLabel,
        acaoQuantidade,
      };
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
    pecas: linhas.filter((linha) => linha.quantidadeCidade > 0).length,
    unidades: linhas.reduce((soma, linha) => soma + linha.quantidadeCidade, 0),
    acao: linhas.reduce((soma, linha) => soma + linha.acaoQuantidade, 0),
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

  const salvarQuantidadeProjeto = async (
    item: ItemPlanejamento,
    projetoId: string,
    valor: string,
    origem: 'matriz' | 'detalhe' = 'detalhe',
  ) => {
    const projeto = dados.projetos.find((cidade) => cidade.id === projetoId);
    if (!projeto || !podeConfigurar) return;
    const quantidade = Number(valor.replace(',', '.'));
    if (!Number.isFinite(quantidade) || quantidade < 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }
    if (quantidade === numero(item.demandas?.[projeto.chave])) return;

    const saveKey = origem === 'matriz'
      ? `matriz-${item.id}-${projeto.id}`
      : `demanda-${item.id}`;

    setSalvandoId(saveKey);
    try {
      const { error } = await (supabase.rpc as any)('salvar_demanda_planejamento_cidade_v1', {
        p_planejamento_projeto_id: projeto.id,
        p_planejamento_item_id: item.id,
        p_quantidade: quantidade,
      });
      if (error) throw error;
      toast.success(
        projeto.ativoCalculo
          ? `${item.nome}: ${quantidade} un. confirmada(s) em ${projeto.nome}.`
          : quantidade > 0
            ? `${item.nome}: ${quantidade} un. registrada(s) como cenário potencial em ${projeto.nome}.`
            : `${item.nome} retirada de ${projeto.nome}.`,
      );
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
    if (!novaCidadeGrupoId) {
      toast.error('Selecione a Temporada / Grupo da nova cidade.');
      return;
    }
    setSalvandoId('nova-cidade');
    try {
      const { error } = await (supabase.rpc as any)('criar_cidade_planejamento_v1', {
        p_nome: novaCidade.trim(),
        p_project_group_id: novaCidadeGrupoId,
      });
      if (error) throw error;
      setNovaCidade('');
      toast.success('Cidade cadastrada no Planejamento e vinculada à Temporada / Grupo selecionada.');
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
                  {projeto.ativoCalculo
                    ? 'Confirmada'
                    : dados.itens.some((item) => numero(item.demandas?.[projeto.chave]) > 0)
                      ? 'Potencial'
                      : 'Fora'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {podeConfigurar && (
        <Card className="p-4">
          <div className="mb-3">
            <p className="font-medium">Cadastrar nova cidade / projeto</p>
            <p className="text-xs text-muted-foreground">
              A cidade não cria mais um Grupo automaticamente. Selecione explicitamente a Temporada / Grupo à qual ela pertence.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_320px_auto] md:items-end">
            <div className="space-y-1.5">
              <Label>Nova cidade / projeto</Label>
              <Input
                value={novaCidade}
                onChange={(e) => setNovaCidade(e.target.value)}
                placeholder="Ex.: Londrina"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Temporada / Grupo</Label>
              <SearchableSelect
                value={novaCidadeGrupoId}
                onValueChange={setNovaCidadeGrupoId}
                placeholder="Selecione a temporada..."
                searchPlaceholder="Buscar temporada..."
                options={temporadasGrupos.map((grupo) => ({ value: grupo.id, label: grupo.nome }))}
              />
            </div>
            <Button onClick={() => void cadastrarCidade()} disabled={salvandoId === 'nova-cidade'}>
              <Plus className="mr-2 h-4 w-4" />Cadastrar cidade
            </Button>
          </div>
        </Card>
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
        <Card className="p-4"><p className="text-xs text-muted-foreground">Ações confirmadas</p><p className="text-2xl font-bold">{resumo.acao}</p></Card>
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-lg border p-1">
          <Button
            type="button"
            size="sm"
            variant={visaoPlanejamento === 'detalhado' ? 'default' : 'ghost'}
            onClick={() => setVisaoPlanejamento('detalhado')}
          >
            Peças e parametrização
          </Button>
          <Button
            type="button"
            size="sm"
            variant={visaoPlanejamento === 'matriz' ? 'default' : 'ghost'}
            onClick={() => setVisaoPlanejamento('matriz')}
          >
            Matriz de cidades
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Use Peças e parametrização como visão principal. A Matriz serve apenas para editar rapidamente as quantidades por cidade.
        </p>
      </div>

      {visaoPlanejamento === 'matriz' && (
        <PlanejamentoMatriz
          projetos={dados.projetos}
          itens={linhasFiltradas}
          podeConfigurar={podeConfigurar}
          salvandoId={salvandoId}
          onAlternarProjeto={(projeto, ativo) => {
            const original = dados.projetos.find((item) => item.id === projeto.id);
            if (original) void alternarProjeto(original, ativo);
          }}
          onSalvarQuantidade={(item, projetoId, valor) => {
            const original = dados.itens.find((registro) => registro.id === item.id);
            if (original) void salvarQuantidadeProjeto(original, projetoId, valor, 'matriz');
          }}
        />
      )}

      {visaoPlanejamento === 'detalhado' && (
      <div className="space-y-3">
        <Card className="border-dashed p-3">
          <p className="text-sm font-medium">Parametrização individual da peça</p>
          <p className="text-xs text-muted-foreground">
            É aqui que você define, peça por peça, se ela usa acervo, produção nova, transformação ou composição e quais itens existentes participam dela.
          </p>
        </Card>
      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full min-w-[1250px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Peça</th>
                <th className="p-3">Cidades da peça</th>
                <th className="p-3 text-right">Total confirmado</th>
                <th className="p-3 text-right">Existente</th>
                <th className="p-3 text-right">Disponível</th>
                <th className="p-3">Ação operacional</th>
                <th className="p-3">Configuração da peça</th>
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
                            <span
                              key={projeto.id}
                              className={`rounded-md border px-2 py-1 text-xs ${projeto.ativoCalculo ? 'bg-background font-medium' : 'bg-muted/40 text-muted-foreground'}`}
                              title={projeto.ativoCalculo ? 'Cidade confirmada' : 'Cidade potencial'}
                            >
                              {projeto.nome}: {numero(linha.demandas?.[projeto.chave])}{projeto.ativoCalculo ? '' : ' · pot.'}
                            </span>
                          ))}
                        {!dados.projetos.some((projeto) => numero(linha.demandas?.[projeto.chave]) > 0) && (
                          <span className="text-xs text-muted-foreground">Sem cidade</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-semibold">{linha.demandaConfirmada}</div>
                      {linha.demandaPotencial > linha.demandaConfirmada && (
                        <div className="text-xs text-muted-foreground">
                          {linha.demandaPotencial} com potenciais
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">{linha.estoque}</td>
                    <td className="p-3 text-right font-medium">{linha.disponivel}</td>
                    <td className="p-3">
                      <div className="font-semibold">{linha.acaoLabel}: {linha.acaoQuantidade}</div>
                      {linha.faltaFisica > 0 && (
                        <div className="text-xs text-destructive">Faltam {linha.faltaFisica} no estoque-base</div>
                      )}
                    </td>
                    <td className="p-3">
                      <Button variant="outline" size="sm" onClick={() => setItemConfiguracao(linha)}>
                        <Settings2 className="mr-2 h-4 w-4" />
                        Parametrizar item{linha.componentesConfigurados > 0 ? ` (${linha.componentesConfigurados})` : ''}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      </div>
      )}

      <PlanejamentoComposicaoDialog
        item={itemConfiguracao}
        onClose={() => setItemConfiguracao(null)}
        onSaved={() => void carregar()}
      />

      <Card className="border-dashed p-4 text-sm text-muted-foreground">
        <div className="flex gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Planejamento, Projetos, Gerencial e Produção usam a mesma Temporada / Grupo e os mesmos Locais de Utilização. Cidades não criam mais grupos automaticamente; a Temporada / Grupo é escolhida pelo usuário. Nenhum histórico, Etapa, OP ou apontamento existente é apagado.
          </p>
        </div>
      </Card>
    </div>
  );
};
