-- Corrige as políticas de leitura do módulo Produção para usar o sistema
-- atual de permissões individuais/perfil, mantendo compatibilidade com a
-- tabela legada producao_permissoes.

BEGIN;

CREATE OR REPLACE FUNCTION public.pode_acessar_modulo_producao_atual(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_permitido BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;

  -- Sistema atual: BI Produção não libera o módulo Produção.
  BEGIN
    v_permitido :=
      public.permissao_individual_efetiva(p_user_id, 'pode_apontar_producao')
      OR public.permissao_individual_efetiva(p_user_id, 'pode_conferir_producao')
      OR public.permissao_individual_efetiva(p_user_id, 'pode_configurar_producao');
  EXCEPTION WHEN undefined_function THEN
    v_permitido := FALSE;
  END;

  IF v_permitido THEN
    RETURN TRUE;
  END IF;

  -- Compatibilidade com o sistema legado de permissões da Produção.
  BEGIN
    v_permitido := public.usuario_tem_permissao_producao('visualizar');
  EXCEPTION WHEN undefined_function THEN
    v_permitido := FALSE;
  END;

  RETURN COALESCE(v_permitido, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.pode_acessar_modulo_producao_atual(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_acessar_modulo_producao_atual(UUID) TO authenticated;

DROP POLICY IF EXISTS producao_projetos_leitura ON public.producao_projetos;
CREATE POLICY producao_projetos_leitura
  ON public.producao_projetos
  FOR SELECT
  TO authenticated
  USING (public.pode_acessar_modulo_producao_atual(auth.uid()));

DROP POLICY IF EXISTS producao_processos_leitura ON public.producao_processos;
CREATE POLICY producao_processos_leitura
  ON public.producao_processos
  FOR SELECT
  TO authenticated
  USING (public.pode_acessar_modulo_producao_atual(auth.uid()));

COMMIT;
