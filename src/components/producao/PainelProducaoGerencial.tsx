import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Factory,
  Filter,
  Loader2,
  PackageCheck,
  RefreshCcw,
  RotateCcw,
  Users,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LocalUtilizacaoConfig } from '@/hooks/useConfiguracoes';
import { useProducao } from '@/hooks/useProducao';
import { useProducaoGerencial } from '@/hooks/useProducaoGerencial';
import type {
  FiltrosProducaoGerencial,
  ProducaoLocalTipo,
  ProducaoStatus,
} from '@/types/producao';

interface PainelProducaoGerencialProps {
  locais: LocalUtilizacaoConfig[];
}

const TODOS = '__todos__';

const numero = (valor: number) =>
  valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const horas = (valor: number) => `${numero(valor)} h`;

const statusLabel: Record<ProducaoStatus, string> = {
  lancado: 'Lançado',
  conferido: 'Conferido',
  cancelado: 'Cancelado',
};

const statusClasse: Record<ProducaoStatus, string> = {
  lancado: 'border-blue-500/30 bg-blue-500/10 text-blue-500',
  conferido: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  cancelado: 'border-red-500/30 bg-red-500/10 text-red-500',
};

export const PainelProducaoGerencial = ({
  locais,
}: PainelProducaoGerencialProps) => {
  const {
    loading,
    error,
    filtros,
    dadosConsolidados,
    carregarIndicadores,
  } = useProducaoGerencial();
  const {
    tarefas,
    membrosProducao,
    listarTarefas,
    listarMembrosProducao,
  } = useProducao();
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [projetoId, setProjetoId] = useState(TODOS);
  const [tarefaId, setTarefaId] = useState(TODOS);
  const [membroId, setMembroId] = useState(TODOS);
  const [status, setStatus] = useState<ProducaoStatus | typeof TODOS>(TODOS);
  const [localTipo, setLocalTipo] = useState<
    ProducaoLocalTipo | typeof TODOS
  >(TODOS);
  const [carregado, setCarregado] = useState(false);

  const carregar = useCallback(
    async (novosFiltros: FiltrosProducaoGerencial) => {
      try {
        await carregarIndicadores(novosFiltros);
      } catch {
        // O hook mantém a mensagem detalhada no estado error.
      } finally {
        setCarregado(true);
      }
    },
    [carregarIndicadores],
  );

  useEffect(() => {
    void Promise.allSettled([
      listarTarefas(),
      listarMembrosProducao(),
      carregar({}),
    ]);
  }, [carregar, listarMembrosProducao, listarTarefas]);

  const montarFiltros = (): FiltrosProducaoGerencial => ({
    data_inicio: dataInicio || undefined,
    data_fim: dataFim || undefined,
    projeto_local_id: projetoId === TODOS ? undefined : projetoId,
    tarefa_id: tarefaId === TODOS ? undefined : tarefaId,
    membro_id: membroId === TODOS ? undefined : membroId,
    status: status === TODOS ? undefined : status,
    local_tipo: localTipo === TODOS ? undefined : localTipo,
  });

  const aplicarFiltros = (event: FormEvent) => {
    event.preventDefault();
    void carregar(montarFiltros());
  };

  const limparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setProjetoId(TODOS);
    setTarefaId(TODOS);
    setMembroId(TODOS);
    setStatus(TODOS);
    setLocalTipo(TODOS);
    void carregar({});
  };

  const totalFiltrosAplicados = Object.values(filtros).filter(Boolean).length;
  const semDados =
    carregado &&
    !loading &&
    dadosConsolidados.total_apontamentos === 0 &&
    dadosConsolidados.materiais.total_movimentacoes_vinculadas === 0;

  const kpis = [
    {
      titulo: 'Total de apontamentos',
      valor: numero(dadosConsolidados.total_apontamentos),
      descricao: 'Todos os status no período',
      icon: Factory,
    },
    {
      titulo: 'Horas totais',
      valor: horas(dadosConsolidados.total_horas),
      descricao: `${numero(dadosConsolidados.total_minutos)} minutos produtivos`,
      icon: Clock3,
    },
    {
      titulo: 'Quantidade produzida',
      valor: numero(dadosConsolidados.quantidade_total_produzida),
      descricao: 'Soma dos apontamentos válidos',
      icon: PackageCheck,
    },
    {
      titulo: 'Pendentes de conferência',
      valor: numero(dadosConsolidados.apontamentos_pendentes_conferencia),
      descricao: 'Apontamentos lançados',
      icon: AlertCircle,
    },
    {
      titulo: 'Conferidos',
      valor: numero(dadosConsolidados.total_apontamentos_conferidos),
      descricao: 'Apontamentos validados',
      icon: CheckCircle2,
    },
    {
      titulo: 'Cancelados',
      valor: numero(dadosConsolidados.total_apontamentos_cancelados),
      descricao: 'Fora dos totais produtivos',
      icon: RotateCcw,
    },
  ];

  return (
    <section className="space-y-5 border-t pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Factory className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">BI de Produção</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Indicadores operacionais de horas, equipe, tarefas e materiais
            vinculados. Esta visão não movimenta estoque.
          </p>
        </div>
        {totalFiltrosAplicados > 0 && (
          <Badge variant="secondary">
            {totalFiltrosAplicados}{' '}
            {totalFiltrosAplicados === 1 ? 'filtro aplicado' : 'filtros aplicados'}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5 text-primary" />
            Filtros da Produção
          </CardTitle>
          <CardDescription>
            Estes filtros afetam somente os indicadores de Produção abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={aplicarFiltros} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="bi-producao-data-inicio">Data inicial</Label>
                <Input
                  id="bi-producao-data-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={(event) => setDataInicio(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bi-producao-data-fim">Data final</Label>
                <Input
                  id="bi-producao-data-fim"
                  type="date"
                  value={dataFim}
                  onChange={(event) => setDataFim(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Projeto/local</Label>
                <Select value={projetoId} onValueChange={setProjetoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os projetos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos os projetos</SelectItem>
                    {locais
                      .filter((local) => local.ativo)
                      .map((local) => (
                        <SelectItem key={local.id} value={local.id}>
                          {local.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tarefa</Label>
                <Select value={tarefaId} onValueChange={setTarefaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as tarefas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todas as tarefas</SelectItem>
                    {tarefas
                      .filter((tarefa) => tarefa.ativo)
                      .map((tarefa) => (
                        <SelectItem key={tarefa.id} value={tarefa.id}>
                          {tarefa.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Membro</Label>
                <Select value={membroId} onValueChange={setMembroId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os membros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos os membros</SelectItem>
                    {membrosProducao
                      .filter((membro) => membro.ativo)
                      .map((membro) => (
                        <SelectItem key={membro.id} value={membro.id}>
                          {membro.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(valor) =>
                    setStatus(valor as ProducaoStatus | typeof TODOS)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos os status</SelectItem>
                    <SelectItem value="lancado">Lançado</SelectItem>
                    <SelectItem value="conferido">Conferido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Local de execução</Label>
                <Select
                  value={localTipo}
                  onValueChange={(valor) =>
                    setLocalTipo(valor as ProducaoLocalTipo | typeof TODOS)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os locais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos</SelectItem>
                    <SelectItem value="Fábrica">Fábrica</SelectItem>
                    <SelectItem value="Execução">Execução</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Filter className="mr-2 h-4 w-4" />
                )}
                Aplicar filtros
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={limparFiltros}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Limpar filtros
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar o BI de Produção</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!carregado && loading ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando indicadores de Produção...
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {kpis.map((kpi) => {
              const Icone = kpi.icon;
              return (
                <Card key={kpi.titulo}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {kpi.titulo}
                    </CardTitle>
                    <Icone className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpi.valor}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {kpi.descricao}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {semDados && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Nenhum dado encontrado</AlertTitle>
              <AlertDescription>
                Não há apontamentos ou materiais vinculados para os filtros
                aplicados.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {dadosConsolidados.por_local_tipo.map((local) => (
              <Card key={local.local_tipo}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Factory className="h-5 w-5 text-primary" />
                    {local.local_tipo}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-bold">
                      {numero(local.total_apontamentos)}
                    </p>
                    <p className="text-xs text-muted-foreground">Apontamentos</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">
                      {horas(local.total_horas)}
                    </p>
                    <p className="text-xs text-muted-foreground">Horas</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">
                      {numero(local.quantidade_total_produzida)}
                    </p>
                    <p className="text-xs text-muted-foreground">Produzido</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Produção por projeto/local</CardTitle>
              <CardDescription>
                Horas, equipe e quantidade consolidada por projeto.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projeto/local</TableHead>
                    <TableHead className="text-right">Apontamentos</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Membros</TableHead>
                    <TableHead>Status predominante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dadosConsolidados.por_projeto.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Nenhum projeto encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dadosConsolidados.por_projeto.map((projeto) => (
                      <TableRow key={projeto.projeto_local_id}>
                        <TableCell className="font-medium">
                          {projeto.projeto_nome}
                        </TableCell>
                        <TableCell className="text-right">
                          {numero(projeto.total_apontamentos)}
                        </TableCell>
                        <TableCell className="text-right">
                          {horas(projeto.total_horas)}
                        </TableCell>
                        <TableCell className="text-right">
                          {numero(projeto.quantidade_total_produzida)}
                        </TableCell>
                        <TableCell className="text-right">
                          {numero(projeto.total_membros_distintos)}
                        </TableCell>
                        <TableCell>
                          {projeto.status_predominante ? (
                            <Badge
                              variant="outline"
                              className={
                                statusClasse[projeto.status_predominante]
                              }
                            >
                              {statusLabel[projeto.status_predominante]}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Produção por tarefa</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarefa</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Apontamentos</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dadosConsolidados.por_tarefa.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground"
                        >
                          Nenhuma tarefa encontrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dadosConsolidados.por_tarefa.map((tarefa) => (
                        <TableRow key={tarefa.tarefa_id}>
                          <TableCell className="font-medium">
                            {tarefa.tarefa_nome}
                          </TableCell>
                          <TableCell>{tarefa.categoria ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            {numero(tarefa.total_apontamentos)}
                          </TableCell>
                          <TableCell className="text-right">
                            {horas(tarefa.total_horas)}
                          </TableCell>
                          <TableCell className="text-right">
                            {numero(tarefa.quantidade_total_produzida)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Produção por membro
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Membro</TableHead>
                      <TableHead className="text-right">Apontamentos</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right">Projetos</TableHead>
                      <TableHead className="text-right">Tarefas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dadosConsolidados.por_membro.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground"
                        >
                          Nenhum membro encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dadosConsolidados.por_membro.map((membro) => (
                        <TableRow key={membro.membro_id}>
                          <TableCell className="font-medium">
                            {membro.membro_nome}
                          </TableCell>
                          <TableCell className="text-right">
                            {numero(membro.total_apontamentos)}
                          </TableCell>
                          <TableCell className="text-right">
                            {horas(membro.total_horas)}
                          </TableCell>
                          <TableCell className="text-right">
                            {numero(membro.projetos_distintos)}
                          </TableCell>
                          <TableCell className="text-right">
                            {numero(membro.tarefas_distintas)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Materiais vinculados à Produção</CardTitle>
              <CardDescription>
                Materiais exibidos aqui são referências vinculadas a
                movimentações oficiais já existentes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">
                    Movimentações vinculadas
                  </p>
                  <p className="text-2xl font-bold">
                    {numero(
                      dadosConsolidados.materiais
                        .total_movimentacoes_vinculadas,
                    )}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Total saída</p>
                  <p className="text-2xl font-bold">
                    {numero(dadosConsolidados.materiais.total_saida)}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Total entrada</p>
                  <p className="text-2xl font-bold">
                    {numero(dadosConsolidados.materiais.total_entrada)}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">
                    Itens distintos
                  </p>
                  <p className="text-2xl font-bold">
                    {numero(dadosConsolidados.materiais.itens_distintos)}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Movimentos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dadosConsolidados.materiais.quantidade_por_item.length ===
                      0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="py-8 text-center text-muted-foreground"
                          >
                            Nenhum item vinculado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dadosConsolidados.materiais.quantidade_por_item.map(
                          (item) => (
                            <TableRow key={item.item_id}>
                              <TableCell className="font-medium">
                                {item.item_nome}
                              </TableCell>
                              <TableCell className="text-right">
                                {numero(item.quantidade)}
                              </TableCell>
                              <TableCell className="text-right">
                                {numero(item.total_movimentacoes)}
                              </TableCell>
                            </TableRow>
                          ),
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo de movimento</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Movimentos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dadosConsolidados.materiais
                        .quantidade_por_tipo_movimento.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="py-8 text-center text-muted-foreground"
                          >
                            Nenhum tipo de movimento vinculado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dadosConsolidados.materiais.quantidade_por_tipo_movimento.map(
                          (tipo) => (
                            <TableRow key={tipo.tipo}>
                              <TableCell className="font-medium">
                                {tipo.tipo}
                              </TableCell>
                              <TableCell className="text-right">
                                {numero(tipo.quantidade)}
                              </TableCell>
                              <TableCell className="text-right">
                                {numero(tipo.total_movimentacoes)}
                              </TableCell>
                            </TableRow>
                          ),
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
};
