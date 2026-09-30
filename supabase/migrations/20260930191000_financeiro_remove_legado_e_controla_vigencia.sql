BEGIN;

-- Correção de escopo:
-- o Financeiro começa "do zero" e não incorpora registros históricos de pedidos_compra.
-- A estrutura de pedidos de compra permanece intacta e será aproveitada somente a partir
-- da ativação explícita da integração financeira.

CREATE TABLE IF NOT EXISTS public.financeiro_configuracao (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  rc_integracao_ativa BOOLEAN NOT NULL DEFAULT false,
  vigencia_inicio TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.financeiro_configuracao(id, rc_integracao_ativa, vigencia_inicio)
VALUES (true, false, NULL)
ON CONFLICT (id) DO UPDATE
SET rc_integracao_ativa = false,
    vigencia_inicio = NULL,
    updated_at = now();

ALTER TABLE public.pedidos_compra
  ADD COLUMN IF NOT EXISTS financeiro_integrado_em TIMESTAMPTZ NULL;

ALTER TABLE public.pedidos_compra
  ALTER COLUMN status_financeiro_rc DROP NOT NULL,
  ALTER COLUMN status_financeiro_rc DROP DEFAULT;

-- Desfaz os vínculos financeiros que foram criados retroativamente em pedidos antigos.
UPDATE public.pedidos_compra
SET pn_origem_id = NULL,
    status_financeiro_rc = NULL,
    financeiro_integrado_em = NULL,
    projeto_centro_custo = NULL,
    especificacao_tecnica = NULL,
    data_necessaria = NULL,
    conferencia_estoque = NULL,
    fornecedores_consultados = NULL,
    valor_estimado_cotado = NULL,
    frete_custos_adicionais = NULL,
    condicao_pagamento = NULL,
    lead_time_dias = NULL,
    data_limite_compra = NULL,
    impacto_financeiro = NULL,
    estoque_conferido_por = NULL,
    estoque_conferido_em = NULL,
    especificacao_confirmada_por = NULL,
    especificacao_confirmada_em = NULL,
    impacto_financeiro_registrado_por = NULL,
    impacto_financeiro_registrado_em = NULL,
    aprovacao_executiva_por = NULL,
    aprovacao_executiva_em = NULL
WHERE financeiro_integrado_em IS NOT NULL
   OR pn_origem_id IS NOT NULL
   OR status_financeiro_rc IS NOT NULL;

DELETE FROM public.financeiro_lancamentos fl
USING public.financeiro_necessidades fn
WHERE fl.necessidade_id = fn.id
  AND fn.criado_automaticamente = true
  AND fn.origem_tipo = 'rc';

DELETE FROM public.financeiro_necessidades
WHERE criado_automaticamente = true
  AND origem_tipo = 'rc';

-- Como ainda não há dados financeiros oficiais, reinicia a numeração da fase de testes.
SELECT setval('public.financeiro_necessidades_numero_seq', 1, false);
SELECT setval('public.financeiro_lancamentos_numero_seq', 1, false);

CREATE OR REPLACE FUNCTION public.financeiro_sincronizar_rc(p_pedido_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido public.pedidos_compra%ROWTYPE;
  v_sol public.solicitacoes_material%ROWTYPE;
  v_cfg public.financeiro_configuracao%ROWTYPE;
  v_necessidade_id UUID;
  v_descricao TEXT;
  v_valor NUMERIC(14,2);
  v_total_itens INTEGER;
  v_itens_sem_valor INTEGER;
  v_status TEXT;
BEGIN
  SELECT * INTO v_cfg
  FROM public.financeiro_configuracao
  WHERE id = true;

  -- Enquanto o usuário não ativar explicitamente o novo Financeiro, nenhuma RC é integrada.
  IF NOT FOUND OR NOT v_cfg.rc_integracao_ativa OR v_cfg.vigencia_inicio IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_pedido
  FROM public.pedidos_compra
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Registros anteriores ao início oficial nunca entram retroativamente.
  IF v_pedido.data_pedido IS NULL OR v_pedido.data_pedido < v_cfg.vigencia_inicio THEN
    RETURN NULL;
  END IF;

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

  v_status := CASE WHEN v_pedido.status = 'cancelado' THEN 'cancelado' ELSE 'previsto' END;

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
    CASE WHEN v_status = 'cancelado' THEN 'cancelado' ELSE 'previsto' END,
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

  UPDATE public.pedidos_compra
  SET financeiro_integrado_em = COALESCE(financeiro_integrado_em, now())
  WHERE id = p_pedido_id;

  RETURN v_necessidade_id;
END;
$$;

ALTER TABLE public.financeiro_configuracao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_config_select ON public.financeiro_configuracao;
CREATE POLICY fin_config_select ON public.financeiro_configuracao
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
);

DROP POLICY IF EXISTS fin_config_write ON public.financeiro_configuracao;
CREATE POLICY fin_config_write ON public.financeiro_configuracao
FOR ALL TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'));

COMMIT;
