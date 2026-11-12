// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
export type PlanejamentoV2WorkspaceStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "archived";

export type PlanejamentoV2TaskType = "task" | "summary" | "milestone";
export type PlanejamentoV2TaskStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export type PlanejamentoV2DependencyType = "FS" | "SS" | "FF" | "SF";
export type PlanejamentoV2LagUnit = "hours" | "days";

export interface AppControlProject {
  id: string;
  name: string;
  active: boolean;
  order: number;
}

export interface AppControlProcess {
  id: string;
  name: string;
  active: boolean;
  order: number;
}

export interface PlanejamentoV2Workspace {
  id: string;
  appProjectSettingId: string;
  projectNameSnapshot: string;
  status: PlanejamentoV2WorkspaceStatus;
  description?: string | null;
  startDate?: string | null;
  targetEndDate?: string | null;
  ownerId?: string | null;
  archivedAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanejamentoV2Task {
  id: string;
  workspaceId: string;
  parentTaskId?: string | null;
  sourceProcessSettingId?: string | null;
  sourceProcessNameSnapshot?: string | null;
  title: string;
  description?: string | null;
  taskType: PlanejamentoV2TaskType;
  status: PlanejamentoV2TaskStatus;
  priority: "low" | "normal" | "high" | "urgent";
  position: number;
  startDate?: string | null;
  endDate?: string | null;
  durationDays?: number | null;
  progress: number;
  quantity?: number | null;
  unit?: string | null;
  responsibleId?: string | null;
  manualStartLocked: boolean;
  manualEndLocked: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanejamentoV2Dependency {
  id: string;
  workspaceId: string;
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType: PlanejamentoV2DependencyType;
  lagValue: number;
  lagUnit: PlanejamentoV2LagUnit;
  createdAt: string;
}

export interface PlanejamentoV2ProjectOverview {
  project: AppControlProject;
  workspace?: PlanejamentoV2Workspace;
}

export interface CreatePlanejamentoV2TaskInput {
  title: string;
  description?: string;
  taskType: PlanejamentoV2TaskType;
  sourceProcessSettingId?: string;
  sourceProcessNameSnapshot?: string;
  startDate?: string;
  endDate?: string;
  quantity?: number;
  unit?: string;
}

export interface UpdatePlanejamentoV2TaskDatesInput {
  taskId: string;
  startDate: string;
  endDate: string;
}
