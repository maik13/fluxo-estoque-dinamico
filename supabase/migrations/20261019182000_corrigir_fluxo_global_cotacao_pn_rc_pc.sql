CREATE OR REPLACE FUNCTION public.financeiro_sincronizar_rc(p_pedido_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_pedido public.pedidos_compra%ROWTYPE;
  v_sol public.solicitacoes_material%ROWTYPE;
  v_necessidade_id uuid;
  v_descricao text;
  v_valor_itens numeric(14,2);
  v_valor_final numeric(14,2);
  v_total_itens integer;
  v_itens_sem_valor integer;
  v_itens_comprados integer;
  v_status text;
  v_estimativa_incompleta boolean;
  v_base_estimativa text;
BEGIN
  SELECT * INTO v_pedido
  FROM public.pedidos_compra
  WHERE id = p_pedido_id;

  IF NOT FOUND OR COALESCE(v_pedido.integrar_financeiro, false) = false THEN
    RETURN NULL;
  END IF;

  IF v_pedido.solicitacao_material_id IS NOT NULL THEN
    SELECT * INTO v_sol
    FROM public.solicitacoes_material
    WHERE id = v_pedido.solicitacao_material_id;
  END IF;

  SELECT
    COALESCE(
      'RC #' || v_pedido.numero || ' - ' ||
      string_agg(COALESCE(pci.nome_item, pci.item_snapshot->>'nome', i.nome, 'Item'), ', ' ORDER BY pci.created_at),
      'RC #' || v_pedido.numero
    ),
    COALESCE(SUM(CASE WHEN i.valor IS NOT NULL THEN pci.quantidade * i.valor ELSE 0 END), 0),
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE pci.item_id IS NULL OR i.valor IS NULL)::integer,
    COUNT(*) FILTER (WHERE pci.status IN ('comprado', 'parcial'))::integer
  INTO v_descricao, v_valor_itens, v_total_itens, v_itens_sem_valor, v_itens_comprados
  FROM public.pedido_compra_itens pci
  LEFT JOIN public.items i ON i.id = pci.item_id
  WHERE pci.pedido_id = p_pedido_id;

  IF v_pedido.valor_estimado_cotado IS NOT NULL THEN
    v_valor_final := v_pedido.valor_estimado_cotado + COALESCE(v_pedido.frete_custos_adicionais, 0);
    v_estimativa_incompleta := false;
    v_base_estimativa := 'Valor cotado da RC + frete/custos adicionais';
  ELSIF COALESCE(v_total_itens, 0) = 0 OR v_itens_sem_valor = v_total_itens THEN
    v_valor_final := NULL;
    v_estimativa_incompleta := true;
    v_base_estimativa := 'RC ainda sem cotação ou valores de itens';
  ELSE
    v_valor_final := v_valor_itens;
    v_estimativa_incompleta := COALESCE(v_itens_sem_valor, 0) > 0;
    v_base_estimativa := CASE
      WHEN v_itens_sem_valor > 0 THEN 'Estimativa parcial pelos valores cadastrados no estoque'
      ELSE 'Quantidade da RC x valor cadastrado do item'
    END;
  END IF;

  v_status := CASE
    WHEN v_pedido.status = 'cancelado' THEN 'cancelado'
    WHEN v_pedido.status_financeiro_rc = 'convertida_em_pc' THEN 'comprometido'
    WHEN v_pedido.status_financeiro_rc = 'aprovada' THEN 'aprovado'
    WHEN v_pedido.status_financeiro_rc = 'aguardando_aprovacao' THEN 'aguardando_aprovacao'
    WHEN COALESCE(v_itens_comprados, 0) > 0 THEN 'comprometido'
    ELSE 'em_cotacao'
  END;

  SELECT id INTO v_necessidade_id
  FROM public.financeiro_necessidades
  WHERE id = v_pedido.pn_origem_id
     OR requisicao_compra_id = p_pedido_id
  ORDER BY (id = v_pedido.pn_origem_id) DESC
  LIMIT 1;

  IF v_necessidade_id IS NULL THEN
    INSERT INTO public.financeiro_necessidades(
      status, origem_tipo, origem_modulo, descricao,
      solicitante_id, solicitante_nome,
      solicitacao_material_id, requisicao_compra_id,
      producao_projeto_id, processo_id, ordem_producao_id,
      valor_estimado, estimativa_incompleta, base_estimativa,
      data_necessidade, data_prevista_desembolso,
      projeto_centro_custo, criado_automaticamente,
      criado_por_id, criado_por_nome
    ) VALUES (
      v_status, 'rc', COALESCE(v_sol.origem_modulo, 'almoxarifado'),
      v_descricao,
      COALESCE(v_sol.solicitante_id, v_pedido.criado_por_id),
      COALESCE(v_sol.solicitante_nome, v_pedido.criado_por_nome),
      v_pedido.solicitacao_material_id, v_pedido.id,
      v_sol.producao_projeto_id, v_sol.processo_id, v_sol.ordem_producao_id,
      v_valor_final, v_estimativa_incompleta, v_base_estimativa,
      v_sol.data_necessidade, v_sol.data_necessidade,
      COALESCE(v_pedido.projeto_centro_custo, v_sol.local_origem),
      true, v_pedido.criado_por_id, v_pedido.criado_por_nome
    )
    RETURNING id INTO v_necessidade_id;

    UPDATE public.pedidos_compra
    SET pn_origem_id = v_necessidade_id
    WHERE id = p_pedido_id AND pn_origem_id IS NULL;
  ELSE
    UPDATE public.financeiro_necessidades
    SET status = v_status,
        descricao = v_descricao,
        solicitacao_material_id = v_pedido.solicitacao_material_id,
        requisicao_compra_id = v_pedido.id,
        origem_tipo = 'rc',
        origem_modulo = COALESCE(v_sol.origem_modulo, origem_modulo, 'almoxarifado'),
        producao_projeto_id = COALESCE(v_sol.producao_projeto_id, producao_projeto_id),
        processo_id = COALESCE(v_sol.processo_id, processo_id),
        ordem_producao_id = COALESCE(v_sol.ordem_producao_id, ordem_producao_id),
        valor_estimado = v_valor_final,
        estimativa_incompleta = v_estimativa_incompleta,
        base_estimativa = v_base_estimativa,
        data_necessidade = COALESCE(v_sol.data_necessidade, data_necessidade),
        data_prevista_desembolso = COALESCE(v_sol.data_necessidade, data_prevista_desembolso),
        projeto_centro_custo = COALESCE(v_pedido.projeto_centro_custo, v_sol.local_origem, projeto_centro_custo),
        updated_at = now()
    WHERE id = v_necessidade_id;
  END IF;

  INSERT INTO public.financeiro_lancamentos(
    necessidade_id, tipo, status, descricao,
    projeto_centro_custo, producao_projeto_id,
    data_prevista, valor_previsto,
    origem_tipo, origem_id, criado_por_id
  )
  SELECT
    v_necessidade_id, 'saida', v_status, v_descricao,
    fn.projeto_centro_custo, fn.producao_projeto_id,
    fn.data_prevista_desembolso, fn.valor_estimado,
    'rc', v_pedido.id, v_pedido.criado_por_id
  FROM public.financeiro_necessidades fn
  WHERE fn.id = v_necessidade_id
  ON CONFLICT (necessidade_id, parcela_numero)
  DO UPDATE SET
    status = EXCLUDED.status,
    descricao = EXCLUDED.descricao,
    projeto_centro_custo = EXCLUDED.projeto_centro_custo,
    producao_projeto_id = EXCLUDED.producao_projeto_id,
    data_prevista = EXCLUDED.data_prevista,
    valor_previsto = EXCLUDED.valor_previsto,
    origem_tipo = EXCLUDED.origem_tipo,
    origem_id = EXCLUDED.origem_id,
    updated_at = now();

  RETURN v_necessidade_id;
END;
$function$;

DROP POLICY IF EXISTS financeiro_pc_almoxarifado ON public.financeiro_pedidos_compra_formais;
CREATE POLICY financeiro_pc_almoxarifado
ON public.financeiro_pedidos_compra_formais
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND COALESCE(p.ativo, true)
      AND p.tipo_usuario IN ('administrador', 'estoquista')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND COALESCE(p.ativo, true)
      AND p.tipo_usuario IN ('administrador', 'estoquista')
  )
);

DO $backfill$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT id
    FROM public.pedidos_compra
    WHERE COALESCE(integrar_financeiro, false) = true
  LOOP
    PERFORM public.financeiro_sincronizar_rc(v_id);
  END LOOP;
END;
$backfill$;
