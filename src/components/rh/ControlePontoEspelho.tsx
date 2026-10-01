import { useEffect, useMemo, useState } from "react";
import { format, getDay, getDaysInMonth, eachDayOfInterval, endOfMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileSpreadsheet,
  FileText,
  Loader2,
  Moon,
  Printer,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditableTimeCell } from "@/components/ponto/EditableTimeCell";
import { MonthYearPicker } from "@/components/ponto/MonthYearPicker";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import {
  DEFAULT_DAILY_MINUTES,
  calculateFinancialValues,
  isPJContract,
  normalizeContractType,
  resolvePJDailyBaseMinutes,
  summarizePointDay,
  timeToMinutes,
  type PointDaySummary,
} from "@/lib/pontoCalculos";
import { toast } from "sonner";

const db = supabase as any;

interface Colaborador {
  id: string;
  nome: string;
  email: string | null;
  user_id: string | null;
  cargo: string | null;
  departamento: string | null;
  cpf_cnpj: string | null;
  pis: string | null;
  data_admissao: string | null;
  jornada_id: string | null;
  ativo: boolean;
  controla_ponto: boolean;
  tipo_contrato: string | null;
  valor_contrato: number | null;
  salario: number | null;
  hora_extra_gera_valor: boolean;
}

interface Jornada {
  id: string;
  nome: string;
  carga_horaria_semanal: number;
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
}

interface TimeEntry {
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
}

interface PaidDay {
  id: string;
  colaborador_id: string;
  data: string;
  valor_diaria: number;
  valor_adicionais: number;
  valor_total: number;
  pago_em: string;
}

interface DayRow {
  date: Date;
  dateStr: string;
  dayOfWeek: number;
  entry: TimeEntry | undefined;
  feriadoNome: string | undefined;
  isSunday: boolean;
  isHoliday: boolean;
  isFuture: boolean;
  beforeAdmission: boolean;
  expectedMinutes: number | null;
  summary: PointDaySummary;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_FULL = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;

function formatMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return "00:00";
  const rounded = Math.round(minutes);
  return `${Math.floor(rounded / 60).toString().padStart(2, "0")}:${(rounded % 60).toString().padStart(2, "0")}`;
}

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getExpectedMinutes(jornada: Jornada | null, dayOfWeek: number): number | null {
  if (!jornada) return null;

  const dayKey = DIAS_SEMANA_FULL[dayOfWeek];
  const pairs = [
    [
      jornada[`${dayKey}_entrada_1` as keyof Jornada] as string | null,
      jornada[`${dayKey}_saida_1` as keyof Jornada] as string | null,
    ],
    [
      jornada[`${dayKey}_entrada_2` as keyof Jornada] as string | null,
      jornada[`${dayKey}_saida_2` as keyof Jornada] as string | null,
    ],
  ];

  return pairs.reduce((total, [entry, exit]) => {
    if (!entry || !exit) return total;
    const start = timeToMinutes(entry);
    let end = timeToMinutes(exit);
    if (end < start) end += 24 * 60;
    return total + Math.max(0, end - start);
  }, 0);
}

function contractLabel(type: string | null | undefined): string {
  switch (normalizeContractType(type)) {
    case "diarista": return "Diarista";
    case "horista": return "Horista";
    case "pj": return "PJ";
    default: return "CLT";
  }
}

function observationForRow(row: DayRow): string {
  if (row.summary.incomplete) return "Registro incompleto";
  if (row.feriadoNome) return row.feriadoNome;
  if (row.isSunday) return "DSR";
  if (row.isFuture) return "Data futura";
  if (row.beforeAdmission) return "Antes da admissão";
  return row.entry?.observacao || "";
}

