import { useCallback, useEffect, useState } from 'react';
import {
  Database,
  Files,
  HardDrive,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

interface CloudStorageUsage {
  database_bytes: number;
  storage_bytes: number;
  storage_objects: number;
  total_bytes: number;
  history_days: number;
  daily_growth_bytes: number | null;
  projected_30_bytes: number | null;
  projected_90_bytes: number | null;
  capacity_mode: 'credits';
  capacity_note: string;
}

interface StorageHealth {
  product_photo_objects: number;
  product_photo_bytes: number;
  orphan_objects: number;
  orphan_bytes: number;
  broken_item_photo_refs: number;
  duplicate_groups_live: number;
  duplicate_extra_copies_live: number;
  duplicate_extra_bytes_live: number;
  bucket_file_size_limit: number;
  bucket_allowed_mime_types: string[];
}

interface StorageOrphan {
  name: string;
  size_bytes: number;
}

const formatBytes = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined || !Number.isFinite(Number(bytes))) return '—';
  const value = Number(bytes);
  if (value < 1024) return `${value.toFixed(0)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let current = value / 1024;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  const decimals = current >= 100 ? 0 : current >= 10 ? 1 : 2;
  return `${current.toFixed(decimals)} ${units[unitIndex]}`;
};

const chunk = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

export const CloudStorageIndicator = () => {
  const [usage, setUsage] = useState<CloudStorageUsage | null>(null);
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin } = usePermissions();

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: usageData, error: usageError }, { data: healthData, error: healthError }] = await Promise.all([
        (supabase as any).rpc('get_cloud_storage_usage'),
        (supabase as any).rpc('get_storage_health'),
      ]);

      if (usageError) throw usageError;
      if (healthError) throw healthError;

      setUsage(usageData as CloudStorageUsage);
      setHealth(healthData as StorageHealth);
    } catch (err) {
      console.error('Erro ao consultar uso do Lovable Cloud:', err);
      setError('Não foi possível consultar o uso agora.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const limparOrfaos = async () => {
    if (!isAdmin()) {
      toast.error('A limpeza de armazenamento é restrita ao administrador.');
      return;
    }

    const quantidade = Number(health?.orphan_objects || 0);
    if (quantidade === 0) {
      toast.success('Nenhum arquivo órfão encontrado.');
      return;
    }

    const confirmou = window.confirm(
      `Foram encontrados ${quantidade} arquivo(s) órfão(s), sem vínculo com itens ou mensagens. Deseja excluí-los definitivamente do Storage?`,
    );
    if (!confirmou) return;

    setCleaning(true);
    try {
      const { data, error: listError } = await (supabase as any).rpc('get_storage_orphans');
      if (listError) throw listError;

      const orfaos = ((data || []) as StorageOrphan[]).filter((item) => item?.name);
      if (orfaos.length === 0) {
        toast.success('Nenhum arquivo órfão encontrado.');
        await carregar();
        return;
      }

      const bytesAntes = orfaos.reduce((total, item) => total + Number(item.size_bytes || 0), 0);
      let removidos = 0;

      for (const lote of chunk(orfaos.map((item) => item.name), 50)) {
        const { error: removeError } = await supabase.storage.from('product-photos').remove(lote);
        if (removeError) throw removeError;
        removidos += lote.length;
      }

      const { data: healthAfter, error: healthAfterError } = await (supabase as any).rpc('get_storage_health');
      if (healthAfterError) throw healthAfterError;

      const validacao = healthAfter as StorageHealth;
      setHealth(validacao);
      await carregar();

      if (Number(validacao.orphan_objects || 0) === 0 && Number(validacao.broken_item_photo_refs || 0) === 0) {
        toast.success(`${removidos} arquivo(s) órfão(s) removido(s). Espaço liberado: ${formatBytes(bytesAntes)}.`);
      } else {
        toast.warning(
          `Limpeza executada, mas a auditoria ainda encontrou ${validacao.orphan_objects} órfão(s) e ${validacao.broken_item_photo_refs} referência(s) quebrada(s).`,
        );
      }
    } catch (err) {
      console.error('Erro ao limpar arquivos órfãos:', err);
      toast.error('A limpeza não foi concluída. Nenhuma deduplicação foi executada.');
      await carregar();
    } finally {
      setCleaning(false);
    }
  };

  const storageShare = usage?.total_bytes
    ? Math.min(100, Math.max(0, (usage.storage_bytes / usage.total_bytes) * 100))
    : 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 border border-border/70 bg-muted/40 px-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Uso de armazenamento do Lovable Cloud"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
          <span className="hidden lg:inline text-xs font-medium">
            {usage ? formatBytes(usage.total_bytes) : 'Cloud'}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[390px] p-0">
        <div className="border-b p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Armazenamento do Lovable Cloud</p>
              <p className="mt-1 text-xs text-muted-foreground">Banco de dados + arquivos armazenados</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void carregar()} disabled={loading || cleaning} title="Atualizar">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : loading && !usage ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando uso...
            </div>
          ) : usage ? (
            <>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Uso atual</p>
                <p className="mt-1 text-2xl font-bold">{formatBytes(usage.total_bytes)}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${storageShare}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span>Arquivos {formatBytes(usage.storage_bytes)}</span>
                  <span>Banco {formatBytes(usage.database_bytes)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <HardDrive className="h-3.5 w-3.5" /> Arquivos
                  </div>
                  <p className="mt-1 font-semibold">{usage.storage_objects.toLocaleString('pt-BR')} objetos</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Database className="h-3.5 w-3.5" /> Banco
                  </div>
                  <p className="mt-1 font-semibold">{formatBytes(usage.database_bytes)}</p>
                </div>
              </div>

              {health && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <ShieldCheck className="h-4 w-4" /> Saúde do armazenamento
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-muted/40 p-2">
                      <p className="text-[11px] text-muted-foreground">Órfãos</p>
                      <p className="font-semibold">{health.orphan_objects} · {formatBytes(health.orphan_bytes)}</p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-2">
                      <p className="text-[11px] text-muted-foreground">Referências quebradas</p>
                      <p className="font-semibold">{health.broken_item_photo_refs}</p>
                    </div>
                    <div className="col-span-2 rounded-md bg-muted/40 p-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Files className="h-3.5 w-3.5" /> Duplicação identificada
                      </div>
                      <p className="font-semibold">
                        {health.duplicate_extra_copies_live} cópia(s) redundante(s) · potencial {formatBytes(health.duplicate_extra_bytes_live)}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">A deduplicação é uma etapa separada e não é executada por este botão.</p>
                    </div>
                  </div>

                  {isAdmin() && health.orphan_objects > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => void limparOrfaos()}
                      disabled={cleaning}
                    >
                      {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      {cleaning ? 'Limpando e validando...' : `Excluir ${health.orphan_objects} arquivo(s) órfão(s)`}
                    </Button>
                  )}
                </div>
              )}

              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <TrendingUp className="h-4 w-4" /> Previsão de crescimento
                </div>
                {usage.history_days > 0 && usage.projected_30_bytes !== null ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Em 30 dias</p>
                      <p className="font-semibold">{formatBytes(usage.projected_30_bytes)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Em 90 dias</p>
                      <p className="font-semibold">{formatBytes(usage.projected_90_bytes)}</p>
                    </div>
                    <p className="col-span-2 text-[11px] text-muted-foreground">
                      Estimativa calculada pelo crescimento médio observado em {usage.history_days} dia(s).
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Previsão em formação. O sistema começou a registrar o histórico agora; após existir histórico entre dias diferentes, a projeção de 30 e 90 dias aparecerá automaticamente.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <div className="text-xs">
                    <p className="font-medium">Capacidade disponível: variável por créditos</p>
                    <p className="mt-1 text-muted-foreground">
                      O Lovable Cloud não fornece ao aplicativo um teto fixo em GB. Por isso este painel mostra o consumo real e a projeção de crescimento, sem inventar uma capacidade máxima.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
};
