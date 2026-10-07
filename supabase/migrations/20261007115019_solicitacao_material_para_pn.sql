-- Fluxo oficial: Solicitação de Material -> PN -> RC -> PC.
-- As RCs já existentes são históricas e não são alteradas por esta migration.

ALTER TABLE public.financeiro_necessidades
  ADD COLUMN IF NOT EXISTS solicitacao_material_item_id UUID
    REFERENCES public.solicitacao_material_itens(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_necessidades_pn_item_solicitacao_unica
  ON public.financeiro_necessidades (solicitacao_material_item_id)
  WHERE solicitacao_material_item_id IS NOT NULL
    AND origem_tipo = 'solicitacao_material';

CREATE OR REPLACE FUNCTION public.financeiro_criar_pns_da_solicitacao(
  p_solicitacao_material_id UUID,
  p_itens_ids UUID[]
)
RETURNS TABLE (id UUID, numero BIGINT, ja_existia BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_solicitacao public.solicitacoes_material%ROWTYPE;
  v_item public.solicitacao_material_itens%ROWTYPE;
  v_pn public.financeiro_necessidades%ROWTYPE;
  v_valor NUMERIC(14,2);
  v_descricao TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.permissao_individual_efetiva(auth.uid(), 'pode_solicitacao_material')
    OR public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_financeiro')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para encaminhar uma Solicitação de Material para PN.';
  END IF;

  SELECT * INTO v_solicitacao
  FROM public.solicitacoes_material
  WHERE id = p_solicitacao_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de Material não encontrada.';
  END IF;

  IF v_solicitacao.status <> 'aprovada' THEN
    RAISE EXCEPTION 'A Solicitação de Material precisa estar aprovada antes de gerar PN.';
  END IF;

  FOR v_item IN
    SELECT si.*
    FROM public.solicitacao_material_itens si
    WHERE si.solicitacao_material_id = p_solicitacao_material_id
      AND si.id = ANY (COALESCE(p_itens_ids, ARRAY[]::UUID[]))
    ORDER BY si.created_at, si.id
  LOOP
    SELECT * INTO v_pn
    FROM public.financeiro_necessidades
    WHERE solicitacao_material_item_id = v_item.id
      AND origem_tipo = 'solicitacao_material';

    IF FOUND THEN
      RETURN QUERY SELECT v_pn.id, v_pn.numero, true;
      CONTINUE;
    END IF;

    SELECT COALESCE(v_item.quantidade * i.valor, NULL)
    INTO v_valor
    FROM public.items i
    WHERE i.id = v_item.item_id;

    v_descricao := 'PN da Solicitação #' || v_solicitacao.numero || ' - ' || v_item.nome_item;

    INSERT INTO public.financeiro_necessidades (
      status, origem_tipo, origem_modulo, descricao,
      solicitante_id, solicitante_nome,
      solicitacao_material_id, solicitacao_material_item_id,
      producao_projeto_id, processo_id, ordem_producao_id,
      item_id, quantidade, unidade,
      valor_estimado, estimativa_incompleta, base_estimativa,
      data_necessidade, data_prevista_desembolso,
      projeto_centro_custo,
      criado_automaticamente, criado_por_id, criado_por_nome,
      area_solicitante, especificacao, justificativa
    ) VALUES (
      'previsto', 'solicitacao_material', COALESCE(v_solicitacao.origem_modulo, 'almoxarifado'), v_descricao,
      v_solicitacao.solicitante_id, v_solicitacao.solicitante_nome,
      v_solicitacao.id, v_item.id,
      v_solicitacao.producao_projeto_id, v_solicitacao.processo_id, v_solicitacao.ordem_producao_id,
      v_item.item_id, v_item.quantidade, v_item.unidade,
      v_valor, v_valor IS NULL,
      CASE WHEN v_valor IS NULL THEN 'Estimativa pendente: item sem valor cadastrado ou avulso.' ELSE 'Quantidade solicitada x valor cadastrado do item.' END,
      v_solicitacao.data_necessidade, v_solicitacao.data_necessidade,
      COALESCE(v_solicitacao.local_origem, v_solicitacao.origem_modulo),
      true, auth.uid(), v_solicitacao.solicitante_nome,
      v_solicitacao.solicitante_nome, v_item.nome_item,
      COALESCE(v_item.observacoes, 'Necessidade identificada pelo Almoxarifado após conferência de saldo.')
    )
    RETURNING * INTO v_pn;

    INSERT INTO public.financeiro_lancamentos (
      necessidade_id, tipo, status, descricao,
      projeto_centro_custo, producao_projeto_id,
      data_prevista, valor_previsto,
      origem_tipo, origem_id, criado_por_id
    ) VALUES (
      v_pn.id, 'saida', 'previsto', v_descricao,
      v_pn.projeto_centro_custo, v_pn.producao_projeto_id,
      v_pn.data_prevista_desembolso, v_pn.valor_estimado,
      'solicitacao_material', v_solicitacao.id, auth.uid()
    );

    RETURN QUERY SELECT v_pn.id, v_pn.numero, false;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.aprovar_solicitacao_material_com_pns(
  p_solicitacao_material_id UUID,
  p_itens_ids UUID[]
)
RETURNS TABLE (id UUID, numero BIGINT, ja_existia BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_solicitacao public.solicitacoes_material%ROWTYPE;
  v_nome TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.permissao_individual_efetiva(auth.uid(), 'pode_solicitacao_material') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar Solicitação de Material.';
  END IF;

  SELECT * INTO v_solicitacao
  FROM public.solicitacoes_material
  WHERE id = p_solicitacao_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de Material não encontrada.';
  END IF;

  SELECT COALESCE(nome, email, 'Usuário') INTO v_nome
  FROM public.profiles
  WHERE user_id = auth.uid();

  UPDATE public.solicitacoes_material
  SET status = 'aprovada',
      aprovado_por_id = auth.uid(),
      aprovado_por_nome = COALESCE(v_nome, 'Usuário'),
      data_aprovacao = COALESCE(data_aprovacao, now()),
      updated_at = now()
  WHERE id = p_solicitacao_material_id;

  RETURN QUERY
  SELECT * FROM public.financeiro_criar_pns_da_solicitacao(p_solicitacao_material_id, p_itens_ids);
END;
$$;

-- Ao criar RC a partir de uma PN, a PN já é vinculada no BEFORE INSERT.
-- Assim o sincronismo financeiro existente atualiza a mesma PN e não cria outra previsão.
CREATE OR REPLACE FUNCTION public.financeiro_preparar_pedido_compra_rc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sol public.solicitacoes_material%ROWTYPE;
BEGIN
  IF NEW.pn_origem_id IS NOT NULL THEN
    UPDATE public.financeiro_necessidades
    SET requisicao_compra_id = NEW.id,
        updated_at = now()
    WHERE id = NEW.pn_origem_id
      AND (requisicao_compra_id IS NULL OR requisicao_compra_id = NEW.id);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A PN de origem não está disponível para gerar RC.';
    END IF;
  END IF;

  IF NEW.solicitacao_material_id IS NOT NULL THEN
    SELECT * INTO v_sol
    FROM public.solicitacoes_material
    WHERE id = NEW.solicitacao_material_id;

    NEW.integrar_financeiro := true;

    IF FOUND THEN
      NEW.data_necessaria := COALESCE(NEW.data_necessaria, v_sol.data_necessidade);
      NEW.projeto_centro_custo := COALESCE(NEW.projeto_centro_custo, v_sol.local_origem, v_sol.origem_modulo);
      NEW.conferencia_estoque := COALESCE(
        NEW.conferencia_estoque,
        'Gerado pelo Almoxarifado a partir da Solicitação de Material #' || COALESCE(v_sol.numero::text, 'sem número') || '. Itens enviados para compra por falta de saldo, item avulso ou necessidade de aquisição.'
      );
      NEW.status_financeiro_rc := COALESCE(NEW.status_financeiro_rc, 'em_cotacao');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_atualizar_pn_apos_rc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status_pn TEXT;
BEGIN
  IF NEW.pn_origem_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_status_pn := CASE
    WHEN NEW.status = 'cancelado' THEN 'cancelado'
    WHEN NEW.status_financeiro_rc = 'aguardando_aprovacao' THEN 'aguardando_aprovacao'
    WHEN NEW.status_financeiro_rc = 'aprovada' THEN 'aprovado'
    WHEN NEW.status_financeiro_rc = 'convertida_em_pc' THEN 'comprometido'
    ELSE 'em_cotacao'
  END;

  UPDATE public.financeiro_necessidades
  SET status = v_status_pn,
      requisicao_compra_id = NEW.id,
      updated_at = now()
  WHERE id = NEW.pn_origem_id;

  UPDATE public.financeiro_lancamentos
  SET status = CASE
        WHEN v_status_pn = 'em_cotacao' THEN 'em_cotacao'
        ELSE v_status_pn
      END,
      origem_tipo = 'rc',
      origem_id = NEW.id,
      updated_at = now()
  WHERE necessidade_id = NEW.pn_origem_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_pn_apos_rc ON public.pedidos_compra;
CREATE TRIGGER trg_financeiro_pn_apos_rc
AFTER INSERT OR UPDATE OF status, status_financeiro_rc, pn_origem_id ON public.pedidos_compra
FOR EACH ROW EXECUTE FUNCTION public.financeiro_atualizar_pn_apos_rc();

CREATE OR REPLACE FUNCTION public.financeiro_criar_rc_da_pn(p_necessidade_id UUID)
RETURNS TABLE (id UUID, numero BIGINT, ja_existia BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pn public.financeiro_necessidades%ROWTYPE;
  v_solicitacao public.solicitacoes_material%ROWTYPE;
  v_item public.solicitacao_material_itens%ROWTYPE;
  v_rc public.pedidos_compra%ROWTYPE;
  v_nome TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.permissao_individual_efetiva(auth.uid(), 'pode_pedido_compra')
    OR public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_financeiro')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para formalizar RC a partir da PN.';
  END IF;

  SELECT * INTO v_pn
  FROM public.financeiro_necessidades
  WHERE id = p_necessidade_id
  FOR UPDATE;

  IF NOT FOUND OR v_pn.status = 'cancelado' THEN
    RAISE EXCEPTION 'PN não disponível para formalização de RC.';
  END IF;

  IF v_pn.requisicao_compra_id IS NOT NULL THEN
    SELECT * INTO v_rc FROM public.pedidos_compra WHERE id = v_pn.requisicao_compra_id;
    RETURN QUERY SELECT v_rc.id, v_rc.numero, true;
    RETURN;
  END IF;

  IF v_pn.solicitacao_material_id IS NULL OR v_pn.solicitacao_material_item_id IS NULL THEN
    RAISE EXCEPTION 'Esta PN não tem item de Solicitação de Material para formalizar RC.';
  END IF;

  SELECT * INTO v_solicitacao FROM public.solicitacoes_material WHERE id = v_pn.solicitacao_material_id;
  SELECT * INTO v_item FROM public.solicitacao_material_itens WHERE id = v_pn.solicitacao_material_item_id;
  SELECT COALESCE(nome, email, 'Usuário') INTO v_nome FROM public.profiles WHERE user_id = auth.uid();

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

REVOKE ALL ON FUNCTION public.financeiro_criar_pns_da_solicitacao(UUID, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aprovar_solicitacao_material_com_pns(UUID, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.financeiro_criar_rc_da_pn(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_criar_pns_da_solicitacao(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_solicitacao_material_com_pns(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.financeiro_criar_rc_da_pn(UUID) TO authenticated;
