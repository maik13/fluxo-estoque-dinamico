-- Protege o processo de aprovação: falta de saldo não significa necessidade
-- de aquisição de ferramenta. A compra de ferramentas continua sob gestão
-- manual do Almoxarifado. Insumos e itens avulsos preservam o fluxo de PN.
-- A reparação histórica da Solicitação #109 ocorreu em operação separada.
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

    IF (v_solicitacao.estoque_id IS NULL OR v_saldo < v_item.quantidade)
       AND NOT EXISTS (
         SELECT 1 FROM public.items i
         LEFT JOIN public.categorias c ON c.id = i.categoria_id
         WHERE i.id = v_item.item_id
         AND (lower(btrim(coalesce(i.tipo_item, ''))) = 'ferramenta'
              OR lower(btrim(coalesce(c.nome, ''))) = 'ferramenta')
       ) THEN
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

REVOKE ALL ON FUNCTION public.aprovar_solicitacao_material_v2(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_solicitacao_material_v2(UUID) TO authenticated;
COMMENT ON FUNCTION public.aprovar_solicitacao_material_v2(UUID) IS
  'Aprovação de material: falta de saldo de ferramenta não gera PN automática; insumos e avulsos mantêm a classificação anterior.';
NOTIFY pgrst, 'reload schema';
