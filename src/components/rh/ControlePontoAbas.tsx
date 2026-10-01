import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle, ClipboardList, Loader2, Pencil, Plus, Search, Trash2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const db = supabase as any;

type Colaborador = {
  id: string;
  nome: string;
  controla_ponto: boolean;
  ativo: boolean;
};

type TimeEntry = {
  id: string;
  colaborador_id: string;
  data: string;
  hora_entrada_1: string | null;
  hora_saida_1: string | null;
  hora_entrada_2: string | null;
  hora_saida_2: string | null;
  hora_entrada_3: string | null;
  hora_saida_3: string | null;
  observacao: string | null;
  status: string;
};

const hasAnyPunch = (entry: Partial<TimeEntry>) =>
  [
    entry.hora_entrada_1,
    entry.hora_saida_1,
    entry.hora_entrada_2,
    entry.hora_saida_2,
    entry.hora_entrada_3,
    entry.hora_saida_3,
  ].some(Boolean);

async function fetchPointParticipants(): Promise<Colaborador[]> {
  const { data, error } = await db
    .from("rh_colaboradores")
    .select("id,nome,controla_ponto,ativo")
    .eq("ativo", true)
    .eq("controla_ponto", true)
    .order("nome");
  if (error) throw error;
  return data || [];
}

export function AprovacoesPontoTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const fetchPendingEntries = async () => {
    setLoading(true);
    try {
      const colabs = await fetchPointParticipants();
      const { data, error } = await db
        .from("rh_registros_ponto")
        .select("*")
        .eq("status", "pendente")
        .order("data", { ascending: false });
      if (error) throw error;
      setEntries((data || []).map((entry: TimeEntry) => ({
        ...entry,
        colaborador: colabs.find((c) => c.id === entry.colaborador_id),
      })));
      setSelectedIds([]);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar registros pendentes");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchPendingEntries(); }, []);

  const handleApproval = async (entry: TimeEntry, approved: boolean) => {
    if (approved && !hasAnyPunch(entry)) {
      toast.error("Registro sem nenhum horário lançado não pode ser aprovado.");
      return;
    }
    setProcessing(entry.id);
    try {
      const { error } = await db.rpc("rh_atualizar_status_ponto", {
        p_registro_id: entry.id,
        p_status: approved ? "aprovado" : "rejeitado",
      });
      if (error) throw error;
      toast.success(approved ? "Registro aprovado!" : "Registro rejeitado!");
      await fetchPendingEntries();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Erro ao processar registro");
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkApproval = async (approved: boolean) => {
    if (!selectedIds.length) return;
    const targets = entries.filter((e) => selectedIds.includes(e.id));
    if (approved && targets.some((e) => !hasAnyPunch(e))) {
      toast.error("Há registro selecionado sem horários. Ele não pode ser aprovado.");
      return;
    }
    setBulkProcessing(true);
    try {
      for (const id of selectedIds) {
        const { error } = await db.rpc("rh_atualizar_status_ponto", {
          p_registro_id: id,
          p_status: approved ? "aprovado" : "rejeitado",
        });
        if (error) throw error;
      }
      toast.success(approved
        ? `${selectedIds.length} registro(s) aprovado(s)!`
        : `${selectedIds.length} registro(s) rejeitado(s)!`);
      await fetchPendingEntries();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Erro ao processar registros");
    } finally {
      setBulkProcessing(false);
    }
  };

  const filteredEntries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return !q ? entries : entries.filter((e) => e.colaborador?.nome?.toLowerCase().includes(q));
  }, [entries, searchTerm]);

  const allSelected = filteredEntries.length > 0 && filteredEntries.every((e) => selectedIds.includes(e.id));

  return <div className="space-y-6">
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-xl"><ClipboardList className="h-5 w-5"/>Registros Pendentes de Aprovação</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 && <>
              <Badge variant="secondary">{selectedIds.length} selecionado(s)</Badge>
              <Button size="sm" onClick={() => void handleBulkApproval(true)} disabled={bulkProcessing} className="bg-green-600 hover:bg-green-700 text-white">
                {bulkProcessing ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-1 h-4 w-4"/>}Aprovar Todos
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void handleBulkApproval(false)} disabled={bulkProcessing}>
                <XCircle className="mr-1 h-4 w-4"/>Rejeitar Todos
              </Button>
            </>}
            <div className="relative w-full md:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Buscar colaborador..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="pl-10"/></div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div> :
          <div className="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50">
            <TableHead className="w-10"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : filteredEntries.map((e)=>e.id))} className="h-4 w-4"/></TableHead>
            <TableHead>Colaborador</TableHead><TableHead>Data</TableHead><TableHead>Entrada 1</TableHead><TableHead>Saída 1</TableHead><TableHead>Entrada 2</TableHead><TableHead>Saída 2</TableHead><TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader><TableBody>
            {!filteredEntries.length ? <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">Nenhum registro pendente</TableCell></TableRow> :
              filteredEntries.map((entry) => <TableRow key={entry.id}>
                <TableCell><input type="checkbox" checked={selectedIds.includes(entry.id)} onChange={() => setSelectedIds((prev)=>prev.includes(entry.id)?prev.filter((x)=>x!==entry.id):[...prev,entry.id])} className="h-4 w-4"/></TableCell>
                <TableCell className="font-medium">{entry.colaborador?.nome || "Não encontrado"}</TableCell>
                <TableCell>{format(new Date(entry.data+"T12:00:00"),"dd/MM/yyyy",{locale:ptBR})}</TableCell>
                <TableCell>{entry.hora_entrada_1?.slice(0,5)||"-"}</TableCell><TableCell>{entry.hora_saida_1?.slice(0,5)||"-"}</TableCell><TableCell>{entry.hora_entrada_2?.slice(0,5)||"-"}</TableCell><TableCell>{entry.hora_saida_2?.slice(0,5)||"-"}</TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={()=>void handleApproval(entry,true)} disabled={processing===entry.id} className="text-green-500">{processing===entry.id?<Loader2 className="h-4 w-4 animate-spin"/>:<><CheckCircle className="mr-1 h-4 w-4"/>Aprovar</>}</Button>
                  <Button variant="ghost" size="sm" onClick={()=>void handleApproval(entry,false)} disabled={processing===entry.id} className="text-red-500"><XCircle className="mr-1 h-4 w-4"/>Rejeitar</Button>
                </div></TableCell>
              </TableRow>)
            }
          </TableBody></Table></div>}
      </CardContent>
    </Card>
  </div>;
}

