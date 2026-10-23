/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { ShoppingBag, Plus, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Rc = {id:string;numero:number;status_financeiro_rc:string;pn_origem_id:string|null;valor_estimado_cotado:number|null;frete_custos_adicionais:number|null;fornecedores_consultados:string|null;especificacao_tecnica:string|null;condicao_pagamento:string|null;projeto_centro_custo:string|null;};
type Pc = {id:string;numero:number;requisicao_compra_id:string;fornecedor:string;descricao:string;valor_total:number;status:string;};
const formVazio = {rcId:'',fornecedor:'',descricao:'',valorItens:'',frete:'',condicao:''};
const moeda = (n:number|null|undefined) => n == null ? '—' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n));

export function PedidosCompraFormaisAlmoxarifado() {
  const [open,setOpen] = useState(false);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [rcs,setRcs] = useState<Rc[]>([]);
  const [pcs,setPcs] = useState<Pc[]>([]);
  const [form,setForm] = useState(formVazio);
  const carregar = async () => {
    setLoading(true);
    try {
      const [r,p]=await Promise.all([
        (supabase as any).from('pedidos_compra').select('id,numero,status_financeiro_rc,pn_origem_id,valor_estimado_cotado,frete_custos_adicionais,fornecedores_consultados,especificacao_tecnica,condicao_pagamento,projeto_centro_custo').order('numero',{ascending:false}).limit(1000),
        (supabase as any).from('financeiro_pedidos_compra_formais').select('id,numero,requisicao_compra_id,fornecedor,descricao,valor_total,status').order('numero',{ascending:false}).limit(1000),
      ]);
      if (r.error) throw r.error;
      if (p.error) throw p.error;
      setRcs(r.data||[]);
      setPcs(p.data||[]);
    } catch(e:any) { toast.error(e?.message||'Não foi possível carregar os pedidos formais'); }
    finally {setLoading(false);}
  };
  const abrir=()=>{setOpen(true);void carregar();};
  const disponiveis=rcs.filter(rc=>rc.status_financeiro_rc==='aprovada'&&!pcs.some(pc=>pc.requisicao_compra_id===rc.id));
  const criar=async()=>{
    const rc=disponiveis.find(r=>r.id===form.rcId);
    if(!rc) return toast.error('Selecione uma RC aprovada ainda não convertida.');
    if(!form.fornecedor.trim()||!form.descricao.trim()) return toast.error('Preencha fornecedor e descrição.');
    const valor=Number(form.valorItens.replace(',','.'));
    const frete=Number(form.frete.replace(',','.')||0);
    if(!Number.isFinite(valor)||valor<=0||!Number.isFinite(frete)||frete<0) return toast.error('Informe valores válidos.');
    setSaving(true);
    try{
      const {data:pcId,error}=await (supabase as any).rpc('almoxarifado_transformar_rc_em_pc_v2',{
        p_rc_id:rc.id,p_fornecedor:form.fornecedor.trim(),p_fornecedor_identificacao:null,p_fornecedor_contato:null,
        p_descricao:form.descricao.trim(),p_valor_itens:valor,p_frete:frete,p_condicao:form.condicao.trim()||null,
        p_prazo:null,p_local:null,
      });
      if(error) throw error;
      const criado=(await (supabase as any).from('financeiro_pedidos_compra_formais').select('numero').eq('id',pcId).single()).data;
      toast.success(`RC-${String(rc.numero).padStart(4,'0')} transformada em PC-${String(criado?.numero||'').padStart(4,'0')}.`);
      setForm(formVazio);
      await carregar();
    }catch(e:any){toast.error(e?.message||'Não foi possível formalizar o PC.');}
    finally{setSaving(false);}
  };
  return <>
    <Card role="button" tabIndex={0} className="cursor-pointer transition hover:border-primary/60" onClick={abrir} onKeyDown={e=>{if(e.key==='Enter')abrir();}}>
      <CardHeader className="text-center"><ShoppingBag className="mx-auto mb-2 h-8 w-8 text-primary"/><CardTitle>Pedido de Compra</CardTitle></CardHeader>
    </Card>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
      <DialogHeader><DialogTitle>Pedidos de Compra formais</DialogTitle><DialogDescription>Documentos vinculados às requisições de compra aprovadas. Mesmos registros do Financeiro.</DialogDescription></DialogHeader>
      <div className="flex justify-end"><Button variant="outline" onClick={()=>void carregar()} disabled={loading}><RefreshCcw className="mr-2 h-4 w-4"/>Atualizar</Button></div>
      <div className="rounded-md border p-3 space-y-3">
        <div className="font-semibold flex gap-2 items-center"><Plus className="h-4 w-4"/>Transformar uma RC aprovada em PC</div>
        <Label htmlFor="rcPc">Documento de origem</Label>
        <select id="rcPc" className="w-full rounded-md border bg-background p-2" value={form.rcId} onChange={e=>{const rc=disponiveis.find(x=>x.id===e.target.value);setForm({...form,rcId:e.target.value,fornecedor:rc?.fornecedores_consultados||'',descricao:rc?.especificacao_tecnica||'',valorItens:rc?.valor_estimado_cotado==null?'':String(rc.valor_estimado_cotado),frete:rc?.frete_custos_adicionais==null?'':String(rc.frete_custos_adicionais),condicao:rc?.condicao_pagamento||''});}}>
          <option value="">Selecione uma RC aprovada</option>{disponiveis.map(rc=><option key={rc.id} value={rc.id}>RC-{String(rc.numero).padStart(4,'0')} · {rc.projeto_centro_custo||'Sem projeto'} · {moeda(rc.valor_estimado_cotado)}</option>)}
        </select>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Fornecedor</Label><Input value={form.fornecedor} onChange={e=>setForm({...form,fornecedor:e.target.value})}/></div>
          <div><Label>Descrição</Label><Input value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})}/></div>
          <div><Label>Valor dos itens</Label><Input value={form.valorItens} onChange={e=>setForm({...form,valorItens:e.target.value})}/></div>
          <div><Label>Frete e adicionais</Label><Input value={form.frete} onChange={e=>setForm({...form,frete:e.target.value})}/></div>
          <div className="sm:col-span-2"><Label>Condição de pagamento</Label><Input value={form.condicao} onChange={e=>setForm({...form,condicao:e.target.value})}/></div>
        </div>
        <Button onClick={()=>void criar()} disabled={saving||!disponiveis.length}>{saving?'Transformando...':'Transformar RC em PC'}</Button>
      </div>
      <Table><TableHeader><TableRow><TableHead>PC</TableHead><TableHead>RC de origem</TableHead><TableHead>Fornecedor</TableHead><TableHead>Descrição</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
      <TableBody>{pcs.map(pc=>{const rc=rcs.find(item=>item.id===pc.requisicao_compra_id);return <TableRow key={pc.id}><TableCell>PC-{String(pc.numero).padStart(4,'0')}</TableCell><TableCell>{rc?`RC-${String(rc.numero).padStart(4,'0')}`:'—'}</TableCell><TableCell>{pc.fornecedor}</TableCell><TableCell>{pc.descricao}</TableCell><TableCell>{moeda(pc.valor_total)}</TableCell><TableCell>{pc.status}</TableCell></TableRow>;})}{!pcs.length&&<TableRow><TableCell colSpan={6} className="text-center">Nenhum PC formal transformado a partir de RC.</TableCell></TableRow>}</TableBody></Table>
    </DialogContent></Dialog>
  </>;
}
