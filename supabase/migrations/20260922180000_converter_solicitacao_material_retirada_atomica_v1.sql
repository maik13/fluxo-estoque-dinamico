BEGIN;

CREATE OR REPLACE FUNCTION public.converter_solicitacao_material_retirada_v1(p_solicitacao_material_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_solicitacao_material public.solicitacoes_material%ROWTYPE;
  v_retirada public.solicitacoes%ROWTYPE;
  v_item record;
  v_saldo numeric;
  v_estoque_principal boolean := false;
  v_tipo_operacao_id uuid;
  v_total_itens integer := 0;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT *
    INTO v_solicitacao_material
    FROM public.solicitacoes_material
   WHERE id = p_solicitacao_material_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de Material não encontrada.';
  END IF;

  IF v_solicitacao_material.solicitacao_retirada_id IS NOT NULL THEN
    SELECT *
      INTO v_retirada
      FROM public.solicitacoes
     WHERE id = v_solicitacao_material.solicitacao_retirada_id;

    RETURN jsonb_build_object(
      'solicitacaoRetiradaId', v_solicitacao_material.solicitacao_retirada_id,
      'numeroRetirada', v_retirada.numero,
      'itensProcessados', 0,
      'jaConvertida', true
    );
  END IF;

  IF v_solicitacao_material.status = 'rejeitada' THEN
    RAISE EXCEPTION 'Solicitação rejeitada não pode ser convertida em retirada.';
  END IF;

  IF v_solicitacao_material.estoque_id IS NULL THEN
    RAISE EXCEPTION 'A Solicitação de Material não possui estoque definido.';
  END IF;

  IF v_solicitacao_material.local_origem_id IS NULL
     OR btrim(coalesce(v_solicitacao_material.local_origem, '')) = '' THEN
    RAISE EXCEPTION 'Informe o local de origem antes de confirmar a retirada.';
  END IF;

  SELECT lower(nome) = 'almoxarifado principal'
    INTO v_estoque_principal
    FROM public.estoques
   WHERE id = v_solicitacao_material.estoque_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estoque da solicitação não encontrado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.solicitacao_material_itens
     WHERE solicitacao_material_id = p_solicitacao_material_id
       AND item_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Nenhum item cadastrado no estoque foi encontrado para retirada.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.solicitacao_material_itens
     WHERE solicitacao_material_id = p_solicitacao_material_id
       AND item_id IS NOT NULL
       AND quantidade <= 0
  ) THEN
    RAISE EXCEPTION 'Todos os itens da retirada devem possuir quantidade maior que zero.';
  END IF;

  -- Serializa retiradas concorrentes dos mesmos itens.
  PERFORM 1
    FROM public.items i
   WHERE i.id IN (
     SELECT smi.item_id
       FROM public.solicitacao_material_itens smi
      WHERE smi.solicitacao_material_id = p_solicitacao_material_id
        AND smi.item_id IS NOT NULL
   )
   ORDER BY i.id
   FOR UPDATE;

  -- Valida todo o conjunto antes de criar qualquer registro.
  FOR v_item IN
    SELECT
      smi.item_id,
      sum(smi.quantidade)::numeric AS quantidade,
      max(smi.nome_item) AS nome_item
    FROM public.solicitacao_material_itens smi
    WHERE smi.solicitacao_material_id = p_solicitacao_material_id
      AND smi.item_id IS NOT NULL
    GROUP BY smi.item_id
    ORDER BY smi.item_id
  LOOP
    SELECT m.quantidade_atual
      INTO v_saldo
      FROM public.movements m
     WHERE m.item_id = v_item.item_id
       AND (
         m.estoque_id = v_solicitacao_material.estoque_id
         OR (v_estoque_principal AND m.estoque_id IS NULL)
       )
     ORDER BY m.data_hora DESC, m.id DESC
     LIMIT 1;

    v_saldo := coalesce(v_saldo, 0);

    IF v_saldo < v_item.quantidade THEN
      RAISE EXCEPTION
        'Estoque insuficiente para "%". Saldo confirmado: %, quantidade solicitada: %.',
        v_item.nome_item,
        v_saldo,
        v_item.quantidade;
    END IF;
  END LOOP;

  SELECT id
    INTO v_tipo_operacao_id
    FROM public.tipos_operacao
   WHERE ativo = true
     AND tipo = 'saida'
     AND lower(nome) LIKE '%retirada%'
   ORDER BY nome
   LIMIT 1;

  INSERT INTO public.solicitacoes (
    solicitante_id,
    solicitante_nome,
    observacoes,
    tipo_operacao,
    criado_por_id,
    estoque_id,
    local_utilizacao_id,
    local_utilizacao,
    tipo_operacao_id
  )
  VALUES (
    v_solicitacao_material.solicitante_id,
    v_solicitacao_material.solicitante_nome,
    'Convertida da Solicitação de Material #' || v_solicitacao_material.numero ||
      CASE
        WHEN v_solicitacao_material.observacoes IS NOT NULL
          THEN ' - ' || v_solicitacao_material.observacoes
        ELSE ''
      END,
    'retirada',
    v_usuario_id,
    v_solicitacao_material.estoque_id,
    v_solicitacao_material.local_origem_id,
    v_solicitacao_material.local_origem,
    v_tipo_operacao_id
  )
  RETURNING * INTO v_retirada;

  INSERT INTO public.solicitacao_itens (
    solicitacao_id,
    item_id,
    quantidade_solicitada,
    quantidade_aprovada,
    item_snapshot
  )
  SELECT
    v_retirada.id,
    smi.item_id,
    smi.quantidade,
    smi.quantidade,
    coalesce(
      smi.item_snapshot,
      jsonb_build_object(
        'id', i.id,
        'codigoBarras', i.codigo_barras,
        'nome', i.nome,
        'unidade', i.unidade,
        'tipoItem', i.tipo_item
      )
    )
  FROM public.solicitacao_material_itens smi
  JOIN public.items i ON i.id = smi.item_id
  WHERE smi.solicitacao_material_id = p_solicitacao_material_id
    AND smi.item_id IS NOT NULL;

  FOR v_item IN
    SELECT
      smi.item_id,
      sum(smi.quantidade)::numeric AS quantidade,
      coalesce(
        max(smi.item_snapshot::text)::jsonb,
        jsonb_build_object(
          'id', i.id,
          'codigoBarras', i.codigo_barras,
          'nome', i.nome,
          'unidade', i.unidade,
          'tipoItem', i.tipo_item
        )
      ) AS item_snapshot
    FROM public.solicitacao_material_itens smi
    JOIN public.items i ON i.id = smi.item_id
    WHERE smi.solicitacao_material_id = p_solicitacao_material_id
      AND smi.item_id IS NOT NULL
    GROUP BY smi.item_id, i.id, i.codigo_barras, i.nome, i.unidade, i.tipo_item
    ORDER BY smi.item_id
  LOOP
    SELECT m.quantidade_atual
      INTO v_saldo
      FROM public.movements m
     WHERE m.item_id = v_item.item_id
       AND (
         m.estoque_id = v_solicitacao_material.estoque_id
         OR (v_estoque_principal AND m.estoque_id IS NULL)
       )
     ORDER BY m.data_hora DESC, m.id DESC
     LIMIT 1;

    v_saldo := coalesce(v_saldo, 0);

    INSERT INTO public.movements (
      item_id,
      tipo,
      quantidade,
      quantidade_anterior,
      quantidade_atual,
      user_id,
      observacoes,
      item_snapshot,
      solicitacao_id,
      estoque_id,
      local_utilizacao_id,
      tipo_operacao_id,
      dedupe_key
    )
    VALUES (
      v_item.item_id,
      'SAIDA',
      v_item.quantidade,
      v_saldo,
      v_saldo - v_item.quantidade,
      v_usuario_id,
      'Retirada - Solicitação Material #' || v_solicitacao_material.numero ||
        ' → Retirada #' || coalesce(v_retirada.numero::text, right(v_retirada.id::text, 8)),
      v_item.item_snapshot,
      v_retirada.id,
      v_solicitacao_material.estoque_id,
      v_solicitacao_material.local_origem_id,
      v_tipo_operacao_id,
      'solicitacao-material:' || p_solicitacao_material_id::text ||
        ':item:' || v_item.item_id::text || ':saida'
    );

    v_total_itens := v_total_itens + 1;
  END LOOP;

  UPDATE public.solicitacoes_material
     SET status = 'convertida',
         solicitacao_retirada_id = v_retirada.id,
         updated_at = now()
   WHERE id = p_solicitacao_material_id;

  RETURN jsonb_build_object(
    'solicitacaoRetiradaId', v_retirada.id,
    'numeroRetirada', v_retirada.numero,
    'itensProcessados', v_total_itens,
    'jaConvertida', false
  );
END;
$function$
;

REVOKE ALL ON FUNCTION public.converter_solicitacao_material_retirada_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.converter_solicitacao_material_retirada_v1(uuid) TO authenticated;

COMMENT ON FUNCTION public.converter_solicitacao_material_retirada_v1(uuid) IS
  'Converte uma Solicitação de Material em retirada de forma atômica, validando saldo e gravando anterior/atual apenas na retirada física.';

NOTIFY pgrst, 'reload schema';

COMMIT;