export function RegistrosPontoTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(),"yyyy-MM-dd"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry|null>(null);
  const [saving, setSaving] = useState(false);
  const [form,setForm] = useState<any>({colaborador_id:"",data:format(new Date(),"yyyy-MM-dd"),hora_entrada_1:"",hora_saida_1:"",hora_entrada_2:"",hora_saida_2:"",hora_entrada_3:"",hora_saida_3:"",observacao:""});

  const fetchData = async () => {
    setLoading(true);
    try {
      const colabs=await fetchPointParticipants();
      setColaboradores(colabs);
      const {data,error}=await db.from("rh_registros_ponto").select("*").eq("data",selectedDate).order("created_at",{ascending:false});
      if(error) throw error;
      setEntries((data||[]).map((entry:TimeEntry)=>({...entry,colaborador:colabs.find((c)=>c.id===entry.colaborador_id)})));
    } catch(error){console.error(error);toast.error("Erro ao carregar registros")} finally {setLoading(false)}
  };
  useEffect(()=>{void fetchData()},[selectedDate]);

  const openAdd=()=>{setEditingEntry(null);setForm({colaborador_id:"",data:selectedDate,hora_entrada_1:"",hora_saida_1:"",hora_entrada_2:"",hora_saida_2:"",hora_entrada_3:"",hora_saida_3:"",observacao:""});setDialogOpen(true)};
  const openEdit=(e:TimeEntry)=>{setEditingEntry(e);setForm({...e,hora_entrada_1:e.hora_entrada_1||"",hora_saida_1:e.hora_saida_1||"",hora_entrada_2:e.hora_entrada_2||"",hora_saida_2:e.hora_saida_2||"",hora_entrada_3:e.hora_entrada_3||"",hora_saida_3:e.hora_saida_3||"",observacao:e.observacao||""});setDialogOpen(true)};
  const set=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));

  const save=async()=>{
    if(!form.colaborador_id){toast.error("Selecione um colaborador");return}
    if(!hasAnyPunch(form)){toast.error("Informe ao menos um horário para salvar o registro de ponto");return}
    setSaving(true);
    const payload={colaborador_id:form.colaborador_id,data:form.data,hora_entrada_1:form.hora_entrada_1||null,hora_saida_1:form.hora_saida_1||null,hora_entrada_2:form.hora_entrada_2||null,hora_saida_2:form.hora_saida_2||null,hora_entrada_3:form.hora_entrada_3||null,hora_saida_3:form.hora_saida_3||null,observacao:form.observacao||null,status:"aprovado"};
    try{
      const res=editingEntry?await db.from("rh_registros_ponto").update(payload).eq("id",editingEntry.id):await db.from("rh_registros_ponto").insert(payload);
      if(res.error){if(res.error.code==="23505"){toast.error("Já existe um registro para este colaborador nesta data");return}throw res.error}
      toast.success(editingEntry?"Registro atualizado!":"Registro criado!");setDialogOpen(false);await fetchData();
    }catch(error){console.error(error);toast.error("Erro ao salvar registro")}finally{setSaving(false)}
  };

  const remove=async(entry:TimeEntry)=>{if(!confirm("Tem certeza que deseja excluir este registro?"))return;const {error}=await db.from("rh_registros_ponto").delete().eq("id",entry.id);if(error)toast.error(error.message);else{toast.success("Registro excluído!");await fetchData()}};

  const filtered=useMemo(()=>{const q=searchTerm.trim().toLowerCase();return !q?entries:entries.filter((e)=>e.colaborador?.nome?.toLowerCase().includes(q))},[entries,searchTerm]);

  return <div className="space-y-6"><Card><CardHeader><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><CardTitle className="flex items-center gap-2 text-xl"><Calendar className="h-5 w-5"/>Todos os Registros</CardTitle><div className="flex flex-wrap items-center gap-3"><Input type="date" value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)} className="w-auto"/><div className="relative w-full md:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Buscar colaborador..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="pl-10"/></div><Button onClick={openAdd}><Plus className="mr-2 h-4 w-4"/>Novo Registro</Button></div></div></CardHeader><CardContent>
    {loading?<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>:<div className="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Colaborador</TableHead><TableHead>Entrada 1</TableHead><TableHead>Saída 1</TableHead><TableHead>Entrada 2</TableHead><TableHead>Saída 2</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
      {!filtered.length?<TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>:filtered.map((entry)=><TableRow key={entry.id}><TableCell className="font-medium">{entry.colaborador?.nome||"Não encontrado"}</TableCell><TableCell>{entry.hora_entrada_1?.slice(0,5)||"-"}</TableCell><TableCell>{entry.hora_saida_1?.slice(0,5)||"-"}</TableCell><TableCell>{entry.hora_entrada_2?.slice(0,5)||"-"}</TableCell><TableCell>{entry.hora_saida_2?.slice(0,5)||"-"}</TableCell><TableCell><Badge className={entry.status==="aprovado"?"bg-green-500/20 text-green-400":entry.status==="rejeitado"?"bg-red-500/20 text-red-400":"bg-yellow-500/20 text-yellow-400"}>{entry.status==="aprovado"?"Aprovado":entry.status==="rejeitado"?"Rejeitado":"Pendente"}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={()=>openEdit(entry)}><Pencil className="h-4 w-4"/></Button><Button variant="ghost" size="icon" onClick={()=>void remove(entry)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div></TableCell></TableRow>)}
    </TableBody></Table></div>}
  </CardContent></Card>
  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editingEntry?"Editar Registro":"Novo Registro"}</DialogTitle><DialogDescription>Preencha os horários do colaborador</DialogDescription></DialogHeader><div className="space-y-4 py-4">
    <div className="space-y-2"><Label>Colaborador</Label><Select value={form.colaborador_id} onValueChange={(v)=>set("colaborador_id",v)} disabled={!!editingEntry}><SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger><SelectContent>{colaboradores.map((c)=><SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.data} onChange={(e)=>set("data",e.target.value)} disabled={!!editingEntry}/></div>
    <div className="grid grid-cols-2 gap-4">
      {["hora_entrada_1","hora_saida_1","hora_entrada_2","hora_saida_2","hora_entrada_3","hora_saida_3"].map((k)=><div className="space-y-2" key={k}><Label>{k.replace("hora_","").replace("_"," ").replace("entrada","Entrada").replace("saida","Saída")}</Label><Input type="time" value={form[k]} onChange={(e)=>set(k,e.target.value)}/></div>)}
    </div>
    <div className="space-y-2"><Label>Observação</Label><Input value={form.observacao} onChange={(e)=>set("observacao",e.target.value)} placeholder="Opcional"/></div>
  </div><DialogFooter><Button variant="outline" onClick={()=>setDialogOpen(false)} disabled={saving}>Cancelar</Button><Button onClick={()=>void save()} disabled={saving}>{saving&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Salvar</Button></DialogFooter></DialogContent></Dialog></div>;
}
