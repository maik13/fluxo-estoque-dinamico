-- Reparo idempotente das RPCs de expurgo de Etapas de teste.
-- Esta migration recria as funções esperadas pelo frontend e força a recarga do schema.

BEGIN;

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

DROP FUNCTION IF EXISTS public.obter_resumo_expurgo_etapa_teste(UUID);
CREATE FUNCTION public.obter_resumo_expurgo_etapa_teste(
  p_processo_id UUID
)
RETURNS TABLE (
  processo_id UUID,
  codigo TEXT,
  nome TEXT,
  status TEXT,
  total_ops BIGINT,
  total_apontamentos BIGINT,
  total_apontamentos_conferidos BIGINT,
  total_anexos BIGINT,
  total_materiais_etapa BIGINT,
  total_materiais_op BIGINT,
  total_solicitacoes_material BIGINT,
  total_retiradas BIGINT,
  total_materiais_oficiais BIGINT,
  pode_expurgar BOOLEAN,
  motivo_bloqueio TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_processo public.producao_processos%ROWTYPE;
  v_total_ops BIGINT := 0;
  v_total_apontamentos BIGINT := 0;
  v_total_apontamentos_conferidos BIGINT := 0;
  v_total_anexos BIGINT := 0;
  v_total_materiais_etapa BIGINT := 0;
  v_total_materiais_op BIGINT := 0;
  v_total_solicitacoes_material BIGINT := 0;
  v_total_retiradas BIGINT := 0;
  v_total_materiais_oficiais BIGINT := 0;
  v_pode_expurgar BOOLEAN;
  v_motivo TEXT;
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

  SELECT COUNT(*) INTO v_total_ops
  FROM public.producao_ordens_producao o
  WHERE o.processo_id = p_processo_id;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE a.status = 'conferido')
  INTO v_total_apontamentos, v_total_apontamentos_conferidos
  FROM public.producao_apontamentos a
  WHERE a.processo_id = p_processo_id
     OR a.ordem_producao_id IN (
       SELECT o.id FROM public.producao_ordens_producao o
       WHERE o.processo_id = p_processo_id
     );

  IF to_regclass('public.producao_apontamento_anexos') IS NOT NULL THEN
    EXECUTE $q$
      SELECT COUNT(*)
      FROM public.producao_apontamento_anexos aa
      WHERE aa.apontamento_id IN (
        SELECT a.id
        FROM public.producao_apontamentos a
        WHERE a.processo_id = $1
           OR a.ordem_producao_id IN (
             SELECT o.id FROM public.producao_ordens_producao o
             WHERE o.processo_id = $1
           )
      )
    $q$ INTO v_total_anexos USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_etapa_materiais') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.producao_etapa_materiais WHERE processo_id = $1'
      INTO v_total_materiais_etapa USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_ordem_materiais') IS NOT NULL THEN
    EXECUTE $q$
      SELECT COUNT(*)
      FROM public.producao_ordem_materiais om
      WHERE om.ordem_producao_id IN (
        SELECT o.id FROM public.producao_ordens_producao o
        WHERE o.processo_id = $1
      )
    $q$ INTO v_total_materiais_op USING p_processo_id;
  END IF;

  IF to_regclass('public.solicitacoes_material') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'solicitacoes_material'
         AND column_name = 'processo_id'
     )
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'solicitacoes_material'
         AND column_name = 'ordem_producao_id'
     ) THEN
    EXECUTE $q$
      SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE sm.solicitacao_retirada_id IS NOT NULL)
      FROM public.solicitacoes_material sm
      WHERE sm.processo_id = $1
         OR sm.ordem_producao_id IN (
           SELECT o.id FROM public.producao_ordens_producao o
           WHERE o.processo_id = $1
         )
    $q$ INTO v_total_solicitacoes_material, v_total_retiradas USING p_processo_id;
  END IF;

  IF to_regclass('public.producao_materiais_projeto') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'producao_materiais_projeto'
         AND column_name = 'apontamento_id'
     ) THEN
    EXECUTE $q$
      SELECT COUNT(*)
      FROM public.producao_materiais_projeto mp
      WHERE mp.apontamento_id IN (
        SELECT a.id
        FROM public.producao_apontamentos a
        WHERE a.processo_id = $1
           OR a.ordem_producao_id IN (
             SELECT o.id FROM public.producao_ordens_producao o
             WHERE o.processo_id = $1
           )
      )
    $q$ INTO v_total_materiais_oficiais USING p_processo_id;
  END IF;

  v_pode_expurgar :=
    v_total_anexos = 0
    AND v_total_solicitacoes_material = 0
    AND v_total_retiradas = 0
    AND v_total_materiais_oficiais = 0;

  v_motivo := CASE
    WHEN v_total_solicitacoes_material > 0
      THEN 'A Etapa possui Solicitação de Material e não pode ser expurgada.'
    WHEN v_total_retiradas > 0
      THEN 'A Etapa possui retirada vinculada e não pode ser expurgada.'
    WHEN v_total_materiais_oficiais > 0
      THEN 'A Etapa possui material ligado a movimentação oficial de estoque.'
    WHEN v_total_anexos > 0
      THEN 'A Etapa possui fotos. Exclua os anexos antes do expurgo.'
    ELSE NULL
  END;

  RETURN QUERY SELECT
    v_processo.id,
    v_processo.codigo,
    v_processo.nome,
    v_processo.status,
    v_total_ops,
    v_total_apontamentos,
    v_total_apontamentos_conferidos,
    v_total_anexos,
    v_total_materiais_etapa,
    v_total_materiais_op,
    v_total_solicitacoes_material,
    v_total_retiradas,
    v_total_materiais_oficiais,
    v_pode_expurgar,
    v_motivo;
