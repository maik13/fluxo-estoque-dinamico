// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useEffect } from "react";
import { supabase } from "@/planejamento-v2-original/supabaseClient";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type TableName = "batches" | "production_logs" | "production_schedule" | "inventory_items" | "time_entries" | "colaboradores" | "company_settings" | "settings";

interface UseRealtimeOptions<T> {
  table: TableName;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: T) => void;
  onChange?: () => void;
}

export function useRealtime<T extends Record<string, unknown>>({
  table,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
}: UseRealtimeOptions<T>) {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: table,
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          console.log(`[Realtime] ${table}:`, payload.eventType, payload);
          
          if (payload.eventType === "INSERT" && onInsert) {
            onInsert(payload.new as T);
          } else if (payload.eventType === "UPDATE" && onUpdate) {
            onUpdate(payload.new as T);
          } else if (payload.eventType === "DELETE" && onDelete) {
            onDelete(payload.old as T);
          }
          
          // Always call onChange for any event
          if (onChange) {
            onChange();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, onInsert, onUpdate, onDelete, onChange]);
}
