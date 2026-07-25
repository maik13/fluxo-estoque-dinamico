-- Jornada diária da equipe, snapshots por apontamento e indicadores gerenciais.
-- Não recalcula apontamentos históricos sem jornada registrada.

BEGIN;

ALTER TABLE public.producao_membros
  ADD COLUMN IF NOT EXISTS jornada_diaria_minutos INTEGER NULL
  CHECK (jornada_diaria_minutos IS NULL OR jornada_diaria_minutos BETWEEN 1 AND 1440);

ALTER TABLE public.producao_apontamento_membros
  ADD COLUMN IF NOT EXISTS jornada_diaria_minutos_snapshot INTEGER NULL,
  ADD COLUMN IF NOT EXISTS minutos_produtivos_snapshot INTEGER NULL,
  ADD COLUMN IF NOT EXISTS minutos_improdutivos_snapshot INTEGER NULL;

ALTER TABLE public.producao_apontamentos
  ADD COLUMN IF NOT EXISTS jornada_total_equipe_minutos_snapshot INTEGER NULL;

CREATE OR REPLACE FUNCTION public.salvar_membro_producao(
  p_id UUID DEFAULT NULL,
  p_nome TEXT DEFAULT NULL,
  p_apelido TEXT DEFAULT NULL,
  p_funcao TEXT DEFAULT NULL,
  p_valor_hora NUMERIC DEFAULT NULL,
  p_jornada_diaria_minutos INTEGER DEFAULT NULL,
  p_ativo BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_nome TEXT := BTRIM(COALESCE(p_nome, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('membros') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar a equipe';
  END IF;
  IF v_nome = '' THEN RAISE EXCEPTION 'Nome do membro é obrigatório'; END IF;
  IF p_valor_hora IS NOT NULL AND p_valor_hora < 0 THEN RAISE EXCEPTION 'Valor-hora inválido'; END IF;
  IF p_jornada_diaria_minutos IS NOT NULL AND (p_jornada_diaria_minutos < 1 OR p_jornada_diaria_minutos > 1440) THEN
    RAISE EXCEPTION 'A jornada diária deve estar entre 1 minuto e 24 horas';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.producao_membros(
      nome, nome_snapshot, origem, apelido, funcao, valor_hora,
      jornada_diaria_minutos, ativo
    ) VALUES (
      v_nome, v_nome, 'producao'::public.producao_membro_origem,
      NULLIF(BTRIM(p_apelido), ''), NULLIF(BTRIM(p_funcao), ''),
      p_valor_hora, p_jornada_diaria_minutos, COALESCE(p_ativo, TRUE)
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.producao_membros SET
      nome = v_nome,
      nome_snapshot = v_nome,
      apelido = NULLIF(BTRIM(p_apelido), ''),
      funcao = NULLIF(BTRIM(p_funcao), ''),
      valor_hora = p_valor_hora,
      jornada_diaria_minutos = p_jornada_diaria_minutos,
      ativo = COALESCE(p_ativo, TRUE),
      updated_at = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN RAISE EXCEPTION 'Membro não encontrado'; END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- Preenche snapshots automaticamente, independentemente da versão da RPC de apontamento.
CREATE OR REPLACE FUNCTION public.preencher_snapshots_jornada_apontamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_apontamento public.producao_apontamentos%ROWTYPE;
BEGIN
  SELECT * INTO v_apontamento
  FROM public.producao_apontamentos
  WHERE id = NEW.apontamento_id;

  IF NEW.membro_id IS NOT NULL THEN
    SELECT
      COALESCE(NEW.nome_snapshot, m.nome),
      COALESCE(NEW.valor_hora_snapshot, m.valor_hora),
      COALESCE(NEW.jornada_diaria_minutos_snapshot, m.jornada_diaria_minutos)
    INTO NEW.nome_snapshot, NEW.valor_hora_snapshot, NEW.jornada_diaria_minutos_snapshot
    FROM public.producao_membros m
    WHERE m.id = NEW.membro_id;
  END IF;

  NEW.minutos_produtivos_snapshot := COALESCE(
    NEW.minutos_produtivos_snapshot,
    v_apontamento.minutos_produtivos,
    v_apontamento.duracao_minutos
  );
  NEW.minutos_improdutivos_snapshot := COALESCE(
    NEW.minutos_improdutivos_snapshot,
    v_apontamento.minutos_improdutivos,
    0
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshots_jornada_apontamento
  ON public.producao_apontamento_membros;
CREATE TRIGGER trg_snapshots_jornada_apontamento
BEFORE INSERT OR UPDATE OF membro_id, apontamento_id
ON public.producao_apontamento_membros
FOR EACH ROW EXECUTE FUNCTION public.preencher_snapshots_jornada_apontamento();

CREATE OR REPLACE FUNCTION public.atualizar_jornada_total_apontamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_apontamento UUID := COALESCE(NEW.apontamento_id, OLD.apontamento_id);
BEGIN
  UPDATE public.producao_apontamentos a
  SET jornada_total_equipe_minutos_snapshot = (
    SELECT CASE
      WHEN COUNT(*) FILTER (WHERE pam.jornada_diaria_minutos_snapshot IS NULL) > 0 THEN NULL
      ELSE COALESCE(SUM(pam.jornada_diaria_minutos_snapshot), 0)::INTEGER
    END
    FROM public.producao_apontamento_membros pam
    WHERE pam.apontamento_id = v_apontamento
  )
  WHERE a.id = v_apontamento;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_jornada_total_apontamento
  ON public.producao_apontamento_membros;
CREATE TRIGGER trg_atualizar_jornada_total_apontamento
AFTER INSERT OR UPDATE OR DELETE
ON public.producao_apontamento_membros
FOR EACH ROW EXECUTE FUNCTION public.atualizar_jornada_total_apontamento();

CREATE OR REPLACE FUNCTION public.listar_jornada_producao_gerencial(
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL,
  p_membro_id UUID DEFAULT NULL
)
RETURNS TABLE(
  membro_id UUID,
  membro_nome TEXT,
  data DATE,
  jornada_prevista_minutos INTEGER,
  minutos_apontados INTEGER,
  minutos_produtivos INTEGER,
  minutos_improdutivos INTEGER,
  minutos_sem_apontamento INTEGER,
  minutos_extras INTEGER,
  eficiencia_percentual NUMERIC,
  ocupacao_percentual NUMERIC,
  aproveitamento_percentual NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  WITH base AS (
    SELECT
      pam.membro_id,
      MAX(pam.nome_snapshot) AS membro_nome,
      a.data,
      MAX(pam.jornada_diaria_minutos_snapshot) AS jornada_prevista_minutos,
      SUM(a.duracao_minutos)::INTEGER AS minutos_apontados,
      SUM(COALESCE(pam.minutos_produtivos_snapshot, a.minutos_produtivos, a.duracao_minutos))::INTEGER AS minutos_produtivos,
      SUM(COALESCE(pam.minutos_improdutivos_snapshot, a.minutos_improdutivos, 0))::INTEGER AS minutos_improdutivos
    FROM public.producao_apontamento_membros pam
    JOIN public.producao_apontamentos a ON a.id = pam.apontamento_id
    WHERE a.status <> 'cancelado'
      AND (p_data_inicio IS NULL OR a.data >= p_data_inicio)
      AND (p_data_fim IS NULL OR a.data <= p_data_fim)
      AND (p_membro_id IS NULL OR pam.membro_id = p_membro_id)
    GROUP BY pam.membro_id, a.data
  )
  SELECT
    b.membro_id,
    b.membro_nome,
    b.data,
    b.jornada_prevista_minutos,
    b.minutos_apontados,
    b.minutos_produtivos,
    b.minutos_improdutivos,
    CASE WHEN b.jornada_prevista_minutos IS NULL THEN NULL
         ELSE GREATEST(b.jornada_prevista_minutos - b.minutos_apontados, 0) END::INTEGER,
    CASE WHEN b.jornada_prevista_minutos IS NULL THEN NULL
         ELSE GREATEST(b.minutos_apontados - b.jornada_prevista_minutos, 0) END::INTEGER,
    CASE WHEN b.minutos_apontados > 0 THEN ROUND((b.minutos_produtivos::NUMERIC / b.minutos_apontados) * 100, 2) ELSE 0 END,
    CASE WHEN COALESCE(b.jornada_prevista_minutos, 0) > 0 THEN ROUND((b.minutos_apontados::NUMERIC / b.jornada_prevista_minutos) * 100, 2) ELSE NULL END,
    CASE WHEN COALESCE(b.jornada_prevista_minutos, 0) > 0 THEN ROUND((b.minutos_produtivos::NUMERIC / b.jornada_prevista_minutos) * 100, 2) ELSE NULL END
  FROM base b
  ORDER BY b.data DESC, b.membro_nome;
$$;

REVOKE ALL ON FUNCTION public.salvar_membro_producao(UUID,TEXT,TEXT,TEXT,NUMERIC,INTEGER,BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_jornada_producao_gerencial(DATE,DATE,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_membro_producao(UUID,TEXT,TEXT,TEXT,NUMERIC,INTEGER,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_jornada_producao_gerencial(DATE,DATE,UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
