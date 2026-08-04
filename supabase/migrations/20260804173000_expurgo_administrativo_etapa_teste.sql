-- Expurgo administrativo controlado de Etapas criadas apenas para teste.
-- Diferente da exclusão operacional, esta rotina pode remover OPs e apontamentos,
-- inclusive conferidos, desde que não exista qualquer vínculo oficial com estoque.

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

CREATE OR REPLACE FUNCTION public.obter_resumo_expurgo_etapa_teste(
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
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  WITH ordens AS (
    SELECT o.id
    FROM public.producao_ordens_producao o
    WHERE o.processo_id = p_processo_id
  ),
  apontamentos AS (
    SELECT a.id, a.status
    FROM public.producao_apontamentos a
    WHERE a.processo_id = p_processo_id
       OR a.ordem_producao_id IN (SELECT id FROM ordens)
  ),
  totais AS (
    SELECT
      (SELECT COUNT(*) FROM ordens) AS total_ops,
      (SELECT COUNT(*) FROM apontamentos) AS total_apontamentos,
      (SELECT COUNT(*) FROM apontamentos WHERE status = 'conferido') AS total_apontamentos_conferidos,
      (
        SELECT COUNT(*)
        FROM public.producao_apontamento_anexos aa
        WHERE aa.apontamento_id IN (SELECT id FROM apontamentos)
      ) AS total_anexos,
      (
        SELECT COUNT(*)
        FROM public.producao_etapa_materiais em
        WHERE em.processo_id = p_processo_id
      ) AS total_materiais_etapa,
      (
        SELECT COUNT(*)
        FROM public.producao_ordem_materiais om
        WHERE om.ordem_producao_id IN (SELECT id FROM ordens)
      ) AS total_materiais_op,
      (
        SELECT COUNT(*)
        FROM public.solicitacoes_material sm
        WHERE sm.processo_id = p_processo_id
           OR sm.ordem_producao_id IN (SELECT id FROM ordens)
      ) AS total_solicitacoes_material,
      (
        SELECT COUNT(*)
        FROM public.solicitacoes_material sm
        WHERE (
          sm.processo_id = p_processo_id
          OR sm.ordem_producao_id IN (SELECT id FROM ordens)
        )
          AND sm.solicitacao_retirada_id IS NOT NULL
      ) AS total_retiradas,
      (
        SELECT COUNT(*)
        FROM public.producao_materiais_projeto mp
        WHERE mp.apontamento_id IN (SELECT id FROM apontamentos)
      ) AS total_materiais_oficiais
  )
  SELECT
    p.id,
    p.codigo,
    p.nome,
    p.status,
    t.total_ops,
    t.total_apontamentos,
    t.total_apontamentos_conferidos,
    t.total_anexos,
    t.total_materiais_etapa,
    t.total_materiais_op,
    t.total_solicitacoes_material,
    t.total_retiradas,
    t.total_materiais_oficiais,
    (
      t.total_anexos = 0
      AND t.total_solicitacoes_material = 0
      AND t.total_retiradas = 0
      AND t.total_materiais_oficiais = 0
    ) AS pode_expurgar,
    CASE
      WHEN t.total_solicitacoes_material > 0
        THEN 'A Etapa possui Solicitação de Material e não pode ser expurgada.'
      WHEN t.total_retiradas > 0
        THEN 'A Etapa possui retirada vinculada e não pode ser expurgada.'
      WHEN t.total_materiais_oficiais > 0
        THEN 'A Etapa possui material ligado a movimentação oficial de estoque.'
      WHEN t.total_anexos > 0
        THEN 'A Etapa possui fotos. Exclua os anexos antes do expurgo para evitar arquivos órfãos.'
      ELSE NULL
    END
  FROM public.producao_processos p
  CROSS JOIN totais t
  WHERE p.id = p_processo_id
    AND public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.expurgar_etapa_producao_teste(
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
  v_ordens JSONB;
  v_apontamentos JSONB;
  v_totais JSONB;
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

  SELECT *
  INTO v_processo
  FROM public.producao_processos
  WHERE id = p_processo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada';
  END IF;

  IF BTRIM(COALESCE(p_codigo_confirmacao, '')) <> v_processo.codigo THEN
    RAISE EXCEPTION 'O código de confirmação não corresponde à Etapa';
  END IF;

  SELECT *
  INTO v_resumo
  FROM public.obter_resumo_expurgo_etapa_teste(p_processo_id);

  IF v_resumo.processo_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível validar a Etapa para expurgo';
  END IF;

  IF NOT v_resumo.pode_expurgar THEN
    RAISE EXCEPTION '%', COALESCE(v_resumo.motivo_bloqueio, 'O expurgo está bloqueado por vínculos oficiais');
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
       SELECT o.id
       FROM public.producao_ordens_producao o
       WHERE o.processo_id = p_processo_id
     );

  v_totais := JSONB_BUILD_OBJECT(
    'ops', v_resumo.total_ops,
    'apontamentos', v_resumo.total_apontamentos,
    'apontamentos_conferidos', v_resumo.total_apontamentos_conferidos,
    'anexos', v_resumo.total_anexos,
    'materiais_etapa', v_resumo.total_materiais_etapa,
    'materiais_op', v_resumo.total_materiais_op,
    'solicitacoes_material', v_resumo.total_solicitacoes_material,
    'retiradas', v_resumo.total_retiradas,
    'materiais_oficiais', v_resumo.total_materiais_oficiais
  );

  SELECT COALESCE(
    (SELECT NULLIF(BTRIM(p.nome), '') FROM public.profiles p WHERE p.user_id = v_user LIMIT 1),
    (SELECT NULLIF(BTRIM(u.raw_user_meta_data->>'name'), '') FROM auth.users u WHERE u.id = v_user),
    (SELECT u.email FROM auth.users u WHERE u.id = v_user),
    'Administrador'
  )
  INTO v_nome_usuario;

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
    v_totais,
    v_user,
    COALESCE(v_nome_usuario, 'Administrador'),
    BTRIM(p_justificativa)
  );

  -- Apontamentos precisam sair antes das OPs por causa do vínculo RESTRICT.
  DELETE FROM public.producao_apontamentos a
  WHERE a.processo_id = p_processo_id
     OR a.ordem_producao_id IN (
       SELECT o.id
       FROM public.producao_ordens_producao o
       WHERE o.processo_id = p_processo_id
     );

  -- Eventos e materiais da OP possuem ON DELETE CASCADE.
  DELETE FROM public.producao_ordens_producao
  WHERE processo_id = p_processo_id;

  -- Eventos, dependências, alocações, alertas e PCP da Etapa possuem CASCADE.
  DELETE FROM public.producao_processos
  WHERE id = p_processo_id;

  PERFORM public.recalcular_cronograma_producao_interno(
    v_user,
    COALESCE(v_nome_usuario, 'Administrador')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obter_resumo_expurgo_etapa_teste(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expurgar_etapa_producao_teste(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_resumo_expurgo_etapa_teste(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expurgar_etapa_producao_teste(UUID, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
