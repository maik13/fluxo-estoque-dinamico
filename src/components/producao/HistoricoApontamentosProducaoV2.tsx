import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, Filter, ImageIcon, XCircle } from 'lucide-react';
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
import { useProcessosProducao } from '@/hooks/useProcessosProducao';
import { useProducaoAnexos } from '@/hooks/useProducaoAnexos';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import type {
  ProducaoApontamento,
  ProducaoApontamentoAnexo,
  ProducaoApontamentoMembro,
  ProducaoMembro,
  ProducaoStatus,
  ProducaoTarefa,
} from '@/types/producao';

interface Props {
  apontamentos: ProducaoApontamento[];
  tarefas: ProducaoTarefa[];
  locais: LocalUtilizacaoConfig[];
  membros: ProducaoMembro[];
  loading: boolean;
  podeConferir: boolean;
  listarMembros: (apontamentoId: string) => Promise<ProducaoApontamentoMembro[]>;
  cancelarApontamento: (id: string, justificativa?: string) => Promise<ProducaoApontamento>;
  conferirApontamento: (id: string) => Promise<ProducaoApontamento>;
  recarregar: () => Promise<unknown>;
}

const TODOS = '__todos__';
const statusLabel: Record<ProducaoStatus, string> = {
  lancado: 'Pendente',
  conferido: 'Conferido',
  cancelado: 'Cancelado',
};

