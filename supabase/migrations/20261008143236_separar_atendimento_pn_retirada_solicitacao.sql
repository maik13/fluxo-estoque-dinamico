-- A decisão de atendimento precisa ficar gravada no item. Antes desta migration
-- ela era calculada apenas no navegador e se perdia entre a aprovação e a retirada.
ALTER TABLE public.solicitacao_material_itens
  ADD COLUMN IF NOT EXISTS destino_atendimento TEXT NOT NULL DEFAULT 'estoque';

ALTER TABLE public.solicitacao_material_itens
  DROP CONSTRAINT IF EXISTS solicitacao_material_itens_destino_atendimento_check;

ALTER TABLE public.solicitacao_material_itens
  ADD CONSTRAINT solicitacao_material_itens_destino_atendimento_check
  CHECK (destino_atendimento IN ('estoque', 'pn'));

-- Item avulso não pode gerar retirada física. A marcação também preserva o
-- comportamento correto para solicitações antigas que ainda estejam abertas.
UPDATE public.solicitacao_material_itens
SET destino_atendimento = 'pn'
WHERE item_id IS NULL;

CREATE INDEX IF NOT EXISTS solicitacao_material_itens_atendimento_idx
  ON public.solicitacao_material_itens (solicitacao_material_id, destino_atendimento);

-- Aprova a solicitação e classifica os itens no servidor, sob bloqueio dos
-- mesmos itens de estoque. Assim itens repetidos são avaliados pela soma e não
-- há divergência entre o saldo mostrado no cliente e o saldo real no momento
-- da aprovação.
CREATE OR REPLACE FUNCTION public.aprovar_solicitacao_material_v2(
  p_solicitacao_material_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_solicitacao public.solicitacoes_material%ROWTYPE;
  v_nome TEXT;
  v_item RECORD;
  v_saldo NUMERIC;
  v_estoque_principal BOOLEAN := false;
  v_itens_pn UUID[] := ARRAY[]::UUID[];
  v_pns_novas INTEGER := 0;
  v_pns_existentes INTEGER := 0;
  v_itens_estoque INTEGER := 0;
  v_itens_pn_qtd INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.permissao_individual_efetiva(auth.uid(), 'pode_solicitacao_material') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar Solicitação de Material.';
  END IF;

  SELECT *
    INTO v_solicitacao
    FROM public.solicitacoes_material
   WHERE id = p_solicitacao_material_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de Material não encontrada.';
  END IF;

  IF v_solicitacao.status = 'rejeitada' THEN
    RAISE EXCEPTION 'Solicitação rejeitada não pode ser aprovada.';
  END IF;

  IF v_solicitacao.status = 'convertida' THEN
    RAISE EXCEPTION 'Solicitação já convertida não pode ser aprovada novamente.';
  END IF;

  -- Impede que uma retirada concorrente altere o saldo durante a classificação.
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

  IF v_solicitacao.estoque_id IS NOT NULL THEN
    SELECT lower(e.nome) = 'almoxarifado principal'
      INTO v_estoque_principal
      FROM public.estoques e
     WHERE e.id = v_solicitacao.estoque_id;
  END IF;

  -- Primeiro assume PN para os avulsos. Para itens cadastrados, a decisão é
  -- tomada pela quantidade total solicitada de cada item.
  UPDATE public.solicitacao_material_itens
     SET destino_atendimento = CASE WHEN item_id IS NULL THEN 'pn' ELSE 'estoque' END
   WHERE solicitacao_material_id = p_solicitacao_material_id;

  FOR v_item IN
    SELECT smi.item_id, sum(smi.quantidade)::NUMERIC AS quantidade
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
         m.estoque_id = v_solicitacao.estoque_id
         OR (v_estoque_principal AND m.estoque_id IS NULL)
       )
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT 1;

    v_saldo := COALESCE(v_saldo, 0);

    IF v_solicitacao.estoque_id IS NULL OR v_saldo < v_item.quantidade THEN
      UPDATE public.solicitacao_material_itens
         SET destino_atendimento = 'pn'
       WHERE solicitacao_material_id = p_solicitacao_material_id
         AND item_id = v_item.item_id;
    END IF;
  END LOOP;

  SELECT array_agg(id ORDER BY created_at, id)
    INTO v_itens_pn
    FROM public.solicitacao_material_itens
   WHERE solicitacao_material_id = p_solicitacao_material_id
     AND destino_atendimento = 'pn';

  SELECT count(*) FILTER (WHERE destino_atendimento = 'estoque'),
         count(*) FILTER (WHERE destino_atendimento = 'pn')
    INTO v_itens_estoque, v_itens_pn_qtd
    FROM public.solicitacao_material_itens
   WHERE solicitacao_material_id = p_solicitacao_material_id;

  SELECT COALESCE(nome, email, 'Usuário')
    INTO v_nome
    FROM public.profiles
   WHERE user_id = auth.uid();

  UPDATE public.solicitacoes_material
     SET status = 'aprovada',
         aprovado_por_id = auth.uid(),
         aprovado_por_nome = COALESCE(v_nome, 'Usuário'),
         data_aprovacao = COALESCE(data_aprovacao, now()),
         updated_at = now()
   WHERE id = p_solicitacao_material_id;

  SELECT count(*) FILTER (WHERE NOT ja_existia),
         count(*) FILTER (WHERE ja_existia)
    INTO v_pns_novas, v_pns_existentes
    FROM public.financeiro_criar_pns_da_solicitacao(
      p_solicitacao_material_id,
      COALESCE(v_itens_pn, ARRAY[]::UUID[])
    );

  RETURN jsonb_build_object(
    'itensEstoque', COALESCE(v_itens_estoque, 0),
    'itensPn', COALESCE(v_itens_pn_qtd, 0),
    'pnsCriadas', COALESCE(v_pns_novas, 0),
    'pnsJaExistiam', COALESCE(v_pns_existentes, 0)
  );
