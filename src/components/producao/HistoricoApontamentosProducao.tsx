import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Edit, Filter, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { LocalUtilizacaoConfig, SolicitanteConfig } from '@/hooks/useConfiguracoes';
import type {
  NovoApontamentoProducao,
  ProducaoApontamento,
  ProducaoApontamentoMembro,
  ProducaoLocalTipo,
  ProducaoStatus,
  ProducaoTarefa,
} from '@/types/producao';
import { FormApontamentoProducao } from './FormApontamentoProducao';

interface HistoricoApontamentosProducaoProps {
  apontamentos: ProducaoApontamento[];
  tarefas: ProducaoTarefa[];
  locais: LocalUtilizacaoConfig[];
  solicitantes: SolicitanteConfig[];
  loading: boolean;
  podeApontar: boolean;
  podeConferir: boolean;
  listarMembros: (apontamentoId: string) => Promise<ProducaoApontamentoMembro[]>;
  editarApontamento: (
    id: string,
    dados: Partial<Omit<NovoApontamentoProducao, 'membros_ids'>>,
    membrosIds?: string[],
  ) => Promise<ProducaoApontamento>;
  criarApontamento: (dados: NovoApontamentoProducao) => Promise<ProducaoApontamento>;
  cancelarApontamento: (id: string) => Promise<ProducaoApontamento>;
  conferirApontamento: (id: string) => Promise<ProducaoApontamento>;
  recarregar: () => Promise<unknown>;
}

const TODOS = '__todos__';

const statusConfig: Record<
  ProducaoStatus,
  { label: string; className: string }
> = {
  lancado: {
    label: 'Lançado',
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  },
  conferido: {
    label: 'Conferido',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'border-red-500/30 bg-red-500/10 text-red-400',
  },
};

