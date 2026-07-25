-- HOTFIX MÍNIMO — criação de etapa da Produção
-- Cria a assinatura exata exigida por criar_etapa_producao.
-- Não altera estoque, itens, movements ou projetos existentes.

CREATE SEQUENCE IF NOT EXISTS public.producao_processo_codigo_seq;

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
    'PRD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
    LPAD(NEXTVAL('public.producao_processo_codigo_seq')::TEXT, 6, '0')
  );

  IF EXISTS (
    SELECT 1
    FROM public.producao_processos
    WHERE codigo = v_codigo
  ) THEN
    RAISE EXCEPTION 'Já existe uma etapa com o código %', v_codigo;
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome_user
  FROM auth.users
  WHERE id = v_user;

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
  )
  VALUES (
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
    )
    VALUES (
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

NOTIFY pgrst, 'reload schema';

SELECT
  TO_REGPROCEDURE(
    'public.criar_processo_producao(uuid,text,text,text,text,text,text,numeric)'
  ) AS funcao_interna_instalada,
  TO_REGPROCEDURE(
    'public.criar_etapa_producao(uuid,text,text,text,text,text,text,numeric,date,date,text,integer,numeric,numeric,boolean,jsonb)'
  ) AS funcao_da_tela_instalada;
