BEGIN;

CREATE OR REPLACE FUNCTION public.criar_apontamento_producao_com_consumos_tinta_v1(
  p_data DATE,
  p_ordem_producao_id UUID,
  p_processo_id UUID,
  p_projeto_local_id UUID,
  p_tarefa_id UUID,
  p_local_tipo TEXT,
  p_quantidade_produzida NUMERIC,
  p_inicio TIME WITHOUT TIME ZONE,
  p_termino TIME WITHOUT TIME ZONE,
  p_duracao_minutos INTEGER,
  p_minutos_produtivos INTEGER,
  p_minutos_improdutivos INTEGER,
  p_motivo_improdutivo TEXT,
  p_observacoes TEXT,
  p_membros UUID[],
  p_consumos_tinta JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_apontamento_id UUID;
BEGIN
  IF p_consumos_tinta IS NULL OR jsonb_typeof(p_consumos_tinta) <> 'array' THEN
    RAISE EXCEPTION 'Consumos de tinta devem ser enviados em uma lista';
  END IF;

  v_apontamento_id := public.criar_apontamento_producao(
    p_data,
    p_ordem_producao_id,
    p_processo_id,
    p_projeto_local_id,
    p_tarefa_id,
    p_local_tipo,
    p_quantidade_produzida,
    p_inicio,
    p_termino,
    p_duracao_minutos,
    p_minutos_produtivos,
    p_minutos_improdutivos,
    p_motivo_improdutivo,
    p_observacoes,
    p_membros
  );

  IF jsonb_array_length(p_consumos_tinta) > 0 THEN
    PERFORM public.registrar_consumos_tinta_op_v1(
      p_ordem_producao_id,
      v_apontamento_id,
      p_consumos_tinta
    );
  END IF;

  RETURN v_apontamento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_apontamento_producao_com_consumos_tinta_v1(
  DATE, UUID, UUID, UUID, UUID, TEXT, NUMERIC, TIME WITHOUT TIME ZONE,
  TIME WITHOUT TIME ZONE, INTEGER, INTEGER, INTEGER, TEXT, TEXT, UUID[], JSONB
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.criar_apontamento_producao_com_consumos_tinta_v1(
  DATE, UUID, UUID, UUID, UUID, TEXT, NUMERIC, TIME WITHOUT TIME ZONE,
  TIME WITHOUT TIME ZONE, INTEGER, INTEGER, INTEGER, TEXT, TEXT, UUID[], JSONB
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
