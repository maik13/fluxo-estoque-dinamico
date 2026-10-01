BEGIN;

-- Integração operacional: Almoxarifado -> Compras/RC -> Financeiro.
-- A Juliana continua trabalhando no fluxo de Solicitação/Pedido de Compra.
-- O Financeiro passa a receber PN/RC automaticamente, sem redigitação manual.

CREATE OR REPLACE FUNCTION public.financeiro_preparar_pedido_compra_rc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sol public.solicitacoes_material%ROWTYPE;
BEGIN
  IF NEW.solicitacao_material_id IS NOT NULL THEN
    SELECT * INTO v_sol
    FROM public.solicitacoes_material
    WHERE id = NEW.solicitacao_material_id;

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

DROP TRIGGER IF EXISTS trg_financeiro_preparar_pedido_compra_rc ON public.pedidos_compra;
CREATE TRIGGER trg_financeiro_preparar_pedido_compra_rc
BEFORE INSERT OR UPDATE OF solicitacao_material_id, data_necessaria, projeto_centro_custo ON public.pedidos_compra
FOR EACH ROW EXECUTE FUNCTION public.financeiro_preparar_pedido_compra_rc();

CREATE OR REPLACE FUNCTION public.financeiro_sincronizar_rc(p_pedido_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido public.pedidos_compra%ROWTYPE;
  v_sol public.solicitacoes_material%ROWTYPE;
  v_necessidade_id UUID;
  v_descricao TEXT;
  v_valor NUMERIC(14,2);
  v_total_itens INTEGER;
  v_itens_sem_valor INTEGER;
  v_status_pn TEXT;
  v_status_lancamento TEXT;
  v_data_necessidade DATE;
  v_data_financeira DATE;
  v_projeto TEXT;
  v_base_estimativa TEXT;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos_compra WHERE id = p_pedido_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_pedido.solicitacao_material_id IS NOT NULL THEN
    SELECT * INTO v_sol
    FROM public.solicitacoes_material
    WHERE id = v_pedido.solicitacao_material_id;
  END IF;

  SELECT
    COALESCE('RC #' || v_pedido.numero || ' - ' ||
      string_agg(COALESCE(pci.nome_item, pci.item_snapshot->>'nome', i.nome, 'Item'), ', ' ORDER BY pci.created_at),
      'RC #' || v_pedido.numero),
    COALESCE(SUM(CASE WHEN i.valor IS NOT NULL THEN pci.quantidade * i.valor ELSE 0 END),0),
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE pci.item_id IS NULL OR i.valor IS NULL)::integer
  INTO v_descricao, v_valor, v_total_itens, v_itens_sem_valor
  FROM public.pedido_compra_itens pci
  LEFT JOIN public.items i ON i.id = pci.item_id
  WHERE pci.pedido_id = p_pedido_id;

  v_status_pn := CASE
    WHEN v_pedido.status = 'cancelado' THEN 'cancelado'
    WHEN COALESCE(v_pedido.status_financeiro_rc,'em_cotacao') = 'aguardando_aprovacao' THEN 'aguardando_aprovacao'
    WHEN COALESCE(v_pedido.status_financeiro_rc,'em_cotacao') = 'aprovada' THEN 'aprovado'
    WHEN COALESCE(v_pedido.status_financeiro_rc,'em_cotacao') = 'convertida_em_pc' THEN 'comprometido'
    ELSE 'previsto'
  END;

  v_status_lancamento := CASE
    WHEN v_status_pn = 'cancelado' THEN 'cancelado'
    WHEN v_status_pn = 'aguardando_aprovacao' THEN 'aguardando_aprovacao'
    WHEN v_status_pn = 'aprovado' THEN 'aprovado'
    WHEN v_status_pn = 'comprometido' THEN 'comprometido'
    ELSE 'previsto'
  END;

  v_data_necessidade := COALESCE(v_pedido.data_necessaria, v_sol.data_necessidade);
  -- Até Kátia definir condição/vencimento, a data financeira fica como estimativa inicial.
  v_data_financeira := COALESCE(v_pedido.data_limite_compra, v_data_necessidade);
  v_projeto := COALESCE(v_pedido.projeto_centro_custo, v_sol.local_origem, v_sol.origem_modulo);

  v_base_estimativa := CASE
    WHEN v_pedido.valor_estimado_cotado IS NOT NULL THEN 'Valor informado/cotado na RC do Almoxarifado'
    WHEN v_total_itens = 0 THEN 'RC ainda sem itens'
    WHEN COALESCE(v_itens_sem_valor,0) > 0 THEN 'Estimativa parcial: há item avulso ou item sem valor cadastrado'
    ELSE 'Quantidade da RC x valor cadastrado do item'
  END;

  SELECT id INTO v_necessidade_id
  FROM public.financeiro_necessidades
  WHERE requisicao_compra_id = p_pedido_id;

  IF v_necessidade_id IS NULL THEN
    INSERT INTO public.financeiro_necessidades(
      status, origem_tipo, origem_modulo, descricao,
      solicitante_id, solicitante_nome,
      solicitacao_material_id, requisicao_compra_id,
      producao_projeto_id, processo_id, ordem_producao_id,
      valor_estimado, estimativa_incompleta, base_estimativa,
      data_necessidade, data_prevista_desembolso,
      projeto_centro_custo, categoria, subcategoria,
      criado_automaticamente, criado_por_id, criado_por_nome,
      area_solicitante, especificacao, justificativa
    ) VALUES (
      v_status_pn,
      'rc',
      COALESCE(v_sol.origem_modulo,'almoxarifado'),
      v_descricao,
      COALESCE(v_sol.solicitante_id, v_pedido.criado_por_id),
      COALESCE(v_sol.solicitante_nome, v_pedido.criado_por_nome),
      v_pedido.solicitacao_material_id,
      v_pedido.id,
      v_sol.producao_projeto_id,
      v_sol.processo_id,
      v_sol.ordem_producao_id,
      COALESCE(v_pedido.valor_estimado_cotado + COALESCE(v_pedido.frete_custos_adicionais,0), CASE WHEN v_total_itens = 0 OR v_itens_sem_valor = v_total_itens THEN NULL ELSE v_valor END),
      CASE WHEN v_pedido.valor_estimado_cotado IS NOT NULL THEN false ELSE COALESCE(v_itens_sem_valor,0) > 0 END,
      v_base_estimativa,
      v_data_necessidade,
      v_data_financeira,
      v_projeto,
      NULL,
      NULL,
      true,
      v_pedido.criado_por_id,
      v_pedido.criado_por_nome,
      COALESCE(v_sol.solicitante_nome, v_pedido.criado_por_nome, 'Almoxarifado'),
      v_pedido.especificacao_tecnica,
      COALESCE(v_pedido.conferencia_estoque, v_pedido.observacoes)
    )
    RETURNING id INTO v_necessidade_id;
  ELSE
    UPDATE public.financeiro_necessidades
    SET status = v_status_pn,
        descricao = v_descricao,
        solicitacao_material_id = v_pedido.solicitacao_material_id,
        origem_modulo = COALESCE(v_sol.origem_modulo, origem_modulo, 'almoxarifado'),
        producao_projeto_id = COALESCE(v_sol.producao_projeto_id, producao_projeto_id),
        processo_id = COALESCE(v_sol.processo_id, processo_id),
        ordem_producao_id = COALESCE(v_sol.ordem_producao_id, ordem_producao_id),
        valor_estimado = COALESCE(v_pedido.valor_estimado_cotado + COALESCE(v_pedido.frete_custos_adicionais,0), CASE WHEN v_total_itens = 0 OR v_itens_sem_valor = v_total_itens THEN NULL ELSE v_valor END),
        estimativa_incompleta = CASE WHEN v_pedido.valor_estimado_cotado IS NOT NULL THEN false ELSE COALESCE(v_itens_sem_valor,0) > 0 END,
        base_estimativa = v_base_estimativa,
        data_necessidade = COALESCE(v_data_necessidade, data_necessidade),
        data_prevista_desembolso = COALESCE(v_data_financeira, data_prevista_desembolso),
        projeto_centro_custo = COALESCE(v_projeto, projeto_centro_custo),
        area_solicitante = COALESCE(v_sol.solicitante_nome, area_solicitante),
        especificacao = COALESCE(v_pedido.especificacao_tecnica, especificacao),
        justificativa = COALESCE(v_pedido.conferencia_estoque, v_pedido.observacoes, justificativa),
        updated_at = now()
    WHERE id = v_necessidade_id;
  END IF;

  UPDATE public.pedidos_compra
  SET pn_origem_id = v_necessidade_id,
      status_financeiro_rc = COALESCE(status_financeiro_rc, 'em_cotacao'),
      data_necessaria = COALESCE(data_necessaria, v_data_necessidade),
      projeto_centro_custo = COALESCE(projeto_centro_custo, v_projeto),
      conferencia_estoque = COALESCE(conferencia_estoque, 'Gerado pelo Almoxarifado a partir da Solicitação de Material #' || COALESCE(v_sol.numero::text, v_pedido.solicitacao_material_numero::text, 'sem número'))
  WHERE id = p_pedido_id
    AND (
      pn_origem_id IS DISTINCT FROM v_necessidade_id
      OR status_financeiro_rc IS NULL
      OR (data_necessaria IS NULL AND v_data_necessidade IS NOT NULL)
      OR (projeto_centro_custo IS NULL AND v_projeto IS NOT NULL)
      OR conferencia_estoque IS NULL
    );

  INSERT INTO public.financeiro_lancamentos(
    necessidade_id, tipo, status, descricao,
    projeto_centro_custo, producao_projeto_id,
    data_prevista, valor_previsto,
    origem_tipo, origem_id, criado_por_id
  )
  SELECT
    v_necessidade_id,
    'saida',
    v_status_lancamento,
    v_descricao,
    v_projeto,
    v_sol.producao_projeto_id,
    v_data_financeira,
    fn.valor_estimado,
    'rc',
    v_pedido.id,
    v_pedido.criado_por_id
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
    origem_tipo = 'rc',
    origem_id = v_pedido.id,
    updated_at = now();

  RETURN v_necessidade_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_trigger_sincronizar_rc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.pedido_id ELSE NEW.pedido_id END;
  PERFORM public.financeiro_sincronizar_rc(v_id);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_trigger_sincronizar_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.financeiro_sincronizar_rc(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_pedido_compra_itens_sync ON public.pedido_compra_itens;
CREATE TRIGGER trg_financeiro_pedido_compra_itens_sync
AFTER INSERT OR UPDATE OR DELETE ON public.pedido_compra_itens
FOR EACH ROW EXECUTE FUNCTION public.financeiro_trigger_sincronizar_rc();

DROP TRIGGER IF EXISTS trg_financeiro_pedidos_compra_sync ON public.pedidos_compra;
CREATE TRIGGER trg_financeiro_pedidos_compra_sync
AFTER INSERT OR UPDATE OF status, solicitacao_material_id, data_necessaria, projeto_centro_custo, valor_estimado_cotado, frete_custos_adicionais, condicao_pagamento, status_financeiro_rc ON public.pedidos_compra
FOR EACH ROW EXECUTE FUNCTION public.financeiro_trigger_sincronizar_pedido();

-- Backfill controlado apenas para RCs abertas. Não reprocessa histórico concluído/cancelado.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.pedidos_compra
    WHERE status = 'aberto'
      AND pn_origem_id IS NULL
  LOOP
    PERFORM public.financeiro_sincronizar_rc(r.id);
  END LOOP;
END $$;

COMMIT;
