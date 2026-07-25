-- Corrige dependências internas não verificadas pelo diagnóstico da Produção.
-- Restaura criar_processo_producao, usada internamente por criar_etapa_producao,
-- e amplia o diagnóstico para verificar RPCs públicas e auxiliares.

BEGIN;

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
  v_local_nome TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para criar etapas';
  END IF;

  IF BTRIM(COALESCE(p_nome, '')) = '' THEN
    RAISE EXCEPTION 'Nome da etapa é obrigatório';
  END IF;

  IF p_prioridade NOT IN ('baixa', 'normal', 'alta', 'urgente') THEN
    RAISE EXCEPTION 'Prioridade inválida';
  END IF;

  IF p_quantidade_planejada IS NOT NULL AND p_quantidade_planejada <= 0 THEN
    RAISE EXCEPTION 'Quantidade planejada deve ser maior que zero';
  END IF;

  SELECT nome
  INTO v_local_nome
  FROM public.locais_utilizacao
  WHERE id = p_projeto_id
    AND COALESCE(ativo, TRUE) = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto/local inexistente ou inativo';
  END IF;

  SELECT id
  INTO v_config_id
  FROM public.producao_projetos
  WHERE local_utilizacao_id = p_projeto_id
    AND COALESCE(ativo, TRUE) = TRUE
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O projeto precisa ser adicionado à Produção antes de receber etapas';
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
    criado_por_nome_snapshot,
    atualizado_por_id,
    atualizado_por_nome_snapshot
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
    v_nome_user,
    v_user,
    v_nome_user
  )
  RETURNING id INTO v_id;

  INSERT INTO public.producao_processo_eventos (
    processo_id,
    tipo_evento,
    novo_status,
    usuario_responsavel_id,
    nome_usuario_snapshot,
    valores_posteriores
  ) VALUES (
    v_id,
    'processo_criado',
    'planejado',
    v_user,
    v_nome_user,
    JSONB_BUILD_OBJECT(
      'codigo', v_codigo,
      'nome', BTRIM(p_nome),
      'prioridade', p_prioridade,
      'projeto_local_id', p_projeto_id,
      'projeto_id', v_config_id
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_processo_producao(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_processo_producao(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) TO authenticated;

-- Garante que a função pública de criação da etapa está ligada à assinatura correta.
CREATE OR REPLACE FUNCTION public.criar_etapa_producao(
  p_projeto_local_id UUID,
  p_nome TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_prioridade TEXT DEFAULT 'normal',
  p_codigo TEXT DEFAULT NULL,
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
  p_dependencias JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := public.criar_processo_producao(
    p_projeto_local_id,
    p_nome,
    p_descricao,
    p_prioridade,
    p_codigo,
    p_produto_entregavel,
    p_unidade_medida,
    p_quantidade_planejada
  );

  PERFORM public.salvar_planejamento_etapa_producao(
    v_id,
    p_data_inicio_desejada,
    p_data_limite,
    p_grupo_cronograma,
    p_sequencia,
    p_capacidade_diaria,
    p_pessoas_necessarias,
    p_aceita_producao_proporcional,
    COALESCE(p_dependencias, '[]'::JSONB)
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_etapa_producao(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC,
  DATE, DATE, TEXT, INTEGER, NUMERIC, NUMERIC, BOOLEAN, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_etapa_producao(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC,
  DATE, DATE, TEXT, INTEGER, NUMERIC, NUMERIC, BOOLEAN, JSONB
) TO authenticated;

-- Diagnóstico completo: inclui funções chamadas diretamente pelo frontend
-- e dependências internas utilizadas pelas próprias RPCs.
CREATE OR REPLACE FUNCTION public.diagnosticar_integridade_modulo_producao()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_funcoes TEXT[] := ARRAY[
    'configurar_projeto_producao',
    'criar_processo_producao',
    'criar_etapa_producao',
    'salvar_planejamento_etapa_producao',
    'transicao_processo_producao',
    'obter_resumo_finalizacao_processo',
    'obter_proximo_codigo_etapa_producao',
    'recalcular_cronograma_producao_interno',
    'recalcular_cronograma_producao',
    'salvar_configuracao_cronograma_producao',
    'listar_gantt_producao',
    'listar_plano_diario_producao',
    'criar_tarefa_producao',
    'salvar_membro_producao',
    'criar_apontamento_producao',
    'editar_apontamento_producao',
    'cancelar_apontamento_producao',
    'conferir_apontamento_producao',
    'registrar_anexo_producao',
    'remover_anexo_producao',
    'vincular_material_producao',
    'usuario_tem_permissao_producao'
  ];
  v_ausentes TEXT[];
  v_tabelas TEXT[] := ARRAY[
    'producao_projetos',
    'producao_processos',
    'producao_processo_eventos',
    'producao_apontamentos',
    'producao_apontamento_eventos',
    'producao_membros',
    'producao_tarefas',
    'producao_apontamento_membros',
    'producao_cronograma_configuracoes',
    'producao_processo_dependencias',
    'producao_alocacoes_diarias',
    'producao_cronograma_alertas'
  ];
  v_tabelas_ausentes TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT ARRAY_AGG(nome ORDER BY nome)
  INTO v_ausentes
  FROM UNNEST(v_funcoes) AS nome
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = nome
  );

  SELECT ARRAY_AGG(nome ORDER BY nome)
  INTO v_tabelas_ausentes
  FROM UNNEST(v_tabelas) AS nome
  WHERE TO_REGCLASS('public.' || nome) IS NULL;

  RETURN JSONB_BUILD_OBJECT(
    'ok',
      COALESCE(CARDINALITY(v_ausentes), 0) = 0
      AND COALESCE(CARDINALITY(v_tabelas_ausentes), 0) = 0,
    'funcoes_ausentes', COALESCE(TO_JSONB(v_ausentes), '[]'::JSONB),
    'tabelas_ausentes', COALESCE(TO_JSONB(v_tabelas_ausentes), '[]'::JSONB),
    'verificado_em', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.diagnosticar_integridade_modulo_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnosticar_integridade_modulo_producao() TO authenticated;

COMMIT;
