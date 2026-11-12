// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/planejamento-v2-original/supabaseClient";
import { MainLayout } from "@/planejamento-v2-original/MainLayout";
import { Button } from "@/components/ui/button";
import { ReportPdfButton } from "@/planejamento-v2-original/components/ReportPdfButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowUp, Banknote, BarChart3, CalendarDays, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, CircleDot, Clock3, Columns3, Download, Filter, Folder, GanttChartSquare, GitBranch, GripVertical, Hash, HelpCircle, LayoutDashboard, LayoutList, Link2, Milestone, MoreHorizontal, Palette, Percent, Plus, Ruler, Search, Star, UserRound, UserRoundX, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useUserPermissions } from "@/planejamento-v2-original/hooks/useUserPermissions";
import { recalculatePlanejamentoV2Capacity } from "@/planejamento-v2-original/lib/planejamentoV2Capacity";
import { useProjectProductionTargets } from "@/planejamento-v2-original/hooks/useProjectProductionTargets";
import { useRealtimeInvalidation } from "@/planejamento-v2-original/hooks/useRealtimeInvalidation";

const sb = supabase as any;
const DAY_MS = 86_400_000;
const ROW_HEIGHT = 44;

type WorkspaceStatus = "draft" | "active" | "paused" | "completed" | "archived";
type TaskStatus = "not_started" | "in_progress" | "blocked" | "completed" | "cancelled";
type TaskType = "task" | "summary" | "milestone";
type TabId = "gantt" | "board" | "list" | "calendar" | "workload" | "people" | "dashboard";

type WorkspaceRow = { id: string; app_project_setting_id: string; project_name_snapshot: string; status: WorkspaceStatus; owner_id?: string | null };
type TaskRow = { id: string; workspace_id: string; parent_task_id?: string | null; source_process_setting_id?: string | null; title: string; description?: string | null; task_type: TaskType; status: TaskStatus; priority: "low" | "normal" | "high" | "urgent"; position: number; start_date?: string | null; start_time?: string | null; end_date?: string | null; end_time?: string | null; duration_days?: number | null; progress: number; quantity?: number | null; unit?: string | null; responsible_id?: string | null; budget?: number | null; bar_color?: string | null; progress_mode?: "automatic" | "manual" | null };
type ProcessRow = { id: string; valor: string };
type ProfileRow = { id: string; full_name: string; email?: string | null; avatar_url?: string | null };
type CollaboratorRow = { id: string; nome: string; cargo?: string | null };
type DependencyRow = { id: string; predecessor_task_id: string; successor_task_id: string };
type MemberRow = { id: string; workspace_id: string; profile_id?: string | null; colaborador_id?: string | null; display_name: string; email?: string | null; member_type: "user" | "production" | "manual" | "resource"; project_role: "owner" | "editor" | "member" | "viewer" | "resource"; capacity_hours_per_day: number; active: boolean };
type AssignmentRow = { id: string; task_id: string; member_id: string; allocated_minutes: number };
type CapacitySettingsRow = { enabled: boolean; max_concurrent_labor: number };
type ProcessCapacityRow = { process_setting_id: string; crew_size: number; active: boolean };
type CapacityTaskRuleRow = { task_id: string; enabled: boolean };
type CustomFieldType = "text" | "number" | "currency" | "date" | "boolean" | "select";
type CustomFieldRow = { id: string; workspace_id: string; name: string; field_type: CustomFieldType; options: unknown; position: number; active: boolean };
type CustomFieldValueRow = { id: string; task_id: string; field_id: string; value: unknown };
type StandardFieldKey = "assignee" | "progress" | "status" | "priority" | "startDate" | "startTime" | "endDate" | "endTime" | "executionTime" | "quantity" | "unit" | "budget" | "predecessors" | "plannedLoad" | "barColor";
type FlatTask = { task: TaskRow; depth: number };
type LinkDraft = { sourceTaskId: string; startX: number; startY: number; currentX: number; currentY: number };

type TaskForm = {
  id?: string; origin: "process" | "custom"; processId: string; title: string; taskType: TaskType; parentTaskId: string;
  startDate: string; startTime: string; endDate: string; endTime: string; memberId: string; allocatedHours: string;
  status: TaskStatus; priority: TaskRow["priority"]; progress: string; progressManual: boolean; barColor: string; quantity: string; unit: string; budget: string; description: string;
};
type MemberForm = { source: "user" | "production" | "manual" | "resource"; profileId: string; collaboratorId: string; name: string; email: string; role: MemberRow["project_role"]; capacity: string };

const STATUS_LABELS: Record<TaskStatus, string> = { not_started: "Aberto", in_progress: "Em progresso", blocked: "Bloqueado", completed: "Feito", cancelled: "Fechado" };
const STATUS_ORDER: TaskStatus[] = ["not_started", "in_progress", "completed", "cancelled", "blocked"];
const EMPTY_TASK: TaskForm = { origin: "process", processId: "", title: "", taskType: "task", parentTaskId: "root", startDate: "", startTime: "08:00", endDate: "", endTime: "17:45", memberId: "unassigned", allocatedHours: "", status: "not_started", priority: "normal", progress: "0", progressManual: false, barColor: "", quantity: "", unit: "", budget: "", description: "" };
const EMPTY_MEMBER: MemberForm = { source: "user", profileId: "", collaboratorId: "", name: "", email: "", role: "member", capacity: "8" };
const DEFAULT_STANDARD_FIELDS: StandardFieldKey[] = ["assignee", "progress", "status"];
const STANDARD_FIELD_GROUPS: { label: string; fields: { key: StandardFieldKey; label: string }[] }[] = [
  { label: "INDICADORES", fields: [
    { key: "plannedLoad", label: "Sobrecarga de recursos" },
  ] },
  { label: "GERAL", fields: [
    { key: "assignee", label: "Atribuído" },
    { key: "progress", label: "Progresso" },
    { key: "status", label: "Estado" },
    { key: "priority", label: "Prioridade" },
    { key: "predecessors", label: "Antecessor" },
  ] },
  { label: "CRONOGRAMA", fields: [
    { key: "startDate", label: "Data de início" },
    { key: "startTime", label: "Hora de início" },
    { key: "endDate", label: "Data final" },
    { key: "endTime", label: "Hora final" },
    { key: "executionTime", label: "Tempo de execução" },
  ] },
  { label: "DADOS DA ATIVIDADE", fields: [
    { key: "quantity", label: "Quantidade" },
    { key: "unit", label: "Unidade" },
    { key: "budget", label: "Orçamento" },
    { key: "barColor", label: "Cor da barra" },
  ] },
];
const STANDARD_FIELDS = STANDARD_FIELD_GROUPS.flatMap((group) => group.fields);
const STANDARD_FIELD_ICONS: Record<StandardFieldKey, React.ComponentType<{ className?: string }>> = {
  executionTime: Clock3,
  plannedLoad: BarChart3,
  assignee: UserRound,
  progress: Percent,
  status: CircleDot,
  priority: ArrowUp,
  predecessors: GitBranch,
  startDate: CalendarDays,
  startTime: Clock3,
  endDate: CalendarDays,
  endTime: Clock3,
  quantity: Hash,
  unit: Ruler,
  budget: Banknote,
  barColor: Palette,
};

function parseDate(value?: string | null) { return value ? new Date(`${value}T00:00:00`) : null; }
function addDays(date: Date, amount: number) { return new Date(date.getTime() + amount * DAY_MS); }
function diffDays(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / DAY_MS); }
function iso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function fmtDate(value?: string | null) { const date = parseDate(value); return date ? new Intl.DateTimeFormat("pt-BR").format(date) : "—"; }
function fmtTime(value?: string | null) { return value ? value.slice(0, 5) : "—"; }
function monthLabel(date: Date) { const value = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date); return value.charAt(0).toUpperCase() + value.slice(1); }
function weekday(date: Date) { return ["D", "S", "T", "Q", "Q", "S", "S"][date.getDay()]; }
function clamp(value: number, min: number, max: number) { return Math.min(Math.max(value, min), max); }
function durationDays(task: TaskRow) { const start = parseDate(task.start_date); const end = parseDate(task.end_date) || start; return start && end ? Math.max(diffDays(start, end) + 1, 1) : 1; }
function statusColor(status: TaskStatus) { if (status === "completed") return "bg-sky-500"; if (status === "in_progress") return "bg-amber-500"; if (status === "blocked") return "bg-orange-500"; if (status === "cancelled") return "bg-emerald-600"; return "bg-primary"; }
function statusHex(status: TaskStatus) { if (status === "completed") return "#0ea5e9"; if (status === "in_progress") return "#f59e0b"; if (status === "blocked") return "#f97316"; if (status === "cancelled") return "#059669"; return "#64748b"; }
function taskBarColor(task: Pick<TaskRow, "status" | "bar_color">) { return /^#[0-9a-f]{6}$/i.test(task.bar_color || "") ? String(task.bar_color) : statusHex(task.status); }
type ProgressSource = { status: TaskStatus; progress?: number | null; progress_mode?: "automatic" | "manual" | null; start_date?: string | null; start_time?: string | null; end_date?: string | null; end_time?: string | null };
function taskDateTime(date?: string | null, time?: string | null, fallback = "00:00") { return date ? new Date(`${date}T${time?.slice(0, 5) || fallback}:00`) : null; }
function effectiveTaskProgress(task: ProgressSource, now = new Date()) {
  if (task.status === "completed" || task.status === "cancelled") return 100;
  if (task.status === "not_started") return 0;
  const stored = clamp(Math.round(Number(task.progress || 0)), 0, 100);
  if (task.progress_mode === "manual" || task.status !== "in_progress") return task.status === "in_progress" ? Math.min(stored, 99) : stored;
  const start = taskDateTime(task.start_date, task.start_time, "00:00");
  const end = taskDateTime(task.end_date, task.end_time, "23:59");
  if (!start || !end || end.getTime() <= start.getTime()) return Math.min(stored, 99);
  if (now.getTime() <= start.getTime()) return 0;
  if (now.getTime() >= end.getTime()) return 99;
  return clamp(Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100), 1, 99);
}
function taskIsOverdue(task: ProgressSource, now = new Date()) {
  if (task.status === "completed" || task.status === "cancelled") return false;
  const end = taskDateTime(task.end_date, task.end_time, "23:59");
  return Boolean(end && now.getTime() > end.getTime());
}
function effectiveFormProgress(form: TaskForm) { return effectiveTaskProgress({ status: form.status, progress: Number(form.progress || 0), progress_mode: form.progressManual ? "manual" : "automatic", start_date: form.startDate, start_time: form.startTime, end_date: form.endDate, end_time: form.endTime }); }
function statusDot(status: TaskStatus) { return statusColor(status).replace("bg-primary", "bg-muted-foreground"); }
function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function capacityNumber(value: string) { return Number(String(value || "").replace(",", ".")); }
function missingCapacitySchema(error: any) { const code = String(error?.code || ""); const message = String(error?.message || "").toLocaleLowerCase("pt-BR"); return code === "42P01" || code === "PGRST205" || message.includes("planejamento_v2_capacity_"); }
function exactMinutes(task: TaskRow) {
  if (!task.start_date || !task.end_date) return 0;
  const start = new Date(`${task.start_date}T${fmtTime(task.start_time) === "—" ? "08:00" : fmtTime(task.start_time)}:00`);
  const end = new Date(`${task.end_date}T${fmtTime(task.end_time) === "—" ? "17:00" : fmtTime(task.end_time)}:00`);
  return Math.max(Math.round((end.getTime() - start.getTime()) / 60_000), 0);
}
function buildFlat(tasks: TaskRow[], collapsed: Set<string>) {
  const map = new Map<string | null, TaskRow[]>();
  tasks.forEach((task) => { const key = task.parent_task_id || null; map.set(key, [...(map.get(key) || []), task]); });
  map.forEach((rows) => rows.sort((a, b) => Number(a.position || 0) - Number(b.position || 0)));
  const result: FlatTask[] = [];
  const walk = (parent: string | null, depth: number) => (map.get(parent) || []).forEach((task) => { result.push({ task, depth }); if (!collapsed.has(task.id)) walk(task.id, depth + 1); });
  walk(null, 0); return result;
}

