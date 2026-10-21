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
type FaixaCusto = {
  id?: string;
  nome: string;
  dias_semana: number[];
  hora_inicio: string;
  hora_fim: string;
  valor_hora: string;
  prioridade: number;
  ativo: boolean;
};

type UsuarioExistente = { user_id: string; nome: string; email: string | null; colaborador_id: string | null };
type ContextoFiltro = "todos" | "administrativo" | "pista" | "ponto" | "inativos";
type MembroProducao = {
  id: string;
  nome: string;
  nome_snapshot: string | null;
  apelido: string | null;
  funcao: string | null;
  ativo: boolean;
  rh_colaborador_id: string | null;
};

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

const DIAS_FAIXA = [
  { valor: 1, label: "Seg" }, { valor: 2, label: "Ter" }, { valor: 3, label: "Qua" },
  { valor: 4, label: "Qui" }, { valor: 5, label: "Sex" }, { valor: 6, label: "Sáb" },
  { valor: 7, label: "Dom" },
];

const novaFaixaCusto = (prioridade = 0): FaixaCusto => ({
  nome: "", dias_semana: [1, 2, 3, 4, 5], hora_inicio: "08:00", hora_fim: "18:00",
  valor_hora: "", prioridade, ativo: true,
});

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
  const [membrosProducao, setMembrosProducao] = useState<MembroProducao[]>([]);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [contextoFiltro, setContextoFiltro] = useState<ContextoFiltro>("todos");
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
  const [cadastroAtivo, setCadastroAtivo] = useState(true);
  const [rhAtivo, setRhAtivo] = useState(true);
  const [pistaAtivo, setPistaAtivo] = useState(false);
  const [controlaPonto, setControlaPonto] = useState(false);
  const [tipoContrato, setTipoContrato] = useState<ContractType>("clt");
  const [valorContrato, setValorContrato] = useState("");
  const [faixasCusto, setFaixasCusto] = useState<FaixaCusto[]>([]);
  const [usuariosExistentes, setUsuariosExistentes] = useState<UsuarioExistente[]>([]);
  const [usuarioExistenteId, setUsuarioExistenteId] = useState("");
  const [criarLogin, setCriarLogin] = useState(false);
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
      const [funcResponse, jornadaResponse, usuariosResponse, producaoResponse] = await Promise.all([
        db.from("rh_colaboradores").select("*").order("nome"),
        db.from("rh_jornadas").select("*").order("nome"),
        canManageRh ? db.rpc("rh_listar_usuarios_vinculaveis") : Promise.resolve({ data: [], error: null }),
        db.from("producao_membros").select("id,nome,nome_snapshot,apelido,funcao,ativo,rh_colaborador_id").order("nome"),
      ]);
      if (funcResponse.error) throw funcResponse.error;
      if (jornadaResponse.error) throw jornadaResponse.error;
      if (usuariosResponse.error) throw usuariosResponse.error;
      if (producaoResponse.error) throw producaoResponse.error;
      setUsuariosExistentes(usuariosResponse.data ?? []);
      setFuncionarios((funcResponse.data ?? []) as Colaborador[]);
      setJornadas((jornadaResponse.data ?? []) as Jornada[]);
      setMembrosProducao((producaoResponse.data ?? []) as MembroProducao[]);
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
    setCadastroAtivo(true);
    setRhAtivo(true);
    setPistaAtivo(false);
    setControlaPonto(false);
    setTipoContrato("clt");
    setValorContrato("");
    setFaixasCusto([]);
    setCriarLogin(false);
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

    setCadastroAtivo(func.ativo);
    setRhAtivo(func.rh_ativo);
    setPistaAtivo(func.pista_ativo_legado);
    setControlaPonto(func.controla_ponto);
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
    void db.from("rh_colaborador_faixas_custo")
      .select("id,nome,dias_semana,hora_inicio,hora_fim,valor_hora,prioridade,ativo")
      .eq("colaborador_id", func.id)
      .order("prioridade")
      .then(({ data, error }: { data: any[] | null; error: any }) => {
        if (error) {
          toast.error("Não foi possível carregar as faixas de custo");
          return;
        }
        setFaixasCusto((data ?? []).map((faixa) => ({
          ...faixa,
          hora_inicio: String(faixa.hora_inicio).slice(0, 5),
          hora_fim: String(faixa.hora_fim).slice(0, 5),
          valor_hora: String(faixa.valor_hora),
        })));
      });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingFuncionario(null);
  };

  const saveMemberships = async (id: string, nextActive: boolean, nextRh: boolean, nextPista: boolean, nextPonto: boolean) => {
    const { error } = await db.rpc("rh_set_colaborador_contextos_v3", {
      p_colaborador_id: id,
      p_ativo: nextActive,
      p_administrativo_ativo: nextRh,
      p_pista_ativo: nextPista,
      p_controla_ponto: nextPonto,
      p_origem: "cadastro_rh",
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
    controla_ponto: controlaPonto,
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

  const saveCostRanges = async (collaboratorId: string) => {
    for (const faixa of faixasCusto) {
      if (!faixa.nome.trim() || !faixa.hora_inicio || !faixa.hora_fim || faixa.hora_inicio === faixa.hora_fim) {
        throw new Error("Preencha o nome e horários diferentes em todas as faixas de custo");
      }
      if (faixa.dias_semana.length === 0 || faixa.valor_hora === "" || Number(faixa.valor_hora) < 0) {
        throw new Error("Cada faixa precisa ter dias e um valor/hora válido");
      }
    }
    const { error } = await db.rpc("rh_substituir_faixas_custo", {
      p_colaborador_id: collaboratorId,
      p_faixas: faixasCusto.map((faixa, index) => ({
        nome: faixa.nome.trim(),
        dias_semana: faixa.dias_semana,
        hora_inicio: faixa.hora_inicio,
        hora_fim: faixa.hora_fim,
        valor_hora: Number(faixa.valor_hora),
        prioridade: faixa.prioridade || index,
        ativo: faixa.ativo,
      })),
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

    if (cadastroAtivo && !rhAtivo && !pistaAtivo && !controlaPonto) {
      toast.error("Para reativar o cadastro, selecione ao menos um vínculo: Administrativo, Pista ou Controle de ponto");
      return;
    }

    const nextRh = cadastroAtivo ? rhAtivo : false;
    const nextPista = cadastroAtivo && canManageRh ? pistaAtivo : cadastroAtivo ? editingFuncionario?.pista_ativo_legado ?? false : false;
    const nextPonto = cadastroAtivo ? controlaPonto : false;
    const needsNewLogin = cadastroAtivo && criarLogin && !usuarioExistenteId && (!editingFuncionario || !editingFuncionario.user_id);
    if (needsNewLogin && !controlaPonto) {
      toast.error("Marque Controle de ponto antes de criar um acesso para registro de ponto");
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
            ativo: cadastroAtivo,
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
            ativo: cadastroAtivo,
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

      await saveMemberships(collaboratorId, cadastroAtivo, nextRh, nextPista, nextPonto);
      await updateEmployeeFields(collaboratorId, resolvedJornadaId);
      await saveCostRanges(collaboratorId);

      const linkedUser = usuarioExistenteId || editingFuncionario?.user_id;
      if (cadastroAtivo && linkedUser) {
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
    return funcionarios.filter((f) => {
      const pertenceAoContexto = (contextoFiltro === "todos" && f.ativo)
        || (contextoFiltro === "administrativo" && f.ativo && f.rh_ativo)
        || (contextoFiltro === "pista" && f.ativo && f.pista_ativo_legado)
        || (contextoFiltro === "ponto" && f.ativo && f.controla_ponto)
        || (contextoFiltro === "inativos" && !f.ativo);
      if (!pertenceAoContexto) return false;
      if (!term) return true;
      return f.nome.toLowerCase().includes(term)
        || Boolean(f.email?.toLowerCase().includes(term))
        || Boolean(f.cpf_cnpj?.includes(searchTerm.trim()));
    });
  }, [contextoFiltro, funcionarios, searchTerm]);

  const membrosPistaSemVinculo = useMemo(
    () => membrosProducao.filter((membro) => membro.ativo && !membro.rh_colaborador_id),
    [membrosProducao],
  );

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
                Um cadastro por pessoa, classificado de forma independente entre Administrativo, Pista e Controle de ponto.
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
          <div className="mb-4 flex flex-wrap gap-2">
            {([
              ["todos", "Todos", funcionarios.filter((f) => f.ativo).length],
              ["administrativo", "RH Administrativo", funcionarios.filter((f) => f.ativo && f.rh_ativo).length],
              ["pista", "RH Pista", funcionarios.filter((f) => f.ativo && f.pista_ativo_legado).length],
              ["ponto", "Controle de ponto", funcionarios.filter((f) => f.ativo && f.controla_ponto).length],
              ["inativos", "Inativos", funcionarios.filter((f) => !f.ativo).length],
            ] as Array<[ContextoFiltro, string, number]>).map(([valor, label, quantidade]) => (
              <Button
                key={valor}
                type="button"
                size="sm"
                variant={contextoFiltro === valor ? "default" : "outline"}
                onClick={() => setContextoFiltro(valor)}
              >
                {label} ({quantidade})
              </Button>
            ))}
          </div>
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
                            {func.controla_ponto && <Badge variant="outline">Controle de ponto</Badge>}
                            {!func.rh_ativo && !func.pista_ativo_legado && !func.controla_ponto && <Badge variant="outline">Sem vínculo</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {func.ativo
                            ? <Badge className="border-green-500/30 bg-green-500/20 text-green-400">Ativo</Badge>
                            : <Badge variant="outline" className="border-slate-500/40 text-muted-foreground">Inativo</Badge>}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conciliação RH Pista × Produção</CardTitle>
          <CardDescription>
            O vínculo é feito sem duplicar a pessoa. Correspondências exatas foram associadas automaticamente; os casos abaixo precisam de revisão do RH.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Pessoas ativas na Produção</div><div className="text-2xl font-bold">{membrosProducao.filter((m) => m.ativo).length}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Vinculadas ao RH Pista</div><div className="text-2xl font-bold text-emerald-500">{membrosProducao.filter((m) => m.ativo && m.rh_colaborador_id).length}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Pendentes de vínculo</div><div className="text-2xl font-bold text-amber-500">{membrosPistaSemVinculo.length}</div></div>
          </div>
          {membrosPistaSemVinculo.length === 0 ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">Todas as pessoas ativas da Produção estão vinculadas ao RH Pista.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {membrosPistaSemVinculo.map((membro) => (
                <Badge key={membro.id} variant="outline" className="border-amber-500/40 px-3 py-1 text-amber-600 dark:text-amber-400">
                  {membro.nome_snapshot || membro.nome}{membro.apelido ? ` (${membro.apelido})` : ""} · {membro.funcao || "função não informada"}
                </Badge>
              ))}
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
              <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label htmlFor="cadastro-ativo" className="font-semibold">Cadastro ativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Ao inativar, a pessoa sai das listas operacionais, mas todo o histórico é preservado.
                  </p>
                </div>
                <Switch
                  id="cadastro-ativo"
                  checked={cadastroAtivo}
                  disabled={!canManageRh}
                  onCheckedChange={(checked) => {
                    setCadastroAtivo(checked);
                    if (!checked) {
                      setRhAtivo(false);
                      setPistaAtivo(false);
                      setControlaPonto(false);
                      setCriarLogin(false);
                    }
                  }}
                />
              </div>
              <h3 className="font-semibold">Vínculos no sistema</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-start gap-3">
                  <Switch checked={rhAtivo} disabled={!canManageRh || !cadastroAtivo} onCheckedChange={setRhAtivo} id="rh-ativo" />
                  <div><Label htmlFor="rh-ativo">RH Administrativo</Label><p className="text-xs text-muted-foreground">Classifica a pessoa na estrutura administrativa do RH.</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Switch checked={pistaAtivo} disabled={!canManageRh || !cadastroAtivo} onCheckedChange={setPistaAtivo} id="pista-ativo" />
                  <div><Label htmlFor="pista-ativo">RH Pista</Label><p className="text-xs text-muted-foreground">Disponibiliza a pessoa para OPs e apontamentos da Produção.</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Switch checked={controlaPonto} disabled={!canManageRh || !cadastroAtivo} onCheckedChange={setControlaPonto} id="controla-ponto-contexto" />
                  <div><Label htmlFor="controla-ponto-contexto">Controle de ponto</Label><p className="text-xs text-muted-foreground">Inclui a pessoa no ponto eletrônico deste sistema.</p></div>
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
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-primary/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">Faixas de custo da mão de obra</h3>
                  <p className="text-xs text-muted-foreground">
                    Opcional. O sistema divide automaticamente o custo quando o trabalho atravessa uma mudança de faixa.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFaixasCusto((atuais) => [...atuais, novaFaixaCusto(atuais.length)])}
                  disabled={!canManageRh}
                >
                  Adicionar faixa
                </Button>
              </div>

              {faixasCusto.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhuma faixa específica. O custeio continua usando o valor/hora padrão disponível na Produção.
                </div>
              ) : (
                <div className="space-y-3">
                  {faixasCusto.map((faixa, index) => (
                    <div key={faixa.id ?? index} className="space-y-3 rounded-md border bg-muted/20 p-3">
                      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">Nome da faixa</Label>
                          <Input
                            value={faixa.nome}
                            placeholder={index === 0 ? "Normal" : "Após 18h"}
                            onChange={(event) => setFaixasCusto((atuais) => atuais.map((item, posicao) => posicao === index ? { ...item, nome: event.target.value } : item))}
                          />
                        </div>
                        <div className="space-y-1"><Label className="text-xs">Início</Label><Input type="time" value={faixa.hora_inicio} onChange={(event) => setFaixasCusto((atuais) => atuais.map((item, posicao) => posicao === index ? { ...item, hora_inicio: event.target.value } : item))} /></div>
                        <div className="space-y-1"><Label className="text-xs">Fim</Label><Input type="time" value={faixa.hora_fim} onChange={(event) => setFaixasCusto((atuais) => atuais.map((item, posicao) => posicao === index ? { ...item, hora_fim: event.target.value } : item))} /></div>
                        <div className="space-y-1"><Label className="text-xs">Valor por hora (R$)</Label><Input type="number" min="0" step="0.01" value={faixa.valor_hora} onChange={(event) => setFaixasCusto((atuais) => atuais.map((item, posicao) => posicao === index ? { ...item, valor_hora: event.target.value } : item))} /></div>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setFaixasCusto((atuais) => atuais.filter((_, posicao) => posicao !== index))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {DIAS_FAIXA.map((dia) => {
                          const selecionado = faixa.dias_semana.includes(dia.valor);
                          return (
                            <Button
                              key={dia.valor}
                              type="button"
                              size="sm"
                              variant={selecionado ? "secondary" : "outline"}
                              className="h-7 px-2 text-xs"
                              onClick={() => setFaixasCusto((atuais) => atuais.map((item, posicao) => posicao === index ? {
                                ...item,
                                dias_semana: selecionado ? item.dias_semana.filter((valor) => valor !== dia.valor) : [...item.dias_semana, dia.valor].sort(),
                              } : item))}
                            >
                              {dia.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Uma faixa pode atravessar a meia-noite: use, por exemplo, 18:00–08:00. Se duas faixas coincidirem, prevalece a última da lista.
              </p>
            </div>

            {controlaPonto && (
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
