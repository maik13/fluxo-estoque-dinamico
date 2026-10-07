import { useState } from 'react';
import { ClipboardList, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

export const PrevisoesNecessidadeAlmoxarifado = () => {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [pns, setPns] = useState<PrevisaoNecessidade[]>([]);
  const [rcPorId, setRcPorId] = useState<Record<string, RequisicaoCompra>>({});

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
          <DialogHeader>
            <DialogTitle>Previsões de Necessidade (PN) — Almoxarifado</DialogTitle>
            <DialogDescription>
              Esta fila mostra as necessidades geradas pelas solicitações de material. A RC só é criada posteriormente no Financeiro, a partir da PN.
            </DialogDescription>
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
    </>
  );
};
