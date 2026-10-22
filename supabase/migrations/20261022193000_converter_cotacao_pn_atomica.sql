BEGIN;

CREATE OR REPLACE FUNCTION public.cotacao_converter_em_pn_integrada_v1(p_cotacao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cotacao public.cotacoes%ROWTYPE;
  v_tem_solicitacao boolean;
  v_pn_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.is_admin()
    OR public.permissao_individual_efetiva(v_user,'pode_pedido_compra')
    OR public.permissao_individual_efetiva(v_user,'pode_gerenciar_financeiro')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id=v_user AND p.ativo=true AND p.tipo_usuario='estoquista'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para converter cotação em PN';
  END IF;

  SELECT * INTO v_cotacao
  FROM public.cotacoes
  WHERE id=p_cotacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;

  IF v_cotacao.financeiro_necessidade_id IS NOT NULL THEN
    RETURN v_cotacao.financeiro_necessidade_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.cotacao_solicitacoes_vinculos
    WHERE cotacao_id=p_cotacao_id
  ) INTO v_tem_solicitacao;

  IF v_tem_solicitacao AND v_cotacao.status='confirmada' THEN
    PERFORM public.cotacao_escolher_proposta_multi_v1(p_cotacao_id);
  END IF;

  v_pn_id := public.cotacao_converter_em_pn_v1(p_cotacao_id);

  IF v_pn_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.financeiro_necessidades WHERE id=v_pn_id
  ) THEN
    RAISE EXCEPTION 'A PN não foi criada; nenhuma alteração foi mantida';
  END IF;

  RETURN v_pn_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cotacao_converter_em_pn_integrada_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotacao_converter_em_pn_integrada_v1(uuid) TO authenticated;

COMMIT;
