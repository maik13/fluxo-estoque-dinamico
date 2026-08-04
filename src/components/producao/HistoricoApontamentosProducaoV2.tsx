import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, Filter, ImageIcon, Loader2, Printer, Trash2, XCircle } from 'lucide-react';
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
import { useOrdensProducao, formatarNumeroOrdemProducao } from '@/hooks/useOrdensProducao';
import { usePermissions } from '@/hooks/usePermissions';
import { useProcessosProducao } from '@/hooks/useProcessosProducao';
import { useProducaoAnexos } from '@/hooks/useProducaoAnexos';
import { useProjetosProducao } from '@/hooks/useProjetosProducao';
import { supabase } from '@/integrations/supabase/client';
import type {
  ProducaoApontamento,
  ProducaoApontamentoAnexo,
  ProducaoApontamentoMembro,
  ProducaoMembro,
  ProducaoStatus,
  ProducaoTarefa,
} from '@/types/producao';
import { imprimirOrdemProducao } from '@/utils/imprimirOrdemProducao';
import { formatarErroSupabase } from '@/utils/supabaseError';

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
const AVULSOS = '__avulsos__';
const statusLabel: Record<ProducaoStatus, string> = {
  lancado: 'Pendente',
  conferido: 'Conferido',
  cancelado: 'Cancelado',
};

