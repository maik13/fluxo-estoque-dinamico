-- Permite ao autor complementar uma solicitação somente enquanto ela ainda
-- estiver pendente (antes de o Almoxarifado aprovar/iniciar a separação).
CREATE OR REPLACE FUNCTION public.adicionar_itens_solicitacao_material(
  p_solicitacao_id UUID,
  p_itens JSONB
)
RETURNS SETOF public.solicitacao_material_itens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitacao public.solicitacoes_material%ROWTYPE;
  v_item JSONB;
  v_item_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT *
    INTO v_solicitacao
    FROM public.solicitacoes_material
   WHERE id = p_solicitacao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_solicitacao.solicitante_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o autor pode adicionar itens à solicitação';
  END IF;

  IF v_solicitacao.status <> 'pendente' THEN
    RAISE EXCEPTION 'Não é possível adicionar itens: a separação já foi iniciada';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos um item';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens)
  LOOP
    IF COALESCE(btrim(v_item->>'nome_item'), '') = ''
       OR COALESCE((v_item->>'quantidade')::NUMERIC, 0) <= 0
       OR COALESCE(btrim(v_item->>'unidade'), '') = '' THEN
      RAISE EXCEPTION 'Há um item com dados inválidos';
    END IF;

    v_item_id := NULLIF(v_item->>'item_id', '')::UUID;

    IF v_item_id IS NOT NULL AND EXISTS (
      SELECT 1
        FROM public.solicitacao_material_itens existente
       WHERE existente.solicitacao_material_id = p_solicitacao_id
         AND existente.item_id = v_item_id
    ) THEN
      RAISE EXCEPTION 'O item "%" já faz parte desta solicitação', v_item->>'nome_item';
    END IF;

    RETURN QUERY
    INSERT INTO public.solicitacao_material_itens (
      solicitacao_material_id,
      item_id,
      nome_item,
      quantidade,
      unidade,
      item_snapshot,
      observacoes
    ) VALUES (
      p_solicitacao_id,
      v_item_id,
      btrim(v_item->>'nome_item'),
      (v_item->>'quantidade')::NUMERIC,
      btrim(v_item->>'unidade'),
      v_item->'item_snapshot',
      NULLIF(btrim(v_item->>'observacoes'), '')
    )
    RETURNING *;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.adicionar_itens_solicitacao_material(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adicionar_itens_solicitacao_material(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.adicionar_itens_solicitacao_material(UUID, JSONB) IS
  'Adiciona itens de forma atômica somente pelo autor e enquanto a solicitação estiver pendente.';
