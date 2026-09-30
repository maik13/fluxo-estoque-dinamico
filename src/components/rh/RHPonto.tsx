import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Clock, Loader2, Pencil, Plus, RefreshCw, Search, UserRound, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const sb = supabase as any;
type Ponto = { id:string; data:string; hora_entrada_1:string|null; hora_saida_1:string|null; hora_entrada_2:string|null; hora_saida_2:string|null; hora_entrada_3:string|null; hora_saida_3:string|null; status:string; colaborador_id?:string; rh_colaboradores?:{nome:string}|null };
type Snapshot = { colaborador:{id:string;nome:string}; entries:Ponto[] };
type Colaborador = { id:string; nome:string; cargo:string|null; departamento:string|null; tipo_contrato:string|null; controla_ponto:boolean; rh_ativo:boolean; ativo:boolean };
type Jornada = { id:string; nome:string; descricao:string|null; carga_horaria_semanal:number|null; ativo:boolean };
type Feriado = { id:string; nome:string; data:string; tipo:string|null; ativo:boolean };

const hora=(v:string|null)=>v?.slice(0,5)||'—';
const status=(v:string)=>v==='aprovado'?<Badge className="bg-emerald-500/15 text-emerald-600">Aprovado</Badge>:v==='rejeitado'?<Badge variant="destructive">Rejeitado</Badge>:<Badge variant="secondary">Pendente</Badge>;