export const HistoricoApontamentosProducaoV2 = ({
  apontamentos,
  tarefas,
  locais,
  membros: _membros,
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
  const [ordemId, setOrdemId] = useState(TODOS);
  const [detalhes, setDetalhes] = useState<ProducaoApontamento | null>(null);
  const [galeria, setGaleria] = useState<ProducaoApontamento | null>(null);
  const [imprimindoId, setImprimindoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [membrosPorApontamento, setMembrosPorApontamento] = useState<Record<string, ProducaoApontamentoMembro[]>>({});
  const [anexosPorApontamento, setAnexosPorApontamento] = useState<Record<string, ProducaoApontamentoAnexo[]>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const { isAdmin } = usePermissions();
  const { processos, listarProcessos } = useProcessosProducao();
  const { projetos, listarProjetos } = useProjetosProducao();
  const { ordens, listarOrdens } = useOrdensProducao();
  const { listarAnexosPorApontamentos, obterUrlAnexo } = useProducaoAnexos();
  const podeExcluir = isAdmin();

  useEffect(() => {
    void Promise.all([listarProcessos(), listarProjetos(), listarOrdens()]);
  }, [listarOrdens, listarProcessos, listarProjetos]);

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
  const ordensPorId = useMemo(() => Object.fromEntries(ordens.map((ordem) => [ordem.id, ordem])), [ordens]);

  const filtrados = useMemo(() => apontamentos.filter((apontamento) => {
    const processo = apontamento.processo_id ? processosPorId[apontamento.processo_id] : null;
    const ordem = apontamento.ordem_producao_id ? ordensPorId[apontamento.ordem_producao_id] : null;
    const localId = apontamento.projeto_local_id ?? processo?.projeto?.local_utilizacao_id ?? null;
    const correspondeProjeto = projetoId === TODOS
      || (ordem ? ordem.projeto_id === projetoId : localId === projetoId);
    const correspondeOrdem = ordemId === TODOS
      || (ordemId === AVULSOS ? !apontamento.ordem_producao_id : apontamento.ordem_producao_id === ordemId);
    return (
      (!dataInicio || apontamento.data >= dataInicio) &&
      (!dataFim || apontamento.data <= dataFim) &&
      (status === TODOS || apontamento.status === status) &&
      correspondeProjeto &&
      (processoId === TODOS || apontamento.processo_id === processoId) &&
      correspondeOrdem
    );
  }), [apontamentos, dataFim, dataInicio, ordemId, ordensPorId, processoId, processosPorId, projetoId, status]);

  const cancelar = async (apontamento: ProducaoApontamento) => {
    const justificativa = window.prompt('Justificativa para cancelar o apontamento:')?.trim();
    if (!justificativa) return;
    try {
      await cancelarApontamento(apontamento.id, justificativa);
      await Promise.all([recarregar(), listarOrdens()]);
      toast.success('Apontamento cancelado. O progresso da OP foi atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar.');
    }
  };

  const conferir = async (apontamento: ProducaoApontamento) => {
    try {
      await conferirApontamento(apontamento.id);
      await Promise.all([recarregar(), listarOrdens()]);
      toast.success('Apontamento conferido. O progresso da OP foi atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível conferir.');
    }
  };

  const excluir = async (apontamento: ProducaoApontamento) => {
    const confirmado = window.confirm(
      'Tem certeza de que deseja excluir este apontamento? Esta ação não poderá ser desfeita.',
    );
    if (!confirmado) return;

    setExcluindoId(apontamento.id);
    try {
      const { error } = await (supabase.rpc as any)('excluir_apontamento_producao_admin', {
        p_apontamento_id: apontamento.id,
      });
      if (error) {
        throw new Error(
          formatarErroSupabase(error, 'Não foi possível excluir o apontamento.'),
        );
      }

      if (detalhes?.id === apontamento.id) setDetalhes(null);
      if (galeria?.id === apontamento.id) {
        setGaleria(null);
        setUrls({});
      }

      await Promise.all([recarregar(), listarOrdens(), listarProcessos()]);
      toast.success('Apontamento excluído do Histórico.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível excluir o apontamento.',
      );
    } finally {
      setExcluindoId(null);
    }
  };

  const imprimir = async (ordemProducaoId: string) => {
    const ordem = ordensPorId[ordemProducaoId];
    if (!ordem) return void toast.error('Ordem de Produção não encontrada.');
    setImprimindoId(ordem.id);
    try {
      const { data, error } = await (supabase.from('producao_apontamentos') as any)
        .select('*')
        .eq('ordem_producao_id', ordem.id)
        .order('data', { ascending: true })
        .order('inicio', { ascending: true });
      if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível carregar os apontamentos da OP.'));
      const registros = (data ?? []) as ProducaoApontamento[];
      const ids = registros.map((registro) => registro.id);
      const [equipes, anexos] = await Promise.all([
        Promise.all(registros.map(async (registro) => [registro.id, await listarMembros(registro.id)] as const)),
        listarAnexosPorApontamentos(ids),
      ]);
      const equipesPorId = Object.fromEntries(equipes);
      const anexosAgrupados = anexos.reduce<Record<string, ProducaoApontamentoAnexo[]>>((acc, anexo) => {
        acc[anexo.apontamento_id] = acc[anexo.apontamento_id] ?? [];
        acc[anexo.apontamento_id].push(anexo);
        return acc;
      }, {});

      const registrosImpressao = await Promise.all(registros.map(async (registro) => ({
        apontamento: registro,
        tarefaNome: tarefasPorId[registro.tarefa_id] ?? 'Atividade não identificada',
        membros: equipesPorId[registro.id] ?? [],
        fotos: await Promise.all((anexosAgrupados[registro.id] ?? []).map(async (anexo) => ({
          nome: anexo.file_name,
          url: await obterUrlAnexo(anexo.file_path),
          criadoEm: anexo.created_at,
        }))),
      })));

      imprimirOrdemProducao({ ordem, apontamentos: registrosImpressao });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível preparar a OP para impressão.');
    } finally {
      setImprimindoId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico e rastreabilidade</CardTitle>
        <CardDescription>
          A OP é emitida antes da execução. Esta tela mostra os apontamentos realizados dentro de cada ordem e as atividades avulsas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4" />Filtros</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-1.5"><Label>Data inicial</Label><Input type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Data final</Label><Input type="date" value={dataFim} onChange={(event) => setDataFim(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Projeto/local</Label><Select value={projetoId} onValueChange={setProjetoId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={TODOS}>Todos</SelectItem>{locais.map((local) => <SelectItem key={local.id} value={local.id}>{local.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Etapa</Label><Select value={processoId} onValueChange={setProcessoId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={TODOS}>Todas</SelectItem>{processos.map((processo) => <SelectItem key={processo.id} value={processo.id}>{processo.codigo} · {processo.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Ordem de Produção</Label><Select value={ordemId} onValueChange={setOrdemId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={TODOS}>Todas</SelectItem><SelectItem value={AVULSOS}>Somente avulsos</SelectItem>{ordens.map((ordem) => <SelectItem key={ordem.id} value={ordem.id}>{formatarNumeroOrdemProducao(ordem.numero)} · {ordem.processo_nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Status do apontamento</Label><Select value={status} onValueChange={(value) => setStatus(value as ProducaoStatus | typeof TODOS)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={TODOS}>Todos</SelectItem><SelectItem value="lancado">Pendente</SelectItem><SelectItem value="conferido">Conferido</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem></SelectContent></Select></div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>OP</TableHead><TableHead>Data</TableHead><TableHead>Projeto / Etapa</TableHead><TableHead>Atividade</TableHead><TableHead>Equipe</TableHead><TableHead>Quantidade</TableHead><TableHead>Fotos</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={9} className="h-28 text-center">Carregando...</TableCell></TableRow> : filtrados.length === 0 ? <TableRow><TableCell colSpan={9} className="h-28 text-center text-muted-foreground">Nenhum apontamento encontrado.</TableCell></TableRow> : filtrados.map((apontamento) => {
                const processo = apontamento.processo_id ? processosPorId[apontamento.processo_id] : null;
                const ordem = apontamento.ordem_producao_id ? ordensPorId[apontamento.ordem_producao_id] : null;
                const localId = apontamento.projeto_local_id ?? processo?.projeto?.local_utilizacao_id ?? null;
                const projetoAvulso = localId ? projetosPorLocal[localId] : null;
                const equipe = membrosPorApontamento[apontamento.id] ?? [];
                const anexos = anexosPorApontamento[apontamento.id] ?? [];
                return (
                  <TableRow key={apontamento.id}>
                    <TableCell>{ordem ? <><span className="font-medium">{formatarNumeroOrdemProducao(ordem.numero)}</span><div className="text-xs text-muted-foreground">{ordem.percentual_realizado}% da OP</div></> : <Badge variant="outline">Avulso</Badge>}</TableCell>
                    <TableCell>{new Date(`${apontamento.data}T12:00:00`).toLocaleDateString('pt-BR')}<div className="text-xs text-muted-foreground">{apontamento.inicio.slice(0, 5)}–{apontamento.termino.slice(0, 5)}</div></TableCell>
                    <TableCell>{ordem?.projeto_nome ?? projetoAvulso?.nome ?? (localId ? locaisPorId[localId] : '—')}<div className="text-xs text-muted-foreground">{ordem ? `${ordem.processo_codigo} · ${ordem.processo_nome}` : 'Atividade não planejada'}</div></TableCell>
                    <TableCell>{tarefasPorId[apontamento.tarefa_id] ?? '—'}</TableCell>
                    <TableCell>{equipe.map((membro) => membro.nome_snapshot).join(', ') || '—'}</TableCell>
                    <TableCell>{apontamento.quantidade_produzida ?? '—'}</TableCell>
                    <TableCell>{anexos.length > 0 ? <Button type="button" variant="link" className="h-auto p-0" onClick={() => setGaleria(apontamento)}><ImageIcon className="mr-1 h-4 w-4" />{anexos.length}</Button> : '—'}</TableCell>
                    <TableCell><Badge variant="outline">{statusLabel[apontamento.status]}</Badge></TableCell>
                    <TableCell><div className="flex justify-end gap-1">
                      {ordem && <Button size="icon" variant="ghost" title={`Imprimir ${formatarNumeroOrdemProducao(ordem.numero)}`} disabled={imprimindoId === ordem.id} onClick={() => void imprimir(ordem.id)}>{imprimindoId === ordem.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}</Button>}
                      {podeConferir && apontamento.status === 'lancado' && <Button size="icon" variant="ghost" title="Conferir" onClick={() => void conferir(apontamento)}><CheckCircle2 className="h-4 w-4 text-emerald-500" /></Button>}
                      {apontamento.status === 'lancado' && <Button size="icon" variant="ghost" title="Cancelar" onClick={() => void cancelar(apontamento)}><XCircle className="h-4 w-4 text-red-500" /></Button>}
                      {podeExcluir && <Button size="icon" variant="ghost" title="Excluir apontamento" disabled={excluindoId === apontamento.id} onClick={() => void excluir(apontamento)}>{excluindoId === apontamento.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}</Button>}
                      <Button size="icon" variant="ghost" title="Detalhes" onClick={() => setDetalhes(apontamento)}><Eye className="h-4 w-4" /></Button>
                    </div></TableCell>
                  </TableRow>
                );
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
          <DialogHeader><DialogTitle>Rastreabilidade do apontamento</DialogTitle><DialogDescription>Este registro é uma execução dentro da OP ou uma atividade avulsa.</DialogDescription></DialogHeader>
          {detalhes && <div className="grid gap-3 sm:grid-cols-2">
            <p><strong>Ordem de Produção:</strong> {detalhes.ordem_producao_id ? formatarNumeroOrdemProducao(ordensPorId[detalhes.ordem_producao_id]?.numero) : 'Atividade avulsa'}</p>
            <p><strong>Criado por:</strong> {detalhes.criado_por_nome_snapshot ?? 'Não identificado'}<br /><span className="text-sm text-muted-foreground">{new Date(detalhes.created_at).toLocaleString('pt-BR')}</span></p>
            <p><strong>Última edição:</strong> {detalhes.ultima_edicao_por_nome_snapshot ?? 'Sem edição'}<br /><span className="text-sm text-muted-foreground">{detalhes.ultima_edicao_em ? new Date(detalhes.ultima_edicao_em).toLocaleString('pt-BR') : '—'}</span></p>
            <p><strong>Conferido por:</strong> {detalhes.conferido_por_nome_snapshot ?? 'Não conferido'}<br /><span className="text-sm text-muted-foreground">{detalhes.conferido_em ? new Date(detalhes.conferido_em).toLocaleString('pt-BR') : '—'}</span></p>
            <p><strong>Cancelado por:</strong> {detalhes.cancelado_por_nome_snapshot ?? 'Não cancelado'}<br /><span className="text-sm text-muted-foreground">{detalhes.cancelado_em ? new Date(detalhes.cancelado_em).toLocaleString('pt-BR') : '—'}</span></p>
            <p><strong>Quantidade:</strong> {detalhes.quantidade_produzida ?? '—'}</p>
            <p><strong>Tempos:</strong> {detalhes.minutos_produtivos} min produtivos / {detalhes.minutos_improdutivos} min improdutivos</p>
            {detalhes.motivo_cancelamento && <p className="sm:col-span-2"><strong>Motivo do cancelamento:</strong> {detalhes.motivo_cancelamento}</p>}
            {detalhes.observacoes && <p className="sm:col-span-2"><strong>Observações:</strong> {detalhes.observacoes}</p>}
          </div>}
        </DialogContent>
      </Dialog>
    </Card>
  );
};