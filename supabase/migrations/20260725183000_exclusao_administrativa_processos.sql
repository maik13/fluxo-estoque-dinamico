-- Exclusão administrativa segura de etapas/processos da Produção.
-- Somente administradores ativos podem executar.
-- Etapas com apontamentos são preservadas e não podem ser excluídas.

BEGIN;

CREATE TABLE IF NOT EXISTS public.producao_processos_exclusoes_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  projeto_id UUID NOT NULL,
  processo_snapshot JSONB NOT NULL,
  total_eventos INTEGER NOT NULL DEFAULT 0,
  total_dependencias INTEGER NOT NULL DEFAULT 0,
  total_alocacoes INTEGER NOT NULL DEFAULT 0,
  total_alertas INTEGER NOT NULL DEFAULT 0,
  excluido_por_id UUID NOT NULL,
  excluido_por_nome_snapshot TEXT NOT NULL,
  justificativa TEXT NOT NULL,
  excluido_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.producao_processos_exclusoes_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS producao_processos_exclusoes_auditoria_admin_select
  ON public.producao_processos_exclusoes_auditoria;
CREATE POLICY producao_processos_exclusoes_auditoria_admin_select
  ON public.producao_processos_exclusoes_auditoria
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.obter_resumo_exclusao_processo_producao(
  p_processo_id UUID
)
RETURNS TABLE (
  processo_id UUID,
  codigo TEXT,
  nome TEXT,
  status TEXT,
  total_apontamentos BIGINT,
  total_apontamentos_conferidos BIGINT,
  total_eventos BIGINT,
  total_dependencias BIGINT,
  total_alocacoes BIGINT,
  total_alertas BIGINT,
  pode_excluir BOOLEAN,
  motivo_bloqueio TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.codigo,
    p.nome,
    p.status,
    (SELECT COUNT(*) FROM public.producao_apontamentos a WHERE a.processo_id = p.id),
    (SELECT COUNT(*) FROM public.producao_apontamentos a WHERE a.processo_id = p.id AND a.status = 'conferido'),
    (SELECT COUNT(*) FROM public.producao_processo_eventos e WHERE e.processo_id = p.id),
    (SELECT COUNT(*) FROM public.producao_processo_dependencias d WHERE d.processo_id = p.id OR d.depende_de_processo_id = p.id),
    (SELECT COUNT(*) FROM public.producao_alocacoes_diarias al WHERE al.processo_id = p.id),
    (SELECT COUNT(*) FROM public.producao_cronograma_alertas ca WHERE ca.processo_id = p.id),
    NOT EXISTS (SELECT 1 FROM public.producao_apontamentos a WHERE a.processo_id = p.id),
    CASE
      WHEN EXISTS (SELECT 1 FROM public.producao_apontamentos a WHERE a.processo_id = p.id)
        THEN 'A etapa possui apontamentos e deve ser cancelada para preservar o histórico.'
      ELSE NULL
    END
  FROM public.producao_processos p
  WHERE p.id = p_processo_id
    AND public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.excluir_processo_producao(
  p_processo_id UUID,
  p_codigo_confirmacao TEXT,
  p_justificativa TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome_usuario TEXT;
  v_processo public.producao_processos%ROWTYPE;
  v_total_apontamentos INTEGER;
  v_total_eventos INTEGER;
  v_total_dependencias INTEGER;
  v_total_alocacoes INTEGER;
  v_total_alertas INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem excluir etapas da Produção';
  END IF;

  IF BTRIM(COALESCE(p_justificativa, '')) = '' THEN
    RAISE EXCEPTION 'Informe a justificativa da exclusão';
  END IF;

  SELECT *
  INTO v_processo
  FROM public.producao_processos
  WHERE id = p_processo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada';
  END IF;

  IF BTRIM(COALESCE(p_codigo_confirmacao, '')) <> v_processo.codigo THEN
    RAISE EXCEPTION 'O código de confirmação não corresponde à etapa';
  END IF;

  SELECT COUNT(*) INTO v_total_apontamentos
  FROM public.producao_apontamentos
  WHERE processo_id = p_processo_id;

  IF v_total_apontamentos > 0 THEN
    RAISE EXCEPTION 'A etapa possui % apontamento(s) e não pode ser excluída. Cancele a etapa para preservar o histórico.', v_total_apontamentos;
  END IF;

  SELECT COUNT(*) INTO v_total_eventos
  FROM public.producao_processo_eventos
  WHERE processo_id = p_processo_id;

  SELECT COUNT(*) INTO v_total_dependencias
  FROM public.producao_processo_dependencias
  WHERE processo_id = p_processo_id OR depende_de_processo_id = p_processo_id;

  SELECT COUNT(*) INTO v_total_alocacoes
  FROM public.producao_alocacoes_diarias
  WHERE processo_id = p_processo_id;

  SELECT COUNT(*) INTO v_total_alertas
  FROM public.producao_cronograma_alertas
  WHERE processo_id = p_processo_id;

  SELECT COALESCE(p.nome, p.email, 'Administrador')
  INTO v_nome_usuario
  FROM public.profiles p
  WHERE p.user_id = v_user
  LIMIT 1;

  v_nome_usuario := COALESCE(v_nome_usuario, 'Administrador');

  INSERT INTO public.producao_processos_exclusoes_auditoria (
    processo_id,
    codigo,
    nome,
    projeto_id,
    processo_snapshot,
    total_eventos,
    total_dependencias,
    total_alocacoes,
    total_alertas,
    excluido_por_id,
    excluido_por_nome_snapshot,
    justificativa
  ) VALUES (
    v_processo.id,
    v_processo.codigo,
    v_processo.nome,
    v_processo.projeto_id,
    TO_JSONB(v_processo),
    v_total_eventos,
    v_total_dependencias,
    v_total_alocacoes,
    v_total_alertas,
    v_user,
    v_nome_usuario,
    BTRIM(p_justificativa)
  );

  DELETE FROM public.producao_processo_dependencias
  WHERE processo_id = p_processo_id OR depende_de_processo_id = p_processo_id;

  DELETE FROM public.producao_alocacoes_diarias
  WHERE processo_id = p_processo_id;

  DELETE FROM public.producao_cronograma_alertas
  WHERE processo_id = p_processo_id;

  DELETE FROM public.producao_processo_eventos
  WHERE processo_id = p_processo_id;

  DELETE FROM public.producao_processos
  WHERE id = p_processo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.obter_resumo_exclusao_processo_producao(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_processo_producao(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_resumo_exclusao_processo_producao(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_processo_producao(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
