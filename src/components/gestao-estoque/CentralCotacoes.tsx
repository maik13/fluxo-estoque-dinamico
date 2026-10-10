/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Upload,
  Plus,
  Search,
  Truck,
  Package,
  Globe2,
  Eye,
  Pencil,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ArrowRightLeft,
  X,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

type CotacaoTipo = 'insumo' | 'frete' | 'global';

type Cotacao = {
  id: string;
  numero: number;
  tipo: CotacaoTipo;
  status: string;
  origem_cadastro: 'manual' | 'pdf';
  fornecedor_nome: string | null;
  fornecedor_cnpj: string | null;
  fornecedor_endereco: string | null;
  fornecedor_contato: string | null;
  numero_proposta: string | null;
  data_cotacao: string | null;
  validade_data: string | null;
  validade_dias: number | null;
  condicao_pagamento: string | null;
  descricao: string | null;
  projeto_centro_custo: string | null;
  valor_subtotal: number | null;
  valor_frete: number | null;
  valor_impostos: number | null;
  valor_desconto: number | null;
  valor_total: number | null;
  origem_frete: string | null;
  destino_frete: string | null;
  peso_kg: number | null;
  cubagem_m3: number | null;
  volumes: number | null;
  tipo_veiculo: string | null;
  prazo_dias: number | null;
  arquivo_nome: string | null;
  arquivo_path: string | null;
  arquivo_mime: string | null;
  leitura_status: string;
  leitura_erro: string | null;
  financeiro_necessidade_id: string | null;
  solicitacao_id: string | null;
  created_at: string;
};

type CotacaoItem = {
  id?: string;
  item_id?: string | null;
  codigo_item?: string | null;
  descricao: string;
  marca?: string | null;
  especificacao?: string | null;
  quantidade?: number | null;
  unidade?: string | null;
  valor_unitario?: number | null;
  valor_total?: number | null;
};

type Solicitacao = {
  id: string;
  numero: number;
  titulo: string;
  tipo: CotacaoTipo;
  status: string;
  projeto_centro_custo: string | null;
  data_limite: string | null;
  fornecedores_solicitados: string | null;
  observacoes: string | null;
  created_at: string;
};

const tipoLabels: Record<CotacaoTipo, string> = {
  insumo: 'Insumo',
  frete: 'Frete',
  global: 'Orçamento global',
};

const statusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  em_validacao: 'Em validação',
  confirmada: 'Confirmada',
  escolhida: 'Escolhida',
  rejeitada: 'Rejeitada',
  convertida_pn: 'Convertida em PN',
};

const solicitacaoStatusLabels: Record<string, string> = {
  aguardando_propostas: 'Aguardando propostas',
  em_analise: 'Em análise',
  escolhida: 'Escolhida',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
};

const moeda = (value?: number | null) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

const dataPt = (value?: string | null) => {
  if (!value) return '—';
  const date = value.slice(0, 10).split('-');
  return date.length === 3 ? `${date[2]}/${date[1]}/${date[0]}` : value;
};

