import { useEffect, useMemo, useState } from 'react';
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
import { AlertTriangle, BanknoteArrowDown, CircleDollarSign, FileClock, Plus, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

type Necessidade = {
  id: string;
  numero: number;
  status: string;
  origem_tipo: string;
  origem_modulo: string | null;
  descricao: string;
  solicitante_nome: string | null;
  valor_estimado: number | null;
  estimativa_incompleta: boolean;
  data_necessidade: string | null;
  data_prevista_desembolso: string | null;
  urgencia: string;
  projeto_centro_custo: string | null;
  categoria: string | null;
  subcategoria: string | null;
  requisicao_compra_id: string | null;
  created_at: string;
};

type Lancamento = {
  id: string;
  numero: number;
  tipo: 'entrada' | 'saida';
  status: string;
  descricao: string;
  categoria: string | null;
  subcategoria: string | null;
  projeto_centro_custo: string | null;
  data_prevista: string | null;
  data_realizada: string | null;
  valor_previsto: number | null;
  valor_realizado: number | null;
  origem_tipo: string | null;
  created_at: string;
};

const moeda = (valor: number | null | undefined) =>
  valor == null
    ? 'A definir'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const dataPt = (valor: string | null | undefined) => {
  if (!valor) return '—';
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
};

const statusLabel: Record<string, string> = {
  previsto: 'Previsto',
  em_definicao: 'Em definição',
  em_cotacao: 'Em cotação',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  comprometido: 'Comprometido',
  solicitado: 'Solicitado',
  programado: 'Programado',
  pago: 'Pago',
  conciliado: 'Conciliado',
  cancelado: 'Cancelado',
};

export const Financeiro = () => {
  const { canManageFinanceiro } = usePermissions();
  const [necessidades, setNecessidades] = useState<Necessidade[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogoNovo, setDialogoNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    dataNecessidade: '',
    dataDesembolso: '',
    urgencia: 'normal',
    projetoCentroCusto: '',
    categoria: '',
    subcategoria: '',
  });

  const carregar = async () => {
    setLoading(true);
    try {
      const [{ data: necessidadesData, error: necessidadesError }, { data: lancamentosData, error: lancamentosError }] =
        await Promise.all([
          (supabase as any)
            .from('financeiro_necessidades')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(250),
          (supabase as any)
            .from('financeiro_lancamentos')
            .select('*')
            .order('data_prevista', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(500),
        ]);

      if (necessidadesError) throw necessidadesError;
      if (lancamentosError) throw lancamentosError;

      setNecessidades((necessidadesData ?? []) as Necessidade[]);
      setLancamentos((lancamentosData ?? []) as Lancamento[]);
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error);
      toast.error('Não foi possível carregar o Financeiro.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();

    const channel = supabase
      .channel('financeiro-fase1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_necessidades' }, () => void carregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_lancamentos' }, () => void carregar())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const indicadores = useMemo(() => {
    const abertas = necessidades.filter((item) => item.status !== 'cancelado');
    const semValor = abertas.filter((item) => item.valor_estimado == null || item.estimativa_incompleta);
    const aguardandoAprovacao = abertas.filter((item) => item.status === 'aguardando_aprovacao');
    const previstoSaida = lancamentos
      .filter((item) => item.tipo === 'saida' && !['cancelado', 'pago', 'conciliado'].includes(item.status))
      .reduce((total, item) => total + Number(item.valor_previsto || 0), 0);

    return {
      abertas: abertas.length,
      semValor: semValor.length,
      aguardandoAprovacao: aguardandoAprovacao.length,
      previstoSaida,
    };
  }, [necessidades, lancamentos]);

  const criarNecessidade = async () => {
    if (!form.descricao.trim()) {
      toast.error('Informe a descrição da necessidade.');
      return;
    }

    const valor = form.valor.trim()
      ? Number(form.valor.replace(/./g, '').replace(',', '.'))
      : null;

    if (valor != null && (!Number.isFinite(valor) || valor < 0)) {
      toast.error('Informe um valor estimado válido.');
      return;
    }

    setSalvando(true);
    try {
      const { error } = await (supabase as any).rpc('financeiro_criar_necessidade_manual', {
        p_descricao: form.descricao.trim(),
        p_valor_estimado: valor,
        p_data_necessidade: form.dataNecessidade || null,
        p_data_prevista_desembolso: form.dataDesembolso || null,
        p_urgencia: form.urgencia,
        p_projeto_centro_custo: form.projetoCentroCusto.trim() || null,
        p_categoria: form.categoria.trim() || null,
        p_subcategoria: form.subcategoria.trim() || null,
      });

      if (error) throw error;

      toast.success('Necessidade financeira registrada.');
      setDialogoNovo(false);
      setForm({
        descricao: '',
        valor: '',
        dataNecessidade: '',
        dataDesembolso: '',
        urgencia: 'normal',
        projetoCentroCusto: '',
        categoria: '',
        subcategoria: '',
      });
      await carregar();
    } catch (error) {
      console.error('Erro ao criar necessidade financeira:', error);
      toast.error('Não foi possível registrar a necessidade.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Financeiro</h2>
          <p className="text-sm text-muted-foreground">
            Previsões e necessidades integradas aos processos operacionais. Nesta fase, novas RCs alimentam automaticamente o fluxo previsto.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>

          {canManageFinanceiro() && (
            <Dialog open={dialogoNovo} onOpenChange={setDialogoNovo}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova necessidade
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nova necessidade financeira</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={form.descricao}
                      onChange={(e) => setForm((atual) => ({ ...atual, descricao: e.target.value }))}
                      placeholder="Ex.: Frete Maringá → Brusque"
                    />
                  </div>
                  <div>
                    <Label>Valor estimado</Label>
                    <Input
                      value={form.valor}
                      onChange={(e) => setForm((atual) => ({ ...atual, valor: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label>Urgência</Label>
                    <Select value={form.urgencia} onValueChange={(value) => setForm((atual) => ({ ...atual, urgencia: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data da necessidade</Label>
                    <Input type="date" value={form.dataNecessidade} onChange={(e) => setForm((atual) => ({ ...atual, dataNecessidade: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Data provável do desembolso</Label>
                    <Input type="date" value={form.dataDesembolso} onChange={(e) => setForm((atual) => ({ ...atual, dataDesembolso: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Projeto / Centro de custo</Label>
                    <Input value={form.projetoCentroCusto} onChange={(e) => setForm((atual) => ({ ...atual, projetoCentroCusto: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Input value={form.categoria} onChange={(e) => setForm((atual) => ({ ...atual, categoria: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Subcategoria</Label>
                    <Input value={form.subcategoria} onChange={(e) => setForm((atual) => ({ ...atual, subcategoria: e.target.value }))} />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogoNovo(false)} disabled={salvando}>Cancelar</Button>
                  <Button onClick={() => void criarNecessidade()} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Registrar necessidade'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Necessidades abertas</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl"><FileClock className="h-5 w-5" />{indicadores.abertas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Saídas previstas</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl"><BanknoteArrowDown className="h-5 w-5" />{moeda(indicadores.previstoSaida)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimativas incompletas</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl"><AlertTriangle className="h-5 w-5" />{indicadores.semValor}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aguardando aprovação</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl"><CircleDollarSign className="h-5 w-5" />{indicadores.aguardandoAprovacao}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="necessidades" className="w-full">
        <TabsList>
          <TabsTrigger value="necessidades">Necessidades / PN</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
        </TabsList>

        <TabsContent value="necessidades" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Necessidades financeiras</CardTitle>
              <CardDescription>
                PN automáticas originadas por RC e necessidades manuais que não passam pelo Almoxarifado.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PN</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Projeto / Centro</TableHead>
                    <TableHead>Necessidade</TableHead>
                    <TableHead className="text-right">Estimativa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : necessidades.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Nenhuma necessidade financeira registrada.</TableCell></TableRow>
                  ) : necessidades.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">PN-{String(item.numero).padStart(4, '0')}</TableCell>
                      <TableCell><Badge variant={item.status === 'cancelado' ? 'secondary' : 'outline'}>{statusLabel[item.status] ?? item.status}</Badge></TableCell>
                      <TableCell>{item.origem_tipo === 'rc' ? 'RC' : item.origem_tipo}</TableCell>
                      <TableCell className="min-w-[280px]">{item.descricao}</TableCell>
                      <TableCell>{item.projeto_centro_custo || '—'}</TableCell>
                      <TableCell>{dataPt(item.data_necessidade)}</TableCell>
                      <TableCell className="text-right">
                        <span>{moeda(item.valor_estimado)}</span>
                        {item.estimativa_incompleta && <span className="ml-2 text-xs text-amber-600">parcial</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Fluxo de Caixa</CardTitle>
              <CardDescription>
                Primeira visão sistêmica inspirada na Página54: previsto e realizado permanecem separados.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Situação</TableHead>
                    <TableHead>Data prevista</TableHead>
                    <TableHead>Data realizada</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Subcategoria</TableHead>
                    <TableHead>Projeto / Centro</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : lancamentos.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Nenhum lançamento financeiro registrado.</TableCell></TableRow>
                  ) : lancamentos.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Badge variant="outline">{statusLabel[item.status] ?? item.status}</Badge></TableCell>
                      <TableCell>{dataPt(item.data_prevista)}</TableCell>
                      <TableCell>{dataPt(item.data_realizada)}</TableCell>
                      <TableCell className="min-w-[280px]">{item.descricao}</TableCell>
                      <TableCell>{item.categoria || '—'}</TableCell>
                      <TableCell>{item.subcategoria || '—'}</TableCell>
                      <TableCell>{item.projeto_centro_custo || '—'}</TableCell>
                      <TableCell className="text-right">{item.tipo === 'saida' ? moeda(item.valor_realizado ?? item.valor_previsto) : '—'}</TableCell>
                      <TableCell className="text-right">{item.tipo === 'entrada' ? moeda(item.valor_realizado ?? item.valor_previsto) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
