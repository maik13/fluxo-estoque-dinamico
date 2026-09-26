import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, ArrowUpCircle, ArrowDownCircle, Calendar as CalendarIcon, Package, RotateCcw, FileSpreadsheet, Pencil, Printer, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface MovimentacaoServidor {
  id: string;
  itemId: string;
  tipo: 'ENTRADA' | 'SAIDA' | 'CADASTRO';
  quantidade: number;
  quantidadeAnterior: number;
  quantidadeAtual: number;
  userId?: string;
  responsavelNome?: string;
  observacoes?: string;
  dataHora: string;
  localUtilizacaoId?: string;
  localUtilizacaoNome?: string;
  solicitacaoId?: string;
  solicitanteNome?: string;
  solicitacaoTipoOperacao?: string;
  destinatario?: string;
  estoqueId?: string;
  tipoOperacaoId?: string;
  tipoOperacaoNome?: string;
  itemSnapshot: any;
  ehDevolucao?: boolean;
  ehEntradaAcerto?: boolean;
  ehSaidaAcerto?: boolean;
}

type FiltroTipo = 'todas' | 'ENTRADA' | 'ENTRADA_ACERTO' | 'SAIDA' | 'SAIDA_ACERTO' | 'DEVOLUCAO' | 'CADASTRO';
type Visualizacao = 'todas' | 'saidas' | 'devolucoes' | 'pendentes';

const TAMANHOS_PAGINA = [20, 50, 100, 200];

