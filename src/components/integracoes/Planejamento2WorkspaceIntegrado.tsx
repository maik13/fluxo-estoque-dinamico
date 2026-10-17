/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarRange, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { appControleSupabase } from "@/integrations/appcontrole/client";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ac=appControleSupabase as any;
const fluxo=supabase as any;
const n=(v:unknown)=>Number(v||0);

type Workspace={id:string;appProjectSettingId:string;projectName:string;status:string;updatedAt:string|null};

async function loadDetail(workspace:Workspace){
  const [tasks,deps,fluxProject]=await Promise.all([
    ac.from("planejamento_v2_tasks").select("*").eq("workspace_id",workspace.id).order("position").order("created_at"),
    ac.from("planejamento_v2_dependencies").select("*").eq("workspace_id",workspace.id),
    fluxo.from("producao_projetos").select("id,nome,status,cliente").ilike("nome",workspace.projectName).is("excluido_em",null).limit(1),
  ]);
  if(tasks.error) throw tasks.error;
  if(deps.error) throw deps.error;
  if(fluxProject.error) throw fluxProject.error;
  const project=fluxProject.data?.[0]||null;
  let ops:any[]=[]; let produzido=0;
  if(project?.id){
    const [or,ap]=await Promise.all([
      fluxo.from("producao_ordens_producao").select("id,numero,descricao,status,quantidade_planejada").eq("projeto_id",project.id),
      fluxo.from("producao_apontamentos").select("quantidade_produzida,status").eq("projeto_local_id",project.local_utilizacao_id).neq("status","cancelado"),
    ]);
    if(!or.error) ops=or.data||[];
    if(!ap.error) produzido=(ap.data||[]).reduce((s:number,r:any)=>s+n(r.quantidade_produzida),0);
  }
  return {tasks:tasks.data||[],dependencies:deps.data||[],fluxProject:project,fluxOps:ops,fluxProduzido:produzido};
}