export const HistoricoApontamentosProducao = ({
  apontamentos,
  tarefas,
  locais,
  solicitantes,
  loading,
  podeApontar,
  podeConferir,
  listarMembros,
  editarApontamento,
  criarApontamento,
  cancelarApontamento,
  conferirApontamento,
  recarregar,
}: HistoricoApontamentosProducaoProps) => {
  const [membrosPorApontamento, setMembrosPorApontamento] = useState<
    Record<string, ProducaoApontamentoMembro[]>
  >({});
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [projetoId, setProjetoId] = useState(TODOS);
  const [tarefaId, setTarefaId] = useState(TODOS);
  const [membroId, setMembroId] = useState(TODOS);
  const [status, setStatus] = useState<ProducaoStatus | typeof TODOS>(TODOS);
  const [localTipo, setLocalTipo] = useState<ProducaoLocalTipo | typeof TODOS>(TODOS);
  const [editando, setEditando] = useState<ProducaoApontamento | null>(null);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    const carregarMembros = async () => {
      const pares = await Promise.all(
        apontamentos.map(async (apontamento) => {
          try {
            return [apontamento.id, await listarMembros(apontamento.id)] as const;
          } catch {
            return [apontamento.id, []] as const;
          }
        }),
      );

      if (ativo) setMembrosPorApontamento(Object.fromEntries(pares));
    };

    void carregarMembros();
    return () => {
      ativo = false;
    };
  }, [apontamentos, listarMembros]);

  const tarefasPorId = useMemo(
    () => Object.fromEntries(tarefas.map((tarefa) => [tarefa.id, tarefa.nome])),
    [tarefas],
  );
  const locaisPorId = useMemo(
    () => Object.fromEntries(locais.map((local) => [local.id, local.nome])),
    [locais],
  );

  const filtrados = useMemo(
    () =>
      apontamentos.filter((apontamento) => {
        const membros = membrosPorApontamento[apontamento.id] ?? [];
        return (
          (!dataInicio || apontamento.data >= dataInicio) &&
          (!dataFim || apontamento.data <= dataFim) &&
          (projetoId === TODOS || apontamento.projeto_local_id === projetoId) &&
          (tarefaId === TODOS || apontamento.tarefa_id === tarefaId) &&
          (membroId === TODOS ||
            membros.some((membro) => membro.solicitante_id === membroId)) &&
          (status === TODOS || apontamento.status === status) &&
          (localTipo === TODOS || apontamento.local_tipo === localTipo)
        );
      }),
    [
      apontamentos,
      dataFim,
      dataInicio,
      localTipo,
      membroId,
      membrosPorApontamento,
      projetoId,
      status,
      tarefaId,
    ],
  );

  const executarAcao = async (
    apontamentoId: string,
    acao: 'cancelar' | 'conferir',
  ) => {
    setAcaoEmAndamento(`${acao}-${apontamentoId}`);
    try {
      if (acao === 'cancelar') {
        await cancelarApontamento(apontamentoId);
        toast.success('Apontamento cancelado.');
      } else {
        await conferirApontamento(apontamentoId);
        toast.success('Apontamento conferido.');
      }
      await recarregar();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível concluir a ação.',
      );
    } finally {
      setAcaoEmAndamento(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Apontamentos</CardTitle>
        <CardDescription>
          Consulte, confira e acompanhe os registros produtivos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Filtros
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Data inicial</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data final</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Projeto/local</Label>
              <Select value={projetoId} onValueChange={setProjetoId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {locais.map((local) => (
                    <SelectItem key={local.id} value={local.id}>{local.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tarefa</Label>
              <Select value={tarefaId} onValueChange={setTarefaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {tarefas.map((tarefa) => (
                    <SelectItem key={tarefa.id} value={tarefa.id}>{tarefa.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Membro</Label>
              <Select value={membroId} onValueChange={setMembroId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {solicitantes.map((membro) => (
                    <SelectItem key={membro.id} value={membro.id}>{membro.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(valor) => setStatus(valor as ProducaoStatus | typeof TODOS)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  <SelectItem value="lancado">Lançado</SelectItem>
                  <SelectItem value="conferido">Conferido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Local de execução</Label>
              <Select value={localTipo} onValueChange={(valor) => setLocalTipo(valor as ProducaoLocalTipo | typeof TODOS)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  <SelectItem value="Fábrica">Fábrica</SelectItem>
                  <SelectItem value="Execução">Execução</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Tarefa</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-28 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-28 text-center text-muted-foreground">
                    Nenhum apontamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((apontamento) => {
                  const membros = membrosPorApontamento[apontamento.id] ?? [];
                  const podeEditar = podeApontar && apontamento.status === 'lancado';
                  const processando =
                    acaoEmAndamento?.endsWith(apontamento.id) ?? false;

                  return (
                    <TableRow key={apontamento.id}>
                      <TableCell>{new Date(`${apontamento.data}T12:00:00`).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{locaisPorId[apontamento.projeto_local_id] ?? '—'}</TableCell>
                      <TableCell>{apontamento.local_tipo}</TableCell>
                      <TableCell>{tarefasPorId[apontamento.tarefa_id] ?? '—'}</TableCell>
                      <TableCell>{apontamento.inicio.slice(0, 5)}–{apontamento.termino.slice(0, 5)}</TableCell>
                      <TableCell>{apontamento.duracao_minutos} min</TableCell>
                      <TableCell>{apontamento.quantidade_produzida ?? '—'}</TableCell>
                      <TableCell className="min-w-48">
                        {membros.map((membro) => membro.nome_snapshot).join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusConfig[apontamento.status].className}>
                          {statusConfig[apontamento.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {podeEditar && (
                            <Button variant="ghost" size="icon" onClick={() => setEditando(apontamento)} title="Editar">
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {podeEditar && (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={processando}
                              onClick={() => void executarAcao(apontamento.id, 'cancelar')}
                              title="Cancelar"
                            >
                              <XCircle className="h-4 w-4 text-red-400" />
                            </Button>
                          )}
                          {podeConferir && apontamento.status === 'lancado' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={processando}
                              onClick={() => void executarAcao(apontamento.id, 'conferir')}
                              title="Conferir"
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={Boolean(editando)} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar apontamento</DialogTitle>
            <DialogDescription>
              Apenas registros com status lançado podem ser alterados.
            </DialogDescription>
          </DialogHeader>
          {editando && (
            <FormApontamentoProducao
              compacto
              tarefas={tarefas}
              locais={locais}
              solicitantes={solicitantes}
              podeApontar={podeApontar}
              criarApontamento={criarApontamento}
              editarApontamento={editarApontamento}
              apontamentoInicial={editando}
              membrosIniciais={(membrosPorApontamento[editando.id] ?? []).map(
                (membro) => membro.solicitante_id,
              )}
              onSuccess={async () => {
                setEditando(null);
                await recarregar();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
