-- Exclusão administrativa simplificada da Produção.
-- Um administrador pode excluir uma Etapa com suas OPs e apontamentos,
-- inclusive apontamentos conferidos, mediante confirmação simples na interface.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND COALESCE(p.ativo, FALSE) = TRUE
      AND p.tipo_usuario = 'administrador'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.producao_etapas_expurgos_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  projeto_id UUID NOT NULL,
  processo_snapshot JSONB NOT NULL,
  ordens_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB,
  apontamentos_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB,
  totais JSONB NOT NULL,
  expurgado_por_id UUID NOT NULL,
  expurgado_por_nome_snapshot TEXT NOT NULL,
  justificativa TEXT NOT NULL,
  expurgado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.producao_etapas_expurgos_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS producao_etapas_expurgos_auditoria_admin_select
  ON public.producao_etapas_expurgos_auditoria;
CREATE POLICY producao_etapas_expurgos_auditoria_admin_select
  ON public.producao_etapas_expurgos_auditoria
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP FUNCTION IF EXISTS public.obter_resumo_exclusao_processo_producao(UUID);
CREATE FUNCTION public.obter_resumo_exclusao_processo_producao(
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
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_processo public.producao_processos%ROWTYPE;
  v_total_apontamentos BIGINT := 0;
  v_total_conferidos BIGINT := 0;
  v_total_eventos BIGINT := 0;
  v_total_dependencias BIGINT := 0;
  v_total_alocacoes BIGINT := 0;
  v_total_alertas BIGINT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  SELECT * INTO v_processo
  FROM public.producao_processos p
  WHERE p.id = p_processo_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE a.status = 'conferido')
  INTO v_total_apontamentos, v_total_conferidos
  FROM public.producao_apontamentos a
  WHERE a.processo_id = p_processo_id
     OR a.ordem_producao_id IN (
       SELECT o.id
       FROM public.producao_ordens_producao o
       WHERE o.processo_id = p_processo_id
     );

  IF to_regclass('public.producao_processo_eventos') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.producao_processo_eventos WHERE processo_id = $1'
      INTO v_total_eventos USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_processo_dependencias') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.producao_processo_dependencias WHERE processo_id = $1 OR depende_de_processo_id = $1'
      INTO v_total_dependencias USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_alocacoes_diarias') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.producao_alocacoes_diarias WHERE processo_id = $1'
      INTO v_total_alocacoes USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_cronograma_alertas') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.producao_cronograma_alertas WHERE processo_id = $1'
      INTO v_total_alertas USING p_processo_id;
  END IF;

  RETURN QUERY SELECT
    v_processo.id,
    v_processo.codigo,
    v_processo.nome,
    v_processo.status,
    v_total_apontamentos,
    v_total_conferidos,
    v_total_eventos,
    v_total_dependencias,
    v_total_alocacoes,
    v_total_alertas,
    TRUE,
    NULL::TEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.excluir_processo_producao(UUID, TEXT, TEXT);
