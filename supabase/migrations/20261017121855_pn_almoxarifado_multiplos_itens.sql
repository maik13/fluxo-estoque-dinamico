BEGIN;

-- Uma PN do Almoxarifado possui um cabeçalho e várias linhas. Assim, a compra
-- continua rastreável por PN, mas cada item mantém quantidade e estimativa próprias.
CREATE TABLE IF NOT EXISTS public.financeiro_necessidade_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  necessidade_id uuid NOT NULL REFERENCES public.financeiro_necessidades(id) ON DELETE CASCADE,
  item_id uuid NULL REFERENCES public.items(id) ON DELETE SET NULL,
  origem text NOT NULL CHECK (origem IN ('estoque', 'avulso')),
  descricao text NOT NULL,
  especificacao text NULL,
  quantidade numeric(14,4) NOT NULL CHECK (quantidade > 0),
  unidade text NOT NULL,
  valor_unitario_estimado numeric(14,2) NULL CHECK (valor_unitario_estimado IS NULL OR valor_unitario_estimado >= 0),
  valor_total_estimado numeric(14,2) NULL CHECK (valor_total_estimado IS NULL OR valor_total_estimado >= 0),
  item_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem integer NOT NULL CHECK (ordem > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (necessidade_id, ordem)
);

CREATE INDEX IF NOT EXISTS financeiro_necessidade_itens_necessidade_idx
  ON public.financeiro_necessidade_itens(necessidade_id, ordem);

ALTER TABLE public.financeiro_necessidade_itens ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.financeiro_necessidade_itens TO authenticated;

DROP POLICY IF EXISTS financeiro_necessidade_itens_select ON public.financeiro_necessidade_itens;
CREATE POLICY financeiro_necessidade_itens_select
ON public.financeiro_necessidade_itens
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.financeiro_necessidades pn
    WHERE pn.id = necessidade_id
      AND (
        public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(), 'pode_acessar_financeiro')
        OR public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_financeiro')
        OR public.permissao_individual_efetiva(auth.uid(), 'pode_aprovar_financeiro')
        OR (
          pn.origem_modulo = 'almoxarifado'
          AND EXISTS (
            SELECT 1
            FROM public.profiles perfil
            WHERE perfil.user_id = auth.uid()
              AND COALESCE(perfil.ativo, true)
              AND perfil.tipo_usuario IN ('administrador', 'estoquista')
          )
        )
      )
  )
);

-- O perfil de Almoxarifado vê somente PNs originadas neste módulo; as regras
-- financeiras preexistentes continuam decidindo o acesso às demais PNs.
DROP POLICY IF EXISTS financeiro_necessidades_almoxarifado_select ON public.financeiro_necessidades;
CREATE POLICY financeiro_necessidades_almoxarifado_select
ON public.financeiro_necessidades
FOR SELECT TO authenticated
USING (
  origem_modulo = 'almoxarifado'
  AND EXISTS (
    SELECT 1
    FROM public.profiles perfil
    WHERE perfil.user_id = auth.uid()
      AND COALESCE(perfil.ativo, true)
      AND perfil.tipo_usuario IN ('administrador', 'estoquista')
  )
);

