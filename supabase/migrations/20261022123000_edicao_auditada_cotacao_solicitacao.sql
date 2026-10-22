BEGIN;

ALTER TABLE public.cotacao_solicitacoes
  ADD COLUMN IF NOT EXISTS editada_em timestamptz,
  ADD COLUMN IF NOT EXISTS editada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS editada_por_nome text;

CREATE TABLE IF NOT EXISTS public.cotacao_solicitacao_edicoes_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.cotacao_solicitacoes(id) ON DELETE RESTRICT,
  dados_anteriores jsonb NOT NULL,
  dados_novos jsonb NOT NULL,
  editado_por uuid NOT NULL,
  editado_por_nome text NOT NULL,
  editado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cotacao_solicitacao_edicoes_auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cotacao_solicitacao_edicoes_select ON public.cotacao_solicitacao_edicoes_auditoria;
CREATE POLICY cotacao_solicitacao_edicoes_select
ON public.cotacao_solicitacao_edicoes_auditoria FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cotacao_solicitacoes s
    WHERE s.id = solicitacao_id AND (
      s.criado_por = (select auth.uid())
      OR public.is_admin()
      OR public.permissao_individual_efetiva((select auth.uid()), 'pode_pedido_compra')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = (select auth.uid()) AND p.ativo = true AND p.tipo_usuario = 'estoquista'
      )
    )
  )
);
REVOKE ALL ON TABLE public.cotacao_solicitacao_edicoes_auditoria FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.cotacao_solicitacao_edicoes_auditoria TO authenticated;

CREATE OR REPLACE FUNCTION public.editar_cotacao_solicitacao_v1(
  p_solicitacao_id uuid,
  p_titulo text,
  p_projeto_centro_custo text,
  p_data_necessaria date,
  p_observacoes text,
  p_itens jsonb
)
RETURNS public.cotacao_solicitacoes
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_nome text;
  v_solicitacao public.cotacao_solicitacoes%ROWTYPE;
  v_item jsonb;
  v_item_id uuid;
  v_antes jsonb;
  v_depois jsonb;
  v_almoxarife boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF nullif(btrim(p_titulo), '') IS NULL THEN RAISE EXCEPTION 'Informe o título da solicitação'; END IF;
  IF p_data_necessaria IS NULL THEN RAISE EXCEPTION 'Informe a data de necessidade'; END IF;
  IF jsonb_typeof(coalesce(p_itens, 'null'::jsonb)) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'A solicitação precisa ter ao menos um item';
  END IF;

  SELECT * INTO v_solicitacao FROM public.cotacao_solicitacoes
  WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;

  v_almoxarife := public.is_admin()
    OR public.permissao_individual_efetiva(v_user, 'pode_pedido_compra')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = v_user AND p.ativo = true AND p.tipo_usuario = 'estoquista'
    );
  IF v_solicitacao.criado_por <> v_user AND NOT v_almoxarife THEN
    RAISE EXCEPTION 'Sem permissão para editar esta solicitação';
  END IF;
  IF v_solicitacao.status IN ('encerrada', 'cancelada') THEN
    RAISE EXCEPTION 'Solicitações encerradas ou canceladas não podem ser editadas';
  END IF;
  IF v_solicitacao.criado_por = v_user AND NOT v_almoxarife AND v_solicitacao.status <> 'solicitada' THEN
    RAISE EXCEPTION 'Após o início do atendimento, somente o Almoxarifado pode editar a solicitação';
  END IF;
  IF jsonb_array_length(p_itens) <> (
    SELECT count(*) FROM public.cotacao_solicitacao_itens i WHERE i.solicitacao_id = p_solicitacao_id
  ) THEN RAISE EXCEPTION 'A lista de itens não corresponde à solicitação'; END IF;

  SELECT jsonb_build_object(
    'solicitacao', to_jsonb(v_solicitacao),
    'itens', coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.ordem, i.id), '[]'::jsonb)
  ) INTO v_antes
  FROM public.cotacao_solicitacao_itens i WHERE i.solicitacao_id = p_solicitacao_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens)
  LOOP
    v_item_id := (v_item->>'id')::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM public.cotacao_solicitacao_itens i
      WHERE i.id = v_item_id AND i.solicitacao_id = p_solicitacao_id
    ) THEN RAISE EXCEPTION 'Item inválido ou pertencente a outra solicitação'; END IF;
    IF nullif(btrim(v_item->>'descricao'), '') IS NULL THEN RAISE EXCEPTION 'Informe o material de todos os itens'; END IF;
    IF coalesce((v_item->>'quantidade')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'A quantidade deve ser maior que zero'; END IF;
    IF nullif(btrim(v_item->>'unidade'), '') IS NULL THEN RAISE EXCEPTION 'Informe a unidade de todos os itens'; END IF;

    UPDATE public.cotacao_solicitacao_itens
    SET descricao = btrim(v_item->>'descricao'),
        quantidade = (v_item->>'quantidade')::numeric,
        unidade = btrim(v_item->>'unidade'),
        observacoes = nullif(btrim(v_item->>'observacoes'), '')
    WHERE id = v_item_id;
  END LOOP;

  SELECT coalesce(nome, email, 'Usuário') INTO v_nome
  FROM public.profiles WHERE user_id = v_user LIMIT 1;
  v_nome := coalesce(v_nome, 'Usuário');

  UPDATE public.cotacao_solicitacoes
  SET titulo = btrim(p_titulo),
      projeto_centro_custo = nullif(btrim(p_projeto_centro_custo), ''),
      data_necessaria = p_data_necessaria,
      data_limite = p_data_necessaria,
      observacoes = nullif(btrim(p_observacoes), ''),
      editada_em = now(),
      editada_por = v_user,
      editada_por_nome = v_nome,
      updated_at = now()
  WHERE id = p_solicitacao_id
  RETURNING * INTO v_solicitacao;

  SELECT jsonb_build_object(
    'solicitacao', to_jsonb(v_solicitacao),
    'itens', coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.ordem, i.id), '[]'::jsonb)
  ) INTO v_depois
  FROM public.cotacao_solicitacao_itens i WHERE i.solicitacao_id = p_solicitacao_id;

  INSERT INTO public.cotacao_solicitacao_edicoes_auditoria (
    solicitacao_id, dados_anteriores, dados_novos, editado_por, editado_por_nome
  ) VALUES (p_solicitacao_id, v_antes, v_depois, v_user, v_nome);

  RETURN v_solicitacao;
END;
$$;

REVOKE ALL ON FUNCTION public.editar_cotacao_solicitacao_v1(uuid,text,text,date,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_cotacao_solicitacao_v1(uuid,text,text,date,text,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
