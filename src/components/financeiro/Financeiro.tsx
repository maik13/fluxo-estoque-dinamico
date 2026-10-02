import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Banknote, CalendarRange, CheckCircle2, ChevronDown, ClipboardList, FileClock, Landmark, Plus, RefreshCcw, Search, Settings, TrendingDown, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { FinanceiroRelatorios } from './FinanceiroRelatorios';

type Registro = Record<string, any>;

const moeda = (valor: any) => {
  const numero = Number(valor);
  if (valor == null || valor === '' || Number.isNaN(numero)) return 'A definir';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
};

const dataPt = (valor?: string | null) => {
  if (!valor) return '—';
  const data = valor.slice(0, 10);
  const [ano, mes, dia] = data.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
};

const statusLabel: Record<string, string> = {
  previsto: 'Previsto',
  em_definicao: 'Em definição',
  em_cotacao: 'Em cotação',
  aguardando_aprovacao: 'Aguardando aprovação',
  aguardando_vencimento: 'Aguardando vencimento',
  aprovado: 'Aprovado',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  convertido_em_pc: 'Convertida em PC',
  comprometido: 'Comprometido',
  solicitado: 'Solicitado',
  programado: 'Programado',
  aguardando_programacao: 'Aguardando programação',
  rejeitado_banco: 'Rejeitado pelo banco',
  liquidado: 'Liquidado',
  pago: 'Pago',
  conciliado: 'Conciliado',
  em_apuracao: 'Em apuração',
  identificado: 'Identificado',
  regularizado: 'Regularizado',
  cancelado: 'Cancelado',
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  recebido: 'Recebido',
  concluido: 'Concluído',
};

const BadgeStatus = ({ status }: { status?: string | null }) => (
  <Badge variant={status === 'cancelado' || status === 'rejeitada' ? 'secondary' : 'outline'}>
    {statusLabel[status || ''] || status || '—'}
  </Badge>
);

const hexCorRegex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const corHexValida = (valor?: unknown): valor is string =>
  typeof valor === 'string' && hexCorRegex.test(valor.trim());

