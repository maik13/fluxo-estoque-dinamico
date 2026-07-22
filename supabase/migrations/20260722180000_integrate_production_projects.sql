-- Integra o Módulo de Produção aos projetos/locais já existentes no aplicativo.
-- Não altera nem duplica registros de locais_utilizacao ou project_groups.
BEGIN;

ALTER TABLE public.producao_projetos
  ADD COLUMN IF NOT EXISTS local_utilizacao_id UUID NULL
    REFERENCES public.locais_utilizacao(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS producao_projetos_local_utilizacao_unique
  ON public.producao_projetos(local_utilizacao_id)
  WHERE local_utilizacao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.configurar_projeto_producao(
  p_local_utilizacao_id UUID,
  p_descricao TEXT DEFAULT NULL,
  p_cliente TEXT DEFAULT NULL,
  p_cidade TEXT DEFAULT NULL,
  p_uf TEXT DEFAULT NULL,
  p_local_execucao TEXT DEFAULT NULL,
  p_endereco_execucao TEXT DEFAULT NULL,
  p_responsavel_id UUID DEFAULT NULL,
  p_responsavel_nome TEXT DEFAULT NULL,
  p_ativo BOOLEAN DEFAULT true
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_user_nome TEXT;
  v_local_nome TEXT;
  v_id UUID;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para configurar projetos de produção';
  END IF;

  SELECT nome INTO v_local_nome
  FROM public.locais_utilizacao
  WHERE id = p_local_utilizacao_id AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto/local inexistente ou inativo';
  END IF;

  IF p_uf IS NOT NULL AND btrim(p_uf) <> '' AND length(btrim(p_uf)) <> 2 THEN
    RAISE EXCEPTION 'UF deve possuir 2 caracteres';
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_user_nome
  FROM auth.users
  WHERE id = v_user;

  INSERT INTO public.producao_projetos (
    local_utilizacao_id, nome, descricao, cliente, cidade, uf,
    local_execucao, endereco_execucao, responsavel_id,
    responsavel_nome_snapshot, ativo, criado_por_id,
    criado_por_nome_snapshot, atualizado_por_id,
    atualizado_por_nome_snapshot
  ) VALUES (
    p_local_utilizacao_id, v_local_nome, NULLIF(btrim(p_descricao), ''),
    NULLIF(btrim(p_cliente), ''), NULLIF(btrim(p_cidade), ''),
    upper(NULLIF(btrim(p_uf), '')), NULLIF(btrim(p_local_execucao), ''),
    NULLIF(btrim(p_endereco_execucao), ''), p_responsavel_id,
    NULLIF(btrim(p_responsavel_nome), ''), p_ativo, v_user,
    v_user_nome, v_user, v_user_nome
  )
  ON CONFLICT (local_utilizacao_id) WHERE local_utilizacao_id IS NOT NULL
  DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    cliente = EXCLUDED.cliente,
    cidade = EXCLUDED.cidade,
    uf = EXCLUDED.uf,
    local_execucao = EXCLUDED.local_execucao,
    endereco_execucao = EXCLUDED.endereco_execucao,
    responsavel_id = EXCLUDED.responsavel_id,
    responsavel_nome_snapshot = EXCLUDED.responsavel_nome_snapshot,
    ativo = EXCLUDED.ativo,
    atualizado_por_id = v_user,
    atualizado_por_nome_snapshot = v_user_nome,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.configurar_projeto_producao(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.configurar_projeto_producao(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,BOOLEAN) TO authenticated;

-- A criação de processos passa a receber o ID do projeto/local existente.
CREATE OR REPLACE FUNCTION public.criar_processo_producao(
  p_projeto_id UUID,
  p_nome TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_prioridade TEXT DEFAULT 'normal',
  p_codigo TEXT DEFAULT NULL,
  p_produto_entregavel TEXT DEFAULT NULL,
  p_unidade_medida TEXT DEFAULT NULL,
  p_quantidade_planejada NUMERIC DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_config_id UUID;
  v_user UUID := auth.uid();
  v_codigo TEXT;
  v_nome_user TEXT;
  v_local_nome TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para criar processos';
  END IF;
  IF btrim(COALESCE(p_nome, '')) = '' THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  IF p_prioridade NOT IN ('baixa','normal','alta','urgente') THEN RAISE EXCEPTION 'Prioridade inválida'; END IF;

  SELECT nome INTO v_local_nome
  FROM public.locais_utilizacao
  WHERE id = p_projeto_id AND ativo = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto/local inexistente ou inativo'; END IF;

  SELECT id INTO v_config_id
  FROM public.producao_projetos
  WHERE local_utilizacao_id = p_projeto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.producao_projetos (
      local_utilizacao_id, nome, ativo, criado_por_id, criado_por_nome_snapshot
    )
    SELECT p_projeto_id, v_local_nome, true, v_user,
      COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
    FROM auth.users WHERE id = v_user
    RETURNING id INTO v_config_id;
  END IF;

  v_codigo := COALESCE(NULLIF(btrim(p_codigo), ''),
    'PRD-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('public.producao_processo_codigo_seq')::TEXT, 6, '0'));
  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário') INTO v_nome_user FROM auth.users WHERE id = v_user;

  INSERT INTO public.producao_processos (
    codigo, projeto_id, nome, descricao, produto_entregavel, unidade_medida,
    quantidade_planejada, prioridade, criado_por_id, criado_por_nome_snapshot
  ) VALUES (
    v_codigo, v_config_id, btrim(p_nome), NULLIF(btrim(p_descricao), ''),
    NULLIF(btrim(p_produto_entregavel), ''), NULLIF(btrim(p_unidade_medida), ''),
    p_quantidade_planejada, p_prioridade, v_user, v_nome_user
  ) RETURNING id INTO v_id;

  INSERT INTO public.producao_processo_eventos (
    processo_id, tipo_evento, novo_status, usuario_responsavel_id,
    nome_usuario_snapshot, valores_posteriores
  ) VALUES (
    v_id, 'processo_criado', 'planejado', v_user, v_nome_user,
    jsonb_build_object('codigo', v_codigo, 'nome', btrim(p_nome), 'prioridade', p_prioridade, 'projeto_local_id', p_projeto_id)
  );

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_processo_producao(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_processo_producao(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC) TO authenticated;

COMMIT;
