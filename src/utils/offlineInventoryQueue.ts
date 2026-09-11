import { supabase } from '@/integrations/supabase/client';

export type OfflineOperationType = 'item_update' | 'item_create' | 'movement_insert';
export type OfflineOperationStatus = 'pending' | 'conflict' | 'failed';

export interface OfflineOperation {
  id: string;
  userId: string;
  type: OfflineOperationType;
  payload: Record<string, unknown>;
  status: OfflineOperationStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

export interface OfflineQueueSummary {
  pending: number;
  conflict: number;
  failed: number;
  total: number;
}

export interface ResilientSubmitResult {
  ok: boolean;
  queued: boolean;
  status?: string;
  message?: string;
  data?: any;
}

const DB_NAME = 'fluxo-estoque-offline-v1';
const DB_VERSION = 1;
const STORE_NAME = 'operations';
const EVENT_NAME = 'inventory-offline-queue-changed';

const emitChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
};

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('status', 'status', { unique: false });
      store.createIndex('userId', 'userId', { unique: false });
      store.createIndex('createdAt', 'createdAt', { unique: false });
    }
  };

  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Falha ao abrir fila offline.'));
});

const withStore = async <T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = fn(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha na fila offline.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error('Falha na transação da fila offline.'));
  });
};

const getCurrentUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
};

export const createOperationId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

export const enqueueOfflineOperation = async (
  type: OfflineOperationType,
  payload: Record<string, unknown>,
  operationId = createOperationId(),
): Promise<OfflineOperation> => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sessão não encontrada para proteger o lançamento offline.');

  const now = new Date().toISOString();
  const operation: OfflineOperation = {
    id: operationId,
    userId,
    type,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };

  await withStore('readwrite', store => store.put(operation));
  emitChange();
  return operation;
};

export const listOfflineOperations = async (): Promise<OfflineOperation[]> => {
  const items = await withStore<OfflineOperation[]>('readonly', store => store.getAll());
  return (items ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const getOfflineQueueSummary = async (): Promise<OfflineQueueSummary> => {
  const userId = await getCurrentUserId();
  const items = (await listOfflineOperations()).filter(item => !userId || item.userId === userId);
  const pending = items.filter(item => item.status === 'pending').length;
  const conflict = items.filter(item => item.status === 'conflict').length;
  const failed = items.filter(item => item.status === 'failed').length;
  return { pending, conflict, failed, total: pending + conflict + failed };
};

const deleteOperation = async (id: string) => {
  await withStore('readwrite', store => store.delete(id));
  emitChange();
};

const updateOperation = async (operation: OfflineOperation) => {
  await withStore('readwrite', store => store.put(operation));
  emitChange();
};

const normalizeError = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const anyError = error as any;
    return [anyError.message, anyError.details, anyError.hint]
      .filter(Boolean)
      .join(' - ') || JSON.stringify(anyError);
  }
  return 'Erro desconhecido';
};

export const isTransientConnectionError = (error: unknown): boolean => {
  const message = normalizeError(error).toLowerCase();
  return (
    !navigator.onLine ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('statement timeout') ||
    message.includes('connection') ||
    message.includes('fetch') ||
    message.includes('gateway') ||
    message.includes('temporarily unavailable')
  );
};

const sendOperation = async (operation: OfflineOperation): Promise<any> => {
  const { data, error } = await (supabase as any).rpc('apply_offline_inventory_operation', {
    p_operation_id: operation.id,
    p_operation_type: operation.type,
    p_payload: operation.payload,
  });
  if (error) throw error;
  return data;
};

export const submitInventoryOperation = async (
  type: OfflineOperationType,
  payload: Record<string, unknown>,
  operationId = createOperationId(),
): Promise<ResilientSubmitResult> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ok: false, queued: false, status: 'unauthenticated', message: 'Sessão expirada.' };
  }

  const operation: OfflineOperation = {
    id: operationId,
    userId,
    type,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!navigator.onLine) {
    await withStore('readwrite', store => store.put(operation));
    emitChange();
    return { ok: true, queued: true, status: 'pending', message: 'Registro protegido neste dispositivo e aguardando conexão.' };
  }

  try {
    const data = await sendOperation(operation);
    if (data?.status === 'applied' || data?.replayed === true) {
      return { ok: true, queued: false, status: data?.status, message: data?.message, data };
    }
    return { ok: false, queued: false, status: data?.status, message: data?.message, data };
  } catch (error) {
    if (!isTransientConnectionError(error)) {
      return { ok: false, queued: false, status: 'error', message: normalizeError(error) };
    }

    operation.lastError = normalizeError(error);
    operation.updatedAt = new Date().toISOString();
    await withStore('readwrite', store => store.put(operation));
    emitChange();
    return {
      ok: true,
      queued: true,
      status: 'pending',
      message: 'A conexão falhou durante o salvamento. O registro foi protegido e será sincronizado automaticamente.',
    };
  }
};

export const syncOfflineQueue = async (): Promise<OfflineQueueSummary> => {
  if (!navigator.onLine) return getOfflineQueueSummary();

  const userId = await getCurrentUserId();
  if (!userId) return getOfflineQueueSummary();

  const operations = (await listOfflineOperations())
    .filter(item => item.userId === userId && item.status === 'pending')
    .slice(0, 50);

  for (const operation of operations) {
    try {
      const data = await sendOperation(operation);
      if (data?.status === 'applied' || data?.replayed === true) {
        await deleteOperation(operation.id);
        continue;
      }

      operation.status = data?.status === 'conflict' ? 'conflict' : 'failed';
      operation.attempts += 1;
      operation.lastError = data?.message || 'O servidor não aceitou a operação.';
      operation.updatedAt = new Date().toISOString();
      await updateOperation(operation);
    } catch (error) {
      operation.attempts += 1;
      operation.lastError = normalizeError(error);
      operation.updatedAt = new Date().toISOString();

      if (isTransientConnectionError(error)) {
        await updateOperation(operation);
        break;
      }

      operation.status = 'failed';
      await updateOperation(operation);
    }
  }

  return getOfflineQueueSummary();
};

export const subscribeOfflineQueue = (callback: () => void): (() => void) => {
  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
};
