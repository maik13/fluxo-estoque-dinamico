CREATE OR REPLACE FUNCTION public.editar_previsao_necessidade_almoxarifado_v1(
  p_necessidade_id uuid,
  p_itens jsonb,
  p_data_necessidade date DEFAULT NULL,
  p_projeto_centro_custo text DEFAULT NULL,
  p_urgencia text DEFAULT 'normal',
  p_justificativa text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_pn public.financeiro_necessidades%ROWTYPE;
  v_item jsonb;
  v_ordem integer := 0;
  v_total numeric(14,2) := 0;
  v_incompleta boolean := false;
  v_descricao text;
  v_quantidade numeric;
  v_valor_unitario numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = v_user
        AND COALESCE(p.ativo, true)
        AND p.tipo_usuario = 'estoquista'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para editar PN do Almoxarifado';
  END IF;

  SELECT * INTO v_pn
  FROM public.financeiro_necessidades
  WHERE id = p_necessidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PN não encontrada';
  END IF;
  IF v_pn.status = 'cancelado' THEN
    RAISE EXCEPTION 'PN cancelada não pode ser editada';
  END IF;
  IF v_pn.requisicao_compra_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta PN já foi formalizada em RC. Edite os dados na própria RC para preservar o vínculo';
  END IF;
  IF COALESCE(jsonb_array_length(p_itens), 0) = 0 THEN
    RAISE EXCEPTION 'A PN precisa ter pelo menos um item';
  END IF;
  IF p_urgencia NOT IN ('baixa', 'normal', 'alta', 'urgente') THEN
    RAISE EXCEPTION 'Urgência inválida';
  END IF;

  DELETE FROM public.financeiro_necessidade_itens
  WHERE necessidade_id = p_necessidade_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens)
  LOOP
    v_ordem := v_ordem + 1;
    v_quantidade := NULLIF(v_item->>'quantidade', '')::numeric;
    v_valor_unitario := NULLIF(v_item->>'valor_unitario', '')::numeric;

    IF COALESCE(BTRIM(v_item->>'descricao'), '') = ''
       OR COALESCE(BTRIM(v_item->>'unidade'), '') = ''
       OR v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RAISE EXCEPTION 'Item % possui dados inválidos', v_ordem;
    END IF;

    INSERT INTO public.financeiro_necessidade_itens(
      necessidade_id, item_id, origem, descricao, especificacao,
      quantidade, unidade, valor_unitario_estimado, valor_total_estimado,
      item_snapshot, ordem
    ) VALUES (
      p_necessidade_id,
      NULLIF(v_item->>'item_id', '')::uuid,
      CASE WHEN NULLIF(v_item->>'item_id', '') IS NULL THEN 'avulso' ELSE 'estoque' END,
      BTRIM(v_item->>'descricao'),
      NULLIF(BTRIM(v_item->>'especificacao'), ''),
      v_quantidade,
      UPPER(BTRIM(v_item->>'unidade')),
      v_valor_unitario,
      CASE WHEN v_valor_unitario IS NULL THEN NULL ELSE v_quantidade * v_valor_unitario END,
      jsonb_build_object(
        'descricao', BTRIM(v_item->>'descricao'),
        'especificacao', NULLIF(BTRIM(v_item->>'especificacao'), ''),
        'unidade', UPPER(BTRIM(v_item->>'unidade'))
      ),
      v_ordem
    );

    IF v_valor_unitario IS NULL THEN
      v_incompleta := true;
    ELSE
      v_total := v_total + (v_quantidade * v_valor_unitario);
    END IF;
  END LOOP;

  SELECT string_agg(descricao, ', ' ORDER BY ordem)
  INTO v_descricao
  FROM public.financeiro_necessidade_itens
  WHERE necessidade_id = p_necessidade_id;

  UPDATE public.financeiro_necessidades
  SET descricao = COALESCE(v_descricao, descricao),
      data_necessidade = p_data_necessidade,
      data_prevista_desembolso = p_data_necessidade,
      projeto_centro_custo = NULLIF(BTRIM(p_projeto_centro_custo), ''),
      urgencia = p_urgencia,
      justificativa = NULLIF(BTRIM(p_justificativa), ''),
      valor_estimado = CASE WHEN v_total = 0 AND v_incompleta THEN NULL ELSE v_total END,
      estimativa_incompleta = v_incompleta,
      base_estimativa = CASE
        WHEN v_incompleta THEN 'Estimativa parcial da PN editada pelo Almoxarifado'
        ELSE 'Quantidade x valor unitário dos itens da PN'
      END,
      updated_by = v_user,
      updated_at = now()
  WHERE id = p_necessidade_id;

  UPDATE public.financeiro_lancamentos
  SET descricao = COALESCE(v_descricao, descricao),
      projeto_centro_custo = NULLIF(BTRIM(p_projeto_centro_custo), ''),
      data_prevista = p_data_necessidade,
      valor_previsto = CASE WHEN v_total = 0 AND v_incompleta THEN NULL ELSE v_total END,
      updated_at = now()
  WHERE necessidade_id = p_necessidade_id;

  RETURN p_necessidade_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.editar_previsao_necessidade_almoxarifado_v1(uuid, jsonb, date, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_previsao_necessidade_almoxarifado_v1(uuid, jsonb, date, text, text, text) TO authenticated;
