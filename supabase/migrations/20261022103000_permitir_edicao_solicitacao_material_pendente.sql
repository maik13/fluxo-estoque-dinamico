BEGIN;

ALTER TABLE public.solicitacao_material_itens
  ADD COLUMN IF NOT EXISTS especificacao text;

CREATE TABLE IF NOT EXISTS public.solicitacao_material_edicoes_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_material_id uuid NOT NULL REFERENCES public.solicitacoes_material(id) ON DELETE RESTRICT,
  dados_anteriores jsonb NOT NULL,
  dados_novos jsonb NOT NULL,
  editado_por uuid NOT NULL DEFAULT auth.uid(),
  editado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.solicitacao_material_edicoes_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS solicitacao_material_edicoes_auditoria_select
  ON public.solicitacao_material_edicoes_auditoria;
CREATE POLICY solicitacao_material_edicoes_auditoria_select
  ON public.solicitacao_material_edicoes_auditoria
  FOR SELECT TO authenticated
  USING (
    public.can_manage_inventory()
    OR EXISTS (
      SELECT 1
      FROM public.solicitacoes_material s
      WHERE s.id = solicitacao_material_id
        AND s.solicitante_id = (select auth.uid())
    )
  );

REVOKE ALL ON TABLE public.solicitacao_material_edicoes_auditoria FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.solicitacao_material_edicoes_auditoria TO authenticated;

CREATE OR REPLACE FUNCTION public.editar_solicitacao_material_pendente_v1(
  p_solicitacao_material_id uuid,
  p_observacoes text,
  p_data_necessidade date,
  p_itens jsonb
)
RETURNS public.solicitacoes_material
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_solicitacao public.solicitacoes_material%ROWTYPE;
  v_item jsonb;
  v_item_id uuid;
  v_anteriores jsonb;
  v_novos jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF jsonb_typeof(coalesce(p_itens, 'null'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Lista de itens inválida';
  END IF;
  IF p_data_necessidade IS NULL THEN RAISE EXCEPTION 'Informe a data de necessidade'; END IF;
  IF jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'A solicitação precisa ter pelo menos um item'; END IF;

  SELECT * INTO v_solicitacao
  FROM public.solicitacoes_material
  WHERE id = p_solicitacao_material_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_solicitacao.status <> 'pendente' THEN
    RAISE EXCEPTION 'Somente solicitações pendentes podem ser editadas';
  END IF;
  IF v_solicitacao.solicitante_id <> v_user AND NOT public.can_manage_inventory() THEN
    RAISE EXCEPTION 'Você não tem permissão para editar esta solicitação';
  END IF;

  IF jsonb_array_length(p_itens) <> (
    SELECT count(*) FROM public.solicitacao_material_itens i
    WHERE i.solicitacao_material_id = p_solicitacao_material_id
  ) THEN
    RAISE EXCEPTION 'A lista enviada não corresponde aos itens atuais da solicitação';
  END IF;

  SELECT jsonb_build_object(
    'solicitacao', to_jsonb(v_solicitacao),
    'itens', coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.created_at, i.id), '[]'::jsonb)
  ) INTO v_anteriores
  FROM public.solicitacao_material_itens i
  WHERE i.solicitacao_material_id = p_solicitacao_material_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens)
  LOOP
    v_item_id := (v_item->>'id')::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM public.solicitacao_material_itens i
      WHERE i.id = v_item_id AND i.solicitacao_material_id = p_solicitacao_material_id
    ) THEN
      RAISE EXCEPTION 'Item inválido ou pertencente a outra solicitação';
    END IF;
    IF nullif(btrim(v_item->>'nome_item'), '') IS NULL THEN RAISE EXCEPTION 'Informe o nome de todos os materiais'; END IF;
    IF coalesce((v_item->>'quantidade')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'A quantidade deve ser maior que zero'; END IF;
    IF nullif(btrim(v_item->>'unidade'), '') IS NULL THEN RAISE EXCEPTION 'Informe a unidade de todos os materiais'; END IF;

    UPDATE public.solicitacao_material_itens
    SET nome_item = btrim(v_item->>'nome_item'),
        especificacao = nullif(btrim(v_item->>'especificacao'), ''),
        quantidade = (v_item->>'quantidade')::numeric,
        unidade = btrim(v_item->>'unidade'),
        observacoes = nullif(btrim(v_item->>'observacoes'), ''),
        item_snapshot = CASE
          WHEN item_snapshot IS NULL THEN null
          ELSE jsonb_set(
            jsonb_set(item_snapshot, '{nome}', to_jsonb(btrim(v_item->>'nome_item')), true),
            '{especificacao}', to_jsonb(coalesce(nullif(btrim(v_item->>'especificacao'), ''), '')), true
          )
        END
    WHERE id = v_item_id;
  END LOOP;

  UPDATE public.solicitacoes_material
  SET observacoes = nullif(btrim(p_observacoes), ''),
      data_necessidade = p_data_necessidade,
      updated_at = now()
  WHERE id = p_solicitacao_material_id
  RETURNING * INTO v_solicitacao;

  SELECT jsonb_build_object(
    'solicitacao', to_jsonb(v_solicitacao),
    'itens', coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.created_at, i.id), '[]'::jsonb)
  ) INTO v_novos
  FROM public.solicitacao_material_itens i
  WHERE i.solicitacao_material_id = p_solicitacao_material_id;

  INSERT INTO public.solicitacao_material_edicoes_auditoria (
    solicitacao_material_id, dados_anteriores, dados_novos, editado_por
  ) VALUES (p_solicitacao_material_id, v_anteriores, v_novos, v_user);

  RETURN v_solicitacao;
END;
$$;

REVOKE ALL ON FUNCTION public.editar_solicitacao_material_pendente_v1(uuid, text, date, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_solicitacao_material_pendente_v1(uuid, text, date, jsonb)
  TO authenticated;

COMMIT;
