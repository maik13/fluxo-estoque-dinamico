-- Retificação auditada das Etapas de Produção.
-- Preserva código, projeto, status, OPs, apontamentos e histórico operacional.

BEGIN;

CREATE OR REPLACE FUNCTION public.retificar_etapa_producao(
  p_processo_id UUID,
  p_nome TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_prioridade TEXT DEFAULT 'normal',
  p_produto_entregavel TEXT DEFAULT NULL,
  p_unidade_medida TEXT DEFAULT NULL,
  p_quantidade_planejada NUMERIC DEFAULT NULL,
  p_data_inicio_desejada DATE DEFAULT NULL,
  p_data_limite DATE DEFAULT NULL,
  p_grupo_cronograma TEXT DEFAULT NULL,
  p_sequencia INTEGER DEFAULT 0,
  p_capacidade_diaria NUMERIC DEFAULT NULL,
  p_pessoas_necessarias NUMERIC DEFAULT NULL,
  p_aceita_producao_proporcional BOOLEAN DEFAULT FALSE,
  p_dependencias JSONB DEFAULT '[]'::JSONB,
  p_justificativa TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome_usuario TEXT;
  v_etapa public.producao_processos%ROWTYPE;
  v_anterior JSONB;
  v_posterior JSONB;
  v_dependencias_anteriores JSONB;
  v_dependencias_posteriores JSONB;
  v_quantidade_ops NUMERIC;
  v_item JSONB;
  v_dependencia UUID;
  v_tipo TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para retificar Etapas de Produção';
  END IF;

  IF LENGTH(BTRIM(COALESCE(p_nome, ''))) < 2 THEN
    RAISE EXCEPTION 'Informe um nome válido para a Etapa';
  END IF;

  IF LENGTH(BTRIM(COALESCE(p_justificativa, ''))) < 5 THEN
    RAISE EXCEPTION 'Informe uma justificativa com pelo menos 5 caracteres';
  END IF;

  IF p_prioridade NOT IN ('baixa', 'normal', 'alta', 'urgente') THEN
    RAISE EXCEPTION 'Prioridade inválida';
  END IF;

  IF p_quantidade_planejada IS NOT NULL AND p_quantidade_planejada < 0 THEN
    RAISE EXCEPTION 'Quantidade planejada inválida';
  END IF;

  IF p_capacidade_diaria IS NOT NULL AND p_capacidade_diaria <= 0 THEN
    RAISE EXCEPTION 'Capacidade diária deve ser maior que zero';
  END IF;

  IF p_pessoas_necessarias IS NOT NULL AND p_pessoas_necessarias < 0 THEN
    RAISE EXCEPTION 'Quantidade de pessoas necessária inválida';
  END IF;

  IF COALESCE(p_sequencia, 0) < 0 THEN
    RAISE EXCEPTION 'Ordem no cronograma inválida';
  END IF;

  IF p_data_inicio_desejada IS NOT NULL
     AND p_data_limite IS NOT NULL
     AND p_data_limite < p_data_inicio_desejada THEN
    RAISE EXCEPTION 'A data limite não pode ser anterior à data inicial desejada';
  END IF;

  SELECT *
  INTO v_etapa
  FROM public.producao_processos
  WHERE id = p_processo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada';
  END IF;

  IF v_etapa.status IN ('finalizado', 'cancelado') THEN
    RAISE EXCEPTION 'Reabra a Etapa antes de retificá-la';
  END IF;

  SELECT COALESCE(SUM(o.quantidade_planejada), 0)
  INTO v_quantidade_ops
  FROM public.producao_ordens_producao o
  WHERE o.processo_id = p_processo_id
    AND o.status <> 'cancelada';

  IF v_quantidade_ops > 0
     AND (p_quantidade_planejada IS NULL OR p_quantidade_planejada < v_quantidade_ops) THEN
    RAISE EXCEPTION
      'A quantidade planejada não pode ser menor que o total já distribuído em OPs: %',
      v_quantidade_ops;
  END IF;

  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'etapa_id', d.depende_de_processo_id,
        'tipo', d.tipo
      ) ORDER BY d.created_at, d.depende_de_processo_id
    ),
    '[]'::JSONB
  )
  INTO v_dependencias_anteriores
  FROM public.producao_processo_dependencias d
  WHERE d.processo_id = p_processo_id;

  v_anterior := TO_JSONB(v_etapa) || JSONB_BUILD_OBJECT(
    'dependencias', v_dependencias_anteriores
  );

  -- Valida todas as dependências antes de substituir a configuração atual.
  FOR v_item IN
    SELECT value
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(p_dependencias, '[]'::JSONB))
  LOOP
    BEGIN
      v_dependencia := NULLIF(v_item->>'etapa_id', '')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Dependência inválida';
    END;

    v_tipo := COALESCE(NULLIF(v_item->>'tipo', ''), 'fim_inicio');

    IF v_dependencia IS NULL OR v_dependencia = p_processo_id THEN
      RAISE EXCEPTION 'Dependência inválida';
    END IF;

    IF v_tipo NOT IN ('fim_inicio', 'inicio_inicio') THEN
      RAISE EXCEPTION 'Tipo de dependência inválido';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.producao_processos p
      WHERE p.id = v_dependencia
        AND p.projeto_id = v_etapa.projeto_id
        AND p.status <> 'cancelado'
    ) THEN
      RAISE EXCEPTION 'A Etapa predecessora deve pertencer ao mesmo Projeto e estar ativa';
    END IF;

    IF EXISTS (
      WITH RECURSIVE predecessoras AS (
        SELECT d.depende_de_processo_id AS id
        FROM public.producao_processo_dependencias d
        WHERE d.processo_id = v_dependencia

        UNION

        SELECT d.depende_de_processo_id
        FROM public.producao_processo_dependencias d
        JOIN predecessoras p ON p.id = d.processo_id
      )
      SELECT 1 FROM predecessoras WHERE id = p_processo_id
    ) THEN
      RAISE EXCEPTION 'A dependência criaria um ciclo no cronograma';
    END IF;
  END LOOP;

  UPDATE public.producao_processos
  SET nome = BTRIM(p_nome),
      descricao = NULLIF(BTRIM(p_descricao), ''),
      prioridade = p_prioridade,
      produto_entregavel = NULLIF(BTRIM(p_produto_entregavel), ''),
      unidade_medida = NULLIF(BTRIM(p_unidade_medida), ''),
      quantidade_planejada = p_quantidade_planejada,
      data_inicio_desejada = p_data_inicio_desejada,
      data_limite = p_data_limite,
      grupo_cronograma = NULLIF(BTRIM(p_grupo_cronograma), ''),
      sequencia = GREATEST(COALESCE(p_sequencia, 0), 0),
      capacidade_diaria = p_capacidade_diaria,
      pessoas_necessarias = p_pessoas_necessarias,
      aceita_producao_proporcional = COALESCE(p_aceita_producao_proporcional, FALSE),
      atualizado_por_id = v_user,
      atualizado_por_nome_snapshot = COALESCE(
        (SELECT NULLIF(BTRIM(p.nome), '') FROM public.profiles p WHERE p.user_id = v_user LIMIT 1),
        (SELECT NULLIF(BTRIM(u.raw_user_meta_data->>'name'), '') FROM auth.users u WHERE u.id = v_user),
        (SELECT u.email FROM auth.users u WHERE u.id = v_user),
        'Usuário'
      ),
      updated_at = NOW()
  WHERE id = p_processo_id;

  DELETE FROM public.producao_processo_dependencias
  WHERE processo_id = p_processo_id;

  FOR v_item IN
    SELECT DISTINCT ON ((value->>'etapa_id')) value
    FROM JSONB_ARRAY_ELEMENTS(COALESCE(p_dependencias, '[]'::JSONB))
    ORDER BY (value->>'etapa_id')
  LOOP
    v_dependencia := (v_item->>'etapa_id')::UUID;
    v_tipo := COALESCE(NULLIF(v_item->>'tipo', ''), 'fim_inicio');

    INSERT INTO public.producao_processo_dependencias (
      processo_id,
      depende_de_processo_id,
      tipo
    ) VALUES (
      p_processo_id,
      v_dependencia,
      v_tipo
    );
  END LOOP;

  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'etapa_id', d.depende_de_processo_id,
        'tipo', d.tipo
      ) ORDER BY d.created_at, d.depende_de_processo_id
    ),
    '[]'::JSONB
  )
  INTO v_dependencias_posteriores
  FROM public.producao_processo_dependencias d
  WHERE d.processo_id = p_processo_id;

  SELECT COALESCE(
    NULLIF(BTRIM(p.nome), ''),
    NULLIF(BTRIM(u.raw_user_meta_data->>'name'), ''),
    u.email,
    'Usuário'
  )
  INTO v_nome_usuario
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = v_user
  LIMIT 1;

  SELECT TO_JSONB(p) || JSONB_BUILD_OBJECT(
    'dependencias', v_dependencias_posteriores
  )
  INTO v_posterior
  FROM public.producao_processos p
  WHERE p.id = p_processo_id;

  INSERT INTO public.producao_processo_eventos (
    processo_id,
    tipo_evento,
    status_anterior,
    novo_status,
    usuario_responsavel_id,
    nome_usuario_snapshot,
    justificativa,
    dados_complementares,
    valores_anteriores,
    valores_posteriores
  ) VALUES (
    p_processo_id,
    'etapa_retificada',
    v_etapa.status,
    v_etapa.status,
    v_user,
    COALESCE(v_nome_usuario, 'Usuário'),
    BTRIM(p_justificativa),
    JSONB_BUILD_OBJECT(
      'quantidade_distribuida_em_ops', v_quantidade_ops
    ),
    v_anterior,
    v_posterior
  );

  PERFORM public.recalcular_cronograma_producao_interno(
    v_user,
    COALESCE(v_nome_usuario, 'Usuário')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retificar_etapa_producao(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE, DATE, TEXT,
  INTEGER, NUMERIC, NUMERIC, BOOLEAN, JSONB, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.retificar_etapa_producao(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE, DATE, TEXT,
  INTEGER, NUMERIC, NUMERIC, BOOLEAN, JSONB, TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
