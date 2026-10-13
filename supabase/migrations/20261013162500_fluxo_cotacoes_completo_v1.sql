BEGIN;

CREATE OR REPLACE FUNCTION public.cotacao_escolher_proposta_v1(p_cotacao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cotacao public.cotacoes%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.is_admin()
    OR public.permissao_individual_efetiva(v_user,'pode_pedido_compra')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id=v_user
        AND p.ativo=true
        AND p.tipo_usuario='estoquista'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para escolher proposta';
  END IF;

  SELECT *
  INTO v_cotacao
  FROM public.cotacoes
  WHERE id=p_cotacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;

  IF v_cotacao.solicitacao_id IS NULL THEN
    RAISE EXCEPTION 'Esta cotação não está vinculada a uma solicitação';
  END IF;

  IF v_cotacao.status NOT IN ('confirmada','escolhida') THEN
    RAISE EXCEPTION 'Confirme a cotação antes de escolhê-la';
  END IF;

  UPDATE public.cotacoes
  SET status='rejeitada',
      updated_at=now()
  WHERE solicitacao_id=v_cotacao.solicitacao_id
    AND id<>v_cotacao.id
    AND status IN ('confirmada','escolhida');

  UPDATE public.cotacoes
  SET status='escolhida',
      updated_at=now()
  WHERE id=v_cotacao.id;

  UPDATE public.cotacao_solicitacoes
  SET status='escolhida',
      updated_at=now()
  WHERE id=v_cotacao.solicitacao_id;

  RETURN v_cotacao.solicitacao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cotacao_escolher_proposta_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotacao_escolher_proposta_v1(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cotacao_converter_em_pn_v1(p_cotacao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cotacao public.cotacoes%ROWTYPE;
  v_profile record;
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
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id=v_user
        AND p.ativo=true
        AND p.tipo_usuario='estoquista'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para converter cotação em PN';
  END IF;

  SELECT *
  INTO v_cotacao
  FROM public.cotacoes
  WHERE id=p_cotacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;

  IF v_cotacao.financeiro_necessidade_id IS NOT NULL THEN
    RETURN v_cotacao.financeiro_necessidade_id;
  END IF;

  IF v_cotacao.solicitacao_id IS NOT NULL THEN
    IF v_cotacao.status <> 'escolhida' THEN
      RAISE EXCEPTION 'A proposta precisa ser escolhida no processo de cotação antes de gerar PN';
    END IF;
  ELSIF v_cotacao.status NOT IN ('confirmada','escolhida') THEN
    RAISE EXCEPTION 'A cotação precisa estar confirmada antes de gerar PN';
  END IF;

  IF COALESCE(v_cotacao.valor_total,0) <= 0 THEN
    RAISE EXCEPTION 'Informe o valor total antes de converter em PN';
  END IF;

  SELECT nome,email
  INTO v_profile
  FROM public.profiles
  WHERE user_id=v_user
  LIMIT 1;

  INSERT INTO public.financeiro_necessidades(
    origem_tipo,
    origem_modulo,
    descricao,
    solicitante_id,
    solicitante_nome,
    valor_estimado,
    estimativa_incompleta,
    base_estimativa,
    projeto_centro_custo,
    categoria,
    criado_automaticamente,
    criado_por_id,
    criado_por_nome,
    especificacao,
    justificativa
  )
  VALUES (
    'manual',
    'cotacoes',
    COALESCE(v_cotacao.descricao,'Cotação #'||v_cotacao.numero::text)
      || CASE WHEN v_cotacao.fornecedor_nome IS NOT NULL THEN ' · '||v_cotacao.fornecedor_nome ELSE '' END,
    v_user,
    COALESCE(v_profile.nome,v_profile.email,'Usuário'),
    v_cotacao.valor_total,
    false,
    'Cotação #'||v_cotacao.numero::text,
    v_cotacao.projeto_centro_custo,
    CASE v_cotacao.tipo
      WHEN 'frete' THEN 'Frete'
      WHEN 'insumo' THEN 'Insumo'
      ELSE 'Orçamento global'
    END,
    false,
    v_user,
    COALESCE(v_profile.nome,v_profile.email,'Usuário'),
    COALESCE(v_cotacao.descricao,'Cotação aprovada'),
    'Originada da Central de Cotações. Documento original preservado na cotação #'||v_cotacao.numero::text
  )
  RETURNING id INTO v_pn_id;

  UPDATE public.cotacoes
  SET financeiro_necessidade_id=v_pn_id,
      status='convertida_pn',
      updated_at=now()
  WHERE id=p_cotacao_id;

  IF v_cotacao.solicitacao_id IS NOT NULL THEN
    UPDATE public.cotacao_solicitacoes
    SET status='encerrada',
        updated_at=now()
    WHERE id=v_cotacao.solicitacao_id;
  END IF;

  RETURN v_pn_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cotacao_converter_em_pn_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotacao_converter_em_pn_v1(uuid) TO authenticated;

COMMIT;