END;
$$;

-- A retirada usa exclusivamente os itens que foram classificados para estoque.
-- Itens destinados a PN não voltam a bloquear a baixa dos itens disponíveis.
CREATE OR REPLACE FUNCTION public.converter_solicitacao_material_retirada_v1(
  p_solicitacao_material_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_usuario_id UUID := auth.uid();
  v_solicitacao_material public.solicitacoes_material%ROWTYPE;
  v_retirada public.solicitacoes%ROWTYPE;
  v_item RECORD;
  v_saldo NUMERIC;
  v_estoque_principal BOOLEAN := false;
  v_tipo_operacao_id UUID;
  v_total_itens INTEGER := 0;
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
      'jaConvertida', true,
      'somentePn', false
    );
  END IF;

  IF v_solicitacao_material.status <> 'aprovada' THEN
    RAISE EXCEPTION 'A Solicitação de Material precisa estar aprovada antes da retirada.';
  END IF;

  IF v_solicitacao_material.estoque_id IS NULL THEN
    RAISE EXCEPTION 'A Solicitação de Material não possui estoque definido.';
  END IF;

  IF v_solicitacao_material.local_origem_id IS NULL
     OR btrim(COALESCE(v_solicitacao_material.local_origem, '')) = '' THEN
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
       AND destino_atendimento = 'estoque'
  ) THEN
    RETURN jsonb_build_object(
      'solicitacaoRetiradaId', NULL,
      'numeroRetirada', NULL,
      'itensProcessados', 0,
      'jaConvertida', false,
      'somentePn', true
    );
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.solicitacao_material_itens
     WHERE solicitacao_material_id = p_solicitacao_material_id
       AND item_id IS NOT NULL
       AND destino_atendimento = 'estoque'
       AND quantidade <= 0
  ) THEN
    RAISE EXCEPTION 'Todos os itens da retirada devem possuir quantidade maior que zero.';
  END IF;

  PERFORM 1
    FROM public.items i
   WHERE i.id IN (
     SELECT smi.item_id
       FROM public.solicitacao_material_itens smi
      WHERE smi.solicitacao_material_id = p_solicitacao_material_id
        AND smi.item_id IS NOT NULL
        AND smi.destino_atendimento = 'estoque'
   )
   ORDER BY i.id
   FOR UPDATE;

  FOR v_item IN
    SELECT smi.item_id, sum(smi.quantidade)::NUMERIC AS quantidade, max(smi.nome_item) AS nome_item
      FROM public.solicitacao_material_itens smi
     WHERE smi.solicitacao_material_id = p_solicitacao_material_id
       AND smi.item_id IS NOT NULL
       AND smi.destino_atendimento = 'estoque'
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
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT 1;

    v_saldo := COALESCE(v_saldo, 0);

    IF v_saldo < v_item.quantidade THEN
      RAISE EXCEPTION
        'Estoque insuficiente para "%". Saldo confirmado: %, quantidade solicitada: %.',
        v_item.nome_item, v_saldo, v_item.quantidade;
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
    solicitante_id, solicitante_nome, observacoes, tipo_operacao, criado_por_id,
    estoque_id, local_utilizacao_id, local_utilizacao, tipo_operacao_id
  ) VALUES (
    v_solicitacao_material.solicitante_id,
    v_solicitacao_material.solicitante_nome,
    'Convertida da Solicitação de Material #' || v_solicitacao_material.numero ||
      CASE WHEN v_solicitacao_material.observacoes IS NOT NULL
        THEN ' - ' || v_solicitacao_material.observacoes ELSE '' END,
    'retirada', v_usuario_id, v_solicitacao_material.estoque_id,
    v_solicitacao_material.local_origem_id, v_solicitacao_material.local_origem,
    v_tipo_operacao_id
  ) RETURNING * INTO v_retirada;

  INSERT INTO public.solicitacao_itens (
    solicitacao_id, item_id, quantidade_solicitada, quantidade_aprovada, item_snapshot
  )
  SELECT
    v_retirada.id, smi.item_id, smi.quantidade, smi.quantidade,
    COALESCE(smi.item_snapshot, jsonb_build_object(
      'id', i.id, 'codigoBarras', i.codigo_barras, 'nome', i.nome,
      'unidade', i.unidade, 'tipoItem', i.tipo_item
    ))
  FROM public.solicitacao_material_itens smi
  JOIN public.items i ON i.id = smi.item_id
  WHERE smi.solicitacao_material_id = p_solicitacao_material_id
    AND smi.item_id IS NOT NULL
    AND smi.destino_atendimento = 'estoque';

  FOR v_item IN
    SELECT
      smi.item_id,
      sum(smi.quantidade)::NUMERIC AS quantidade,
      COALESCE(max(smi.item_snapshot::TEXT)::JSONB, jsonb_build_object(
        'id', i.id, 'codigoBarras', i.codigo_barras, 'nome', i.nome,
        'unidade', i.unidade, 'tipoItem', i.tipo_item
      )) AS item_snapshot
    FROM public.solicitacao_material_itens smi
    JOIN public.items i ON i.id = smi.item_id
    WHERE smi.solicitacao_material_id = p_solicitacao_material_id
      AND smi.item_id IS NOT NULL
      AND smi.destino_atendimento = 'estoque'
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
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT 1;

    v_saldo := COALESCE(v_saldo, 0);

    INSERT INTO public.movements (
      item_id, tipo, quantidade, quantidade_anterior, quantidade_atual,
      user_id, observacoes, item_snapshot, solicitacao_id, estoque_id,
      local_utilizacao_id, tipo_operacao_id, dedupe_key
    ) VALUES (
      v_item.item_id, 'SAIDA', v_item.quantidade, v_saldo, v_saldo - v_item.quantidade,
      v_usuario_id,
      'Retirada - Solicitação Material #' || v_solicitacao_material.numero ||
        ' → Retirada #' || COALESCE(v_retirada.numero::TEXT, right(v_retirada.id::TEXT, 8)),
      v_item.item_snapshot, v_retirada.id, v_solicitacao_material.estoque_id,
      v_solicitacao_material.local_origem_id, v_tipo_operacao_id,
      'solicitacao-material:' || p_solicitacao_material_id::TEXT ||
        ':item:' || v_item.item_id::TEXT || ':saida'
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
    'jaConvertida', false,
    'somentePn', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.aprovar_solicitacao_material_v2(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_solicitacao_material_v2(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.converter_solicitacao_material_retirada_v1(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.converter_solicitacao_material_retirada_v1(UUID) TO authenticated;

COMMENT ON FUNCTION public.aprovar_solicitacao_material_v2(UUID) IS
  'Aprova e classifica cada item da Solicitação de Material como estoque ou PN usando o saldo confirmado no servidor.';

COMMENT ON FUNCTION public.converter_solicitacao_material_retirada_v1(UUID) IS
  'Converte somente os itens classificados para estoque, sem bloquear a retirada por itens encaminhados a PN.';

NOTIFY pgrst, 'reload schema';
