-- Permite descartar uma jornada/apontamento aberto por engano ou duplicado,
-- sem criar um novo apontamento histórico e mantendo trilha de auditoria.

BEGIN;

ALTER TABLE public.producao_op_jornadas
  ADD COLUMN IF NOT EXISTS descartada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS descartada_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS descartada_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS descartada_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS motivo_descarte TEXT NULL;

CREATE OR REPLACE FUNCTION public.descartar_jornada_op_v1(
  p_jornada_id UUID,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_jornada public.producao_op_jornadas%ROWTYPE;
  v_agora TIMESTAMPTZ := NOW();
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para descartar apontamento aberto';
  END IF;

  IF BTRIM(COALESCE(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo para descartar o apontamento aberto';
  END IF;

  SELECT * INTO v_jornada
  FROM public.producao_op_jornadas
  WHERE id = p_jornada_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apontamento aberto não encontrado';
  END IF;

  IF v_jornada.status <> 'aberta' THEN
    RAISE EXCEPTION 'Somente um apontamento ainda aberto pode ser descartado';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  UPDATE public.producao_op_jornadas
     SET status = 'encerrada',
         encerrado_em = v_agora,
         encerrado_registrado_em = v_agora,
         encerrado_por_id = v_user,
         encerrado_por_nome_snapshot = v_nome,
         descartada = TRUE,
         descartada_em = v_agora,
         descartada_por_id = v_user,
         descartada_por_nome_snapshot = v_nome,
         motivo_descarte = BTRIM(p_motivo),
         updated_at = v_agora
   WHERE id = p_jornada_id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id,
    evento,
    status_anterior,
    novo_status,
    usuario_id,
    nome_usuario_snapshot,
    justificativa,
    dados
  ) VALUES (
    v_jornada.ordem_producao_id,
    'apontamento_aberto_descartado',
    'em_execucao',
    'em_execucao',
    v_user,
    v_nome,
    BTRIM(p_motivo),
    jsonb_build_object(
      'jornada_id', v_jornada.id,
      'iniciado_em', v_jornada.iniciado_em,
      'quantidade_rascunho', v_jornada.quantidade_produzida_rascunho,
      'membros_ids', v_jornada.membros_ids,
      'descartada_em', v_agora
    )
  );

  RETURN jsonb_build_object(
    'jornada_id', v_jornada.id,
    'ordem_producao_id', v_jornada.ordem_producao_id,
    'descartada', TRUE,
    'descartada_em', v_agora
  );
END;
$$;

REVOKE ALL ON FUNCTION public.descartar_jornada_op_v1(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.descartar_jornada_op_v1(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT
  TO_REGPROCEDURE('public.descartar_jornada_op_v1(uuid,text)') AS rpc_descartar_jornada,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'producao_op_jornadas'
      AND column_name = 'descartada'
  ) AS auditoria_descarte_instalada,
  (SELECT COUNT(*) FROM public.producao_op_jornadas WHERE status = 'aberta') AS jornadas_abertas_preservadas;
