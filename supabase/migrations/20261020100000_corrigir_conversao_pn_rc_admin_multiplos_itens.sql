CREATE OR REPLACE FUNCTION public.financeiro_criar_rc_da_pn(p_necessidade_id uuid)
RETURNS TABLE (id uuid, numero bigint, ja_existia boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_pn public.financeiro_necessidades%ROWTYPE;
  v_solicitacao public.solicitacoes_material%ROWTYPE;
  v_item_solicitacao public.solicitacao_material_itens%ROWTYPE;
  v_item_pn record;
  v_rc public.pedidos_compra%ROWTYPE;
  v_nome text;
  v_total_itens integer;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(), 'pode_pedido_compra')
    OR public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_financeiro')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.ativo, true)
        AND p.tipo_usuario = 'estoquista'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para formalizar RC a partir da PN.';
  END IF;

  SELECT * INTO v_pn
  FROM public.financeiro_necessidades
  WHERE financeiro_necessidades.id = p_necessidade_id
  FOR UPDATE;

  IF NOT FOUND OR v_pn.status = 'cancelado' THEN
    RAISE EXCEPTION 'PN não disponível para formalização de RC.';
  END IF;

  IF v_pn.requisicao_compra_id IS NOT NULL THEN
    SELECT * INTO v_rc
    FROM public.pedidos_compra
    WHERE pedidos_compra.id = v_pn.requisicao_compra_id;
    IF FOUND THEN
      RETURN QUERY SELECT v_rc.id, v_rc.numero, true;
      RETURN;
    END IF;
  END IF;

  SELECT COUNT(*)::integer INTO v_total_itens
  FROM public.financeiro_necessidade_itens
  WHERE necessidade_id = v_pn.id;

  IF v_total_itens = 0
     AND (v_pn.solicitacao_material_id IS NULL OR v_pn.solicitacao_material_item_id IS NULL) THEN
    RAISE EXCEPTION 'Esta PN não possui itens para formalizar a RC.';
  END IF;

  IF v_pn.solicitacao_material_id IS NOT NULL THEN
    SELECT * INTO v_solicitacao
    FROM public.solicitacoes_material
    WHERE solicitacoes_material.id = v_pn.solicitacao_material_id;
  END IF;

  SELECT COALESCE(nome, email, 'Usuário') INTO v_nome
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  INSERT INTO public.pedidos_compra (
    criado_por_id, criado_por_nome, observacoes, estoque_id, status,
    solicitacao_material_id, solicitacao_material_numero, pn_origem_id,
    projeto_centro_custo, especificacao_tecnica, data_necessaria,
    conferencia_estoque, valor_estimado_cotado, status_financeiro_rc,
    integrar_financeiro
  ) VALUES (
    auth.uid(), COALESCE(v_nome, 'Usuário'),
    'RC formalizada a partir da PN-' || LPAD(v_pn.numero::text, 4, '0') || '.',
    v_solicitacao.estoque_id, 'aberto',
    v_pn.solicitacao_material_id, v_solicitacao.numero, v_pn.id,
    v_pn.projeto_centro_custo, v_pn.especificacao, v_pn.data_necessidade,
    COALESCE(v_pn.justificativa, 'Conferência do Almoxarifado pendente.'),
    v_pn.valor_estimado, 'em_cotacao', true
  ) RETURNING * INTO v_rc;

  IF v_total_itens > 0 THEN
    FOR v_item_pn IN
      SELECT *
      FROM public.financeiro_necessidade_itens
      WHERE necessidade_id = v_pn.id
      ORDER BY ordem, created_at
    LOOP
      INSERT INTO public.pedido_compra_itens (
        pedido_id, item_id, nome_item, quantidade, item_snapshot, status
      ) VALUES (
        v_rc.id,
        v_item_pn.item_id,
        v_item_pn.descricao,
        v_item_pn.quantidade,
        COALESCE(v_item_pn.item_snapshot, '{}'::jsonb)
          || jsonb_build_object(
            'nome', v_item_pn.descricao,
            'unidade', v_item_pn.unidade,
            'especificacao', v_item_pn.especificacao
          ),
        'pendente'
      );
    END LOOP;
  ELSE
    SELECT * INTO v_item_solicitacao
    FROM public.solicitacao_material_itens
    WHERE solicitacao_material_itens.id = v_pn.solicitacao_material_item_id;

    INSERT INTO public.pedido_compra_itens (
      pedido_id, item_id, nome_item, quantidade, item_snapshot, status
    ) VALUES (
      v_rc.id,
      v_item_solicitacao.item_id,
      v_item_solicitacao.nome_item,
      v_item_solicitacao.quantidade,
      COALESCE(
        v_item_solicitacao.item_snapshot,
        jsonb_build_object(
          'nome', v_item_solicitacao.nome_item,
          'unidade', v_item_solicitacao.unidade
        )
      ),
      'pendente'
    );
  END IF;

  UPDATE public.financeiro_necessidades
  SET requisicao_compra_id = v_rc.id,
      status = 'em_cotacao',
      updated_at = now()
  WHERE financeiro_necessidades.id = v_pn.id;

  RETURN QUERY SELECT v_rc.id, v_rc.numero, false;
END;
$function$;

REVOKE ALL ON FUNCTION public.financeiro_criar_rc_da_pn(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_criar_rc_da_pn(uuid) TO authenticated;
