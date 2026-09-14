-- Datas planejadas do projeto e status automático derivado das Etapas.
-- Mantém compatibilidade com a RPC legada e expõe uma V2 para o frontend.

BEGIN;

ALTER TABLE public.producao_projetos
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planejado',
  ADD COLUMN IF NOT EXISTS data_inicio_real DATE NULL,
  ADD COLUMN IF NOT EXISTS data_fim_real DATE NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'producao_projetos_status_check'
      AND conrelid = 'public.producao_projetos'::regclass
  ) THEN
    ALTER TABLE public.producao_projetos
      ADD CONSTRAINT producao_projetos_status_check
      CHECK (status IN ('planejado', 'em_andamento', 'concluido'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.configurar_projeto_producao_v2(
  p_local_utilizacao_id UUID,
  p_descricao TEXT DEFAULT NULL,
  p_cliente TEXT DEFAULT NULL,
  p_cidade TEXT DEFAULT NULL,
  p_uf TEXT DEFAULT NULL,
  p_local_execucao TEXT DEFAULT NULL,
  p_endereco_execucao TEXT DEFAULT NULL,
  p_responsavel_id UUID DEFAULT NULL,
  p_responsavel_nome TEXT DEFAULT NULL,
  p_data_inicio_prevista DATE DEFAULT NULL,
  p_data_fim_prevista DATE DEFAULT NULL,
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

  IF p_data_inicio_prevista IS NOT NULL
     AND p_data_fim_prevista IS NOT NULL
     AND p_data_fim_prevista < p_data_inicio_prevista THEN
    RAISE EXCEPTION 'A data de término do projeto não pode ser anterior à data de início';
  END IF;

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
    data_inicio_prevista,
    data_fim_prevista,
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
    p_data_inicio_prevista,
    p_data_fim_prevista,
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
    data_inicio_prevista = EXCLUDED.data_inicio_prevista,
    data_fim_prevista = EXCLUDED.data_fim_prevista,
    ativo = EXCLUDED.ativo,
    atualizado_por_id = v_user_id,
    atualizado_por_nome_snapshot = v_usuario_nome,
    updated_at = NOW()
  RETURNING id INTO v_projeto_id;

  RETURN v_projeto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.configurar_projeto_producao_v2(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DATE, DATE, BOOLEAN
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.configurar_projeto_producao_v2(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DATE, DATE, BOOLEAN
) TO authenticated;

CREATE OR REPLACE FUNCTION public.sincronizar_status_projeto_producao(
  p_projeto_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total INTEGER := 0;
  v_finalizadas INTEGER := 0;
  v_iniciadas INTEGER := 0;
  v_inicio_real DATE;
  v_fim_real DATE;
  v_status TEXT := 'planejado';
BEGIN
  IF p_projeto_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE p.status <> 'cancelado'),
    COUNT(*) FILTER (WHERE p.status = 'finalizado'),
    COUNT(*) FILTER (
      WHERE p.status IN ('em_andamento', 'pausado', 'bloqueado', 'finalizado')
    ),
    MIN(p.data_inicio_real) FILTER (WHERE p.status <> 'cancelado'),
    MAX(COALESCE(p.data_fim_real, p.finalizado_em::date))
      FILTER (WHERE p.status = 'finalizado')
  INTO
    v_total,
    v_finalizadas,
    v_iniciadas,
    v_inicio_real,
    v_fim_real
  FROM public.producao_processos p
  WHERE p.projeto_id = p_projeto_id;

  IF COALESCE(v_total, 0) = 0 THEN
    v_status := 'planejado';
    v_inicio_real := NULL;
    v_fim_real := NULL;
  ELSIF v_finalizadas = v_total THEN
    v_status := 'concluido';
  ELSIF v_iniciadas > 0 THEN
    v_status := 'em_andamento';
    v_fim_real := NULL;
  ELSE
    v_status := 'planejado';
    v_inicio_real := NULL;
    v_fim_real := NULL;
  END IF;

  UPDATE public.producao_projetos
     SET status = v_status,
         data_inicio_real = CASE
           WHEN v_status = 'planejado' THEN NULL
           ELSE COALESCE(v_inicio_real, data_inicio_real)
         END,
         data_fim_real = CASE
           WHEN v_status = 'concluido' THEN COALESCE(v_fim_real, CURRENT_DATE)
           ELSE NULL
         END,
         updated_at = NOW()
   WHERE id = p_projeto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_status_projeto_producao(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.trg_sincronizar_status_projeto_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sincronizar_status_projeto_producao(OLD.projeto_id);
    RETURN OLD;
  END IF;

  PERFORM public.sincronizar_status_projeto_producao(NEW.projeto_id);

  IF TG_OP = 'UPDATE' AND OLD.projeto_id IS DISTINCT FROM NEW.projeto_id THEN
    PERFORM public.sincronizar_status_projeto_producao(OLD.projeto_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_producao_processos_sincronizar_projeto
  ON public.producao_processos;

CREATE TRIGGER trg_producao_processos_sincronizar_projeto
AFTER INSERT OR UPDATE OF status, data_inicio_real, data_fim_real, finalizado_em, cancelado_em OR DELETE
ON public.producao_processos
FOR EACH ROW
EXECUTE FUNCTION public.trg_sincronizar_status_projeto_producao();

DO $$
DECLARE
  v_projeto RECORD;
BEGIN
  FOR v_projeto IN SELECT id FROM public.producao_projetos LOOP
    PERFORM public.sincronizar_status_projeto_producao(v_projeto.id);
  END LOOP;
END $$;

COMMIT;