CREATE FUNCTION public.excluir_processo_producao(
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
  v_ordens JSONB := '[]'::JSONB;
  v_apontamentos JSONB := '[]'::JSONB;
  v_total_ops BIGINT := 0;
  v_total_apontamentos BIGINT := 0;
  v_total_conferidos BIGINT := 0;
  v_total_materiais_etapa BIGINT := 0;
  v_total_materiais_op BIGINT := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem excluir Etapas da Produção';
  END IF;

  SELECT * INTO v_processo
  FROM public.producao_processos p
  WHERE p.id = p_processo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_codigo_confirmacao, '')), '') IS NOT NULL
     AND BTRIM(p_codigo_confirmacao) <> v_processo.codigo THEN
    RAISE EXCEPTION 'O código de confirmação não corresponde à Etapa';
  END IF;

  SELECT COUNT(*) INTO v_total_ops
  FROM public.producao_ordens_producao o
  WHERE o.processo_id = p_processo_id;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE a.status = 'conferido')
  INTO v_total_apontamentos, v_total_conferidos
  FROM public.producao_apontamentos a
  WHERE a.processo_id = p_processo_id
     OR a.ordem_producao_id IN (
       SELECT o.id
       FROM public.producao_ordens_producao o
       WHERE o.processo_id = p_processo_id
     );

  SELECT COALESCE(JSONB_AGG(TO_JSONB(o) ORDER BY o.numero), '[]'::JSONB)
  INTO v_ordens
  FROM public.producao_ordens_producao o
  WHERE o.processo_id = p_processo_id;

  SELECT COALESCE(JSONB_AGG(TO_JSONB(a) ORDER BY a.created_at, a.id), '[]'::JSONB)
  INTO v_apontamentos
  FROM public.producao_apontamentos a
  WHERE a.processo_id = p_processo_id
     OR a.ordem_producao_id IN (
       SELECT o.id
       FROM public.producao_ordens_producao o
       WHERE o.processo_id = p_processo_id
     );

  IF to_regclass('public.producao_etapa_materiais') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.producao_etapa_materiais WHERE processo_id = $1'
      INTO v_total_materiais_etapa USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_ordem_materiais') IS NOT NULL THEN
    EXECUTE $q$
      SELECT COUNT(*)
      FROM public.producao_ordem_materiais om
      WHERE om.ordem_producao_id IN (
        SELECT o.id
        FROM public.producao_ordens_producao o
        WHERE o.processo_id = $1
      )
    $q$ INTO v_total_materiais_op USING p_processo_id;
  END IF;

  SELECT COALESCE(
    (SELECT NULLIF(BTRIM(p.nome), '') FROM public.profiles p WHERE p.user_id = v_user LIMIT 1),
    (SELECT u.email FROM auth.users u WHERE u.id = v_user),
    'Administrador'
  ) INTO v_nome_usuario;

  INSERT INTO public.producao_etapas_expurgos_auditoria (
    processo_id,
    codigo,
    nome,
    projeto_id,
    processo_snapshot,
    ordens_snapshot,
    apontamentos_snapshot,
    totais,
    expurgado_por_id,
    expurgado_por_nome_snapshot,
    justificativa
  ) VALUES (
    v_processo.id,
    v_processo.codigo,
    v_processo.nome,
    v_processo.projeto_id,
    TO_JSONB(v_processo),
    v_ordens,
    v_apontamentos,
    JSONB_BUILD_OBJECT(
      'ops', v_total_ops,
      'apontamentos', v_total_apontamentos,
      'apontamentos_conferidos', v_total_conferidos,
      'materiais_etapa', v_total_materiais_etapa,
      'materiais_op', v_total_materiais_op
    ),
    v_user,
    COALESCE(v_nome_usuario, 'Administrador'),
    COALESCE(NULLIF(BTRIM(p_justificativa), ''), 'Exclusão administrativa confirmada.')
  );

  -- Remove primeiro os registros mais dependentes. As verificações tornam a
  -- rotina compatível com bancos que ainda não receberam todas as migrations.
  IF to_regclass('public.producao_apontamento_anexos') IS NOT NULL THEN
    EXECUTE $q$
      DELETE FROM public.producao_apontamento_anexos aa
      WHERE aa.apontamento_id IN (
        SELECT a.id
        FROM public.producao_apontamentos a
        WHERE a.processo_id = $1
           OR a.ordem_producao_id IN (
             SELECT o.id FROM public.producao_ordens_producao o
             WHERE o.processo_id = $1
           )
      )
    $q$ USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_apontamento_membros') IS NOT NULL THEN
    EXECUTE $q$
      DELETE FROM public.producao_apontamento_membros am
      WHERE am.apontamento_id IN (
        SELECT a.id
        FROM public.producao_apontamentos a
        WHERE a.processo_id = $1
           OR a.ordem_producao_id IN (
             SELECT o.id FROM public.producao_ordens_producao o
             WHERE o.processo_id = $1
           )
      )
    $q$ USING p_processo_id;
  END IF;

  DELETE FROM public.producao_apontamentos a
  WHERE a.processo_id = p_processo_id
     OR a.ordem_producao_id IN (
       SELECT o.id
       FROM public.producao_ordens_producao o
       WHERE o.processo_id = p_processo_id
     );

  IF to_regclass('public.producao_ordem_materiais') IS NOT NULL THEN
    EXECUTE $q$
      DELETE FROM public.producao_ordem_materiais om
      WHERE om.ordem_producao_id IN (
        SELECT o.id FROM public.producao_ordens_producao o
        WHERE o.processo_id = $1
      )
    $q$ USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_ordem_eventos') IS NOT NULL THEN
    EXECUTE $q$
      DELETE FROM public.producao_ordem_eventos oe
      WHERE oe.ordem_producao_id IN (
        SELECT o.id FROM public.producao_ordens_producao o
        WHERE o.processo_id = $1
      )
    $q$ USING p_processo_id;
  END IF;

  DELETE FROM public.producao_ordens_producao o
  WHERE o.processo_id = p_processo_id;

  IF to_regclass('public.producao_etapa_materiais') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.producao_etapa_materiais WHERE processo_id = $1'
      USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_processo_dependencias') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.producao_processo_dependencias WHERE processo_id = $1 OR depende_de_processo_id = $1'
      USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_alocacoes_diarias') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.producao_alocacoes_diarias WHERE processo_id = $1'
      USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_cronograma_alertas') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.producao_cronograma_alertas WHERE processo_id = $1'
      USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_processo_eventos') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.producao_processo_eventos WHERE processo_id = $1'
      USING p_processo_id;
  END IF;

  DELETE FROM public.producao_processos p
  WHERE p.id = p_processo_id;

  IF to_regprocedure('public.recalcular_cronograma_producao_interno(uuid,text)') IS NOT NULL THEN
    PERFORM public.recalcular_cronograma_producao_interno(
      v_user,
      COALESCE(v_nome_usuario, 'Administrador')
    );
  END IF;
END;
$$;

-- Exclusão administrativa individual de apontamento, disponível para uso no
-- Histórico quando necessário. Aceita apontamentos pendentes ou conferidos.
CREATE OR REPLACE FUNCTION public.excluir_apontamento_producao_admin(
  p_apontamento_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_ordem_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem excluir apontamentos';
  END IF;

  SELECT a.ordem_producao_id INTO v_ordem_id
  FROM public.producao_apontamentos a
  WHERE a.id = p_apontamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apontamento não encontrado';
  END IF;

  DELETE FROM public.producao_apontamentos
  WHERE id = p_apontamento_id;

  IF v_ordem_id IS NOT NULL
     AND to_regprocedure('public.atualizar_status_ordem_producao(uuid)') IS NOT NULL THEN
    PERFORM public.atualizar_status_ordem_producao(v_ordem_id);
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.obter_resumo_expurgo_etapa_teste(UUID);
DROP FUNCTION IF EXISTS public.expurgar_etapa_producao_teste(UUID, TEXT, TEXT, TEXT);

REVOKE ALL ON FUNCTION public.obter_resumo_exclusao_processo_producao(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_processo_producao(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_apontamento_producao_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_resumo_exclusao_processo_producao(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_processo_producao(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_apontamento_producao_admin(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