export const HistoricoApontamentosProducaoV2 = ({
  apontamentos,
  tarefas,
  locais,
  membros,
  loading,
  podeConferir,
  listarMembros,
  cancelarApontamento,
  conferirApontamento,
  recarregar,
}: Props) => {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [status, setStatus] = useState<ProducaoStatus | typeof TODOS>(TODOS);
  const [projetoId, setProjetoId] = useState(TODOS);
  const [processoId, setProcessoId] = useState(TODOS);
  const [detalhes, setDetalhes] = useState<ProducaoApontamento | null>(null);
  const [galeria, setGaleria] = useState<ProducaoApontamento | null>(null);
  const [membrosPorApontamento, setMembrosPorApontamento] = useState<Record<string, ProducaoApontamentoMembro[]>>({});
  const [anexosPorApontamento, setAnexosPorApontamento] = useState<Record<string, ProducaoApontamentoAnexo[]>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const { processos, listarProcessos } = useProcessosProducao();
  const { projetos, listarProjetos } = useProjetosProducao();
  const { listarAnexosPorApontamentos, obterUrlAnexo } = useProducaoAnexos();

  useEffect(() => {
    void Promise.all([listarProcessos(), listarProjetos()]);
  }, [listarProcessos, listarProjetos]);

  useEffect(() => {
    let ativo = true;
    void Promise.all(apontamentos.map(async (apontamento) => [apontamento.id, await listarMembros(apontamento.id)] as const))
      .then((pares) => { if (ativo) setMembrosPorApontamento(Object.fromEntries(pares)); })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, [apontamentos, listarMembros]);

  useEffect(() => {
    let ativo = true;
    const ids = apontamentos.map((apontamento) => apontamento.id);
    void listarAnexosPorApontamentos(ids)
      .then((anexos) => {
        if (!ativo) return;
        const agrupados = anexos.reduce<Record<string, ProducaoApontamentoAnexo[]>>((acc, anexo) => {
          acc[anexo.apontamento_id] = acc[anexo.apontamento_id] ?? [];
          acc[anexo.apontamento_id].push(anexo);
          return acc;
        }, {});
        setAnexosPorApontamento(agrupados);
      })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, [apontamentos, listarAnexosPorApontamentos]);

  useEffect(() => {
    if (!galeria) return;
    const anexos = anexosPorApontamento[galeria.id] ?? [];
    void Promise.all(anexos.map(async (anexo) => [anexo.id, await obterUrlAnexo(anexo.file_path)] as const))
      .then((pares) => setUrls(Object.fromEntries(pares)))
      .catch(() => setUrls({}));
  }, [anexosPorApontamento, galeria, obterUrlAnexo]);

  const tarefasPorId = useMemo(() => Object.fromEntries(tarefas.map((tarefa) => [tarefa.id, tarefa.nome])), [tarefas]);
  const locaisPorId = useMemo(() => Object.fromEntries(locais.map((local) => [local.id, local.nome])), [locais]);
  const processosPorId = useMemo(() => Object.fromEntries(processos.map((processo) => [processo.id, processo])), [processos]);
  const projetosPorLocal = useMemo(() => Object.fromEntries(projetos.map((projeto) => [projeto.local_utilizacao_id, projeto])), [projetos]);

  const filtrados = useMemo(() => apontamentos.filter((apontamento) => {
    const processo = apontamento.processo_id ? processosPorId[apontamento.processo_id] : null;
    const localId = apontamento.projeto_local_id ?? processo?.projeto?.local_utilizacao_id ?? null;
    return (
      (!dataInicio || apontamento.data >= dataInicio) &&
      (!dataFim || apontamento.data <= dataFim) &&
      (status === TODOS || apontamento.status === status) &&
      (projetoId === TODOS || localId === projetoId) &&
      (processoId === TODOS || apontamento.processo_id === processoId)
    );
  }), [apontamentos, dataFim, dataInicio, processoId, processosPorId, projetoId, status]);

  const cancelar = async (apontamento: ProducaoApontamento) => {
    const justificativa = window.prompt('Justificativa para cancelar o apontamento:')?.trim();
    if (!justificativa) return;
    try {
      await cancelarApontamento(apontamento.id, justificativa);
      await recarregar();
      toast.success('Apontamento cancelado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar.');
    }
  };

  const conferir = async (apontamento: ProducaoApontamento) => {
    try {
      await conferirApontamento(apontamento.id);
      await recarregar();
      toast.success('Apontamento conferido.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível conferir.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico e rastreabilidade</CardTitle>
        <CardDescription>Consulte contexto, responsáveis, status e evidências fotográficas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4" />Filtros</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5"><Label>Data inicial</Label><Input type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Data final</Label><Input type="date" value={dataFim} onChange={(event) => setDataFim(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Projeto/local</Label><Select value={projetoId} onValueChange={setProjetoId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={TODOS}>Todos</SelectItem>{locais.map((local) => <SelectItem key={local.id} value={local.id}>{local.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Processo</Label><Select value={processoId} onValueChange={setProcessoId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={TODOS}>Todos</SelectItem>{processos.map((processo) => <SelectItem key={processo.id} value={processo.id}>{processo.codigo} · {processo.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Status</Label><Select value={status} onValueChange={(value) => setStatus(value as ProducaoStatus | typeof TODOS)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={TODOS}>Todos</SelectItem><SelectItem value="lancado">Pendente</SelectItem><SelectItem value="conferido">Conferido</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem></SelectContent></Select></div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Projeto / cidade</TableHead><TableHead>Processo</TableHead><TableHead>Tarefa</TableHead><TableHead>Equipe</TableHead><TableHead>Criado por</TableHead><TableHead>Fotos</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={9} className="h-28 text-center">Carregando...</TableCell></TableRow> : filtrados.length === 0 ? <TableRow><TableCell colSpan={9} className="h-28 text-center text-muted-foreground">Nenhum apontamento encontrado.</TableCell></TableRow> : filtrados.map((apontamento) => {
                const processo = apontamento.processo_id ? processosPorId[apontamento.processo_id] : null;
                const localId = apontamento.projeto_local_id ?? processo?.projeto?.local_utilizacao_id ?? null;
                const projeto = localId ? projetosPorLocal[localId] : null;
                const equipe = membrosPorApontamento[apontamento.id] ?? [];
                const anexos = anexosPorApontamento[apontamento.id] ?? [];
                return <TableRow key={apontamento.id}>
                  <TableCell>{new Date(`${apontamento.data}T12:00:00`).toLocaleDateString('pt-BR')}<div className="text-xs text-muted-foreground">{apontamento.inicio.slice(0, 5)}–{apontamento.termino.slice(0, 5)}</div></TableCell>
                  <TableCell>{localId ? locaisPorId[localId] ?? projeto?.nome ?? '—' : '—'}<div className="text-xs text-muted-foreground">{projeto?.cidade ? `${projeto.cidade}/${projeto.uf ?? ''}` : 'Cidade/UF não configuradas'}</div></TableCell>
                  <TableCell>{processo ? <><span className="font-medium">{processo.codigo}</span><div className="text-xs text-muted-foreground">{processo.nome}</div></> : 'Avulso'}</TableCell>
                  <TableCell>{tarefasPorId[apontamento.tarefa_id] ?? '—'}</TableCell>
                  <TableCell>{equipe.map((membro) => membro.nome_snapshot).join(', ') || '—'}</TableCell>
                  <TableCell>{apontamento.criado_por_nome_snapshot ?? 'Não identificado'}<div className="text-xs text-muted-foreground">{new Date(apontamento.created_at).toLocaleString('pt-BR')}</div></TableCell>
                  <TableCell>{anexos.length > 0 ? <Button type="button" variant="link" className="h-auto p-0" onClick={() => setGaleria(apontamento)}><ImageIcon className="mr-1 h-4 w-4" />{anexos.length}</Button> : '—'}</TableCell>
                  <TableCell><Badge variant="outline">{statusLabel[apontamento.status]}</Badge></TableCell>
                  <TableCell><div className="flex justify-end gap-1">{podeConferir && apontamento.status === 'lancado' && <Button size="icon" variant="ghost" title="Conferir" onClick={() => void conferir(apontamento)}><CheckCircle2 className="h-4 w-4 text-emerald-500" /></Button>}{apontamento.status === 'lancado' && <Button size="icon" variant="ghost" title="Cancelar" onClick={() => void cancelar(apontamento)}><XCircle className="h-4 w-4 text-red-500" /></Button>}<Button size="icon" variant="ghost" title="Detalhes" onClick={() => setDetalhes(apontamento)}><Eye className="h-4 w-4" /></Button></div></TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={Boolean(galeria)} onOpenChange={(open) => { if (!open) { setGaleria(null); setUrls({}); } }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>Fotos do apontamento</DialogTitle><DialogDescription>Evidências fotográficas vinculadas ao registro produtivo.</DialogDescription></DialogHeader>
          {galeria && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(anexosPorApontamento[galeria.id] ?? []).map((anexo) => <div key={anexo.id} className="rounded-lg border p-3"><div className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-md bg-muted/20">{urls[anexo.id] ? <img src={urls[anexo.id]} alt={anexo.file_name} className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}</div><p className="truncate text-sm font-medium">{anexo.file_name}</p><p className="text-xs text-muted-foreground">{new Date(anexo.created_at).toLocaleString('pt-BR')}</p></div>)}</div>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detalhes)} onOpenChange={(open) => !open && setDetalhes(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Rastreabilidade do apontamento</DialogTitle><DialogDescription>Responsáveis e horários registrados pelo sistema.</DialogDescription></DialogHeader>
          {detalhes && <div className="grid gap-3 sm:grid-cols-2"><p><strong>Criado por:</strong> {detalhes.criado_por_nome_snapshot ?? 'Não identificado'}<br /><span className="text-sm text-muted-foreground">{new Date(detalhes.created_at).toLocaleString('pt-BR')}</span></p><p><strong>Última edição:</strong> {detalhes.ultima_edicao_por_nome_snapshot ?? 'Sem edição'}<br /><span className="text-sm text-muted-foreground">{detalhes.ultima_edicao_em ? new Date(detalhes.ultima_edicao_em).toLocaleString('pt-BR') : '—'}</span></p><p><strong>Conferido por:</strong> {detalhes.conferido_por_nome_snapshot ?? 'Não conferido'}<br /><span className="text-sm text-muted-foreground">{detalhes.conferido_em ? new Date(detalhes.conferido_em).toLocaleString('pt-BR') : '—'}</span></p><p><strong>Cancelado por:</strong> {detalhes.cancelado_por_nome_snapshot ?? 'Não cancelado'}<br /><span className="text-sm text-muted-foreground">{detalhes.cancelado_em ? new Date(detalhes.cancelado_em).toLocaleString('pt-BR') : '—'}</span></p><p><strong>Quantidade:</strong> {detalhes.quantidade_produzida ?? '—'}</p><p><strong>Tempos:</strong> {detalhes.minutos_produtivos} min produtivos / {detalhes.minutos_improdutivos} min improdutivos</p>{detalhes.motivo_cancelamento && <p className="sm:col-span-2"><strong>Motivo do cancelamento:</strong> {detalhes.motivo_cancelamento}</p>}{detalhes.observacoes && <p className="sm:col-span-2"><strong>Observações:</strong> {detalhes.observacoes}</p>}</div>}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