const corFundoTranslucido = (hex: string) => {
  const limpo = hex.trim().replace('#', '');
  const completo = limpo.length === 3 ? limpo.split('').map((c) => c + c).join('') : limpo;
  const r = parseInt(completo.slice(0, 2), 16);
  const g = parseInt(completo.slice(2, 4), 16);
  const b = parseInt(completo.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
};

const Field = ({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) => (
  <div className={className}>
    <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export const Financeiro = () => {
  const {
    canManageFinanceiro,
    canApproveFinanceiro,
    canProgramFinanceiro,
    canConciliarFinanceiro,
    canViewFinanceiroReports,
  } = usePermissions();

  const podeGerenciar = canManageFinanceiro();
  const podeAprovar = canApproveFinanceiro();
  const podeProgramar = canProgramFinanceiro();
  const podeConciliar = canConciliarFinanceiro();
  const podeRelatorios = canViewFinanceiroReports();

  const [loading, setLoading] = useState(true);
  const abaInicialFinanceiro =
    (podeGerenciar || podeAprovar) ? 'visao' :
    podeProgramar ? 'programacao' :
    podeConciliar ? 'conciliacao' :
    podeRelatorios ? 'relatorios' :
    'visao';
  const [abaFinanceiro, setAbaFinanceiro] = useState(abaInicialFinanceiro);

  const abasPermitidas = useMemo(() => {
    const abas: string[] = [];
    if (podeGerenciar || podeAprovar) {
      abas.push('visao', 'fluxo');
    }
    if (podeGerenciar) {
      abas.push('pn', 'rc', 'pc', 'projecoes');
    } else if (podeAprovar) {
      abas.push('rc', 'pc');
    }
    if (podeProgramar) abas.push('programacao');
    if (podeConciliar) abas.push('conciliacao');
    if (podeRelatorios) abas.push('relatorios');
    if (podeGerenciar) abas.push('configuracoes');
    return abas;
  }, [podeGerenciar, podeAprovar, podeProgramar, podeConciliar, podeRelatorios]);
  const [necessidades, setNecessidades] = useState<Registro[]>([]);
  const [lancamentos, setLancamentos] = useState<Registro[]>([]);
  const [buscaFluxo, setBuscaFluxo] = useState('');

  const lancamentosFluxo = useMemo(() => {
    const termo = buscaFluxo.trim().toLowerCase();
    if (!termo) return lancamentos;
    const campos = [
      'numero', 'descricao', 'observacoes', 'categoria', 'subcategoria', 'status', 'origem_tipo',
      'planilha_linha', 'pagina54_integracao_id', 'debito_original', 'credito_original',
      'valor_previsto', 'valor_realizado',
    ];
    return lancamentos.filter((l: Registro) =>
      campos.some((campo) => l[campo] != null && String(l[campo]).toLowerCase().includes(termo)),
    );
  }, [lancamentos, buscaFluxo]);
  const [rcs, setRcs] = useState<Registro[]>([]);
  const [pcs, setPcs] = useState<Registro[]>([]);
  const [programacoes, setProgramacoes] = useState<Registro[]>([]);
  const [contas, setContas] = useState<Registro[]>([]);
  const [posicoes, setPosicoes] = useState<Registro[]>([]);
  const [conciliacoes, setConciliacoes] = useState<Registro[]>([]);
  const [categorias, setCategorias] = useState<Registro[]>([]);
  const [subcategorias, setSubcategorias] = useState<Registro[]>([]);
  const [categoriaSubcategorias, setCategoriaSubcategorias] = useState<Registro[]>([]);
  const [ultimoSaldoDia, setUltimoSaldoDia] = useState<Registro | null>(null);
  const [ultimoSaldoRealizado, setUltimoSaldoRealizado] = useState<Registro | null>(null);
  const [auditoria, setAuditoria] = useState<Registro[]>([]);

  const [dialogPn, setDialogPn] = useState(false);
  const [dialogRc, setDialogRc] = useState(false);
  const [dialogPc, setDialogPc] = useState(false);
  const [dialogPosicao, setDialogPosicao] = useState(false);
  const [dialogProgramacao, setDialogProgramacao] = useState(false);
  const [dialogConciliacao, setDialogConciliacao] = useState(false);
  const [dialogCategoria, setDialogCategoria] = useState(false);
  const [dialogSubcategoria, setDialogSubcategoria] = useState(false);
  const [selecionado, setSelecionado] = useState<Registro | null>(null);

  const [pnForm, setPnForm] = useState({
    descricao: '', area: '', projeto: '', especificacao: '', dataNecessidade: '',
    valor: '', baseEstimativa: '', dataDesembolso: '', urgencia: 'normal',
    justificativa: '', categoria: '', subcategoria: '',
  });

  const [rcForm, setRcForm] = useState<Registro>({});
  const [pcForm, setPcForm] = useState({
    rcId: '', fornecedor: '', identificacao: '', contato: '', descricao: '',
    valorItens: '', frete: '', condicao: '', prazo: '', local: '',
  });
  const [posicaoForm, setPosicaoForm] = useState({
    data: new Date().toISOString().slice(0, 10), contaId: '', saldoInicial: '', entradas: '',
    saidas: '', saldoFinal: '', programados: '', recebimentosNaoRealizados: '',
    saidasNaoPrevistas: '', saldoGerencial: '', pendencias: '',
  });
  const [programacaoForm, setProgramacaoForm] = useState({
    lancamentoId: '', beneficiario: '', valor: '', vencimento: '', dataProgramada: '',
    bancoConta: '', formaPagamento: '', categoria: '', projeto: '', observacao: '',
  });
  const [categoriaForm, setCategoriaForm] = useState({ nome: '', observacao: '' });
  const [subcategoriaForm, setSubcategoriaForm] = useState({ nome: '', categoriaId: '', observacao: '' });

  const [conciliacaoForm, setConciliacaoForm] = useState({
    data: new Date().toISOString().slice(0, 10), contaId: '', historico: '', previsto: 'sim',
    valor: '', valorPrevisto: '', dataPrevista: '', tipo: 'saida', tratamento: 'em_apuracao',
    observacao: '', responsavel: '', prazo: '',
  });

  const [mostrarPnCanceladas, setMostrarPnCanceladas] = useState(false);
  const necessidadesVisiveis = useMemo(
    () => necessidades.filter((n) => mostrarPnCanceladas || n.status !== 'cancelado'),
    [necessidades, mostrarPnCanceladas],
  );

  const carregar = async () => {
    setLoading(true);
    try {
      const consultas = await Promise.all([
        (supabase as any).from('financeiro_necessidades').select('*').order('created_at', { ascending: false }).limit(500),
        (supabase as any).from('financeiro_lancamentos').select('*').order('data_prevista', { ascending: true, nullsFirst: false }).limit(1000),
        (supabase as any).from('pedidos_compra').select('*').not('status_financeiro_rc', 'is', null).order('data_pedido', { ascending: false }).limit(300),
        (supabase as any).from('financeiro_pedidos_compra_formais').select('*').order('created_at', { ascending: false }).limit(300),
        (supabase as any).from('financeiro_programacoes').select('*').order('data_programada', { ascending: true }).limit(500),
        (supabase as any).from('financeiro_contas_bancarias').select('*').eq('ativa', true).order('ordem', { ascending: true }),
        (supabase as any).from('financeiro_posicoes_diarias').select('*').order('data', { ascending: false }).limit(500),
        (supabase as any).from('financeiro_conciliacoes').select('*').order('data', { ascending: false }).limit(500),
        (supabase as any).from('financeiro_categorias').select('*').order('ordem', { ascending: true }).order('nome', { ascending: true }),
        (supabase as any).from('financeiro_subcategorias').select('*').order('ordem', { ascending: true }).order('nome', { ascending: true }),
        (supabase as any).from('financeiro_categoria_subcategorias').select('*'),
        (supabase as any).from('financeiro_importacao_pagina54').select('linha,data_posicao_original,saldo_dia_original').not('data_posicao_original','is',null).order('linha',{ascending:false}).limit(1).maybeSingle(),
        (supabase as any).from('financeiro_importacao_pagina54').select('linha,data_realizada_original,saldo_original').not('data_realizada_original','is',null).order('linha',{ascending:false}).limit(1).maybeSingle(),
        (supabase as any).from('financeiro_auditoria').select('*').order('created_at',{ascending:false}).limit(500),
      ]);

      consultas.forEach((q: any) => { if (q.error) throw q.error; });
      setNecessidades(consultas[0].data ?? []);
      setLancamentos(consultas[1].data ?? []);
      setRcs(consultas[2].data ?? []);
      setPcs(consultas[3].data ?? []);
      setProgramacoes(consultas[4].data ?? []);
      setContas(consultas[5].data ?? []);
      setPosicoes(consultas[6].data ?? []);
      setConciliacoes(consultas[7].data ?? []);
      setCategorias(consultas[8].data ?? []);
      setSubcategorias(consultas[9].data ?? []);
      setCategoriaSubcategorias(consultas[10].data ?? []);
      setUltimoSaldoDia(consultas[11].data ?? null);
      setUltimoSaldoRealizado(consultas[12].data ?? null);
      setAuditoria(consultas[13].data ?? []);
    } catch (error) {
      console.error('Erro ao carregar Financeiro:', error);
      toast.error('Não foi possível carregar todos os dados do Financeiro.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const atualizar = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { void carregar(); }, 500);
    };
    const canal = supabase.channel('financeiro-integracao-rc-pn')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_necessidades' }, atualizar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_lancamentos' }, atualizar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_compra' }, atualizar)
      .subscribe();
    const intervalo = setInterval(atualizar, 30000);
    return () => { if (debounce) clearTimeout(debounce); clearInterval(intervalo); void supabase.removeChannel(canal); };
  }, []);

  useEffect(() => {
    if (abasPermitidas.length === 0) return;
    if (!abasPermitidas.includes(abaFinanceiro)) {
      setAbaFinanceiro(abasPermitidas[0]);
    }
  }, [abasPermitidas, abaFinanceiro]);

  const contaNome = (id?: string | null) => contas.find((c) => c.id === id)?.nome || '—';
  const moedaOriginalParaNumero = (valor?: string | null) => {
    if (!valor) return 0;
    const texto = String(valor).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : 0;
  };

  const subcategoriasPermitidas = (categoriaNome?: string | null) => {
    const ativas = subcategorias.filter((s) => s.ativo);
    if (!categoriaNome) return ativas;
    const categoria = categorias.find((item) => item.nome === categoriaNome);
    if (!categoria) return ativas;
    const permitidas = new Set(
      categoriaSubcategorias
        .filter((rel) => rel.categoria_id === categoria.id)
        .map((rel) => rel.subcategoria_id)
    );
    const filtradas = ativas.filter((s) => permitidas.has(s.id));
    return filtradas.length > 0 ? filtradas : ativas;
  };

  const auditoriaLancamento = (lancamentoId?: string | null) =>
    auditoria.filter((a) => a.lancamento_id === lancamentoId);

  const ultimoAtorLancamento = (lancamentoId?: string | null) =>
    auditoriaLancamento(lancamentoId)[0] || null;

  const liberarParaProgramacao = async (lancamentoId: string) => {
    try {
      const { error } = await (supabase as any).rpc('financeiro_liberar_programacao', { p_lancamento_id: lancamentoId });
      if (error) throw error;
      toast.success('Lançamento liberado para programação bancária.');
      await carregar();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível liberar o lançamento.');
    }
  };

  const indicadores = useMemo(() => {
    const abertas = necessidades.filter((n) => n.status !== 'cancelado');
    const semValor = abertas.filter((n) => n.valor_estimado == null || n.estimativa_incompleta);
    const aguardandoVencimento = lancamentos.filter((l) => l.status === 'aguardando_vencimento').length;
    const saidasPrevistas = lancamentos
      .filter((l) => l.tipo === 'saida' && !['cancelado', 'pago', 'conciliado'].includes(l.status))
      .reduce((soma, l) => soma + Number(l.valor_previsto || 0), 0);
    const saldoBancario = moedaOriginalParaNumero(ultimoSaldoDia?.saldo_dia_original);
    const saldoGerencial = moedaOriginalParaNumero(ultimoSaldoRealizado?.saldo_original);
    const ultimoDia = ultimoSaldoDia?.data_posicao_original || null;
    return { abertas: abertas.length, semValor: semValor.length, aguardandoVencimento, saidasPrevistas, saldoBancario, saldoGerencial, ultimoDia };
  }, [necessidades, lancamentos, ultimoSaldoDia, ultimoSaldoRealizado]);

  const projecoes = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite14 = new Date(hoje); limite14.setDate(limite14.getDate() + 14);
    const limite13s = new Date(hoje); limite13s.setDate(limite13s.getDate() + 91);
    const limite6m = new Date(hoje); limite6m.setMonth(limite6m.getMonth() + 6);
    const validos = lancamentos.filter((l) => l.data_prevista && !['cancelado','pago','conciliado'].includes(l.status));
    const somarAte = (limite: Date, tipo: string) => validos
      .filter((l) => l.tipo === tipo && new Date(`${l.data_prevista}T00:00:00`) <= limite)
      .reduce((s, l) => s + Number(l.valor_previsto || 0), 0);
    return {
      saidas14: somarAte(limite14, 'saida'),
      entradas14: somarAte(limite14, 'entrada'),
      saidas13s: somarAte(limite13s, 'saida'),
      entradas13s: somarAte(limite13s, 'entrada'),
      saidas6m: somarAte(limite6m, 'saida'),
      entradas6m: somarAte(limite6m, 'entrada'),
    };
  }, [lancamentos]);

  const criarPn = async () => {
    if (!pnForm.descricao.trim()) return toast.error('Informe a descrição.');
    const valor = pnForm.valor ? Number(pnForm.valor.replace(/\./g, '').replace(',', '.')) : null;
    try {
      const { data, error } = await (supabase as any).rpc('financeiro_criar_necessidade_manual', {
        p_descricao: pnForm.descricao.trim(),
        p_valor_estimado: valor,
        p_data_necessidade: pnForm.dataNecessidade || null,
        p_data_prevista_desembolso: pnForm.dataDesembolso || null,
        p_urgencia: pnForm.urgencia,
        p_projeto_centro_custo: pnForm.projeto || null,
        p_categoria: pnForm.categoria || null,
        p_subcategoria: pnForm.subcategoria || null,
      });
      if (error) throw error;
      if (data) {
        const { error: updateError } = await (supabase as any).from('financeiro_necessidades').update({
          area_solicitante: pnForm.area || null,
          especificacao: pnForm.especificacao || null,
          base_estimativa: pnForm.baseEstimativa || null,
          justificativa: pnForm.justificativa || null,
        }).eq('id', data);
        if (updateError) throw updateError;
      }
      setDialogPn(false);
      setPnForm({ descricao:'', area:'', projeto:'', especificacao:'', dataNecessidade:'', valor:'', baseEstimativa:'', dataDesembolso:'', urgencia:'normal', justificativa:'', categoria:'', subcategoria:'' });
      toast.success('PN registrada.');
      await carregar();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar PN.');
    }
  };

  const abrirRc = (rc: Registro) => {
    setSelecionado(rc);
    setRcForm({ ...rc });
    setDialogRc(true);
  };

  const salvarRc = async () => {
    if (!selecionado) return;
    try {
      const campos = {
        projeto_centro_custo: rcForm.projeto_centro_custo || null,
        especificacao_tecnica: rcForm.especificacao_tecnica || null,
        data_necessaria: rcForm.data_necessaria || null,
        conferencia_estoque: rcForm.conferencia_estoque || null,
        fornecedores_consultados: rcForm.fornecedores_consultados || null,
        valor_estimado_cotado: rcForm.valor_estimado_cotado === '' ? null : Number(rcForm.valor_estimado_cotado),
        frete_custos_adicionais: rcForm.frete_custos_adicionais === '' ? null : Number(rcForm.frete_custos_adicionais),
        condicao_pagamento: rcForm.condicao_pagamento || null,
        lead_time_dias: rcForm.lead_time_dias === '' ? null : Number(rcForm.lead_time_dias),
        data_limite_compra: rcForm.data_limite_compra || null,
        impacto_financeiro: rcForm.impacto_financeiro || null,
        status_financeiro_rc: rcForm.status_financeiro_rc || 'em_cotacao',
      };
      const { error } = await (supabase as any).from('pedidos_compra').update(campos).eq('id', selecionado.id);
      if (error) throw error;
      setDialogRc(false);
      toast.success('RC atualizada.');
      await carregar();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar RC.');
    }
  };

  const criarPc = async () => {
    const rc = rcs.find((item) => item.id === pcForm.rcId);
    if (!rc || !pcForm.fornecedor.trim() || !pcForm.descricao.trim()) return toast.error('Selecione a RC e informe fornecedor e descrição.');
    try {
      const { error } = await (supabase as any).from('financeiro_pedidos_compra_formais').insert({
        requisicao_compra_id: rc.id,
        necessidade_id: rc.pn_origem_id || null,
        fornecedor: pcForm.fornecedor.trim(),
        fornecedor_identificacao: pcForm.identificacao || null,
        fornecedor_contato: pcForm.contato || null,
        descricao: pcForm.descricao.trim(),
        valor_itens: Number(pcForm.valorItens || 0),
        frete_custos_adicionais: Number(pcForm.frete || 0),
        condicao_pagamento: pcForm.condicao || null,
        prazo_entrega: pcForm.prazo || null,
        local_entrega: pcForm.local || null,
      });
      if (error) throw error;
      await (supabase as any).from('pedidos_compra').update({ status_financeiro_rc: 'convertida_em_pc' }).eq('id', rc.id);
      setDialogPc(false);
      setPcForm({ rcId:'', fornecedor:'', identificacao:'', contato:'', descricao:'', valorItens:'', frete:'', condicao:'', prazo:'', local:'' });
      toast.success('PC formal criado.');
      await carregar();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar PC. Verifique se esta RC já possui PC formal.');
    }
  };

  const salvarPosicao = async () => {
    if (!posicaoForm.contaId || !posicaoForm.data) return toast.error('Informe a conta e a data.');
    const num = (v: string) => Number(v.replace(/\./g,'').replace(',','.')) || 0;
    try {
      const { error } = await (supabase as any).from('financeiro_posicoes_diarias').upsert({
        data: posicaoForm.data,
        conta_bancaria_id: posicaoForm.contaId,
        saldo_inicial_bancario: num(posicaoForm.saldoInicial),
        entradas_realizadas: num(posicaoForm.entradas),
        saidas_realizadas: num(posicaoForm.saidas),
        saldo_final_bancario: num(posicaoForm.saldoFinal),
        pagamentos_programados_nao_liquidados: num(posicaoForm.programados),
        recebimentos_previstos_nao_realizados: num(posicaoForm.recebimentosNaoRealizados),
        saidas_nao_previstas_diferencas: num(posicaoForm.saidasNaoPrevistas),
        saldo_financeiro_gerencial: num(posicaoForm.saldoGerencial),
        pendencias_proximo_dia: posicaoForm.pendencias || null,
      }, { onConflict: 'data,conta_bancaria_id' });
      if (error) throw error;
      setDialogPosicao(false);
      toast.success('Posição diária registrada.');
      await carregar();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar posição diária.');
    }
  };

  const salvarProgramacao = async () => {
    if (!programacaoForm.lancamentoId || !programacaoForm.beneficiario || !programacaoForm.valor || !programacaoForm.dataProgramada) {
      return toast.error('Informe lançamento, beneficiário, valor e data programada.');
    }
    try {
      const { error } = await (supabase as any).from('financeiro_programacoes').insert({
        lancamento_id: programacaoForm.lancamentoId,
        beneficiario: programacaoForm.beneficiario,
        valor: Number(programacaoForm.valor.replace(/\./g,'').replace(',','.')),
        vencimento: programacaoForm.vencimento || null,
        data_programada: programacaoForm.dataProgramada,
        banco_conta: programacaoForm.bancoConta || null,
        forma_pagamento: programacaoForm.formaPagamento || null,
        categoria: programacaoForm.categoria || null,
        projeto_centro_custo: programacaoForm.projeto || null,
        observacao: programacaoForm.observacao || null,
      });
      if (error) throw error;
      setDialogProgramacao(false);
      toast.success('Programação registrada.');
      await carregar();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar programação.');
    }
  };

  const criarCategoria = async () => {
    const nome = categoriaForm.nome.trim().toUpperCase();
    if (!nome) return toast.error('Informe o nome da categoria.');
    try {
      const { error } = await (supabase as any).from('financeiro_categorias').insert({
        nome,
        observacao: categoriaForm.observacao.trim() || null,
        origem_planilha: false,
        ativo: true,
        ordem: (categorias[categorias.length - 1]?.ordem || 0) + 10,
      });
      if (error) throw error;
      setDialogCategoria(false);
      setCategoriaForm({ nome: '', observacao: '' });
      toast.success('Categoria criada.');
      await carregar();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível criar a categoria. Verifique se ela já existe.');
    }
  };

  const criarSubcategoria = async () => {
    const nome = subcategoriaForm.nome.trim().toUpperCase();
    if (!nome) return toast.error('Informe o nome da subcategoria.');
    try {
      const { data, error } = await (supabase as any).from('financeiro_subcategorias').insert({
        nome,
        observacao: subcategoriaForm.observacao.trim() || null,
        origem_planilha: false,
        ativo: true,
        ordem: (subcategorias[subcategorias.length - 1]?.ordem || 0) + 10,
      }).select('id').single();
      if (error) throw error;
      if (subcategoriaForm.categoriaId && data?.id) {
        const { error: linkError } = await (supabase as any).from('financeiro_categoria_subcategorias').insert({
          categoria_id: subcategoriaForm.categoriaId,
          subcategoria_id: data.id,
          origem_planilha: false,
        });
        if (linkError) throw linkError;
      }
      setDialogSubcategoria(false);
      setSubcategoriaForm({ nome: '', categoriaId: '', observacao: '' });
      toast.success('Subcategoria criada.');
      await carregar();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível criar a subcategoria. Verifique se ela já existe.');
    }
  };

  const alternarAtivo = async (tabela: 'financeiro_categorias' | 'financeiro_subcategorias', item: Registro) => {
    try {
      const { error } = await (supabase as any).from(tabela).update({ ativo: !item.ativo, updated_at: new Date().toISOString() }).eq('id', item.id);
      if (error) throw error;
      await carregar();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível atualizar o cadastro.');
    }
  };

  const salvarConciliacao = async () => {
    if (!conciliacaoForm.contaId || !conciliacaoForm.historico || !conciliacaoForm.valor) return toast.error('Informe conta, histórico e valor.');
    try {
      const { error } = await (supabase as any).from('financeiro_conciliacoes').insert({
        data: conciliacaoForm.data,
        conta_bancaria_id: conciliacaoForm.contaId,
        historico_beneficiario: conciliacaoForm.historico,
        estava_previsto: conciliacaoForm.previsto === 'sim',
        valor: Number(conciliacaoForm.valor.replace(/\./g,'').replace(',','.')),
        valor_previsto: conciliacaoForm.valorPrevisto ? Number(conciliacaoForm.valorPrevisto.replace(/\./g,'').replace(',','.')) : null,
        data_prevista: conciliacaoForm.dataPrevista || null,
        tipo: conciliacaoForm.tipo,
        tratamento_status: conciliacaoForm.tratamento,
        tratamento_observacao: conciliacaoForm.observacao || null,
        responsavel_regularizacao: conciliacaoForm.responsavel || null,
        prazo_regularizacao: conciliacaoForm.prazo || null,
      });
      if (error) throw error;
      setDialogConciliacao(false);
      toast.success('Movimentação registrada para conciliação.');
      await carregar();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar conciliação.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Financeiro</h2>
          <p className="text-sm text-muted-foreground">
            Fluxo integrado ao procedimento oficial: PN → RC → PC → programação → pagamento → conciliação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />Atualizar
          </Button>
          {podeGerenciar && (
            <Button
              variant={abaFinanceiro === 'configuracoes' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setAbaFinanceiro('configuracoes')}
              title="Configurações do Financeiro"
              aria-label="Configurações do Financeiro"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Tabs value={abaFinanceiro} onValueChange={setAbaFinanceiro} className="w-full">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          {(podeGerenciar || podeAprovar) && <TabsTrigger value="visao">Visão Geral</TabsTrigger>}
          {(podeGerenciar || podeAprovar) && <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>}
          {podeGerenciar && <TabsTrigger value="pn">PN</TabsTrigger>}
          {(podeGerenciar || podeAprovar) && <TabsTrigger value="rc">RC</TabsTrigger>}
          {(podeGerenciar || podeAprovar) && <TabsTrigger value="pc">PC</TabsTrigger>}
          {podeProgramar && <TabsTrigger value="programacao">Programação</TabsTrigger>}
          {podeConciliar && <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>}
          {podeGerenciar && <TabsTrigger value="projecoes">Projeções</TabsTrigger>}
          {podeRelatorios && <TabsTrigger value="relatorios">Relatórios</TabsTrigger>}
        </TabsList>

        {(podeGerenciar || podeAprovar) && <TabsContent value="visao" className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardDescription>Saldo bancário</CardDescription><CardTitle className="flex items-center gap-2 text-2xl"><Landmark className="h-5 w-5"/>{moeda(indicadores.saldoBancario)}</CardTitle><CardDescription>{indicadores.ultimoDia ? `posição de ${indicadores.ultimoDia}` : 'posição ainda não informada'}</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Saldo financeiro gerencial</CardDescription><CardTitle className="flex items-center gap-2 text-2xl"><WalletCards className="h-5 w-5"/>{moeda(indicadores.saldoGerencial)}</CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Saídas previstas</CardDescription><CardTitle className="flex items-center gap-2 text-2xl"><TrendingDown className="h-5 w-5"/>{moeda(indicadores.saidasPrevistas)}</CardTitle></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Aguardando vencimento</CardDescription><CardTitle className="flex items-center gap-2 text-2xl"><FileClock className="h-5 w-5"/>{indicadores.aguardandoVencimento}</CardTitle></CardHeader></Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div><CardTitle>Posição diária de caixa</CardTitle><CardDescription>Consolidado a partir dos dados do Fluxo de Caixa e das posições bancárias importadas da planilha.</CardDescription></div>
              {podeConciliar && <Dialog open={dialogPosicao} onOpenChange={setDialogPosicao}><DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4"/>Registrar posição</Button></DialogTrigger><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Fechamento diário / posição de caixa</DialogTitle></DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Data"><Input type="date" value={posicaoForm.data} onChange={(e)=>setPosicaoForm({...posicaoForm,data:e.target.value})}/></Field>
                  <Field label="Banco / conta"><Select value={posicaoForm.contaId} onValueChange={(v)=>setPosicaoForm({...posicaoForm,contaId:v})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{contas.map(c=><SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></Field>
                  <Field label="Saldo inicial bancário"><Input value={posicaoForm.saldoInicial} onChange={(e)=>setPosicaoForm({...posicaoForm,saldoInicial:e.target.value})}/></Field>
                  <Field label="Entradas realizadas no dia"><Input value={posicaoForm.entradas} onChange={(e)=>setPosicaoForm({...posicaoForm,entradas:e.target.value})}/></Field>
                  <Field label="Saídas realizadas no dia"><Input value={posicaoForm.saidas} onChange={(e)=>setPosicaoForm({...posicaoForm,saidas:e.target.value})}/></Field>
                  <Field label="Saldo final bancário"><Input value={posicaoForm.saldoFinal} onChange={(e)=>setPosicaoForm({...posicaoForm,saldoFinal:e.target.value})}/></Field>
                  <Field label="Pagamentos programados e não liquidados"><Input value={posicaoForm.programados} onChange={(e)=>setPosicaoForm({...posicaoForm,programados:e.target.value})}/></Field>
                  <Field label="Recebimentos previstos e não realizados"><Input value={posicaoForm.recebimentosNaoRealizados} onChange={(e)=>setPosicaoForm({...posicaoForm,recebimentosNaoRealizados:e.target.value})}/></Field>
                  <Field label="Saídas não previstas / diferenças"><Input value={posicaoForm.saidasNaoPrevistas} onChange={(e)=>setPosicaoForm({...posicaoForm,saidasNaoPrevistas:e.target.value})}/></Field>
                  <Field label="Saldo financeiro gerencial"><Input value={posicaoForm.saldoGerencial} onChange={(e)=>setPosicaoForm({...posicaoForm,saldoGerencial:e.target.value})}/></Field>
                  <Field label="Pendências para o próximo dia" className="sm:col-span-2"><Textarea value={posicaoForm.pendencias} onChange={(e)=>setPosicaoForm({...posicaoForm,pendencias:e.target.value})}/></Field>
                </div>
                <DialogFooter><Button variant="outline" onClick={()=>setDialogPosicao(false)}>Cancelar</Button><Button onClick={()=>void salvarPosicao()}>Salvar posição</Button></DialogFooter>
              </DialogContent></Dialog>}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Saldo bancário</TableHead><TableHead className="text-right">Programado não liquidado</TableHead><TableHead className="text-right">Saldo gerencial</TableHead><TableHead>Pendências</TableHead></TableRow></TableHeader>
              <TableBody>{posicoes.length===0?<TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhuma posição diária registrada.</TableCell></TableRow>:posicoes.slice(0,30).map(p=><TableRow key={p.id}><TableCell>{dataPt(p.data)}</TableCell><TableCell>{contaNome(p.conta_bancaria_id)}</TableCell><TableCell className="text-right">{moeda(p.saldo_final_bancario)}</TableCell><TableCell className="text-right">{moeda(p.pagamentos_programados_nao_liquidados)}</TableCell><TableCell className="text-right">{moeda(p.saldo_financeiro_gerencial)}</TableCell><TableCell>{p.pendencias_proximo_dia||'—'}</TableCell></TableRow>)}</TableBody></Table>
            </CardContent>
          </Card>
        </TabsContent>}


        {(podeGerenciar || podeAprovar) && <TabsContent value="fluxo" className="mt-5">
          <Card><CardHeader><CardTitle>Fluxo de Caixa</CardTitle><CardDescription>Visão sistêmica equivalente ao núcleo da Página54: previsto e realizado separados, com origem rastreável.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="relative mb-3 max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={buscaFluxo}
                  onChange={(e) => setBuscaFluxo(e.target.value)}
                  placeholder="Buscar por descrição, observação, nº, linha Página54, categoria, valor ou ID..."
                  className="pl-9"
                />
              </div>
              <Table><TableHeader><TableRow><TableHead>Situação</TableHead><TableHead>Data prevista</TableHead><TableHead>Data realizada</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Subcategoria</TableHead><TableHead>Projeto / Centro</TableHead><TableHead className="text-right">Débito</TableHead><TableHead className="text-right">Crédito</TableHead>{podeAprovar && <TableHead>Última ação</TableHead>}{podeGerenciar && <TableHead></TableHead>}</TableRow></TableHeader>
              <TableBody>{lancamentosFluxo.length===0?<TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">{buscaFluxo.trim() ? 'Nenhum lançamento encontrado para a busca.' : 'Nenhum lançamento.'}</TableCell></TableRow>:lancamentosFluxo.map((l: Registro) => {
                const corP54 = corHexValida(l.sinalizacao_cor) ? (l.sinalizacao_cor as string).trim() : null;
                return (
                <TableRow
                  key={l.id}
                  style={corP54 ? { boxShadow: `inset 4px 0 0 0 ${corP54}`, backgroundColor: corFundoTranslucido(corP54) } : undefined}
                >
                  <TableCell><BadgeStatus status={l.status}/></TableCell>
                  <TableCell>{dataPt(l.data_prevista)}</TableCell>
                  <TableCell>{dataPt(l.data_realizada)}</TableCell>
                  <TableCell className="min-w-[280px]">
                    <div className="font-medium">{l.descricao}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {l.origem_tipo === 'pagina54' && <span>Página54 · linha {l.planilha_linha ?? '—'}</span>}
                      {l.pagina54_integracao_id && <span className="max-w-[180px] truncate font-mono">ID {l.pagina54_integracao_id}</span>}
                      {l.pagina54_sync_status && <span>Sync: {l.pagina54_sync_status}</span>}
                      {l.pagina54_sync_erro && <span className="text-red-600">Erro: {l.pagina54_sync_erro}</span>}
                      {corP54 && (
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full border border-border" style={{ backgroundColor: corP54 }} />
                          Cor Página54
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{l.categoria||'—'}</TableCell>
                  <TableCell>{l.subcategoria||'—'}</TableCell>
                  <TableCell>{l.projeto_centro_custo||'—'}</TableCell>
                  <TableCell className="text-right">{l.tipo==='saida'?moeda(l.valor_realizado??l.valor_previsto):'—'}</TableCell>
                  <TableCell className="text-right">{l.tipo==='entrada'?moeda(l.valor_realizado??l.valor_previsto):'—'}</TableCell>
                  {podeAprovar && <TableCell>{(() => { const a=ultimoAtorLancamento(l.id); return a ? <div className="text-xs"><div className="font-medium">{a.usuario_nome||'Usuário'}</div><div className="text-muted-foreground">{String(a.acao||'').replace(/_/g,' ')} · {new Date(a.created_at).toLocaleString('pt-BR')}</div></div> : '—'; })()}</TableCell>}
                  {podeGerenciar && <TableCell className="text-right">{l.tipo==='saida' && !['pago','conciliado','cancelado'].includes(l.status) && !l.liberado_programacao_em ? <Button size="sm" variant="outline" onClick={()=>void liberarParaProgramacao(l.id)}>Liberar p/ programação</Button> : l.liberado_programacao_em ? <Badge variant="outline">Liberado</Badge> : null}</TableCell>}
                </TableRow>
                );
              })}</TableBody></Table>
            </CardContent>
          </Card>
        </TabsContent>}

        {podeGerenciar && <TabsContent value="pn" className="mt-5">
          <Card><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>PN — Previsão de Necessidade</CardTitle><CardDescription>Anexo A do procedimento. PN automática de RC ou manual para serviços, viagens, impostos e demais necessidades fora do estoque.</CardDescription></div>
          {podeGerenciar&&<Dialog open={dialogPn} onOpenChange={setDialogPn}><DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4"/>Nova PN</Button></DialogTrigger><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Formulário PN</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Solicitante / área"><Input value={pnForm.area} onChange={(e)=>setPnForm({...pnForm,area:e.target.value})}/></Field>
              <Field label="Projeto / obra / centro de custo"><Input value={pnForm.projeto} onChange={(e)=>setPnForm({...pnForm,projeto:e.target.value})}/></Field>
              <Field label="Descrição da necessidade" className="sm:col-span-2"><Textarea value={pnForm.descricao} onChange={(e)=>setPnForm({...pnForm,descricao:e.target.value})}/></Field>
              <Field label="Especificação / quantidade" className="sm:col-span-2"><Input value={pnForm.especificacao} onChange={(e)=>setPnForm({...pnForm,especificacao:e.target.value})}/></Field>
              <Field label="Data em que será necessária"><Input type="date" value={pnForm.dataNecessidade} onChange={(e)=>setPnForm({...pnForm,dataNecessidade:e.target.value})}/></Field>
              <Field label="Valor estimado"><Input value={pnForm.valor} onChange={(e)=>setPnForm({...pnForm,valor:e.target.value})}/></Field>
              <Field label="Base da estimativa"><Input value={pnForm.baseEstimativa} onChange={(e)=>setPnForm({...pnForm,baseEstimativa:e.target.value})} placeholder="Histórico / cotação prévia / estimativa técnica"/></Field>
              <Field label="Data provável de desembolso"><Input type="date" value={pnForm.dataDesembolso} onChange={(e)=>setPnForm({...pnForm,dataDesembolso:e.target.value})}/></Field>
              <Field label="Urgência"><Select value={pnForm.urgencia} onValueChange={(v)=>setPnForm({...pnForm,urgencia:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="alta">Atenção</SelectItem><SelectItem value="urgente">Crítica</SelectItem></SelectContent></Select></Field>
              <Field label="Categoria"><Select value={pnForm.categoria || undefined} onValueChange={(v)=>setPnForm({...pnForm,categoria:v,subcategoria:''})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{categorias.filter(c=>c.ativo).map(c=><SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Subcategoria"><Select value={pnForm.subcategoria || undefined} onValueChange={(v)=>setPnForm({...pnForm,subcategoria:v})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{subcategoriasPermitidas(pnForm.categoria).map(s=><SelectItem key={s.id} value={s.nome}>{s.nome}{s.revisao_pendente?' · revisar':''}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Justificativa / impacto se não atendida" className="sm:col-span-2"><Textarea value={pnForm.justificativa} onChange={(e)=>setPnForm({...pnForm,justificativa:e.target.value})}/></Field>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setDialogPn(false)}>Cancelar</Button><Button onClick={()=>void criarPn()}>Registrar PN</Button></DialogFooter>
          </DialogContent></Dialog>}</CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Necessidades canceladas ficam no histórico e não representam uma compra pendente.</p>
              <Button variant="outline" size="sm" aria-pressed={mostrarPnCanceladas}
                onClick={() => setMostrarPnCanceladas((atual) => !atual)}>
                {mostrarPnCanceladas ? 'Ocultar canceladas' : 'Mostrar canceladas (histórico)'}
              </Button>
            </div>
            <Table><TableHeader><TableRow><TableHead>PN</TableHead><TableHead>Status</TableHead><TableHead>Origem</TableHead><TableHead>Área</TableHead><TableHead>Descrição</TableHead><TableHead>Projeto / Centro</TableHead><TableHead>Data necessária</TableHead><TableHead className="text-right">Valor estimado</TableHead></TableRow></TableHeader>
          <TableBody>{necessidadesVisiveis.length===0?<TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhuma PN.</TableCell></TableRow>:necessidadesVisiveis.map(n=><TableRow key={n.id}><TableCell className="font-medium">PN-{String(n.numero).padStart(4,'0')}</TableCell><TableCell><BadgeStatus status={n.status}/></TableCell><TableCell>{n.origem_tipo==='rc'?'RC':n.origem_tipo}</TableCell><TableCell>{n.area_solicitante||n.solicitante_nome||'—'}</TableCell><TableCell className="min-w-[260px]">{n.descricao}</TableCell><TableCell>{n.projeto_centro_custo||'—'}</TableCell><TableCell>{dataPt(n.data_necessidade)}</TableCell><TableCell className="text-right">{moeda(n.valor_estimado)}{n.estimativa_incompleta&&<span className="ml-1 text-xs text-amber-600">parcial</span>}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>}

        {(podeGerenciar || podeAprovar) && <TabsContent value="rc" className="mt-5">
          <Card><CardHeader><CardTitle>RC — Requisição de Compra</CardTitle><CardDescription>Anexo B. O atual fluxo operacional de compra foi mantido e recebe agora os campos de cotação, impacto financeiro e validações.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>RC</TableHead><TableHead>PN</TableHead><TableHead>Status financeiro</TableHead><TableHead>Origem</TableHead><TableHead>Data necessária</TableHead><TableHead className="text-right">Cotado</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>{rcs.length===0?<TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma RC.</TableCell></TableRow>:rcs.map(r=><TableRow key={r.id}><TableCell className="font-medium">RC-{String(r.numero).padStart(4,'0')}</TableCell><TableCell>{r.pn_origem_id?'Vinculada':'—'}</TableCell><TableCell><BadgeStatus status={r.status_financeiro_rc}/></TableCell><TableCell>{r.solicitacao_material_numero? `Solicitação #${r.solicitacao_material_numero}`:'Manual'}</TableCell><TableCell>{dataPt(r.data_necessaria)}</TableCell><TableCell className="text-right">{moeda(r.valor_estimado_cotado)}</TableCell><TableCell><Button size="sm" variant="outline" onClick={()=>abrirRc(r)}>Abrir formulário</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

          <Dialog open={dialogRc} onOpenChange={setDialogRc}><DialogContent className="sm:max-w-4xl"><DialogHeader><DialogTitle>Formulário RC {selecionado? `#${selecionado.numero}`:''}</DialogTitle></DialogHeader>
            <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              <Field label="PN de origem"><Input value={selecionado?.pn_origem_id?'PN vinculada automaticamente':'Sem PN vinculada'} disabled/></Field>
              <Field label="Projeto / OP / centro de custo"><Input value={rcForm.projeto_centro_custo||''} onChange={(e)=>setRcForm({...rcForm,projeto_centro_custo:e.target.value})}/></Field>
              <Field label="Especificação técnica" className="sm:col-span-2"><Textarea value={rcForm.especificacao_tecnica||''} onChange={(e)=>setRcForm({...rcForm,especificacao_tecnica:e.target.value})}/></Field>
              <Field label="Data necessária"><Input type="date" value={rcForm.data_necessaria||''} onChange={(e)=>setRcForm({...rcForm,data_necessaria:e.target.value})}/></Field>
              <Field label="Conferência de estoque"><Input value={rcForm.conferencia_estoque||''} onChange={(e)=>setRcForm({...rcForm,conferencia_estoque:e.target.value})} placeholder="Saldo / reserva / trânsito / reaproveitamento"/></Field>
              <Field label="Fornecedor(es) consultado(s)" className="sm:col-span-2"><Textarea value={rcForm.fornecedores_consultados||''} onChange={(e)=>setRcForm({...rcForm,fornecedores_consultados:e.target.value})}/></Field>
              <Field label="Valor estimado / cotado"><Input value={rcForm.valor_estimado_cotado??''} onChange={(e)=>setRcForm({...rcForm,valor_estimado_cotado:e.target.value})}/></Field>
              <Field label="Frete / custos adicionais"><Input value={rcForm.frete_custos_adicionais??''} onChange={(e)=>setRcForm({...rcForm,frete_custos_adicionais:e.target.value})}/></Field>
              <Field label="Condição de pagamento"><Input value={rcForm.condicao_pagamento||''} onChange={(e)=>setRcForm({...rcForm,condicao_pagamento:e.target.value})}/></Field>
              <Field label="Lead time (dias)"><Input type="number" value={rcForm.lead_time_dias??''} onChange={(e)=>setRcForm({...rcForm,lead_time_dias:e.target.value})}/></Field>
              <Field label="Data-limite de compra"><Input type="date" value={rcForm.data_limite_compra||''} onChange={(e)=>setRcForm({...rcForm,data_limite_compra:e.target.value})}/></Field>
              <Field label="Status"><Select value={rcForm.status_financeiro_rc||'em_cotacao'} onValueChange={(v)=>setRcForm({...rcForm,status_financeiro_rc:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="em_cotacao">Em cotação</SelectItem><SelectItem value="aguardando_aprovacao">Aguardando aprovação</SelectItem><SelectItem value="aprovada">Aprovada</SelectItem><SelectItem value="rejeitada">Rejeitada</SelectItem><SelectItem value="convertida_em_pc">Convertida em PC</SelectItem></SelectContent></Select></Field>
              <Field label="Impacto atualizado por Kátia" className="sm:col-span-2"><Textarea value={rcForm.impacto_financeiro||''} onChange={(e)=>setRcForm({...rcForm,impacto_financeiro:e.target.value})} placeholder="Datas e valores no fluxo"/></Field>
              <div className="sm:col-span-2 rounded-md border p-3 text-sm">
                <p className="font-medium">Validações da RC</p>
                <div className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
                  <span>Estoque conferido: {rcForm.estoque_conferido_por||'pendente'}</span>
                  <span>Especificação confirmada: {rcForm.especificacao_confirmada_por||'pendente'}</span>
                  <span>Impacto financeiro: {rcForm.impacto_financeiro_registrado_por||'pendente'}</span>
                  <span>Aprovação executiva: {rcForm.aprovacao_executiva_por||'pendente'}</span>
                </div>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setDialogRc(false)}>Fechar</Button>{podeGerenciar&&<Button onClick={()=>void salvarRc()}>Salvar RC</Button>}</DialogFooter>
          </DialogContent></Dialog>
        </TabsContent>}

        {(podeGerenciar || podeAprovar) && <TabsContent value="pc" className="mt-5">
          <Card><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>PC — Pedido de Compra Formal</CardTitle><CardDescription>Anexo C. Só deve representar compromisso efetivamente assumido com fornecedor após aprovação.</CardDescription></div>
          {canManageFinanceiro()&&<Dialog open={dialogPc} onOpenChange={setDialogPc}><DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4"/>Novo PC</Button></DialogTrigger><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Formulário PC</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="RC de origem"><Select value={pcForm.rcId} onValueChange={(v)=>setPcForm({...pcForm,rcId:v})}><SelectTrigger><SelectValue placeholder="Selecione a RC"/></SelectTrigger><SelectContent>{rcs.filter(r=>r.status_financeiro_rc!=='convertida_em_pc').map(r=><SelectItem key={r.id} value={r.id}>RC-{String(r.numero).padStart(4,'0')}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Fornecedor"><Input value={pcForm.fornecedor} onChange={(e)=>setPcForm({...pcForm,fornecedor:e.target.value})}/></Field>
              <Field label="CNPJ / identificação"><Input value={pcForm.identificacao} onChange={(e)=>setPcForm({...pcForm,identificacao:e.target.value})}/></Field>
              <Field label="Contato"><Input value={pcForm.contato} onChange={(e)=>setPcForm({...pcForm,contato:e.target.value})}/></Field>
              <Field label="Descrição do pedido" className="sm:col-span-2"><Textarea value={pcForm.descricao} onChange={(e)=>setPcForm({...pcForm,descricao:e.target.value})}/></Field>
              <Field label="Valor dos itens"><Input value={pcForm.valorItens} onChange={(e)=>setPcForm({...pcForm,valorItens:e.target.value})}/></Field>
              <Field label="Frete / custos adicionais"><Input value={pcForm.frete} onChange={(e)=>setPcForm({...pcForm,frete:e.target.value})}/></Field>
              <Field label="Condição de pagamento"><Input value={pcForm.condicao} onChange={(e)=>setPcForm({...pcForm,condicao:e.target.value})}/></Field>
              <Field label="Prazo de entrega"><Input value={pcForm.prazo} onChange={(e)=>setPcForm({...pcForm,prazo:e.target.value})}/></Field>
              <Field label="Local de entrega" className="sm:col-span-2"><Input value={pcForm.local} onChange={(e)=>setPcForm({...pcForm,local:e.target.value})}/></Field>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setDialogPc(false)}>Cancelar</Button><Button onClick={()=>void criarPc()}>Criar PC formal</Button></DialogFooter>
          </DialogContent></Dialog>}</CardHeader>
          <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>PC</TableHead><TableHead>Fornecedor</TableHead><TableHead>Descrição</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Itens</TableHead><TableHead className="text-right">Frete</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Aprovação Mauro</TableHead></TableRow></TableHeader>
          <TableBody>{pcs.length===0?<TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhum PC formal criado.</TableCell></TableRow>:pcs.map(pc=><TableRow key={pc.id}><TableCell className="font-medium">PC-{String(pc.numero).padStart(4,'0')}</TableCell><TableCell>{pc.fornecedor}</TableCell><TableCell className="min-w-[220px]">{pc.descricao}</TableCell><TableCell><BadgeStatus status={pc.status}/></TableCell><TableCell className="text-right">{moeda(pc.valor_itens)}</TableCell><TableCell className="text-right">{moeda(pc.frete_custos_adicionais)}</TableCell><TableCell className="text-right">{moeda(pc.valor_total)}</TableCell><TableCell>{pc.aprovacao_mauro_em?dataPt(pc.aprovacao_mauro_em):canApproveFinanceiro()?'Pendente':'—'}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>}

        {podeProgramar && <TabsContent value="programacao" className="mt-5">
          <Card><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>Programação Bancária</CardTitle><CardDescription>Fila formal Kátia → Guto. Programação bancária não substitui o planejamento.</CardDescription></div>
          {(canManageFinanceiro()||canProgramFinanceiro())&&<Dialog open={dialogProgramacao} onOpenChange={setDialogProgramacao}><DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4"/>Nova programação</Button></DialogTrigger><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Programação bancária</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Lançamento"><Select value={programacaoForm.lancamentoId} onValueChange={(v)=>setProgramacaoForm({...programacaoForm,lancamentoId:v})}><SelectTrigger><SelectValue placeholder="Selecione o lançamento"/></SelectTrigger><SelectContent>{lancamentos.filter(l=>l.tipo==='saida'&&l.liberado_programacao_em&&!['cancelado','pago','conciliado'].includes(l.status)).map(l=><SelectItem key={l.id} value={l.id}>{l.descricao.slice(0,60)} · {moeda(l.valor_previsto)}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Beneficiário"><Input value={programacaoForm.beneficiario} onChange={(e)=>setProgramacaoForm({...programacaoForm,beneficiario:e.target.value})}/></Field>
              <Field label="Valor"><Input value={programacaoForm.valor} onChange={(e)=>setProgramacaoForm({...programacaoForm,valor:e.target.value})}/></Field>
              <Field label="Vencimento"><Input type="date" value={programacaoForm.vencimento} onChange={(e)=>setProgramacaoForm({...programacaoForm,vencimento:e.target.value})}/></Field>
              <Field label="Data programada"><Input type="date" value={programacaoForm.dataProgramada} onChange={(e)=>setProgramacaoForm({...programacaoForm,dataProgramada:e.target.value})}/></Field>
              <Field label="Banco / conta"><Input value={programacaoForm.bancoConta} onChange={(e)=>setProgramacaoForm({...programacaoForm,bancoConta:e.target.value})}/></Field>
              <Field label="Forma de pagamento"><Input value={programacaoForm.formaPagamento} onChange={(e)=>setProgramacaoForm({...programacaoForm,formaPagamento:e.target.value})}/></Field>
              <Field label="Categoria"><Select value={programacaoForm.categoria || undefined} onValueChange={(v)=>setProgramacaoForm({...programacaoForm,categoria:v})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{categorias.filter(c=>c.ativo).map(c=><SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Projeto / centro de custo"><Input value={programacaoForm.projeto} onChange={(e)=>setProgramacaoForm({...programacaoForm,projeto:e.target.value})}/></Field>
              <Field label="Observação" className="sm:col-span-2"><Textarea value={programacaoForm.observacao} onChange={(e)=>setProgramacaoForm({...programacaoForm,observacao:e.target.value})}/></Field>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setDialogProgramacao(false)}>Cancelar</Button><Button onClick={()=>void salvarProgramacao()}>Registrar</Button></DialogFooter>
          </DialogContent></Dialog>}</CardHeader>
          <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Beneficiário</TableHead><TableHead>Vencimento</TableHead><TableHead>Programar em</TableHead><TableHead>Banco</TableHead><TableHead>Projeto</TableHead><TableHead className="text-right">Valor</TableHead>{podeAprovar && <TableHead>Registrado por</TableHead>}</TableRow></TableHeader><TableBody>{programacoes.length===0?<TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhuma programação.</TableCell></TableRow>:programacoes.map(p=><TableRow key={p.id}><TableCell><BadgeStatus status={p.status}/></TableCell><TableCell>{p.beneficiario}</TableCell><TableCell>{dataPt(p.vencimento)}</TableCell><TableCell>{dataPt(p.data_programada)}</TableCell><TableCell>{p.banco_conta||'—'}</TableCell><TableCell>{p.projeto_centro_custo||'—'}</TableCell><TableCell className="text-right">{moeda(p.valor)}</TableCell>{podeAprovar && <TableCell><div className="text-xs"><div className="font-medium">{p.registrado_por_nome||'—'}</div><div className="text-muted-foreground">{p.programado_por_guto_em?new Date(p.programado_por_guto_em).toLocaleString('pt-BR'):'—'}</div></div></TableCell>}</TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>}

        {podeConciliar && <TabsContent value="conciliacao" className="mt-5">
          <Card><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>Conciliação Bancária e Desvios</CardTitle><CardDescription>Anexo E. Registra o que aconteceu no banco, se estava previsto e qual tratamento a divergência recebeu.</CardDescription></div>
          {canConciliarFinanceiro()&&<Dialog open={dialogConciliacao} onOpenChange={setDialogConciliacao}><DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4"/>Registrar movimentação</Button></DialogTrigger><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Movimentação / divergência</DialogTitle></DialogHeader>
            {conciliacaoForm.previsto === 'nao' && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div><p className="font-medium">Movimentação não prevista</p><p className="text-muted-foreground">Será registrada como ocorrência financeira de desvio. Justificativa, responsável e prazo de regularização são obrigatórios.</p></div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data"><Input type="date" value={conciliacaoForm.data} onChange={(e)=>setConciliacaoForm({...conciliacaoForm,data:e.target.value})}/></Field>
              <Field label="Banco / conta"><Select value={conciliacaoForm.contaId} onValueChange={(v)=>setConciliacaoForm({...conciliacaoForm,contaId:v})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{contas.map(c=><SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Histórico / beneficiário" className="sm:col-span-2"><Input value={conciliacaoForm.historico} onChange={(e)=>setConciliacaoForm({...conciliacaoForm,historico:e.target.value})}/></Field>
              <Field label="Estava previsto?"><Select value={conciliacaoForm.previsto} onValueChange={(v)=>setConciliacaoForm({...conciliacaoForm,previsto:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem></SelectContent></Select></Field>
              <Field label="Tipo"><Select value={conciliacaoForm.tipo} onValueChange={(v)=>setConciliacaoForm({...conciliacaoForm,tipo:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="saida">Saída</SelectItem><SelectItem value="entrada">Entrada</SelectItem></SelectContent></Select></Field>
              <Field label="Valor realizado"><Input value={conciliacaoForm.valor} onChange={(e)=>setConciliacaoForm({...conciliacaoForm,valor:e.target.value})}/></Field>
              <Field label="Valor previsto"><Input value={conciliacaoForm.valorPrevisto} onChange={(e)=>setConciliacaoForm({...conciliacaoForm,valorPrevisto:e.target.value})}/></Field>
              <Field label="Data prevista"><Input type="date" value={conciliacaoForm.dataPrevista} onChange={(e)=>setConciliacaoForm({...conciliacaoForm,dataPrevista:e.target.value})}/></Field>
              <Field label="Tratamento / status"><Select value={conciliacaoForm.tratamento} onValueChange={(v)=>setConciliacaoForm({...conciliacaoForm,tratamento:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="em_apuracao">Em apuração</SelectItem><SelectItem value="identificado">Identificado</SelectItem><SelectItem value="regularizado">Regularizado</SelectItem><SelectItem value="conciliado">Conciliado</SelectItem></SelectContent></Select></Field>
              <Field label="Responsável pela regularização"><Input value={conciliacaoForm.responsavel} onChange={(e)=>setConciliacaoForm({...conciliacaoForm,responsavel:e.target.value})}/></Field>
              <Field label="Prazo da regularização"><Input type="date" value={conciliacaoForm.prazo} onChange={(e)=>setConciliacaoForm({...conciliacaoForm,prazo:e.target.value})}/></Field>
              <Field label="Tratamento / observação" className="sm:col-span-2"><Textarea value={conciliacaoForm.observacao} onChange={(e)=>setConciliacaoForm({...conciliacaoForm,observacao:e.target.value})}/></Field>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setDialogConciliacao(false)}>Cancelar</Button><Button onClick={()=>void salvarConciliacao()}>Registrar</Button></DialogFooter>
          </DialogContent></Dialog>}</CardHeader>
          <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Conta</TableHead><TableHead>Histórico / beneficiário</TableHead><TableHead>Previsto?</TableHead><TableHead>Tratamento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Responsável / prazo</TableHead>{podeAprovar && <TableHead>Registrado por</TableHead>}</TableRow></TableHeader><TableBody>{conciliacoes.length===0?<TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhuma movimentação em conciliação.</TableCell></TableRow>:conciliacoes.map(c=><TableRow key={c.id}><TableCell>{dataPt(c.data)}</TableCell><TableCell>{contaNome(c.conta_bancaria_id)}</TableCell><TableCell className="min-w-[220px]">{c.historico_beneficiario}</TableCell><TableCell>{c.estava_previsto===true?'Sim':c.estava_previsto===false?'Não':'—'}</TableCell><TableCell><BadgeStatus status={c.tratamento_status}/></TableCell><TableCell className="text-right">{moeda(c.valor)}</TableCell><TableCell>{c.responsavel_regularizacao||'—'}{c.prazo_regularizacao?` · ${dataPt(c.prazo_regularizacao)}`:''}</TableCell>{podeAprovar && <TableCell><div className="text-xs"><div className="font-medium">{c.registrado_por_nome||'—'}</div><div className="text-muted-foreground">{c.created_at?new Date(c.created_at).toLocaleString('pt-BR'):'—'}</div></div></TableCell>}</TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>}

        {podeGerenciar && <TabsContent value="projecoes" className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader><CardDescription>Próximos 14 dias</CardDescription><CardTitle>{moeda(projecoes.entradas14 - projecoes.saidas14)}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Entradas {moeda(projecoes.entradas14)} · Saídas {moeda(projecoes.saidas14)}</CardContent></Card>
            <Card><CardHeader><CardDescription>13 semanas</CardDescription><CardTitle>{moeda(projecoes.entradas13s - projecoes.saidas13s)}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Entradas {moeda(projecoes.entradas13s)} · Saídas {moeda(projecoes.saidas13s)}</CardContent></Card>
            <Card><CardHeader><CardDescription>6 meses</CardDescription><CardTitle>{moeda(projecoes.entradas6m - projecoes.saidas6m)}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Entradas {moeda(projecoes.entradas6m)} · Saídas {moeda(projecoes.saidas6m)}</CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Horizontes do procedimento</CardTitle><CardDescription>Os valores acima são calculados diretamente dos lançamentos previstos atuais. O horizonte anual será acrescentado quando houver base suficiente de compromissos e recebimentos futuros.</CardDescription></CardHeader>
            <CardContent><div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-4"><CalendarRange className="mb-2 h-5 w-5"/><p className="font-medium">14 dias</p><p className="text-sm text-muted-foreground">Pressão imediata de caixa e decisões urgentes.</p></div>
              <div className="rounded-lg border p-4"><ClipboardList className="mb-2 h-5 w-5"/><p className="font-medium">13 semanas</p><p className="text-sm text-muted-foreground">Fluxo móvel semanal para operação e sazonal.</p></div>
              <div className="rounded-lg border p-4"><Banknote className="mb-2 h-5 w-5"/><p className="font-medium">6 meses</p><p className="text-sm text-muted-foreground">Visão mensal de compromissos, recebimentos e risco de caixa.</p></div>
            </div></CardContent>
          </Card>
        </TabsContent>}

        {podeRelatorios && (
          <TabsContent value="relatorios" className="mt-5">
            <FinanceiroRelatorios lancamentos={lancamentos} posicoes={posicoes} contas={contas} />
          </TabsContent>
        )}

        {podeGerenciar && <TabsContent value="configuracoes" className="mt-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Financeiro</CardTitle>
              <CardDescription>
                Parametrizações do módulo. Cada item fica recolhido por padrão; clique no card para expandir e administrar suas opções.
              </CardDescription>
            </CardHeader>
          </Card>

          <details className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-semibold">Categorias</p>
                <p className="mt-1 text-sm text-muted-foreground">{categorias.length} categoria(s) cadastrada(s)</p>
              </div>
              <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t px-5 py-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Categorias usadas nos lançamentos financeiros. As importadas da planilha permanecem identificadas pela origem.
                </p>
                <Dialog open={dialogCategoria} onOpenChange={setDialogCategoria}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4"/>Nova categoria</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nova categoria financeira</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Field label="Nome"><Input value={categoriaForm.nome} onChange={(e)=>setCategoriaForm({...categoriaForm,nome:e.target.value})} placeholder="Ex.: CUSTO"/></Field>
                      <Field label="Observação"><Textarea value={categoriaForm.observacao} onChange={(e)=>setCategoriaForm({...categoriaForm,observacao:e.target.value})}/></Field>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={()=>setDialogCategoria(false)}>Cancelar</Button><Button onClick={()=>void criarCategoria()}>Criar categoria</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table><TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Origem</TableHead><TableHead>Status</TableHead><TableHead>Observação</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>{categorias.map(c=><TableRow key={c.id}><TableCell className="font-medium">{c.nome}</TableCell><TableCell>{c.origem_planilha?'Planilha histórica':'Sistema'}</TableCell><TableCell>{c.ativo?'Ativa':'Inativa'}</TableCell><TableCell>{c.observacao||'—'}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={()=>void alternarAtivo('financeiro_categorias',c)}>{c.ativo?'Inativar':'Ativar'}</Button></TableCell></TableRow>)}</TableBody></Table>
              </div>
            </div>
          </details>

          <details className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-semibold">Subcategorias</p>
                <p className="mt-1 text-sm text-muted-foreground">{subcategorias.length} subcategoria(s) cadastrada(s)</p>
              </div>
              <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t px-5 py-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Subcategorias e seus vínculos com categorias. Esse mesmo padrão de card expansível deve ser usado para novas parametrizações do Financeiro.
                </p>
                <Dialog open={dialogSubcategoria} onOpenChange={setDialogSubcategoria}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4"/>Nova subcategoria</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nova subcategoria financeira</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Field label="Nome"><Input value={subcategoriaForm.nome} onChange={(e)=>setSubcategoriaForm({...subcategoriaForm,nome:e.target.value})} placeholder="Ex.: FIXO"/></Field>
                      <Field label="Categoria relacionada (opcional)"><Select value={subcategoriaForm.categoriaId || undefined} onValueChange={(v)=>setSubcategoriaForm({...subcategoriaForm,categoriaId:v})}><SelectTrigger><SelectValue placeholder="Sem vínculo obrigatório"/></SelectTrigger><SelectContent>{categorias.filter(c=>c.ativo).map(c=><SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></Field>
                      <Field label="Observação"><Textarea value={subcategoriaForm.observacao} onChange={(e)=>setSubcategoriaForm({...subcategoriaForm,observacao:e.target.value})}/></Field>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={()=>setDialogSubcategoria(false)}>Cancelar</Button><Button onClick={()=>void criarSubcategoria()}>Criar subcategoria</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table><TableHeader><TableRow><TableHead>Subcategoria</TableHead><TableHead>Origem</TableHead><TableHead>Status</TableHead><TableHead>Revisão</TableHead><TableHead>Relacionada a</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>{subcategorias.map(s=>{const rels=categoriaSubcategorias.filter(r=>r.subcategoria_id===s.id).map(r=>categorias.find(c=>c.id===r.categoria_id)?.nome).filter(Boolean);return <TableRow key={s.id}><TableCell className="font-medium">{s.nome}</TableCell><TableCell>{s.origem_planilha?'Planilha histórica':'Sistema'}</TableCell><TableCell>{s.ativo?'Ativa':'Inativa'}</TableCell><TableCell>{s.revisao_pendente?<Badge variant="outline">Revisar</Badge>:'—'}</TableCell><TableCell>{rels.length?rels.join(', '):'Sem vínculo específico'}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={()=>void alternarAtivo('financeiro_subcategorias',s)}>{s.ativo?'Inativar':'Ativar'}</Button></TableCell></TableRow>})}</TableBody></Table>
              </div>
            </div>
          </details>
        </TabsContent>}
      </Tabs>

      {loading && <div className="text-sm text-muted-foreground">Atualizando informações financeiras...</div>}
      {!loading && indicadores.semValor > 0 && <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><AlertTriangle className="h-4 w-4 text-amber-600"/><span>{indicadores.semValor} necessidade(s) ainda possuem valor ausente ou estimativa parcial.</span></div>}
      {!loading && indicadores.abertas > 0 && <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4"/><span>Rastreabilidade ativa: PN, RC, PC, programação e conciliação permanecem em estruturas separadas, mas relacionadas.</span></div>}
    </div>
  );
};
