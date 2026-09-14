-- Protege a numeração automática de Produção contra drift de sequences.
-- Cenário coberto: restauração/importação de registros com numero/codigo explícitos
-- sem avanço correspondente da sequence.
--
-- Garantias:
-- 1) corrige imediatamente as sequences existentes;
-- 2) a próxima OP confere MAX(numero) antes de consumir a sequence;
-- 3) a próxima Etapa confere o maior sufixo de codigo antes de consumir a sequence;
-- 4) INSERT/UPDATE explícito também avança a sequence quando os triggers estão ativos;
-- 5) mesmo que triggers sejam desativados numa restauração, o próximo cadastro normal
--    se autocorrige antes de gerar o identificador.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.producao_ordem_numero_seq
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public.producao_processo_codigo_seq
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO CYCLE;

-- ---------------------------------------------------------------------------
-- Chaves de advisory lock estáveis e distintas para serializar somente a geração
-- destes identificadores, sem bloquear o restante do módulo de Produção.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.proximo_numero_ordem_producao()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = ''
AS $$
DECLARE
  v_max_numero BIGINT := 0;
  v_last BIGINT;
  v_is_called BOOLEAN;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(74100101::BIGINT);

  SELECT COALESCE(MAX(o.numero), 0)
    INTO v_max_numero
    FROM public.producao_ordens_producao o;

  SELECT s.last_value, s.is_called
    INTO v_last, v_is_called
    FROM public.producao_ordem_numero_seq s;

  IF v_max_numero > 0
     AND (
       v_last < v_max_numero
       OR (v_last = v_max_numero AND NOT v_is_called)
     ) THEN
    PERFORM pg_catalog.setval(
      'public.producao_ordem_numero_seq'::regclass,
      v_max_numero,
      TRUE
    );
  END IF;

  RETURN pg_catalog.nextval('public.producao_ordem_numero_seq'::regclass);
END;
$$;

REVOKE ALL ON FUNCTION public.proximo_numero_ordem_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proximo_numero_ordem_producao() TO authenticated;

ALTER TABLE public.producao_ordens_producao
  ALTER COLUMN numero
  SET DEFAULT public.proximo_numero_ordem_producao();

