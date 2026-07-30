import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProducaoPresetPintura } from '@/types/producao';
import { formatarErroSupabase } from '@/utils/supabaseError';

export interface PresetPinturaInput {
  id?: string | null;
  nome: string;
  comprimento_ripa_m: number;
  largura_ripa_cm: number;
  ripas_por_painel: number;
  consumo_miolo_ml_por_ripa: number;
  consumo_casca_ml_por_ripa: number;
  ativo: boolean;
}

const erro = (value: unknown, fallback: string) =>
  new Error(formatarErroSupabase(value, fallback));

const normalizar = (item: any): ProducaoPresetPintura => ({
  ...item,
  comprimento_ripa_m: Number(item.comprimento_ripa_m),
  largura_ripa_cm: Number(item.largura_ripa_cm),
  ripas_por_painel: Number(item.ripas_por_painel),
  consumo_miolo_ml_por_ripa: Number(item.consumo_miolo_ml_por_ripa),
  consumo_casca_ml_por_ripa: Number(item.consumo_casca_ml_por_ripa),
});

export const usePresetsPintura = () => {
  const [presets, setPresets] = useState<ProducaoPresetPintura[]>([]);
  const [loading, setLoading] = useState(false);

  const listarPresets = useCallback(async (somenteAtivos = false) => {
    setLoading(true);
    try {
      let consulta = (supabase.from as any)('producao_presets_pintura')
        .select('*')
        .order('nome');
      if (somenteAtivos) consulta = consulta.eq('ativo', true);
      const { data, error } = await consulta;
      if (error) throw erro(error, 'Não foi possível carregar os presets de pintura.');
      const resultado = (data ?? []).map(normalizar) as ProducaoPresetPintura[];
      setPresets(resultado);
      return resultado;
    } finally {
      setLoading(false);
    }
  }, []);

  const salvarPreset = useCallback(async (dados: PresetPinturaInput) => {
    const { data: id, error } = await (supabase.rpc as any)('salvar_preset_pintura_producao', {
      p_id: dados.id ?? null,
      p_nome: dados.nome,
      p_comprimento_ripa_m: dados.comprimento_ripa_m,
      p_largura_ripa_cm: dados.largura_ripa_cm,
      p_ripas_por_painel: dados.ripas_por_painel,
      p_consumo_miolo_ml_por_ripa: dados.consumo_miolo_ml_por_ripa,
      p_consumo_casca_ml_por_ripa: dados.consumo_casca_ml_por_ripa,
      p_ativo: dados.ativo,
    });
    if (error) throw erro(error, 'Não foi possível salvar o preset de pintura.');
    const atualizados = await listarPresets(false);
    const salvo = atualizados.find((item) => item.id === id);
    if (!salvo) throw new Error('O preset foi salvo, mas não pôde ser recarregado.');
    return salvo;
  }, [listarPresets]);

  return { presets, loading, listarPresets, salvarPreset };
};
