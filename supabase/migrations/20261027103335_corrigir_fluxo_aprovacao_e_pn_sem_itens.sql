BEGIN;

-- Ativa no banco publicado o fluxo de aprovação de orçamento que a interface
-- já apresenta. As operações sensíveis continuam protegidas por autenticação
-- e validação explícita de perfil/permissão dentro das RPCs.
ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS aprovacao_status text,
  ADD COLUMN IF NOT EXISTS aprovacao_solicitada_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovacao_solicitada_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovacao_justificativa text;

ALTER TABLE public.cotacoes DROP CONSTRAINT IF EXISTS cotacoes_aprovacao_status_check;
ALTER TABLE public.cotacoes ADD CONSTRAINT cotacoes_aprovacao_status_check
  CHECK (aprovacao_status IS NULL OR aprovacao_status IN ('pendente', 'aprovada', 'rejeitada'));

CREATE OR REPLACE FUNCTION public.cotacao_solicitar_aprovacao_v1(p_cotacao_id uuid)
RETURNS public.cotacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_result public.cotacoes%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.is_gestor_or_admin()
    OR public.permissao_individual_efetiva(v_user, 'pode_pedido_compra')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = v_user
        AND COALESCE(p.ativo, true)
        AND p.tipo_usuario = 'estoquista'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para enviar cotação para aprovação';
  END IF;

  UPDATE public.cotacoes c
  SET aprovacao_status = 'pendente',
      aprovacao_solicitada_por = v_user,
      aprovacao_solicitada_em = now(),
      aprovado_por = NULL,
      aprovado_em = NULL,
      aprovacao_justificativa = NULL,
      updated_at = now()
  WHERE c.id = p_cotacao_id
    AND c.status = 'escolhida'
    AND c.financeiro_necessidade_id IS NULL
  RETURNING c.* INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Somente a proposta escolhida e ainda não convertida pode ser enviada para aprovação';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cotacao_decidir_aprovacao_v1(
  p_cotacao_id uuid,
  p_aprovar boolean,
  p_justificativa text DEFAULT NULL
)
RETURNS public.cotacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_result public.cotacoes%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_gestor_or_admin() THEN
    RAISE EXCEPTION 'Somente gestor ou administrador pode aprovar ou rejeitar um orçamento';
  END IF;

  IF NOT p_aprovar AND NULLIF(btrim(COALESCE(p_justificativa, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição';
  END IF;

  UPDATE public.cotacoes c
  SET aprovacao_status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'rejeitada' END,
      aprovado_por = v_user,
      aprovado_em = now(),
      aprovacao_justificativa = NULLIF(btrim(COALESCE(p_justificativa, '')), ''),
      updated_at = now()
  WHERE c.id = p_cotacao_id
    AND c.aprovacao_status = 'pendente'
    AND c.status = 'escolhida'
    AND c.financeiro_necessidade_id IS NULL
  RETURNING c.* INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não está aguardando aprovação';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cotacao_bloquear_pn_sem_aprovacao_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (NEW.status = 'convertida_pn' OR NEW.financeiro_necessidade_id IS NOT NULL)
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.financeiro_necessidade_id IS DISTINCT FROM NEW.financeiro_necessidade_id
     )
     AND NEW.aprovacao_status IS DISTINCT FROM 'aprovada' THEN
    RAISE EXCEPTION 'Orçamento precisa ser aprovado pelo gestor antes de virar PN';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotacao_bloquear_pn_sem_aprovacao ON public.cotacoes;
CREATE TRIGGER trg_cotacao_bloquear_pn_sem_aprovacao
BEFORE UPDATE OF status, financeiro_necessidade_id ON public.cotacoes
FOR EACH ROW EXECUTE FUNCTION public.cotacao_bloquear_pn_sem_aprovacao_v1();

REVOKE ALL ON FUNCTION public.cotacao_solicitar_aprovacao_v1(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cotacao_decidir_aprovacao_v1(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cotacao_solicitar_aprovacao_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cotacao_decidir_aprovacao_v1(uuid, boolean, text) TO authenticated;

-- Toda PN originada de cotação passa a receber linhas estruturadas. Primeiro
-- são usados os itens da proposta, depois os itens das solicitações vinculadas.
-- Se o documento só tiver cabeçalho/PDF/valor, uma linha consolidada rastreável
-- é criada com os dados efetivamente existentes, sem inventar material.
CREATE OR REPLACE FUNCTION public.cotacao_preencher_itens_pn_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordem integer := 0;
  v_item record;
  v_descricao_fallback text;
BEGIN
  IF NEW.financeiro_necessidade_id IS NULL
     OR NEW.financeiro_necessidade_id IS NOT DISTINCT FROM OLD.financeiro_necessidade_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_necessidade_itens
    WHERE necessidade_id = NEW.financeiro_necessidade_id
  ) THEN
    RETURN NEW;
  END IF;

  FOR v_item IN
    SELECT ci.item_id, ci.descricao, ci.especificacao, ci.quantidade, ci.unidade,
           ci.valor_unitario, ci.valor_total, ci.codigo_item, ci.marca
    FROM public.cotacao_itens ci
    WHERE ci.cotacao_id = NEW.id
    ORDER BY ci.ordem, ci.id
  LOOP
    v_ordem := v_ordem + 1;
    INSERT INTO public.financeiro_necessidade_itens (
      necessidade_id, item_id, origem, descricao, especificacao, quantidade, unidade,
      valor_unitario_estimado, valor_total_estimado, item_snapshot, ordem
    ) VALUES (
      NEW.financeiro_necessidade_id,
      v_item.item_id,
      CASE WHEN v_item.item_id IS NULL THEN 'avulso' ELSE 'estoque' END,
      COALESCE(NULLIF(btrim(v_item.descricao), ''), 'Item de cotação'),
      v_item.especificacao,
      CASE WHEN COALESCE(v_item.quantidade, 0) > 0 THEN v_item.quantidade ELSE 1 END,
      COALESCE(NULLIF(v_item.unidade, ''), 'UN'),
      v_item.valor_unitario,
      v_item.valor_total,
      jsonb_strip_nulls(jsonb_build_object(
        'cotacao_id', NEW.id,
        'codigo_item', v_item.codigo_item,
        'marca', v_item.marca
      )),
      v_ordem
    );
  END LOOP;

  IF v_ordem = 0 THEN
    FOR v_item IN
      SELECT s.item_id, s.descricao, s.quantidade, s.unidade,
             s.codigo_item, s.observacoes, s.solicitacao_id
      FROM public.cotacao_solicitacao_itens s
      WHERE s.solicitacao_id IN (
        SELECT NEW.solicitacao_id WHERE NEW.solicitacao_id IS NOT NULL
        UNION
        SELECT v.solicitacao_id
        FROM public.cotacao_solicitacoes_vinculos v
        WHERE v.cotacao_id = NEW.id
      )
      ORDER BY s.solicitacao_id, s.ordem, s.id
    LOOP
      v_ordem := v_ordem + 1;
      INSERT INTO public.financeiro_necessidade_itens (
        necessidade_id, item_id, origem, descricao, quantidade, unidade,
        item_snapshot, ordem
      ) VALUES (
        NEW.financeiro_necessidade_id,
        v_item.item_id,
        CASE WHEN v_item.item_id IS NULL THEN 'avulso' ELSE 'estoque' END,
        COALESCE(NULLIF(btrim(v_item.descricao), ''), 'Item solicitado'),
        CASE WHEN COALESCE(v_item.quantidade, 0) > 0 THEN v_item.quantidade ELSE 1 END,
        COALESCE(NULLIF(v_item.unidade, ''), 'UN'),
        jsonb_strip_nulls(jsonb_build_object(
          'cotacao_id', NEW.id,
          'solicitacao_id', v_item.solicitacao_id,
          'codigo_item', v_item.codigo_item,
          'observacoes', v_item.observacoes
        )),
        v_ordem
      );
    END LOOP;
  END IF;

  IF v_ordem = 0 THEN
    SELECT string_agg(DISTINCT NULLIF(btrim(s.titulo), ''), '; ' ORDER BY NULLIF(btrim(s.titulo), ''))
      INTO v_descricao_fallback
    FROM public.cotacao_solicitacoes_vinculos v
    JOIN public.cotacao_solicitacoes s ON s.id = v.solicitacao_id
    WHERE v.cotacao_id = NEW.id;

    INSERT INTO public.financeiro_necessidade_itens (
      necessidade_id, item_id, origem, descricao, especificacao, quantidade, unidade,
      valor_unitario_estimado, valor_total_estimado, item_snapshot, ordem
    ) VALUES (
      NEW.financeiro_necessidade_id,
      NULL,
      'avulso',
      COALESCE(
        v_descricao_fallback,
        NULLIF(btrim(NEW.descricao), ''),
        'Cotação #' || NEW.numero::text || COALESCE(' · ' || NULLIF(btrim(NEW.fornecedor_nome), ''), '')
      ),
      'Linha consolidada do orçamento. Consulte o PDF e a cotação de origem para o detalhamento.',
      1,
      'UN',
      NEW.valor_total,
      NEW.valor_total,
      jsonb_strip_nulls(jsonb_build_object(
        'cotacao_id', NEW.id,
        'cotacao_numero', NEW.numero,
        'fornecedor', NEW.fornecedor_nome,
        'arquivo_nome', NEW.arquivo_nome,
        'arquivo_path', NEW.arquivo_path,
        'linha_consolidada', true
      )),
      1
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cotacao_preencher_itens_pn_v1() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_cotacao_preencher_itens_pn_v1 ON public.cotacoes;
CREATE TRIGGER trg_cotacao_preencher_itens_pn_v1
AFTER UPDATE OF financeiro_necessidade_id ON public.cotacoes
FOR EACH ROW EXECUTE FUNCTION public.cotacao_preencher_itens_pn_v1();

-- Recupera primeiro as linhas formais já presentes nas RCs ligadas a PNs antigas.
INSERT INTO public.financeiro_necessidade_itens (
  necessidade_id, item_id, origem, descricao, especificacao, quantidade, unidade,
  valor_unitario_estimado, valor_total_estimado, item_snapshot, ordem
)
SELECT
  pn.id,
  linha.item_id,
  CASE WHEN linha.item_id IS NULL THEN 'avulso' ELSE 'estoque' END,
  COALESCE(NULLIF(btrim(linha.nome_item), ''), NULLIF(btrim(pn.descricao), ''), 'Item da RC'),
  NULLIF(btrim(linha.item_snapshot ->> 'especificacao'), ''),
  CASE WHEN COALESCE(linha.quantidade, 0) > 0 THEN linha.quantidade ELSE 1 END,
  COALESCE(NULLIF(linha.item_snapshot ->> 'unidade', ''), NULLIF(pn.unidade, ''), 'UN'),
  NULL,
  NULL,
  COALESCE(linha.item_snapshot, '{}'::jsonb)
    || jsonb_build_object('reconstruido_da_rc', true, 'pedido_compra_item_id', linha.id),
  row_number() OVER (PARTITION BY pn.id ORDER BY linha.created_at, linha.id)::integer
FROM public.financeiro_necessidades pn
JOIN public.pedido_compra_itens linha ON linha.pedido_id = pn.requisicao_compra_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.financeiro_necessidade_itens existente WHERE existente.necessidade_id = pn.id
);

-- Recupera PNs antigas que ainda apontam para um item formal de Solicitação.
INSERT INTO public.financeiro_necessidade_itens (
  necessidade_id, item_id, origem, descricao, especificacao, quantidade, unidade,
  valor_unitario_estimado, valor_total_estimado, item_snapshot, ordem
)
SELECT
  pn.id,
  linha.item_id,
  CASE WHEN linha.item_id IS NULL THEN 'avulso' ELSE 'estoque' END,
  COALESCE(NULLIF(btrim(linha.nome_item), ''), NULLIF(btrim(pn.descricao), ''), 'Item solicitado'),
  COALESCE(NULLIF(btrim(linha.especificacao), ''), NULLIF(btrim(pn.especificacao), '')),
  CASE WHEN COALESCE(linha.quantidade, 0) > 0 THEN linha.quantidade ELSE 1 END,
  COALESCE(NULLIF(linha.unidade, ''), NULLIF(pn.unidade, ''), 'UN'),
  CASE
    WHEN pn.valor_estimado IS NOT NULL AND COALESCE(linha.quantidade, 0) > 0
      THEN round(pn.valor_estimado / linha.quantidade, 2)
    ELSE pn.valor_estimado
  END,
  pn.valor_estimado,
  COALESCE(linha.item_snapshot, '{}'::jsonb)
    || jsonb_build_object('reconstruido_da_solicitacao', true, 'solicitacao_material_item_id', linha.id),
  1
FROM public.financeiro_necessidades pn
JOIN public.solicitacao_material_itens linha ON linha.id = pn.solicitacao_material_item_id
WHERE pn.status <> 'cancelado'
  AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_necessidade_itens existente WHERE existente.necessidade_id = pn.id
  );

-- Para os registros importados ou documentos sem itens estruturados, preserva
-- exatamente a descrição, a quantidade e o valor disponíveis no cabeçalho.
-- A marcação no snapshot deixa explícita a origem da reconstrução.
WITH cotacao_origem AS (
  SELECT DISTINCT ON (c.financeiro_necessidade_id)
    c.financeiro_necessidade_id,
    c.id AS cotacao_id,
    c.numero AS cotacao_numero,
    c.descricao AS cotacao_descricao,
    c.fornecedor_nome,
    c.valor_total,
    c.arquivo_nome,
    c.arquivo_path,
    (
      SELECT string_agg(DISTINCT NULLIF(btrim(s.titulo), ''), '; ' ORDER BY NULLIF(btrim(s.titulo), ''))
      FROM public.cotacao_solicitacoes_vinculos v
      JOIN public.cotacao_solicitacoes s ON s.id = v.solicitacao_id
      WHERE v.cotacao_id = c.id
    ) AS titulos_solicitacoes
  FROM public.cotacoes c
  WHERE c.financeiro_necessidade_id IS NOT NULL
  ORDER BY c.financeiro_necessidade_id, c.created_at DESC, c.id
)
INSERT INTO public.financeiro_necessidade_itens (
  necessidade_id, item_id, origem, descricao, especificacao, quantidade, unidade,
  valor_unitario_estimado, valor_total_estimado, item_snapshot, ordem
)
SELECT
  pn.id,
  pn.item_id,
  CASE WHEN pn.item_id IS NULL THEN 'avulso' ELSE 'estoque' END,
  COALESCE(
    origem.titulos_solicitacoes,
    NULLIF(btrim(origem.cotacao_descricao), ''),
    NULLIF(btrim(pn.descricao), ''),
    'PN-' || lpad(pn.numero::text, 4, '0')
  ),
  COALESCE(
    NULLIF(btrim(pn.especificacao), ''),
    CASE WHEN origem.cotacao_id IS NOT NULL
      THEN 'Linha consolidada do orçamento. Consulte o PDF e a cotação de origem para o detalhamento.'
      ELSE NULL
    END
  ),
  CASE WHEN COALESCE(pn.quantidade, 0) > 0 THEN pn.quantidade ELSE 1 END,
  COALESCE(NULLIF(pn.unidade, ''), 'UN'),
  CASE
    WHEN COALESCE(pn.valor_estimado, origem.valor_total) IS NULL THEN NULL
    WHEN COALESCE(pn.quantidade, 0) > 0
      THEN round(COALESCE(pn.valor_estimado, origem.valor_total) / pn.quantidade, 2)
    ELSE COALESCE(pn.valor_estimado, origem.valor_total)
  END,
  COALESCE(pn.valor_estimado, origem.valor_total),
  jsonb_strip_nulls(jsonb_build_object(
    'reconstruido_em', now(),
    'reconstruido_por_migracao', 'corrigir_fluxo_aprovacao_e_pn_sem_itens',
    'origem_modulo', pn.origem_modulo,
    'cotacao_id', origem.cotacao_id,
    'cotacao_numero', origem.cotacao_numero,
    'fornecedor', origem.fornecedor_nome,
    'arquivo_nome', origem.arquivo_nome,
    'arquivo_path', origem.arquivo_path,
    'linha_consolidada', origem.cotacao_id IS NOT NULL
  )),
  1
FROM public.financeiro_necessidades pn
LEFT JOIN cotacao_origem origem ON origem.financeiro_necessidade_id = pn.id
WHERE pn.status <> 'cancelado'
  AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_necessidade_itens existente WHERE existente.necessidade_id = pn.id
  );

COMMIT;
