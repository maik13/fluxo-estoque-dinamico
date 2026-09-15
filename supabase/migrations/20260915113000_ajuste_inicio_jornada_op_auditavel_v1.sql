-- Ajuste auditável do início real de uma jornada de OP.
-- Mantém o horário capturado automaticamente como evidência e permite correção
-- somente enquanto a jornada estiver aberta, sempre com justificativa.

BEGIN;

ALTER TABLE public.producao_op_jornadas
  ADD COLUMN IF NOT EXISTS iniciado_em_original TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS inicio_ajustado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS inicio_ajuste_motivo TEXT NULL,
  ADD COLUMN IF NOT EXISTS inicio_ajustado_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS inicio_ajustado_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS inicio_ajustado_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS inicio_ajuste_retroativo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.ajustar_inicio_jornada_op_v1(
  p_jornada_id UUID,
  p_nova_data DATE,
  p_novo_inicio TIME,
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
  v_anterior TIMESTAMPTZ;
  v_original TIMESTAMPTZ;
  v_novo TIMESTAMPTZ;
  v_agora TIMESTAMPTZ := NOW();
  v_retroativo BOOLEAN;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para ajustar o início da jornada';
  END IF;

  IF p_nova_data IS NULL OR p_novo_inicio IS NULL THEN
    RAISE EXCEPTION 'Informe a data e o horário reais de início';
  END IF;

  IF BTRIM(COALESCE(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo do ajuste do início';
  END IF;

  SELECT * INTO v_jornada
  FROM public.producao_op_jornadas
  WHERE id = p_jornada_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada da OP não encontrada';
  END IF;

  IF v_jornada.status <> 'aberta' THEN
    RAISE EXCEPTION 'Somente uma jornada aberta pode ter o início ajustado';
  END IF;

  v_anterior := v_jornada.iniciado_em;
  v_original := COALESCE(v_jornada.iniciado_em_original, v_jornada.iniciado_em);
  v_novo := ((p_nova_data + p_novo_inicio) AT TIME ZONE 'America/Sao_Paulo');

  IF v_novo > v_agora + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'O início real não pode estar no futuro';
  END IF;

  v_retroativo := p_nova_data < (v_agora AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_nome := public.nome_usuario_producao(v_user);

  UPDATE public.producao_op_jornadas
     SET iniciado_em_original = v_original,
         iniciado_em = v_novo,
         inicio_ajustado = TRUE,
         inicio_ajuste_motivo = BTRIM(p_motivo),
         inicio_ajustado_por_id = v_user,
         inicio_ajustado_por_nome_snapshot = v_nome,
         inicio_ajustado_em = v_agora,
         inicio_ajuste_retroativo = v_retroativo,
         updated_at = NOW()
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
    'jornada_inicio_ajustado',
    'em_execucao',
    'em_execucao',
    v_user,
    v_nome,
    BTRIM(p_motivo),
    jsonb_build_object(
      'jornada_id', p_jornada_id,
      'iniciado_em_original', v_original,
      'iniciado_em_anterior', v_anterior,
      'iniciado_em_ajustado', v_novo,
      'data_real', p_nova_data,
      'hora_real', p_novo_inicio,
      'ajuste_registrado_em', v_agora,
      'retroativo', v_retroativo
    )
  );

  RETURN jsonb_build_object(
    'jornada_id', p_jornada_id,
    'iniciado_em', v_novo,
    'iniciado_em_original', v_original,
    'data', p_nova_data,
    'inicio', p_novo_inicio,
    'ajustado_em', v_agora,
    'retroativo', v_retroativo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ajustar_inicio_jornada_op_v1(UUID, DATE, TIME, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ajustar_inicio_jornada_op_v1(UUID, DATE, TIME, TEXT) TO authenticated;

COMMENT ON COLUMN public.producao_op_jornadas.iniciado_em_original IS
'Primeiro horário capturado automaticamente ao iniciar a jornada. Preservado para auditoria quando o início real é corrigido.';
COMMENT ON COLUMN public.producao_op_jornadas.inicio_ajuste_motivo IS
'Justificativa obrigatória do último ajuste do horário real de início da jornada.';

NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT
  TO_REGPROCEDURE(
    'public.ajustar_inicio_jornada_op_v1(uuid,date,time without time zone,text)'
  ) AS rpc_ajustar_inicio,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'producao_op_jornadas'
      AND column_name = 'iniciado_em_original'
  ) AS auditoria_inicio_instalada,
  (SELECT COUNT(*) FROM public.producao_op_jornadas WHERE status = 'aberta') AS jornadas_abertas_preservadas;