import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Filter,
  ImageIcon,
  Loader2,
  Pencil,
  Printer,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  formatarIdentificacaoOrdemProducao,
  formatarNumeroOrdemProducao,
  useOrdensProducao,
} from '@/hooks/useOrdensProducao';
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
const RETROATIVOS = '__retroativos__';
const RETIFICADOS = '__retificados__';
const SEM_OCORRENCIA = '__sem_ocorrencia__';

const statusLabel: Record<ProducaoStatus, string> = {
  lancado: 'Pendente',
  conferido: 'Conferido',
  cancelado: 'Cancelado',
};

const formatarQuantidade = (value: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value);

export const HistoricoApontamentosProducaoV3 = ({
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
  const [ocorrencia, setOcorrencia] = useState(TODOS);
  const [detalhes, setDetalhes] = useState<ProducaoApontamento | null>(null);
  const [galeria, setGaleria] = useState<ProducaoApontamento | null>(null);
  const [apontamentoParaExcluir, setApontamentoParaExcluir] = useState<ProducaoApontamento | null>(null);
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
    void Promise.all(
      apontamentos.map(async (apontamento) => [apontamento.id, await listarMembros(apontamento.id)] as const),
    )
      .then((pares) => {
        if (ativo) setMembrosPorApontamento(Object.fromEntries(pares));
      })
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

  const tarefasPorId = useMemo(
    () => Object.fromEntries(tarefas.map((tarefa) => [tarefa.id, tarefa.nome])),
    [tarefas],
  );
  const locaisPorId = useMemo(
    () => Object.fromEntries(locais.map((local) => [local.id, local.nome])),
    [locais],
  );
  const processosPorId = useMemo(
    () => Object.fromEntries(processos.map((processo) => [processo.id, processo])),
    [processos],
  );
  const projetosPorLocal = useMemo(
    () => Object.fromEntries(projetos.map((projeto) => [projeto.local_utilizacao_id, projeto])),
    [projetos],
  );
  const ordensPorId = useMemo(
    () => Object.fromEntries(ordens.map((ordem) => [ordem.id, ordem])),
    [ordens],
  );

  const idsProjetosDoLocal = useMemo(
    () => new Set(
      projetoId === TODOS
        ? []
        : projetos.filter((projeto) => projeto.local_utilizacao_id === projetoId).map((projeto) => projeto.id),
    ),
    [projetoId, projetos],
  );

  const processosDisponiveis = useMemo(() => {
    if (projetoId === TODOS) return processos;
    return processos.filter(
      (processo) => processo.projeto?.local_utilizacao_id === projetoId || idsProjetosDoLocal.has(processo.projeto_id),
    );
  }, [idsProjetosDoLocal, processos, projetoId]);

  const ordensDisponiveis = useMemo(
    () => ordens.filter((ordem) => {
      if (processoId !== TODOS && ordem.processo_id !== processoId) return false;
      if (projetoId !== TODOS && !idsProjetosDoLocal.has(ordem.projeto_id)) return false;
      return true;
    }),
    [idsProjetosDoLocal, ordens, processoId, projetoId],
  );

  const filtradosBase = useMemo(
    () =>
      apontamentos.filter((apontamento) => {
        const processo = apontamento.processo_id
          ? processosPorId[apontamento.processo_id]
          : null;
        const ordem = apontamento.ordem_producao_id
          ? ordensPorId[apontamento.ordem_producao_id]
          : null;
        const localId =
          apontamento.projeto_local_id ??
          processo?.projeto?.local_utilizacao_id ??
          null;
        const correspondeProjeto =
          projetoId === TODOS ||
          localId === projetoId ||
          Boolean(ordem && idsProjetosDoLocal.has(ordem.projeto_id));
        const correspondeOrdem =
          ordemId === TODOS ||
          (ordemId === AVULSOS
            ? !apontamento.ordem_producao_id
            : apontamento.ordem_producao_id === ordemId);

        return (
          (!dataInicio || apontamento.data >= dataInicio) &&
          (!dataFim || apontamento.data <= dataFim) &&
          correspondeProjeto &&
          (processoId === TODOS || apontamento.processo_id === processoId) &&
          correspondeOrdem
        );
      }),
    [
      apontamentos,
      dataFim,
      dataInicio,
      idsProjetosDoLocal,
      ordemId,
      ordensPorId,
      processoId,
      processosPorId,
      projetoId,
    ],
  );

  const filtrados = useMemo(
    () =>
      filtradosBase.filter((apontamento) => {
        const retificado =
          Number((apontamento as any).retificacoes_count || 0) > 0;
        const correspondeOcorrencia =
          ocorrencia === TODOS ||
          (ocorrencia === RETROATIVOS && apontamento.fechamento_retroativo) ||
          (ocorrencia === RETIFICADOS && retificado) ||
          (ocorrencia === SEM_OCORRENCIA &&
            !apontamento.fechamento_retroativo &&
            !retificado);

        return (
          (status === TODOS || apontamento.status === status) &&
          correspondeOcorrencia
        );
      }),
    [filtradosBase, ocorrencia, status],
  );

  const resumoFiltrado = useMemo(() => {
    const idsOrdens = new Set<string>();
    let conferidos = 0;
    let pendentes = 0;
    let cancelados = 0;
    let retroativos = 0;
    let retificados = 0;

    filtradosBase.forEach((apontamento) => {
      if (apontamento.ordem_producao_id) {
        idsOrdens.add(apontamento.ordem_producao_id);
      }
      if (apontamento.status === 'conferido') conferidos += 1;
      if (apontamento.status === 'lancado') pendentes += 1;
      if (apontamento.status === 'cancelado') cancelados += 1;
      if (apontamento.fechamento_retroativo) retroativos += 1;
      if (Number((apontamento as any).retificacoes_count || 0) > 0) {
        retificados += 1;
      }
    });

    return {
      apontamentos: filtrados.length,
      ordens: idsOrdens.size,
      conferidos,
      pendentes,
      cancelados,
      retroativos,
      retificados,
    };
  }, [filtradosBase]);

  const aplicarFiltroRapido = (
    tipo: 'conferidos' | 'pendentes' | 'cancelados' | 'retroativos' | 'retificados',
  ) => {
    if (tipo === 'conferidos') {
      const ativo = status === 'conferido' && ocorrencia === TODOS;
      setStatus(ativo ? TODOS : 'conferido');
      setOcorrencia(TODOS);
      return;
    }

    if (tipo === 'pendentes') {
      const ativo = status === 'lancado' && ocorrencia === TODOS;
      setStatus(ativo ? TODOS : 'lancado');
      setOcorrencia(TODOS);
      return;
    }

    if (tipo === 'cancelados') {
      const ativo = status === 'cancelado' && ocorrencia === TODOS;
      setStatus(ativo ? TODOS : 'cancelado');
      setOcorrencia(TODOS);
      return;
    }

    if (tipo === 'retroativos') {
      const ativo = ocorrencia === RETROATIVOS && status === TODOS;
      setStatus(TODOS);
      setOcorrencia(ativo ? TODOS : RETROATIVOS);
      return;
    }

    const ativo = ocorrencia === RETIFICADOS && status === TODOS;
    setStatus(TODOS);
    setOcorrencia(ativo ? TODOS : RETIFICADOS);
  };

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

  const excluir = async () => {
    const apontamento = apontamentoParaExcluir;
    if (!apontamento) return;
    setExcluindoId(apontamento.id);
    try {
      const { error } = await (supabase.rpc as any)('excluir_apontamento_producao_admin', { p_apontamento_id: apontamento.id });
      if (error) throw new Error(formatarErroSupabase(error, 'Não foi possível excluir o apontamento.'));
      setApontamentoParaExcluir(null);
      if (detalhes?.id === apontamento.id) setDetalhes(null);
      await Promise.all([recarregar(), listarOrdens(), listarProcessos()]);
      toast.success('Apontamento excluído e progresso recalculado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir o apontamento.');
    } finally {
      setExcluindoId(null);
    }
  };

  const imprimir = async (ordemProducaoId: string) => {
    const ordem = ordensPorId[ordemProducaoId];
    if (!ordem) return toast.error('Ordem de Produção não encontrada.');
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

  const ordemDaExclusao = apontamentoParaExcluir?.ordem_producao_id ? ordensPorId[apontamentoParaExcluir.ordem_producao_id] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de apontamentos e rastreabilidade</CardTitle>
        <CardDescription>
          Consulta e auditoria dos apontamentos encerrados. Correções operacionais são feitas dentro da própria OP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4" />Filtros</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <div className="space-y-1.5"><Label>Data inicial</Label><Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Data final</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Projeto/local</Label>
              <Select value={projetoId} onValueChange={(value) => { setProjetoId(value); setProcessoId(TODOS); setOrdemId(TODOS); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={TODOS}>Todos</SelectItem>{locais.map((local) => <SelectItem key={local.id} value={local.id}>{local.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={processoId} onValueChange={(value) => { setProcessoId(value); setOrdemId(TODOS); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={TODOS}>Todas</SelectItem>{processosDisponiveis.map((processo) => <SelectItem key={processo.id} value={processo.id}>{processo.codigo} · {processo.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ordem de Produção</Label>
              <Select value={ordemId} onValueChange={setOrdemId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={TODOS}>Todas</SelectItem><SelectItem value={AVULSOS}>Somente avulsos</SelectItem>{ordensDisponiveis.map((ordem) => <SelectItem key={ordem.id} value={ordem.id}>{formatarIdentificacaoOrdemProducao(ordem)} · {ordem.processo_nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ProducaoStatus | typeof TODOS)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={TODOS}>Todos</SelectItem><SelectItem value="lancado">Pendente</SelectItem><SelectItem value="conferido">Conferido</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ocorrência</Label>
              <Select value={ocorrencia} onValueChange={setOcorrencia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={TODOS}>Todas</SelectItem><SelectItem value={RETROATIVOS}>Fechamento retroativo</SelectItem><SelectItem value={RETIFICADOS}>Retificado</SelectItem><SelectItem value={SEM_OCORRENCIA}>Sem ocorrência</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">OPs distintas</p>
            <p className="text-xl font-semibold">{resumoFiltrado.ordens}</p>
            <p className="text-[10px] text-muted-foreground">com apontamentos</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Apontamentos</p>
            <p className="text-xl font-semibold">{resumoFiltrado.apontamentos}</p>
            <p className="text-[10px] text-muted-foreground">registros totais</p>
          </div>
          <button
            type="button"
            aria-pressed={status === 'conferido' && ocorrencia === TODOS}
            onClick={() => aplicarFiltroRapido('conferidos')}
            className={
              status === 'conferido' && ocorrencia === TODOS
                ? 'rounded-lg border border-emerald-500 bg-emerald-500/10 p-3 text-left ring-2 ring-emerald-500/30 transition'
                : 'rounded-lg border p-3 text-left transition hover:border-emerald-500/50 hover:bg-emerald-500/5'
            }
          >
            <p className="text-xs text-muted-foreground">Conferidos</p>
            <p className="text-xl font-semibold text-emerald-500">{resumoFiltrado.conferidos}</p>
            <p className="text-[10px] text-muted-foreground">clique para filtrar</p>
          </button>
          <button
            type="button"
            aria-pressed={status === 'lancado' && ocorrencia === TODOS}
            onClick={() => aplicarFiltroRapido('pendentes')}
            className={
              status === 'lancado' && ocorrencia === TODOS
                ? 'rounded-lg border border-amber-500 bg-amber-500/10 p-3 text-left ring-2 ring-amber-500/30 transition'
                : 'rounded-lg border p-3 text-left transition hover:border-amber-500/50 hover:bg-amber-500/5'
            }
          >
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-xl font-semibold text-amber-500">{resumoFiltrado.pendentes}</p>
            <p className="text-[10px] text-muted-foreground">clique para filtrar</p>
          </button>
          <button
            type="button"
            aria-pressed={status === 'cancelado' && ocorrencia === TODOS}
            onClick={() => aplicarFiltroRapido('cancelados')}
            className={
              status === 'cancelado' && ocorrencia === TODOS
                ? 'rounded-lg border border-red-500 bg-red-500/10 p-3 text-left ring-2 ring-red-500/30 transition'
                : 'rounded-lg border p-3 text-left transition hover:border-red-500/50 hover:bg-red-500/5'
            }
          >
            <p className="text-xs text-muted-foreground">Cancelados</p>
            <p className="text-xl font-semibold text-red-500">{resumoFiltrado.cancelados}</p>
            <p className="text-[10px] text-muted-foreground">clique para filtrar</p>
          </button>
          <button
            type="button"
            aria-pressed={ocorrencia === RETROATIVOS && status === TODOS}
            onClick={() => aplicarFiltroRapido('retroativos')}
            className={
              ocorrencia === RETROATIVOS && status === TODOS
                ? 'rounded-lg border border-amber-600 bg-amber-500/10 p-3 text-left ring-2 ring-amber-500/30 transition'
                : 'rounded-lg border p-3 text-left transition hover:border-amber-600/50 hover:bg-amber-500/5'
            }
          >
            <p className="text-xs text-muted-foreground">Retroativos</p>
            <p className="text-xl font-semibold text-amber-600">{resumoFiltrado.retroativos}</p>
            <p className="text-[10px] text-muted-foreground">clique para filtrar</p>
          </button>
          <button
            type="button"
            aria-pressed={ocorrencia === RETIFICADOS && status === TODOS}
            onClick={() => aplicarFiltroRapido('retificados')}
            className={
              ocorrencia === RETIFICADOS && status === TODOS
                ? 'rounded-lg border border-primary bg-primary/10 p-3 text-left ring-2 ring-primary/30 transition'
                : 'rounded-lg border p-3 text-left transition hover:border-primary/50 hover:bg-primary/5'
            }
          >
            <p className="text-xs text-muted-foreground">Retificados</p>
            <p className="text-xl font-semibold">{resumoFiltrado.retificados}</p>
            <p className="text-[10px] text-muted-foreground">clique para filtrar</p>
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OP vinculada</TableHead><TableHead>Data / horário</TableHead><TableHead>Projeto / Etapa</TableHead><TableHead>Atividade</TableHead><TableHead>Equipe</TableHead><TableHead>Quantidade</TableHead><TableHead>Fotos</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="h-28 text-center">Carregando...</TableCell></TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-28 text-center text-muted-foreground">Nenhum apontamento encontrado.</TableCell></TableRow>
              ) : filtrados.map((apontamento) => {
                const processo = apontamento.processo_id ? processosPorId[apontamento.processo_id] : null;
                const ordem = apontamento.ordem_producao_id ? ordensPorId[apontamento.ordem_producao_id] : null;
                const localId = apontamento.projeto_local_id ?? processo?.projeto?.local_utilizacao_id ?? null;
                const projetoAvulso = localId ? projetosPorLocal[localId] : null;
                const equipe = membrosPorApontamento[apontamento.id] ?? [];
                const anexos = anexosPorApontamento[apontamento.id] ?? [];
                const quantidade = apontamento.quantidade_produzida == null ? null : Number(apontamento.quantidade_produzida);
                const retificado = Number((apontamento as any).retificacoes_count || 0) > 0;
                const explicacaoQuantidade = apontamento.status === 'conferido' ? 'Contabilizada' : apontamento.status === 'cancelado' ? 'Não contabilizada' : 'Aguardando conferência';
                return (
                  <TableRow key={apontamento.id} className={apontamento.fechamento_retroativo ? 'bg-amber-500/5' : undefined}>
                    <TableCell>
                      {ordem ? <>
                        <span className="font-medium">{formatarIdentificacaoOrdemProducao(ordem)}</span>
                        <div className="text-xs text-muted-foreground">{ordem.percentual_realizado}% da OP</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {apontamento.fechamento_retroativo && <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700"><AlertTriangle className="mr-1 h-3 w-3" />Retroativo</Badge>}
                          {retificado && <Badge variant="outline"><Pencil className="mr-1 h-3 w-3" />Retificado</Badge>}
                        </div>
                      </> : <Badge variant="outline">Avulso</Badge>}
                    </TableCell>
                    <TableCell>
                      {new Date(`${apontamento.data}T12:00:00`).toLocaleDateString('pt-BR')}
                      <div className="text-xs text-muted-foreground">{apontamento.inicio.slice(0, 5)}–{apontamento.termino.slice(0, 5)}</div>
                    </TableCell>
                    <TableCell>{ordem?.projeto_nome ?? projetoAvulso?.nome ?? (localId ? locaisPorId[localId] : '—')}<div className="text-xs text-muted-foreground">{ordem ? `${ordem.processo_codigo} · ${ordem.processo_nome}` : 'Atividade não planejada'}</div></TableCell>
                    <TableCell>{tarefasPorId[apontamento.tarefa_id] ?? '—'}</TableCell>
                    <TableCell>{equipe.map((m) => m.nome_snapshot).join(', ') || '—'}</TableCell>
                    <TableCell><span className={apontamento.status === 'conferido' ? 'font-semibold text-emerald-500' : apontamento.status === 'cancelado' ? 'text-muted-foreground line-through' : 'font-medium text-amber-500'}>{quantidade == null ? '—' : formatarQuantidade(quantidade)}</span><div className="text-xs text-muted-foreground">{explicacaoQuantidade}</div></TableCell>
                    <TableCell>{anexos.length > 0 ? <Button type="button" variant="link" className="h-auto p-0" onClick={() => setGaleria(apontamento)}><ImageIcon className="mr-1 h-4 w-4" />{anexos.length}</Button> : '—'}</TableCell>
                    <TableCell><Badge variant="outline">{statusLabel[apontamento.status]}</Badge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {ordem && <Button size="icon" variant="ghost" title={`Imprimir ${formatarIdentificacaoOrdemProducao(ordem)}`} disabled={imprimindoId === ordem.id} onClick={() => void imprimir(ordem.id)}>{imprimindoId === ordem.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}</Button>}
                        {podeConferir && apontamento.status === 'lancado' && <Button size="icon" variant="ghost" title="Conferir" onClick={() => void conferir(apontamento)}><CheckCircle2 className="h-4 w-4 text-emerald-500" /></Button>}
                        {apontamento.status === 'lancado' && <Button size="icon" variant="ghost" title="Cancelar" onClick={() => void cancelar(apontamento)}><XCircle className="h-4 w-4 text-red-500" /></Button>}
                        {podeExcluir && <Button size="icon" variant="ghost" title="Excluir apontamento" disabled={excluindoId === apontamento.id} onClick={() => setApontamentoParaExcluir(apontamento)}>{excluindoId === apontamento.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}</Button>}
                        <Button size="icon" variant="ghost" title="Detalhes" onClick={() => setDetalhes(apontamento)}><Eye className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={Boolean(apontamentoParaExcluir)} onOpenChange={(open) => { if (!open && !excluindoId) setApontamentoParaExcluir(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Excluir apontamento?</DialogTitle><DialogDescription>Esta ação remove permanentemente o registro e recalcula o progresso da OP.</DialogDescription></DialogHeader>
          {apontamentoParaExcluir && <div className="rounded-lg border bg-muted/20 p-4 text-sm"><p><strong>Atividade:</strong> {tarefasPorId[apontamentoParaExcluir.tarefa_id] ?? 'Não identificada'}</p><p><strong>Data:</strong> {new Date(`${apontamentoParaExcluir.data}T12:00:00`).toLocaleDateString('pt-BR')}</p><p><strong>OP:</strong> {ordemDaExclusao ? formatarNumeroOrdemProducao(ordemDaExclusao.numero) : 'Avulso'}</p></div>}
          <DialogFooter><Button type="button" variant="outline" disabled={Boolean(excluindoId)} onClick={() => setApontamentoParaExcluir(null)}>Cancelar</Button><Button type="button" variant="destructive" disabled={Boolean(excluindoId)} onClick={() => void excluir()}>{excluindoId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir apontamento</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(galeria)} onOpenChange={(open) => { if (!open) { setGaleria(null); setUrls({}); } }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>Fotos do apontamento</DialogTitle><DialogDescription>Evidências fotográficas deste registro.</DialogDescription></DialogHeader>
          {galeria && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(anexosPorApontamento[galeria.id] ?? []).map((anexo) => <div key={anexo.id} className="rounded-lg border p-3"><div className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-md bg-muted/20">{urls[anexo.id] ? <img src={urls[anexo.id]} alt={anexo.file_name} className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}</div><p className="truncate text-sm font-medium">{anexo.file_name}</p></div>)}</div>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detalhes)} onOpenChange={(open) => !open && setDetalhes(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Rastreabilidade do apontamento</DialogTitle><DialogDescription>Dados e ocorrências deste registro específico.</DialogDescription></DialogHeader>
          {detalhes && <div className="grid gap-3 sm:grid-cols-2">
            {Number((detalhes as any).retificacoes_count || 0) > 0 && <div className="sm:col-span-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"><div className="flex items-center gap-2 font-semibold text-amber-700"><Pencil className="h-4 w-4" />Apontamento retificado</div><div className="mt-2 text-sm"><p><strong>Última retificação:</strong> {(detalhes as any).retificado_em ? new Date((detalhes as any).retificado_em).toLocaleString('pt-BR') : '—'}</p><p><strong>Por:</strong> {(detalhes as any).retificado_por_nome_snapshot ?? 'Não identificado'}</p><p><strong>Motivo:</strong> {(detalhes as any).motivo_ultima_retificacao ?? 'Não informado'}</p><p><strong>Total de retificações:</strong> {Number((detalhes as any).retificacoes_count || 0)}</p></div></div>}
            {detalhes.fechamento_retroativo && <div className="sm:col-span-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"><div className="flex items-center gap-2 font-semibold text-amber-700"><AlertTriangle className="h-4 w-4" />Fechamento retroativo</div><p className="mt-2 text-sm"><strong>Motivo:</strong> {detalhes.motivo_regularizacao ?? 'Não informado'}</p></div>}
            <p><strong>OP:</strong> {detalhes.ordem_producao_id ? formatarNumeroOrdemProducao(ordensPorId[detalhes.ordem_producao_id]?.numero) : 'Avulso'}</p>
            <p><strong>Status:</strong> {statusLabel[detalhes.status]}</p>
            <p><strong>Data:</strong> {new Date(`${detalhes.data}T12:00:00`).toLocaleDateString('pt-BR')}</p>
            <p><strong>Horário:</strong> {detalhes.inicio.slice(0, 5)}–{detalhes.termino.slice(0, 5)}</p>
            <p><strong>Quantidade:</strong> {detalhes.quantidade_produzida ?? '—'}</p>
            <p><strong>Tempos:</strong> {detalhes.minutos_produtivos} min produtivos / {detalhes.minutos_improdutivos} min improdutivos</p>
            <p><strong>Criado por:</strong> {detalhes.criado_por_nome_snapshot ?? 'Não identificado'}</p>
            <p><strong>Última edição:</strong> {detalhes.ultima_edicao_por_nome_snapshot ?? 'Sem edição'}</p>
            {detalhes.observacoes && <p className="sm:col-span-2"><strong>Observações:</strong> {detalhes.observacoes}</p>}
          </div>}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