export default function ControlePontoEspelhoCorrigido() {
  const { isAdmin, hasPermission, loading: permissionsLoading } = usePermissions();
  const isGestor = isAdmin() || hasPermission("ponto.gerenciar");
  const isPontoViewer =
    isAdmin() ||
    hasPermission("ponto.visualizar") ||
    hasPermission("ponto.gerenciar") ||
    hasPermission("ponto.aprovar");
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedColaborador, setSelectedColaborador] = useState("");
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [paidDays, setPaidDays] = useState<PaidDay[]>([]);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [colaboradorData, setColaboradorData] = useState<Colaborador | null>(null);
  const [jornadaData, setJornadaData] = useState<Jornada | null>(null);

  useEffect(() => {
    void fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedColaborador && colaboradores.length > 0) {
      void fetchEntriesForMonth();
    }
  }, [selectedColaborador, selectedMonth, colaboradores, jornadas]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [collaboratorResponse, journeyResponse, holidayResponse] = await Promise.all([
        db.from("rh_colaboradores").select("*").eq("ativo", true).eq("controla_ponto", true).order("nome"),
        db.from("rh_jornadas").select("*"),
        db.from("rh_feriados").select("*").eq("ativo", true),
      ]);

      if (collaboratorResponse.error) throw collaboratorResponse.error;
      if (journeyResponse.error) throw journeyResponse.error;
      if (holidayResponse.error) throw holidayResponse.error;

      const participantList = (collaboratorResponse.data || []) as Colaborador[];
      setColaboradores(participantList);
      setJornadas((journeyResponse.data || []) as Jornada[]);
      setFeriados((holidayResponse.data || []) as Feriado[]);
      if (participantList.length > 0) setSelectedColaborador((current) => current || participantList[0].id);
    } catch (error) {
      console.error("Erro ao carregar o espelho de ponto:", error);
      toast.error("Erro ao carregar os dados do espelho de ponto");
    } finally {
      setLoading(false);
    }
  };

  const fetchEntriesForMonth = async () => {
    setEntriesLoading(true);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const lastDay = getDaysInMonth(new Date(year, month - 1));
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
      const [entriesResponse, paidResponse] = await Promise.all([
        db.from("rh_registros_ponto").select("*")
          .eq("colaborador_id", selectedColaborador).gte("data", startDate).lte("data", endDate).order("data"),
        db.from("rh_ponto_dias_pagos").select("*")
          .eq("colaborador_id", selectedColaborador).gte("data", startDate).lte("data", endDate).order("data"),
      ]);

      if (entriesResponse.error) throw entriesResponse.error;
      if (paidResponse.error) throw paidResponse.error;
      const collaborator = colaboradores.find((item) => item.id === selectedColaborador) || null;
      setEntries((entriesResponse.data || []) as TimeEntry[]);
      setPaidDays((paidResponse.data || []) as PaidDay[]);
      setColaboradorData(collaborator);
      setJornadaData(
        collaborator?.jornada_id
          ? jornadas.find((item) => item.id === collaborator.jornada_id) || null
          : null,
      );
    } catch (error) {
      console.error("Erro ao carregar registros do mês:", error);
      toast.error("Erro ao carregar os registros do mês");
    } finally {
      setEntriesLoading(false);
    }
  };

  const selectedMonthDate = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }, [selectedMonth]);

  const daysOfMonth = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(selectedMonthDate), end: endOfMonth(selectedMonthDate) }),
    [selectedMonthDate],
  );

  const entriesByDate = useMemo(() => {
    const map: Record<string, TimeEntry> = {};
    entries.forEach((entry) => { map[entry.data] = entry; });
    return map;
  }, [entries]);

  const holidaysByDate = useMemo(() => {
    const map: Record<string, string> = {};
    feriados.forEach((holiday) => { map[holiday.data] = holiday.nome; });
    return map;
  }, [feriados]);

  const pjReferenceDailyMinutes = useMemo(() => {
    if (!jornadaData) return DEFAULT_DAILY_MINUTES;

    for (let dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek += 1) {
      const configuredMinutes = getExpectedMinutes(jornadaData, dayOfWeek);
      if ((configuredMinutes || 0) > 0) {
        return resolvePJDailyBaseMinutes({
          configuredDayMinutes: configuredMinutes,
          weeklyHours: jornadaData.carga_horaria_semanal,
        });
      }
    }

    return DEFAULT_DAILY_MINUTES;
  }, [jornadaData]);

  const dayRows = useMemo<DayRow[]>(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return daysOfMonth.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const dayOfWeek = getDay(date);
      const isSunday = dayOfWeek === 0;
      const feriadoNome = holidaysByDate[dateStr];
      const isHoliday = Boolean(feriadoNome);
      const isFuture = dateStr > today;
      const beforeAdmission = Boolean(
        colaboradorData?.data_admissao && dateStr < colaboradorData.data_admissao,
      );
      const configuredExpectedMinutes = getExpectedMinutes(jornadaData, dayOfWeek);
      const entry = entriesByDate[dateStr];
      const normalizedContract = normalizeContractType(colaboradorData?.tipo_contrato);
      const isPj = isPJContract(normalizedContract);
      const isDailyContract = isPj || normalizedContract === "diarista";
      const expectedMinutes = isPj && configuredExpectedMinutes !== null && configuredExpectedMinutes > 0
        ? resolvePJDailyBaseMinutes({
            configuredDayMinutes: configuredExpectedMinutes,
            weeklyHours: jornadaData?.carga_horaria_semanal,
          })
        : configuredExpectedMinutes;
      const baseSummary = summarizePointDay({
        entry,
        expectedMinutes: isDailyContract && ((configuredExpectedMinutes || 0) <= 0 || isSunday || isHoliday)
          ? pjReferenceDailyMinutes
          : expectedMinutes,
        isSunday,
        isHoliday,
        shouldCountAbsence: !isFuture
          && !beforeAdmission
          && !isPj,
        specialDayAllHoursAt100: !isPj,
      });
      const summary = isPj
        ? {
            ...baseSummary,
            extra50: 0,
            extraNoturno: 0,
            extra100: 0,
            extraPJ: baseSummary.extra50 + baseSummary.extraNoturno + baseSummary.extra100,
          }
        : baseSummary;

      return {
        date,
        dateStr,
        dayOfWeek,
        entry,
        feriadoNome,
        isSunday,
        isHoliday,
        isFuture,
        beforeAdmission,
        expectedMinutes,
        summary,
      };
    });
  }, [daysOfMonth, holidaysByDate, colaboradorData, jornadaData, entriesByDate, pjReferenceDailyMinutes]);

  const paidDates = useMemo(() => new Set(paidDays.map((item) => item.data)), [paidDays]);
  const usesPaymentSelection = Boolean(colaboradorData);
  const calculationRows = useMemo(() => (
    usesPaymentSelection
      ? dayRows.filter((row) => paidDates.has(row.dateStr))
      : dayRows
  ), [dayRows, paidDates, usesPaymentSelection]);

  const totals = useMemo(() => calculationRows.reduce((acc, row) => ({
    trabalhado: acc.trabalhado + row.summary.workedMinutes,
    normal: acc.normal + row.summary.regularMinutes,
    extra50: acc.extra50 + row.summary.extra50,
    extraNoturno: acc.extraNoturno + row.summary.extraNoturno,
    extra100: acc.extra100 + row.summary.extra100,
    extraPJ: acc.extraPJ + row.summary.extraPJ,
    falta: acc.falta + row.summary.missingMinutes,
    incompletos: acc.incompletos + (row.summary.incomplete ? 1 : 0),
  }), {
    trabalhado: 0,
    normal: 0,
    extra50: 0,
    extraNoturno: 0,
    extra100: 0,
    extraPJ: 0,
    falta: 0,
    incompletos: 0,
  }), [calculationRows]);

  const expectedMonthMinutes = useMemo(() => dayRows.reduce((total, row) => {
    if (row.beforeAdmission || row.isSunday || row.isHoliday) return total;
    return total + Math.max(0, row.expectedMinutes || 0);
  }, 0), [dayRows]);
  const selectedExpectedMinutes = useMemo(() => calculationRows.reduce((total, row) => {
    if (row.beforeAdmission || row.isSunday || row.isHoliday) return total;
    return total + Math.max(0, row.expectedMinutes || 0);
  }, 0), [calculationRows]);

  const financial = useMemo(() => calculateFinancialValues({
    contractType: colaboradorData?.tipo_contrato,
    contractValue: colaboradorData?.valor_contrato,
    salary: colaboradorData?.salario,
    days: calculationRows.map((row) => ({
      ...row.summary,
      isSunday: row.isSunday,
      isHoliday: row.isHoliday,
    })),
    expectedMonthMinutes,
    overtimeGeneratesValue: colaboradorData?.hora_extra_gera_valor !== false,
    basePaymentRatio: expectedMonthMinutes > 0 ? selectedExpectedMinutes / expectedMonthMinutes : 0,
  }), [colaboradorData, calculationRows, expectedMonthMinutes, selectedExpectedMinutes]);

  const payableRows = useMemo(() => dayRows.filter((row) => (
    !row.summary.incomplete && row.summary.workedMinutes > 0
  )), [dayRows]);
  const paidAmount = useMemo(() => paidDays.reduce((total, item) => total + Number(item.valor_total || 0), 0), [paidDays]);
  const pendingExpectedMinutes = useMemo(() => dayRows.reduce((total, row) => {
    if (paidDates.has(row.dateStr) || row.beforeAdmission || row.isSunday || row.isHoliday) return total;
    return total + Math.max(0, row.expectedMinutes || 0);
  }, 0), [dayRows, paidDates]);
  const pendingFinancial = useMemo(() => calculateFinancialValues({
    contractType: colaboradorData?.tipo_contrato,
    contractValue: colaboradorData?.valor_contrato,
    salary: colaboradorData?.salario,
    days: dayRows.filter((row) => !paidDates.has(row.dateStr)).map((row) => ({
      ...row.summary, isSunday: row.isSunday, isHoliday: row.isHoliday,
    })),
    expectedMonthMinutes,
    overtimeGeneratesValue: colaboradorData?.hora_extra_gera_valor !== false,
    basePaymentRatio: expectedMonthMinutes > 0 ? pendingExpectedMinutes / expectedMonthMinutes : 0,
  }), [colaboradorData, dayRows, expectedMonthMinutes, paidDates, pendingExpectedMinutes]);

  const setDayPaid = async (row: DayRow, checked: boolean) => {
    if (!selectedColaborador || paymentSaving) return;
    setPaymentSaving(true);
    try {
      if (!checked) {
        const { error } = await db.from("rh_ponto_dias_pagos").delete()
          .eq("colaborador_id", selectedColaborador).eq("data", row.dateStr);
        if (error) throw error;
      } else {
        const dayValue = calculateFinancialValues({
          contractType: colaboradorData?.tipo_contrato,
          contractValue: colaboradorData?.valor_contrato,
          salary: colaboradorData?.salario,
          days: [{ ...row.summary, isSunday: row.isSunday, isHoliday: row.isHoliday }],
          expectedMonthMinutes,
          overtimeGeneratesValue: colaboradorData?.hora_extra_gera_valor !== false,
          basePaymentRatio: expectedMonthMinutes > 0 && !row.isSunday && !row.isHoliday
            ? Math.max(0, row.expectedMinutes || 0) / expectedMonthMinutes
            : 0,
        });
        const { error } = await db.from("rh_ponto_dias_pagos").upsert({
          colaborador_id: selectedColaborador,
          data: row.dateStr,
          valor_diaria: dayValue.salarioBase,
          valor_adicionais: dayValue.valorExtra50 + dayValue.valorExtraNoturno + dayValue.valorExtra100 + dayValue.valorExtraPJ,
          valor_total: dayValue.totalBruto,
          pago_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "colaborador_id,data" });
        if (error) throw error;
      }
      await fetchEntriesForMonth();
      toast.success(checked ? "Dia marcado como pago" : "Dia reaberto como pendente");
    } catch (error) {
      console.error("Erro ao atualizar pagamento do dia:", error);
      toast.error("Não foi possível atualizar o pagamento do dia");
    } finally {
      setPaymentSaving(false);
    }
  };

  const setAllPayableDays = async (checked: boolean) => {
    if (!selectedColaborador || paymentSaving) return;
    setPaymentSaving(true);
    try {
      if (!checked) {
        const { error } = await db.from("rh_ponto_dias_pagos").delete()
          .eq("colaborador_id", selectedColaborador).gte("data", `${selectedMonth}-01`).lte("data", `${selectedMonth}-31`);
        if (error) throw error;
      } else {
        const records = payableRows.map((row) => {
          const dayValue = calculateFinancialValues({
            contractType: colaboradorData?.tipo_contrato,
            contractValue: colaboradorData?.valor_contrato,
            salary: colaboradorData?.salario,
            days: [{ ...row.summary, isSunday: row.isSunday, isHoliday: row.isHoliday }],
            expectedMonthMinutes,
            overtimeGeneratesValue: colaboradorData?.hora_extra_gera_valor !== false,
            basePaymentRatio: expectedMonthMinutes > 0 && !row.isSunday && !row.isHoliday
              ? Math.max(0, row.expectedMinutes || 0) / expectedMonthMinutes
              : 0,
          });
          return {
            colaborador_id: selectedColaborador, data: row.dateStr,
            valor_diaria: dayValue.salarioBase,
            valor_adicionais: dayValue.valorExtra50 + dayValue.valorExtraNoturno + dayValue.valorExtra100 + dayValue.valorExtraPJ,
            valor_total: dayValue.totalBruto, pago_em: new Date().toISOString(), updated_at: new Date().toISOString(),
          };
        });
        const { error } = await db.from("rh_ponto_dias_pagos").upsert(records, { onConflict: "colaborador_id,data" });
        if (error) throw error;
      }
      await fetchEntriesForMonth();
      toast.success(checked ? "Todos os dias trabalhados foram marcados como pagos" : "Pagamentos do mês foram reabertos");
    } catch (error) {
      console.error("Erro ao atualizar pagamentos do mês:", error);
      toast.error("Não foi possível atualizar os pagamentos do mês");
    } finally {
      setPaymentSaving(false);
    }
  };

  const referenceDailyMinutes = useMemo(() => {
    if (!jornadaData) return DEFAULT_DAILY_MINUTES;
    return dayRows.find((row) => (row.expectedMinutes || 0) > 0)?.expectedMinutes || DEFAULT_DAILY_MINUTES;
  }, [jornadaData, dayRows]);

  const diaristHourlyReference = colaboradorData?.valor_contrato
    ? colaboradorData.valor_contrato / (referenceDailyMinutes / 60)
    : 0;

  const isPjContract = isPJContract(colaboradorData?.tipo_contrato);

  useEffect(() => {
    if (!colaboradorData || !import.meta.env.DEV) return;

    const auditRows = calculationRows
      .filter((row) => row.summary.workedMinutes > 0 || row.summary.incomplete)
      .map((row) => ({
        data: row.dateStr,
        contrato: colaboradorData.tipo_contrato || "clt",
        trabalhado: formatMinutes(row.summary.workedMinutes),
        normal: formatMinutes(row.summary.regularMinutes),
        baseDia: formatMinutes(row.summary.baseMinutes),
        cargaSemanal: jornadaData?.carga_horaria_semanal ?? null,
        extraPJ: formatMinutes(row.summary.extraPJ),
        extra50: formatMinutes(row.summary.extra50),
        extraNoturno: formatMinutes(row.summary.extraNoturno),
        extra100: formatMinutes(row.summary.extra100),
        falta: formatMinutes(row.summary.missingMinutes),
        observacao: observationForRow(row),
      }));

    console.groupCollapsed(`[Ponto] Auditoria de extras - ${colaboradorData.nome} - ${selectedMonth}`);
    console.info("Contrato normalizado", {
      original: colaboradorData.tipo_contrato,
      isPJ: isPjContract,
      regra: isPjContract
        ? "PJ agrupa excedentes em Extra PJ e zera adicionais."
        : "Contrato não PJ mantém adicionais conforme jornada.",
    });
    console.table(auditRows);
    console.info("Totais", {
      trabalhado: formatMinutes(totals.trabalhado),
      normal: formatMinutes(totals.normal),
      extraPJ: formatMinutes(totals.extraPJ),
      extra50: formatMinutes(totals.extra50),
      extraNoturno: formatMinutes(totals.extraNoturno),
      extra100: formatMinutes(totals.extra100),
      falta: formatMinutes(totals.falta),
      financeiro: financial,
    });
    console.groupEnd();
  }, [calculationRows, colaboradorData, financial, isPjContract, jornadaData, selectedMonth, totals]);

  const handleTimeUpdate = async (dateStr: string, field: string, newValue: string | null) => {
    const entry = entriesByDate[dateStr];
    try {
      if (entry) {
        const { error } = await supabase
          .from("rh_registros_ponto")
          .update({ [field]: newValue, status: "pendente", aprovado_por: null, aprovado_em: null } as any)
          .eq("id", entry.id);
        if (error) throw error;
      } else {
        if (!selectedColaborador || !newValue) return;
        const { error } = await db.from("rh_registros_ponto").insert({
          colaborador_id: selectedColaborador,
          data: dateStr,
          [field]: newValue,
          status: "pendente",
        } as any);
        if (error) throw error;
      }
      toast.success("Horário atualizado");
      await fetchEntriesForMonth();
    } catch (error) {
      console.error("Erro ao atualizar horário:", error);
      toast.error("Erro ao atualizar horário");
    }
  };

  const buildPrintableHtml = () => {
    const type = contractLabel(colaboradorData?.tipo_contrato);
    const extraHeaders = isPjContract
      ? "<th>Extra PJ</th>"
      : "<th>Extra 50%</th><th>Noturno</th><th>Extra 100%</th>";
    const metricsHtml = isPjContract
      ? `
            <div class="metric"><strong>Trabalhado</strong><br />${formatMinutes(totals.trabalhado)}</div>
            <div class="metric"><strong>Normal</strong><br />${formatMinutes(totals.normal)}</div>
            <div class="metric"><strong>Extra PJ</strong><br />${formatMinutes(totals.extraPJ)}</div>
            <div class="metric"><strong>Falta</strong><br />${formatMinutes(totals.falta)}</div>`
      : `
            <div class="metric"><strong>Trabalhado</strong><br />${formatMinutes(totals.trabalhado)}</div>
            <div class="metric"><strong>Normal</strong><br />${formatMinutes(totals.normal)}</div>
            <div class="metric"><strong>Extra 50%</strong><br />${formatMinutes(totals.extra50)}</div>
            <div class="metric"><strong>Noturno extra</strong><br />${formatMinutes(totals.extraNoturno)}</div>
            <div class="metric"><strong>Extra 100%</strong><br />${formatMinutes(totals.extra100)}</div>
            <div class="metric"><strong>Falta</strong><br />${formatMinutes(totals.falta)}</div>`;
    const financialHtml = isPjContract
      ? `
            <div class="metric"><strong>Base normal</strong><br />${formatMoney(financial.salarioBase)}</div>
            <div class="metric"><strong>Extra PJ</strong><br />${formatMoney(financial.valorExtraPJ)}</div>
            <div class="metric"><strong>Total bruto</strong><br />${formatMoney(financial.totalBruto)}</div>`
      : `
            <div class="metric"><strong>Base normal</strong><br />${formatMoney(financial.salarioBase)}</div>
            <div class="metric"><strong>Extra 50%</strong><br />${formatMoney(financial.valorExtra50)}</div>
            <div class="metric"><strong>Noturno</strong><br />${formatMoney(financial.valorExtraNoturno)}</div>
            <div class="metric"><strong>Extra 100%</strong><br />${formatMoney(financial.valorExtra100)}</div>
            <div class="metric"><strong>Desconto</strong><br />${formatMoney(financial.descontoFalta)}</div>
            <div class="metric"><strong>Total bruto</strong><br />${formatMoney(financial.totalBruto)}</div>`;
    const financialNote = isPjContract
      ? `PJ: ${financial.diasTrabalhados} dia(s) trabalhado(s) × ${formatMoney(colaboradorData?.valor_contrato || 0)} por diária. Excedentes são agrupados somente em Extra PJ, sem detalhamento de adicionais ou desconto de falta.`
      : "Diarista: valor normal proporcional aos minutos trabalhados até a base diária; excedente da base é calculado separadamente. Sem jornada atribuída, a base padrão é 8 horas. Registros incompletos e datas futuras não entram no fechamento.";
    const rows = calculationRows.map((row) => `
      <tr>
        <td>${format(row.date, "dd/MM/yyyy")}</td>
        <td>${DIAS_SEMANA[row.dayOfWeek]}</td>
        <td>${escapeHtml(row.entry?.hora_entrada_1?.slice(0, 5) || "-")}</td>
        <td>${escapeHtml(row.entry?.hora_saida_1?.slice(0, 5) || "-")}</td>
        <td>${escapeHtml(row.entry?.hora_entrada_2?.slice(0, 5) || "-")}</td>
        <td>${escapeHtml(row.entry?.hora_saida_2?.slice(0, 5) || "-")}</td>
        <td>${escapeHtml(row.entry?.hora_entrada_3?.slice(0, 5) || "-")}</td>
        <td>${escapeHtml(row.entry?.hora_saida_3?.slice(0, 5) || "-")}</td>
        <td>${row.summary.workedMinutes ? formatMinutes(row.summary.workedMinutes) : "-"}</td>
        ${isPjContract
          ? `<td>${row.summary.extraPJ ? formatMinutes(row.summary.extraPJ) : "-"}</td>`
          : `<td>${row.summary.extra50 ? formatMinutes(row.summary.extra50) : "-"}</td>
        <td>${row.summary.extraNoturno ? formatMinutes(row.summary.extraNoturno) : "-"}</td>
        <td>${row.summary.extra100 ? formatMinutes(row.summary.extra100) : "-"}</td>`}
        <td>${row.summary.missingMinutes ? formatMinutes(row.summary.missingMinutes) : "-"}</td>
        <td>${escapeHtml(observationForRow(row))}</td>
      </tr>
    `).join("");

    return `<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Espelho de Ponto - ${escapeHtml(colaboradorData?.nome || "")}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; color: #111; font-size: 10px; }
            h1 { margin: 0 0 8px; font-size: 18px; }
            h2 { margin: 18px 0 8px; font-size: 13px; }
            .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 14px; margin-bottom: 12px; }
            .meta div, .metric { border: 1px solid #ccc; border-radius: 4px; padding: 7px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #bbb; padding: 4px; text-align: center; }
            th { background: #eee; }
            .metrics { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-top: 10px; }
            .financial { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
            .note { margin-top: 10px; font-size: 9px; color: #444; }
          </style>
        </head>
        <body>
          <h1>Espelho de Ponto — ${format(selectedMonthDate, "MMMM 'de' yyyy", { locale: ptBR })}</h1>
          <div class="meta">
            <div><strong>Colaborador:</strong><br />${escapeHtml(colaboradorData?.nome || "-")}</div>
            <div><strong>CPF:</strong><br />${escapeHtml(colaboradorData?.cpf_cnpj || "-")}</div>
            <div><strong>Departamento:</strong><br />${escapeHtml(colaboradorData?.departamento || "-")}</div>
            <div><strong>Jornada:</strong><br />${escapeHtml(jornadaData?.nome || "Não definida")}</div>
            <div><strong>Contrato:</strong><br />${type}</div>
            <div><strong>Valor contratado:</strong><br />${formatMoney(colaboradorData?.valor_contrato || colaboradorData?.salario || 0)}</div>
            <div><strong>Base da diária:</strong><br />${formatMinutes(referenceDailyMinutes)}</div>
            <div><strong>Gerado em:</strong><br />${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
          </div>
          <table>
            <thead><tr>
              <th>Data</th><th>Sem</th><th>Ent 1</th><th>Saí 1</th><th>Ent 2</th><th>Saí 2</th>
              <th>Ent 3</th><th>Saí 3</th><th>Total</th>${extraHeaders}<th>Falta</th><th>Observação</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <h2>Totais de horas</h2>
          <div class="metrics">
            ${metricsHtml}
          </div>
          <h2>Memória financeira</h2>
          <div class="financial">
            ${financialHtml}
          </div>
          <p class="note">${financialNote}</p>
        </body>
      </html>`;
  };

  const openPrintDialog = (pdfMode = false) => {
    if (!colaboradorData) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("O navegador bloqueou a janela de impressão");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildPrintableHtml());
    printWindow.document.close();
    printWindow.focus();
    if (pdfMode) toast.info("No diálogo de impressão, selecione ‘Salvar como PDF’");
    window.setTimeout(() => printWindow.print(), 250);
  };

  const exportExcel = () => {
    if (!colaboradorData) return;
    const detailRows = calculationRows.map((row) => ({
      Data: format(row.date, "dd/MM/yyyy"),
      Semana: DIAS_SEMANA[row.dayOfWeek],
      "Entrada 1": row.entry?.hora_entrada_1?.slice(0, 5) || "-",
      "Saída 1": row.entry?.hora_saida_1?.slice(0, 5) || "-",
      "Entrada 2": row.entry?.hora_entrada_2?.slice(0, 5) || "-",
      "Saída 2": row.entry?.hora_saida_2?.slice(0, 5) || "-",
      "Entrada 3": row.entry?.hora_entrada_3?.slice(0, 5) || "-",
      "Saída 3": row.entry?.hora_saida_3?.slice(0, 5) || "-",
      Trabalhado: row.summary.workedMinutes ? formatMinutes(row.summary.workedMinutes) : "-",
      Normal: row.summary.regularMinutes ? formatMinutes(row.summary.regularMinutes) : "-",
      ...(isPjContract
        ? { "Extra PJ": row.summary.extraPJ ? formatMinutes(row.summary.extraPJ) : "-" }
        : {
            "Extra 50%": row.summary.extra50 ? formatMinutes(row.summary.extra50) : "-",
            "Noturno extra": row.summary.extraNoturno ? formatMinutes(row.summary.extraNoturno) : "-",
            "Extra 100%": row.summary.extra100 ? formatMinutes(row.summary.extra100) : "-",
          }),
      Falta: row.summary.missingMinutes ? formatMinutes(row.summary.missingMinutes) : "-",
      Observação: observationForRow(row),
    }));
    const summaryRows = isPjContract
      ? [
          { Campo: "Colaborador", Valor: colaboradorData.nome },
          { Campo: "Contrato", Valor: contractLabel(colaboradorData.tipo_contrato) },
          { Campo: "Jornada", Valor: jornadaData?.nome || "Não definida" },
          { Campo: "Base normal", Valor: financial.salarioBase },
          { Campo: "Dias trabalhados", Valor: financial.diasTrabalhados },
          { Campo: "Extra PJ", Valor: financial.valorExtraPJ },
          { Campo: "Total bruto", Valor: financial.totalBruto },
        ]
      : [
          { Campo: "Colaborador", Valor: colaboradorData.nome },
          { Campo: "Contrato", Valor: contractLabel(colaboradorData.tipo_contrato) },
          { Campo: "Jornada", Valor: jornadaData?.nome || "Não definida" },
          { Campo: "Base normal", Valor: financial.salarioBase },
          { Campo: "Dias trabalhados", Valor: financial.diasTrabalhados },
          { Campo: "Extra 50%", Valor: financial.valorExtra50 },
          { Campo: "Noturno", Valor: financial.valorExtraNoturno },
          { Campo: "Extra 100%", Valor: financial.valorExtra100 },
          { Campo: "Desconto falta", Valor: financial.descontoFalta },
          { Campo: "Total bruto", Valor: financial.totalBruto },
        ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), "Espelho");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Resumo financeiro");
    XLSX.writeFile(workbook, `espelho_ponto_${colaboradorData.nome}_${selectedMonth}.xlsx`);
    toast.success("Excel exportado com memória financeira");
  };

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    );
  }

  const canViewAll = isGestor || isPontoViewer;
  if (!canViewAll) return null;

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Controle de Ponto</h1>
          <p className="mt-1 text-muted-foreground">Espelho de ponto eletrônico</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2"><Label>Mês/Ano</Label><MonthYearPicker value={selectedMonth} onChange={setSelectedMonth} /></div>
                <div className="space-y-2">
                  <Label>Colaborador</Label>
                  <Select value={selectedColaborador} onValueChange={setSelectedColaborador}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{colaboradores.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2" disabled={!colaboradorData || entriesLoading} onClick={() => openPrintDialog(false)}><Printer className="h-4 w-4" />Imprimir</Button>
                <Button variant="outline" className="gap-2" disabled={!colaboradorData || entriesLoading} onClick={() => openPrintDialog(true)}><FileText className="h-4 w-4" />PDF</Button>
                <Button variant="outline" className="gap-2" disabled={!colaboradorData || entriesLoading} onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {colaboradorData && (
          <Card><CardContent className="py-4"><div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
            <div><span className="text-muted-foreground">Colaborador: </span><span className="font-medium">{colaboradorData.nome}</span></div>
            <div><span className="text-muted-foreground">CPF: </span><span className="font-medium">{colaboradorData.cpf_cnpj || "-"}</span></div>
            <div><span className="text-muted-foreground">Departamento: </span><span className="font-medium">{colaboradorData.departamento || "-"}</span></div>
            <div><span className="text-muted-foreground">Jornada: </span><span className="font-medium">{jornadaData?.nome || "Não definida"}</span></div>
          </div></CardContent></Card>
        )}

        {!jornadaData && colaboradorData && (
          <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="flex gap-3 py-4 text-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div><p className="font-medium">Jornada não definida</p><p className="text-muted-foreground">O sistema não lançará faltas automáticas. Para diarista, somente o cálculo financeiro dos dias efetivamente completos usa a base padrão de 8 horas.</p></div>
          </CardContent></Card>
        )}

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5" />Espelho de Ponto — {format(selectedMonthDate, "MMMM 'de' yyyy", { locale: ptBR })}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {entriesLoading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow className="bg-muted/50">
                  {usesPaymentSelection && <TableHead className="text-center">Pago</TableHead>}
                  <TableHead className="text-center">Dia</TableHead><TableHead className="text-center">Sem</TableHead>
                  <TableHead className="text-center">Ent 1</TableHead><TableHead className="text-center">Saí 1</TableHead>
                  <TableHead className="text-center">Ent 2</TableHead><TableHead className="text-center">Saí 2</TableHead>
                  <TableHead className="text-center">Ent 3</TableHead><TableHead className="text-center">Saí 3</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  {isPjContract ? (
                    <TableHead className="text-center">Extra PJ</TableHead>
                  ) : (
                    <>
                      <TableHead className="text-center">Extra 50%</TableHead>
                      <TableHead className="text-center">Noturno</TableHead>
                      <TableHead className="text-center">Extra 100%</TableHead>
                    </>
                  )}
                  <TableHead className="text-center">Falta</TableHead><TableHead>Observação</TableHead>
                </TableRow></TableHeader>
                <TableBody>{dayRows.map((row) => {
                  const rowClass = row.isHoliday ? "bg-orange-500/10" : row.isSunday ? "bg-blue-500/10" : row.dayOfWeek === 6 ? "bg-muted/30" : "";
                  return <TableRow key={row.dateStr} className={rowClass}>
                    {usesPaymentSelection && <TableCell className="text-center"><Checkbox
                      checked={paidDates.has(row.dateStr)}
                      disabled={!isGestor || paymentSaving || row.summary.incomplete || row.summary.workedMinutes <= 0}
                      onCheckedChange={(checked) => void setDayPaid(row, checked === true)}
                      aria-label={`Marcar ${row.dateStr} como pago`}
                    /></TableCell>}
                    <TableCell className="text-center font-medium">{format(row.date, "dd")}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{DIAS_SEMANA[row.dayOfWeek]}</TableCell>
                    {(["hora_entrada_1", "hora_saida_1", "hora_entrada_2", "hora_saida_2", "hora_entrada_3", "hora_saida_3"] as const).map((field) => (
                      <TableCell key={field} className="text-center"><EditableTimeCell value={row.entry?.[field] || null} onChange={(value) => handleTimeUpdate(row.dateStr, field, value)} disabled={!isGestor} /></TableCell>
                    ))}
                    <TableCell className="text-center font-mono text-sm font-medium">{row.summary.workedMinutes ? formatMinutes(row.summary.workedMinutes) : "-"}</TableCell>
                    {isPjContract ? (
                      <TableCell className="text-center font-mono text-sm text-primary">{row.summary.extraPJ ? formatMinutes(row.summary.extraPJ) : "-"}</TableCell>
                    ) : (
                      <>
                        <TableCell className="text-center font-mono text-sm text-yellow-500">{row.summary.extra50 ? formatMinutes(row.summary.extra50) : "-"}</TableCell>
                        <TableCell className="text-center font-mono text-sm text-purple-500">{row.summary.extraNoturno ? formatMinutes(row.summary.extraNoturno) : "-"}</TableCell>
                        <TableCell className="text-center font-mono text-sm text-green-500">{row.summary.extra100 ? formatMinutes(row.summary.extra100) : "-"}</TableCell>
                      </>
                    )}
                    <TableCell className="text-center font-mono text-sm text-red-500">{row.summary.missingMinutes ? formatMinutes(row.summary.missingMinutes) : "-"}</TableCell>
                    <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                      {row.summary.incomplete ? <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500">Registro incompleto</Badge>
                        : row.feriadoNome ? <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-500">{row.feriadoNome}</Badge>
                        : row.isSunday ? <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-500">DSR</Badge>
                        : row.entry?.observacao || ""}
                    </TableCell>
                  </TableRow>;
                })}</TableBody>
              </Table></div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          {((isPjContract ? [
            ["Total Trabalhado", totals.trabalhado, "text-primary", Clock],
            ["Horas Normais", totals.normal, "text-foreground", CheckCircle],
            ["Extra PJ", totals.extraPJ, "text-primary", Clock],
            ["Horas Falta", totals.falta, "text-red-500", Clock],
          ] : [
            ["Total Trabalhado", totals.trabalhado, "text-primary", Clock],
            ["Horas Normais", totals.normal, "text-foreground", CheckCircle],
            ["Extras 50% (acima da jornada)", totals.extra50, "text-yellow-500", Clock],
            ["Noturno extra (após 22h)", totals.extraNoturno, "text-purple-500", Moon],
            ["Extras 100% (Dom/Fer)", totals.extra100, "text-green-500", Clock],
            ["Horas Falta", totals.falta, "text-red-500", Clock],
          ]) as Array<[string, number, string, React.ElementType]>).map(([label, value, colorClass, Icon]) => (
            <Card key={String(label)}><CardContent className="pt-6"><div className="flex items-center gap-3"><Icon className={`h-5 w-5 ${colorClass}`} /><div><p className={`font-mono text-xl font-bold ${colorClass}`}>{formatMinutes(Number(value))}</p><p className="text-xs text-muted-foreground">{String(label)}</p></div></div></CardContent></Card>
          ))}
        </div>

        {usesPaymentSelection && (
          <Card className="border-blue-500/30 bg-blue-500/5"><CardContent className="flex items-center justify-between gap-4 py-4 text-sm">
            <div><p className="font-medium">Apuração pelos dias marcados como pagos</p><p className="text-muted-foreground">Todos os totais de horas, adicionais, base financeira, PDF e Excel consideram somente os {calculationRows.length} dia(s) selecionado(s) na coluna Pago.</p></div>
            <Badge variant="outline" className="shrink-0">{calculationRows.length} dia(s)</Badge>
          </CardContent></Card>
        )}

        {totals.incompletos > 0 && (
          <Card className="border-amber-500/30"><CardContent className="flex gap-3 py-4 text-sm"><AlertCircle className="h-5 w-5 text-amber-500" /><p><strong>{totals.incompletos} registro(s) incompleto(s).</strong> Eles não entram nas horas, faltas nem valores até que as batidas sejam fechadas.</p></CardContent></Card>
        )}

        {usesPaymentSelection && colaboradorData && (colaboradorData.valor_contrato || colaboradorData.salario) && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Wallet className="h-5 w-5" />Controle de pagamentos</CardTitle><CardDescription>Marque individualmente os dias já pagos ou feche todo o mês. O valor fica registrado como fotografia do pagamento realizado.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Dias pagos</p><p className="text-xl font-bold text-green-500">{paidDays.length}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Dias pendentes</p><p className="text-xl font-bold text-amber-500">{payableRows.length - paidDays.length}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Já pago</p><p className="text-xl font-bold text-green-500">{formatMoney(paidAmount)}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Pendente</p><p className="text-xl font-bold text-amber-500">{formatMoney(pendingFinancial.totalBruto)}</p></div>
              </div>
              {isGestor && <div className="flex flex-wrap gap-2"><Button size="sm" disabled={paymentSaving || payableRows.length === 0} onClick={() => void setAllPayableDays(true)}>Marcar mês trabalhado como pago</Button><Button size="sm" variant="outline" disabled={paymentSaving || paidDays.length === 0} onClick={() => void setAllPayableDays(false)}>Reabrir pagamentos do mês</Button></div>}
            </CardContent>
          </Card>
        )}

        {colaboradorData && (colaboradorData.valor_contrato || colaboradorData.salario) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Wallet className="h-5 w-5" />Valores Financeiros <Badge variant="outline">{contractLabel(colaboradorData.tipo_contrato)}</Badge></CardTitle>
              {normalizeContractType(colaboradorData.tipo_contrato) === "diarista" && <CardDescription>Diária de {formatMoney(colaboradorData.valor_contrato || 0)} · base {formatMinutes(referenceDailyMinutes)} · referência de {formatMoney(diaristHourlyReference)}/h. Horas abaixo da base são proporcionais; somente o excedente recebe adicional.</CardDescription>}
              {normalizeContractType(colaboradorData.tipo_contrato) === "horista" && <CardDescription>Valor contratado de {formatMoney(colaboradorData.valor_contrato || 0)} por hora, com adicionais calculados separadamente.</CardDescription>}
              {isPjContract && <CardDescription>{financial.diasTrabalhados} dia(s) trabalhado(s) × {formatMoney(colaboradorData.valor_contrato || 0)} por diária. Excedentes aparecem somente como Extra PJ, sem detalhamento de adicionais ou desconto de falta.</CardDescription>}
              {normalizeContractType(colaboradorData.tipo_contrato) === "horista" && <CardDescription>As horas extras são exibidas no espelho, mas este perfil não recebe adicional financeiro de hora extra.</CardDescription>}
            </CardHeader>
            <CardContent><div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {(isPjContract ? [
                ["Base normal", financial.salarioBase, ""],
                ["Extra PJ", financial.valorExtraPJ, "text-primary"],
                ["Total bruto", financial.totalBruto, "text-primary"],
              ] : [
                ["Base normal", financial.salarioBase, ""],
                ["Extra 50%", financial.valorExtra50, "text-yellow-500"],
                ["Noturno", financial.valorExtraNoturno, "text-purple-500"],
                ["Extra 100%", financial.valorExtra100, "text-green-500"],
                ["Desconto faltas", -financial.descontoFalta, "text-red-500"],
                ["Total bruto", financial.totalBruto, "text-primary"],
              ]).map(([label, value, colorClass]) => <div key={String(label)} className="rounded-lg border border-border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">{String(label)}</p><p className={`text-xl font-bold ${colorClass}`}>{formatMoney(Number(value))}</p></div>)}
            </div></CardContent>
          </Card>
        )}
      </div>
  );
}
