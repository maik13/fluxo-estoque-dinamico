-- HOTFIX: corrige o recálculo do cronograma bloqueado pelo Supabase.
-- A lógica permanece igual; somente os DELETE globais passam a ter WHERE explícito.

CREATE OR REPLACE FUNCTION public.recalcular_cronograma_producao_interno(
  p_usuario_id UUID,
  p_usuario_nome TEXT
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_config public.producao_cronograma_configuracoes%ROWTYPE;
  v_versao UUID := gen_random_uuid();
  v_data DATE;
  v_inicio DATE;
  v_indice INTEGER;
  v_disponivel NUMERIC;
  v_etapa RECORD;
  v_dependencias_ok BOOLEAN;
  v_pessoas NUMERIC;
  v_quantidade NUMERIC;
  v_saldo NUMERIC;
  v_razao NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('producao_cronograma_oficial', 0));

  SELECT * INTO v_config
  FROM public.producao_cronograma_configuracoes
  WHERE id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração do cronograma não encontrada';
  END IF;

  DELETE FROM public.producao_alocacoes_diarias WHERE TRUE;
  DELETE FROM public.producao_cronograma_alertas WHERE TRUE;

  CREATE TEMP TABLE IF NOT EXISTS tmp_producao_etapas_cronograma (
    processo_id UUID PRIMARY KEY,
    prioridade_ordem INTEGER NOT NULL,
    sequencia INTEGER NOT NULL,
    inicio_desejado DATE NOT NULL,
    data_limite DATE NULL,
    saldo_total NUMERIC NOT NULL,
    capacidade_diaria NUMERIC NOT NULL,
    pessoas_necessarias NUMERIC NOT NULL,
    aceita_proporcional BOOLEAN NOT NULL,
    quantidade_simulada NUMERIC NOT NULL DEFAULT 0,
    iniciou BOOLEAN NOT NULL DEFAULT false,
    inicio_calculado DATE NULL,
    fim_calculado DATE NULL,
    inicio_anterior DATE NULL,
    fim_anterior DATE NULL
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.tmp_producao_etapas_cronograma;

  INSERT INTO public.producao_cronograma_alertas (
    processo_id, severidade, codigo, mensagem, versao_calculo
  )
  SELECT p.id, 'alta', 'PARAMETROS_INCOMPLETOS',
    'A etapa precisa de quantidade planejada, capacidade diária e pessoas necessárias para entrar no plano automático.',
    v_versao
  FROM public.producao_processos p
  WHERE p.status IN ('planejado', 'em_andamento', 'pausado', 'bloqueado')
    AND (
      COALESCE(p.quantidade_planejada, 0) <= 0
      OR COALESCE(p.capacidade_diaria, 0) <= 0
      OR COALESCE(p.pessoas_necessarias, 0) < 0
    );

  INSERT INTO pg_temp.tmp_producao_etapas_cronograma (
    processo_id, prioridade_ordem, sequencia, inicio_desejado, data_limite,
    saldo_total, capacidade_diaria, pessoas_necessarias, aceita_proporcional,
    inicio_anterior, fim_anterior
  )
  SELECT
    p.id,
    CASE p.prioridade WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
    COALESCE(p.sequencia, 0),
    COALESCE(p.data_inicio_desejada, p.data_inicio_prevista, CURRENT_DATE),
    p.data_limite,
    GREATEST(COALESCE(p.quantidade_planejada, 0) - COALESCE(r.realizado, 0), 0),
    p.capacidade_diaria,
    COALESCE(p.pessoas_necessarias, 0),
    COALESCE(p.aceita_producao_proporcional, false),
    p.data_inicio_prevista,
    p.data_fim_prevista
  FROM public.producao_processos p
  LEFT JOIN (
    SELECT processo_id, COALESCE(SUM(quantidade_produzida), 0) AS realizado
    FROM public.producao_apontamentos
    WHERE status = 'conferido' AND processo_id IS NOT NULL
    GROUP BY processo_id
  ) r ON r.processo_id = p.id
  WHERE p.status IN ('planejado', 'em_andamento', 'pausado', 'bloqueado')
    AND COALESCE(p.quantidade_planejada, 0) > 0
    AND COALESCE(p.capacidade_diaria, 0) > 0
    AND COALESCE(p.pessoas_necessarias, 0) >= 0;

  SELECT COALESCE(MIN(inicio_desejado), CURRENT_DATE) INTO v_inicio
  FROM pg_temp.tmp_producao_etapas_cronograma;

  FOR v_indice IN 0..(v_config.horizonte_dias - 1) LOOP
    v_data := v_inicio + v_indice;

    IF (EXTRACT(ISODOW FROM v_data) = 6 AND NOT v_config.trabalha_sabado)
       OR (EXTRACT(ISODOW FROM v_data) = 7 AND NOT v_config.trabalha_domingo) THEN
      CONTINUE;
    END IF;

    v_disponivel := v_config.equipe_disponivel_por_dia;

    FOR v_etapa IN
      SELECT *
      FROM pg_temp.tmp_producao_etapas_cronograma
      WHERE quantidade_simulada < saldo_total
        AND inicio_desejado <= v_data
      ORDER BY prioridade_ordem, sequencia, processo_id
    LOOP
      SELECT COALESCE(bool_and(
        CASE d.tipo
          WHEN 'fim_inicio' THEN pai.quantidade_simulada >= pai.saldo_total
          WHEN 'inicio_inicio' THEN pai.iniciou
          ELSE false
        END
      ), true)
      INTO v_dependencias_ok
      FROM public.producao_processo_dependencias d
      JOIN pg_temp.tmp_producao_etapas_cronograma pai
        ON pai.processo_id = d.depende_de_processo_id
      WHERE d.processo_id = v_etapa.processo_id;

      IF NOT v_dependencias_ok THEN CONTINUE; END IF;

      v_pessoas := v_etapa.pessoas_necessarias;
      v_quantidade := v_etapa.capacidade_diaria;

      IF v_pessoas > v_disponivel THEN
        IF v_etapa.aceita_proporcional AND v_disponivel > 0 AND v_pessoas > 0 THEN
          v_razao := v_disponivel / v_pessoas;
          v_quantidade := v_quantidade * v_razao;
          v_pessoas := v_disponivel;
        ELSE
          INSERT INTO public.producao_cronograma_alertas (
            processo_id, data, severidade, codigo, mensagem, versao_calculo
          ) VALUES (
            v_etapa.processo_id, v_data, 'media', 'EQUIPE_INSUFICIENTE',
            'Equipe disponível insuficiente para alocar a etapa neste dia.', v_versao
          );
          CONTINUE;
        END IF;
      END IF;

      v_saldo := v_etapa.saldo_total - v_etapa.quantidade_simulada;
      v_quantidade := LEAST(v_saldo, v_quantidade);
      IF v_quantidade <= 0 THEN CONTINUE; END IF;

      INSERT INTO public.producao_alocacoes_diarias (
        processo_id, data, quantidade_planejada, pessoas_planejadas, versao_calculo
      ) VALUES (
        v_etapa.processo_id, v_data, ROUND(v_quantidade, 2), ROUND(v_pessoas, 2), v_versao
      );

      UPDATE pg_temp.tmp_producao_etapas_cronograma
      SET quantidade_simulada = quantidade_simulada + v_quantidade,
          iniciou = true,
          inicio_calculado = COALESCE(inicio_calculado, v_data),
          fim_calculado = v_data
      WHERE processo_id = v_etapa.processo_id;

      v_disponivel := GREATEST(0, v_disponivel - v_pessoas);
      IF v_disponivel <= 0 THEN EXIT; END IF;
    END LOOP;
  END LOOP;

  UPDATE public.producao_processos p
  SET data_inicio_prevista = t.inicio_calculado,
      data_fim_prevista = t.fim_calculado,
      atualizado_por_id = p_usuario_id,
      atualizado_por_nome_snapshot = p_usuario_nome,
      updated_at = now()
  FROM pg_temp.tmp_producao_etapas_cronograma t
  WHERE p.id = t.processo_id;

  INSERT INTO public.producao_cronograma_alertas (
    processo_id, severidade, codigo, mensagem, versao_calculo
  )
  SELECT processo_id, 'alta', 'NAO_ALOCADA',
    'Não foi possível alocar toda a quantidade da etapa dentro do horizonte configurado.',
    v_versao
  FROM pg_temp.tmp_producao_etapas_cronograma
  WHERE quantidade_simulada < saldo_total;

  INSERT INTO public.producao_cronograma_alertas (
    processo_id, data, severidade, codigo, mensagem, versao_calculo
  )
  SELECT processo_id, data_limite, 'alta', 'PRAZO_ULTRAPASSADO',
    'A previsão calculada ultrapassa o prazo final informado.', v_versao
  FROM pg_temp.tmp_producao_etapas_cronograma
  WHERE data_limite IS NOT NULL AND fim_calculado IS NOT NULL AND fim_calculado > data_limite;

  INSERT INTO public.producao_processo_eventos (
    processo_id, tipo_evento, status_anterior, novo_status,
    usuario_responsavel_id, nome_usuario_snapshot, dados_complementares,
    valores_anteriores, valores_posteriores
  )
  SELECT
    p.id, 'cronograma_recalculado', p.status, p.status,
    p_usuario_id, p_usuario_nome,
    jsonb_build_object('versao_calculo', v_versao),
    jsonb_build_object('data_inicio_prevista', t.inicio_anterior, 'data_fim_prevista', t.fim_anterior),
    jsonb_build_object('data_inicio_prevista', t.inicio_calculado, 'data_fim_prevista', t.fim_calculado)
  FROM public.producao_processos p
  JOIN pg_temp.tmp_producao_etapas_cronograma t ON t.processo_id = p.id
  WHERE t.inicio_anterior IS DISTINCT FROM t.inicio_calculado
     OR t.fim_anterior IS DISTINCT FROM t.fim_calculado;

  RETURN v_versao;
END;
$$;

REVOKE ALL ON FUNCTION public.recalcular_cronograma_producao_interno(UUID, TEXT) FROM PUBLIC;
NOTIFY pgrst, 'reload schema';

SELECT
  POSITION(
    'DELETE FROM public.producao_alocacoes_diarias WHERE TRUE'
    IN pg_get_functiondef(
      'public.recalcular_cronograma_producao_interno(uuid,text)'::regprocedure
    )
  ) > 0 AS alocacoes_corrigidas,
  POSITION(
    'DELETE FROM public.producao_cronograma_alertas WHERE TRUE'
    IN pg_get_functiondef(
      'public.recalcular_cronograma_producao_interno(uuid,text)'::regprocedure
    )
  ) > 0 AS alertas_corrigidos;
