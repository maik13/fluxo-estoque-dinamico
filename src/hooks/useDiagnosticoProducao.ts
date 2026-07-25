import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatarErroSupabase } from '@/utils/supabaseError';

export interface DiagnosticoProducao {
  ok: boolean;
  funcoes_ausentes: string[];
  verificado_em?: string;
  erro?: string;
}

export const useDiagnosticoProducao = () => {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoProducao | null>(null);
  const [verificando, setVerificando] = useState(false);

  const verificar = useCallback(async () => {
    setVerificando(true);
    try {
      const { data, error } = await (supabase.rpc as any)('diagnosticar_integridade_modulo_producao');

      if (error) {
        const mensagem = formatarErroSupabase(
          error,
          'Não foi possível verificar a integridade do Módulo de Produção.',
        );
        const resultado: DiagnosticoProducao = {
          ok: false,
          funcoes_ausentes: [],
          erro: mensagem.includes('diagnosticar_integridade_modulo_producao')
            ? 'A migration consolidada de integridade ainda não foi aplicada no Supabase.'
            : mensagem,
        };
        setDiagnostico(resultado);
        return resultado;
      }

      const resultado = (data ?? {}) as DiagnosticoProducao;
      const normalizado: DiagnosticoProducao = {
        ok: Boolean(resultado.ok),
        funcoes_ausentes: Array.isArray(resultado.funcoes_ausentes)
          ? resultado.funcoes_ausentes.map(String)
          : [],
        verificado_em: resultado.verificado_em,
      };
      setDiagnostico(normalizado);
      return normalizado;
    } finally {
      setVerificando(false);
    }
  }, []);

  return { diagnostico, verificando, verificar };
};
