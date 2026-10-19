BEGIN;

-- Compra e pagamento são eventos distintos. A compra assume o compromisso
-- financeiro; o pagamento só é realizado quando a fonte financeira o informa.
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
  v_itens_comprados INTEGER;
  v_status TEXT;
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
    COUNT(*) FILTER (WHERE pci.item_id IS NULL OR i.valor IS NULL)::integer,
    COUNT(*) FILTER (WHERE pci.status IN ('comprado', 'parcial'))::integer
  INTO v_descricao, v_valor, v_total_itens, v_itens_sem_valor, v_itens_comprados
  FROM public.pedido_compra_itens pci
  LEFT JOIN public.items i ON i.id = pci.item_id
  WHERE pci.pedido_id = p_pedido_id;

  v_status := CASE
    WHEN v_pedido.status = 'cancelado' THEN 'cancelado'
    WHEN COALESCE(v_itens_comprados, 0) > 0 THEN 'comprometido'
    ELSE 'previsto'
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
      projeto_centro_custo, criado_automaticamente,
      criado_por_id, criado_por_nome
    ) VALUES (
      v_status, 'rc', COALESCE(v_sol.origem_modulo,'estoque'),
      v_descricao,
      COALESCE(v_sol.solicitante_id, v_pedido.criado_por_id),
      COALESCE(v_sol.solicitante_nome, v_pedido.criado_por_nome),
      v_pedido.solicitacao_material_id, v_pedido.id,
      v_sol.producao_projeto_id, v_sol.processo_id, v_sol.ordem_producao_id,
      CASE WHEN v_total_itens = 0 OR v_itens_sem_valor = v_total_itens THEN NULL ELSE v_valor END,
      COALESCE(v_itens_sem_valor,0) > 0,
      CASE WHEN v_total_itens = 0 THEN 'RC ainda sem itens'
           WHEN v_itens_sem_valor > 0 THEN 'Estimativa parcial pelos valores cadastrados no estoque'
           ELSE 'Quantidade da RC x valor cadastrado do item' END,
      v_sol.data_necessidade,
      v_sol.data_necessidade,
      v_sol.local_origem,
      true,
      v_pedido.criado_por_id,
      v_pedido.criado_por_nome
    )
    RETURNING id INTO v_necessidade_id;
  ELSE
    UPDATE public.financeiro_necessidades
    SET status = v_status,
        descricao = v_descricao,
        solicitacao_material_id = v_pedido.solicitacao_material_id,
        origem_modulo = COALESCE(v_sol.origem_modulo, origem_modulo, 'estoque'),
        producao_projeto_id = COALESCE(v_sol.producao_projeto_id, producao_projeto_id),
        processo_id = COALESCE(v_sol.processo_id, processo_id),
        ordem_producao_id = COALESCE(v_sol.ordem_producao_id, ordem_producao_id),
        valor_estimado = CASE WHEN v_total_itens = 0 OR v_itens_sem_valor = v_total_itens THEN NULL ELSE v_valor END,
        estimativa_incompleta = COALESCE(v_itens_sem_valor,0) > 0,
        base_estimativa = CASE WHEN v_total_itens = 0 THEN 'RC ainda sem itens'
                              WHEN v_itens_sem_valor > 0 THEN 'Estimativa parcial pelos valores cadastrados no estoque'
                              ELSE 'Quantidade da RC x valor cadastrado do item' END,
        data_necessidade = COALESCE(v_sol.data_necessidade, data_necessidade),
        data_prevista_desembolso = COALESCE(v_sol.data_necessidade, data_prevista_desembolso),
        projeto_centro_custo = COALESCE(v_sol.local_origem, projeto_centro_custo),
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
    v_necessidade_id,
    'saida',
    v_status,
    v_descricao,
    COALESCE(v_sol.local_origem, fn.projeto_centro_custo),
    v_sol.producao_projeto_id,
    COALESCE(v_sol.data_necessidade, fn.data_prevista_desembolso),
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
    updated_at = now();

  RETURN v_necessidade_id;
END;
$$;

