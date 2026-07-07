import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit,
  ExternalLink,
  FileDown,
  Filter,
  ImageIcon,
  Loader2,
  Printer,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { LocalUtilizacaoConfig } from '@/hooks/useConfiguracoes';
import { useProducaoAnexos } from '@/hooks/useProducaoAnexos';
import type {
  NovoApontamentoProducao,
  ProducaoApontamento,
  ProducaoApontamentoAnexo,
  ProducaoApontamentoMembro,
  ProducaoLocalTipo,
  ProducaoMembro,
  ProducaoStatus,
  ProducaoTarefa,
} from '@/types/producao';
import {
  exportarApontamentosProducaoExcel,
  imprimirSecaoProducao,
} from '@/utils/producaoExport';
import { FormApontamentoProducao } from './FormApontamentoProducao';

interface HistoricoApontamentosProducaoProps {
  apontamentos: ProducaoApontamento[];
  tarefas: ProducaoTarefa[];
  locais: LocalUtilizacaoConfig[];
  membros: ProducaoMembro[];
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
    label: 'Pendente',
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  },
  conferido: {
    label: 'Registrado',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'border-red-500/30 bg-red-500/10 text-red-400',
  },
};

const formatarBytes = (bytes: number | null) => {
  if (!bytes) return 'Tamanho não informado';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const FotoHistorico = ({
  anexo,
  obterUrl,
  baixar,
  podeExcluir,
  excluir,
}: {
  anexo: ProducaoApontamentoAnexo;
  obterUrl: (path: string) => Promise<string>;
  baixar: (anexo: ProducaoApontamentoAnexo) => Promise<void>;
  podeExcluir: boolean;
  excluir: (id: string) => Promise<void>;
}) => {
  const [url, setUrl] = useState('');
  const [removendo, setRemovendo] = useState(false);

  useEffect(() => {
    let ativo = true;
    void obterUrl(anexo.file_path)
      .then((signedUrl) => {
        if (ativo) setUrl(signedUrl);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [anexo.file_path, obterUrl]);

  return (
    <div className="rounded-lg border bg-muted/10 p-3">
      <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-md border bg-background">
        {url ? (
          <img src={url} alt={anexo.file_name} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <p className="truncate text-sm font-medium">{anexo.file_name}</p>
      <p className="text-xs text-muted-foreground">{formatarBytes(anexo.size_bytes)}</p>
      <p className="text-xs text-muted-foreground">
        Enviada em {new Date(anexo.created_at).toLocaleString('pt-BR')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!url} onClick={() => window.open(url, '_blank')}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Abrir imagem
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void baixar(anexo)}>
          <Download className="mr-2 h-4 w-4" />
          Baixar
        </Button>
        {podeExcluir && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={removendo}
            onClick={async () => {
              setRemovendo(true);
              try {
                await excluir(anexo.id);
              } finally {
                setRemovendo(false);
              }
            }}
          >
            {removendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Excluir
          </Button>
        )}
      </div>
    </div>
  );
};

export const HistoricoApontamentosProducao = ({
  apontamentos,
  tarefas,
  locais,
  membros,
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
  const [galeria, setGaleria] = useState<ProducaoApontamento | null>(null);
  const [detalhes, setDetalhes] = useState<ProducaoApontamento | null>(null);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null);
  const [anexosPorApontamento, setAnexosPorApontamento] = useState<
    Record<string, ProducaoApontamentoAnexo[]>
  >({});
  const {
    listarAnexosPorApontamentos,
    obterUrlAnexo,
    baixarAnexo,
    removerAnexo,
  } = useProducaoAnexos();

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

  useEffect(() => {
    let ativo = true;
    const ids = apontamentos.map((apontamento) => apontamento.id);
    void listarAnexosPorApontamentos(ids)
      .then((anexos) => {
        if (!ativo) return;
        const agrupados = anexos.reduce<Record<string, ProducaoApontamentoAnexo[]>>(
          (acc, anexo) => {
            acc[anexo.apontamento_id] = acc[anexo.apontamento_id] ?? [];
            acc[anexo.apontamento_id].push(anexo);
            return acc;
          },
          {},
        );
        setAnexosPorApontamento(agrupados);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [apontamentos, listarAnexosPorApontamentos]);

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
            membros.some((membro) => membro.membro_id === membroId)) &&
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

  const filtrosDescricao = () => {
    const partes: string[] = [];
    if (dataInicio) partes.push(`Data inicial: ${dataInicio}`);
    if (dataFim) partes.push(`Data final: ${dataFim}`);
    if (projetoId !== TODOS) {
      partes.push(`Projeto/local: ${locaisPorId[projetoId] ?? projetoId}`);
    }
    if (tarefaId !== TODOS) {
      partes.push(`Tarefa: ${tarefasPorId[tarefaId] ?? tarefaId}`);
    }
    if (membroId !== TODOS) {
      partes.push(
        `Membro: ${
          membros.find((membro) => membro.id === membroId)?.nome ?? membroId
        }`,
      );
    }
    if (status !== TODOS) partes.push(`Status: ${statusConfig[status].label}`);
    if (localTipo !== TODOS) {
      partes.push(`Local de execução: ${localTipo}`);
    }
    return partes.length > 0 ? partes.join(' | ') : 'Sem filtros';
  };

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
        toast.success('Apontamento registrado.');
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
    <Card id="historico-producao-impressao">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Histórico de Apontamentos</CardTitle>
          <CardDescription>
            Consulte, confira e acompanhe os registros produtivos.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              exportarApontamentosProducaoExcel(
                filtrados,
                tarefas,
                locais,
                membrosPorApontamento,
                filtrosDescricao(),
                Object.fromEntries(
                  Object.entries(anexosPorApontamento).map(([id, anexos]) => [
                    id,
                    anexos.length,
                  ]),
                ),
              )
            }
          >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              imprimirSecaoProducao('historico-producao-impressao')
            }
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="producao-print-only text-sm">
          <p>Gerado em: {new Date().toLocaleString('pt-BR')}</p>
          <p>Filtros aplicados: {filtrosDescricao()}</p>
        </div>
        <div className="rounded-lg border bg-muted/10 p-4 print:hidden">
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
                  {membros.map((membro) => (
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
                  <SelectItem value="lancado">Pendente</SelectItem>
                  <SelectItem value="conferido">Registrado</SelectItem>
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
                <TableHead>Tarefa</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead>Fotos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right print:hidden">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-28 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                    Nenhum apontamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((apontamento) => {
                  const membros = membrosPorApontamento[apontamento.id] ?? [];
                  const anexos = anexosPorApontamento[apontamento.id] ?? [];
                  const podeEditar = podeApontar && apontamento.status === 'lancado';
                  const processando =
                    acaoEmAndamento?.endsWith(apontamento.id) ?? false;

                  return (
                    <TableRow key={apontamento.id}>
                      <TableCell>{new Date(`${apontamento.data}T12:00:00`).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{locaisPorId[apontamento.projeto_local_id] ?? '—'}</TableCell>
                      <TableCell>{tarefasPorId[apontamento.tarefa_id] ?? '—'}</TableCell>
                      <TableCell>{apontamento.duracao_minutos} min</TableCell>
                      <TableCell>{apontamento.quantidade_produzida ?? '—'}</TableCell>
                      <TableCell className="min-w-48">
                        {membros.map((membro) => membro.nome_snapshot).join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        {anexos.length > 0 ? (
                          <Button type="button" variant="link" className="h-auto p-0" onClick={() => setGaleria(apontamento)}>
                            {anexos.length} foto{anexos.length > 1 ? 's' : ''}
                          </Button>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="print:hidden">
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
                              size="sm"
                              disabled={processando}
                              onClick={() => void executarAcao(apontamento.id, 'conferir')}
                              title="Finalizar registro"
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              <span className="sr-only">Finalizar registro</span>
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setDetalhes(apontamento)}>
                            Detalhes
                          </Button>
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
              membros={membros}
              podeApontar={podeApontar}
              podeConferir={podeConferir}
              criarApontamento={criarApontamento}
              editarApontamento={editarApontamento}
              conferirApontamento={conferirApontamento}
              apontamentoInicial={editando}
              membrosIniciais={(membrosPorApontamento[editando.id] ?? []).map(
                (membro) => membro.membro_id,
              )}
              onSuccess={async () => {
                setEditando(null);
                await recarregar();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(galeria)} onOpenChange={(aberto) => !aberto && setGaleria(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fotos do apontamento</DialogTitle>
            <DialogDescription>
              As imagens ficam no bucket privado da Produção e não movimentam estoque.
            </DialogDescription>
          </DialogHeader>
          {galeria && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(anexosPorApontamento[galeria.id] ?? []).map((anexo) => (
                <FotoHistorico
                  key={anexo.id}
                  anexo={anexo}
                  obterUrl={obterUrlAnexo}
                  baixar={baixarAnexo}
                  podeExcluir={podeApontar && galeria.status === 'lancado'}
                  excluir={async (id) => {
                    await removerAnexo(id);
                    setAnexosPorApontamento((atuais) => ({
                      ...atuais,
                      [galeria.id]: (atuais[galeria.id] ?? []).filter(
                        (item) => item.id !== id,
                      ),
                    }));
                  }}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detalhes)} onOpenChange={(aberto) => !aberto && setDetalhes(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do apontamento</DialogTitle>
            <DialogDescription>
              Dados operacionais, mão de obra e imagens vinculadas.
            </DialogDescription>
          </DialogHeader>
          {detalhes && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <p><span className="font-medium">Projeto/local:</span> {locaisPorId[detalhes.projeto_local_id] ?? '—'}</p>
                <p><span className="font-medium">Tarefa:</span> {tarefasPorId[detalhes.tarefa_id] ?? '—'}</p>
                <p><span className="font-medium">Membros:</span> {(membrosPorApontamento[detalhes.id] ?? []).map((membro) => `${membro.nome_snapshot} (${membro.valor_hora_snapshot === null ? 'Valor/hora não informado' : `${membro.valor_hora_snapshot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/h`})`).join(', ') || '—'}</p>
                <p><span className="font-medium">Horário:</span> {detalhes.inicio.slice(0, 5)}–{detalhes.termino.slice(0, 5)}</p>
                <p><span className="font-medium">Duração total:</span> {detalhes.duracao_minutos} min</p>
                <p><span className="font-medium">Tempo produtivo:</span> {detalhes.minutos_produtivos} min</p>
                <p><span className="font-medium">Tempo improdutivo:</span> {detalhes.minutos_improdutivos} min</p>
                <p><span className="font-medium">Eficiência:</span> {detalhes.duracao_minutos > 0 ? ((detalhes.minutos_produtivos / detalhes.duracao_minutos) * 100).toFixed(1) : '0'}%</p>
              </div>
              {detalhes.motivo_improdutivo && (
                <p><span className="font-medium">Motivo da perda:</span> {detalhes.motivo_improdutivo}</p>
              )}
              {detalhes.observacoes && (
                <p><span className="font-medium">Observações:</span> {detalhes.observacoes}</p>
              )}
              {(anexosPorApontamento[detalhes.id] ?? []).length > 0 && (
                <Button type="button" variant="outline" onClick={() => setGaleria(detalhes)}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Ver galeria de imagens
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