export default function PlanejamentoV2WorkspaceComplete() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { hasPermission, isAdmin } = useUserPermissions();
  const canEdit = isAdmin || hasPermission("planejamento_v2_edit") || hasPermission("planejamento_v2_admin");
  const key = ["planejamento-v2-complete", workspaceId];

  const [tab, setTab] = useState<TabId>("gantt");
  useEffect(() => {
    const requestedTab = searchParams.get("aba") as TabId | null;
    if (requestedTab && ["gantt", "board", "list", "calendar", "workload", "people", "dashboard"].includes(requestedTab)) setTab(requestedTab);
  }, [searchParams]);
  const [, setProgressClock] = useState(() => Date.now());
  useEffect(() => {
    const intervalId = window.setInterval(() => setProgressClock(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);
  const [taskDialog, setTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskForm>(EMPTY_TASK);
  const [memberDialog, setMemberDialog] = useState(false);
  const [memberForm, setMemberForm] = useState<MemberForm>(EMPTY_MEMBER);
  const [taskCapacityEnabled, setTaskCapacityEnabled] = useState(false);
  const [taskCapacitySchemaAvailable, setTaskCapacitySchemaAvailable] = useState<boolean | null>(null);
  const [taskProjectLabor, setTaskProjectLabor] = useState("");
  const [taskCrewSize, setTaskCrewSize] = useState("1");
  const [taskOutputPerShift, setTaskOutputPerShift] = useState("");
  const [taskReferenceHours, setTaskReferenceHours] = useState("8");
  const [taskMaxParallelTeams, setTaskMaxParallelTeams] = useState("1");
  const [taskCapacityLoading, setTaskCapacityLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [fieldsPanelOpen, setFieldsPanelOpen] = useState(false);
  const [fieldsPanelTab, setFieldsPanelTab] = useState<"standard" | "custom">("standard");
  const [visibleStandardFields, setVisibleStandardFields] = useState<Set<StandardFieldKey>>(new Set(DEFAULT_STANDARD_FIELDS));
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ name: 320 });
  const [visibleCustomFieldIds, setVisibleCustomFieldIds] = useState<Set<string>>(new Set());
  const [ganttPreferences, setGanttPreferences] = useState<Record<string, unknown>>({});
  const [preferenceUserId, setPreferenceUserId] = useState<string | null>(null);
  const [customFieldDialog, setCustomFieldDialog] = useState(false);
  const [customFieldName, setCustomFieldName] = useState("");
  const [customFieldType, setCustomFieldType] = useState<CustomFieldType>("text");
  const [customFieldOptions, setCustomFieldOptions] = useState("");
  const [showDependencies, setShowDependencies] = useState(true);
  const [dayWidth, setDayWidth] = useState(40);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [memberSearch, setMemberSearch] = useState("");
  const [dragPreview, setDragPreview] = useState<{ taskId: string; startIndex: number; duration: number } | null>(null);
  const [rowDragTaskId, setRowDragTaskId] = useState<string | null>(null);
  const [rowDropTarget, setRowDropTarget] = useState<{ taskId: string; edge: "before" | "after" } | null>(null);
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null);
  const ganttRef = useRef<HTMLDivElement | null>(null);
  const startColumnResize = (event: React.PointerEvent, key: string) => { event.preventDefault(); event.stopPropagation(); const origin = event.clientX; const initial = columnWidths[key] || (key === "name" ? 320 : 145); const move = (next: PointerEvent) => setColumnWidths((current) => ({ ...current, [key]: Math.max(key === "name" ? 180 : 90, Math.round(initial + next.clientX - origin)) })); const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.style.cursor = ""; }; document.body.style.cursor = "col-resize"; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up, { once: true }); };

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      if (!workspaceId) throw new Error("Planejamento não informado");
      const results = await Promise.all([
        sb.from("planejamento_v2_workspaces").select("*").eq("id", workspaceId).single(),
        sb.from("planejamento_v2_tasks").select("*").eq("workspace_id", workspaceId).order("position"),
        sb.from("settings").select("id, valor").eq("tipo", "processo").eq("ativo", true).order("ordem"),
        sb.from("profiles").select("id, full_name, email, avatar_url, ativo").eq("ativo", true).order("full_name"),
        sb.from("colaboradores_operacionais_v").select("id, nome, cargo, ativo").eq("ativo", true).order("nome"),
        sb.from("planejamento_v2_dependencies").select("*").eq("workspace_id", workspaceId),
        sb.from("planejamento_v2_project_members").select("*").eq("workspace_id", workspaceId).eq("active", true).order("display_name"),
        sb.from("planejamento_v2_task_assignments").select("*").eq("workspace_id", workspaceId),
        sb.from("planejamento_v2_custom_fields").select("*").eq("workspace_id", workspaceId).eq("active", true).order("position"),
        sb.from("planejamento_v2_task_custom_field_values").select("*").eq("workspace_id", workspaceId),
        sb.from("planejamento_v2_capacity_settings").select("enabled, max_concurrent_labor").eq("workspace_id", workspaceId).maybeSingle(),
        sb.from("planejamento_v2_process_capacities").select("process_setting_id, crew_size, active").eq("workspace_id", workspaceId).eq("active", true),
        sb.from("planejamento_v2_capacity_task_rules").select("task_id, enabled").eq("workspace_id", workspaceId).eq("enabled", true),
      ]);
      const failed = results.find((result: any) => result.error);
      if (failed?.error) throw failed.error;
      return {
        workspace: results[0].data as WorkspaceRow,
        tasks: (results[1].data || []) as TaskRow[], processes: (results[2].data || []) as ProcessRow[], profiles: (results[3].data || []) as ProfileRow[],
        collaborators: (results[4].data || []) as CollaboratorRow[], dependencies: (results[5].data || []) as DependencyRow[], members: (results[6].data || []) as MemberRow[], assignments: (results[7].data || []) as AssignmentRow[],
        customFields: (results[8].data || []) as CustomFieldRow[], customFieldValues: (results[9].data || []) as CustomFieldValueRow[],
        capacitySettings: (results[10].data || null) as CapacitySettingsRow | null,
        processCapacities: (results[11].data || []) as ProcessCapacityRow[],
        capacityTaskRules: (results[12].data || []) as CapacityTaskRuleRow[],
      };
    },
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });
  const data = query.data;

  const operationalProject = useMemo(
    () => data?.workspace?.app_project_setting_id
      ? {
          id: data.workspace.app_project_setting_id,
          name: data.workspace.project_name_snapshot,
        }
      : null,
    [data?.workspace?.app_project_setting_id, data?.workspace?.project_name_snapshot],
  );
  useRealtimeInvalidation([
    "project-production-targets",
    "project-production-target-logs",
    "project-production-target-ops",
  ]);
  const projectExecution = useProjectProductionTargets(operationalProject);

  const memberById = useMemo(() => new Map((data?.members || []).map((item) => [item.id, item])), [data?.members]);
  const profileById = useMemo(() => new Map((data?.profiles || []).map((item) => [item.id, item])), [data?.profiles]);
  const taskById = useMemo(() => new Map((data?.tasks || []).map((item) => [item.id, item])), [data?.tasks]);
  const assignmentByTask = useMemo(() => { const map = new Map<string, AssignmentRow>(); (data?.assignments || []).forEach((item) => { if (!map.has(item.task_id)) map.set(item.task_id, item); }); return map; }, [data?.assignments]);
  const assignmentCountByTask = useMemo(() => { const map = new Map<string, number>(); (data?.assignments || []).forEach((item) => map.set(item.task_id, (map.get(item.task_id) || 0) + 1)); return map; }, [data?.assignments]);
  const resourceOverloadByTask = useMemo(() => {
    const result = new Map<string, { required: number; available: number; deficit: number; dates: string[] }>();
    const settings = data?.capacitySettings;
    const available = Number(settings?.max_concurrent_labor || 0);
    if (!settings?.enabled || available <= 0) return result;
    const enabledRuleTasks = new Set((data?.capacityTaskRules || []).filter((rule) => rule.enabled).map((rule) => rule.task_id));
    const crewByProcess = new Map((data?.processCapacities || []).filter((capacity) => capacity.active).map((capacity) => [capacity.process_setting_id, Math.max(1, Number(capacity.crew_size || 1))]));
    const demandByDate = new Map<string, { taskId: string; crew: number }[]>();
    (data?.tasks || []).forEach((task) => {
      if (!task.start_date || task.task_type !== "task" || task.status === "completed" || task.status === "cancelled") return;
      const processCrew = task.source_process_setting_id && enabledRuleTasks.has(task.id) ? crewByProcess.get(task.source_process_setting_id) : null;
      const crew = processCrew || assignmentCountByTask.get(task.id) || 0;
      if (crew <= 0) return;
      const start = parseDate(task.start_date);
      const end = parseDate(task.end_date) || start;
      if (!start || !end) return;
      for (let day = start, guard = 0; day.getTime() <= end.getTime() && guard < 3660; day = addDays(day, 1), guard += 1) {
        const key = iso(day);
        const entries = demandByDate.get(key) || [];
        entries.push({ taskId: task.id, crew });
        demandByDate.set(key, entries);
      }
    });
    demandByDate.forEach((entries, date) => {
      const required = entries.reduce((sum, entry) => sum + entry.crew, 0);
      if (required <= available) return;
      entries.forEach((entry) => {
        const current = result.get(entry.taskId);
        const dates = current ? [...current.dates, date] : [date];
        result.set(entry.taskId, { required: Math.max(current?.required || 0, required), available, deficit: Math.max(current?.deficit || 0, required - available), dates });
      });
    });
    return result;
  }, [assignmentCountByTask, data?.capacitySettings, data?.capacityTaskRules, data?.processCapacities, data?.tasks]);
  const customValueByTaskField = useMemo(() => { const map = new Map<string, CustomFieldValueRow>(); (data?.customFieldValues || []).forEach((item) => map.set(`${item.task_id}:${item.field_id}`, item)); return map; }, [data?.customFieldValues]);
  const childCount = useMemo(() => { const map = new Map<string, number>(); (data?.tasks || []).forEach((task) => task.parent_task_id && map.set(task.parent_task_id, (map.get(task.parent_task_id) || 0) + 1)); return map; }, [data?.tasks]);
  const filteredTasks = useMemo(() => (data?.tasks || []).filter((task) => (statusFilter === "all" || task.status === statusFilter) && (!search.trim() || task.title.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")))), [data?.tasks, statusFilter, search]);
  const flatTasks = useMemo(() => buildFlat(filteredTasks, collapsed), [filteredTasks, collapsed]);

  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    void (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id || null;
      if (!active || !userId) return;
      setPreferenceUserId(userId);
      const { data: preference } = await sb.from("planejamento_v2_view_preferences").select("preferences").eq("user_id", userId).eq("workspace_id", workspaceId).eq("view_name", "gantt").maybeSingle();
      if (!active) return;
      const preferences = (preference?.preferences && typeof preference.preferences === "object" ? preference.preferences : {}) as Record<string, unknown>;
      setGanttPreferences(preferences);
      const standard = Array.isArray(preferences.visible_standard_fields) ? preferences.visible_standard_fields.filter((value: unknown) => STANDARD_FIELDS.some((field) => field.key === value)) as StandardFieldKey[] : DEFAULT_STANDARD_FIELDS;
      const custom = Array.isArray(preferences.visible_custom_field_ids) ? preferences.visible_custom_field_ids.filter((value: unknown) => typeof value === "string") as string[] : [];
      setVisibleStandardFields(new Set(standard));
      setVisibleCustomFieldIds(new Set(custom));
    })();
    return () => { active = false; };
  }, [workspaceId]);

  const persistFieldPreferences = async (standard: Set<StandardFieldKey>, custom: Set<string>) => {
    if (!workspaceId || !preferenceUserId) return;
    const preferences = { ...ganttPreferences, visible_standard_fields: Array.from(standard), visible_custom_field_ids: Array.from(custom) };
    setGanttPreferences(preferences);
    const { error } = await sb.from("planejamento_v2_view_preferences").upsert({ user_id: preferenceUserId, workspace_id: workspaceId, view_name: "gantt", preferences }, { onConflict: "user_id,workspace_id,view_name" });
    if (error) toast.error("Não foi possível salvar a preferência de campos");
  };

  const toggleStandardField = (key: StandardFieldKey) => {
    setVisibleStandardFields((current) => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); void persistFieldPreferences(next, visibleCustomFieldIds); return next; });
  };
  const toggleCustomField = (id: string) => {
    setVisibleCustomFieldIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); void persistFieldPreferences(visibleStandardFields, next); return next; });
  };

  const timeline = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dates = (data?.tasks || []).flatMap((task) => [parseDate(task.start_date), parseDate(task.end_date)]).filter((date): date is Date => Boolean(date));
    const min = dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : today;
    const max = dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : addDays(today, 30);
    const start = addDays(min, -4); const totalDays = Math.max(diffDays(start, addDays(max, 10)) + 1, 31);
    const days = Array.from({ length: totalDays }, (_, index) => addDays(start, index));
    const months: { label: string; span: number }[] = [];
    days.forEach((day) => { const label = monthLabel(day); const last = months[months.length - 1]; if (!last || last.label !== label) months.push({ label, span: 1 }); else last.span += 1; });
    return { start, totalDays, days, months, todayIndex: diffDays(start, today) };
  }, [data?.tasks]);

  const resetTaskCapacity = () => {
    setTaskCapacityEnabled(false); setTaskCrewSize("1"); setTaskOutputPerShift(""); setTaskReferenceHours("8"); setTaskMaxParallelTeams("1");
  };
  const loadTaskCapacity = async (taskId: string | null, processId: string) => {
    if (!workspaceId) return;
    setTaskCapacityLoading(true);
    const settingResult = await sb.from("planejamento_v2_capacity_settings").select("max_concurrent_labor").eq("workspace_id", workspaceId).maybeSingle();
    if (settingResult.error) {
      setTaskCapacityLoading(false);
      if (missingCapacitySchema(settingResult.error)) { setTaskCapacitySchemaAvailable(false); resetTaskCapacity(); return; }
      setTaskCapacitySchemaAvailable(false); resetTaskCapacity(); return;
    }
    setTaskCapacitySchemaAvailable(true);
    setTaskProjectLabor(settingResult.data?.max_concurrent_labor ? String(settingResult.data.max_concurrent_labor) : "");
    if (!processId) { setTaskCapacityLoading(false); resetTaskCapacity(); return; }
    const [processResult, ruleResult] = await Promise.all([
      sb.from("planejamento_v2_process_capacities").select("unit, crew_size, output_per_shift, reference_hours, max_parallel_teams").eq("workspace_id", workspaceId).eq("process_setting_id", processId).eq("active", true).maybeSingle(),
      taskId ? sb.from("planejamento_v2_capacity_task_rules").select("enabled").eq("workspace_id", workspaceId).eq("task_id", taskId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    setTaskCapacityLoading(false);
    if (processResult.error) { resetTaskCapacity(); return; }
    if (processResult.data) {
      setTaskCrewSize(String(processResult.data.crew_size || 1));
      setTaskOutputPerShift(String(processResult.data.output_per_shift || ""));
      setTaskReferenceHours(String(processResult.data.reference_hours || 8));
      setTaskMaxParallelTeams(String(processResult.data.max_parallel_teams || 1));
    } else {
      setTaskCrewSize("1"); setTaskOutputPerShift(""); setTaskReferenceHours("8"); setTaskMaxParallelTeams("1");
    }
    setTaskCapacityEnabled(Boolean(taskId && ruleResult.data?.enabled && processResult.data));
  };

  const saveTask = useMutation({
    mutationFn: async (form: TaskForm) => {
      if (!workspaceId || !data) throw new Error("Planejamento não informado");
      const process = data.processes.find((item) => item.id === form.processId);
      const title = form.origin === "process" ? process?.valor?.trim() || "" : form.title.trim();
      if (!title) throw new Error("Informe o nome da atividade ou selecione um processo");
      const capacityManaged = taskCapacityEnabled && form.origin === "process" && form.taskType === "task";
      if (capacityManaged) {
        if (taskCapacitySchemaAvailable !== true) throw new Error("A estrutura de capacidade produtiva ainda não está disponível no banco");
        if (!form.startDate || !form.startTime) throw new Error("Informe o início mínimo da etapa");
        if (capacityNumber(form.quantity) <= 0) throw new Error("Informe a quantidade planejada da etapa");
        if (!form.unit.trim()) throw new Error("Informe a unidade da produção");
        if (capacityNumber(taskProjectLabor) < 1) throw new Error("Configure primeiro o máximo de pessoas nas configurações do projeto");
        if (capacityNumber(taskCrewSize) < 1 || capacityNumber(taskCrewSize) > capacityNumber(taskProjectLabor)) throw new Error("A equipe desta etapa deve caber na mão de obra disponível do projeto");
        if (capacityNumber(taskOutputPerShift) <= 0) throw new Error("Informe a produção por jornada");
        if (capacityNumber(taskReferenceHours) <= 0 || capacityNumber(taskReferenceHours) > 24) throw new Error("Informe uma jornada de referência válida");
        if (capacityNumber(taskMaxParallelTeams) < 1) throw new Error("Informe ao menos uma máquina/equipe simultânea");
      } else {
        if ((form.startDate && !form.endDate) || (!form.startDate && form.endDate)) throw new Error("Informe início e término completos");
        if (form.startDate && form.endDate && new Date(`${form.endDate}T${form.endTime}:00`) < new Date(`${form.startDate}T${form.startTime}:00`)) throw new Error("O término não pode ser anterior ao início");
      }
      const member = form.memberId === "unassigned" ? null : memberById.get(form.memberId);
      const enteredProgress = clamp(Number(String(form.progress || "0").replace(",", ".")) || 0, 0, 100);
      const normalizedProgress = form.status === "completed" || form.status === "cancelled"
        ? 100
        : form.status === "not_started"
          ? 0
          : form.status === "in_progress"
            ? Math.min(enteredProgress, 99)
            : enteredProgress;
      const normalizedBarColor = /^#[0-9a-f]{6}$/i.test(form.barColor) ? form.barColor : null;
      const progressMode = form.progressManual ? "manual" : "automatic";
      const payload: Record<string, unknown> = {
        workspace_id: workspaceId, parent_task_id: form.parentTaskId === "root" ? null : form.parentTaskId,
        source_process_setting_id: form.origin === "process" ? process?.id || null : null, source_process_name_snapshot: form.origin === "process" ? process?.valor || null : null,
        title, description: form.description.trim() || null, task_type: form.taskType, status: form.status, priority: form.priority, progress: normalizedProgress, progress_mode: progressMode, bar_color: normalizedBarColor,
        start_date: form.startDate || null, start_time: form.startDate ? form.startTime : null,
        end_date: capacityManaged ? form.startDate || null : form.taskType === "milestone" ? form.startDate || null : form.endDate || null, end_time: capacityManaged ? form.startTime : form.taskType === "milestone" ? form.startTime : form.endDate ? form.endTime : null,
        duration_days: capacityManaged ? (form.startDate ? 1 : null) : form.startDate && (form.taskType === "milestone" || form.endDate) ? (form.taskType === "milestone" ? 0 : diffDays(parseDate(form.startDate)!, parseDate(form.endDate)!) + 1) : null,
        responsible_id: member?.profile_id || null, quantity: form.quantity ? Number(form.quantity.replace(",", ".")) : null, unit: form.unit.trim() || null,
        budget: form.budget ? Number(form.budget.replace(",", ".")) : 0,
      };
      let taskId = form.id;
      if (form.id) {
        const { error } = await sb.from("planejamento_v2_tasks").update(payload).eq("id", form.id); if (error) throw error;
      } else {
        payload.position = Math.max(0, ...data.tasks.map((item) => Number(item.position || 0))) + 1000;
        const { data: created, error } = await sb.from("planejamento_v2_tasks").insert(payload).select("id").single(); if (error) throw error; taskId = String(created.id);
      }
      if (!taskId) return;
      const { error: deleteError } = await sb.from("planejamento_v2_task_assignments").delete().eq("task_id", taskId); if (deleteError) throw deleteError;
      if (member) {
        const minutes = form.allocatedHours ? Math.max(Math.round(Number(form.allocatedHours.replace(",", ".")) * 60), 0) : 0;
        const { error } = await sb.from("planejamento_v2_task_assignments").insert({ workspace_id: workspaceId, task_id: taskId, member_id: member.id, allocated_minutes: minutes }); if (error) throw error;
      }
      if (capacityManaged && process?.id) {
        const { error: settingError } = await sb.from("planejamento_v2_capacity_settings").update({ enabled: true }).eq("workspace_id", workspaceId); if (settingError) throw settingError;
        const { error: processError } = await sb.from("planejamento_v2_process_capacities").upsert({ workspace_id: workspaceId, process_setting_id: process.id, unit: form.unit.trim(), crew_size: Math.round(capacityNumber(taskCrewSize)), output_per_shift: capacityNumber(taskOutputPerShift), reference_hours: capacityNumber(taskReferenceHours), max_parallel_teams: Math.round(capacityNumber(taskMaxParallelTeams)), active: true }, { onConflict: "workspace_id,process_setting_id" }); if (processError) throw processError;
        const { error: ruleError } = await sb.from("planejamento_v2_capacity_task_rules").upsert({ task_id: taskId, workspace_id: workspaceId, enabled: true, not_before_date: form.startDate, not_before_time: form.startTime }, { onConflict: "task_id" }); if (ruleError) throw ruleError;
        await recalculatePlanejamentoV2Capacity(sb, workspaceId);
      } else if (form.id) {
        const { error: ruleError } = await sb.from("planejamento_v2_capacity_task_rules").delete().eq("workspace_id", workspaceId).eq("task_id", taskId);
        if (ruleError && !missingCapacitySchema(ruleError)) throw ruleError;
        if (!ruleError) await recalculatePlanejamentoV2Capacity(sb, workspaceId);
      }
    },
    onSuccess: async () => { await invalidate(); setTaskDialog(false); setTaskForm(EMPTY_TASK); resetTaskCapacity(); toast.success("Atividade salva"); },
    onError: (error: any) => toast.error(String(error?.message || "Não foi possível salvar a atividade")),
  });

  const saveMember = useMutation({
    mutationFn: async (form: MemberForm) => {
      if (!workspaceId || !data) return;
      const profile = data.profiles.find((item) => item.id === form.profileId);
      const collaborator = data.collaborators.find((item) => item.id === form.collaboratorId);
      const displayName = form.source === "user" ? profile?.full_name : form.source === "production" ? collaborator?.nome : form.name.trim();
      if (!displayName) throw new Error("Informe ou selecione uma pessoa");
      const payload = {
        workspace_id: workspaceId, profile_id: form.source === "user" ? profile?.id || null : null, colaborador_id: form.source === "production" ? collaborator?.id || null : null,
        display_name: displayName, email: form.source === "user" ? profile?.email || null : form.email.trim() || null,
        member_type: form.source, project_role: form.source === "resource" ? "resource" : form.role,
        capacity_hours_per_day: Math.max(Number(form.capacity.replace(",", ".")) || 8, 0.25), active: true,
      };
      const { error } = await sb.from("planejamento_v2_project_members").insert(payload); if (error) throw error;
    },
    onSuccess: async () => { await invalidate(); setMemberDialog(false); setMemberForm(EMPTY_MEMBER); toast.success("Pessoa adicionada ao projeto"); },
    onError: (error: any) => toast.error(String(error?.message || "Não foi possível adicionar a pessoa")),
  });

  const createCustomField = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Planejamento não informado");
      const name = customFieldName.trim();
      if (!name) throw new Error("Informe o nome do campo");
      const options = customFieldType === "select" ? customFieldOptions.split(",").map((item) => item.trim()).filter(Boolean) : [];
      if (customFieldType === "select" && options.length === 0) throw new Error("Informe pelo menos uma opção");
      const position = Math.max(0, ...(data?.customFields || []).map((field) => Number(field.position || 0))) + 1000;
      const { data: created, error } = await sb.from("planejamento_v2_custom_fields").insert({ workspace_id: workspaceId, name, field_type: customFieldType, options, position, active: true, created_by: preferenceUserId }).select("id").single();
      if (error) throw error;
      return created.id as string;
    },
    onSuccess: async (id: string) => {
      const next = new Set(visibleCustomFieldIds); next.add(id); setVisibleCustomFieldIds(next); await persistFieldPreferences(visibleStandardFields, next);
      await invalidate(); setCustomFieldDialog(false); setCustomFieldName(""); setCustomFieldType("text"); setCustomFieldOptions(""); toast.success("Campo personalizado criado");
    },
    onError: (error: any) => toast.error(String(error?.message || "Não foi possível criar o campo")),
  });

  const removeCustomField = async (field: CustomFieldRow) => {
    const { error } = await sb.from("planejamento_v2_custom_fields").update({ active: false }).eq("id", field.id);
    if (error) { toast.error(error.message); return; }
    const next = new Set(visibleCustomFieldIds); next.delete(field.id); setVisibleCustomFieldIds(next); await persistFieldPreferences(visibleStandardFields, next); await invalidate(); toast.success("Campo personalizado removido");
  };

  const saveCustomFieldValue = async (taskId: string, fieldId: string, value: unknown) => {
    if (!workspaceId) return;
    const { error } = await sb.from("planejamento_v2_task_custom_field_values").upsert({ workspace_id: workspaceId, task_id: taskId, field_id: fieldId, value, updated_by: preferenceUserId }, { onConflict: "task_id,field_id" });
    if (error) toast.error(error.message); else void invalidate();
  };

  const updateTask = async (taskId: string, changes: Record<string, unknown>) => { const { error } = await sb.from("planejamento_v2_tasks").update(changes).eq("id", taskId); if (error) toast.error(error.message); else void invalidate(); };
  const openCreate = (taskType: TaskType = "task", parentTaskId = "root", status: TaskStatus = "not_started") => { resetTaskCapacity(); setTaskForm({ ...EMPTY_TASK, taskType, parentTaskId, status }); setTaskDialog(true); void loadTaskCapacity(null, ""); };
  const openEdit = (task: TaskRow) => {
    const assignment = assignmentByTask.get(task.id);
    setTaskForm({ id: task.id, origin: task.source_process_setting_id ? "process" : "custom", processId: task.source_process_setting_id || "", title: task.source_process_setting_id ? "" : task.title,
      taskType: task.task_type, parentTaskId: task.parent_task_id || "root", startDate: task.start_date || "", startTime: fmtTime(task.start_time) === "—" ? "08:00" : fmtTime(task.start_time),
      endDate: task.end_date || "", endTime: fmtTime(task.end_time) === "—" ? "17:45" : fmtTime(task.end_time), memberId: assignment?.member_id || "unassigned", allocatedHours: assignment?.allocated_minutes ? String(assignment.allocated_minutes / 60) : "",
      status: task.status, priority: task.priority, progress: String(task.progress ?? 0), progressManual: task.progress_mode === "manual", barColor: task.bar_color || "", quantity: task.quantity == null ? "" : String(task.quantity), unit: task.unit || "", budget: task.budget ? String(task.budget) : "", description: task.description || "" });
    setTaskDialog(true);
    void loadTaskCapacity(task.id, task.source_process_setting_id || "");
  };
  const exportTasks = () => {
    if (!data) return;
    const rows = [["Tarefa", "Atribuído", "Estado", "Início", "Hora inicial", "Término", "Hora final", "Orçamento"], ...flatTasks.map(({ task }) => {
      const assignment = assignmentByTask.get(task.id); const member = assignment ? memberById.get(assignment.member_id) : null;
      return [task.title, member?.display_name || "não atribuído", STATUS_LABELS[task.status], task.start_date || "", fmtTime(task.start_time), task.end_date || "", fmtTime(task.end_time), task.budget || 0];
    })];
    const url = URL.createObjectURL(new Blob(["\ufeff", rows.map((row) => row.map(csvCell).join(";")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${data.workspace.project_name_snapshot}-planejamento.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const reorderTask = async (draggedTaskId: string, targetTaskId: string, edge: "before" | "after") => {
    if (!data || draggedTaskId === targetTaskId) return;
    const dragged = taskById.get(draggedTaskId);
    const target = taskById.get(targetTaskId);
    if (!dragged || !target) return;
    const draggedParent = dragged.parent_task_id || null;
    const targetParent = target.parent_task_id || null;
    if (draggedParent !== targetParent) {
      toast.error("Para preservar a hierarquia, mova a atividade entre tarefas do mesmo nível.");
      return;
    }
    const siblings = data.tasks
      .filter((task) => (task.parent_task_id || null) === draggedParent)
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
    const withoutDragged = siblings.filter((task) => task.id !== draggedTaskId);
    const targetIndex = withoutDragged.findIndex((task) => task.id === targetTaskId);
    if (targetIndex < 0) return;
    const insertIndex = edge === "after" ? targetIndex + 1 : targetIndex;
    withoutDragged.splice(insertIndex, 0, dragged);
    const updates = withoutDragged.map((task, index) => sb.from("planejamento_v2_tasks").update({ position: (index + 1) * 1000 }).eq("id", task.id));
    const results = await Promise.all(updates);
    const failed = results.find((result: any) => result.error);
    if (failed?.error) throw failed.error;
    await invalidate();
    toast.success("Ordem das atividades atualizada");
  };

  const beginRowDrag = (event: React.DragEvent<HTMLDivElement>, taskId: string) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [contenteditable='true'], [role='checkbox'], [role='combobox'], [data-row-drag-disabled='true']")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
    setRowDragTaskId(taskId);
  };

  const finishRowDrag = () => {
    setRowDragTaskId(null);
    setRowDropTarget(null);
  };

  const moveTask = (task: TaskRow, nextStartIndex: number) => { const duration = durationDays(task); const start = addDays(timeline.start, nextStartIndex); const end = task.task_type === "milestone" ? start : addDays(start, duration - 1); void updateTask(task.id, { start_date: iso(start), end_date: iso(end), duration_days: task.task_type === "milestone" ? 0 : duration }); };
  const resizeTask = (task: TaskRow, side: "start" | "end", index: number) => { const currentStart = parseDate(task.start_date) || addDays(timeline.start, index); const currentEnd = parseDate(task.end_date) || currentStart; const next = addDays(timeline.start, index); const start = side === "start" ? new Date(Math.min(next.getTime(), currentEnd.getTime())) : currentStart; const end = side === "end" ? new Date(Math.max(next.getTime(), currentStart.getTime())) : currentEnd; void updateTask(task.id, { start_date: iso(start), end_date: iso(end), duration_days: diffDays(start, end) + 1 }); };
  const startBarDrag = (event: React.PointerEvent<HTMLDivElement>, task: TaskRow) => {
    if (!canEdit || task.task_type === "summary") return; event.preventDefault(); event.stopPropagation();
    const initial = task.start_date ? clamp(diffDays(timeline.start, parseDate(task.start_date)!), 0, timeline.totalDays - 1) : 0; const duration = durationDays(task); const originX = event.clientX; let finalIndex = initial; let moved = false;
    setDragPreview({ taskId: task.id, startIndex: initial, duration });
    const move = (e: PointerEvent) => { if (Math.abs(e.clientX - originX) > 3) moved = true; finalIndex = clamp(initial + Math.round((e.clientX - originX) / dayWidth), 0, Math.max(timeline.totalDays - duration, 0)); setDragPreview({ taskId: task.id, startIndex: finalIndex, duration }); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); setDragPreview(null); if (moved) moveTask(task, finalIndex); else openEdit(task); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up, { once: true });
  };
  const startResize = (event: React.PointerEvent<HTMLButtonElement>, task: TaskRow, side: "start" | "end") => {
    event.preventDefault(); event.stopPropagation(); const date = parseDate(side === "start" ? task.start_date : task.end_date) || timeline.start; const initial = diffDays(timeline.start, date); const originX = event.clientX; let finalIndex = initial;
    const move = (e: PointerEvent) => { finalIndex = clamp(initial + Math.round((e.clientX - originX) / dayWidth), 0, timeline.totalDays - 1); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); resizeTask(task, side, finalIndex); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up, { once: true });
  };
  const startLink = (event: React.PointerEvent<HTMLButtonElement>, task: TaskRow, rowIndex: number) => {
    if (!canEdit || !task.start_date || !ganttRef.current) return; event.preventDefault(); event.stopPropagation(); const rect = ganttRef.current.getBoundingClientRect();
    const startX = (diffDays(timeline.start, parseDate(task.start_date)!) + durationDays(task)) * dayWidth; const startY = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2; setLinkDraft({ sourceTaskId: task.id, startX, startY, currentX: startX, currentY: startY });
    const move = (e: PointerEvent) => setLinkDraft((current) => current ? { ...current, currentX: e.clientX - rect.left + ganttRef.current!.scrollLeft, currentY: e.clientY - rect.top + ganttRef.current!.scrollTop } : null);
    const up = async (e: PointerEvent) => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-link-target]")?.dataset.linkTarget; setLinkDraft(null); if (!target || target === task.id || !workspaceId) return; const { error } = await sb.rpc("create_planejamento_v2_fs_dependency", { _workspace_id: workspaceId, _predecessor_task_id: task.id, _successor_task_id: target }); if (error) toast.error(error.message); else void invalidate(); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up, { once: true });
  };

  const planningReportLabels: Record<TabId, string> = {
    gantt: "Cronograma Gantt",
    board: "Quadro de Atividades",
    list: "Lista de Atividades",
    calendar: "Calendário do Projeto",
    workload: "Carga de Trabalho",
    people: "Equipe do Projeto",
    dashboard: "Indicadores do Projeto",
  };

  const toggleSelectAll = () => {
    const allIds = (data?.tasks || []).map((task) => task.id);
    setSelected((current) => current.size === allIds.length ? new Set() : new Set(allIds));
  };

  const selectedSummaryIds = () => {
    const tasks = data?.tasks || [];
    const children = new Map<string, string[]>();
    tasks.forEach((task) => {
      if (!task.parent_task_id) return;
      children.set(task.parent_task_id, [...(children.get(task.parent_task_id) || []), task.id]);
    });
    const expandable = new Set<string>();
    const visit = (taskId: string) => {
      if (children.has(taskId)) expandable.add(taskId);
      (children.get(taskId) || []).forEach(visit);
    };
    selected.forEach(visit);
    return expandable;
  };

  const expandSelected = () => {
    const expandable = selectedSummaryIds();
    if (!expandable.size) {
      toast.info("Selecione uma tarefa-resumo para expandir");
      return;
    }
    setCollapsed((current) => {
      const next = new Set(current);
      expandable.forEach((taskId) => next.delete(taskId));
      return next;
    });
  };

  const collapseSelected = () => {
    const expandable = selectedSummaryIds();
    if (!expandable.size) {
      toast.info("Selecione uma tarefa-resumo para recolher");
      return;
    }
    setCollapsed((current) => new Set([...current, ...expandable]));
  };

  const toolbar = (includeZoom = false) => <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2" data-pdf-hide>
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" size="icon" title={selected.size === (data?.tasks || []).length ? "Limpar seleção" : "Selecionar todas"} onClick={toggleSelectAll}><CheckSquare className="h-4 w-4" /></Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="gap-2"><Plus className="h-4 w-4" />Adicionar<ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onClick={() => openCreate("task")}><Plus className="mr-2 h-4 w-4" />Adicionar tarefa</DropdownMenuItem><DropdownMenuItem onClick={() => openCreate("summary")}><Folder className="mr-2 h-4 w-4" />Adicionar tarefa-resumo</DropdownMenuItem><DropdownMenuItem onClick={() => openCreate("milestone")}><Milestone className="mr-2 h-4 w-4" />Adicionar marco</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      {includeZoom && <><Button variant="ghost" size="sm" className="gap-2" onClick={expandSelected}><ChevronsUpDown className="h-4 w-4" />Expandir</Button><Button variant="ghost" size="sm" className="gap-2" onClick={collapseSelected}><ChevronsDownUp className="h-4 w-4" />Recolher</Button></>}
    </div>
    <div className="flex flex-wrap items-center gap-1">
      <div className="relative"><Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="h-9 w-44 pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarefa..." /></div>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="gap-2"><Filter className="h-4 w-4" />Filtro</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setStatusFilter("all")}>Todos</DropdownMenuItem>{STATUS_ORDER.map((status) => <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)}>{STATUS_LABELS[status]}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
      {includeZoom && <><Button variant="ghost" size="sm" className="gap-2" onClick={() => setFieldsPanelOpen(true)}><Columns3 className="h-4 w-4" />Campos</Button><div className="flex items-center gap-2 px-2 text-xs"><input type="range" min={26} max={72} value={dayWidth} onChange={(e) => setDayWidth(Number(e.target.value))} /><span>Dias</span></div><Button variant="ghost" size="sm" className="gap-2" onClick={() => setShowDependencies((v) => !v)}><Link2 className="h-4 w-4" />Vínculos</Button></>}
      <ReportPdfButton
        reportName={`${planningReportLabels[tab]} — ${data?.workspace.project_name_snapshot || "Projeto"}`}
        targetId="planejamento-v2-active-report"
        filtersSummary={[`Projeto: ${data?.workspace.project_name_snapshot || "Não informado"}`, search ? `Busca: ${search}` : "", statusFilter !== "all" ? `Estado: ${STATUS_LABELS[statusFilter]}` : "", `${flatTasks.length} atividade(s)`].filter(Boolean).join("  ·  ")}
        pageFormat={tab === "gantt" ? "a3" : "a4"}
        orientation="landscape"
        disabled={!flatTasks.length}
      />
      <Button variant="ghost" size="sm" className="gap-2" onClick={exportTasks}><Download className="h-4 w-4" />Exportar</Button>
    </div>
  </div>;

  const renderStandardFieldCell = (task: TaskRow, key: StandardFieldKey) => {
    const assignment = assignmentByTask.get(task.id);
    const member = assignment ? memberById.get(assignment.member_id) : null;
    if (key === "assignee") return <span className="truncate text-muted-foreground">{member?.display_name || "não atribuído"}</span>;
    if (key === "progress") return <span className="font-medium">{effectiveTaskProgress(task)}%</span>;
    if (key === "status") return <span className="flex min-w-0 items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(task.status)}`} /><span className="truncate">{STATUS_LABELS[task.status]}</span>{taskIsOverdue(task) && <span className="ml-auto text-[10px] font-semibold text-red-600">ATRASADA</span>}</span>;
    if (key === "priority") return task.priority === "high" ? "Alta" : task.priority === "low" ? "Baixa" : "Média";
    if (key === "startDate") return fmtDate(task.start_date);
    if (key === "startTime") return fmtTime(task.start_time);
    if (key === "endDate") return fmtDate(task.end_date);
    if (key === "endTime") return fmtTime(task.end_time);
    if (key === "executionTime") { const minutes = exactMinutes(task); return minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}min` : "—"; }
    if (key === "quantity") return task.quantity ?? "—";
    if (key === "unit") return task.unit || "—";
    if (key === "budget") return task.budget == null ? "—" : Number(task.budget).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (key === "barColor") return <span className="flex items-center gap-2"><span className="h-4 w-4 rounded border" style={{ backgroundColor: taskBarColor(task) }} />{taskBarColor(task)}</span>;
    if (key === "plannedLoad") return assignment ? `${Math.round((Number(assignment.allocated_minutes || 0) / 60) * 10) / 10} h` : "—";
    if (key === "predecessors") {
      const titles = (data?.dependencies || []).filter((dependency) => dependency.successor_task_id === task.id).map((dependency) => taskById.get(dependency.predecessor_task_id)?.title).filter(Boolean);
      return titles.length ? titles.join(", ") : "—";
    }
    return "—";
  };

  const renderCustomFieldCell = (task: TaskRow, field: CustomFieldRow) => {
    const value = customValueByTaskField.get(`${task.id}:${field.id}`)?.value;
    const common = "h-8 w-full border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-1";
    if (!canEdit) return <span className="truncate">{field.field_type === "boolean" ? (value ? "Sim" : "Não") : value == null || value === "" ? "—" : String(value)}</span>;
    if (field.field_type === "boolean") return <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => void saveCustomFieldValue(task.id, field.id, checked === true)} />;
    if (field.field_type === "select") {
      const options = Array.isArray(field.options) ? field.options.map(String) : [];
      return <Select value={value == null ? "" : String(value)} onValueChange={(next) => void saveCustomFieldValue(task.id, field.id, next)}><SelectTrigger className={common}><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>;
    }
    return <Input className={common} type={field.field_type === "date" ? "date" : field.field_type === "number" || field.field_type === "currency" ? "number" : "text"} defaultValue={value == null ? "" : String(value)} onBlur={(event) => { const raw = event.currentTarget.value; const next = field.field_type === "number" || field.field_type === "currency" ? (raw === "" ? null : Number(raw)) : raw; if (next !== value) void saveCustomFieldValue(task.id, field.id, next); }} />;
  };

  const renderGantt = () => {
    const showResourceOverload = visibleStandardFields.has("plannedLoad");
    const activeStandardFields = STANDARD_FIELDS.filter((field) => field.key !== "plannedLoad" && visibleStandardFields.has(field.key));
    const activeCustomFields = (data?.customFields || []).filter((field) => field.active && visibleCustomFieldIds.has(field.id));
    const tableGridTemplate = [`${columnWidths.name || 320}px`, ...activeStandardFields.map((field) => `${columnWidths[field.key] || 145}px`), ...activeCustomFields.map((field) => `${columnWidths[`custom:${field.id}`] || 145}px`), "34px"].join(" ");
    const tableWidth = (columnWidths.name || 320) + activeStandardFields.reduce((sum, field) => sum + (columnWidths[field.key] || 145), 0) + activeCustomFields.reduce((sum, field) => sum + (columnWidths[`custom:${field.id}`] || 145), 0) + 34; const timelineWidth = timeline.totalDays * dayWidth; const bodyHeight = Math.max(flatTasks.length * ROW_HEIGHT + (canEdit ? ROW_HEIGHT : 0), ROW_HEIGHT);
    return <div className="flex min-h-[650px] flex-col overflow-hidden rounded-lg border bg-background">{toolbar(true)}
      <div className="flex border-b"><div className="shrink-0 border-r" style={{ width: tableWidth }}><div className="grid h-[76px] items-end text-sm font-medium" style={{ gridTemplateColumns: tableGridTemplate }}><div className="relative flex h-full items-end px-3 pb-3">Nome da tarefa<button type="button" aria-label="Redimensionar Nome da tarefa" className="absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize border-0 bg-transparent hover:bg-primary/30" onPointerDown={(event) => startColumnResize(event, "name")} /></div>{activeStandardFields.map((field) => <div key={field.key} className="relative flex h-full items-end truncate border-l px-3 pb-3" title={field.label}>{field.label}<button type="button" aria-label={`Redimensionar ${field.label}`} className="absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize border-0 bg-transparent hover:bg-primary/30" onPointerDown={(event) => startColumnResize(event, field.key)} /></div>)}{activeCustomFields.map((field) => <div key={field.id} className="relative flex h-full items-end truncate border-l px-3 pb-3" title={field.name}>{field.name}<button type="button" aria-label={`Redimensionar ${field.name}`} className="absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize border-0 bg-transparent hover:bg-primary/30" onPointerDown={(event) => startColumnResize(event, `custom:${field.id}`)} /></div>)}<button type="button" className="border-l px-2 pb-3 text-center text-lg hover:text-primary" title="Mostrar ou ocultar campos" onClick={() => setFieldsPanelOpen(true)}>+</button></div></div>
        <div className="min-w-0 flex-1 overflow-hidden"><div style={{ width: timelineWidth }}><div className="flex h-[30px] border-b bg-muted/10">{timeline.months.map((month, i) => <div key={`${month.label}-${i}`} className="border-r text-center text-xs leading-[30px]" style={{ width: month.span * dayWidth }}>{month.label}</div>)}</div><div className="flex h-[46px]">{timeline.days.map((day) => <div key={day.toISOString()} className={`border-r text-center text-xs ${day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/30" : ""}`} style={{ width: dayWidth }}><div className="pt-1 text-sm font-medium">{String(day.getDate()).padStart(2, "0")}</div><div className="text-muted-foreground">{weekday(day)}</div></div>)}</div></div></div>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden"><div className="shrink-0 overflow-hidden border-r" style={{ width: tableWidth }}><div style={{ height: bodyHeight }}>{flatTasks.map(({ task, depth }) => { const hasChildren = childCount.has(task.id); return <div key={task.id} draggable={canEdit} className={`relative grid items-center border-b text-sm hover:bg-muted/30 ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${selected.has(task.id) ? "bg-primary/5" : ""} ${rowDragTaskId === task.id ? "opacity-50" : ""}`} style={{ height: ROW_HEIGHT, gridTemplateColumns: tableGridTemplate }} onDragStart={(event) => beginRowDrag(event, task.id)} onDragEnd={finishRowDrag} onDragOver={(event) => { if (!rowDragTaskId || rowDragTaskId === task.id) return; event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); setRowDropTarget({ taskId: task.id, edge: event.clientY < rect.top + rect.height / 2 ? "before" : "after" }); }} onDrop={(event) => { event.preventDefault(); if (rowDragTaskId && rowDropTarget?.taskId === task.id) void reorderTask(rowDragTaskId, task.id, rowDropTarget.edge).catch((error) => toast.error(String(error?.message || "Não foi possível reordenar as atividades"))).finally(finishRowDrag); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setRowDropTarget((current) => current?.taskId === task.id ? null : current); }}>{rowDropTarget?.taskId === task.id && <span className={`pointer-events-none absolute left-0 right-0 z-50 h-0.5 bg-primary ${rowDropTarget.edge === "before" ? "top-0" : "bottom-0"}`} />}<div className="flex min-w-0 items-center gap-1 px-2" style={{ paddingLeft: 8 + depth * 22 }}><span className="pointer-events-none text-muted-foreground" title="Clique e arraste a linha para reordenar"><GripVertical className="h-4 w-4" /></span><Checkbox data-row-drag-disabled="true" checked={selected.has(task.id)} onCheckedChange={(value) => setSelected((current) => { const next = new Set(current); value ? next.add(task.id) : next.delete(task.id); return next; })} />{hasChildren ? <button data-row-drag-disabled="true" onClick={() => setCollapsed((current) => { const next = new Set(current); next.has(task.id) ? next.delete(task.id) : next.add(task.id); return next; })}>{collapsed.has(task.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button> : <span className="w-4" />}<button className={`min-w-0 truncate text-left ${task.task_type === "summary" ? "font-semibold" : ""}`} onClick={() => openEdit(task)}>{task.title}</button>{showResourceOverload && resourceOverloadByTask.has(task.id) && (() => { const overload = resourceOverloadByTask.get(task.id)!; const shownDates = overload.dates.slice(0, 3).map((date) => fmtDate(date)).join(", "); const moreDates = overload.dates.length > 3 ? ` e mais ${overload.dates.length - 3} dia(s)` : ""; return <span className="ml-1 inline-flex shrink-0 items-center text-red-600" title={`Sobrecarga de equipe: necessárias ${overload.required} pessoas; disponíveis ${overload.available}; déficit de ${overload.deficit}. Dias: ${shownDates}${moreDates}.`} aria-label="Sobrecarga de equipe"><UserRoundX className="h-[17px] w-[17px]" /></span>; })()}</div>{activeStandardFields.map((field) => <div key={field.key} className="min-w-0 truncate border-l px-3">{renderStandardFieldCell(task, field.key)}</div>)}{activeCustomFields.map((field) => <div key={field.id} className="min-w-0 border-l px-1">{renderCustomFieldCell(task, field)}</div>)}<DropdownMenu><DropdownMenuTrigger asChild><Button data-row-drag-disabled="true" variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => openEdit(task)}>Editar</DropdownMenuItem><DropdownMenuItem onClick={() => openCreate("task", task.id)}>Adicionar subtarefa</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={async () => { const { error } = await sb.from("planejamento_v2_tasks").delete().eq("id", task.id); error ? toast.error(error.message) : void invalidate(); }}>Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>; })}{canEdit && <div className="flex h-11 items-center gap-4 border-b px-10 text-sm text-primary"><button onClick={() => openCreate("task")}>⊕ Adicionar uma tarefa</button><button onClick={() => openCreate("milestone")}>Adicionar um marco</button></div>}</div></div>
        <div ref={ganttRef} className="relative min-w-0 flex-1 overflow-auto"><div className="relative" style={{ width: timelineWidth, height: bodyHeight }}>{timeline.days.map((day, i) => <div key={day.toISOString()} className={`absolute bottom-0 top-0 border-r ${day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/20" : ""}`} style={{ left: i * dayWidth, width: dayWidth }} />)}{timeline.todayIndex >= 0 && timeline.todayIndex < timeline.totalDays && <div className="absolute bottom-0 top-0 z-20 w-px bg-red-500" style={{ left: timeline.todayIndex * dayWidth + dayWidth / 2 }}><span className="absolute -top-5 -translate-x-1/2 rounded bg-red-500 px-1.5 py-0.5 text-[10px] text-white">Hoje</span></div>}
          {showDependencies && <svg className="pointer-events-none absolute inset-0 z-20 overflow-visible" width={timelineWidth} height={bodyHeight}><defs><marker id="complete-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="hsl(var(--primary))" /></marker></defs>{data?.dependencies.map((dep) => { const source = taskById.get(dep.predecessor_task_id); const target = taskById.get(dep.successor_task_id); const si = flatTasks.findIndex(({ task }) => task.id === dep.predecessor_task_id); const ti = flatTasks.findIndex(({ task }) => task.id === dep.successor_task_id); if (!source?.start_date || !target?.start_date || si < 0 || ti < 0) return null; const sx = (diffDays(timeline.start, parseDate(source.start_date)!) + durationDays(source)) * dayWidth; const tx = diffDays(timeline.start, parseDate(target.start_date)!) * dayWidth; const sy = si * ROW_HEIGHT + ROW_HEIGHT / 2; const ty = ti * ROW_HEIGHT + ROW_HEIGHT / 2; const mx = Math.max(sx + 16, Math.min((sx + tx) / 2, tx - 16)); return <path key={dep.id} d={`M ${sx} ${sy} H ${mx} V ${ty} H ${tx}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.8" markerEnd="url(#complete-arrow)" />; })}{linkDraft && <path d={`M ${linkDraft.startX} ${linkDraft.startY} H ${linkDraft.startX + 20} V ${linkDraft.currentY} H ${linkDraft.currentX}`} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="5 4" markerEnd="url(#complete-arrow)" />}</svg>}
          {flatTasks.map(({ task }, rowIndex) => { const scheduled = Boolean(task.start_date); const effectiveProgress = effectiveTaskProgress(task); const overdue = taskIsOverdue(task); const index = scheduled ? clamp(diffDays(timeline.start, parseDate(task.start_date)!), 0, timeline.totalDays - 1) : 0; const duration = task.task_type === "milestone" ? 1 : durationDays(task); const preview = dragPreview?.taskId === task.id ? dragPreview : null; const left = (preview?.startIndex ?? index) * dayWidth; const width = Math.max((preview?.duration ?? duration) * dayWidth, task.task_type === "milestone" ? 20 : 34); if (task.task_type === "summary") return <div key={task.id} className="absolute z-10 h-1 bg-amber-400" style={{ top: rowIndex * ROW_HEIGHT + 31, left, width }} />; return <div key={task.id} className="absolute z-30" style={{ top: rowIndex * ROW_HEIGHT + 9, left, width, height: 26 }}><button data-link-target={task.id} className="absolute -left-2 top-1/2 z-40 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-primary bg-background opacity-0 hover:opacity-100" /><div className={`group relative flex h-full select-none items-center overflow-hidden rounded px-2 text-[11px] shadow ${scheduled ? "text-white" : "border border-dashed border-primary bg-primary/15 text-primary"} ${overdue ? "ring-2 ring-red-500" : ""} ${task.task_type === "milestone" ? "rotate-45" : ""}`} title={overdue ? "Atividade atrasada: o prazo terminou sem encerramento" : undefined} style={scheduled ? { backgroundColor: task.task_type === "milestone" ? taskBarColor(task) : `${taskBarColor(task)}33`, border: `1px solid ${taskBarColor(task)}` } : undefined} onPointerDown={(e) => startBarDrag(e, task)}>{scheduled && task.task_type !== "milestone" && <span className="absolute inset-y-0 left-0" style={{ width: `${effectiveProgress}%`, backgroundColor: taskBarColor(task) }} />}{task.task_type !== "milestone" && <span className="relative z-10 font-semibold" style={scheduled ? { textShadow: "0 1px 2px rgba(0,0,0,.85)" } : undefined}>{scheduled ? `${effectiveProgress}%` : "Sem data"}</span>}{canEdit && task.task_type !== "milestone" && <><button className="absolute bottom-1 left-1 top-1 w-1.5 cursor-ew-resize rounded bg-white/60 opacity-0 group-hover:opacity-100" onPointerDown={(e) => startResize(e, task, "start")} /><button className="absolute bottom-1 right-1 top-1 w-1.5 cursor-ew-resize rounded bg-white/60 opacity-0 group-hover:opacity-100" onPointerDown={(e) => startResize(e, task, "end")} /></>}</div>{canEdit && scheduled && <button className="absolute -right-3 top-1/2 z-50 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-primary bg-background opacity-0 hover:opacity-100" onPointerDown={(e) => startLink(e, task, rowIndex)} />}</div>; })}
        </div></div>
      </div>
    </div>;
  };

  const renderBoard = () => <div className="overflow-hidden rounded-lg border">{toolbar(false)}<div className="grid min-h-[600px] gap-4 overflow-x-auto p-4 md:grid-cols-4">{(["not_started", "in_progress", "completed", "cancelled"] as TaskStatus[]).map((status) => { const tasks = filteredTasks.filter((task) => task.status === status || (status === "not_started" && task.status === "blocked")); return <div key={status} className="min-w-[260px]"><div className="mb-3 flex items-center gap-2"><span className={`rounded px-3 py-1 text-xs font-semibold ${statusColor(status)} text-white`}>{STATUS_LABELS[status].toUpperCase()}</span><span className="text-sm text-muted-foreground">{tasks.length}</span></div><button className="mb-3 text-sm text-muted-foreground hover:text-foreground" onClick={() => openCreate("task", "root", status)}>＋ Adicionar uma tarefa</button><div className="space-y-3">{tasks.map((task) => { const assignment = assignmentByTask.get(task.id); const member = assignment ? memberById.get(assignment.member_id) : null; return <button key={task.id} draggable={canEdit} onDragStart={(e) => e.dataTransfer.setData("text/task-id", task.id)} onClick={() => openEdit(task)} className="w-full rounded border bg-card p-4 text-left shadow-sm"><div className="text-xs text-muted-foreground">{task.parent_task_id ? taskById.get(task.parent_task_id)?.title : "Tarefa do projeto"}</div><div className="mt-4 flex items-center gap-3"><span className="h-5 w-5 rounded bg-primary/70" /><span className="font-medium">{task.title}</span></div><div className="mt-10 flex items-center justify-between text-xs"><span className="rounded bg-muted px-2 py-1">{task.priority.toUpperCase()}</span><span>{member?.display_name || "não atribuído"}</span></div><div className="mt-3 text-sm">{fmtDate(task.start_date)} - {fmtDate(task.end_date)}</div></button>; })}</div><div className="mt-4 h-20 rounded border border-dashed" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const taskId = e.dataTransfer.getData("text/task-id"); if (taskId) void updateTask(taskId, { status }); }}><div className="p-3 text-center text-xs text-muted-foreground">Solte aqui para alterar o estado</div></div></div>; })}</div></div>;

  const renderList = () => <div className="overflow-hidden rounded-lg border">{toolbar(false)}<div className="grid border-b bg-muted/20 text-sm font-medium" style={{ gridTemplateColumns: "1fr 180px 150px 150px 130px 40px" }}><div className="px-4 py-3">Nome da tarefa</div><div className="border-l px-4 py-3">Atribuído</div><div className="border-l px-4 py-3">Data de início</div><div className="border-l px-4 py-3">Estado</div><div className="border-l px-4 py-3 text-right">Orçamento</div><div className="border-l px-3 py-3">+</div></div>{STATUS_ORDER.map((status) => { const tasks = filteredTasks.filter((task) => task.status === status); return <div key={status} className="border-b"><div className="flex items-center justify-between bg-muted/10 px-4 py-2"><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs text-white ${statusColor(status)}`}>{STATUS_LABELS[status]}</span><span className="text-sm text-muted-foreground">{tasks.length}</span><button onClick={() => openCreate("task", "root", status)}>＋</button></div><span className="font-medium">R$ {tasks.reduce((sum, task) => sum + Number(task.budget || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>{tasks.map((task) => { const assignment = assignmentByTask.get(task.id); const member = assignment ? memberById.get(assignment.member_id) : null; return <div key={task.id} className="grid items-center border-t text-sm" style={{ gridTemplateColumns: "1fr 180px 150px 150px 130px 40px" }}><button className="truncate px-4 py-3 text-left" onClick={() => openEdit(task)}>{task.title}</button><div className="border-l px-4 py-3 text-muted-foreground">{member?.display_name || "não atribuído"}</div><div className="border-l px-4 py-3">{fmtDate(task.start_date)}</div><div className="border-l px-3 py-2"><Select value={task.status} onValueChange={(value) => void updateTask(task.id, { status: value })} disabled={!canEdit}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{STATUS_ORDER.map((item) => <SelectItem key={item} value={item}>{STATUS_LABELS[item]}</SelectItem>)}</SelectContent></Select></div><div className="border-l px-4 py-3 text-right">R$ {Number(task.budget || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><Button variant="ghost" size="icon" onClick={() => openEdit(task)}><MoreHorizontal className="h-4 w-4" /></Button></div>; })}<div className="flex gap-4 border-t px-10 py-3 text-sm text-primary"><button onClick={() => openCreate("task", "root", status)}>⊕ Adicionar uma tarefa</button><button onClick={() => openCreate("milestone", "root", status)}>Adicionar um marco</button></div></div>; })}</div>;

  const calendarCells = useMemo(() => { const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1); const start = addDays(first, -first.getDay()); return Array.from({ length: 42 }, (_, index) => addDays(start, index)); }, [calendarMonth]);
  const renderCalendar = () => <div className="overflow-hidden rounded-lg border"><div className="flex items-center justify-between border-b px-4 py-3"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-36 text-center font-medium">{monthLabel(calendarMonth)}</span><Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button><Button variant="ghost" onClick={() => setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</Button></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="gap-2"><Filter className="h-4 w-4" />Filtro</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setStatusFilter("all")}>Todos</DropdownMenuItem>{STATUS_ORDER.map((status) => <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)}>{STATUS_LABELS[status]}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div><div className="grid grid-cols-7 border-b text-center text-sm text-muted-foreground">{["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((day) => <div key={day} className="border-r py-2">{day}</div>)}</div><div className="grid grid-cols-7">{calendarCells.map((day) => { const dayIso = iso(day); const tasks = filteredTasks.filter((task) => task.start_date && task.end_date && dayIso >= task.start_date && dayIso <= task.end_date); const outside = day.getMonth() !== calendarMonth.getMonth(); return <div key={dayIso} className={`min-h-28 border-b border-r p-2 ${outside ? "bg-muted/20 text-muted-foreground" : ""}`} onDoubleClick={() => { setTaskForm({ ...EMPTY_TASK, startDate: dayIso, endDate: dayIso }); setTaskDialog(true); }}><div className="mb-1 text-sm">{day.getDate()}</div><div className="space-y-1">{tasks.slice(0, 4).map((task) => <button key={task.id} onClick={() => openEdit(task)} className={`block w-full truncate rounded px-2 py-1 text-left text-xs text-white ${statusColor(task.status)}`}>{task.title}</button>)}</div></div>; })}</div></div>;

  const workloadDays = timeline.days.slice(0, Math.min(timeline.totalDays, 45));
  const dailyHours = (memberId: string, dayIso: string) => (data?.assignments || []).filter((assignment) => assignment.member_id === memberId).reduce((sum, assignment) => { const task = taskById.get(assignment.task_id); if (!task?.start_date || !task.end_date || dayIso < task.start_date || dayIso > task.end_date) return sum; const days = durationDays(task); const total = assignment.allocated_minutes || exactMinutes(task); return sum + total / 60 / days; }, 0);
  const renderWorkload = () => <div className="overflow-hidden rounded-lg border"><div className="flex items-center justify-between border-b px-4 py-3"><div className="flex gap-4 text-sm"><span>Modo: <b>Horas</b></span><span>Período: <b>{workloadDays.length} dias</b></span></div><Button variant="ghost" className="gap-2" onClick={() => { const rows = [["Pessoa", ...workloadDays.map(iso)], ...(data?.members || []).map((member) => [member.display_name, ...workloadDays.map((day) => dailyHours(member.id, iso(day)).toFixed(2))])]; const url = URL.createObjectURL(new Blob(["\ufeff", rows.map((r) => r.map(csvCell).join(";")).join("\n")], { type: "text/csv" })); const link = document.createElement("a"); link.href = url; link.download = "carga-de-trabalho.csv"; link.click(); URL.revokeObjectURL(url); }}><Download className="h-4 w-4" />Exportar</Button></div><div className="overflow-auto"><div className="grid min-w-max border-b" style={{ gridTemplateColumns: `300px repeat(${workloadDays.length}, 44px)` }}><div className="sticky left-0 z-10 border-r bg-background px-4 py-3 font-medium">Recurso</div>{workloadDays.map((day) => <div key={day.toISOString()} className="border-r py-2 text-center text-xs"><div>{String(day.getDate()).padStart(2, "0")}</div><div className="text-muted-foreground">{weekday(day)}</div></div>)}</div>{(data?.members || []).map((member) => <div key={member.id} className="grid min-w-max border-b" style={{ gridTemplateColumns: `300px repeat(${workloadDays.length}, 44px)` }}><div className="sticky left-0 z-10 flex items-center justify-between border-r bg-background px-4 py-3"><span>{member.display_name}</span><span className="text-xs text-muted-foreground">{member.capacity_hours_per_day}h/dia</span></div>{workloadDays.map((day) => { const value = dailyHours(member.id, iso(day)); const overloaded = value > Number(member.capacity_hours_per_day); return <div key={day.toISOString()} className={`border-r py-3 text-center text-xs ${overloaded ? "bg-destructive/15 text-destructive" : ""}`}>{value ? value.toFixed(1) : "0"}</div>; })}</div>)}</div></div>;

  const renderPeople = () => { const members = (data?.members || []).filter((member) => member.display_name.toLocaleLowerCase("pt-BR").includes(memberSearch.toLocaleLowerCase("pt-BR"))); return <div className="space-y-5 rounded-lg border p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Pessoas</h2><p className="mt-2 max-w-4xl text-sm text-muted-foreground">Gerencie usuários com acesso, colaboradores da produção, pessoas sem e-mail e recursos virtuais vinculados apenas a este projeto.</p></div>{canEdit && <Button onClick={() => setMemberDialog(true)}><Users className="mr-2 h-4 w-4" />Adicionar pessoas</Button>}</div><div className="relative max-w-md"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Pesquisar por nome ou e-mail" /></div><div className="overflow-hidden rounded border"><div className="grid bg-muted/20 font-medium" style={{ gridTemplateColumns: "1fr 220px 160px 120px 40px" }}><div className="px-4 py-3">Usuário</div><div className="px-4 py-3">Direitos do projeto</div><div className="px-4 py-3">Tipo</div><div className="px-4 py-3">Capacidade</div><div /></div>{members.map((member) => <div key={member.id} className="grid items-center border-t" style={{ gridTemplateColumns: "1fr 220px 160px 120px 40px" }}><div className="px-4 py-3"><div className="font-medium">{member.display_name}</div><div className="text-sm text-muted-foreground">{member.email || "sem e-mail"}</div></div><div className="px-3 py-2"><Select value={member.project_role} onValueChange={(value) => void sb.from("planejamento_v2_project_members").update({ project_role: value }).eq("id", member.id).then(({ error }: any) => error ? toast.error(error.message) : invalidate())} disabled={!canEdit || member.project_role === "owner"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="owner">Dono do projeto</SelectItem><SelectItem value="editor">Editor</SelectItem><SelectItem value="member">Membro</SelectItem><SelectItem value="viewer">Visualizador</SelectItem><SelectItem value="resource">Recurso</SelectItem></SelectContent></Select></div><div className="px-4 py-3 capitalize">{member.member_type === "production" ? "produção" : member.member_type === "manual" ? "sem login" : member.member_type === "resource" ? "recurso virtual" : "usuário"}</div><div className="px-4 py-3">{member.capacity_hours_per_day} h/dia</div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="text-destructive" disabled={!canEdit || member.project_role === "owner"} onClick={async () => { const { error } = await sb.from("planejamento_v2_project_members").update({ active: false }).eq("id", member.id); error ? toast.error(error.message) : void invalidate(); }}>Remover do projeto</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>)}</div></div>; };

  const renderDashboard = () => {
    const tasks = data?.tasks || [];
    const completed = tasks.filter((task) => task.status === "completed").length;
    const progress = tasks.length
      ? Math.round(tasks.reduce((sum, task) => sum + effectiveTaskProgress(task), 0) / tasks.length)
      : 0;
    const budget = tasks.reduce((sum, task) => sum + Number(task.budget || 0), 0);
    const hours = (data?.assignments || []).reduce(
      (sum, assignment) => sum + Number(assignment.allocated_minutes || 0),
      0,
    ) / 60;
    const execution = projectExecution.operationalTotals;

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border p-5"><div className="text-sm text-muted-foreground">Tarefas</div><div className="mt-2 text-3xl font-semibold">{tasks.length}</div></div>
          <div className="rounded-lg border p-5"><div className="text-sm text-muted-foreground">Concluídas</div><div className="mt-2 text-3xl font-semibold">{completed}</div></div>
          <div className="rounded-lg border p-5"><div className="text-sm text-muted-foreground">Progresso médio</div><div className="mt-2 text-3xl font-semibold">{progress}%</div></div>
          <div className="rounded-lg border p-5"><div className="text-sm text-muted-foreground">Carga planejada</div><div className="mt-2 text-3xl font-semibold">{hours.toFixed(1)}h</div></div>
          <div className="rounded-lg border p-5 md:col-span-2"><div className="text-sm text-muted-foreground">Orçamento total</div><div className="mt-2 text-3xl font-semibold">R$ {budget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>
          <div className="rounded-lg border p-5 md:col-span-2"><div className="text-sm text-muted-foreground">Pessoas no projeto</div><div className="mt-2 text-3xl font-semibold">{data?.members.length || 0}</div></div>
        </div>

        <div className="rounded-lg border">
          <div className="border-b bg-muted/20 px-4 py-3">
            <div className="font-semibold">Execução real do projeto</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Leitura das OPs e apontamentos do mesmo projeto. Esta visão não altera datas, dependências, capacidade ou progresso manual do Planejamento 2.0.
            </div>
          </div>
          <div className="grid gap-px border-b bg-border sm:grid-cols-4">
            <div className="bg-background p-4"><div className="text-xs text-muted-foreground">OPs abertas/criadas</div><div className="mt-1 text-2xl font-semibold">{execution.opCount}</div></div>
            <div className="bg-background p-4"><div className="text-xs text-muted-foreground">Ciclos concluídos</div><div className="mt-1 text-2xl font-semibold">{execution.ciclos}</div></div>
            <div className="bg-background p-4"><div className="text-xs text-muted-foreground">Quantidade apontada</div><div className="mt-1 text-2xl font-semibold">{execution.produzido.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</div></div>
            <div className="bg-background p-4"><div className="text-xs text-muted-foreground">Perdas apontadas</div><div className="mt-1 text-2xl font-semibold">{execution.perdas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</div></div>
          </div>
          {projectExecution.operationalOps.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">Nenhuma OP vinculada a este projeto ainda.</div>
          ) : (
            <div className="divide-y">
              {projectExecution.operationalOps.map((op) => (
                <div key={op.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[130px_1fr_120px_120px_100px] md:items-center">
                  <div className="font-medium">{op.codigoOp}</div>
                  <div className="min-w-0 truncate">{op.processo}</div>
                  <div className="text-muted-foreground">{op.status}</div>
                  <div className="md:text-right"><span className="text-muted-foreground">Produzido: </span><span className="font-semibold">{op.produzido.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span></div>
                  <div className="md:text-right"><span className="text-muted-foreground">Ciclos: </span>{op.ciclos}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (query.isLoading) return <MainLayout title="Planejamento 2.0" subtitle="Carregando projeto..."><div className="p-6 text-sm text-muted-foreground">Carregando...</div></MainLayout>;
  if (query.error || !data) return <MainLayout title="Planejamento 2.0" subtitle="Projeto não encontrado"><div className="p-6 text-sm text-destructive">Não foi possível carregar o planejamento. Confirme se a migration de membros e alocações foi aplicada.</div></MainLayout>;

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "gantt", label: "Diagrama de Gantt", icon: GanttChartSquare }, { id: "board", label: "Painel", icon: LayoutDashboard }, { id: "list", label: "Lista", icon: LayoutList },
    { id: "calendar", label: "Calendário", icon: CalendarDays }, { id: "workload", label: "Carga de trabalho", icon: Columns3 }, { id: "people", label: "Pessoas", icon: Users }, { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  ];

  return <MainLayout title={data.workspace.project_name_snapshot} subtitle="Planejamento 2.0"><div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3"><div className="flex items-center gap-3"><Folder className="h-5 w-5 text-primary" /><h1 className="text-lg font-semibold">{data.workspace.project_name_snapshot}</h1><Star className="h-5 w-5 text-muted-foreground" /><Select value={data.workspace.status} onValueChange={async (value) => { const { error } = await sb.from("planejamento_v2_workspaces").update({ status: value }).eq("id", workspaceId); error ? toast.error(error.message) : void invalidate(); }} disabled={!canEdit}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Sem status</SelectItem><SelectItem value="active">Ativo</SelectItem><SelectItem value="paused">Pausado</SelectItem><SelectItem value="completed">Concluído</SelectItem><SelectItem value="archived">Arquivado</SelectItem></SelectContent></Select></div><div className="rounded border px-3 py-1.5 text-xs">Dono do projeto</div></div><div className="flex flex-wrap items-center gap-5 border-b">{tabs.map((item) => <button key={item.id} className={`border-b-2 px-1 py-2.5 text-sm ${tab === item.id ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
<div id="planejamento-v2-active-report" data-report-name={`${planningReportLabels[tab]} — ${data.workspace.project_name_snapshot}`}>{tab === "gantt" && renderGantt()}{tab === "board" && renderBoard()}{tab === "list" && renderList()}{tab === "calendar" && renderCalendar()}{tab === "workload" && renderWorkload()}{tab === "people" && renderPeople()}{tab === "dashboard" && renderDashboard()}</div>
  </div>

  {fieldsPanelOpen && <aside className="fixed bottom-0 right-0 top-0 z-[80] flex w-[366px] max-w-[94vw] flex-col border-l border-slate-200 bg-white font-sans text-slate-800 shadow-2xl">
    <div className="flex h-[58px] items-center border-b border-slate-200 px-4">
      <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold">Mostrar/ocultar campos</h2>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#ff6b22] hover:bg-orange-50 hover:text-[#ff6b22]" title="Ajuda sobre campos"><HelpCircle className="h-[17px] w-[17px]" /></Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={() => setFieldsPanelOpen(false)} aria-label="Fechar painel"><X className="h-4 w-4" /></Button>
    </div>
    <div className="flex h-[46px] items-end gap-5 border-b border-slate-200 px-4">
      <button type="button" className={`h-full border-b-2 pt-1 text-[14px] font-semibold ${fieldsPanelTab === "standard" ? "border-[#1769c2] text-[#1769c2]" : "border-transparent text-slate-400"}`} onClick={() => setFieldsPanelTab("standard")}>Padrões</button>
      <button type="button" className={`h-full border-b-2 pt-1 text-[14px] font-semibold ${fieldsPanelTab === "custom" ? "border-[#1769c2] text-[#1769c2]" : "border-transparent text-slate-400"}`} onClick={() => setFieldsPanelTab("custom")}>Personalizados</button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
      {fieldsPanelTab === "standard" ? <div className="space-y-5">{STANDARD_FIELD_GROUPS.map((group) => <section key={group.label}>
        <div className="mb-2 flex items-center gap-2"><h3 className="shrink-0 text-[12px] font-medium text-slate-400">{group.label}</h3><span className="h-px flex-1 bg-slate-200" /></div>
        <div>{group.fields.map((field) => { const FieldIcon = STANDARD_FIELD_ICONS[field.key]; const checked = visibleStandardFields.has(field.key); return <label key={field.key} className="flex h-[33px] cursor-pointer items-center gap-3 rounded-sm px-1 text-[14px] hover:bg-slate-50">
          <FieldIcon className={`h-[18px] w-[18px] shrink-0 stroke-[1.4] ${field.key === "startTime" || field.key === "endTime" ? "text-slate-300" : "text-slate-800"}`} />
          <span className={`min-w-0 flex-1 truncate ${field.key === "startTime" || field.key === "endTime" ? "text-slate-400" : ""}`}>{field.label}</span>
          <Checkbox className="h-4 w-4 shrink-0 rounded-[1px] border-slate-400 data-[state=checked]:border-[#1769c2] data-[state=checked]:bg-[#1769c2] data-[state=checked]:text-white" checked={checked} onCheckedChange={() => toggleStandardField(field.key)} />
        </label>; })}</div>
      </section>)}</div> : <div className="space-y-4">
        <Button variant="outline" className="w-full justify-start gap-2 border-[#1769c2] text-[#1769c2] hover:bg-blue-50 hover:text-[#1769c2]" onClick={() => setCustomFieldDialog(true)} disabled={!canEdit}><Plus className="h-4 w-4" />Criar campo personalizado</Button>
        {(data?.customFields || []).filter((field) => field.active).length === 0 ? <p className="py-8 text-center text-[14px] text-slate-400">Nenhum campo personalizado criado.</p> : <div>{(data?.customFields || []).filter((field) => field.active).map((field) => <div key={field.id} className="flex h-[36px] items-center gap-3 rounded-sm px-1 text-[14px] hover:bg-slate-50">
          <Columns3 className="h-[18px] w-[18px] shrink-0 stroke-[1.4] text-slate-800" />
          <label className="flex min-w-0 flex-1 cursor-pointer items-center"><span className="min-w-0 flex-1 truncate">{field.name}</span><Checkbox className="h-4 w-4 shrink-0 rounded-[1px] border-slate-400 data-[state=checked]:border-[#1769c2] data-[state=checked]:bg-[#1769c2] data-[state=checked]:text-white" checked={visibleCustomFieldIds.has(field.id)} onCheckedChange={() => toggleCustomField(field.id)} /></label>
          {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-slate-400 hover:bg-red-50 hover:text-destructive" title="Remover campo" onClick={() => void removeCustomField(field)}><X className="h-3.5 w-3.5" /></Button>}
        </div>)}</div>}
      </div>}
    </div>
  </aside>}

  <Dialog open={customFieldDialog} onOpenChange={setCustomFieldDialog}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Criar campo personalizado</DialogTitle><DialogDescription>O campo será exibido como uma coluna editável do Gantt.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-1.5"><Label>Nome do campo</Label><Input value={customFieldName} onChange={(event) => setCustomFieldName(event.target.value)} placeholder="Ex.: Código da obra" autoFocus /></div><div className="space-y-1.5"><Label>Tipo</Label><Select value={customFieldType} onValueChange={(value) => setCustomFieldType(value as CustomFieldType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">Texto</SelectItem><SelectItem value="number">Número</SelectItem><SelectItem value="currency">Moeda</SelectItem><SelectItem value="date">Data</SelectItem><SelectItem value="boolean">Sim/Não</SelectItem><SelectItem value="select">Lista de opções</SelectItem></SelectContent></Select></div>{customFieldType === "select" && <div className="space-y-1.5"><Label>Opções</Label><Textarea value={customFieldOptions} onChange={(event) => setCustomFieldOptions(event.target.value)} placeholder="Opção 1, Opção 2, Opção 3" /><p className="text-xs text-muted-foreground">Separe as opções por vírgula.</p></div>}</div><DialogFooter><Button variant="outline" onClick={() => setCustomFieldDialog(false)}>Cancelar</Button><Button onClick={() => createCustomField.mutate()} disabled={createCustomField.isPending}>{createCustomField.isPending ? "Criando..." : "Criar campo"}</Button></DialogFooter></DialogContent></Dialog>

  <Dialog open={taskDialog} onOpenChange={setTaskDialog}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{taskForm.id ? "Editar atividade" : "Adicionar atividade"}</DialogTitle><DialogDescription>O mesmo cadastro alimenta Gantt, Painel, Lista, Calendário e Carga de trabalho.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-3 md:grid-cols-3"><div className="space-y-1.5"><Label>Origem</Label><Select value={taskForm.origin} onValueChange={(value) => setTaskForm((current) => ({ ...current, origin: value as TaskForm["origin"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="process">Processo do App Controle</SelectItem><SelectItem value="custom">Atividade personalizada</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Tipo</Label><Select value={taskForm.taskType} onValueChange={(value) => setTaskForm((current) => ({ ...current, taskType: value as TaskType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="task">Tarefa</SelectItem><SelectItem value="summary">Tarefa-resumo</SelectItem><SelectItem value="milestone">Marco</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Grupo/etapa do projeto</Label><Select value={taskForm.parentTaskId} onValueChange={(value) => setTaskForm((current) => ({ ...current, parentTaskId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="root">Sem grupo (nível principal)</SelectItem>{data.tasks.filter((task) => task.task_type === "summary" && task.id !== taskForm.id).map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}</SelectContent></Select></div></div>
    {taskForm.origin === "process" ? <div className="space-y-1.5"><Label>Processo</Label><Select value={taskForm.processId} onValueChange={(value) => { setTaskForm((current) => ({ ...current, processId: value })); void loadTaskCapacity(taskForm.id || null, value); }}><SelectTrigger><SelectValue placeholder="Selecione um processo..." /></SelectTrigger><SelectContent>{data.processes.map((process) => <SelectItem key={process.id} value={process.id}>{process.valor}</SelectItem>)}</SelectContent></Select></div> : <div className="space-y-1.5"><Label>Nome da atividade</Label><Input value={taskForm.title} onChange={(e) => setTaskForm((current) => ({ ...current, title: e.target.value }))} /></div>}
    <div className={`grid gap-3 ${taskCapacityEnabled && taskForm.origin === "process" && taskForm.taskType === "task" ? "md:grid-cols-2" : "md:grid-cols-4"}`}><div className="space-y-1.5"><Label>{taskCapacityEnabled && taskForm.origin === "process" && taskForm.taskType === "task" ? "Data de início mínimo" : "Data de início"}</Label><Input type="date" value={taskForm.startDate} onChange={(e) => setTaskForm((current) => ({ ...current, startDate: e.target.value, endDate: current.endDate || e.target.value }))} /></div><div className="space-y-1.5"><Label>Hora de início</Label><Input type="time" value={taskForm.startTime} onChange={(e) => setTaskForm((current) => ({ ...current, startTime: e.target.value }))} /></div>{!(taskCapacityEnabled && taskForm.origin === "process" && taskForm.taskType === "task") && <><div className="space-y-1.5"><Label>Data de término</Label><Input type="date" value={taskForm.taskType === "milestone" ? taskForm.startDate : taskForm.endDate} disabled={taskForm.taskType === "milestone"} onChange={(e) => setTaskForm((current) => ({ ...current, endDate: e.target.value }))} /></div><div className="space-y-1.5"><Label>Hora de término</Label><Input type="time" value={taskForm.taskType === "milestone" ? taskForm.startTime : taskForm.endTime} disabled={taskForm.taskType === "milestone"} onChange={(e) => setTaskForm((current) => ({ ...current, endTime: e.target.value }))} /></div></>}</div>
    <div className="grid gap-3 md:grid-cols-4"><div className="space-y-1.5"><Label>Atribuído</Label><Select value={taskForm.memberId} onValueChange={(value) => setTaskForm((current) => ({ ...current, memberId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">não atribuído</SelectItem>{data.members.map((member) => <SelectItem key={member.id} value={member.id}>{member.display_name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Carga planejada (horas)</Label><Input type="number" min="0" step="0.25" value={taskForm.allocatedHours} onChange={(e) => setTaskForm((current) => ({ ...current, allocatedHours: e.target.value }))} /></div><div className="space-y-1.5"><Label>Estado</Label><Select value={taskForm.status} onValueChange={(value) => setTaskForm((current) => { const status = value as TaskStatus; const progress = status === "completed" || status === "cancelled" ? "100" : status === "not_started" ? "0" : status === "in_progress" && Number(current.progress) >= 100 ? "0" : current.progress; return { ...current, status, progress }; })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_ORDER.map((status) => <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Prioridade</Label><Select value={taskForm.priority} onValueChange={(value) => setTaskForm((current) => ({ ...current, priority: value as TaskRow["priority"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="normal">Média</SelectItem><SelectItem value="high">Alta</SelectItem><SelectItem value="urgent">Urgente</SelectItem></SelectContent></Select></div></div>
    <div className="grid gap-3 md:grid-cols-2"><div className="space-y-1.5"><div className="flex items-center justify-between gap-3"><Label>Progresso (%)</Label><div className="flex items-center gap-2"><Label htmlFor="task-progress-manual" className="text-xs font-normal text-muted-foreground">Informar manualmente</Label><Switch id="task-progress-manual" checked={taskForm.progressManual} disabled={taskForm.status === "completed" || taskForm.status === "cancelled" || taskForm.status === "not_started"} onCheckedChange={(checked) => setTaskForm((current) => ({ ...current, progressManual: checked, progress: checked ? String(effectiveFormProgress(current)) : current.progress }))} /></div></div><Input type="number" min="0" max={taskForm.status === "in_progress" ? "99" : "100"} step="1" value={taskForm.progressManual ? taskForm.progress : String(effectiveFormProgress(taskForm))} disabled={!taskForm.progressManual || taskForm.status === "completed" || taskForm.status === "cancelled" || taskForm.status === "not_started"} onChange={(e) => setTaskForm((current) => ({ ...current, progress: e.target.value }))} /><p className="text-xs text-muted-foreground">{taskForm.status === "completed" || taskForm.status === "cancelled" ? "100% automático para atividades encerradas." : taskForm.status === "not_started" ? "0% automático enquanto a atividade estiver aberta." : taskForm.progressManual ? "O valor manual substitui o cálculo pelo tempo." : taskIsOverdue({ status: taskForm.status, start_date: taskForm.startDate, start_time: taskForm.startTime, end_date: taskForm.endDate, end_time: taskForm.endTime }) ? "Prazo vencido: permanece em 99% até a atividade ser encerrada." : "Calculado automaticamente pelo tempo transcorrido entre início e término."}</p></div><div className="space-y-1.5"><Label>Cor da barra no Gantt</Label><div className="flex items-center gap-2"><Input type="color" className="h-10 w-16 cursor-pointer p-1" value={taskForm.barColor || statusHex(taskForm.status)} onChange={(e) => setTaskForm((current) => ({ ...current, barColor: e.target.value }))} /><Input value={taskForm.barColor} placeholder="Automática pelo estado" onChange={(e) => setTaskForm((current) => ({ ...current, barColor: e.target.value }))} /><Button type="button" variant="outline" onClick={() => setTaskForm((current) => ({ ...current, barColor: "" }))}>Automática</Button></div><p className="text-xs text-muted-foreground">A cor escolhida será usada no preenchimento proporcional da barra.</p></div></div>
    <div className="grid gap-3 md:grid-cols-3"><div className="space-y-1.5"><Label>Quantidade</Label><Input value={taskForm.quantity} onChange={(e) => setTaskForm((current) => ({ ...current, quantity: e.target.value }))} /></div><div className="space-y-1.5"><Label>Unidade</Label><Input value={taskForm.unit} onChange={(e) => setTaskForm((current) => ({ ...current, unit: e.target.value }))} /></div><div className="space-y-1.5"><Label>Orçamento</Label><Input value={taskForm.budget} onChange={(e) => setTaskForm((current) => ({ ...current, budget: e.target.value }))} /></div></div>{taskForm.origin === "process" && taskForm.taskType === "task" && <div className="rounded-lg border p-4"><div className="flex items-center justify-between gap-4"><div><Label>Dimensionar pela capacidade produtiva</Label><p className="mt-1 text-xs text-muted-foreground">Opcional. Ligado, o término é calculado pela quantidade, equipe e capacidade desta etapa.</p></div><Switch checked={taskCapacityEnabled} disabled={taskCapacitySchemaAvailable !== true || taskCapacityLoading || !taskForm.processId} onCheckedChange={setTaskCapacityEnabled} /></div>{taskCapacitySchemaAvailable === false && <p className="mt-3 text-xs text-muted-foreground">Disponível após aplicar a migration de capacidade produtiva.</p>}{taskCapacityLoading && <p className="mt-3 text-xs text-muted-foreground">Carregando os parâmetros deste processo...</p>}{taskCapacityEnabled && <div className="mt-4 space-y-4"><div className="space-y-1.5"><Label>Pessoas necessárias nesta etapa</Label><Input type="number" min="1" step="1" value={taskCrewSize} onChange={(e) => setTaskCrewSize(e.target.value)} /><p className="text-xs text-muted-foreground">Limite do projeto: {taskProjectLabor || "não configurado"} pessoa(s). Altere esse limite nas configurações do projeto.</p></div><div className="grid gap-3 md:grid-cols-3"><div className="space-y-1.5"><Label>Produção por jornada</Label><Input type="number" min="0.001" step="0.001" value={taskOutputPerShift} onChange={(e) => setTaskOutputPerShift(e.target.value)} /></div><div className="space-y-1.5"><Label>Horas da jornada</Label><Input type="number" min="0.25" max="24" step="0.25" value={taskReferenceHours} onChange={(e) => setTaskReferenceHours(e.target.value)} /></div><div className="space-y-1.5"><Label>Máquinas/equipes simultâneas</Label><Input type="number" min="1" step="1" value={taskMaxParallelTeams} onChange={(e) => setTaskMaxParallelTeams(e.target.value)} /></div></div><p className="text-xs text-muted-foreground">Os valores ficam associados ao processo neste projeto e são reutilizados como padrão nas próximas etapas do mesmo processo.</p></div>}</div>}<div className="space-y-1.5"><Label>Observações</Label><Textarea rows={4} value={taskForm.description} onChange={(e) => setTaskForm((current) => ({ ...current, description: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setTaskDialog(false)}>Cancelar</Button><Button onClick={() => saveTask.mutate(taskForm)} disabled={saveTask.isPending}>{saveTask.isPending ? "Salvando..." : "Salvar atividade"}</Button></DialogFooter></DialogContent></Dialog>

  <Dialog open={memberDialog} onOpenChange={setMemberDialog}><DialogContent><DialogHeader><DialogTitle>Adicionar pessoa ao projeto</DialogTitle><DialogDescription>Inclua usuário do sistema, colaborador da produção, pessoa sem e-mail ou recurso virtual.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="space-y-1.5"><Label>Origem</Label><Select value={memberForm.source} onValueChange={(value) => setMemberForm((current) => ({ ...current, source: value as MemberForm["source"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">Usuário do App Controle</SelectItem><SelectItem value="production">Equipe da produção</SelectItem><SelectItem value="manual">Pessoa sem login</SelectItem><SelectItem value="resource">Recurso virtual</SelectItem></SelectContent></Select></div>{memberForm.source === "user" && <div className="space-y-1.5"><Label>Usuário</Label><Select value={memberForm.profileId} onValueChange={(value) => setMemberForm((current) => ({ ...current, profileId: value }))}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{data.profiles.filter((profile) => !data.members.some((member) => member.profile_id === profile.id)).map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.full_name} · {profile.email}</SelectItem>)}</SelectContent></Select></div>}{memberForm.source === "production" && <div className="space-y-1.5"><Label>Colaborador da produção</Label><Select value={memberForm.collaboratorId} onValueChange={(value) => setMemberForm((current) => ({ ...current, collaboratorId: value }))}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{data.collaborators.filter((person) => !data.members.some((member) => member.colaborador_id === person.id)).map((person) => <SelectItem key={person.id} value={person.id}>{person.nome}{person.cargo ? ` · ${person.cargo}` : ""}</SelectItem>)}</SelectContent></Select></div>}{(memberForm.source === "manual" || memberForm.source === "resource") && <><div className="space-y-1.5"><Label>Nome</Label><Input value={memberForm.name} onChange={(e) => setMemberForm((current) => ({ ...current, name: e.target.value }))} /></div><div className="space-y-1.5"><Label>E-mail opcional</Label><Input value={memberForm.email} onChange={(e) => setMemberForm((current) => ({ ...current, email: e.target.value }))} /></div></>}<div className="grid gap-3 md:grid-cols-2"><div className="space-y-1.5"><Label>Direito no projeto</Label><Select value={memberForm.role} onValueChange={(value) => setMemberForm((current) => ({ ...current, role: value as MemberRow["project_role"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="editor">Editor</SelectItem><SelectItem value="member">Membro</SelectItem><SelectItem value="viewer">Visualizador</SelectItem><SelectItem value="resource">Recurso</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Capacidade diária (horas)</Label><Input type="number" min="0.25" max="24" step="0.25" value={memberForm.capacity} onChange={(e) => setMemberForm((current) => ({ ...current, capacity: e.target.value }))} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setMemberDialog(false)}>Cancelar</Button><Button onClick={() => saveMember.mutate(memberForm)} disabled={saveMember.isPending}>Adicionar</Button></DialogFooter></DialogContent></Dialog>
  </MainLayout>;
}
