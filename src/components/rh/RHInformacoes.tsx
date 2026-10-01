import { useEffect, useState } from "react";
import { FuncionariosRhTab } from "@/components/rh/FuncionariosRhTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarDays, Clock, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUrlTabState } from "@/hooks/useUrlTabState";
import { usePermissions } from "@/hooks/usePermissions";

const db = supabase as any;

interface Jornada {
  id: string;
  nome: string;
  descricao: string | null;
  carga_horaria_semanal: number;
  ativo: boolean;
  segunda_entrada_1: string | null;
  segunda_saida_1: string | null;
  segunda_entrada_2: string | null;
  segunda_saida_2: string | null;
  terca_entrada_1: string | null;
  terca_saida_1: string | null;
  terca_entrada_2: string | null;
  terca_saida_2: string | null;
  quarta_entrada_1: string | null;
  quarta_saida_1: string | null;
  quarta_entrada_2: string | null;
  quarta_saida_2: string | null;
  quinta_entrada_1: string | null;
  quinta_saida_1: string | null;
  quinta_entrada_2: string | null;
  quinta_saida_2: string | null;
  sexta_entrada_1: string | null;
  sexta_saida_1: string | null;
  sexta_entrada_2: string | null;
  sexta_saida_2: string | null;
  sabado_entrada_1: string | null;
  sabado_saida_1: string | null;
  sabado_entrada_2: string | null;
  sabado_saida_2: string | null;
  domingo_entrada_1: string | null;
  domingo_saida_1: string | null;
  domingo_entrada_2: string | null;
  domingo_saida_2: string | null;
}

interface Feriado {
  id: string;
  nome: string;
  data: string;
  tipo: string;
  ativo: boolean;
}

export default function RHInformacoes() {
  const [activeTab, setActiveTab] = useUrlTabState({
    defaultTab: "funcionarios",
    validTabs: ["funcionarios", "jornadas", "rh_feriados"] as const,
  });

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Informações RH</h1>
          <p className="mt-1 text-muted-foreground">Gerencie cadastros de funcionários, jornadas e feriados</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="funcionarios" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Funcionários
            </TabsTrigger>
            <TabsTrigger value="jornadas" className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Jornadas de Trabalho
            </TabsTrigger>
            <TabsTrigger value="rh_feriados" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Feriados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="funcionarios" className="mt-6"><FuncionariosRhTab /></TabsContent>
          <TabsContent value="jornadas" className="mt-6"><JornadasTab /></TabsContent>
          <TabsContent value="rh_feriados" className="mt-6"><FeriadosTab /></TabsContent>
        </Tabs>
      </div>
  );
}

const defaultHorarios = () => ({
  segunda: { entrada1: "08:00", saida1: "12:00", entrada2: "14:00", saida2: "18:00" },
  terca: { entrada1: "08:00", saida1: "12:00", entrada2: "14:00", saida2: "18:00" },
  quarta: { entrada1: "08:00", saida1: "12:00", entrada2: "14:00", saida2: "18:00" },
  quinta: { entrada1: "08:00", saida1: "12:00", entrada2: "14:00", saida2: "18:00" },
  sexta: { entrada1: "08:00", saida1: "12:00", entrada2: "14:00", saida2: "18:00" },
  sabado: { entrada1: "", saida1: "", entrada2: "", saida2: "" },
  domingo: { entrada1: "", saida1: "", entrada2: "", saida2: "" },
});

type DiaKey = keyof ReturnType<typeof defaultHorarios>;

