-- PCP de materiais da Produção integrado ao fluxo existente do Almoxarifado.
-- Regra funcional:
-- 1. A Etapa planeja materiais, sem solicitação, reserva ou baixa de estoque.
-- 2. A OP recebe um snapshot proporcional do planejamento da Etapa.
-- 3. Somente uma confirmação explícita na OP gera Solicitação de Material.
-- 4. A solicitação entra como pendente e possui prazo operacional máximo de 1 dia para separação.

BEGIN;

ALTER TABLE public.solicitacoes_material
  ADD COLUMN IF NOT EXISTS origem_modulo TEXT NULL,
  ADD COLUMN IF NOT EXISTS producao_projeto_id UUID NULL
    REFERENCES public.producao_projetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processo_id UUID NULL
    REFERENCES public.producao_processos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ordem_producao_id UUID NULL
    REFERENCES public.producao_ordens_producao(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_necessidade DATE NULL,
  ADD COLUMN IF NOT EXISTS data_limite_separacao TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS solicitacoes_material_origem_producao_idx
  ON public.solicitacoes_material(origem_modulo, ordem_producao_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS solicitacoes_material_op_ativa_unique
  ON public.solicitacoes_material(ordem_producao_id)
  WHERE ordem_producao_id IS NOT NULL
    AND status <> 'rejeitada';

CREATE TABLE IF NOT EXISTS public.producao_etapa_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL
    REFERENCES public.producao_processos(id) ON DELETE CASCADE,
  item_id UUID NOT NULL
    REFERENCES public.items(id) ON DELETE RESTRICT,
  quantidade_planejada NUMERIC(14,4) NOT NULL
    CHECK (quantidade_planejada > 0),
  unidade_snapshot TEXT NOT NULL,
  item_snapshot JSONB NOT NULL,
  observacoes TEXT NULL,
  criado_por_id UUID NULL,
  criado_por_nome_snapshot TEXT NULL,
  atualizado_por_id UUID NULL,
  atualizado_por_nome_snapshot TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT producao_etapa_materiais_item_unique UNIQUE (processo_id, item_id)
);

CREATE INDEX IF NOT EXISTS producao_etapa_materiais_processo_idx
  ON public.producao_etapa_materiais(processo_id, created_at);

CREATE TABLE IF NOT EXISTS public.producao_ordem_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id UUID NOT NULL
    REFERENCES public.producao_ordens_producao(id) ON DELETE CASCADE,
  processo_material_id UUID NULL
    REFERENCES public.producao_etapa_materiais(id) ON DELETE SET NULL,
  item_id UUID NOT NULL
    REFERENCES public.items(id) ON DELETE RESTRICT,
  quantidade_planejada NUMERIC(14,4) NOT NULL
    CHECK (quantidade_planejada > 0),
  quantidade_solicitada NUMERIC(14,4) NOT NULL DEFAULT 0
    CHECK (quantidade_solicitada >= 0),
  unidade_snapshot TEXT NOT NULL,
  item_snapshot JSONB NOT NULL,
  observacoes TEXT NULL,
  solicitacao_material_id UUID NULL
    REFERENCES public.solicitacoes_material(id) ON DELETE SET NULL,
  solicitacao_material_item_id UUID NULL
    REFERENCES public.solicitacao_material_itens(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT producao_ordem_materiais_item_unique UNIQUE (ordem_producao_id, item_id)
);

CREATE INDEX IF NOT EXISTS producao_ordem_materiais_ordem_idx
  ON public.producao_ordem_materiais(ordem_producao_id, created_at);
CREATE INDEX IF NOT EXISTS producao_ordem_materiais_solicitacao_idx
  ON public.producao_ordem_materiais(solicitacao_material_id);

ALTER TABLE public.producao_etapa_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_ordem_materiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS producao_etapa_materiais_leitura
  ON public.producao_etapa_materiais;
CREATE POLICY producao_etapa_materiais_leitura
  ON public.producao_etapa_materiais
  FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('visualizar'));

DROP POLICY IF EXISTS producao_ordem_materiais_leitura
  ON public.producao_ordem_materiais;
CREATE POLICY producao_ordem_materiais_leitura
  ON public.producao_ordem_materiais
  FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('visualizar'));

GRANT SELECT ON public.producao_etapa_materiais TO authenticated;
GRANT SELECT ON public.producao_ordem_materiais TO authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_updated_at_pcp_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_producao_etapa_materiais_updated_at
  ON public.producao_etapa_materiais;
CREATE TRIGGER trg_producao_etapa_materiais_updated_at
BEFORE UPDATE ON public.producao_etapa_materiais
FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at_pcp_producao();

DROP TRIGGER IF EXISTS trg_producao_ordem_materiais_updated_at
  ON public.producao_ordem_materiais;