function MeuPonto(){
  const [mes,setMes]=useState(format(new Date(),'yyyy-MM'));
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [now,setNow]=useState(new Date());

  const carregar=useCallback(async()=>{
    setLoading(true);
    const {data,error}=await sb.rpc('rh_get_meu_ponto_snapshot',{p_mes:`${mes}-01`});
    if(error){ toast.error(error.message); setSnapshot(null); }
    else setSnapshot(data as Snapshot);
    setLoading(false);
  },[mes]);

  useEffect(()=>{void carregar()},[carregar]);
  useEffect(()=>{const id=window.setInterval(()=>setNow(new Date()),1000);return()=>window.clearInterval(id)},[]);

  const registrar=async()=>{
    setSaving(true);
    const {data,error}=await sb.rpc('rh_registrar_meu_ponto_agora');
    if(error) toast.error(error.message);
    else { const r=data as any; toast.success(`${r?.rotulo||'Ponto'} registrado às ${r?.hora||format(new Date(),'HH:mm')}`); await carregar(); }
    setSaving(false);
  };

  return <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Colaborador</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{snapshot?.colaborador?.nome||'—'}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Horário do servidor</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums">{format(now,'HH:mm:ss')}</CardContent></Card>
      <Card><CardContent className="flex h-full min-h-24 items-center"><Button className="w-full" onClick={registrar} disabled={saving||!snapshot}>{saving?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Clock className="mr-2 h-4 w-4"/>}Registrar ponto agora</Button></CardContent></Card>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Meu espelho mensal</h3><div className="flex gap-2"><input aria-label="Mês" type="month" value={mes} onChange={e=>setMes(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm"/><Button variant="outline" size="sm" onClick={()=>void carregar()}><RefreshCw className="mr-2 h-4 w-4"/>Atualizar</Button></div></div>
    <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Entrada 1</TableHead><TableHead>Saída 1</TableHead><TableHead>Entrada 2</TableHead><TableHead>Saída 2</TableHead><TableHead>Entrada 3</TableHead><TableHead>Saída 3</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
      {loading?<TableRow><TableCell colSpan={8} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin"/></TableCell></TableRow>:(snapshot?.entries||[]).map(e=><TableRow key={e.id}><TableCell>{format(new Date(e.data+'T12:00:00'),'dd/MM/yyyy',{locale:ptBR})}</TableCell><TableCell>{hora(e.hora_entrada_1)}</TableCell><TableCell>{hora(e.hora_saida_1)}</TableCell><TableCell>{hora(e.hora_entrada_2)}</TableCell><TableCell>{hora(e.hora_saida_2)}</TableCell><TableCell>{hora(e.hora_entrada_3)}</TableCell><TableCell>{hora(e.hora_saida_3)}</TableCell><TableCell>{status(e.status)}</TableCell></TableRow>)}
      {!loading&&!(snapshot?.entries||[]).length&&<TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhum registro neste mês.</TableCell></TableRow>}
    </TableBody></Table></div>
  </div>
}

function ControlePonto(){
  const [mes,setMes]=useState(format(new Date(),'yyyy-MM'));
  const [rows,setRows]=useState<Ponto[]>([]);
  const [loading,setLoading]=useState(false);
  const carregar=useCallback(async()=>{
    setLoading(true);
    const inicio=`${mes}-01`; const fim=format(new Date(Number(mes.slice(0,4)),Number(mes.slice(5,7)),0),'yyyy-MM-dd');
    const {data,error}=await sb.from('rh_registros_ponto').select('*,rh_colaboradores(nome)').gte('data',inicio).lte('data',fim).order('data',{ascending:false});
    if(error) toast.error(error.message); else setRows(data||[]);
    setLoading(false);
  },[mes]);
  useEffect(()=>{void carregar()},[carregar]);
  const aprovar=async(id:string,novo:string)=>{
    const {error}=await sb.rpc('rh_atualizar_status_ponto',{p_registro_id:id,p_status:novo});
    if(error) toast.error(error.message); else {toast.success(novo==='aprovado'?'Ponto aprovado':'Ponto rejeitado');void carregar()}
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Controle de Ponto</h3><p className="text-sm text-muted-foreground">Registros consolidados por colaborador.</p></div><input type="month" value={mes} onChange={e=>setMes(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm"/></div>
    <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Colaborador</TableHead><TableHead>1º período</TableHead><TableHead>2º período</TableHead><TableHead>3º período</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
      {loading?<TableRow><TableCell colSpan={7} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin"/></TableCell></TableRow>:rows.map(r=><TableRow key={r.id}><TableCell>{format(new Date(r.data+'T12:00:00'),'dd/MM/yyyy')}</TableCell><TableCell className="font-medium">{r.rh_colaboradores?.nome||'—'}</TableCell><TableCell>{hora(r.hora_entrada_1)}–{hora(r.hora_saida_1)}</TableCell><TableCell>{hora(r.hora_entrada_2)}–{hora(r.hora_saida_2)}</TableCell><TableCell>{hora(r.hora_entrada_3)}–{hora(r.hora_saida_3)}</TableCell><TableCell>{status(r.status)}</TableCell><TableCell className="text-right space-x-1"><Button size="sm" variant="outline" onClick={()=>void aprovar(r.id,'aprovado')}>Aprovar</Button><Button size="sm" variant="ghost" onClick={()=>void aprovar(r.id,'rejeitado')}>Rejeitar</Button></TableCell></TableRow>)}
    </TableBody></Table></div>
  </div>
}

function CadastrosRH(){
  const {hasPermission,isAdmin}=usePermissions();
  const canManage=isAdmin()||hasPermission('rh.colaboradores.gerenciar');
  const [colabs,setColabs]=useState<any[]>([]); const [jornadas,setJornadas]=useState<Jornada[]>([]); const [feriados,setFeriados]=useState<Feriado[]>([]);
  const [loading,setLoading]=useState(true); const [search,setSearch]=useState(''); const [open,setOpen]=useState(false); const [saving,setSaving]=useState(false);
  const [form,setForm]=useState<any>({id:null,nome:'',email:'',cpf_cnpj:'',telefone:'',data_nascimento:'',endereco:'',cidade:'',estado:'',cep:'',cargo:'',departamento:'',salario:'',data_admissao:'',pis:'',jornada_id:'none',tipo_contrato:'clt',valor_contrato:'',controla_ponto:false,hora_extra_gera_valor:true,rh_ativo:true,ativo:true});
  const set=(key:string,value:any)=>setForm((x:any)=>({...x,[key]:value}));
  const reset=()=>setForm({id:null,nome:'',email:'',cpf_cnpj:'',telefone:'',data_nascimento:'',endereco:'',cidade:'',estado:'',cep:'',cargo:'',departamento:'',salario:'',data_admissao:'',pis:'',jornada_id:'none',tipo_contrato:'clt',valor_contrato:'',controla_ponto:false,hora_extra_gera_valor:true,rh_ativo:true,ativo:true});
  const carregar=useCallback(async()=>{setLoading(true);const [c,j,f]=await Promise.all([
    sb.from('rh_colaboradores').select('*').order('nome'), sb.from('rh_jornadas').select('*').order('nome'), sb.from('rh_feriados').select('*').order('data')
  ]);if(c.error)toast.error(c.error.message);else setColabs(c.data||[]);if(j.error)toast.error(j.error.message);else setJornadas(j.data||[]);if(f.error)toast.error(f.error.message);else setFeriados(f.data||[]);setLoading(false)},[]);
  useEffect(()=>{void carregar()},[carregar]);
  const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return !q?colabs:colabs.filter(c=>c.nome?.toLowerCase().includes(q)||c.email?.toLowerCase().includes(q)||c.cargo?.toLowerCase().includes(q))},[colabs,search]);
  const edit=(c:any)=>{setForm({...c,salario:c.salario??'',valor_contrato:c.valor_contrato??'',jornada_id:c.jornada_id||'none',data_nascimento:c.data_nascimento||'',data_admissao:c.data_admissao||''});setOpen(true)};
  const salvar=async()=>{if(!form.nome.trim()){toast.error('Nome é obrigatório');return}setSaving(true);
    const {error}=await sb.rpc('rh_salvar_colaborador',{p_id:form.id||null,p_nome:form.nome,p_email:form.email||null,p_cpf_cnpj:form.cpf_cnpj||null,p_telefone:form.telefone||null,p_data_nascimento:form.data_nascimento||null,p_endereco:form.endereco||null,p_cidade:form.cidade||null,p_estado:form.estado||null,p_cep:form.cep||null,p_cargo:form.cargo||null,p_departamento:form.departamento||null,p_salario:form.tipo_contrato==='clt'&&form.salario!==''?Number(form.salario):null,p_data_admissao:form.data_admissao||null,p_pis:form.pis||null,p_jornada_id:form.jornada_id==='none'?null:form.jornada_id,p_tipo_contrato:form.tipo_contrato,p_valor_contrato:form.tipo_contrato!=='clt'&&form.valor_contrato!==''?Number(form.valor_contrato):null,p_controla_ponto:form.controla_ponto,p_hora_extra_gera_valor:form.hora_extra_gera_valor,p_rh_ativo:form.rh_ativo,p_ativo:form.ativo});
    if(error)toast.error(error.message);else{toast.success(form.id?'Colaborador atualizado':'Colaborador cadastrado');setOpen(false);reset();await carregar()}setSaving(false)};
  if(loading)return <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin"/></div>;
  return <Tabs defaultValue="colaboradores" className="space-y-4"><TabsList className="h-auto flex-wrap"><TabsTrigger value="colaboradores">Colaboradores ({colabs.length})</TabsTrigger><TabsTrigger value="jornadas">Jornadas ({jornadas.length})</TabsTrigger><TabsTrigger value="feriados">Feriados ({feriados.length})</TabsTrigger></TabsList>
    <TabsContent value="colaboradores" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative min-w-64 flex-1 max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" placeholder="Buscar colaborador..." value={search} onChange={e=>setSearch(e.target.value)}/></div>{canManage&&<Button onClick={()=>{reset();setOpen(true)}}><Plus className="mr-2 h-4 w-4"/>Novo colaborador</Button>}</div>
      <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>Departamento</TableHead><TableHead>Contrato</TableHead><TableHead>Jornada</TableHead><TableHead>Ponto</TableHead><TableHead>RH</TableHead>{canManage&&<TableHead className="text-right">Ações</TableHead>}</TableRow></TableHeader><TableBody>{filtered.map(c=><TableRow key={c.id}><TableCell className="font-medium"><div>{c.nome}</div>{c.email&&<div className="text-xs text-muted-foreground">{c.email}</div>}</TableCell><TableCell>{c.cargo||'—'}</TableCell><TableCell>{c.departamento||'—'}</TableCell><TableCell>{(c.tipo_contrato||'—').toUpperCase()}</TableCell><TableCell>{jornadas.find(j=>j.id===c.jornada_id)?.nome||'—'}</TableCell><TableCell>{c.controla_ponto?<Badge>Sim</Badge>:<span className="text-muted-foreground">Não</span>}</TableCell><TableCell>{c.rh_ativo?<Badge>Ativo</Badge>:<Badge variant="secondary">Inativo</Badge>}</TableCell>{canManage&&<TableCell className="text-right"><Button size="icon" variant="ghost" onClick={()=>edit(c)}><Pencil className="h-4 w-4"/></Button></TableCell>}</TableRow>)}</TableBody></Table></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{form.id?'Editar colaborador':'Novo colaborador'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-1"><Label>Nome *</Label><Input value={form.nome} onChange={e=>set('nome',e.target.value)}/></div><div className="space-y-1"><Label>E-mail</Label><Input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)}/></div>
          <div className="space-y-1"><Label>CPF/CNPJ</Label><Input value={form.cpf_cnpj||''} onChange={e=>set('cpf_cnpj',e.target.value)}/></div><div className="space-y-1"><Label>Telefone</Label><Input value={form.telefone||''} onChange={e=>set('telefone',e.target.value)}/></div>
          <div className="space-y-1"><Label>Data de nascimento</Label><Input type="date" value={form.data_nascimento||''} onChange={e=>set('data_nascimento',e.target.value)}/></div><div className="space-y-1"><Label>PIS</Label><Input value={form.pis||''} onChange={e=>set('pis',e.target.value)}/></div>
          <div className="space-y-1 md:col-span-2"><Label>Endereço</Label><Input value={form.endereco||''} onChange={e=>set('endereco',e.target.value)}/></div><div className="space-y-1"><Label>Cidade</Label><Input value={form.cidade||''} onChange={e=>set('cidade',e.target.value)}/></div><div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>UF</Label><Input maxLength={2} value={form.estado||''} onChange={e=>set('estado',e.target.value)}/></div><div className="space-y-1"><Label>CEP</Label><Input value={form.cep||''} onChange={e=>set('cep',e.target.value)}/></div></div>
          <div className="space-y-1"><Label>Cargo</Label><Input value={form.cargo||''} onChange={e=>set('cargo',e.target.value)}/></div><div className="space-y-1"><Label>Departamento</Label><Input value={form.departamento||''} onChange={e=>set('departamento',e.target.value)}/></div>
          <div className="space-y-1"><Label>Data de admissão</Label><Input type="date" value={form.data_admissao||''} onChange={e=>set('data_admissao',e.target.value)}/></div><div className="space-y-1"><Label>Jornada</Label><Select value={form.jornada_id} onValueChange={v=>set('jornada_id',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Sem jornada</SelectItem>{jornadas.filter(j=>j.ativo).map(j=><SelectItem key={j.id} value={j.id}>{j.nome} ({j.carga_horaria_semanal}h)</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Tipo de contrato</Label><Select value={form.tipo_contrato} onValueChange={v=>set('tipo_contrato',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="clt">CLT</SelectItem><SelectItem value="pj">PJ</SelectItem><SelectItem value="diarista">Diarista</SelectItem><SelectItem value="horista">Horista</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label>{form.tipo_contrato==='clt'?'Salário mensal (R$)':form.tipo_contrato==='horista'?'Valor por hora (R$)':'Valor da diária (R$)'}</Label><Input type="number" min="0" step="0.01" value={form.tipo_contrato==='clt'?form.salario:form.valor_contrato} onChange={e=>set(form.tipo_contrato==='clt'?'salario':'valor_contrato',e.target.value)}/></div>
          <div className="flex items-center gap-3 rounded-md border p-3"><Switch checked={form.rh_ativo} onCheckedChange={v=>set('rh_ativo',v)}/><div><Label>Ativo no RH</Label><p className="text-xs text-muted-foreground">Inativar preserva todo o histórico.</p></div></div>
          <div className="flex items-center gap-3 rounded-md border p-3"><Switch checked={form.controla_ponto} disabled={!form.rh_ativo} onCheckedChange={v=>set('controla_ponto',v)}/><div><Label>Controla ponto</Label><p className="text-xs text-muted-foreground">Participa do registro e fechamento de ponto.</p></div></div>
          <div className="flex items-center gap-3 rounded-md border p-3"><Switch checked={form.ativo} onCheckedChange={v=>set('ativo',v)}/><div><Label>Cadastro ativo</Label><p className="text-xs text-muted-foreground">Desative em vez de excluir registros históricos.</p></div></div>
        </div><DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button onClick={()=>void salvar()} disabled={saving}>{saving&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Salvar</Button></DialogFooter></DialogContent></Dialog>
    </TabsContent>
    <TabsContent value="jornadas"><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Jornada</TableHead><TableHead>Descrição</TableHead><TableHead>Carga semanal</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{jornadas.map(j=><TableRow key={j.id}><TableCell className="font-medium">{j.nome}</TableCell><TableCell>{j.descricao||'—'}</TableCell><TableCell>{j.carga_horaria_semanal??'—'}h</TableCell><TableCell>{j.ativo?<Badge>Ativa</Badge>:<Badge variant="secondary">Inativa</Badge>}</TableCell></TableRow>)}</TableBody></Table></div></TabsContent>
    <TabsContent value="feriados"><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Feriado</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{feriados.map(f=><TableRow key={f.id}><TableCell>{format(new Date(f.data+'T12:00:00'),'dd/MM/yyyy')}</TableCell><TableCell className="font-medium">{f.nome}</TableCell><TableCell>{f.tipo||'—'}</TableCell><TableCell>{f.ativo?<Badge>Ativo</Badge>:<Badge variant="secondary">Inativo</Badge>}</TableCell></TableRow>)}</TableBody></Table></div></TabsContent>
  </Tabs>
}
export function RHPonto(){
  const {hasPermission,isAdmin}=usePermissions();
  const podeRH=isAdmin()||hasPermission('rh.acessar')||hasPermission('rh.colaboradores.visualizar');
  const podeControle=isAdmin()||hasPermission('ponto.gerenciar')||hasPermission('ponto.aprovar');
  const defaultTab=podeRH?'rh':'meu-ponto';
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold tracking-tight">RH e Controle de Ponto</h2><p className="text-sm text-muted-foreground">Cadastros, jornadas, feriados e registros de ponto em uma única fonte de dados.</p></div>
    <Tabs defaultValue={defaultTab} className="space-y-5"><TabsList className="h-auto flex-wrap">
      <TabsTrigger value="meu-ponto" className="gap-2"><UserRound className="h-4 w-4"/>Meu Ponto</TabsTrigger>
      {podeControle&&<TabsTrigger value="controle" className="gap-2"><Clock className="h-4 w-4"/>Controle de Ponto</TabsTrigger>}
      {podeRH&&<TabsTrigger value="rh" className="gap-2"><UsersRound className="h-4 w-4"/>RH</TabsTrigger>}
    </TabsList>
    <TabsContent value="meu-ponto"><MeuPonto/></TabsContent>
    {podeControle&&<TabsContent value="controle"><ControlePonto/></TabsContent>}
    {podeRH&&<TabsContent value="rh"><CadastrosRH/></TabsContent>}
    </Tabs>
  </div>
}