-- A V2 usa mais de uma grafia para estados equivalentes. Recebimentos e
-- pagamentos são tratados como realizados; vencimento/agendamento permanece
-- pendente de pagamento.
CREATE OR REPLACE FUNCTION public.financeiro_pagina54_status(p_situacao text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := upper(btrim(coalesce(p_situacao, '')));
BEGIN
  IF v IN ('PAGO', 'PAGA', 'QUITADO', 'QUITADA', 'LIQUIDADO', 'LIQUIDADA', 'RECEBIDO', 'RECEBIDA') THEN
    RETURN 'pago';
  ELSIF v IN (
    'AGENDADO', 'PROGRAMADO', 'PROGRAMAÇÃO', 'PROGRAMACAO',
    'AGUARDANDO VENCIMENTO', 'VENCIMENTO', 'VECIMENTO'
  ) THEN
    RETURN 'aguardando_vencimento';
  ELSIF v IN ('PREVISÃO', 'PREVISAO') THEN
    RETURN 'previsto';
  ELSIF v = 'CANCELADO' THEN
    RETURN 'cancelado';
  END IF;
  RETURN 'previsto';
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_normalizar_importacao_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.origem_tipo <> 'pagina54'
     OR current_setting('app.pagina54_sync_import', true) <> 'on' THEN
    RETURN NEW;
  END IF;

  v_status := public.financeiro_pagina54_status(NEW.situacao_original);

  IF v_status = 'cancelado' THEN
    NEW.status := 'cancelado';
  ELSIF v_status = 'pago'
     OR (NEW.data_realizada IS NOT NULL AND COALESCE(NEW.valor_previsto, 0) <> 0) THEN
    NEW.status := 'pago';
    NEW.valor_realizado := COALESCE(NEW.valor_realizado, NEW.valor_previsto);
  ELSIF v_status = 'aguardando_vencimento' THEN
    NEW.status := 'aguardando_vencimento';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_normalizar_importacao_v2 ON public.financeiro_lancamentos;
CREATE TRIGGER trg_financeiro_normalizar_importacao_v2
BEFORE INSERT OR UPDATE OF status, data_realizada, valor_previsto, valor_realizado, situacao_original
ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.financeiro_normalizar_importacao_v2();

-- Reclassifica a base já recebida da V2 sem desfazer uma conciliação ou uma
-- programação confirmada dentro do sistema.
UPDATE public.financeiro_lancamentos l
SET status = CASE
      WHEN upper(btrim(coalesce(i.situacao, ''))) = 'CANCELADO' THEN 'cancelado'
      WHEN public.financeiro_pagina54_status(i.situacao) = 'pago'
        OR (
          public.financeiro_parse_data_br(i.data_realizada_original) IS NOT NULL
          AND COALESCE(l.valor_previsto, 0) <> 0
        ) THEN 'pago'
      WHEN public.financeiro_pagina54_status(i.situacao) = 'aguardando_vencimento' THEN 'aguardando_vencimento'
      ELSE l.status
    END,
    valor_realizado = CASE
      WHEN public.financeiro_pagina54_status(i.situacao) = 'pago'
        OR (
          public.financeiro_parse_data_br(i.data_realizada_original) IS NOT NULL
          AND COALESCE(l.valor_previsto, 0) <> 0
        ) THEN COALESCE(l.valor_realizado, l.valor_previsto)
      ELSE l.valor_realizado
    END,
    updated_at = now()
FROM public.financeiro_importacao_pagina54 i
WHERE l.pagina54_integracao_id = i.integracao_id
  AND l.origem_tipo = 'pagina54'
  AND l.status NOT IN ('conciliado', 'programado')
  AND (
    upper(btrim(coalesce(i.situacao, ''))) IN (
      'CANCELADO', 'PAGO', 'PAGA', 'QUITADO', 'QUITADA',
      'LIQUIDADO', 'LIQUIDADA', 'RECEBIDO', 'RECEBIDA',
      'AGENDADO', 'PROGRAMADO', 'PROGRAMAÇÃO', 'PROGRAMACAO',
      'AGUARDANDO VENCIMENTO', 'VENCIMENTO', 'VECIMENTO'
    )
    OR (
      public.financeiro_parse_data_br(i.data_realizada_original) IS NOT NULL
      AND COALESCE(l.valor_previsto, 0) <> 0
    )
  );

-- Pedidos já marcados para integrar antes da criação do gatilho também passam
-- pelo mesmo fluxo. Compra vira "comprometido"; não vira pagamento.
SELECT public.financeiro_sincronizar_rc(id)
FROM public.pedidos_compra
WHERE integrar_financeiro IS TRUE;

COMMIT;
