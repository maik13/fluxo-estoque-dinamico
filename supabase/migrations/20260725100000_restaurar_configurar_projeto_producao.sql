-- Restaura a rotina segura usada para adicionar ou atualizar projetos no módulo Produção.
-- A tabela producao_projetos permanece protegida por RLS; a gravação ocorre somente por esta RPC.

BEGIN;

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
  p_ativo BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_usuario_nome TEXT;
  v_local_nome TEXT;
  v_projeto_id UUID;
  v_pode_configurar BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Compatibilidade com o controle global atual e com o controle legado da Produção.
  IF public.is_admin() THEN
    v_pode_configurar := TRUE;
  ELSE
    BEGIN
      v_pode_configurar := public.permissao_individual_efetiva(
        v_user_id,
        'pode_configurar_producao'
      );
    EXCEPTION WHEN undefined_function THEN
      v_pode_configurar := FALSE;
    END;

    IF NOT v_pode_configurar THEN
      BEGIN
        v_pode_configurar := public.usuario_tem_permissao_producao('projetos');
      EXCEPTION WHEN undefined_function THEN
        v_pode_configurar := FALSE;
      END;
    END IF;
  END IF;

  IF NOT v_pode_configurar THEN
    RAISE EXCEPTION 'Sem permissão para adicionar projetos à Produção';
  END IF;

  SELECT l.nome
  INTO v_local_nome
  FROM public.locais_utilizacao l
  WHERE l.id = p_local_utilizacao_id
    AND COALESCE(l.ativo, TRUE) = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto/local selecionado não existe ou está inativo';
  END IF;

  SELECT COALESCE(p.nome, p.email, 'Usuário')
  INTO v_usuario_nome
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  v_usuario_nome := COALESCE(v_usuario_nome, 'Usuário');

  INSERT INTO public.producao_projetos (
    local_utilizacao_id,
    nome,
    descricao,
    cliente,
    cidade,
    uf,
    local_execucao,
    endereco_execucao,
    responsavel_id,
    responsavel_nome_snapshot,
    ativo,
    criado_por_id,
    criado_por_nome_snapshot,
    atualizado_por_id,
    atualizado_por_nome_snapshot
  ) VALUES (
    p_local_utilizacao_id,
    v_local_nome,
    NULLIF(BTRIM(p_descricao), ''),
    NULLIF(BTRIM(p_cliente), ''),
    NULLIF(BTRIM(p_cidade), ''),
    NULLIF(UPPER(BTRIM(p_uf)), ''),
    NULLIF(BTRIM(p_local_execucao), ''),
    NULLIF(BTRIM(p_endereco_execucao), ''),
    p_responsavel_id,
    NULLIF(BTRIM(p_responsavel_nome), ''),
    COALESCE(p_ativo, TRUE),
    v_user_id,
    v_usuario_nome,
    v_user_id,
    v_usuario_nome
  )
  ON CONFLICT (local_utilizacao_id)
  WHERE local_utilizacao_id IS NOT NULL
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
    atualizado_por_id = v_user_id,
    atualizado_por_nome_snapshot = v_usuario_nome,
    updated_at = NOW()
  RETURNING id INTO v_projeto_id;

  RETURN v_projeto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.configurar_projeto_producao(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.configurar_projeto_producao(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN
) TO authenticated;

COMMIT;