END;
$$;

DROP FUNCTION IF EXISTS public.expurgar_etapa_producao_teste(UUID, TEXT, TEXT, TEXT);
CREATE FUNCTION public.expurgar_etapa_producao_teste(
  p_processo_id UUID,
  p_codigo_confirmacao TEXT,
  p_confirmacao_expurgo TEXT,
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
  v_resumo RECORD;
  v_ordens JSONB := '[]'::JSONB;
  v_apontamentos JSONB := '[]'::JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem expurgar Etapas de teste';
  END IF;

  IF LENGTH(BTRIM(COALESCE(p_justificativa, ''))) < 10 THEN
    RAISE EXCEPTION 'Informe uma justificativa com pelo menos 10 caracteres';
  END IF;

  IF BTRIM(COALESCE(p_confirmacao_expurgo, '')) <> 'EXPURGAR TESTE' THEN
    RAISE EXCEPTION 'Digite EXPURGAR TESTE para confirmar o expurgo';
  END IF;

  SELECT * INTO v_processo
  FROM public.producao_processos p
  WHERE p.id = p_processo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada';
  END IF;

  IF BTRIM(COALESCE(p_codigo_confirmacao, '')) <> v_processo.codigo THEN
    RAISE EXCEPTION 'O código de confirmação não corresponde à Etapa';
  END IF;

  SELECT * INTO v_resumo
  FROM public.obter_resumo_expurgo_etapa_teste(p_processo_id);

  IF v_resumo.processo_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível validar a Etapa para expurgo';
  END IF;

  IF NOT v_resumo.pode_expurgar THEN
    RAISE EXCEPTION '%', COALESCE(v_resumo.motivo_bloqueio, 'O expurgo está bloqueado');
  END IF;

  SELECT COALESCE(JSONB_AGG(TO_JSONB(o) ORDER BY o.numero), '[]'::JSONB)
  INTO v_ordens
  FROM public.producao_ordens_producao o
  WHERE o.processo_id = p_processo_id;

  SELECT COALESCE(JSONB_AGG(TO_JSONB(a) ORDER BY a.created_at, a.id), '[]'::JSONB)
  INTO v_apontamentos
  FROM public.producao_apontamentos a
  WHERE a.processo_id = p_processo_id
     OR a.ordem_producao_id IN (
       SELECT o.id FROM public.producao_ordens_producao o
       WHERE o.processo_id = p_processo_id
     );

  SELECT COALESCE(
    (SELECT NULLIF(BTRIM(p.nome), '') FROM public.profiles p WHERE p.user_id = v_user LIMIT 1),
    (SELECT u.email FROM auth.users u WHERE u.id = v_user),
    'Administrador'
  ) INTO v_nome_usuario;

  INSERT INTO public.producao_etapas_expurgos_auditoria (
    processo_id, codigo, nome, projeto_id, processo_snapshot,
    ordens_snapshot, apontamentos_snapshot, totais,
    expurgado_por_id, expurgado_por_nome_snapshot, justificativa
  ) VALUES (
    v_processo.id,
    v_processo.codigo,
    v_processo.nome,
    v_processo.projeto_id,
    TO_JSONB(v_processo),
    v_ordens,
    v_apontamentos,
    JSONB_BUILD_OBJECT(
      'ops', v_resumo.total_ops,
      'apontamentos', v_resumo.total_apontamentos,
      'apontamentos_conferidos', v_resumo.total_apontamentos_conferidos,
      'anexos', v_resumo.total_anexos,
      'materiais_etapa', v_resumo.total_materiais_etapa,
      'materiais_op', v_resumo.total_materiais_op,
      'solicitacoes_material', v_resumo.total_solicitacoes_material,
      'retiradas', v_resumo.total_retiradas,
      'materiais_oficiais', v_resumo.total_materiais_oficiais
    ),
    v_user,
    COALESCE(v_nome_usuario, 'Administrador'),
    BTRIM(p_justificativa)
  );

  DELETE FROM public.producao_apontamentos a
  WHERE a.processo_id = p_processo_id
     OR a.ordem_producao_id IN (
       SELECT o.id FROM public.producao_ordens_producao o
       WHERE o.processo_id = p_processo_id
     );

  DELETE FROM public.producao_ordens_producao o
  WHERE o.processo_id = p_processo_id;

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

REVOKE ALL ON FUNCTION public.obter_resumo_expurgo_etapa_teste(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expurgar_etapa_producao_teste(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_resumo_expurgo_etapa_teste(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expurgar_etapa_producao_teste(UUID, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
