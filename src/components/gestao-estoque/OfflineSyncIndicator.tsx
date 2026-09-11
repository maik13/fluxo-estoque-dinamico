import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  getOfflineQueueSummary,
  subscribeOfflineQueue,
  syncOfflineQueue,
  type OfflineQueueSummary,
} from '@/utils/offlineInventoryQueue';
import { toast } from '@/hooks/use-toast';

const EMPTY: OfflineQueueSummary = { pending: 0, conflict: 0, failed: 0, total: 0 };

export const OfflineSyncIndicator = () => {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [summary, setSummary] = useState<OfflineQueueSummary>(EMPTY);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setOnline(navigator.onLine);
    try {
      setSummary(await getOfflineQueueSummary());
    } catch (error) {
      console.error('Falha ao ler fila offline:', error);
    }
  }, []);

  const syncNow = useCallback(async (silent = false) => {
    if (!navigator.onLine || syncing) {
      await refresh();
      return;
    }

    setSyncing(true);
    try {
      const result = await syncOfflineQueue();
      setSummary(result);
      if (!silent) {
        if (result.pending === 0 && result.conflict === 0 && result.failed === 0) {
          toast({ title: 'Sincronização concluída', description: 'Todos os registros pendentes foram enviados ao banco.' });
        } else {
          toast({
            title: 'Sincronização parcial',
            description: `${result.pending} pendente(s), ${result.conflict} conflito(s) e ${result.failed} falha(s).`,
          });
        }
      }
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh, syncing]);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeOfflineQueue(() => {
      void refresh();
      if (navigator.onLine) void syncNow(true);
    });

    const timer = window.setInterval(() => {
      if (navigator.onLine) void syncNow(true);
      else void refresh();
    }, 15000);

    if (navigator.onLine) void syncNow(true);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [refresh]);

  const hasProblem = summary.conflict > 0 || summary.failed > 0;
  const label = !online
    ? `Offline · ${summary.pending} protegido(s)`
    : hasProblem
      ? `${summary.conflict + summary.failed} requer(em) revisão`
      : summary.pending > 0
        ? `${summary.pending} aguardando sincronização`
        : 'Online · sincronizado';

  const Icon = !online ? CloudOff : hasProblem ? AlertTriangle : Wifi;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 px-2 sm:px-3"
            onClick={() => void syncNow(false)}
            disabled={syncing || (!online && summary.pending === 0)}
          >
            {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
            <span className="hidden xl:inline text-xs">{label}</span>
            {summary.total > 0 && (
              <span className="min-w-5 rounded-full bg-muted px-1.5 text-xs tabular-nums">
                {summary.total}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            Pendentes: {summary.pending} · Conflitos: {summary.conflict} · Falhas: {summary.failed}
          </p>
          {!online && summary.pending > 0 && (
            <p className="text-xs mt-1">Os registros estão guardados neste dispositivo e serão enviados quando a conexão voltar.</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