const toInput = (value?: number | null) => (value === null || value === undefined ? '' : String(value).replace('.', ','));
const fromInput = (value: string) => {
  if (!value.trim()) return null;
  const n = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const emptyForm = {
  tipo: 'insumo' as CotacaoTipo,
  fornecedor_nome: '',
  fornecedor_cnpj: '',
  fornecedor_endereco: '',
  fornecedor_contato: '',
  numero_proposta: '',
  data_cotacao: new Date().toISOString().slice(0, 10),
  validade_data: '',
  validade_dias: '',
  condicao_pagamento: '',
  descricao: '',
  projeto_centro_custo: '',
  valor_subtotal: '',
  valor_frete: '',
  valor_impostos: '',
  valor_desconto: '',
  valor_total: '',
  origem_frete: '',
  destino_frete: '',
  peso_kg: '',
  cubagem_m3: '',
  volumes: '',
  tipo_veiculo: '',
  prazo_dias: '',
  solicitacao_id: '',
};

export function CentralCotacoes() {
  const { user } = useAuth();
  const { userProfile } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | CotacaoTipo>('todos');
  const [periodoDias, setPeriodoDias] = useState('365');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorCotacao, setEditorCotacao] = useState<Cotacao | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [itens, setItens] = useState<CotacaoItem[]>([]);

  const [solicitacaoOpen, setSolicitacaoOpen] = useState(false);
  const [solicitacaoForm, setSolicitacaoForm] = useState({
    titulo: '',
    tipo: 'insumo' as CotacaoTipo,
    projeto_centro_custo: '',
    data_limite: '',
    fornecedores_solicitados: '',
    observacoes: '',
  });

  const carregar = async () => {
    setLoading(true);
    try {
      const [{ data: cotacoesData, error: cotacoesError }, { data: solicitacoesData, error: solicitacoesError }] =
        await Promise.all([
          (supabase.from as any)('cotacoes').select('*').order('created_at', { ascending: false }),
          (supabase.from as any)('cotacao_solicitacoes').select('*').order('created_at', { ascending: false }),
        ]);

      if (cotacoesError) throw cotacoesError;
      if (solicitacoesError) throw solicitacoesError;

      setCotacoes((cotacoesData || []) as Cotacao[]);
      setSolicitacoes((solicitacoesData || []) as Solicitacao[]);
    } catch (error: any) {
      console.error(error);
      toast.error('Não foi possível carregar a Central de Cotações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const abrirManual = () => {
    setEditorCotacao(null);
    setForm({ ...emptyForm });
    setItens([]);
    setEditorOpen(true);
  };

  const abrirEdicao = async (cotacao: Cotacao) => {
    setEditorCotacao(cotacao);
    setForm({
      tipo: cotacao.tipo,
      fornecedor_nome: cotacao.fornecedor_nome || '',
      fornecedor_cnpj: cotacao.fornecedor_cnpj || '',
      fornecedor_endereco: cotacao.fornecedor_endereco || '',
      fornecedor_contato: cotacao.fornecedor_contato || '',
      numero_proposta: cotacao.numero_proposta || '',
      data_cotacao: cotacao.data_cotacao || '',
      validade_data: cotacao.validade_data || '',
      validade_dias: cotacao.validade_dias ? String(cotacao.validade_dias) : '',
      condicao_pagamento: cotacao.condicao_pagamento || '',
      descricao: cotacao.descricao || '',
      projeto_centro_custo: cotacao.projeto_centro_custo || '',
      valor_subtotal: toInput(cotacao.valor_subtotal),
      valor_frete: toInput(cotacao.valor_frete),
      valor_impostos: toInput(cotacao.valor_impostos),
      valor_desconto: toInput(cotacao.valor_desconto),
      valor_total: toInput(cotacao.valor_total),
      origem_frete: cotacao.origem_frete || '',
      destino_frete: cotacao.destino_frete || '',
      peso_kg: toInput(cotacao.peso_kg),
      cubagem_m3: toInput(cotacao.cubagem_m3),
      volumes: cotacao.volumes ? String(cotacao.volumes) : '',
      tipo_veiculo: cotacao.tipo_veiculo || '',
      prazo_dias: cotacao.prazo_dias ? String(cotacao.prazo_dias) : '',
      solicitacao_id: cotacao.solicitacao_id || '',
    });

    const { data, error } = await (supabase.from as any)('cotacao_itens')
      .select('*')
      .eq('cotacao_id', cotacao.id)
      .order('ordem');

    if (error) {
      console.error(error);
      toast.error('Não foi possível carregar os itens da cotação.');
      setItens([]);
    } else {
      setItens((data || []) as CotacaoItem[]);
    }
    setEditorOpen(true);
  };

  const salvarCotacao = async (confirmar = false) => {
    if (!form.fornecedor_nome.trim() && !form.descricao.trim()) {
      toast.error('Informe ao menos o fornecedor ou a descrição da cotação.');
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        tipo: form.tipo,
        fornecedor_nome: form.fornecedor_nome.trim() || null,
        fornecedor_cnpj: form.fornecedor_cnpj.trim() || null,
        fornecedor_endereco: form.fornecedor_endereco.trim() || null,
        fornecedor_contato: form.fornecedor_contato.trim() || null,
        numero_proposta: form.numero_proposta.trim() || null,
        data_cotacao: form.data_cotacao || null,
        validade_data: form.validade_data || null,
        validade_dias: form.validade_dias ? Number(form.validade_dias) : null,
        condicao_pagamento: form.condicao_pagamento.trim() || null,
        descricao: form.descricao.trim() || null,
        projeto_centro_custo: form.projeto_centro_custo.trim() || null,
        valor_subtotal: fromInput(form.valor_subtotal),
        valor_frete: fromInput(form.valor_frete),
        valor_impostos: fromInput(form.valor_impostos),
        valor_desconto: fromInput(form.valor_desconto),
        valor_total: fromInput(form.valor_total),
        origem_frete: form.origem_frete.trim() || null,
        destino_frete: form.destino_frete.trim() || null,
        peso_kg: fromInput(form.peso_kg),
        cubagem_m3: fromInput(form.cubagem_m3),
        volumes: form.volumes ? Number(form.volumes) : null,
        tipo_veiculo: form.tipo_veiculo.trim() || null,
        prazo_dias: form.prazo_dias ? Number(form.prazo_dias) : null,
        solicitacao_id: form.solicitacao_id || null,
        status: confirmar ? 'confirmada' : (editorCotacao?.status || 'rascunho'),
        origem_cadastro: editorCotacao?.origem_cadastro || 'manual',
        criado_por: editorCotacao ? undefined : user?.id,
        criado_por_nome: editorCotacao ? undefined : (userProfile?.nome || user?.email || 'Usuário'),
        confirmado_por: confirmar ? user?.id : undefined,
        confirmado_em: confirmar ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      };

      let cotacaoId = editorCotacao?.id;

      if (editorCotacao) {
        const { error } = await (supabase.from as any)('cotacoes').update(payload).eq('id', editorCotacao.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase.from as any)('cotacoes')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        cotacaoId = data.id;
      }

      if (!cotacaoId) throw new Error('Cotação sem ID');

      await (supabase.from as any)('cotacao_itens').delete().eq('cotacao_id', cotacaoId);

      const validItems = itens.filter((item) => item.descricao.trim());
      if (validItems.length > 0) {
        const rows = validItems.map((item, index) => ({
          cotacao_id: cotacaoId,
          item_id: item.item_id || null,
          codigo_item: item.codigo_item || null,
          descricao: item.descricao.trim(),
          marca: item.marca || null,
          especificacao: item.especificacao || null,
          quantidade: item.quantidade ?? null,
          unidade: item.unidade || null,
          valor_unitario: item.valor_unitario ?? null,
          valor_total: item.valor_total ?? null,
          ordem: index,
        }));
        const { error } = await (supabase.from as any)('cotacao_itens').insert(rows);
        if (error) throw error;
      }

      toast.success(confirmar ? 'Cotação confirmada e disponível para consulta.' : 'Cotação salva.');
      setEditorOpen(false);
      await carregar();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível salvar a cotação.');
    } finally {
      setSalvando(false);
    }
  };

  const importarPdf = async (file?: File) => {
    if (!file || !user?.id) return;
    if (file.type !== 'application/pdf') {
      toast.error('Selecione um arquivo PDF.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('O PDF deve ter no máximo 20 MB.');
      return;
    }

    setImportando(true);
    try {
      const { data: created, error: createError } = await (supabase.from as any)('cotacoes')
        .insert({
          tipo: 'global',
          status: 'em_validacao',
          origem_cadastro: 'pdf',
          leitura_status: 'pendente',
          arquivo_nome: file.name,
          arquivo_mime: file.type,
          criado_por: user.id,
          criado_por_nome: userProfile?.nome || user.email || 'Usuário',
        })
        .select('*')
        .single();

      if (createError) throw createError;

      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
      const path = `${user.id}/${created.id}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('cotacoes-documentos')
        .upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;

      const { error: updateError } = await (supabase.from as any)('cotacoes')
        .update({ arquivo_path: path, leitura_status: 'processando' })
        .eq('id', created.id);
      if (updateError) throw updateError;

      const { error: fnError } = await supabase.functions.invoke('cotacoes-ler-pdf', {
        body: { cotacao_id: created.id },
      });
      if (fnError) throw fnError;

      const { data: refreshed, error: refreshError } = await (supabase.from as any)('cotacoes')
        .select('*')
        .eq('id', created.id)
        .single();
      if (refreshError) throw refreshError;

      await carregar();
      await abrirEdicao(refreshed as Cotacao);

      if (refreshed.leitura_status === 'sem_texto') {
        toast.warning('PDF sem camada de texto. Preencha os dados manualmente.');
      } else {
        toast.success('PDF lido. Confira os dados antes de confirmar.');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível importar o PDF.');
    } finally {
      setImportando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const abrirPdf = async (cotacao: Cotacao) => {
    if (!cotacao.arquivo_path) return;
    const { data, error } = await supabase.storage
      .from('cotacoes-documentos')
      .createSignedUrl(cotacao.arquivo_path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error('Não foi possível abrir o PDF.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const converterEmPn = async (cotacao: Cotacao) => {
    if (!confirm(`Converter a cotação #${cotacao.numero} em PN?`)) return;
    try {
      const { data, error } = await (supabase as any).rpc('cotacao_converter_em_pn_v1', {
        p_cotacao_id: cotacao.id,
      });
      if (error) throw error;
      toast.success('PN criada a partir da cotação.');
      await carregar();
      return data;
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível converter a cotação em PN.');
    }
  };

  const criarSolicitacao = async () => {
    if (!solicitacaoForm.titulo.trim()) {
      toast.error('Informe um título para a solicitação.');
      return;
    }
    setSalvando(true);
    try {
      const { error } = await (supabase.from as any)('cotacao_solicitacoes').insert({
        titulo: solicitacaoForm.titulo.trim(),
        tipo: solicitacaoForm.tipo,
        projeto_centro_custo: solicitacaoForm.projeto_centro_custo.trim() || null,
        data_limite: solicitacaoForm.data_limite || null,
        fornecedores_solicitados: solicitacaoForm.fornecedores_solicitados.trim() || null,
        observacoes: solicitacaoForm.observacoes.trim() || null,
        criado_por: user?.id,
        criado_por_nome: userProfile?.nome || user?.email || 'Usuário',
      });
      if (error) throw error;
      toast.success('Solicitação de cotação criada.');
      setSolicitacaoOpen(false);
      setSolicitacaoForm({
        titulo: '',
        tipo: 'insumo',
        projeto_centro_custo: '',
        data_limite: '',
        fornecedores_solicitados: '',
        observacoes: '',
      });
      await carregar();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível criar a solicitação.');
    } finally {
      setSalvando(false);
    }
  };

  const resultados = useMemo(() => {
    const term = busca.trim().toLocaleLowerCase('pt-BR');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(periodoDias));

    return cotacoes.filter((cotacao) => {
      if (tipoFiltro !== 'todos' && cotacao.tipo !== tipoFiltro) return false;
      if (new Date(cotacao.created_at) < cutoff) return false;
      if (!term) return true;
      return [
        cotacao.fornecedor_nome,
        cotacao.fornecedor_cnpj,
        cotacao.descricao,
        cotacao.origem_frete,
        cotacao.destino_frete,
        cotacao.projeto_centro_custo,
        cotacao.numero_proposta,
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase('pt-BR').includes(term));
    });
  }, [busca, cotacoes, tipoFiltro, periodoDias]);

  const kpis = useMemo(() => ({
    total: cotacoes.length,
    validacao: cotacoes.filter((c) => c.status === 'em_validacao').length,
    fretes: cotacoes.filter((c) => c.tipo === 'frete').length,
    pn: cotacoes.filter((c) => c.status === 'convertida_pn').length,
  }), [cotacoes]);

  const atualizarItem = (index: number, patch: Partial<CotacaoItem>) => {
    setItens((current) => current.map((item, idx) => idx === index ? { ...item, ...patch } : item));
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => void importarPdf(event.target.files?.[0])}
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Central de Cotações</h2>
          <p className="text-sm text-muted-foreground">
            PDFs, lançamentos manuais, solicitações e histórico pesquisável. Só entra no Financeiro quando virar PN.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importando}>
            {importando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importar PDF
          </Button>
          <Button variant="outline" onClick={abrirManual}>
            <Plus className="mr-2 h-4 w-4" /> Lançamento manual
          </Button>
          <Button onClick={() => setSolicitacaoOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova solicitação
          </Button>
          <Button variant="ghost" size="icon" onClick={() => void carregar()} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Cotações</CardDescription><CardTitle className="text-2xl">{kpis.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Em validação</CardDescription><CardTitle className="text-2xl">{kpis.validacao}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Fretes</CardDescription><CardTitle className="text-2xl">{kpis.fretes}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Convertidas em PN</CardDescription><CardTitle className="text-2xl">{kpis.pn}</CardTitle></CardHeader></Card>
      </div>

      <Tabs defaultValue="historico">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="historico">Consulta histórica</TabsTrigger>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Consulta histórica</CardTitle>
              <CardDescription>
                Pesquise por fornecedor, CNPJ, projeto, origem, destino, proposta ou descrição.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_190px_190px]">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: frete, Brusque, cinta 3,6x200, fornecedor..." className="pl-9" />
                </div>
                <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    <SelectItem value="insumo">Insumos</SelectItem>
                    <SelectItem value="frete">Fretes</SelectItem>
                    <SelectItem value="global">Globais</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={periodoDias} onValueChange={setPeriodoDias}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="365">Último ano</SelectItem>
                    <SelectItem value="3650">Todo histórico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Carregando cotações...
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Origem / descrição</TableHead>
                        <TableHead>Destino / projeto</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultados.map((cotacao) => (
                        <TableRow key={cotacao.id}>
                          <TableCell>{dataPt(cotacao.data_cotacao || cotacao.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {cotacao.tipo === 'frete' ? <Truck className="h-4 w-4" /> : cotacao.tipo === 'insumo' ? <Package className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
                              {tipoLabels[cotacao.tipo]}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{cotacao.fornecedor_nome || 'Não informado'}</div>
                            {cotacao.fornecedor_cnpj && <div className="text-xs text-muted-foreground">{cotacao.fornecedor_cnpj}</div>}
                          </TableCell>
                          <TableCell className="max-w-[260px] truncate">{cotacao.origem_frete || cotacao.descricao || '—'}</TableCell>
                          <TableCell className="max-w-[260px] truncate">{cotacao.destino_frete || cotacao.projeto_centro_custo || '—'}</TableCell>
                          <TableCell className="text-right font-medium">{moeda(cotacao.valor_total)}</TableCell>
                          <TableCell>
                            <Badge variant={cotacao.status === 'rejeitada' ? 'destructive' : 'outline'}>{statusLabels[cotacao.status] || cotacao.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {cotacao.arquivo_path && (
                                <Button variant="ghost" size="icon" onClick={() => void abrirPdf(cotacao)} title="Ver PDF">
                                  <FileText className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => void abrirEdicao(cotacao)} title="Abrir / editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {['confirmada', 'escolhida'].includes(cotacao.status) && !cotacao.financeiro_necessidade_id && (
                                <Button variant="ghost" size="icon" onClick={() => void converterEmPn(cotacao)} title="Converter em PN">
                                  <ArrowRightLeft className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {resultados.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Nenhuma cotação encontrada.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="solicitacoes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Solicitações de cotação</CardTitle>
              <CardDescription>Registre o que precisa ser cotado antes de receber os orçamentos.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead><TableHead>Solicitação</TableHead><TableHead>Tipo</TableHead><TableHead>Prazo</TableHead><TableHead>Fornecedores</TableHead><TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {solicitacoes.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>SOL-{String(s.numero).padStart(4, '0')}</TableCell>
                        <TableCell><div className="font-medium">{s.titulo}</div><div className="text-xs text-muted-foreground">{s.projeto_centro_custo || 'Sem projeto vinculado'}</div></TableCell>
                        <TableCell>{tipoLabels[s.tipo]}</TableCell>
                        <TableCell>{dataPt(s.data_limite)}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{s.fornecedores_solicitados || '—'}</TableCell>
                        <TableCell><Badge variant="outline">{solicitacaoStatusLabels[s.status] || s.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {solicitacoes.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Nenhuma solicitação cadastrada.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editorCotacao ? `Cotação #${editorCotacao.numero}` : 'Nova cotação manual'}</DialogTitle>
            <DialogDescription>
              {editorCotacao?.origem_cadastro === 'pdf'
                ? 'Confira o que foi lido do PDF. Todos os campos podem ser corrigidos antes de confirmar.'
                : 'Preencha manualmente os dados da cotação.'}
            </DialogDescription>
          </DialogHeader>

          {editorCotacao?.origem_cadastro === 'pdf' && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
              <FileText className="h-4 w-4" />
              <span className="font-medium">{editorCotacao.arquivo_nome}</span>
              <Badge variant="outline">{editorCotacao.leitura_status}</Badge>
              {editorCotacao.leitura_erro && <span className="text-amber-500">{editorCotacao.leitura_erro}</span>}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void abrirPdf(editorCotacao)}>
                <Eye className="mr-2 h-4 w-4" /> Ver PDF original
              </Button>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div><Label>Tipo</Label><Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as CotacaoTipo }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="insumo">Insumo</SelectItem><SelectItem value="frete">Frete</SelectItem><SelectItem value="global">Orçamento global</SelectItem></SelectContent></Select></div>
            <div><Label>Fornecedor / empresa</Label><Input value={form.fornecedor_nome} onChange={(e) => setForm((f) => ({ ...f, fornecedor_nome: e.target.value }))} /></div>
            <div><Label>CNPJ / CPF</Label><Input value={form.fornecedor_cnpj} onChange={(e) => setForm((f) => ({ ...f, fornecedor_cnpj: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Endereço</Label><Input value={form.fornecedor_endereco} onChange={(e) => setForm((f) => ({ ...f, fornecedor_endereco: e.target.value }))} /></div>
            <div><Label>Contato</Label><Input value={form.fornecedor_contato} onChange={(e) => setForm((f) => ({ ...f, fornecedor_contato: e.target.value }))} /></div>
            <div><Label>Nº proposta</Label><Input value={form.numero_proposta} onChange={(e) => setForm((f) => ({ ...f, numero_proposta: e.target.value }))} /></div>
            <div><Label>Data da cotação</Label><Input type="date" value={form.data_cotacao} onChange={(e) => setForm((f) => ({ ...f, data_cotacao: e.target.value }))} /></div>
            <div><Label>Validade (dias)</Label><Input type="number" min="0" value={form.validade_dias} onChange={(e) => setForm((f) => ({ ...f, validade_dias: e.target.value }))} /></div>
            <div><Label>Condição de pagamento</Label><Input value={form.condicao_pagamento} onChange={(e) => setForm((f) => ({ ...f, condicao_pagamento: e.target.value }))} /></div>
            <div><Label>Projeto / centro de custo</Label><Input value={form.projeto_centro_custo} onChange={(e) => setForm((f) => ({ ...f, projeto_centro_custo: e.target.value }))} /></div>
            <div><Label>Solicitação relacionada</Label><Select value={form.solicitacao_id || 'nenhuma'} onValueChange={(v) => setForm((f) => ({ ...f, solicitacao_id: v === 'nenhuma' ? '' : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nenhuma">Nenhuma</SelectItem>{solicitacoes.map((s) => <SelectItem key={s.id} value={s.id}>SOL-{String(s.numero).padStart(4, '0')} · {s.titulo}</SelectItem>)}</SelectContent></Select></div>
          </div>

          {form.tipo === 'frete' && (
            <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-3">
              <div><Label>Origem</Label><Input value={form.origem_frete} onChange={(e) => setForm((f) => ({ ...f, origem_frete: e.target.value }))} /></div>
              <div><Label>Destino</Label><Input value={form.destino_frete} onChange={(e) => setForm((f) => ({ ...f, destino_frete: e.target.value }))} /></div>
              <div><Label>Tipo de veículo</Label><Input value={form.tipo_veiculo} onChange={(e) => setForm((f) => ({ ...f, tipo_veiculo: e.target.value }))} /></div>
              <div><Label>Peso (kg)</Label><Input value={form.peso_kg} onChange={(e) => setForm((f) => ({ ...f, peso_kg: e.target.value }))} /></div>
              <div><Label>Cubagem (m³)</Label><Input value={form.cubagem_m3} onChange={(e) => setForm((f) => ({ ...f, cubagem_m3: e.target.value }))} /></div>
              <div><Label>Volumes</Label><Input type="number" min="0" value={form.volumes} onChange={(e) => setForm((f) => ({ ...f, volumes: e.target.value }))} /></div>
              <div><Label>Prazo (dias)</Label><Input type="number" min="0" value={form.prazo_dias} onChange={(e) => setForm((f) => ({ ...f, prazo_dias: e.target.value }))} /></div>
              <div><Label>Valor do frete</Label><Input value={form.valor_frete} onChange={(e) => setForm((f) => ({ ...f, valor_frete: e.target.value }))} placeholder="R$" /></div>
              <div><Label>Valor total</Label><Input value={form.valor_total} onChange={(e) => setForm((f) => ({ ...f, valor_total: e.target.value }))} placeholder="R$" /></div>
            </div>
          )}

          {form.tipo === 'insumo' && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium">Itens do orçamento</p><p className="text-xs text-muted-foreground">A leitura do PDF tenta separar descrição, quantidade, unidade e valores.</p></div>
                <Button type="button" variant="outline" size="sm" onClick={() => setItens((current) => [...current, { descricao: '', quantidade: null, unidade: 'un', valor_unitario: null, valor_total: null }])}>
                  <Plus className="mr-2 h-4 w-4" /> Item
                </Button>
              </div>
              <div className="space-y-2">
                {itens.map((item, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[2fr_110px_90px_130px_130px_40px]">
                    <Input placeholder="Descrição / material" value={item.descricao} onChange={(e) => atualizarItem(index, { descricao: e.target.value })} />
                    <Input placeholder="Qtd" value={item.quantidade ?? ''} onChange={(e) => atualizarItem(index, { quantidade: fromInput(e.target.value) })} />
                    <Input placeholder="Un." value={item.unidade || ''} onChange={(e) => atualizarItem(index, { unidade: e.target.value })} />
                    <Input placeholder="V. unit." value={item.valor_unitario ?? ''} onChange={(e) => atualizarItem(index, { valor_unitario: fromInput(e.target.value) })} />
                    <Input placeholder="V. total" value={item.valor_total ?? ''} onChange={(e) => atualizarItem(index, { valor_total: fromInput(e.target.value) })} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setItens((current) => current.filter((_, idx) => idx !== index))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {itens.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhum item identificado. Você pode adicionar manualmente.</p>}
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div><Label>Subtotal</Label><Input value={form.valor_subtotal} onChange={(e) => setForm((f) => ({ ...f, valor_subtotal: e.target.value }))} /></div>
                <div><Label>Frete</Label><Input value={form.valor_frete} onChange={(e) => setForm((f) => ({ ...f, valor_frete: e.target.value }))} /></div>
                <div><Label>Desconto</Label><Input value={form.valor_desconto} onChange={(e) => setForm((f) => ({ ...f, valor_desconto: e.target.value }))} /></div>
                <div><Label>Total</Label><Input value={form.valor_total} onChange={(e) => setForm((f) => ({ ...f, valor_total: e.target.value }))} /></div>
              </div>
            </div>
          )}

          {form.tipo === 'global' && (
            <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-3">
              <div className="md:col-span-3"><Label>Escopo / descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} rows={4} /></div>
              <div><Label>Subtotal</Label><Input value={form.valor_subtotal} onChange={(e) => setForm((f) => ({ ...f, valor_subtotal: e.target.value }))} /></div>
              <div><Label>Frete / adicionais</Label><Input value={form.valor_frete} onChange={(e) => setForm((f) => ({ ...f, valor_frete: e.target.value }))} /></div>
              <div><Label>Valor total</Label><Input value={form.valor_total} onChange={(e) => setForm((f) => ({ ...f, valor_total: e.target.value }))} /></div>
            </div>
          )}

          {form.tipo !== 'global' && (
            <div><Label>Observação / descrição geral</Label><Textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} rows={3} /></div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button variant="outline" onClick={() => void salvarCotacao(false)} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar rascunho'}</Button>
            <Button onClick={() => void salvarCotacao(true)} disabled={salvando}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar e salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={solicitacaoOpen} onOpenChange={setSolicitacaoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova solicitação de cotação</DialogTitle>
            <DialogDescription>Registre a necessidade antes de receber as propostas dos fornecedores.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Título</Label><Input value={solicitacaoForm.titulo} onChange={(e) => setSolicitacaoForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex.: Frete Maringá → Brusque" /></div>
            <div><Label>Tipo</Label><Select value={solicitacaoForm.tipo} onValueChange={(v) => setSolicitacaoForm((f) => ({ ...f, tipo: v as CotacaoTipo }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="insumo">Insumo</SelectItem><SelectItem value="frete">Frete</SelectItem><SelectItem value="global">Global</SelectItem></SelectContent></Select></div>
            <div><Label>Data limite</Label><Input type="date" value={solicitacaoForm.data_limite} onChange={(e) => setSolicitacaoForm((f) => ({ ...f, data_limite: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Projeto / centro de custo</Label><Input value={solicitacaoForm.projeto_centro_custo} onChange={(e) => setSolicitacaoForm((f) => ({ ...f, projeto_centro_custo: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Fornecedores consultados</Label><Textarea value={solicitacaoForm.fornecedores_solicitados} onChange={(e) => setSolicitacaoForm((f) => ({ ...f, fornecedores_solicitados: e.target.value }))} placeholder="Nome, WhatsApp, e-mail ou contato dos fornecedores" rows={3} /></div>
            <div className="md:col-span-2"><Label>Observações / especificação</Label><Textarea value={solicitacaoForm.observacoes} onChange={(e) => setSolicitacaoForm((f) => ({ ...f, observacoes: e.target.value }))} rows={4} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSolicitacaoOpen(false)}>Cancelar</Button>
            <Button onClick={() => void criarSolicitacao()} disabled={salvando}>{salvando ? 'Salvando...' : 'Criar solicitação'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
