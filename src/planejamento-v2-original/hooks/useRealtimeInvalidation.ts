// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/planejamento-v2-original/supabaseClient";

export function useRealtimeInvalidation(queryKeys: string[]) {
  const queryClient = useQueryClient();
  const queryKeySignature = queryKeys.join("|");

  useEffect(() => {
    const keys = queryKeySignature.split("|").filter(Boolean);
    const invalidateAll = () => {
      keys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    };
    const channelName = `realtime-invalidation-${queryKeySignature.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_logs" },
        invalidateAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordens_producao" },
        invalidateAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "batches" },
        invalidateAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movimentacoes_materiais" },
        invalidateAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_items" },
        invalidateAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_settings" },
        invalidateAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        invalidateAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_production_targets" },
        invalidateAll,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, queryKeySignature]);
}
