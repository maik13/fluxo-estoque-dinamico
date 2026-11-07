CREATE OR REPLACE FUNCTION public.financeiro_normalizar_nome_duplicidade(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT regexp_replace(
    lower(
      translate(
        coalesce(p_texto, ''),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
        'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'
      )
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.financeiro_bloquear_duplicidade_pagina54()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nome text;
  v_valor numeric(14,2);
  v_data_prevista date;
  v_data_realizada date;
  v_lancamento_existente uuid;
  v_motivo jsonb;
BEGIN
  IF NEW.origem_tipo IS DISTINCT FROM 'pagina54'
     OR NEW.importacao_pagina54_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Uma linha já vinculada pelo mesmo ID é uma atualização legítima,
  -- não uma nova tentativa de lançamento.
  IF NEW.pagina54_integracao_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.financeiro_lancamentos existente
       WHERE existente.pagina54_integracao_id = NEW.pagina54_integracao_id
     ) THEN
    RETURN NEW;
  END IF;

  v_nome := public.financeiro_normalizar_nome_duplicidade(
    coalesce(NEW.descricao_original, NEW.descricao, NEW.observacoes)
  );
  v_valor := round(abs(coalesce(NEW.valor_realizado, NEW.valor_previsto, 0))::numeric, 2);
  v_data_prevista := NEW.data_prevista;
  v_data_realizada := NEW.data_realizada;

  -- Sem nome, valor positivo e ao menos uma data não existe base segura
  -- para bloquear automaticamente.
  IF v_nome = ''
     OR v_valor <= 0
     OR (v_data_prevista IS NULL AND v_data_realizada IS NULL) THEN
    RETURN NEW;
  END IF;

  SELECT existente.id
  INTO v_lancamento_existente
  FROM public.financeiro_lancamentos existente
  WHERE existente.origem_tipo IS DISTINCT FROM 'pagina54'
    AND existente.status IS DISTINCT FROM 'cancelado'
    AND public.financeiro_normalizar_nome_duplicidade(
          coalesce(existente.descricao_original, existente.descricao, existente.observacoes)
        ) = v_nome
    AND round(
          abs(coalesce(existente.valor_realizado, existente.valor_previsto, 0))::numeric,
          2
        ) = v_valor
    AND (
      (
        v_data_realizada IS NOT NULL
        AND (existente.data_realizada = v_data_realizada OR existente.data_prevista = v_data_realizada)
      )
      OR
      (
        v_data_prevista IS NOT NULL
        AND (existente.data_prevista = v_data_prevista OR existente.data_realizada = v_data_prevista)
      )
    )
  ORDER BY existente.updated_at DESC, existente.created_at DESC
  LIMIT 1;

  IF v_lancamento_existente IS NULL THEN
    RETURN NEW;
  END IF;

  v_motivo := jsonb_build_object(
    'tipo', 'possivel_duplicidade_sistema_planilha',
    'criterios', jsonb_build_array('nome_normalizado', 'valor', 'data'),
    'lancamento_existente_id', v_lancamento_existente,
    'nome_normalizado', v_nome,
    'valor', v_valor,
    'data_prevista', v_data_prevista,
    'data_realizada', v_data_realizada,
    'bloqueado_em', now()
  );

  UPDATE public.financeiro_importacao_pagina54
  SET revisao_pendente = true,
      motivos_revisao = jsonb_build_array(v_motivo),
      sync_status = 'revisao_duplicidade',
      sync_erro = 'Importação bloqueada: já existe lançamento no sistema com mesmo nome, valor e data.',
      sync_em = now()
  WHERE id = NEW.importacao_pagina54_id;

  PERFORM public.financeiro_registrar_auditoria(
    'importacao_pagina54',
    NEW.importacao_pagina54_id,
    v_lancamento_existente,
    'duplicidade_bloqueada',
    v_motivo
  );

  -- Cancela somente o novo INSERT. A linha da planilha permanece registrada
  -- na tabela de importação para conferência e auditoria.
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_bloquear_duplicidade_pagina54
ON public.financeiro_lancamentos;

CREATE TRIGGER trg_financeiro_bloquear_duplicidade_pagina54
BEFORE INSERT ON public.financeiro_lancamentos
FOR EACH ROW
EXECUTE FUNCTION public.financeiro_bloquear_duplicidade_pagina54();
