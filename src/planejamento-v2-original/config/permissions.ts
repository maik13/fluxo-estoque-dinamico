// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
// Centraliza os nomes, rótulos e regras de autorização do sistema.

/**
 * Papéis RH são a única exceção à regra de permissões individuais:
 * RH e Gestor de RH recebem todo o conjunto funcional da área de RH/Ponto.
 * Os demais papéis dependem exclusivamente das permissões marcadas para o usuário.
 */
export const RH_FULL_PERMISSIONS = [
  "registrar_ponto",
  "visualizar_ponto",
  "controle_ponto",
  "aprovar_ponto",
  "rh_info",
] as const;

export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  admin: [],
  coordenador: [],
  operador: [],
  visualizador: [],
  rh: RH_FULL_PERMISSIONS,
  gestor_rh: RH_FULL_PERMISSIONS,
};

const PERMISSION_ALIASES: Record<string, string> = {
  controle_de_ponto: "controle_ponto",
  acesso_controle_ponto: "controle_ponto",
  informacoes_rh: "rh_info",
  gestao_de_usuarios: "gestao_usuarios",
  presets_de_producao: "presets_producao",
  presets_de_produ_o: "presets_producao",
  // Todas as variações antigas voltam para a única permissão canônica.
  visualizar_status_ponto: "visualizar_ponto",
  visualiza_o_do_ponto: "visualizar_ponto",
  visualizacao_do_ponto: "visualizar_ponto",
  visualizar_o_ponto: "visualizar_ponto",
  ver_ponto: "visualizar_ponto",
  rh: "rh_info",
};

const PERMISSION_LABELS: Record<string, string> = {
  dashboard: "Acesso ao Dashboard",
  estoque: "Acesso ao Estoque",
  movimentacoes: "Ordens de Produção e Apontamentos",
  apontamentos: "Histórico de Apontamentos",
  agenda: "Acesso ao Cronograma",
  fretes: "Acesso ao Controle de Fretes",
  registrar_ponto: "Registrar o próprio ponto",
  visualizar_ponto: "Visualizar quem bateu ou não bateu o ponto",
  controle_ponto: "Gerenciar registros de ponto",
  aprovar_ponto: "Visualizar e aprovar registros de ponto",
  rh_info: "Acesso às informações de RH",
  financeiro: "Acesso ao módulo Financeiro",
  configuracoes: "Acesso às Configurações",
  gestao_usuarios: "Gestão de Usuários",
  configurar_usuarios: "Configurar Usuários",
  view_op_images: "Visualizar Imagens de OP",
  mensagens_op: "Acessar Mensagens de OP",
  editar_ordem_producao: "Editar Ordem de Produção",
  corrigir_quantidade_op: "Corrigir quantidade, perdas e estoque da OP",
  presets_producao: "Presets de Produção",
  view_advanced_generator: "Visualizar Gerador Avançado",
  excluir_cronograma: "Excluir atividades do cronograma",
  planejamento: "Planejamento (acesso)",
  planejamento_view: "Planejamento — Visualizar",
  planejamento_edit: "Planejamento — Editar projetos/atividades",
  planejamento_admin: "Planejamento — Administrar (excluir/aplicar simulação)",
  planejamento_simulador: "Planejamento — Laboratório M.I.O.P.",
  planejamento_configuracoes: "Planejamento — Configurações",
  planejamento_v2_view: "Planejamento 2.0 — Visualizar",
  planejamento_v2_edit: "Planejamento 2.0 — Criar e editar",
  planejamento_v2_admin: "Planejamento 2.0 — Administrar",
  crm_access: "Acessar CRM Comercial",
  crm_contacts_view: "CRM — Visualizar empresas e pessoas",
  crm_contacts_edit: "CRM — Criar e editar empresas e pessoas",
  crm_deals_view: "CRM — Visualizar negócios",
  crm_deals_edit: "CRM — Criar e editar negócios",
  crm_deals_delete: "CRM — Excluir negócios",
  crm_tasks_view: "CRM — Visualizar tarefas",
  crm_tasks_edit: "CRM — Criar e editar tarefas",
  crm_whatsapp_view: "CRM — Visualizar WhatsApp",
  crm_whatsapp_send: "CRM — Iniciar conversas no WhatsApp",
  crm_reports_view: "CRM — Visualizar relatórios",
  crm_import: "CRM — Importar dados",
  crm_export: "CRM — Exportar dados",
  crm_pipeline_manage: "CRM — Gerenciar funis",
  crm_automation_manage: "CRM — Gerenciar automações",
  crm_integrations_manage: "CRM — Gerenciar integrações",
  crm_admin: "CRM — Administração total",
};

