BEGIN;

-- A decisão depois da aprovação precisa ser explícita: gerar PN ou encerrar
-- a demanda sem compra. O segundo caso não apaga orçamento, solicitação nem
-- histórico; apenas registra que aquela proposta não se transformará em PN.
ALTER TABLE public.cotacoes
  DROP CONSTRAINT IF EXISTS cotacoes_status_check;

ALTER TABLE public.cotacoes
  ADD CONSTRAINT cotacoes_status_check
  CHECK (status = ANY (ARRAY[
    'rascunho', 'em_validacao', 'confirmada', 'escolhida',
    'rejeitada', 'convertida_pn', 'encerrada_sem_pn'
  ]::text[]));

CREATE OR REPLACE FUNCTION public.cotacao_encerrar_sem_pn_v1(p_cotacao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cotacao public.cotacoes%ROWTYPE;
  v_solicitacao record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.is_admin()
    OR public.permissao_individual_efetiva(v_user, 'pode_pedido_compra')
    OR public.permissao_individual_efetiva(v_user, 'pode_gerenciar_financeiro')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = v_user AND p.ativo = true AND p.tipo_usuario = 'estoquista'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para encerrar uma cotação';
  END IF;

  SELECT * INTO v_cotacao
  FROM public.cotacoes
  WHERE id = p_cotacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;

  IF v_cotacao.financeiro_necessidade_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta cotação já gerou uma PN e não pode ser encerrada sem PN';
  END IF;

  IF v_cotacao.status <> 'escolhida' OR v_cotacao.aprovacao_status <> 'aprovada' THEN
    RAISE EXCEPTION 'Escolha e aprove a proposta antes de decidir não gerar PN';
  END IF;

  UPDATE public.cotacoes
  SET status = 'encerrada_sem_pn', updated_at = now()
  WHERE id = p_cotacao_id;

  FOR v_solicitacao IN
    SELECT s.id, s.status
    FROM public.cotacao_solicitacoes_vinculos v
    JOIN public.cotacao_solicitacoes s ON s.id = v.solicitacao_id
    WHERE v.cotacao_id = p_cotacao_id
  LOOP
    UPDATE public.cotacao_solicitacoes
    SET status = 'encerrada', updated_at = now()
    WHERE id = v_solicitacao.id;

    INSERT INTO public.cotacao_fluxo_auditoria(
      solicitacao_id, cotacao_id, evento, status_anterior, status_novo, detalhes
    ) VALUES (
      v_solicitacao.id,
      p_cotacao_id,
      'encerrada_sem_pn',
      v_solicitacao.status,
      'encerrada',
      jsonb_build_object('decisao', 'nao_gerar_pn')
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.cotacao_encerrar_sem_pn_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotacao_encerrar_sem_pn_v1(uuid) TO authenticated;

-- A PN encerra todas as solicitações ligadas à cotação, não apenas o vínculo
-- legado da primeira solicitação. Assim SOL-xxxx continua rastreável até PN-xxxx.
CREATE OR REPLACE FUNCTION public.cotacao_converter_em_pn_v1(p_cotacao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cotacao public.cotacoes%ROWTYPE;
  v_profile record;
  v_pn_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT (
    public.is_admin()
    OR public.permissao_individual_efetiva(v_user,'pode_pedido_compra')
    OR public.permissao_individual_efetiva(v_user,'pode_gerenciar_financeiro')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=v_user AND p.ativo=true AND p.tipo_usuario='estoquista')
  ) THEN RAISE EXCEPTION 'Sem permissão para converter cotação em PN'; END IF;

  SELECT * INTO v_cotacao FROM public.cotacoes WHERE id=p_cotacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF v_cotacao.financeiro_necessidade_id IS NOT NULL THEN RETURN v_cotacao.financeiro_necessidade_id; END IF;

  IF EXISTS (SELECT 1 FROM public.cotacao_solicitacoes_vinculos WHERE cotacao_id=p_cotacao_id) THEN
    IF v_cotacao.status <> 'escolhida' OR v_cotacao.aprovacao_status <> 'aprovada' THEN
      RAISE EXCEPTION 'A proposta vinculada à solicitação precisa estar escolhida e aprovada antes de gerar PN';
    END IF;
  ELSIF v_cotacao.status NOT IN ('confirmada','escolhida') THEN
    RAISE EXCEPTION 'A cotação precisa estar confirmada antes de gerar PN';
  END IF;

  IF COALESCE(v_cotacao.valor_total,0) <= 0 THEN RAISE EXCEPTION 'Informe o valor total antes de converter em PN'; END IF;
  SELECT nome,email INTO v_profile FROM public.profiles WHERE user_id=v_user LIMIT 1;

  INSERT INTO public.financeiro_necessidades(
    origem_tipo, origem_modulo, descricao, solicitante_id, solicitante_nome,
    valor_estimado, estimativa_incompleta, base_estimativa, projeto_centro_custo,
    categoria, criado_automaticamente, criado_por_id, criado_por_nome, especificacao, justificativa
  ) VALUES (
    'manual', 'cotacoes',
    COALESCE(v_cotacao.descricao,'Cotação #'||v_cotacao.numero::text)
      || CASE WHEN v_cotacao.fornecedor_nome IS NOT NULL THEN ' · '||v_cotacao.fornecedor_nome ELSE '' END,
    v_user, COALESCE(v_profile.nome,v_profile.email,'Usuário'),
    v_cotacao.valor_total, false, 'Cotação #'||v_cotacao.numero::text,
    v_cotacao.projeto_centro_custo,
    CASE v_cotacao.tipo WHEN 'frete' THEN 'Frete' WHEN 'insumo' THEN 'Insumo' ELSE 'Orçamento global' END,
    false, v_user, COALESCE(v_profile.nome,v_profile.email,'Usuário'),
    COALESCE(v_cotacao.descricao,'Cotação aprovada'),
    'Originada da Central de Cotações. Documento original preservado na cotação #'||v_cotacao.numero::text
  ) RETURNING id INTO v_pn_id;

  UPDATE public.cotacoes
  SET financeiro_necessidade_id=v_pn_id, status='convertida_pn', updated_at=now()
  WHERE id=p_cotacao_id;

  UPDATE public.cotacao_solicitacoes s
  SET status='encerrada', updated_at=now()
  WHERE s.id IN (
    SELECT v.solicitacao_id FROM public.cotacao_solicitacoes_vinculos v WHERE v.cotacao_id=p_cotacao_id
    UNION
    SELECT v_cotacao.solicitacao_id WHERE v_cotacao.solicitacao_id IS NOT NULL
  );

  RETURN v_pn_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cotacao_converter_em_pn_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotacao_converter_em_pn_v1(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