export const TabelaMovimentacoes = () => {
  const { user } = useAuth();
  const { canEditMovements } = usePermissions();
  const {
    estoqueAtivo,
    estoques,
    categorias: categoriasConfig,
    tiposOperacao,
    locaisUtilizacao,
  } = useConfiguracoes();

  const [rows, setRows] = useState<MovimentacaoServidor[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);
  const [totalFiltrado, setTotalFiltrado] = useState(0);
  const [stats, setStats] = useState({ total: 0, hoje: 0, entradas: 0, saidas: 0, devolucoes: 0 });

  const [filtroTexto, setFiltroTexto] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todas');
  const [tipoVisualizacao, setTipoVisualizacao] = useState<Visualizacao>('todas');
  const [filtroOperacao, setFiltroOperacao] = useState('todas');
  const [filtroDestino, setFiltroDestino] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  const [movimentoEditando, setMovimentoEditando] = useState<MovimentacaoServidor | null>(null);
  const [novoLocalId, setNovoLocalId] = useState('');
  const [novaQuantidade, setNovaQuantidade] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const refreshTimerRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);

  // Evita usar funções inline de useConfiguracoes como dependências da carga:
  // elas mudam de identidade a cada render e podem disparar um loop de RPCs.
  const estoqueAtivoInfo = useMemo(
    () => estoques.find((e) => e.id === estoqueAtivo),
    [estoques, estoqueAtivo],
  );

  const estoqueAtivoPrincipal = useMemo(() => {
    const principal = estoques.find(
      (e) => e.nome.trim().toLocaleLowerCase('pt-BR') === 'almoxarifado principal',
    );
    return Boolean(principal?.id && principal.id === estoqueAtivo);
  }, [estoques, estoqueAtivo]);

  const categorias = useMemo(
    () => categoriasConfig
      .filter((categoria) => categoria.ativo)
      .map((categoria) => categoria.nome)
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [categoriasConfig],
  );

  const categoriaSelecionadaId = useMemo(() => {
    if (filtroCategoria === 'todas') return null;
    return categoriasConfig.find(
      (categoria) => categoria.ativo && categoria.nome === filtroCategoria,
    )?.id ?? null;
  }, [categoriasConfig, filtroCategoria]);

  useEffect(() => {
    const timer = window.setTimeout(() => setBuscaAplicada(filtroTexto.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [filtroTexto]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [buscaAplicada, filtroTipo, tipoVisualizacao, filtroOperacao, filtroDestino, filtroCategoria, filtroDataInicio, filtroDataFim, itensPorPagina, estoqueAtivo]);

  const montarParametros = useCallback((pagina: number, limite: number) => {
    const inicio = filtroDataInicio ? new Date(`${filtroDataInicio}T00:00:00-03:00`).toISOString() : null;
    const fim = filtroDataFim ? new Date(`${filtroDataFim}T23:59:59.999-03:00`).toISOString() : null;

    return {
      p_estoque_id: estoqueAtivoInfo?.id ?? null,
      p_incluir_sem_estoque: estoqueAtivoPrincipal,
      p_pagina: pagina,
      p_limite: limite,
      p_busca: buscaAplicada || null,
      p_tipo: filtroTipo === 'todas' ? null : filtroTipo,
      p_tipo_operacao_id: filtroOperacao === 'todas' ? null : filtroOperacao,
      p_visualizacao: tipoVisualizacao,
      p_local_utilizacao_id: filtroDestino === 'todos' ? null : filtroDestino,
      p_tipo_item: null,
      p_categoria_id: categoriaSelecionadaId,
      p_subcategoria_ids: null,
      p_data_inicio: inicio,
      p_data_fim: fim,
    };
  }, [estoqueAtivoInfo?.id, estoqueAtivoPrincipal, filtroDataInicio, filtroDataFim, buscaAplicada, filtroTipo, filtroOperacao, tipoVisualizacao, filtroDestino, categoriaSelecionadaId]);

  const carregarPagina = useCallback(async (silencioso = false) => {
    if (!estoqueAtivo) return;
    const requestId = ++requestSeqRef.current;
    if (!silencioso) setLoading(true);
    setErro(null);

    try {
      const { data, error } = await (supabase as any).rpc(
        'listar_movimentacoes_paginadas_v2',
        montarParametros(paginaAtual, itensPorPagina),
      );
      if (requestId !== requestSeqRef.current) return;
      if (error) throw error;

      const payload = data ?? {};
      const novosRows = Array.isArray(payload.rows) ? payload.rows : [];
      const novoTotal = Number(payload.totalFiltrado ?? 0);
      const totalPaginas = Math.max(1, Math.ceil(novoTotal / itensPorPagina));

      if (paginaAtual > totalPaginas) {
        setPaginaAtual(totalPaginas);
        return;
      }

      setRows(novosRows);
      setTotalFiltrado(novoTotal);
      setStats({
        total: Number(payload.stats?.total ?? 0),
        hoje: Number(payload.stats?.hoje ?? 0),
        entradas: Number(payload.stats?.entradas ?? 0),
        saidas: Number(payload.stats?.saidas ?? 0),
        devolucoes: Number(payload.stats?.devolucoes ?? 0),
      });
    } catch (e: any) {
      if (requestId !== requestSeqRef.current) return;
      console.error('Erro ao carregar movimentações paginadas:', e);
      setErro(e?.message || 'Não foi possível carregar as movimentações.');
      if (!silencioso) {
        toast({ title: 'Erro ao carregar dados', description: 'Não foi possível carregar as movimentações do servidor.', variant: 'destructive' });
      }
    } finally {
      if (requestId === requestSeqRef.current && !silencioso) setLoading(false);
    }
  }, [estoqueAtivo, paginaAtual, itensPorPagina, montarParametros]);

  useEffect(() => {
    void carregarPagina();
  }, [carregarPagina]);

  useEffect(() => {
    const reagendar = () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => void carregarPagina(true), 300);
    };

    const channel = supabase
      .channel('movimentacoes-paginadas-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, reagendar)
      .subscribe();

    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [carregarPagina]);


  // Revalida a página ao retornar para a aba. Isso evita manter na tela
  // saldos históricos antigos após uma correção administrativa no servidor.
  useEffect(() => {
    const recarregarAoRetomar = () => {
      if (document.visibilityState === 'visible') {
        void carregarPagina(true);
      }
    };

    window.addEventListener('focus', recarregarAoRetomar);
    document.addEventListener('visibilitychange', recarregarAoRetomar);

    return () => {
      window.removeEventListener('focus', recarregarAoRetomar);
      document.removeEventListener('visibilitychange', recarregarAoRetomar);
    };
  }, [carregarPagina]);

  const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / itensPorPagina));
  const inicioPagina = totalFiltrado === 0 ? 0 : (paginaAtual - 1) * itensPorPagina + 1;
  const fimPagina = Math.min(paginaAtual * itensPorPagina, totalFiltrado);

  const operacaoLabel = (mov: MovimentacaoServidor) => {
    if (mov.ehDevolucao) return 'Devolução';
    if (mov.tipoOperacaoNome) return mov.tipoOperacaoNome;
    if (mov.ehEntradaAcerto) return 'Entrada para acerto';
    if (mov.ehSaidaAcerto) return 'Saída para acerto';
    if (mov.tipo === 'ENTRADA') return 'Entrada';
    if (mov.tipo === 'SAIDA') return 'Saída';
    return 'Cadastro';
  };

  const operacaoClass = (mov: MovimentacaoServidor) => {
    const label = operacaoLabel(mov).toLocaleLowerCase('pt-BR');
    if (label.includes('descarte')) return 'text-red-600 bg-red-500/10';
    if (label.includes('acerto')) return 'text-orange-600 bg-orange-500/10';
    if (label.includes('devolu')) return 'text-blue-600 bg-blue-500/10';
    if (label.includes('entrada')) return 'text-green-600 bg-green-500/10';
    if (label.includes('epi')) return 'text-violet-600 bg-violet-500/10';
    return 'text-amber-600 bg-amber-500/10';
  };

  const formatarQuantidade = (mov: MovimentacaoServidor) => {
    if (mov.ehEntradaAcerto) return `=${Number(mov.quantidadeAtual).toLocaleString('pt-BR')}`;
    return `${mov.tipo === 'SAIDA' ? '-' : '+'}${Number(mov.quantidade).toLocaleString('pt-BR')}`;
  };

  const buscarTodosFiltrados = async () => {
    const primeira = await (supabase as any).rpc('listar_movimentacoes_paginadas_v2', montarParametros(1, 1000));
    if (primeira.error) throw primeira.error;
    const total = Number(primeira.data?.totalFiltrado ?? 0);
    const acumulado: MovimentacaoServidor[] = [...(primeira.data?.rows ?? [])];
    const paginas = Math.ceil(total / 1000);
    for (let p = 2; p <= paginas; p += 1) {
      const resp = await (supabase as any).rpc('listar_movimentacoes_paginadas_v1', montarParametros(p, 1000));
      if (resp.error) throw resp.error;
      acumulado.push(...(resp.data?.rows ?? []));
    }
    return acumulado;
  };

  const exportarParaExcel = async () => {
    try {
      const dados = await buscarTodosFiltrados();
      const linhas = dados.map((mov) => ({
        Operação: operacaoLabel(mov),
        Data: new Date(mov.dataHora).toLocaleDateString('pt-BR'),
        Hora: new Date(mov.dataHora).toLocaleTimeString('pt-BR'),
        Item: mov.itemSnapshot?.nome || 'Item não identificado',
        Código: mov.itemSnapshot?.codigoBarras ?? mov.itemSnapshot?.codigo_barras ?? '',
        Quantidade: formatarQuantidade(mov),
        Unidade: mov.itemSnapshot?.unidade || '',
        Anterior: mov.quantidadeAnterior,
        Atual: mov.quantidadeAtual,
        Solicitante: mov.solicitanteNome || '-',
        Responsável: mov.responsavelNome || '-',
        Destinatário: mov.destinatario || '-',
        'Estoque/Destino': mov.localUtilizacaoNome || '-',
        Observações: mov.observacoes || '-',
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(linhas);
      XLSX.utils.book_append_sheet(wb, ws, 'Movimentações');
      XLSX.writeFile(wb, `movimentacoes-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast({ title: 'Exportação concluída', description: `${dados.length} movimentações exportadas.` });
    } catch (e: any) {
      toast({ title: 'Erro na exportação', description: e?.message || 'Não foi possível exportar.', variant: 'destructive' });
    }
  };

  const imprimirMovimentacoes = async () => {
    try {
      const dados = await buscarTodosFiltrados();
      const w = window.open('', '_blank');
      if (!w) throw new Error('Pop-up bloqueado pelo navegador.');
      const linhas = dados.map((mov) => `<tr>
        <td>${operacaoLabel(mov)}</td><td>${new Date(mov.dataHora).toLocaleString('pt-BR')}</td>
        <td>${mov.itemSnapshot?.nome || '-'}</td><td>${mov.itemSnapshot?.codigoBarras ?? '-'}</td>
        <td>${formatarQuantidade(mov)} ${mov.itemSnapshot?.unidade || ''}</td><td>${mov.responsavelNome || '-'}</td>
        <td>${mov.destinatario || '-'}</td><td>${mov.localUtilizacaoNome || '-'}</td>
      </tr>`).join('');
      w.document.write(`<!doctype html><html><head><title>Movimentações</title><style>body{font-family:Arial;font-size:11px;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px}th{background:#eee;text-align:left}</style></head><body><h2>Relatório de Movimentações</h2><p>${dados.length} registros | Gerado em ${new Date().toLocaleString('pt-BR')}</p><table><thead><tr><th>Operação</th><th>Data/Hora</th><th>Item</th><th>Código</th><th>Quantidade</th><th>Responsável</th><th>Destinatário</th><th>Estoque/Destino</th></tr></thead><tbody>${linhas}</tbody></table><script>window.print();window.onafterprint=()=>window.close();</script></body></html>`);
      w.document.close();
    } catch (e: any) {
      toast({ title: 'Erro ao imprimir', description: e?.message || 'Não foi possível gerar a impressão.', variant: 'destructive' });
    }
  };

  const salvarEdicao = async () => {
    if (!movimentoEditando) return;
    const qtd = Number(novaQuantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      toast({ title: 'Quantidade inválida', variant: 'destructive' });
      return;
    }
    setSalvandoEdicao(true);
    try {
      const { error } = await supabase.from('movements').update({
        quantidade: qtd,
        local_utilizacao_id: novoLocalId || null,
      }).eq('id', movimentoEditando.id);
      if (error) throw error;
      await (supabase as any).from('action_logs').insert({
        user_id: user?.id,
        action: 'EDICAO_MOVIMENTACAO',
        entity_type: 'movements',
        entity_id: movimentoEditando.id,
        details: { antiga_quantidade: movimentoEditando.quantidade, nova_quantidade: qtd, antigo_local_id: movimentoEditando.localUtilizacaoId, novo_local_id: novoLocalId || null, item_nome: movimentoEditando.itemSnapshot?.nome },
      });
      setMovimentoEditando(null);
      await carregarPagina(true);
      toast({ title: 'Movimentação atualizada' });
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar', description: e?.message || 'Não foi possível atualizar.', variant: 'destructive' });
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const excluirMovimentacao = async (id: string) => {
    try {
      const { error } = await supabase.from('movements').delete().eq('id', id);
      if (error) throw error;
      await carregarPagina(true);
      toast({ title: 'Movimentação excluída' });
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e?.message || 'Não foi possível excluir.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={tipoVisualizacao} onValueChange={(v) => setTipoVisualizacao(v as Visualizacao)}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="todas"><Package className="h-4 w-4 mr-2" />Todas</TabsTrigger>
          <TabsTrigger value="saidas"><ArrowDownCircle className="h-4 w-4 mr-2" />Saídas</TabsTrigger>
          <TabsTrigger value="devolucoes"><RotateCcw className="h-4 w-4 mr-2" />Devoluções</TabsTrigger>
          <TabsTrigger value="pendentes"><AlertTriangle className="h-4 w-4 mr-2" />Pendentes</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          ['Total', stats.total, <Package className="h-8 w-8 text-muted-foreground" key="a" />],
          ['Hoje', stats.hoje, <CalendarIcon className="h-8 w-8 text-primary" key="b" />],
          ['Entradas', stats.entradas, <ArrowUpCircle className="h-8 w-8 text-success" key="c" />],
          ['Saídas', stats.saidas, <ArrowDownCircle className="h-8 w-8 text-warning" key="d" />],
          ['Devoluções', stats.devolucoes, <RotateCcw className="h-8 w-8 text-info" key="e" />],
        ].map(([label, valor, icon]) => (
          <Card key={String(label)}><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{valor}</p></div>{icon}</CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Filtros de Movimentação</CardTitle><CardDescription>Os filtros são processados no servidor; somente a página solicitada é carregada.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input placeholder="Buscar por item, código, responsável..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} />
            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as FiltroTipo)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="todas">Todos os tipos</SelectItem><SelectItem value="ENTRADA">Entrada</SelectItem><SelectItem value="ENTRADA_ACERTO">Entrada para acerto</SelectItem><SelectItem value="SAIDA">Saída</SelectItem><SelectItem value="SAIDA_ACERTO">Saída para acerto</SelectItem><SelectItem value="DEVOLUCAO">Devolução</SelectItem><SelectItem value="CADASTRO">Cadastro</SelectItem>
            </SelectContent></Select>
            <Select value={filtroOperacao} onValueChange={setFiltroOperacao}><SelectTrigger><SelectValue placeholder="Operação" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as operações</SelectItem>{tiposOperacao.filter((x) => x.ativo).map((op) => <SelectItem key={op.id} value={op.id}>{op.nome}</SelectItem>)}</SelectContent></Select>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as categorias</SelectItem>{categorias.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select>
            <Select value={filtroDestino} onValueChange={setFiltroDestino}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os estoques/destinos</SelectItem>{locaisUtilizacao.filter((l) => l.ativo).map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
            <Input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
            <Button variant="outline" onClick={exportarParaExcel}><FileSpreadsheet className="h-4 w-4 mr-2" />Exportar Excel</Button>
            <Button variant="outline" onClick={imprimirMovimentacoes}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><CardTitle>📋 Histórico de Movimentações</CardTitle><CardDescription>Mostrando {inicioPagina}–{fimPagina} de {totalFiltrado.toLocaleString('pt-BR')} registros filtrados</CardDescription></div><div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Registros por página:</span><Select value={String(itensPorPagina)} onValueChange={(v) => setItensPorPagina(Number(v))}><SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger><SelectContent>{TAMANHOS_PAGINA.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></div></div></CardHeader>
        <CardContent>
          {erro && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</div>}
          <div className="w-full overflow-x-auto">
            <Table style={{ minWidth: canEditMovements() ? '1650px' : '1550px' }}>
              <TableHeader><TableRow>{canEditMovements() && <TableHead>Ações</TableHead>}<TableHead>Operação</TableHead><TableHead>Data/Hora</TableHead><TableHead>Item</TableHead><TableHead>Código</TableHead><TableHead>Quantidade</TableHead><TableHead>Anterior</TableHead><TableHead>Atual</TableHead><TableHead>Solicitante</TableHead><TableHead>Responsável</TableHead><TableHead>Destinatário</TableHead><TableHead>Estoque/Destino</TableHead><TableHead>Observações</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={canEditMovements() ? 13 : 12} className="h-40 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Carregando página...</TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={canEditMovements() ? 14 : 13} className="h-40 text-center text-muted-foreground">Nenhuma movimentação encontrada.</TableCell></TableRow> : rows.map((mov) => (
                  <TableRow key={mov.id}>
                    {canEditMovements() && <TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => { setMovimentoEditando(mov); setNovoLocalId(mov.localUtilizacaoId || ''); setNovaQuantidade(String(mov.quantidade)); }}><Pencil className="h-4 w-4" /></Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir movimentação?</AlertDialogTitle><AlertDialogDescription>O registro de {operacaoLabel(mov)} do item “{mov.itemSnapshot?.nome || 'item'}” será removido.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => excluirMovimentacao(mov.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></TableCell>}
                    <TableCell><Badge variant="outline" className={operacaoClass(mov)}>{operacaoLabel(mov)}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(mov.dataHora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}</TableCell>
                    <TableCell><div className="font-medium">{mov.itemSnapshot?.nome || 'Item não identificado'}</div>{mov.itemSnapshot?.marca && <div className="text-xs text-muted-foreground">{mov.itemSnapshot.marca}</div>}</TableCell>
                    <TableCell className="font-mono">{mov.itemSnapshot?.codigoBarras ?? mov.itemSnapshot?.codigo_barras ?? '-'}</TableCell>
                    <TableCell className="font-bold">{formatarQuantidade(mov)} <span className="text-xs font-normal text-muted-foreground">{mov.itemSnapshot?.unidade || ''}</span></TableCell>
                    <TableCell className="text-right">{Number(mov.quantidadeAnterior).toLocaleString('pt-BR')}</TableCell><TableCell className="text-right font-bold">{Number(mov.quantidadeAtual).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{mov.solicitanteNome || '-'}</TableCell><TableCell>{mov.responsavelNome || '-'}</TableCell><TableCell>{mov.destinatario || '-'}</TableCell><TableCell>{mov.localUtilizacaoNome || '-'}</TableCell><TableCell className="max-w-[260px] truncate" title={mov.observacoes || ''}>{mov.observacoes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPaginas > 1 && <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Página {paginaAtual} de {totalPaginas.toLocaleString('pt-BR')}</p><Pagination><PaginationContent><PaginationItem><PaginationPrevious onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))} className={paginaAtual === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} /></PaginationItem>{Array.from({ length: totalPaginas }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPaginas || Math.abs(p - paginaAtual) <= 1).map((p, idx, arr) => { const anterior = arr[idx - 1]; return <span key={p} className="contents">{anterior && p - anterior > 1 && <PaginationItem><span className="px-2">...</span></PaginationItem>}<PaginationItem><PaginationLink isActive={p === paginaAtual} onClick={() => setPaginaAtual(p)} className="cursor-pointer">{p}</PaginationLink></PaginationItem></span>; })}<PaginationItem><PaginationNext onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))} className={paginaAtual === totalPaginas ? 'pointer-events-none opacity-50' : 'cursor-pointer'} /></PaginationItem></PaginationContent></Pagination></div>}
        </CardContent>
      </Card>

      <Dialog open={!!movimentoEditando} onOpenChange={(open) => !open && setMovimentoEditando(null)}><DialogContent><DialogHeader><DialogTitle>Editar Movimentação</DialogTitle><DialogDescription>Altere quantidade ou destino de “{movimentoEditando?.itemSnapshot?.nome}”.</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div><label className="text-sm font-medium">Quantidade</label><Input type="number" min="0.01" step="0.01" value={novaQuantidade} onChange={(e) => setNovaQuantidade(e.target.value)} /></div><div><label className="text-sm font-medium">Novo Local de Destino</label><Select value={novoLocalId || 'sem-local'} onValueChange={(v) => setNovoLocalId(v === 'sem-local' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sem-local">Nenhum</SelectItem>{locaisUtilizacao.filter((l) => l.ativo).map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setMovimentoEditando(null)}>Cancelar</Button><Button onClick={salvarEdicao} disabled={salvandoEdicao}>{salvandoEdicao ? 'Salvando...' : 'Salvar Alteração'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
};
