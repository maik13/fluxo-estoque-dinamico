import { useState, type FormEvent } from 'react';
import { ClipboardList, Plus, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';

type PrevisaoNecessidade = {
  id: string;
  numero: number;
  status: string;
  area_solicitante?: string | null;
  solicitante_nome?: string | null;
  descricao?: string | null;
  especificacao?: string | null;
  projeto_centro_custo?: string | null;
  data_necessidade?: string | null;
  valor_estimado?: number | string | null;
  urgencia?: string | null;
  requisicao_compra_id?: string | null;
};

type RequisicaoCompra = {
  id: string;
  numero: number;
  status_financeiro_rc?: string | null;
};

const moeda = (valor?: number | string | null) => {
  const numero = Number(valor);
  if (valor == null || valor === '' || Number.isNaN(numero)) return 'A definir';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
};

const dataPt = (valor?: string | null) => {
  if (!valor) return '—';
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
};

const statusPn: Record<string, string> = {
  previsto: 'Prevista',
  em_cotacao: 'Em cotação',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovada',
  comprometido: 'Comprometida',
  cancelado: 'Cancelada',
};

const statusRc: Record<string, string> = {
  em_cotacao: 'Em cotação',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  convertida_em_pc: 'Convertida em PC',
};

const formularioInicial = {
  descricao: '',
  especificacao: '',
  quantidade: '',
  unidade: 'UN',
  valorEstimado: '',
  dataNecessidade: '',
  projetoCentroCusto: '',
  urgencia: 'normal',
  justificativa: '',
};

const numeroOpcional = (valor: string) => {
  const limpo = valor.trim();
  if (!limpo) return null;
  const numero = Number(limpo.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : NaN;
};

export const PrevisoesNecessidadeAlmoxarifado = () => {
  const { canCriarPrevisaoNecessidadeAlmoxarifado } = usePermissions();
  const [aberto, setAberto] = useState(false);
  const [dialogCriacao, setDialogCriacao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [pns, setPns] = useState<PrevisaoNecessidade[]>([]);
  const [rcPorId, setRcPorId] = useState<Record<string, RequisicaoCompra>>({});
  const [formulario, setFormulario] = useState(formularioInicial);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { data, error } = await (supabase as any)
        .from('financeiro_necessidades')
        .select('id, numero, status, area_solicitante, solicitante_nome, descricao, especificacao, projeto_centro_custo, data_necessidade, valor_estimado, urgencia, requisicao_compra_id')
        .eq('origem_tipo', 'solicitacao_material')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) throw error;
      const previsoes = (data ?? []) as PrevisaoNecessidade[];
      const idsRcs = previsoes
        .map((pn) => pn.requisicao_compra_id)
        .filter((id): id is string => Boolean(id));

      let rcs: RequisicaoCompra[] = [];
      if (idsRcs.length > 0) {
        const { data: dadosRcs, error: erroRcs } = await (supabase as any)
          .from('pedidos_compra')
          .select('id, numero, status_financeiro_rc')
          .in('id', idsRcs);
        if (erroRcs) throw erroRcs;
        rcs = (dadosRcs ?? []) as RequisicaoCompra[];
      }

      setPns(previsoes);
      setRcPorId(Object.fromEntries(rcs.map((rc) => [rc.id, rc])));
    } catch (error) {
      console.error('Erro ao carregar PNs do Almoxarifado:', error);
      toast.error('Não foi possível carregar as PNs do Almoxarifado.');
    } finally {
      setCarregando(false);
    }
  };

  const abrir = () => {
    setAberto(true);
    void carregar();
  };

  const criarPrevisao = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantidade = numeroOpcional(formulario.quantidade);
    const valorEstimado = numeroOpcional(formulario.valorEstimado);

    if (Number.isNaN(quantidade) || Number.isNaN(valorEstimado)) {
      toast.error('Informe quantidade e valor estimado em um formato válido.');
      return;
    }

    setSalvando(true);
    try {
      const { error } = await (supabase as any).rpc('criar_previsao_necessidade_almoxarifado', {
        p_descricao: formulario.descricao,
        p_especificacao: formulario.especificacao || null,
        p_quantidade: quantidade,
        p_unidade: formulario.unidade || null,
        p_valor_estimado: valorEstimado,
        p_data_necessidade: formulario.dataNecessidade || null,
        p_projeto_centro_custo: formulario.projetoCentroCusto || null,
        p_urgencia: formulario.urgencia,
        p_justificativa: formulario.justificativa || null,
      });
      if (error) throw error;

      toast.success('Previsão de necessidade criada no Almoxarifado.');
      setFormulario(formularioInicial);
      setDialogCriacao(false);
      await carregar();
    } catch (error) {
      console.error('Erro ao criar PN no Almoxarifado:', error);
      toast.error((error as any)?.message || 'Não foi possível criar a previsão de necessidade.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Card
        className="cursor-pointer border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-orange-950/20 shadow-sm transition-all duration-300 hover:scale-105 hover:border-amber-400"
        onClick={abrir}
      >
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
            <ClipboardList className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-amber-400">Previsões de Necessidade (PN)</CardTitle>
          <CardDescription className="text-amber-500/70">Acompanhe as necessidades do Almoxarifado antes da formalização em RC</CardDescription>
        </CardHeader>
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-7xl overflow-y-auto">
          <DialogHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <DialogTitle>Previsões de Necessidade (PN) — Almoxarifado</DialogTitle>
              <DialogDescription>
                Registre a necessidade antes da formalização em RC. A criação da RC e as aprovações permanecem no fluxo de Compras/Financeiro.
              </DialogDescription>
            </div>
            {canCriarPrevisaoNecessidadeAlmoxarifado() && (
              <Button size="sm" onClick={() => setDialogCriacao(true)}>
                <Plus className="mr-2 h-4 w-4" />Nova PN
              </Button>
            )}
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando}>
              <RefreshCcw className="mr-2 h-4 w-4" />Atualizar
            </Button>
          </div>
          {carregando ? (
            <p className="py-8 text-center text-muted-foreground">Carregando PNs...</p>
          ) : pns.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhuma PN de solicitação de material encontrada.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PN</TableHead>
                    <TableHead>Status PN</TableHead>
                    <TableHead>Solicitante / área</TableHead>
                    <TableHead>Necessidade</TableHead>
                    <TableHead>Projeto / centro</TableHead>
                    <TableHead>Data necessária</TableHead>
                    <TableHead className="text-right">Valor estimado</TableHead>
                    <TableHead>RC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pns.map((pn) => {
                    const rc = pn.requisicao_compra_id ? rcPorId[pn.requisicao_compra_id] : undefined;
                    return (
                      <TableRow key={pn.id}>
                        <TableCell className="font-medium">PN-{String(pn.numero).padStart(4, '0')}</TableCell>
                        <TableCell><Badge variant="outline">{statusPn[pn.status] ?? pn.status}</Badge></TableCell>
                        <TableCell>{pn.area_solicitante || pn.solicitante_nome || '—'}</TableCell>
                        <TableCell className="min-w-[250px]">
                          <div className="font-medium">{pn.descricao || '—'}</div>
                          {pn.especificacao && <div className="text-xs text-muted-foreground">{pn.especificacao}</div>}
                        </TableCell>
                        <TableCell>{pn.projeto_centro_custo || '—'}</TableCell>
                        <TableCell>{dataPt(pn.data_necessidade)}</TableCell>
                        <TableCell className="text-right">{moeda(pn.valor_estimado)}</TableCell>
                        <TableCell>
                          {rc ? <div><Badge variant="secondary">RC-{String(rc.numero).padStart(4, '0')}</Badge><div className="mt-1 text-xs text-muted-foreground">{statusRc[rc.status_financeiro_rc || ''] ?? rc.status_financeiro_rc}</div></div> : <span className="text-sm text-muted-foreground">Aguardando formalização</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogCriacao} onOpenChange={setDialogCriacao}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Previsão de Necessidade</DialogTitle>
            <DialogDescription>
              Registre a necessidade identificada pelo Almoxarifado. Ela ficará prevista até seguir para a formalização em RC.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={criarPrevisao}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pn-descricao">Descrição da necessidade *</Label>
                <Textarea id="pn-descricao" required value={formulario.descricao} onChange={(event) => setFormulario((atual) => ({ ...atual, descricao: event.target.value }))} placeholder="Ex.: reposição de materiais para manutenção" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pn-especificacao">Especificação</Label>
                <Textarea id="pn-especificacao" value={formulario.especificacao} onChange={(event) => setFormulario((atual) => ({ ...atual, especificacao: event.target.value }))} placeholder="Modelo, medida, marca ou outra referência" rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pn-quantidade">Quantidade</Label>
                <Input id="pn-quantidade" inputMode="decimal" value={formulario.quantidade} onChange={(event) => setFormulario((atual) => ({ ...atual, quantidade: event.target.value }))} placeholder="Ex.: 10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pn-unidade">Unidade</Label>
                <Input id="pn-unidade" value={formulario.unidade} onChange={(event) => setFormulario((atual) => ({ ...atual, unidade: event.target.value }))} placeholder="UN" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pn-valor">Valor estimado</Label>
                <Input id="pn-valor" inputMode="decimal" value={formulario.valorEstimado} onChange={(event) => setFormulario((atual) => ({ ...atual, valorEstimado: event.target.value }))} placeholder="Deixe em branco se ainda não houver valor" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pn-data">Data necessária</Label>
                <Input id="pn-data" type="date" value={formulario.dataNecessidade} onChange={(event) => setFormulario((atual) => ({ ...atual, dataNecessidade: event.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pn-projeto">Projeto / centro de custo</Label>
                <Input id="pn-projeto" value={formulario.projetoCentroCusto} onChange={(event) => setFormulario((atual) => ({ ...atual, projetoCentroCusto: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pn-urgencia">Urgência</Label>
                <select id="pn-urgencia" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formulario.urgencia} onChange={(event) => setFormulario((atual) => ({ ...atual, urgencia: event.target.value }))}>
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pn-justificativa">Justificativa / observação</Label>
                <Textarea id="pn-justificativa" value={formulario.justificativa} onChange={(event) => setFormulario((atual) => ({ ...atual, justificativa: event.target.value }))} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogCriacao(false)} disabled={salvando}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>{salvando ? 'Criando...' : 'Criar PN'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
