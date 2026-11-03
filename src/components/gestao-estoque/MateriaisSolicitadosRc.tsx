import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  montarMateriaisSolicitados,
  type FonteMaterial,
  type ItemPnEntrada,
  type ItemRcEntrada,
  type ItemSolicitacaoEntrada,
  type PnEntrada,
} from './materiaisSolicitadosRc';

interface PedidoRef {
  id: string;
  numero: number;
  observacoes: string | null;
  solicitacao_material_id?: string | null;
  solicitacao_material_numero?: number | null;
  pn_origem_id?: string | null;
}

interface SolicitacaoInfo {
  id: string;
  numero: number | null;
  solicitante_nome: string | null;
  observacoes: string | null;
  data_necessidade: string | null;
}

interface DadosOrigem {
  solicitacao: SolicitacaoInfo | null;
  itensSolicitacao: ItemSolicitacaoEntrada[];
  pn: (PnEntrada & { justificativa: string | null; solicitacao_material_id: string | null }) | null;
  itensPn: ItemPnEntrada[];
  itemSolicitacaoDaPn: ItemSolicitacaoEntrada | null;
  outrasRcsMesmaSolicitacao: number;
  falhas: string[];
}

const vazio: DadosOrigem = {
  solicitacao: null,
  itensSolicitacao: [],
  pn: null,
  itensPn: [],
  itemSolicitacaoDaPn: null,
  outrasRcsMesmaSolicitacao: 0,
  falhas: [],
};

const comoObjeto = (v: Json | null | undefined): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const rotuloFonte: Record<FonteMaterial, string> = {
  rc: 'Itens da RC',
  pn: 'PN vinculada',
  solicitacao: 'Solicitação de material',
};

const dataPt = (valor?: string | null) => {
  if (!valor) return null;
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : null;
};

const formatarQtd = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });

const ITEM_SM_CAMPOS = 'id, item_id, nome_item, quantidade, unidade, especificacao, observacoes, destino_atendimento, item_snapshot';

/** Carrega, somente leitura, os documentos de origem da RC. Nenhuma escrita é feita aqui. */
const carregarOrigem = async (pedido: PedidoRef): Promise<DadosOrigem> => {
  const dados: DadosOrigem = { ...vazio, falhas: [] };

  const mapearItemSm = (r: {
    id: string; item_id: string | null; nome_item: string | null; quantidade: number | null; unidade: string | null;
    especificacao: string | null; observacoes: string | null; destino_atendimento: string | null; item_snapshot: Json | null;
  }): ItemSolicitacaoEntrada => ({ ...r, item_snapshot: comoObjeto(r.item_snapshot) });

  // PN vinculada
  if (pedido.pn_origem_id) {
    const { data, error } = await supabase
      .from('financeiro_necessidades')
      .select('id, numero, descricao, especificacao, justificativa, quantidade, unidade, item_id, solicitacao_material_id, solicitacao_material_item_id')
      .eq('id', pedido.pn_origem_id)
      .maybeSingle();
    if (error) dados.falhas.push('Não foi possível consultar a PN vinculada (sem permissão ou erro de conexão).');
    else if (!data) dados.falhas.push('A PN vinculada não foi encontrada ou não está acessível para o seu usuário.');
    else {
      dados.pn = data;
      const itens = await supabase
        .from('financeiro_necessidade_itens')
        .select('id, item_id, descricao, especificacao, quantidade, unidade, ordem, item_snapshot')
        .eq('necessidade_id', data.id)
        .order('ordem', { ascending: true });
      if (itens.error) dados.falhas.push('Não foi possível consultar os itens da PN vinculada.');
      else dados.itensPn = (itens.data || []).map(r => ({ ...r, item_snapshot: comoObjeto(r.item_snapshot) }));
    }
  }

  // Solicitação de material (da RC ou, se ausente, a apontada pela PN)
  const solicitacaoId = pedido.solicitacao_material_id || dados.pn?.solicitacao_material_id || null;
  if (solicitacaoId) {
    const [cab, itens, outras] = await Promise.all([
      supabase.from('solicitacoes_material').select('id, numero, solicitante_nome, observacoes, data_necessidade').eq('id', solicitacaoId).maybeSingle(),
      supabase.from('solicitacao_material_itens').select(ITEM_SM_CAMPOS).eq('solicitacao_material_id', solicitacaoId).order('created_at', { ascending: true }),
      supabase.from('pedidos_compra').select('id', { count: 'exact', head: true }).eq('solicitacao_material_id', solicitacaoId).neq('id', pedido.id),
    ]);
    if (cab.error) dados.falhas.push('Não foi possível consultar a solicitação de material de origem.');
    else dados.solicitacao = cab.data;
    if (itens.error) dados.falhas.push('Não foi possível consultar os itens da solicitação de material de origem.');
    else dados.itensSolicitacao = (itens.data || []).map(mapearItemSm);
    if (!outras.error) dados.outrasRcsMesmaSolicitacao = outras.count || 0;
  }

  // Item específico da solicitação apontado pela PN
  const itemSmPnId = dados.pn?.solicitacao_material_item_id;
  if (itemSmPnId) {
    const jaCarregado = dados.itensSolicitacao.find(i => i.id === itemSmPnId);
    if (jaCarregado) dados.itemSolicitacaoDaPn = jaCarregado;
    else {
      const { data, error } = await supabase.from('solicitacao_material_itens').select(ITEM_SM_CAMPOS).eq('id', itemSmPnId).maybeSingle();
      if (error) dados.falhas.push('Não foi possível consultar o item da solicitação apontado pela PN.');
      else if (data) dados.itemSolicitacaoDaPn = mapearItemSm(data);
    }
  }

  return dados;
};