CREATE OR REPLACE FUNCTION public.trg_sincronizar_sequence_op_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_last BIGINT;
  v_is_called BOOLEAN;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero < 1 THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(74100101::BIGINT);

  SELECT s.last_value, s.is_called
    INTO v_last, v_is_called
    FROM public.producao_ordem_numero_seq s;

  IF NEW.numero > v_last
     OR (NEW.numero = v_last AND NOT v_is_called) THEN
    PERFORM pg_catalog.setval(
      'public.producao_ordem_numero_seq'::regclass,
      NEW.numero,
      TRUE
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_sequence_op_producao
  ON public.producao_ordens_producao;

CREATE TRIGGER trg_sincronizar_sequence_op_producao
BEFORE INSERT OR UPDATE OF numero
ON public.producao_ordens_producao
FOR EACH ROW
EXECUTE FUNCTION public.trg_sincronizar_sequence_op_producao();

-- ---------------------------------------------------------------------------
-- Etapas: preview sem consumir sequence e geração definitiva autocorretiva.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.obter_proximo_codigo_etapa_producao()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_max_codigo BIGINT := 0;
  v_last BIGINT;
  v_is_called BOOLEAN;
  v_proximo_sequence BIGINT;
  v_proximo BIGINT;
BEGIN
  SELECT COALESCE(
           MAX((substring(p.codigo FROM '^PRD-[0-9]{4}-([0-9]+)$'))::BIGINT),
           0
         )
    INTO v_max_codigo
    FROM public.producao_processos p
   WHERE p.codigo ~ '^PRD-[0-9]{4}-[0-9]+$';

  SELECT s.last_value, s.is_called
    INTO v_last, v_is_called
    FROM public.producao_processo_codigo_seq s;

  v_proximo_sequence := CASE
    WHEN v_is_called THEN v_last + 1
    ELSE v_last
  END;

  v_proximo := GREATEST(v_max_codigo + 1, v_proximo_sequence, 1);

  RETURN 'PRD-'
    || pg_catalog.to_char(CURRENT_DATE, 'YYYY')
    || '-'
    || pg_catalog.lpad(v_proximo::TEXT, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.obter_proximo_codigo_etapa_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_proximo_codigo_etapa_producao() TO authenticated;

CREATE OR REPLACE FUNCTION public.proximo_codigo_etapa_producao_definitivo()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = ''
AS $$
DECLARE
  v_max_codigo BIGINT := 0;
  v_last BIGINT;
  v_is_called BOOLEAN;
  v_numero BIGINT;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(74100102::BIGINT);

  SELECT COALESCE(
           MAX((substring(p.codigo FROM '^PRD-[0-9]{4}-([0-9]+)$'))::BIGINT),
           0
         )
    INTO v_max_codigo
    FROM public.producao_processos p
   WHERE p.codigo ~ '^PRD-[0-9]{4}-[0-9]+$';

  SELECT s.last_value, s.is_called
    INTO v_last, v_is_called
    FROM public.producao_processo_codigo_seq s;

  IF v_max_codigo > 0
     AND (
       v_last < v_max_codigo
       OR (v_last = v_max_codigo AND NOT v_is_called)
     ) THEN
    PERFORM pg_catalog.setval(
      'public.producao_processo_codigo_seq'::regclass,
      v_max_codigo,
      TRUE
    );
  END IF;

  v_numero := pg_catalog.nextval('public.producao_processo_codigo_seq'::regclass);

  RETURN 'PRD-'
    || pg_catalog.to_char(CURRENT_DATE, 'YYYY')
    || '-'
    || pg_catalog.lpad(v_numero::TEXT, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.proximo_codigo_etapa_producao_definitivo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proximo_codigo_etapa_producao_definitivo() TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_sincronizar_sequence_etapa_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_numero BIGINT;
  v_last BIGINT;
  v_is_called BOOLEAN;
BEGIN
  IF NEW.codigo IS NULL
     OR NEW.codigo !~ '^PRD-[0-9]{4}-[0-9]+$' THEN
    RETURN NEW;
  END IF;

  v_numero := (substring(NEW.codigo FROM '^PRD-[0-9]{4}-([0-9]+)$'))::BIGINT;

  PERFORM pg_catalog.pg_advisory_xact_lock(74100102::BIGINT);

  SELECT s.last_value, s.is_called
    INTO v_last, v_is_called
    FROM public.producao_processo_codigo_seq s;

  IF v_numero > v_last
     OR (v_numero = v_last AND NOT v_is_called) THEN
    PERFORM pg_catalog.setval(
      'public.producao_processo_codigo_seq'::regclass,
      v_numero,
      TRUE
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_sequence_etapa_producao
  ON public.producao_processos;

CREATE TRIGGER trg_sincronizar_sequence_etapa_producao
BEFORE INSERT OR UPDATE OF codigo
ON public.producao_processos
FOR EACH ROW
EXECUTE FUNCTION public.trg_sincronizar_sequence_etapa_producao();

-- ---------------------------------------------------------------------------
-- A criação de Etapa passa a consumir o gerador seguro.
-- Mantém a assinatura pública/interna já usada pelo frontend.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.criar_processo_producao(
  p_projeto_id UUID,
  p_nome TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_prioridade TEXT DEFAULT 'normal',
  p_codigo TEXT DEFAULT NULL,
  p_produto_entregavel TEXT DEFAULT NULL,
  p_unidade_medida TEXT DEFAULT NULL,
  p_quantidade_planejada NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_config_id UUID;
  v_user UUID := auth.uid();
  v_codigo TEXT;
  v_nome_user TEXT;
  v_permitido BOOLEAN := FALSE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF public.is_admin() THEN
    v_permitido := TRUE;
  ELSE
    BEGIN
      v_permitido := public.usuario_tem_permissao_producao('processos');
    EXCEPTION
      WHEN undefined_function THEN
        v_permitido := FALSE;
    END;
  END IF;

  IF NOT COALESCE(v_permitido, FALSE) THEN
    RAISE EXCEPTION 'Sem permissão para criar etapas';
  END IF;

  IF BTRIM(COALESCE(p_nome, '')) = '' THEN
    RAISE EXCEPTION 'Nome da etapa é obrigatório';
  END IF;

  IF p_prioridade NOT IN ('baixa', 'normal', 'alta', 'urgente') THEN
    RAISE EXCEPTION 'Prioridade inválida';
  END IF;

  IF p_quantidade_planejada IS NOT NULL
     AND p_quantidade_planejada <= 0 THEN
    RAISE EXCEPTION 'Quantidade planejada deve ser maior que zero';
  END IF;

  SELECT pp.id
    INTO v_config_id
    FROM public.producao_projetos pp
   WHERE pp.local_utilizacao_id = p_projeto_id
     AND COALESCE(pp.ativo, TRUE) = TRUE
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O projeto precisa estar adicionado à Produção antes de receber etapas';
  END IF;

  v_codigo := COALESCE(
    NULLIF(BTRIM(p_codigo), ''),
    public.proximo_codigo_etapa_producao_definitivo()
  );

  IF EXISTS (
    SELECT 1
      FROM public.producao_processos p
     WHERE p.codigo = v_codigo
  ) THEN
    RAISE EXCEPTION 'Já existe uma etapa com o código %', v_codigo;
  END IF;

  SELECT COALESCE(u.raw_user_meta_data->>'name', u.email, 'Usuário')
    INTO v_nome_user
    FROM auth.users u
   WHERE u.id = v_user;

  v_nome_user := COALESCE(v_nome_user, 'Usuário');

  INSERT INTO public.producao_processos (
    codigo,
    projeto_id,
    nome,
    descricao,
    produto_entregavel,
    unidade_medida,
    quantidade_planejada,
    prioridade,
    criado_por_id,
    criado_por_nome_snapshot
  ) VALUES (
    v_codigo,
    v_config_id,
    BTRIM(p_nome),
    NULLIF(BTRIM(p_descricao), ''),
    NULLIF(BTRIM(p_produto_entregavel), ''),
    NULLIF(BTRIM(p_unidade_medida), ''),
    p_quantidade_planejada,
    p_prioridade,
    v_user,
    v_nome_user
  )
  RETURNING id INTO v_id;

  BEGIN
    INSERT INTO public.producao_processo_eventos (
      processo_id,
      tipo_evento,
      novo_status,
      usuario_responsavel_id,
      nome_usuario_snapshot
    ) VALUES (
      v_id,
      'processo_criado',
      'planejado',
      v_user,
      v_nome_user
    );
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      NULL;
  END;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_processo_producao(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_processo_producao(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Sincronização imediata do estado atual.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_max_op BIGINT := 0;
  v_max_etapa BIGINT := 0;
  v_last BIGINT;
  v_is_called BOOLEAN;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(74100101::BIGINT);

  SELECT COALESCE(MAX(o.numero), 0)
    INTO v_max_op
    FROM public.producao_ordens_producao o;

  SELECT s.last_value, s.is_called
    INTO v_last, v_is_called
    FROM public.producao_ordem_numero_seq s;

  IF v_max_op > 0
     AND (
       v_last < v_max_op
       OR (v_last = v_max_op AND NOT v_is_called)
     ) THEN
    PERFORM pg_catalog.setval(
      'public.producao_ordem_numero_seq'::regclass,
      v_max_op,
      TRUE
    );
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(74100102::BIGINT);

  SELECT COALESCE(
           MAX((substring(p.codigo FROM '^PRD-[0-9]{4}-([0-9]+)$'))::BIGINT),
           0
         )
    INTO v_max_etapa
    FROM public.producao_processos p
   WHERE p.codigo ~ '^PRD-[0-9]{4}-[0-9]+$';

  SELECT s.last_value, s.is_called
    INTO v_last, v_is_called
    FROM public.producao_processo_codigo_seq s;

  IF v_max_etapa > 0
     AND (
       v_last < v_max_etapa
       OR (v_last = v_max_etapa AND NOT v_is_called)
     ) THEN
    PERFORM pg_catalog.setval(
      'public.producao_processo_codigo_seq'::regclass,
      v_max_etapa,
      TRUE
    );
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
