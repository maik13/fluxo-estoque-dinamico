BEGIN;

CREATE OR REPLACE FUNCTION public.almoxarifado_transformar_rc_em_pc_v2(
  p_rc_id uuid,
  p_fornecedor text DEFAULT NULL,
  p_fornecedor_identificacao text DEFAULT NULL,
  p_fornecedor_contato text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_valor_itens numeric DEFAULT NULL,
  p_frete numeric DEFAULT NULL,
  p_condicao text DEFAULT NULL,
  p_prazo text DEFAULT NULL,
  p_local text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_rc public.pedidos_compra%ROWTYPE;
  v_pc_id uuid;
  v_fornecedor text;
  v_descricao text;
  v_valor numeric;
  v_frete numeric;
  v_nome text;
BEGIN
  IF v_user IS NULL OR NOT (
    public.is_admin()
    OR public.permissao_individual_efetiva(v_user,'pode_pedido_compra')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id=v_user AND coalesce(p.ativo,true) AND p.tipo_usuario='estoquista'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para transformar RC em PC';
  END IF;

  SELECT * INTO v_rc FROM public.pedidos_compra WHERE id=p_rc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RC não encontrada'; END IF;

  SELECT id INTO v_pc_id
  FROM public.financeiro_pedidos_compra_formais
  WHERE requisicao_compra_id=p_rc_id;
  IF v_pc_id IS NOT NULL THEN RETURN v_pc_id; END IF;

  IF v_rc.status_financeiro_rc<>'aprovada' THEN
    RAISE EXCEPTION 'A RC precisa estar aprovada antes de virar PC';
  END IF;

  SELECT
    coalesce(nullif(btrim(p_fornecedor),''),nullif(btrim(v_rc.fornecedores_consultados),''),nullif(btrim(c.fornecedor_nome),'')),
    coalesce(nullif(btrim(p_descricao),''),nullif(btrim(v_rc.especificacao_tecnica),''),nullif(btrim(c.descricao),''),nullif(btrim(fn.descricao),'')),
    coalesce(p_valor_itens,v_rc.valor_estimado_cotado,fn.valor_estimado),
    coalesce(p_frete,v_rc.frete_custos_adicionais,0)
  INTO v_fornecedor,v_descricao,v_valor,v_frete
  FROM public.financeiro_necessidades fn
  LEFT JOIN public.cotacoes c ON c.financeiro_necessidade_id=fn.id
  WHERE fn.id=v_rc.pn_origem_id
  LIMIT 1;

  v_fornecedor := coalesce(v_fornecedor,nullif(btrim(p_fornecedor),''));
  v_descricao := coalesce(v_descricao,nullif(btrim(p_descricao),''),'Compra originada da RC-'||lpad(v_rc.numero::text,4,'0'));
  v_valor := coalesce(v_valor,p_valor_itens,v_rc.valor_estimado_cotado);
  v_frete := coalesce(v_frete,p_frete,v_rc.frete_custos_adicionais,0);

  IF v_fornecedor IS NULL THEN RAISE EXCEPTION 'Informe o fornecedor da RC'; END IF;
  IF v_valor IS NULL OR v_valor<=0 OR v_frete<0 THEN RAISE EXCEPTION 'Informe valores válidos na RC'; END IF;

  SELECT coalesce(nome,email,'Usuário') INTO v_nome FROM public.profiles WHERE user_id=v_user LIMIT 1;

  INSERT INTO public.financeiro_pedidos_compra_formais(
    requisicao_compra_id,necessidade_id,fornecedor,fornecedor_identificacao,
    fornecedor_contato,descricao,valor_itens,frete_custos_adicionais,
    condicao_pagamento,prazo_entrega,local_entrega,criado_por_id,criado_por_nome
  ) VALUES (
    p_rc_id,v_rc.pn_origem_id,v_fornecedor,nullif(btrim(p_fornecedor_identificacao),''),
    nullif(btrim(p_fornecedor_contato),''),v_descricao,v_valor,v_frete,
    coalesce(nullif(btrim(p_condicao),''),v_rc.condicao_pagamento),
    nullif(btrim(p_prazo),''),nullif(btrim(p_local),''),v_user,v_nome
  ) RETURNING id INTO v_pc_id;

  UPDATE public.pedidos_compra
  SET status_financeiro_rc='convertida_em_pc',updated_at=now()
  WHERE id=p_rc_id;

  RETURN v_pc_id;
END;
$$;

REVOKE ALL ON FUNCTION public.almoxarifado_transformar_rc_em_pc_v2(uuid,text,text,text,text,numeric,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.almoxarifado_transformar_rc_em_pc_v2(uuid,text,text,text,text,numeric,numeric,text,text,text) TO authenticated;

COMMIT;