CREATE TRIGGER trg_producao_ordem_materiais_updated_at
BEFORE UPDATE ON public.producao_ordem_materiais
FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at_pcp_producao();

CREATE OR REPLACE FUNCTION public.sincronizar_materiais_ordem_producao(
  p_ordem_producao_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_op public.producao_ordens_producao%ROWTYPE;
  v_quantidade_etapa NUMERIC;
BEGIN
  SELECT *
    INTO v_op
    FROM public.producao_ordens_producao
   WHERE id = p_ordem_producao_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- O snapshot deixa de ser reescrito quando a OP começa ou já possui solicitação.
  IF v_op.status NOT IN ('rascunho', 'liberada')
     OR EXISTS (
       SELECT 1
         FROM public.producao_ordem_materiais om
        WHERE om.ordem_producao_id = v_op.id
          AND om.solicitacao_material_id IS NOT NULL
     ) THEN
    RETURN;
  END IF;

  SELECT p.quantidade_planejada
    INTO v_quantidade_etapa
    FROM public.producao_processos p
   WHERE p.id = v_op.processo_id;

  DELETE FROM public.producao_ordem_materiais
   WHERE ordem_producao_id = v_op.id
     AND solicitacao_material_id IS NULL;

  INSERT INTO public.producao_ordem_materiais (
    ordem_producao_id,
    processo_material_id,
    item_id,
    quantidade_planejada,
    unidade_snapshot,
    item_snapshot,
    observacoes
  )
  SELECT
    v_op.id,
    em.id,
    em.item_id,
    CASE
      WHEN COALESCE(v_quantidade_etapa, 0) > 0 THEN
        GREATEST(
          ROUND(
            em.quantidade_planejada * v_op.quantidade_planejada / v_quantidade_etapa,
            4
          ),
          0.0001
        )
      ELSE em.quantidade_planejada
    END,
    em.unidade_snapshot,
    em.item_snapshot,
    em.observacoes
  FROM public.producao_etapa_materiais em
  WHERE em.processo_id = v_op.processo_id
  ORDER BY em.created_at, em.id;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_materiais_ordem_producao(UUID)
  FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.trg_copiar_materiais_para_ordem_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.sincronizar_materiais_ordem_producao(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copiar_materiais_para_ordem_producao
  ON public.producao_ordens_producao;
CREATE TRIGGER trg_copiar_materiais_para_ordem_producao
AFTER INSERT ON public.producao_ordens_producao
FOR EACH ROW EXECUTE FUNCTION public.trg_copiar_materiais_para_ordem_producao();

CREATE OR REPLACE FUNCTION public.salvar_materiais_etapa_producao(
  p_processo_id UUID,
  p_materiais JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome_usuario TEXT;
  v_status TEXT;
  v_total INTEGER;
  v_total_distintos INTEGER;
  v_total_validos INTEGER;
  v_anteriores JSONB;
  v_posteriores JSONB;
  v_op RECORD;
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para salvar o PCP de materiais';
  END IF;

  SELECT status
    INTO v_status
    FROM public.producao_processos
   WHERE id = p_processo_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada';
  END IF;

  IF v_status IN ('finalizado', 'cancelado') THEN
    RAISE EXCEPTION 'Reabra a Etapa antes de alterar o PCP de materiais';
  END IF;

  IF p_materiais IS NULL OR JSONB_TYPEOF(p_materiais) <> 'array' THEN
    RAISE EXCEPTION 'A relação de materiais é inválida';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT item->>'item_id')
    INTO v_total, v_total_distintos
    FROM JSONB_ARRAY_ELEMENTS(p_materiais) AS item;

  IF v_total <> v_total_distintos THEN
    RAISE EXCEPTION 'O mesmo item não pode aparecer duas vezes no PCP da Etapa';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM JSONB_ARRAY_ELEMENTS(p_materiais) AS item
     WHERE COALESCE(NULLIF(item->>'quantidade', '')::NUMERIC, 0) <= 0
  ) THEN
    RAISE EXCEPTION 'Todos os materiais devem possuir quantidade maior que zero';
  END IF;

  SELECT COUNT(*)
    INTO v_total_validos
    FROM JSONB_ARRAY_ELEMENTS(p_materiais) AS item
    JOIN public.items i
      ON i.id = (item->>'item_id')::UUID
     AND COALESCE(i.ativo, TRUE) = TRUE;

  IF v_total_validos <> v_total THEN
    RAISE EXCEPTION 'Existe item inexistente ou inativo no PCP da Etapa';
  END IF;

  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'item_id', em.item_id,
        'quantidade', em.quantidade_planejada,
        'unidade', em.unidade_snapshot,
        'observacoes', em.observacoes
      ) ORDER BY em.created_at, em.id
    ),
    '[]'::JSONB
  )
  INTO v_anteriores
  FROM public.producao_etapa_materiais em
  WHERE em.processo_id = p_processo_id;

  v_nome_usuario := public.nome_usuario_producao(v_user);

  DELETE FROM public.producao_etapa_materiais
   WHERE processo_id = p_processo_id;

  INSERT INTO public.producao_etapa_materiais (
    processo_id,
    item_id,
    quantidade_planejada,
    unidade_snapshot,
    item_snapshot,
    observacoes,
    criado_por_id,
    criado_por_nome_snapshot,
    atualizado_por_id,
    atualizado_por_nome_snapshot
  )
  SELECT
    p_processo_id,
    i.id,
    (item->>'quantidade')::NUMERIC,
    i.unidade,
    JSONB_BUILD_OBJECT(
      'id', i.id,
      'nome', i.nome,
      'codigoBarras', i.codigo_barras,
      'marca', i.marca,
      'unidade', i.unidade,
      'especificacao', i.especificacao,
      'fotoUrl', i.foto_url,
      'tipoItem', i.tipo_item
    ),
    NULLIF(BTRIM(item->>'observacoes'), ''),
    v_user,
    v_nome_usuario,
    v_user,
    v_nome_usuario
  FROM JSONB_ARRAY_ELEMENTS(p_materiais) AS item
  JOIN public.items i ON i.id = (item->>'item_id')::UUID
  ORDER BY i.nome, i.codigo_barras;

  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'item_id', em.item_id,
        'quantidade', em.quantidade_planejada,
        'unidade', em.unidade_snapshot,
        'observacoes', em.observacoes
      ) ORDER BY em.created_at, em.id
    ),
    '[]'::JSONB
  )
  INTO v_posteriores
  FROM public.producao_etapa_materiais em
  WHERE em.processo_id = p_processo_id;

  INSERT INTO public.producao_processo_eventos (
    processo_id,
    tipo_evento,
    usuario_responsavel_id,
    nome_usuario_snapshot,
    justificativa,
    valores_anteriores,
    valores_posteriores
  ) VALUES (
    p_processo_id,
    'pcp_materiais_atualizado',
    v_user,
    v_nome_usuario,
    'Planejamento de materiais salvo. Sem solicitação, reserva ou baixa de estoque.',
    v_anteriores,
    v_posteriores
  );

  -- Atualiza somente OPs ainda liberadas e sem solicitação.
  FOR v_op IN
    SELECT id
      FROM public.producao_ordens_producao
     WHERE processo_id = p_processo_id
       AND status IN ('rascunho', 'liberada')
     ORDER BY numero
  LOOP
    PERFORM public.sincronizar_materiais_ordem_producao(v_op.id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_materiais_etapa_producao(UUID, JSONB)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_materiais_etapa_producao(UUID, JSONB)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.gerar_solicitacao_material_op(
  p_ordem_producao_id UUID,
  p_estoque_id UUID
)
RETURNS TABLE (
  solicitacao_id UUID,
  numero BIGINT,
  status TEXT,
  created_at TIMESTAMPTZ,
  data_limite_separacao TIMESTAMPTZ,
  ja_existia BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome_usuario TEXT;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_etapa public.producao_processos%ROWTYPE;
  v_projeto public.producao_projetos%ROWTYPE;
  v_local_nome TEXT;
  v_solicitacao_id UUID;
  v_numero BIGINT;
  v_created_at TIMESTAMPTZ;
  v_limite TIMESTAMPTZ;
  v_material RECORD;
  v_item_solicitacao_id UUID;
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para gerar Solicitação de Material pela OP';
  END IF;

  IF p_estoque_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.estoques e WHERE e.id = p_estoque_id) THEN
    RAISE EXCEPTION 'Selecione um estoque válido antes de gerar a solicitação';
  END IF;

  SELECT *
    INTO v_op
    FROM public.producao_ordens_producao
   WHERE id = p_ordem_producao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_op.status NOT IN ('liberada', 'em_execucao') THEN
    RAISE EXCEPTION 'A solicitação só pode ser gerada para uma OP liberada ou em execução';
  END IF;

  SELECT sm.id, sm.numero, sm.created_at, sm.data_limite_separacao
    INTO v_solicitacao_id, v_numero, v_created_at, v_limite
    FROM public.solicitacoes_material sm
   WHERE sm.ordem_producao_id = v_op.id
     AND sm.status <> 'rejeitada'
   ORDER BY sm.created_at DESC
   LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_solicitacao_id,
      v_numero,
      (SELECT sm.status FROM public.solicitacoes_material sm WHERE sm.id = v_solicitacao_id),
      v_created_at,
      v_limite,
      TRUE;
    RETURN;
  END IF;

  -- Garante o snapshot quando a OP ainda está liberada.
  PERFORM public.sincronizar_materiais_ordem_producao(v_op.id);

  IF NOT EXISTS (
    SELECT 1
      FROM public.producao_ordem_materiais om
     WHERE om.ordem_producao_id = v_op.id
  ) THEN
    RAISE EXCEPTION 'A OP não possui materiais planejados. Salve o PCP na Etapa antes de solicitar';
  END IF;

  SELECT * INTO v_etapa
    FROM public.producao_processos
   WHERE id = v_op.processo_id;

  SELECT * INTO v_projeto
    FROM public.producao_projetos
   WHERE id = v_op.projeto_id;

  SELECT l.nome
    INTO v_local_nome
    FROM public.locais_utilizacao l
   WHERE l.id = v_projeto.local_utilizacao_id;

  v_nome_usuario := public.nome_usuario_producao(v_user);
  v_limite := NOW() + INTERVAL '1 day';

  INSERT INTO public.solicitacoes_material (
    solicitante_id,
    solicitante_nome,
    observacoes,
    status,
    estoque_id,
    local_origem,
    local_origem_id,
    origem_modulo,
    producao_projeto_id,
    processo_id,
    ordem_producao_id,
    data_necessidade,
    data_limite_separacao
  ) VALUES (
    v_user,
    v_nome_usuario,
    CONCAT(
      'ORIGEM: PRODUÇÃO / PCP. Projeto: ', COALESCE(v_projeto.nome, 'não identificado'),
      ' | Etapa: ', COALESCE(v_etapa.codigo, ''), ' - ', COALESCE(v_etapa.nome, ''),
      ' | OP: OP ', LPAD(v_op.numero::TEXT, 6, '0'),
      ' | Prazo máximo de separação: 1 dia após a solicitação. ',
      'Esta solicitação não realizou baixa nem reserva automática no estoque.'
    ),
    'pendente',
    p_estoque_id,
    COALESCE(v_local_nome, v_projeto.nome, 'Produção'),
    v_projeto.local_utilizacao_id,
    'producao',
    v_projeto.id,
    v_etapa.id,
    v_op.id,
    v_op.data_inicio_prevista,
    v_limite
  )
  RETURNING id, solicitacoes_material.numero, solicitacoes_material.created_at
    INTO v_solicitacao_id, v_numero, v_created_at;

  FOR v_material IN
    SELECT *
      FROM public.producao_ordem_materiais
     WHERE ordem_producao_id = v_op.id
     ORDER BY created_at, id
  LOOP
    INSERT INTO public.solicitacao_material_itens (
      solicitacao_material_id,
      item_id,
      nome_item,
      quantidade,
      unidade,
      item_snapshot,
      observacoes
    ) VALUES (
      v_solicitacao_id,
      v_material.item_id,
      COALESCE(v_material.item_snapshot->>'nome', 'Item não identificado'),
      v_material.quantidade_planejada,
      v_material.unidade_snapshot,
      v_material.item_snapshot,
      v_material.observacoes
    )
    RETURNING id INTO v_item_solicitacao_id;

    UPDATE public.producao_ordem_materiais
       SET quantidade_solicitada = v_material.quantidade_planejada,
           solicitacao_material_id = v_solicitacao_id,
           solicitacao_material_item_id = v_item_solicitacao_id,
           updated_at = NOW()
     WHERE id = v_material.id;
  END LOOP;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id,
    evento,
    status_anterior,
    novo_status,
    usuario_id,
    nome_usuario_snapshot,
    justificativa,
    dados
  ) VALUES (
    v_op.id,
    'solicitacao_material_gerada',
    v_op.status,
    v_op.status,
    v_user,
    v_nome_usuario,
    'Solicitação oficial enviada ao Almoxarifado. Prazo máximo informado: 1 dia.',
    JSONB_BUILD_OBJECT(
      'solicitacao_material_id', v_solicitacao_id,
      'numero', v_numero,
      'data_limite_separacao', v_limite,
      'gera_baixa_estoque', FALSE,
      'gera_reserva_estoque', FALSE
    )
  );

  RETURN QUERY SELECT
    v_solicitacao_id,
    v_numero,
    'pendente'::TEXT,
    v_created_at,
    v_limite,
    FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_solicitacao_material_op(UUID, UUID)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_solicitacao_material_op(UUID, UUID)
  TO authenticated;

COMMENT ON TABLE public.producao_etapa_materiais IS
  'PCP de materiais da Etapa. Não gera solicitação, reserva ou baixa de estoque.';
COMMENT ON TABLE public.producao_ordem_materiais IS
  'Snapshot dos materiais planejados para a OP, proporcional à quantidade liberada.';
COMMENT ON COLUMN public.solicitacoes_material.data_limite_separacao IS
  'Prazo operacional máximo informado ao usuário. Não executa baixa automática.';

NOTIFY pgrst, 'reload schema';

COMMIT;