/** Converte identificadores equivalentes para uma única chave estável. */
export function normalizePermissionName(value: string | null | undefined): string {
  const normalized = (value || "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return PERMISSION_ALIASES[normalized] || normalized;
}

/** Verifica somente as permissões herdadas pelo papel. */
export function roleHasPermission(role: string | null, permission: string): boolean {
  if (!role) return false;
  if (role === "admin") return true;

  const normalizedPermission = normalizePermissionName(permission);
  const inheritedPermissions = ROLE_PERMISSIONS[role] || [];
  return inheritedPermissions.some(
    (item) => normalizePermissionName(item) === normalizedPermission,
  );
}

/** Retorna o rótulo legível e estável de uma permissão do sistema. */
export function getPermissionLabel(permission: { name: string; description?: string | null }): string {
  const normalizedName = normalizePermissionName(permission.name);
  return PERMISSION_LABELS[normalizedName] || permission.description || normalizedName || permission.name;
}

/** Catálogo das permissões que liberam telas ou ações no sistema. */
export const PERMISSION_CATALOG: Array<{ name: string; label: string; area: string }> = [
  { name: "dashboard", label: PERMISSION_LABELS.dashboard, area: "Gerenciamento" },
  { name: "estoque", label: PERMISSION_LABELS.estoque, area: "Estoque" },
  { name: "movimentacoes", label: PERMISSION_LABELS.movimentacoes, area: "Produção" },
  { name: "apontamentos", label: PERMISSION_LABELS.apontamentos, area: "Produção" },
  { name: "agenda", label: PERMISSION_LABELS.agenda, area: "Produção" },
  { name: "excluir_cronograma", label: PERMISSION_LABELS.excluir_cronograma, area: "Produção" },
  { name: "view_op_images", label: PERMISSION_LABELS.view_op_images, area: "Produção" },
  { name: "mensagens_op", label: PERMISSION_LABELS.mensagens_op, area: "Produção" },
  { name: "editar_ordem_producao", label: PERMISSION_LABELS.editar_ordem_producao, area: "Produção" },
  { name: "corrigir_quantidade_op", label: PERMISSION_LABELS.corrigir_quantidade_op, area: "Produção" },
  { name: "presets_producao", label: PERMISSION_LABELS.presets_producao, area: "Produção" },
  { name: "view_advanced_generator", label: PERMISSION_LABELS.view_advanced_generator, area: "Produção" },
  { name: "fretes", label: PERMISSION_LABELS.fretes, area: "Fretes" },
  { name: "registrar_ponto", label: PERMISSION_LABELS.registrar_ponto, area: "Ponto" },
  { name: "visualizar_ponto", label: PERMISSION_LABELS.visualizar_ponto, area: "Ponto" },
  { name: "controle_ponto", label: PERMISSION_LABELS.controle_ponto, area: "Ponto" },
  { name: "aprovar_ponto", label: PERMISSION_LABELS.aprovar_ponto, area: "Ponto" },
  { name: "rh_info", label: PERMISSION_LABELS.rh_info, area: "RH" },
  { name: "financeiro", label: PERMISSION_LABELS.financeiro, area: "Financeiro" },
  { name: "configuracoes", label: PERMISSION_LABELS.configuracoes, area: "Configurações" },
  { name: "gestao_usuarios", label: PERMISSION_LABELS.gestao_usuarios, area: "Configurações" },
  { name: "configurar_usuarios", label: PERMISSION_LABELS.configurar_usuarios, area: "Configurações" },
  { name: "planejamento", label: PERMISSION_LABELS.planejamento, area: "Planejamento" },
  { name: "planejamento_view", label: PERMISSION_LABELS.planejamento_view, area: "Planejamento" },
  { name: "planejamento_edit", label: PERMISSION_LABELS.planejamento_edit, area: "Planejamento" },
  { name: "planejamento_admin", label: PERMISSION_LABELS.planejamento_admin, area: "Planejamento" },
  { name: "planejamento_simulador", label: PERMISSION_LABELS.planejamento_simulador, area: "Planejamento" },
  { name: "planejamento_configuracoes", label: PERMISSION_LABELS.planejamento_configuracoes, area: "Planejamento" },
  { name: "planejamento_v2_view", label: PERMISSION_LABELS.planejamento_v2_view, area: "Planejamento 2.0" },
  { name: "planejamento_v2_edit", label: PERMISSION_LABELS.planejamento_v2_edit, area: "Planejamento 2.0" },
  { name: "planejamento_v2_admin", label: PERMISSION_LABELS.planejamento_v2_admin, area: "Planejamento 2.0" },
  ...[
    "crm_access", "crm_contacts_view", "crm_contacts_edit", "crm_deals_view",
    "crm_deals_edit", "crm_deals_delete", "crm_tasks_view", "crm_tasks_edit",
    "crm_whatsapp_view", "crm_whatsapp_send", "crm_reports_view", "crm_import",
    "crm_export", "crm_pipeline_manage", "crm_automation_manage",
    "crm_integrations_manage", "crm_admin",
  ].map((name) => ({ name, label: PERMISSION_LABELS[name], area: "CRM Comercial" })),
];

export const CRM_PERMISSION_PRESETS = {
  consulta: ["crm_access", "crm_contacts_view", "crm_deals_view", "crm_tasks_view", "crm_reports_view"],
  vendedor: ["crm_access", "crm_contacts_view", "crm_contacts_edit", "crm_deals_view", "crm_deals_edit", "crm_tasks_view", "crm_tasks_edit", "crm_whatsapp_view", "crm_whatsapp_send"],
  gestor: ["crm_access", "crm_contacts_view", "crm_contacts_edit", "crm_deals_view", "crm_deals_edit", "crm_deals_delete", "crm_tasks_view", "crm_tasks_edit", "crm_whatsapp_view", "crm_whatsapp_send", "crm_reports_view", "crm_import", "crm_export", "crm_pipeline_manage", "crm_automation_manage"],
  administrador: ["crm_access", "crm_contacts_view", "crm_contacts_edit", "crm_deals_view", "crm_deals_edit", "crm_deals_delete", "crm_tasks_view", "crm_tasks_edit", "crm_whatsapp_view", "crm_whatsapp_send", "crm_reports_view", "crm_import", "crm_export", "crm_pipeline_manage", "crm_automation_manage", "crm_integrations_manage", "crm_admin"],
} as const;

/** Indica se o identificador informado é reconhecido pelo sistema. */
export function isKnownPermission(value: string | null | undefined): boolean {
  const normalized = normalizePermissionName(value);
  return PERMISSION_CATALOG.some((item) => item.name === normalized);
}
