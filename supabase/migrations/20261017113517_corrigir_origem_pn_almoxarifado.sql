BEGIN;

-- Mantém a classificação compatível com a restrição existente e identifica a
-- origem pelo módulo Almoxarifado.
CREATE OR REPLACE FUNCTION public.criar_previsao_necessidade_almoxarifado(
  p_descricao text,
  p_especificacao text DEFAULT NULL,
  p_quantidade numeric DEFAULT NULL,
  p_unidade text DEFAULT NULL,
  p_valor_estimado numeric DEFAULT NULL,
  p_data_necessidade date DEFAULT NULL,
  p_projeto_centro_custo text DEFAULT NULL,
  p_urgencia text DEFAULT 'normal',
  p_justificativa text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tipo text;
  v_nome text;
  v_id uuid;
  v_descricao text := nullif(trim(p_descricao), '');
  v_valor numeric(14,2) := CASE WHEN p_valor_estimado IS NULL THEN NULL ELSE round(p_valor_estimado, 2) END;
  v_quantidade numeric := CASE WHEN p_quantidade IS NULL THEN NULL ELSE round(p_quantidade, 4) END;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT tipo_usuario, COALESCE(nome, email, 'Usuário')
    INTO v_tipo, v_nome
  FROM public.profiles
  WHERE user_id = auth.uid()
    AND COALESCE(ativo, true) = true;

  IF NOT FOUND OR v_tipo NOT IN ('administrador', 'estoquista') THEN
    RAISE EXCEPTION 'Somente o perfil Almoxarifado pode criar Previsão de Necessidade por esta área.';
  END IF;

  IF v_descricao IS NULL THEN
    RAISE EXCEPTION 'Descrição da necessidade é obrigatória.';
  END IF;
  IF v_valor IS NOT NULL AND v_valor < 0 THEN
    RAISE EXCEPTION 'O valor estimado não pode ser negativo.';
  END IF;
  IF v_quantidade IS NOT NULL AND v_quantidade <= 0 THEN
    RAISE EXCEPTION 'A quantidade deve ser maior que zero.';
  END IF;

  INSERT INTO public.financeiro_necessidades(
    status, origem_tipo, origem_modulo, descricao, especificacao,
    solicitante_id, solicitante_nome, area_solicitante,
    quantidade, unidade, valor_estimado, estimativa_incompleta,
    base_estimativa, data_necessidade, data_prevista_desembolso,
    urgencia, projeto_centro_custo, justificativa,
    criado_automaticamente, criado_por_id, criado_por_nome
  ) VALUES (
    'previsto', 'manual', 'almoxarifado', v_descricao, nullif(trim(p_especificacao), ''),
    auth.uid(), v_nome, 'Almoxarifado',
    v_quantidade, nullif(trim(p_unidade), ''), v_valor, v_valor IS NULL,
    CASE WHEN v_valor IS NULL THEN 'Estimativa pendente — PN criada pelo Almoxarifado.' ELSE 'Valor estimado informado pelo Almoxarifado.' END,
    p_data_necessidade, p_data_necessidade,
    CASE WHEN p_urgencia IN ('baixa', 'normal', 'alta', 'urgente') THEN p_urgencia ELSE 'normal' END,
    nullif(trim(p_projeto_centro_custo), ''), nullif(trim(p_justificativa), ''),
    false, auth.uid(), v_nome
  ) RETURNING id INTO v_id;

  INSERT INTO public.financeiro_lancamentos(
    necessidade_id, tipo, status, descricao, projeto_centro_custo,
    data_prevista, valor_previsto, origem_tipo, origem_id, criado_por_id
  ) VALUES (
    v_id, 'saida', 'previsto', v_descricao, nullif(trim(p_projeto_centro_custo), ''),
    p_data_necessidade, v_valor, 'manual', v_id, auth.uid()
  );

  RETURN v_id;
END;
$$;

COMMIT;
