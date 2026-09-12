-- Hierarquia Projeto -> Etapa -> OP.
-- Acrescenta ciclo de vida do projeto, período previsto no cadastro e
-- sincronização automática do status a partir das etapas.

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
  p_data_inicio_prevista DATE DEFAULT NULL,
  p_data_fim_prevista DATE DEFAULT NULL,
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

  IF p_data_inicio_prevista IS NULL OR p_data_fim_prevista IS NULL THEN
    RAISE EXCEPTION 'Informe a data de início e a data de término previstas do projeto';
  END IF;

  IF p_data_fim_prevista < p_data_inicio_prevista THEN
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
    RAISE EXCEPTION 'Sem permissão para adicionar ou editar projetos da Produção';
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
    data_inicio_prevista,
    data_fim_prevista,
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
    p_data_inicio_prevista,
    p_data_fim_prevista,
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
    data_inicio_prevista = EXCLUDED.data_inicio_prevista,
    data_fim_prevista = EXCLUDED.data_fim_prevista,
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

REVOKE ALL ON FUNCTION public.configurar_projeto_producao_v2(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, UUID, TEXT, BOOLEAN
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.configurar_projeto_producao_v2(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, UUID, TEXT, BOOLEAN
) TO authenticated;

CREATE OR REPLACE FUNCTION public.recalcular_status_projeto_producao(
  p_projeto_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_validas INTEGER := 0;
  v_total_finalizadas INTEGER := 0;
  v_total_iniciadas INTEGER := 0;
  v_inicio_real DATE;
  v_fim_real DATE;
  v_status TEXT;
BEGIN
  IF p_projeto_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE p.status <> 'cancelado'),
    COUNT(*) FILTER (WHERE p.status = 'finalizado'),
    COUNT(*) FILTER (
      WHERE p.status <> 'cancelado'
        AND (
          p.data_inicio_real IS NOT NULL
          OR p.status IN ('em_andamento', 'pausado', 'bloqueado', 'finalizado')
        )
    ),
    MIN(p.data_inicio_real) FILTER (WHERE p.status <> 'cancelado'),
    MAX(p.data_fim_real) FILTER (WHERE p.status = 'finalizado')
  INTO
    v_total_validas,
    v_total_finalizadas,
    v_total_iniciadas,
    v_inicio_real,
    v_fim_real
  FROM public.producao_processos p
  WHERE p.projeto_id = p_projeto_id;

  IF v_total_validas = 0 THEN
    v_status := 'planejado';
    v_inicio_real := NULL;
    v_fim_real := NULL;
  ELSIF v_total_finalizadas = v_total_validas THEN
    v_status := 'concluido';
    v_inicio_real := COALESCE(v_inicio_real, CURRENT_DATE);
    v_fim_real := COALESCE(v_fim_real, CURRENT_DATE);
  ELSIF v_total_iniciadas > 0 THEN
    v_status := 'em_andamento';
    v_inicio_real := COALESCE(v_inicio_real, CURRENT_DATE);
    v_fim_real := NULL;
  ELSE
    v_status := 'planejado';
    v_inicio_real := NULL;
    v_fim_real := NULL;
  END IF;

  UPDATE public.producao_projetos
     SET status = v_status,
         data_inicio_real = v_inicio_real,
         data_fim_real = v_fim_real,
         updated_at = NOW()
   WHERE id = p_projeto_id
     AND (
       status IS DISTINCT FROM v_status
       OR data_inicio_real IS DISTINCT FROM v_inicio_real
       OR data_fim_real IS DISTINCT FROM v_fim_real
     );
END;
$$;

CREATE OR REPLACE FUNCTION public.sincronizar_status_projeto_por_etapa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_status_projeto_producao(OLD.projeto_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.projeto_id IS DISTINCT FROM NEW.projeto_id THEN
    PERFORM public.recalcular_status_projeto_producao(OLD.projeto_id);
  END IF;

  PERFORM public.recalcular_status_projeto_producao(NEW.projeto_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_status_projeto_por_etapa
  ON public.producao_processos;

CREATE TRIGGER trg_sincronizar_status_projeto_por_etapa
AFTER INSERT OR DELETE OR UPDATE OF status, data_inicio_real, data_fim_real, projeto_id
ON public.producao_processos
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_status_projeto_por_etapa();

DO $$
DECLARE
  v_projeto RECORD;
BEGIN
  FOR v_projeto IN SELECT id FROM public.producao_projetos LOOP
    PERFORM public.recalcular_status_projeto_producao(v_projeto.id);
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