interface Props {
  pedido: PedidoRef;
  itensRc: ItemRcEntrada[];
}

export const MateriaisSolicitadosRc = ({ pedido, itensRc }: Props) => {
  const [carregando, setCarregando] = useState(false);
  const [origem, setOrigem] = useState<DadosOrigem>(vazio);

  const temVinculo = Boolean(pedido.solicitacao_material_id || pedido.pn_origem_id);

  useEffect(() => {
    let ativo = true;
    setOrigem(vazio);
    if (!temVinculo) return;
    setCarregando(true);
    carregarOrigem(pedido)
      .then(d => { if (ativo) setOrigem(d); })
      .catch(err => {
        console.error('Erro ao carregar origem da RC:', err);
        if (ativo) setOrigem({ ...vazio, falhas: ['Erro inesperado ao consultar os documentos de origem desta RC.'] });
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
    // Recarrega apenas quando muda a RC aberta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido.id, pedido.solicitacao_material_id, pedido.pn_origem_id]);

  const resultado = useMemo(
    () => montarMateriaisSolicitados({
      itensRc,
      itensSolicitacao: origem.itensSolicitacao,
      pn: origem.pn,
      itensPn: origem.itensPn,
      itemSolicitacaoDaPn: origem.itemSolicitacaoDaPn,
      outrasRcsMesmaSolicitacao: origem.outrasRcsMesmaSolicitacao,
    }),
    [itensRc, origem],
  );

  const numeroSm = origem.solicitacao?.numero ?? pedido.solicitacao_material_numero ?? null;
  const avisos = [...origem.falhas, ...resultado.avisos];
  if (!pedido.solicitacao_material_id && pedido.solicitacao_material_numero && !origem.solicitacao) {
    avisos.push(`Esta RC menciona a Solicitação #${pedido.solicitacao_material_numero}, mas o vínculo não está registrado. Os itens dessa solicitação não podem ser recuperados com segurança.`);
  }

  return (
    <section className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 space-y-3" aria-label="Materiais solicitados">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-base"><ClipboardList className="h-5 w-5 text-primary" /> Materiais solicitados</h3>
          <p className="text-xs text-muted-foreground">Consulta somente leitura do que foi pedido. Nada é alterado ao abrir esta tela.</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {resultado.fontePrincipal && <Badge variant="default">Fonte: {rotuloFonte[resultado.fontePrincipal]}</Badge>}
          {numeroSm && <Badge variant="secondary">Solicitação #{numeroSm}</Badge>}
          {origem.pn?.numero && <Badge variant="secondary">PN #{origem.pn.numero}</Badge>}
          {!temVinculo && !pedido.solicitacao_material_numero && <Badge variant="outline">RC manual</Badge>}
        </div>
      </div>

      {(origem.solicitacao || origem.pn) && (
        <div className="grid gap-2 md:grid-cols-2 text-sm">
          {origem.solicitacao && (
            <div className="rounded-md border bg-background p-3">
              <div className="text-xs text-muted-foreground">Solicitação de material #{origem.solicitacao.numero ?? '—'}</div>
              <div>Solicitante: <span className="font-medium">{origem.solicitacao.solicitante_nome || '—'}</span>{dataPt(origem.solicitacao.data_necessidade) ? ` · necessário em ${dataPt(origem.solicitacao.data_necessidade)}` : ''}</div>
              <div className="text-muted-foreground">Observações: {origem.solicitacao.observacoes || '—'}</div>
            </div>
          )}
          {origem.pn && (
            <div className="rounded-md border bg-background p-3">
              <div className="text-xs text-muted-foreground">PN #{origem.pn.numero ?? '—'}</div>
              <div className="font-medium">{origem.pn.descricao || '—'}</div>
              {origem.pn.especificacao && <div className="text-muted-foreground">Especificação: {origem.pn.especificacao}</div>}
              {origem.pn.justificativa && <div className="text-muted-foreground">Justificativa: {origem.pn.justificativa}</div>}
            </div>
          )}
        </div>
      )}

      {pedido.observacoes && (
        <div className="rounded-md border bg-background p-3 text-sm"><span className="text-xs text-muted-foreground">Observações da RC: </span>{pedido.observacoes}</div>
      )}

      {carregando && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Consultando documentos de origem…</div>
      )}

      {avisos.map(a => (
        <div key={a} className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" /><span>{a}</span></div>
      ))}

      {resultado.materiais.length > 0 ? (
        <div className="overflow-x-auto rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Especificação</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>Origem do dado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultado.materiais.map(m => (
                <TableRow key={m.chave}>
                  <TableCell className="whitespace-normal min-w-[200px]">
                    <div className="font-medium">{m.nome || <span className="text-muted-foreground italic">Nome não registrado</span>}</div>
                    {m.codigo && <div className="text-xs text-muted-foreground">Cód. {m.codigo}</div>}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatarQtd(m.quantidade)}</TableCell>
                  <TableCell>{m.unidade || '—'}</TableCell>
                  <TableCell className="whitespace-normal min-w-[160px] text-sm">{m.especificacao || '—'}</TableCell>
                  <TableCell className="whitespace-normal min-w-[160px] text-sm">{m.observacoes || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{rotuloFonte[m.fonte]}</Badge>
                      {m.complementadoPor.map(f => <Badge key={f} variant="secondary" title="Campos vazios completados com este documento">+ {rotuloFonte[f]}</Badge>)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : !carregando && (
        <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">
          {temVinculo
            ? 'Nenhum material disponível nesta RC nem nos documentos vinculados. Se você esperava ver itens, pode ser falta de registro ou restrição de acesso.'
            : 'Nenhum material registrado nesta RC.'}
        </div>
      )}

      {resultado.fontePrincipal === 'rc' && resultado.itensSolicitacaoForaDaRc > 0 && (
        <p className="text-xs text-muted-foreground">
          A solicitação de origem tem mais {resultado.itensSolicitacaoForaDaRc} item(ns) que não fazem parte desta RC (atendidos pelo estoque ou por outro pedido) e por isso não aparecem aqui.
        </p>
      )}
      {resultado.fontePrincipal && resultado.fontePrincipal !== 'rc' && (
        <p className="text-xs text-muted-foreground">Esta RC não tem itens próprios registrados; os materiais acima foram recuperados do documento indicado, apenas para consulta.</p>
      )}
    </section>
  );
};