export function Planejamento2WorkspaceIntegrado({workspace,onBack}:{workspace:Workspace;onBack:()=>void}){
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({title:"",start:"",end:"",quantity:"",unit:""});
  const detail=useQuery({queryKey:["integracao-appcontrole-planejamento-workspace",workspace.id],queryFn:()=>loadDetail(workspace),staleTime:10000,refetchInterval:20000});
  const createTask=useMutation({
    mutationFn:async()=>{
      if(!form.title.trim()) throw new Error("Informe o nome da atividade.");
      const {data:auth,error:authError}=await appControleSupabase.auth.getUser(); if(authError) throw authError;
      const {data:last}=await ac.from("planejamento_v2_tasks").select("position").eq("workspace_id",workspace.id).order("position",{ascending:false}).limit(1);
      const {error}=await ac.from("planejamento_v2_tasks").insert({
        workspace_id:workspace.id,title:form.title.trim(),task_type:"task",status:"not_started",priority:"normal",
        position:n(last?.[0]?.position)+1000,start_date:form.start||null,end_date:form.end||null,
        quantity:form.quantity?Number(form.quantity.replace(",",".")):null,unit:form.unit.trim()||null,
        created_by:auth.user?.id||null,updated_by:auth.user?.id||null
      }); if(error) throw error;
    },
    onSuccess:async()=>{setOpen(false);setForm({title:"",start:"",end:"",quantity:"",unit:""});await detail.refetch();toast.success("Atividade adicionada.");},
    onError:(e:any)=>toast.error(e?.message||"Não foi possível criar a atividade."),
  });

  const updateTask=async(id:string,patch:Record<string,unknown>)=>{
    const {data:auth}=await appControleSupabase.auth.getUser();
    const {error}=await ac.from("planejamento_v2_tasks").update({...patch,updated_by:auth.user?.id||null,updated_at:new Date().toISOString()}).eq("id",id);
    if(error) return toast.error(error.message); await detail.refetch();
  };

  const tasks=detail.data?.tasks||[];
  const completed=tasks.filter((t:any)=>t.status==="completed").length;
  const progress=tasks.length?Math.round(tasks.reduce((s:number,t:any)=>s+n(t.progress),0)/tasks.length):0;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4"/>Voltar aos planejamentos</Button>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>void detail.refetch()}><RefreshCw className="mr-2 h-4 w-4"/>Atualizar</Button><Button size="sm" onClick={()=>setOpen(true)}><Plus className="mr-2 h-4 w-4"/>Nova atividade</Button></div>
    </div>
    <Card><CardHeader className="pb-3"><CardTitle>{workspace.projectName}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-5">
      <div><div className="text-xs text-muted-foreground">Tarefas</div><div className="text-2xl font-semibold">{tasks.length}</div></div>
      <div><div className="text-xs text-muted-foreground">Concluídas</div><div className="text-2xl font-semibold">{completed}</div></div>
      <div><div className="text-xs text-muted-foreground">Progresso</div><div className="text-2xl font-semibold">{progress}%</div></div>
      <div><div className="text-xs text-muted-foreground">OPs no Fluxo</div><div className="text-2xl font-semibold">{detail.data?.fluxOps.length||0}</div></div>
      <div><div className="text-xs text-muted-foreground">Produzido no Fluxo</div><div className="text-2xl font-semibold">{n(detail.data?.fluxProduzido).toLocaleString("pt-BR")}</div></div>
      <div className="md:col-span-5"><Progress value={progress}/></div>
    </CardContent></Card>
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3"><div><div className="font-semibold">Atividades do Planejamento 2.0</div><div className="text-xs text-muted-foreground">Edições são gravadas no App Controle.</div></div>{detail.data?.fluxProject&&<Badge variant="outline">Fluxo: {detail.data.fluxProject.nome}</Badge>}</div>
      {detail.isLoading?<div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin"/></div>:<Table>
        <TableHeader><TableRow><TableHead>Atividade</TableHead><TableHead>Período</TableHead><TableHead>Status</TableHead><TableHead>Progresso</TableHead><TableHead className="text-right">Qtd.</TableHead></TableRow></TableHeader>
        <TableBody>{tasks.map((t:any)=><TableRow key={t.id}>
          <TableCell className="font-medium">{t.title}</TableCell>
          <TableCell className="text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5"/>{t.start_date||"—"} → {t.end_date||"—"}</span></TableCell>
          <TableCell><Select value={t.status||"not_started"} onValueChange={v=>void updateTask(t.id,{status:v,progress:v==="completed"?100:t.progress})}><SelectTrigger className="h-8 w-[145px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="not_started">Não iniciada</SelectItem><SelectItem value="in_progress">Em andamento</SelectItem><SelectItem value="completed">Concluída</SelectItem><SelectItem value="blocked">Bloqueada</SelectItem></SelectContent></Select></TableCell>
          <TableCell><div className="flex items-center gap-2"><Progress value={n(t.progress)} className="w-28"/><span className="text-xs">{n(t.progress)}%</span></div></TableCell>
          <TableCell className="text-right">{t.quantity==null?"—":`${n(t.quantity).toLocaleString("pt-BR")} ${t.unit||""}`}</TableCell>
        </TableRow>)}{!tasks.length&&<TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Nenhuma atividade cadastrada.</TableCell></TableRow>}</TableBody>
      </Table>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Nova atividade</DialogTitle></DialogHeader><form onSubmit={(e:FormEvent)=>{e.preventDefault();createTask.mutate();}} className="space-y-4">
      <div className="space-y-2"><Label>Atividade *</Label><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
      <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Início</Label><Input type="date" value={form.start} onChange={e=>setForm({...form,start:e.target.value})}/></div><div className="space-y-2"><Label>Fim</Label><Input type="date" value={form.end} onChange={e=>setForm({...form,end:e.target.value})}/></div></div>
      <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Quantidade</Label><Input value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></div><div className="space-y-2"><Label>Unidade</Label><Input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></div></div>
      <DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit" disabled={createTask.isPending}>{createTask.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </div>;
}
