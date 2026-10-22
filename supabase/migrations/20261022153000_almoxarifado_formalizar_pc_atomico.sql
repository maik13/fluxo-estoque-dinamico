BEGIN;
CREATE OR REPLACE FUNCTION public.almoxarifado_formalizar_pc_v1(
 p_rc_id uuid,p_fornecedor text,p_descricao text,p_valor_itens numeric,p_frete numeric DEFAULT 0,p_condicao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rc public.pedidos_compra%ROWTYPE; v_pc uuid; v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL OR NOT (
  public.is_admin() OR public.permissao_individual_efetiva(v_user,'pode_pedido_compra')
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=v_user AND coalesce(p.ativo,true) AND p.tipo_usuario='estoquista')
 ) THEN RAISE EXCEPTION 'Sem permissão para formalizar PC'; END IF;
 SELECT * INTO v_rc FROM public.pedidos_compra WHERE id=p_rc_id FOR UPDATE;
 IF NOT FOUND OR v_rc.status_financeiro_rc<>'aprovada' THEN RAISE EXCEPTION 'A RC precisa estar aprovada'; END IF;
 IF nullif(btrim(p_fornecedor),'') IS NULL OR nullif(btrim(p_descricao),'') IS NULL
  OR p_valor_itens IS NULL OR p_valor_itens<=0 OR coalesce(p_frete,0)<0 THEN
  RAISE EXCEPTION 'Fornecedor, descrição e valores válidos são obrigatórios'; END IF;
 IF EXISTS(SELECT 1 FROM public.financeiro_pedidos_compra_formais WHERE requisicao_compra_id=p_rc_id) THEN
  RAISE EXCEPTION 'RC já possui PC formal'; END IF;
 INSERT INTO public.financeiro_pedidos_compra_formais(
  requisicao_compra_id,necessidade_id,fornecedor,descricao,valor_itens,frete_custos_adicionais,condicao_pagamento,criado_por_id)
 VALUES(p_rc_id,v_rc.pn_origem_id,btrim(p_fornecedor),btrim(p_descricao),p_valor_itens,coalesce(p_frete,0),p_condicao,v_user)
 RETURNING id INTO v_pc;
 UPDATE public.pedidos_compra SET status_financeiro_rc='convertida_em_pc' WHERE id=p_rc_id;
 RETURN v_pc;
END $$;
REVOKE ALL ON FUNCTION public.almoxarifado_formalizar_pc_v1(uuid,text,text,numeric,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.almoxarifado_formalizar_pc_v1(uuid,text,text,numeric,numeric,text) TO authenticated;
COMMIT;