CREATE OR REPLACE FUNCTION public.criar_previsao_necessidade_almoxarifado_lote(
  p_itens jsonb,
  p_data_necessidade date DEFAULT NULL,
  p_projeto_centro_custo text DEFAULT NULL,
  p_urgencia text DEFAULT 'normal',
  p_justificativa text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tipo text;
  v_nome text;
  v_necessidade_id uuid;
  v_linha jsonb;
  v_ordem integer;
  v_item public.items%ROWTYPE;
  v_item_id uuid;
  v_item_id_text text;
  v_descricao text;
  v_especificacao text;
  v_unidade text;
  v_quantidade_text text;
  v_valor_text text;
  v_quantidade numeric(14,4);
  v_valor_unitario numeric(14,2);
  v_valor_total numeric(14,2);
  v_total_estimado numeric(14,2) := 0;
  v_estimativa_incompleta boolean := false;
  v_total_itens integer := 0;
  v_origem text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT tipo_usuario, COALESCE(nome, email, 'Usuário')
    INTO v_tipo, v_nome
  FROM public.profiles
  WHERE user_id = auth.uid()
    AND COALESCE(ativo, true) = true;

  IF NOT FOUND OR v_tipo NOT IN ('administrador', 'estoquista') THEN
    RAISE EXCEPTION 'Somente o perfil Almoxarifado pode criar uma PN por esta área.';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'Informe os itens da previsão de necessidade.';
  END IF;
  IF jsonb_array_length(p_itens) = 0 OR jsonb_array_length(p_itens) > 100 THEN
    RAISE EXCEPTION 'A PN deve conter entre 1 e 100 itens.';
  END IF;

  INSERT INTO public.financeiro_necessidades(
    status, origem_tipo, origem_modulo, descricao,
    solicitante_id, solicitante_nome, area_solicitante,
    estimativa_incompleta, base_estimativa,
    data_necessidade, data_prevista_desembolso,
    urgencia, projeto_centro_custo, justificativa,
    criado_automaticamente, criado_por_id, criado_por_nome
  ) VALUES (
    'previsto', 'manual', 'almoxarifado', 'PN do Almoxarifado',
    auth.uid(), v_nome, 'Almoxarifado',
    false, 'Soma das estimativas por item da PN.',
    p_data_necessidade, p_data_necessidade,
    CASE WHEN p_urgencia IN ('baixa', 'normal', 'alta', 'urgente') THEN p_urgencia ELSE 'normal' END,
    nullif(trim(p_projeto_centro_custo), ''), nullif(trim(p_justificativa), ''),
    false, auth.uid(), v_nome
  ) RETURNING id INTO v_necessidade_id;

  FOR v_linha, v_ordem IN
    SELECT valor, ordinalidade::integer
    FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS itens(valor, ordinalidade)
  LOOP
    v_item := NULL;
    v_item_id := NULL;
    v_item_id_text := nullif(trim(v_linha ->> 'item_id'), '');
    v_descricao := nullif(trim(v_linha ->> 'descricao'), '');
    v_especificacao := nullif(trim(v_linha ->> 'especificacao'), '');
    v_unidade := nullif(trim(v_linha ->> 'unidade'), '');
    v_quantidade_text := nullif(trim(v_linha ->> 'quantidade'), '');
    v_valor_text := nullif(trim(v_linha ->> 'valor_unitario'), '');

    IF v_quantidade_text IS NULL OR v_quantidade_text !~ '^[0-9]+([.,][0-9]+)?$' THEN
      RAISE EXCEPTION 'Quantidade inválida no item %.', v_ordem;
    END IF;
    v_quantidade := replace(v_quantidade_text, ',', '.')::numeric;
    IF v_quantidade <= 0 THEN
      RAISE EXCEPTION 'A quantidade deve ser maior que zero no item %.', v_ordem;
    END IF;

    IF v_valor_text IS NOT NULL THEN
      IF v_valor_text !~ '^[0-9]+([.,][0-9]+)?$' THEN
        RAISE EXCEPTION 'Valor unitário inválido no item %.', v_ordem;
      END IF;
      v_valor_unitario := round(replace(v_valor_text, ',', '.')::numeric, 2);
      IF v_valor_unitario < 0 THEN
        RAISE EXCEPTION 'O valor unitário não pode ser negativo no item %.', v_ordem;
      END IF;
    ELSE
      v_valor_unitario := NULL;
    END IF;

    IF v_item_id_text IS NOT NULL THEN
      IF v_item_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Item de estoque inválido no item %.', v_ordem;
      END IF;
      v_item_id := v_item_id_text::uuid;
      SELECT * INTO v_item
      FROM public.items
      WHERE id = v_item_id AND ativo = true;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'O item de estoque informado no item % não está disponível.', v_ordem;
      END IF;
      v_descricao := COALESCE(v_descricao, v_item.nome);
      v_especificacao := COALESCE(v_especificacao, v_item.especificacao);
      v_unidade := COALESCE(v_unidade, v_item.unidade);
      v_valor_unitario := COALESCE(v_valor_unitario, v_item.valor);
      v_origem := 'estoque';
    ELSE
      v_origem := 'avulso';
    END IF;

    IF v_descricao IS NULL THEN
      RAISE EXCEPTION 'Descrição obrigatória no item %.', v_ordem;
    END IF;
    IF v_unidade IS NULL THEN
      RAISE EXCEPTION 'Unidade obrigatória no item %.', v_ordem;
    END IF;

    v_valor_total := CASE WHEN v_valor_unitario IS NULL THEN NULL ELSE round(v_quantidade * v_valor_unitario, 2) END;
    v_total_itens := v_total_itens + 1;
    IF v_valor_total IS NULL THEN
      v_estimativa_incompleta := true;
    ELSE
      v_total_estimado := v_total_estimado + v_valor_total;
    END IF;

    INSERT INTO public.financeiro_necessidade_itens(
      necessidade_id, item_id, origem, descricao, especificacao,
      quantidade, unidade, valor_unitario_estimado, valor_total_estimado,
      item_snapshot, ordem
    ) VALUES (
      v_necessidade_id, v_item_id, v_origem, v_descricao, v_especificacao,
      v_quantidade, v_unidade, v_valor_unitario, v_valor_total,
      jsonb_strip_nulls(jsonb_build_object(
        'id', v_item_id, 'nome', v_descricao, 'especificacao', v_especificacao,
        'unidade', v_unidade, 'valor_unitario_estimado', v_valor_unitario,
        'origem', v_origem
      )),
      v_ordem
    );
  END LOOP;

  UPDATE public.financeiro_necessidades
  SET descricao = 'PN do Almoxarifado — ' || v_total_itens || CASE WHEN v_total_itens = 1 THEN ' item' ELSE ' itens' END,
      quantidade = v_total_itens,
      unidade = 'itens',
      valor_estimado = CASE WHEN v_estimativa_incompleta AND v_total_estimado = 0 THEN NULL ELSE v_total_estimado END,
      estimativa_incompleta = v_estimativa_incompleta,
      base_estimativa = CASE WHEN v_estimativa_incompleta THEN 'Soma parcial das estimativas por item; há item(ns) sem valor.' ELSE 'Soma das estimativas por item da PN.' END,
      updated_at = now()
  WHERE id = v_necessidade_id;

  INSERT INTO public.financeiro_lancamentos(
    necessidade_id, tipo, status, descricao, projeto_centro_custo,
    data_prevista, valor_previsto, origem_tipo, origem_id, criado_por_id
  ) VALUES (
    v_necessidade_id, 'saida', 'previsto', 'PN do Almoxarifado — ' || v_total_itens || CASE WHEN v_total_itens = 1 THEN ' item' ELSE ' itens' END,
    nullif(trim(p_projeto_centro_custo), ''), p_data_necessidade,
    CASE WHEN v_estimativa_incompleta AND v_total_estimado = 0 THEN NULL ELSE v_total_estimado END,
    'manual', v_necessidade_id, auth.uid()
  );

  RETURN v_necessidade_id;
END;
$$;

-- Mantém o endpoint de uma linha para clientes antigos, mas o grava como PN com
-- itens, para que nenhuma PN nova do Almoxarifado fique sem detalhamento.
CREATE OR REPLACE FUNCTION public.criar_previsao_necessidade_almoxarifado(
  p_descricao text,
  p_especificacao text DEFAULT NULL,
  p_quantidade numeric DEFAULT NULL,
  p_unidade text DEFAULT NULL,
  p_valor_estimado numeric DEFAULT NULL,
  p_data_necessidade date DEFAULT NULL,
  p_projeto_centro_custo text DEFAULT NULL,
  p_urgencia text DEFAULT 'normal',
  p_justificativa text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.criar_previsao_necessidade_almoxarifado_lote(
    jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'descricao', p_descricao,
      'especificacao', p_especificacao,
      'quantidade', COALESCE(p_quantidade, 1),
      'unidade', COALESCE(nullif(trim(p_unidade), ''), 'UN'),
      'valor_unitario', p_valor_estimado
    ))),
    p_data_necessidade, p_projeto_centro_custo, p_urgencia, p_justificativa
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_criar_rc_da_pn(p_necessidade_id uuid)
RETURNS TABLE (id uuid, numero bigint, ja_existia boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pn public.financeiro_necessidades%ROWTYPE;
  v_solicitacao public.solicitacoes_material%ROWTYPE;
  v_item public.solicitacao_material_itens%ROWTYPE;
  v_rc public.pedidos_compra%ROWTYPE;
  v_nome text;
  v_tem_itens_lote boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.permissao_individual_efetiva(auth.uid(), 'pode_pedido_compra')
    OR public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_financeiro')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para formalizar RC a partir da PN.';
  END IF;

  SELECT * INTO v_pn
  FROM public.financeiro_necessidades pn
  WHERE pn.id = p_necessidade_id
  FOR UPDATE;

  IF NOT FOUND OR v_pn.status = 'cancelado' THEN
    RAISE EXCEPTION 'PN não disponível para formalização de RC.';
  END IF;

  IF v_pn.requisicao_compra_id IS NOT NULL THEN
    SELECT * INTO v_rc FROM public.pedidos_compra rc WHERE rc.id = v_pn.requisicao_compra_id;
    RETURN QUERY SELECT v_rc.id, v_rc.numero, true;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.financeiro_necessidade_itens linha_existente
    WHERE linha_existente.necessidade_id = v_pn.id
  ) INTO v_tem_itens_lote;

  SELECT COALESCE(nome, email, 'Usuário') INTO v_nome
  FROM public.profiles WHERE user_id = auth.uid();

  IF v_tem_itens_lote THEN
    INSERT INTO public.pedidos_compra (
      criado_por_id, criado_por_nome, observacoes, status, pn_origem_id,
      projeto_centro_custo, especificacao_tecnica, data_necessaria,
      conferencia_estoque, valor_estimado_cotado, status_financeiro_rc, integrar_financeiro
    ) VALUES (
      auth.uid(), COALESCE(v_nome, 'Usuário'),
      'RC formalizada a partir da PN-' || LPAD(v_pn.numero::text, 4, '0') || ' do Almoxarifado.',
      'aberto', v_pn.id,
      v_pn.projeto_centro_custo, v_pn.especificacao, v_pn.data_necessidade,
      COALESCE(v_pn.justificativa, 'Itens conferidos na PN do Almoxarifado.'),
      v_pn.valor_estimado, 'em_cotacao', true
    ) RETURNING * INTO v_rc;

    INSERT INTO public.pedido_compra_itens (pedido_id, item_id, nome_item, quantidade, item_snapshot, status)
    SELECT
      v_rc.id, linha.item_id, linha.descricao, linha.quantidade,
      linha.item_snapshot || jsonb_build_object('unidade', linha.unidade, 'valor_unitario_estimado', linha.valor_unitario_estimado),
      'pendente'
    FROM public.financeiro_necessidade_itens linha
    WHERE linha.necessidade_id = v_pn.id
    ORDER BY linha.ordem;

    RETURN QUERY SELECT v_rc.id, v_rc.numero, false;
    RETURN;
  END IF;

  IF v_pn.solicitacao_material_id IS NULL OR v_pn.solicitacao_material_item_id IS NULL THEN
    RAISE EXCEPTION 'Esta PN não possui itens para formalizar RC.';
  END IF;

  SELECT * INTO v_solicitacao FROM public.solicitacoes_material solicitacao WHERE solicitacao.id = v_pn.solicitacao_material_id;
  SELECT * INTO v_item FROM public.solicitacao_material_itens item_solicitacao WHERE item_solicitacao.id = v_pn.solicitacao_material_item_id;

  INSERT INTO public.pedidos_compra (
    criado_por_id, criado_por_nome, observacoes, estoque_id, status,
    solicitacao_material_id, solicitacao_material_numero, pn_origem_id,
    projeto_centro_custo, especificacao_tecnica, data_necessaria,
    conferencia_estoque, valor_estimado_cotado, status_financeiro_rc, integrar_financeiro
  ) VALUES (
    auth.uid(), COALESCE(v_nome, 'Usuário'),
    'RC formalizada a partir da PN-' || LPAD(v_pn.numero::text, 4, '0') || '.',
    v_solicitacao.estoque_id, 'aberto',
    v_solicitacao.id, v_solicitacao.numero, v_pn.id,
    v_pn.projeto_centro_custo, v_pn.especificacao, v_pn.data_necessidade,
    COALESCE(v_pn.justificativa, 'Conferência de estoque registrada na Solicitação de Material.'),
    v_pn.valor_estimado, 'em_cotacao', true
  ) RETURNING * INTO v_rc;

  INSERT INTO public.pedido_compra_itens (pedido_id, item_id, nome_item, quantidade, item_snapshot, status)
  VALUES (
    v_rc.id, v_item.item_id, v_item.nome_item, v_item.quantidade,
    COALESCE(v_item.item_snapshot, jsonb_build_object('nome', v_item.nome_item, 'unidade', v_item.unidade)),
    'pendente'
  );

  RETURN QUERY SELECT v_rc.id, v_rc.numero, false;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_previsao_necessidade_almoxarifado_lote(jsonb,date,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_previsao_necessidade_almoxarifado_lote(jsonb,date,text,text,text) TO authenticated;

COMMIT;
