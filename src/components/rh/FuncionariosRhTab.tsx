import { useEffect, useMemo, useState } from "react";
import { Briefcase, Clock3, Loader2, Pencil, Search, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const db = supabase as any;

type ContractType = "clt" | "pj" | "diarista" | "horista";
type JornadaMode = "none" | "preset" | "custom";
type DiaKey = "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado" | "domingo";
type PeriodosDia = { entrada1: string; saida1: string; entrada2: string; saida2: string };
type HorariosSemana = Record<DiaKey, PeriodosDia>;

type UsuarioExistente = { user_id: string; nome: string; email: string | null; colaborador_id: string | null };

type Colaborador = {
  id: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  email: string | null;
  user_id: string | null;
  cpf_cnpj: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  salario: number | null;
  data_admissao: string | null;
  pis: string | null;
  jornada_id: string | null;
  ativo: boolean;
  rh_ativo: boolean;
  pista_ativo_legado: boolean;
  controla_ponto: boolean;
  created_at: string;
  tipo_contrato: ContractType | null;
  valor_contrato: number | null;
  hora_extra_gera_valor: boolean;
};

type Jornada = {
  id: string;
  nome: string;
  descricao?: string | null;
  carga_horaria_semanal: number;
  ativo: boolean;
  personalizada_para_colaborador_id?: string | null;
  segunda_entrada_1?: string | null;
  segunda_saida_1?: string | null;
  segunda_entrada_2?: string | null;
  segunda_saida_2?: string | null;
  terca_entrada_1?: string | null;
  terca_saida_1?: string | null;
  terca_entrada_2?: string | null;
  terca_saida_2?: string | null;
  quarta_entrada_1?: string | null;
  quarta_saida_1?: string | null;
  quarta_entrada_2?: string | null;
  quarta_saida_2?: string | null;
  quinta_entrada_1?: string | null;
  quinta_saida_1?: string | null;
  quinta_entrada_2?: string | null;
  quinta_saida_2?: string | null;
  sexta_entrada_1?: string | null;
  sexta_saida_1?: string | null;
  sexta_entrada_2?: string | null;
  sexta_saida_2?: string | null;
  sabado_entrada_1?: string | null;
  sabado_saida_1?: string | null;
  sabado_entrada_2?: string | null;
  sabado_saida_2?: string | null;
  domingo_entrada_1?: string | null;
  domingo_saida_1?: string | null;
  domingo_entrada_2?: string | null;
  domingo_saida_2?: string | null;
};

const DIAS: Array<{ key: DiaKey; label: string }> = [
  { key: "segunda", label: "Segunda-feira" },
  { key: "terca", label: "Terça-feira" },
  { key: "quarta", label: "Quarta-feira" },
  { key: "quinta", label: "Quinta-feira" },
  { key: "sexta", label: "Sexta-feira" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

const emptyHorarios = (): HorariosSemana => ({
  segunda: { entrada1: "", saida1: "", entrada2: "", saida2: "" },
  terca: { entrada1: "", saida1: "", entrada2: "", saida2: "" },
  quarta: { entrada1: "", saida1: "", entrada2: "", saida2: "" },
  quinta: { entrada1: "", saida1: "", entrada2: "", saida2: "" },
  sexta: { entrada1: "", saida1: "", entrada2: "", saida2: "" },
  sabado: { entrada1: "", saida1: "", entrada2: "", saida2: "" },
  domingo: { entrada1: "", saida1: "", entrada2: "", saida2: "" },
});

const timeValue = (value?: string | null) => (value ? value.slice(0, 5) : "");

const horariosFromJornada = (jornada?: Jornada | null): HorariosSemana => ({
  segunda: {
    entrada1: timeValue(jornada?.segunda_entrada_1),
    saida1: timeValue(jornada?.segunda_saida_1),
    entrada2: timeValue(jornada?.segunda_entrada_2),
    saida2: timeValue(jornada?.segunda_saida_2),
  },
  terca: {
    entrada1: timeValue(jornada?.terca_entrada_1),
    saida1: timeValue(jornada?.terca_saida_1),
    entrada2: timeValue(jornada?.terca_entrada_2),
    saida2: timeValue(jornada?.terca_saida_2),
  },
  quarta: {
    entrada1: timeValue(jornada?.quarta_entrada_1),
    saida1: timeValue(jornada?.quarta_saida_1),
    entrada2: timeValue(jornada?.quarta_entrada_2),
    saida2: timeValue(jornada?.quarta_saida_2),
  },
  quinta: {
    entrada1: timeValue(jornada?.quinta_entrada_1),
    saida1: timeValue(jornada?.quinta_saida_1),
    entrada2: timeValue(jornada?.quinta_entrada_2),
    saida2: timeValue(jornada?.quinta_saida_2),
  },
  sexta: {
    entrada1: timeValue(jornada?.sexta_entrada_1),
    saida1: timeValue(jornada?.sexta_saida_1),
    entrada2: timeValue(jornada?.sexta_entrada_2),
    saida2: timeValue(jornada?.sexta_saida_2),
  },
  sabado: {
    entrada1: timeValue(jornada?.sabado_entrada_1),
    saida1: timeValue(jornada?.sabado_saida_1),
    entrada2: timeValue(jornada?.sabado_entrada_2),
    saida2: timeValue(jornada?.sabado_saida_2),
  },
  domingo: {
    entrada1: timeValue(jornada?.domingo_entrada_1),
    saida1: timeValue(jornada?.domingo_saida_1),
    entrada2: timeValue(jornada?.domingo_entrada_2),
    saida2: timeValue(jornada?.domingo_saida_2),
  },
});

const toMinutes = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

const validateAndCalculateSchedule = (horarios: HorariosSemana) => {
  let totalMinutes = 0;

  for (const { key, label } of DIAS) {
    const day = horarios[key];
    const periods: Array<[string, string, string]> = [
      [day.entrada1, day.saida1, "1º período"],
      [day.entrada2, day.saida2, "2º período"],
    ];

    const normalized: Array<{ start: number; end: number }> = [];

    for (const [entry, exit, periodLabel] of periods) {
      if (!entry && !exit) continue;
      if (!entry || !exit) {
        return { error: `${label}: preencha entrada e saída do ${periodLabel}.`, totalMinutes: 0 };
      }
      const start = toMinutes(entry);
      const end = toMinutes(exit);
      if (end <= start) {
        return { error: `${label}: a saída do ${periodLabel} precisa ser posterior à entrada.`, totalMinutes: 0 };
      }
      normalized.push({ start, end });
      totalMinutes += end - start;
    }

    if (normalized.length === 2 && normalized[1].start < normalized[0].end) {
      return { error: `${label}: os dois períodos não podem se sobrepor.`, totalMinutes: 0 };
    }
  }

  if (totalMinutes <= 0) {
    return { error: "Informe pelo menos um período de trabalho na jornada personalizada.", totalMinutes: 0 };
  }

  return { error: null, totalMinutes };
};

const hoursLabel = (minutes: number) => {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(2).replace(".", ",")}h`;
};

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const contractLabel = (type: ContractType | null) => ({
  clt: "CLT",
  pj: "PJ",
  diarista: "Diarista",
  horista: "Horista",
} as Record<string, string>)[type ?? ""] ?? "Não informado";

function remunerationValue(func: Colaborador) {
  if (func.tipo_contrato === "clt") {
    const value = Number(func.salario ?? func.valor_contrato ?? 0);
    return value > 0 ? value : null;
  }
  const value = Number(func.valor_contrato ?? 0);
  return value > 0 ? value : null;
}

function remunerationSuffix(type: ContractType | null) {
  if (type === "horista") return "/h";
  if (type === "diarista" || type === "pj") return "/dia";
  return "/mês";
}

export function FuncionariosRhTab() {
  const { isAdmin, hasPermission, loading: permissionsLoading } = usePermissions();
  const canManageRh = isAdmin() || hasPermission("rh.colaboradores.gerenciar");
  const [funcionarios, setFuncionarios] = useState<Colaborador[]>([]);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFuncionario, setEditingFuncionario] = useState<Colaborador | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [cargo, setCargo] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [salario, setSalario] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [pis, setPis] = useState("");
  const [jornadaMode, setJornadaMode] = useState<JornadaMode>("none");
  const [jornadaId, setJornadaId] = useState("");
  const [customHorarios, setCustomHorarios] = useState<HorariosSemana>(emptyHorarios());
  const [rhAtivo, setRhAtivo] = useState(true);
  const [pistaAtivo, setPistaAtivo] = useState(false);
  const [controlaPonto, setControlaPonto] = useState(false);
  const [tipoContrato, setTipoContrato] = useState<ContractType>("clt");
  const [valorContrato, setValorContrato] = useState("");
  const [usuariosExistentes, setUsuariosExistentes] = useState<UsuarioExistente[]>([]);
  const [usuarioExistenteId, setUsuarioExistenteId] = useState("");
  const [criarLogin, setCriarLogin] = useState(true);
  const [senha, setSenha] = useState("");

  const presetJornadas = useMemo(
    () => jornadas.filter((j) => j.ativo !== false && !j.personalizada_para_colaborador_id),
    [jornadas],
  );

  const customScheduleSummary = useMemo(
    () => validateAndCalculateSchedule(customHorarios),
    [customHorarios],
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [funcResponse, jornadaResponse, usuariosResponse] = await Promise.all([
        db.from("rh_colaboradores").select("*").order("nome"),
        db.from("rh_jornadas").select("*").order("nome"),
        canManageRh ? db.rpc("rh_listar_usuarios_vinculaveis") : Promise.resolve({ data: [], error: null }),
      ]);
      if (funcResponse.error) throw funcResponse.error;
      if (jornadaResponse.error) throw jornadaResponse.error;
      if (usuariosResponse.error) throw usuariosResponse.error;
      setUsuariosExistentes(usuariosResponse.data ?? []);
      setFuncionarios((funcResponse.data ?? []) as Colaborador[]);
      setJornadas((jornadaResponse.data ?? []) as Jornada[]);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Erro ao carregar funcionários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoading) void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsLoading]);

  const resetForm = () => {
    setNome("");
    setEmail("");
    setCpfCnpj("");
    setTelefone("");
    setDataNascimento("");
    setEndereco("");
    setCidade("");
    setEstado("");
    setCep("");
    setCargo("");
    setDepartamento("");
    setSalario("");
    setDataAdmissao("");
    setPis("");
    setJornadaMode("none");
    setJornadaId("");
    setCustomHorarios(emptyHorarios());
    setRhAtivo(true);
    setPistaAtivo(false);
    setControlaPonto(false);
    setTipoContrato("clt");
    setValorContrato("");
    setCriarLogin(true);
    setUsuarioExistenteId("");
    setSenha("");
  };

  const openAddDialog = () => {
    setEditingFuncionario(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (func: Colaborador) => {
    const assignedJourney = jornadas.find((j) => j.id === func.jornada_id) ?? null;
    const personalJourney = jornadas.find((j) => j.personalizada_para_colaborador_id === func.id) ?? null;

    setEditingFuncionario(func);
    setNome(func.nome);
    setEmail(func.email || "");
    setCpfCnpj(func.cpf_cnpj || "");
    setTelefone(func.telefone || "");
    setDataNascimento(func.data_nascimento || "");
    setEndereco(func.endereco || "");
    setCidade(func.cidade || "");
    setEstado(func.estado || "");
    setCep(func.cep || "");
    setCargo(func.cargo || "");
    setDepartamento(func.departamento || "");
    setDataAdmissao(func.data_admissao || "");
    setPis(func.pis || "");

    if (assignedJourney?.personalizada_para_colaborador_id === func.id) {
      setJornadaMode("custom");
      setJornadaId("");
      setCustomHorarios(horariosFromJornada(assignedJourney));
    } else if (func.jornada_id) {
      setJornadaMode("preset");
      setJornadaId(func.jornada_id);
      setCustomHorarios(horariosFromJornada(personalJourney ?? assignedJourney));
    } else {
      setJornadaMode("none");
      setJornadaId("");
      setCustomHorarios(horariosFromJornada(personalJourney));
    }

    setRhAtivo(func.rh_ativo);
    setPistaAtivo(func.pista_ativo_legado);
    setControlaPonto(func.rh_ativo ? func.controla_ponto : false);
    const contract = (func.tipo_contrato || "clt") as ContractType;
    setTipoContrato(contract);
    if (contract === "clt") {
      setSalario(String(func.salario ?? func.valor_contrato ?? ""));
      setValorContrato("");
    } else {
      setSalario("");
      setValorContrato(String(func.valor_contrato ?? ""));
    }
    setCriarLogin(false);
    setUsuarioExistenteId(func.user_id || "");
    setSenha("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingFuncionario(null);
  };

  const saveMemberships = async (id: string, nextRh: boolean, nextPista: boolean) => {
    const { error } = await db.rpc("rh_set_colaborador_contextos", {
      p_colaborador_id: id,
      p_rh_ativo: nextRh,
      p_pista_ativo: nextPista,
    });
    if (error) throw error;
  };

  const employeePayload = (resolvedJornadaId?: string | null) => ({
    nome: nome.trim(),
    email: email || null,
    cpf_cnpj: cpfCnpj || null,
    telefone: telefone || null,
    data_nascimento: dataNascimento || null,
    endereco: endereco || null,
    cidade: cidade || null,
    estado: estado || null,
    cep: cep || null,
    cargo: cargo || null,
    departamento: departamento || null,
    salario: tipoContrato === "clt" && salario ? Number(salario) : null,
    data_admissao: dataAdmissao || null,
    pis: pis || null,
    jornada_id: resolvedJornadaId !== undefined
      ? resolvedJornadaId
      : jornadaMode === "preset"
        ? jornadaId || null
        : null,
    controla_ponto: rhAtivo ? controlaPonto : false,
    tipo_contrato: tipoContrato,
    valor_contrato: tipoContrato === "clt" ? null : valorContrato ? Number(valorContrato) : null,
    hora_extra_gera_valor: tipoContrato !== "horista",
  });

  const updateEmployeeFields = async (id: string, resolvedJornadaId: string | null) => {
    const payload = employeePayload(resolvedJornadaId);
    const { error } = await db.rpc("rh_update_colaborador_fields", {
      p_colaborador_id: id,
      p_nome: payload.nome,
      p_email: payload.email,
      p_cpf_cnpj: payload.cpf_cnpj,
      p_telefone: payload.telefone,
      p_data_nascimento: payload.data_nascimento,
      p_endereco: payload.endereco,
      p_cidade: payload.cidade,
      p_estado: payload.estado,
      p_cep: payload.cep,
      p_cargo: payload.cargo,
      p_departamento: payload.departamento,
      p_salario: payload.salario,
      p_data_admissao: payload.data_admissao,
      p_pis: payload.pis,
      p_jornada_id: payload.jornada_id,
      p_controla_ponto: payload.controla_ponto,
      p_tipo_contrato: payload.tipo_contrato,
      p_valor_contrato: payload.valor_contrato,
      p_hora_extra_gera_valor: payload.hora_extra_gera_valor,
    });
    if (error) throw error;
  };

  const customJourneyPayload = (collaboratorId: string) => {
    const { totalMinutes } = validateAndCalculateSchedule(customHorarios);
    const weeklyHours = Math.round((totalMinutes / 60) * 100) / 100;
    return {
      nome: `Personalizada — ${nome.trim()}`,
      descricao: `Jornada individual vinculada ao cadastro de ${nome.trim()}.`,
      carga_horaria_semanal: weeklyHours,
      ativo: true,
      personalizada_para_colaborador_id: collaboratorId,
      segunda_entrada_1: customHorarios.segunda.entrada1 || null,
      segunda_saida_1: customHorarios.segunda.saida1 || null,
      segunda_entrada_2: customHorarios.segunda.entrada2 || null,
      segunda_saida_2: customHorarios.segunda.saida2 || null,
      terca_entrada_1: customHorarios.terca.entrada1 || null,
      terca_saida_1: customHorarios.terca.saida1 || null,
      terca_entrada_2: customHorarios.terca.entrada2 || null,
      terca_saida_2: customHorarios.terca.saida2 || null,
      quarta_entrada_1: customHorarios.quarta.entrada1 || null,
      quarta_saida_1: customHorarios.quarta.saida1 || null,
      quarta_entrada_2: customHorarios.quarta.entrada2 || null,
      quarta_saida_2: customHorarios.quarta.saida2 || null,
      quinta_entrada_1: customHorarios.quinta.entrada1 || null,
      quinta_saida_1: customHorarios.quinta.saida1 || null,
      quinta_entrada_2: customHorarios.quinta.entrada2 || null,
      quinta_saida_2: customHorarios.quinta.saida2 || null,
      sexta_entrada_1: customHorarios.sexta.entrada1 || null,
      sexta_saida_1: customHorarios.sexta.saida1 || null,
      sexta_entrada_2: customHorarios.sexta.entrada2 || null,
      sexta_saida_2: customHorarios.sexta.saida2 || null,
      sabado_entrada_1: customHorarios.sabado.entrada1 || null,
      sabado_saida_1: customHorarios.sabado.saida1 || null,
      sabado_entrada_2: customHorarios.sabado.entrada2 || null,
      sabado_saida_2: customHorarios.sabado.saida2 || null,
      domingo_entrada_1: customHorarios.domingo.entrada1 || null,
      domingo_saida_1: customHorarios.domingo.saida1 || null,
      domingo_entrada_2: customHorarios.domingo.entrada2 || null,
      domingo_saida_2: customHorarios.domingo.saida2 || null,
    };
  };

  const saveCustomJourney = async (collaboratorId: string) => {
    const existing = jornadas.find((j) => j.personalizada_para_colaborador_id === collaboratorId) ?? null;
    const payload = customJourneyPayload(collaboratorId);

    if (existing) {
      const { data, error } = await db
        .from("rh_jornadas")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    }

    const { data, error } = await db
      .from("rh_jornadas")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };

  const deactivateCustomJourney = async (collaboratorId: string) => {
    const custom = jornadas.find((j) => j.personalizada_para_colaborador_id === collaboratorId);
    if (!custom) return;
    const { error } = await db.from("rh_jornadas").update({ ativo: false }).eq("id", custom.id);
    if (error) throw error;
  };

  const handleJornadaSelection = (value: string) => {
    if (value === "none") {
      setJornadaMode("none");
      setJornadaId("");
      return;
    }

    if (value === "custom") {
      if (jornadaMode === "preset" && jornadaId) {
        const preset = jornadas.find((j) => j.id === jornadaId);
        if (preset) setCustomHorarios(horariosFromJornada(preset));
      }
      setJornadaMode("custom");
      setJornadaId("");
      return;
    }

    setJornadaMode("preset");
    setJornadaId(value);
  };

  const updateCustomTime = (day: DiaKey, field: keyof PeriodosDia, value: string) => {
    setCustomHorarios((current) => ({
      ...current,
      [day]: { ...current[day], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (jornadaMode === "custom" && customScheduleSummary.error) {
      toast.error(customScheduleSummary.error);
      return;
    }

    const nextPista = canManageRh ? pistaAtivo : editingFuncionario?.pista_ativo_legado ?? false;
    const needsNewLogin = criarLogin && !usuarioExistenteId && (!editingFuncionario || !editingFuncionario.user_id);
    if (needsNewLogin && !rhAtivo) {
      toast.error("Acesso para registro de ponto só pode ser criado para colaborador vinculado ao RH");
      return;
    }
    if (needsNewLogin) {
      if (!email.trim()) {
        toast.error("Email é obrigatório para criar acesso de login");
        return;
      }
      if (!senha.trim() || senha.length < 8) {
        toast.error("Senha deve ter pelo menos 8 caracteres");
        return;
      }
    }

    setSaving(true);
    try {
      let collaboratorId = editingFuncionario?.id ?? null;

      if (!editingFuncionario) {
        const payload = employeePayload(jornadaMode === "preset" ? jornadaId || null : null);
        const response = await supabase.functions.invoke("create-rh-employee-user", {
          body: {
            ...payload,
            email: email.trim() || null,
            password: needsNewLogin ? senha : null,
            ativo: rhAtivo || nextPista,
            create_login: needsNewLogin,
          },
        });
        if (response.error) throw new Error(response.error.message || "Erro ao criar funcionário");
        if (response.data?.error) throw new Error(response.data.error);
        collaboratorId = response.data?.colaborador?.id ?? response.data?.colaborador_id ?? null;
        if (!collaboratorId) throw new Error("Colaborador criado sem identificador retornado");
      }

      if (!collaboratorId) throw new Error("Colaborador sem identificador válido");

      if (editingFuncionario && needsNewLogin) {
        const payload = employeePayload(jornadaMode === "preset" ? jornadaId || null : null);
        const response = await supabase.functions.invoke("create-rh-employee-user", {
          body: {
            ...payload,
            email: email.trim() || null,
            password: senha,
            ativo: rhAtivo || nextPista,
            create_login: true,
            existing_colaborador_id: collaboratorId,
          },
        });
        if (response.error) throw new Error(response.error.message || "Erro ao criar acesso do funcionário");
        if (response.data?.error) throw new Error(response.data.error);
      }

      let resolvedJornadaId: string | null = null;
      if (jornadaMode === "custom") {
        resolvedJornadaId = await saveCustomJourney(collaboratorId);
      } else if (jornadaMode === "preset") {
        resolvedJornadaId = jornadaId || null;
      }

      if (jornadaMode !== "custom") {
        await deactivateCustomJourney(collaboratorId);
      }

      await saveMemberships(collaboratorId, rhAtivo, nextPista);
      await updateEmployeeFields(collaboratorId, resolvedJornadaId);

      const linkedUser = usuarioExistenteId || editingFuncionario?.user_id;
      if (linkedUser) {
        const { error } = await db.rpc("rh_vincular_usuario_existente", {
          p_colaborador_id: collaboratorId,
          p_user_id: linkedUser,
        });
        if (error) throw error;
      }

      toast.success(
        editingFuncionario
          ? "Funcionário atualizado; jornada, vínculos, remuneração e custeio sincronizados."
          : "Funcionário cadastrado e vínculos sincronizados.",
      );
      closeDialog();
      await fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Erro ao salvar funcionário");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cadastro? Históricos vinculados podem impedir a exclusão; prefira inativar os vínculos.")) return;
    setDeleting(id);
    try {
      const { error } = await db.rpc("rh_delete_colaborador", { p_colaborador_id: id });
      if (error) throw error;
      toast.success("Funcionário excluído.");
      await fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Não foi possível excluir. Inative os vínculos para preservar o histórico.");
    } finally {
      setDeleting(null);
    }
  };

  const filteredFuncionarios = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return funcionarios;
    return funcionarios.filter((f) =>
      f.nome.toLowerCase().includes(term) ||
      f.email?.toLowerCase().includes(term) ||
      f.cpf_cnpj?.includes(searchTerm.trim()),
    );
  }, [funcionarios, searchTerm]);

  const switchContract = (value: ContractType) => {
    if (value === "clt" && tipoContrato !== "clt") {
      setSalario(valorContrato);
      setValorContrato("");
    } else if (value !== "clt" && tipoContrato === "clt") {
      setValorContrato(salario);
      setSalario("");
    }
    setTipoContrato(value);
  };

  if (permissionsLoading) return null;

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-5 w-5" /> Cadastro de Funcionários
              </CardTitle>
              <CardDescription>
                Um cadastro por pessoa. RH e Pista são vínculos independentes; contrato, remuneração e jornada são dados únicos usados também pelo Financeiro.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar funcionário..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-background" />
              </div>
              <Button onClick={openAddDialog}>
                <UserPlus className="mr-2 h-4 w-4" /> Novo Funcionário
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Remuneração</TableHead>
                    <TableHead>Vínculos</TableHead>
                    <TableHead>Status RH</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFuncionarios.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">Nenhum funcionário encontrado</TableCell></TableRow>
                  ) : filteredFuncionarios.map((func) => {
                    const remuneration = remunerationValue(func);
                    return (
                      <TableRow key={func.id}>
                        <TableCell className="font-medium">
                          <div>{func.nome}</div>
                          {func.email && <div className="text-xs text-muted-foreground">{func.email}</div>}
                        </TableCell>
                        <TableCell>{func.cpf_cnpj || "-"}</TableCell>
                        <TableCell>{func.cargo || "-"}</TableCell>
                        <TableCell>{func.departamento || "-"}</TableCell>
                        <TableCell>{func.tipo_contrato ? <Badge variant="outline">{contractLabel(func.tipo_contrato)}</Badge> : <span className="text-amber-500">Não informado</span>}</TableCell>
                        <TableCell>
                          {remuneration
                            ? <span className="font-medium">{currency(remuneration)} <span className="text-xs text-muted-foreground">{remunerationSuffix(func.tipo_contrato)}</span></span>
                            : <span className="text-amber-500">Não informado</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {func.rh_ativo && <Badge>RH</Badge>}
                            {func.pista_ativo_legado && <Badge variant="secondary">Pista</Badge>}
                            {!func.rh_ativo && !func.pista_ativo_legado && <Badge variant="outline">Sem vínculo</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {func.rh_ativo
                            ? <Badge className="border-green-500/30 bg-green-500/20 text-green-400">Ativo no RH</Badge>
                            : <Badge variant="outline" className="border-slate-500/40 text-muted-foreground">Fora do RH</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(func)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(func.id)} disabled={deleting === func.id} className="text-destructive hover:text-destructive">
                              {deleting === func.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFuncionario ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
            <DialogDescription>
              Cadastre a pessoa uma única vez e defina em quais áreas ela participa. Os vínculos podem ser ativados ou inativados sem apagar históricos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Dados Pessoais</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Nome Completo *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
                <div className="space-y-2"><Label>Data de Nascimento</Label><Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} /></div>
                <div className="space-y-2"><Label>PIS</Label><Input value={pis} onChange={(e) => setPis(e.target.value)} /></div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Endereço</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2"><Label>Endereço</Label><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
                <div className="space-y-2"><Label>Cidade</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
                <div className="space-y-2"><Label>Estado</Label><Input value={estado} onChange={(e) => setEstado(e.target.value)} maxLength={2} /></div>
                <div className="space-y-2"><Label>CEP</Label><Input value={cep} onChange={(e) => setCep(e.target.value)} /></div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold">Vínculos no sistema</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Switch checked={rhAtivo} disabled={!canManageRh} onCheckedChange={(checked) => { setRhAtivo(checked); if (!checked) { setControlaPonto(false); setCriarLogin(false); } }} id="rh-ativo" />
                  <div><Label htmlFor="rh-ativo">RH</Label><p className="text-xs text-muted-foreground">Define se a pessoa está ativa no RH. Desativar não apaga contrato, remuneração nem histórico.</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Switch checked={pistaAtivo} disabled={!canManageRh} onCheckedChange={setPistaAtivo} id="pista-ativo" />
                  <div><Label htmlFor="pista-ativo">Pista / Produção</Label><p className="text-xs text-muted-foreground">Define se a pessoa pode ser utilizada em novas OPs e apontamentos de produção.</p></div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-semibold"><Briefcase className="h-4 w-4" /> Dados de trabalho</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Cargo</Label><Input value={cargo} onChange={(e) => setCargo(e.target.value)} /></div>
                <div className="space-y-2"><Label>Departamento</Label><Input value={departamento} onChange={(e) => setDepartamento(e.target.value)} /></div>
                <div className="space-y-2"><Label>Data de Admissão</Label><Input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Jornada de trabalho</Label>
                  <Select
                    value={jornadaMode === "custom" ? "custom" : jornadaMode === "preset" ? jornadaId : "none"}
                    onValueChange={handleJornadaSelection}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione a jornada" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem jornada definida</SelectItem>
                      {presetJornadas.map((j) => (
                        <SelectItem key={j.id} value={j.id}>{j.nome} ({j.carga_horaria_semanal}h/semana)</SelectItem>
                      ))}
                      <SelectItem value="custom">Personalizada para este funcionário</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Use um preset existente ou personalize os períodos deste funcionário sem alterar a jornada dos demais.
                  </p>
                </div>
              </div>

              {jornadaMode === "custom" && (
                <div className="space-y-4 rounded-lg border border-primary/20 bg-muted/20 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-medium"><Clock3 className="h-4 w-4" /> Jornada personalizada</div>
                      <p className="text-xs text-muted-foreground">Preencha somente os dias e períodos contratados para este funcionário.</p>
                    </div>
                    <Badge variant={customScheduleSummary.error ? "outline" : "secondary"}>
                      {customScheduleSummary.error ? "Jornada incompleta" : `${hoursLabel(customScheduleSummary.totalMinutes)} / semana`}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {DIAS.map(({ key, label }) => {
                      const day = customHorarios[key];
                      return (
                        <div key={key} className="grid gap-2 rounded-md border bg-background/60 p-3 md:grid-cols-[140px_repeat(4,minmax(0,1fr))] md:items-end">
                          <div className="pb-2 text-sm font-medium md:pb-0">{label}</div>
                          <div className="space-y-1"><Label className="text-xs">Entrada 1</Label><Input type="time" value={day.entrada1} onChange={(e) => updateCustomTime(key, "entrada1", e.target.value)} /></div>
                          <div className="space-y-1"><Label className="text-xs">Saída 1</Label><Input type="time" value={day.saida1} onChange={(e) => updateCustomTime(key, "saida1", e.target.value)} /></div>
                          <div className="space-y-1"><Label className="text-xs">Entrada 2</Label><Input type="time" value={day.entrada2} onChange={(e) => updateCustomTime(key, "entrada2", e.target.value)} /></div>
                          <div className="space-y-1"><Label className="text-xs">Saída 2</Label><Input type="time" value={day.saida2} onChange={(e) => updateCustomTime(key, "saida2", e.target.value)} /></div>
                        </div>
                      );
                    })}
                  </div>

                  {customScheduleSummary.error && <p className="text-xs text-destructive">{customScheduleSummary.error}</p>}
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-lg border border-primary/20 p-4">
              <h3 className="font-semibold">Contrato e remuneração</h3>
              <p className="text-xs text-muted-foreground">Estes dados são únicos. O RH e o Financeiro leem o mesmo tipo, valor e jornada, mesmo quando o vínculo RH estiver inativo.</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de Contrato</Label>
                  <Select value={tipoContrato} onValueChange={(value) => switchContract(value as ContractType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clt">CLT</SelectItem>
                      <SelectItem value="pj">PJ (Pessoa Jurídica)</SelectItem>
                      <SelectItem value="diarista">Diarista</SelectItem>
                      <SelectItem value="horista">Horista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{tipoContrato === "clt" ? "Salário mensal (R$)" : tipoContrato === "horista" ? "Valor da hora (R$)" : "Valor da diária (R$)"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tipoContrato === "clt" ? salario : valorContrato}
                    onChange={(e) => tipoContrato === "clt" ? setSalario(e.target.value) : setValorContrato(e.target.value)}
                    placeholder="0,00"
                  />
                  <p className="text-xs text-muted-foreground">
                    {tipoContrato === "clt" ? "Salário mensal usado também no custeio quando a pessoa estiver na Pista." : tipoContrato === "horista" ? "Valor por hora usado pelo RH e Financeiro." : "Valor da diária usado pelo RH e Financeiro."}
                  </p>
                </div>
                <div className="flex items-start gap-3 pt-2">
                  <Switch checked={controlaPonto} disabled={!rhAtivo} onCheckedChange={setControlaPonto} id="controla-ponto" />
                  <div><Label htmlFor="controla-ponto">Participa do controle de ponto</Label><p className="text-xs text-muted-foreground">Disponível quando o vínculo RH está ativo; exibe no espelho, aprovações e fechamento de ponto.</p></div>
                </div>
              </div>
            </div>

            {rhAtivo && (
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 font-semibold"><UserPlus className="h-4 w-4" /> Acesso ao Sistema (Registro de Ponto)</h3>
                <div className="rounded-lg border bg-muted/30 p-4">
                  {editingFuncionario?.user_id ? (
                    <p className="text-sm">Login já vinculado: {usuariosExistentes.find((u) => u.user_id === editingFuncionario.user_id)?.email || editingFuncionario.email || "Usuário do Fluxo"}. O acesso ao próprio ponto acompanha a opção “Participa do controle de ponto”.</p>
                  ) : (
                    <div className="mb-4 space-y-2">
                      <Label>Usar usuário existente do Fluxo de Estoque</Label>
                      <Select value={usuarioExistenteId || "none"} onValueChange={(id) => {
                        setUsuarioExistenteId(id === "none" ? "" : id);
                        if (id !== "none") {
                          const selected = usuariosExistentes.find((u) => u.user_id === id);
                          setCriarLogin(false);
                          setSenha("");
                          if (selected) { setEmail(selected.email || ""); if (!nome.trim()) setNome(selected.nome); }
                        }
                      }}>
                        <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem usuário selecionado</SelectItem>
                          {usuariosExistentes.filter((u) => !u.colaborador_id || u.colaborador_id === editingFuncionario?.id).map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>{u.nome} — {u.email || "Sem e-mail"}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Usa o mesmo login e senha. Usuários já vinculados a outro funcionário devem ser editados naquele cadastro.</p>
                    </div>
                  )}
                  {!editingFuncionario?.user_id && !usuarioExistenteId && <div className="flex items-center gap-3">
                    <Switch checked={criarLogin} onCheckedChange={setCriarLogin} id="criar-login" />
                    <Label htmlFor="criar-login">{editingFuncionario ? "Criar acesso deste colaborador no novo sistema" : "Criar acesso para o funcionário registrar ponto"}</Label>
                  </div>}
                  {criarLogin && !usuarioExistenteId && !editingFuncionario?.user_id && (
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2"><Label>Email para Login *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                      <div className="space-y-2"><Label>Senha *</Label><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" /></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void handleSave()} disabled={saving || !canManageRh}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingFuncionario ? "Salvar Alterações" : "Cadastrar Funcionário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