function JornadasTab() {
  const { isAdmin, hasPermission } = usePermissions();
  const canManage = isAdmin() || hasPermission("rh.jornadas.gerenciar");
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJornada, setEditingJornada] = useState<Jornada | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState("40");
  const [horarios, setHorarios] = useState(defaultHorarios());
  const [ativo, setAtivo] = useState(true);

  const fetchJornadas = async () => {
    setLoading(true);
    try {
      const { data, error } = await db.from("rh_jornadas").select("*").order("nome");
      if (error) throw error;
      setJornadas((data || []) as Jornada[]);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar jornadas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchJornadas(); }, []);

  const openAddDialog = () => {
    setEditingJornada(null);
    setNome("");
    setDescricao("");
    setCargaHoraria("40");
    setHorarios(defaultHorarios());
    setAtivo(true);
    setDialogOpen(true);
  };

  const openEditDialog = (jornada: Jornada) => {
    setEditingJornada(jornada);
    setNome(jornada.nome);
    setDescricao(jornada.descricao || "");
    setCargaHoraria(String(jornada.carga_horaria_semanal));
    setHorarios({
      segunda: { entrada1: jornada.segunda_entrada_1 || "", saida1: jornada.segunda_saida_1 || "", entrada2: jornada.segunda_entrada_2 || "", saida2: jornada.segunda_saida_2 || "" },
      terca: { entrada1: jornada.terca_entrada_1 || "", saida1: jornada.terca_saida_1 || "", entrada2: jornada.terca_entrada_2 || "", saida2: jornada.terca_saida_2 || "" },
      quarta: { entrada1: jornada.quarta_entrada_1 || "", saida1: jornada.quarta_saida_1 || "", entrada2: jornada.quarta_entrada_2 || "", saida2: jornada.quarta_saida_2 || "" },
      quinta: { entrada1: jornada.quinta_entrada_1 || "", saida1: jornada.quinta_saida_1 || "", entrada2: jornada.quinta_entrada_2 || "", saida2: jornada.quinta_saida_2 || "" },
      sexta: { entrada1: jornada.sexta_entrada_1 || "", saida1: jornada.sexta_saida_1 || "", entrada2: jornada.sexta_entrada_2 || "", saida2: jornada.sexta_saida_2 || "" },
      sabado: { entrada1: jornada.sabado_entrada_1 || "", saida1: jornada.sabado_saida_1 || "", entrada2: jornada.sabado_entrada_2 || "", saida2: jornada.sabado_saida_2 || "" },
      domingo: { entrada1: jornada.domingo_entrada_1 || "", saida1: jornada.domingo_saida_1 || "", entrada2: jornada.domingo_entrada_2 || "", saida2: jornada.domingo_saida_2 || "" },
    });
    setAtivo(jornada.ativo);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingJornada(null);
  };

  const handleSave = async () => {
    if (!nome.trim()) return toast.error("Nome é obrigatório");
    setSaving(true);
    try {
      const payload = {
        nome: nome.trim(),
        descricao: descricao || null,
        carga_horaria_semanal: Number(cargaHoraria),
        segunda_entrada_1: horarios.segunda.entrada1 || null,
        segunda_saida_1: horarios.segunda.saida1 || null,
        segunda_entrada_2: horarios.segunda.entrada2 || null,
        segunda_saida_2: horarios.segunda.saida2 || null,
        terca_entrada_1: horarios.terca.entrada1 || null,
        terca_saida_1: horarios.terca.saida1 || null,
        terca_entrada_2: horarios.terca.entrada2 || null,
        terca_saida_2: horarios.terca.saida2 || null,
        quarta_entrada_1: horarios.quarta.entrada1 || null,
        quarta_saida_1: horarios.quarta.saida1 || null,
        quarta_entrada_2: horarios.quarta.entrada2 || null,
        quarta_saida_2: horarios.quarta.saida2 || null,
        quinta_entrada_1: horarios.quinta.entrada1 || null,
        quinta_saida_1: horarios.quinta.saida1 || null,
        quinta_entrada_2: horarios.quinta.entrada2 || null,
        quinta_saida_2: horarios.quinta.saida2 || null,
        sexta_entrada_1: horarios.sexta.entrada1 || null,
        sexta_saida_1: horarios.sexta.saida1 || null,
        sexta_entrada_2: horarios.sexta.entrada2 || null,
        sexta_saida_2: horarios.sexta.saida2 || null,
        sabado_entrada_1: horarios.sabado.entrada1 || null,
        sabado_saida_1: horarios.sabado.saida1 || null,
        sabado_entrada_2: horarios.sabado.entrada2 || null,
        sabado_saida_2: horarios.sabado.saida2 || null,
        domingo_entrada_1: horarios.domingo.entrada1 || null,
        domingo_saida_1: horarios.domingo.saida1 || null,
        domingo_entrada_2: horarios.domingo.entrada2 || null,
        domingo_saida_2: horarios.domingo.saida2 || null,
        ativo,
      };
      const query = editingJornada
        ? db.from("rh_jornadas").update(payload).eq("id", editingJornada.id)
        : db.from("rh_jornadas").insert(payload);
      const { error } = await query;
      if (error) throw error;
      toast.success(editingJornada ? "Jornada atualizada!" : "Jornada criada!");
      closeDialog();
      await fetchJornadas();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar jornada");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta jornada?")) return;
    setDeleting(id);
    try {
      const { data: result, error } = await db.rpc("rh_remover_jornada", { p_id: id });
      if (error) throw error;
      toast.success(result === "inativada" ? "Jornada inativada para preservar o histórico." : "Jornada excluída!");
      await fetchJornadas();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir jornada. Pode haver funcionários vinculados.");
    } finally {
      setDeleting(null);
    }
  };

  const diasSemana: Array<{ key: DiaKey; label: string }> = [
    { key: "domingo", label: "Domingo" },
    { key: "segunda", label: "Segunda-feira" },
    { key: "terca", label: "Terça-feira" },
    { key: "quarta", label: "Quarta-feira" },
    { key: "quinta", label: "Quinta-feira" },
    { key: "sexta", label: "Sexta-feira" },
    { key: "sabado", label: "Sábado" },
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div><CardTitle className="flex items-center gap-2 text-xl"><Clock className="h-5 w-5" /> Jornadas de Trabalho</CardTitle><CardDescription>Configure os horários contratuais de trabalho</CardDescription></div>
            {canManage && <Button onClick={openAddDialog}><Plus className="mr-2 h-4 w-4" /> Nova Jornada</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader><TableRow className="bg-muted/50"><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead>Carga Horária</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {jornadas.length === 0 ? <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">Nenhuma jornada cadastrada</TableCell></TableRow> : jornadas.map((jornada) => (
                    <TableRow key={jornada.id}>
                      <TableCell className="font-medium">{jornada.nome}</TableCell><TableCell>{jornada.descricao || "-"}</TableCell><TableCell>{jornada.carga_horaria_semanal}h/semana</TableCell>
                      <TableCell><Badge className={jornada.ativo ? "border-green-500/30 bg-green-500/20 text-green-400" : "border-red-500/30 bg-red-500/20 text-red-400"}>{jornada.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell className="text-right"><div className="flex justify-end gap-1">{canManage && <><Button variant="ghost" size="icon" onClick={() => openEditDialog(jornada)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => void handleDelete(jornada.id)} disabled={deleting === jornada.id} className="text-destructive hover:text-destructive">{deleting === jornada.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></>}</div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingJornada ? "Editar Jornada" : "Nova Jornada"}</DialogTitle><DialogDescription>Configure os horários de entrada e saída para cada dia da semana</DialogDescription></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label>Nome da Jornada *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
              <div className="space-y-2"><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
              <div className="space-y-2"><Label>Carga Horária Semanal</Label><Input type="number" value={cargaHoraria} onChange={(e) => setCargaHoraria(e.target.value)} /></div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader><TableRow className="bg-muted/50"><TableHead>Dia</TableHead><TableHead>Entrada 1</TableHead><TableHead>Saída 1</TableHead><TableHead>Entrada 2</TableHead><TableHead>Saída 2</TableHead></TableRow></TableHeader>
                <TableBody>{diasSemana.map((dia) => (
                  <TableRow key={dia.key}>
                    <TableCell className="font-medium">{dia.label}</TableCell>
                    {(["entrada1", "saida1", "entrada2", "saida2"] as const).map((field) => (
                      <TableCell key={field}><Input type="time" className="w-24" value={horarios[dia.key][field]} onChange={(e) => setHorarios((prev) => ({ ...prev, [dia.key]: { ...prev[dia.key], [field]: e.target.value } }))} /></TableCell>
                    ))}
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
            <div className="flex items-center gap-3"><Switch checked={ativo} onCheckedChange={setAtivo} id="ativo-jornada" /><Label htmlFor="ativo-jornada">Jornada Ativa</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={closeDialog} disabled={saving}>Cancelar</Button><Button onClick={() => void handleSave()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingJornada ? "Salvar Alterações" : "Criar Jornada"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeriadosTab() {
  const { isAdmin, hasPermission } = usePermissions();
  const canManage = isAdmin() || hasPermission("rh.feriados.gerenciar");
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFeriado, setEditingFeriado] = useState<Feriado | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState("nacional");

  const fetchFeriados = async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await db.from("rh_feriados").select("*").order("data");
      if (error) throw error;
      setFeriados((rows || []) as Feriado[]);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar feriados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchFeriados(); }, []);

  const openAddDialog = () => { setEditingFeriado(null); setNome(""); setData(""); setTipo("nacional"); setDialogOpen(true); };
  const openEditDialog = (feriado: Feriado) => { setEditingFeriado(feriado); setNome(feriado.nome); setData(feriado.data); setTipo(feriado.tipo); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditingFeriado(null); };

  const handleSave = async () => {
    if (!nome.trim() || !data) return toast.error("Nome e data são obrigatórios");
    setSaving(true);
    try {
      const payload = { nome: nome.trim(), data, tipo };
      const query = editingFeriado ? db.from("rh_feriados").update(payload).eq("id", editingFeriado.id) : db.from("rh_feriados").insert(payload);
      const { error } = await query;
      if (error) throw error;
      toast.success(editingFeriado ? "Feriado atualizado!" : "Feriado cadastrado!");
      closeDialog();
      await fetchFeriados();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar feriado");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este feriado?")) return;
    setDeleting(id);
    try {
      const { data: result, error } = await db.rpc("rh_remover_feriado", { p_id: id });
      if (error) throw error;
      toast.success(result === "inativado" ? "Feriado inativado para preservar o histórico." : "Feriado excluído!");
      await fetchFeriados();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir feriado");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><CardTitle className="flex items-center gap-2 text-xl"><CalendarDays className="h-5 w-5" /> Feriados</CardTitle><CardDescription>Configure os feriados para cálculo de horas extras 100%</CardDescription></div>{canManage && <Button onClick={openAddDialog}><Plus className="mr-2 h-4 w-4" /> Novo Feriado</Button>}</div></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <div className="overflow-hidden rounded-lg border border-border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Data</TableHead><TableHead>Feriado</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
              {feriados.length === 0 ? <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">Nenhum feriado cadastrado</TableCell></TableRow> : feriados.map((feriado) => (
                <TableRow key={feriado.id}><TableCell className="font-medium">{format(new Date(`${feriado.data}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}</TableCell><TableCell>{feriado.nome}</TableCell><TableCell><Badge variant="outline" className="capitalize">{feriado.tipo}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-1">{canManage && <><Button variant="ghost" size="icon" onClick={() => openEditDialog(feriado)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => void handleDelete(feriado.id)} disabled={deleting === feriado.id} className="text-destructive hover:text-destructive">{deleting === feriado.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></>}</div></TableCell></TableRow>
              ))}
            </TableBody></Table></div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editingFeriado ? "Editar Feriado" : "Novo Feriado"}</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="space-y-2"><Label>Nome do Feriado *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div><div className="space-y-2"><Label>Data *</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div><div className="space-y-2"><Label>Tipo</Label><Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nacional">Nacional</SelectItem><SelectItem value="estadual">Estadual</SelectItem><SelectItem value="municipal">Municipal</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={closeDialog} disabled={saving}>Cancelar</Button><Button onClick={() => void handleSave()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingFeriado ? "Salvar" : "Cadastrar"}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
