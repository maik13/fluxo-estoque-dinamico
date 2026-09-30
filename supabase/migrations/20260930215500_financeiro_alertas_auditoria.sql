
BEGIN;

ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS liberado_programacao_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS liberado_programacao_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS liberado_programacao_por_nome TEXT NULL;

ALTER TABLE public.financeiro_programacoes
  ADD COLUMN IF NOT EXISTS registrado_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS registrado_por_nome TEXT NULL;

ALTER TABLE public.financeiro_conciliacoes
  ADD COLUMN IF NOT EXISTS registrado_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS registrado_por_nome TEXT NULL;

CREATE TABLE IF NOT EXISTS public.financeiro_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  lancamento_id UUID NULL,
  acao TEXT NOT NULL,
  usuario_id UUID NULL,
  usuario_nome TEXT NULL,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financeiro_auditoria_lancamento_idx
  ON public.financeiro_auditoria(lancamento_id, created_at DESC);

CREATE INDEX IF NOT EXISTS financeiro_auditoria_entidade_idx
  ON public.financeiro_auditoria(entidade, entidade_id, created_at DESC);

ALTER TABLE public.financeiro_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_auditoria_select ON public.financeiro_auditoria;
CREATE POLICY fin_auditoria_select ON public.financeiro_auditoria
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro')
);

CREATE OR REPLACE FUNCTION public.financeiro_usuario_nome(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT nome FROM public.profiles WHERE user_id=p_user_id LIMIT 1),
    (SELECT email FROM auth.users WHERE id=p_user_id LIMIT 1),
    'Usuário'
  );
$$;

CREATE OR REPLACE FUNCTION public.financeiro_registrar_auditoria(
  p_entidade TEXT,
  p_entidade_id UUID,
  p_lancamento_id UUID,
  p_acao TEXT,
  p_detalhes JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_nome TEXT;
BEGIN
  v_nome := public.financeiro_usuario_nome(v_uid);
  INSERT INTO public.financeiro_auditoria(
    entidade, entidade_id, lancamento_id, acao,
    usuario_id, usuario_nome, detalhes
  ) VALUES (
    p_entidade, p_entidade_id, p_lancamento_id, p_acao,
    v_uid, v_nome, COALESCE(p_detalhes,'{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_liberar_programacao(p_lancamento_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_nome TEXT;
  v_status TEXT;
  v_tipo TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_admin()
     AND NOT public.permissao_individual_efetiva(v_uid,'pode_gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para liberar programação financeira';
  END IF;

  SELECT status,tipo INTO v_status,v_tipo
  FROM public.financeiro_lancamentos
  WHERE id=p_lancamento_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado'; END IF;
  IF v_tipo <> 'saida' THEN RAISE EXCEPTION 'Somente saídas podem ser liberadas para programação'; END IF;
  IF v_status IN ('pago','conciliado','cancelado') THEN
    RAISE EXCEPTION 'Lançamento já encerrado e não pode ser liberado para programação';
  END IF;

  v_nome := public.financeiro_usuario_nome(v_uid);

  UPDATE public.financeiro_lancamentos
  SET liberado_programacao_em=now(),
      liberado_programacao_por_id=v_uid,
      liberado_programacao_por_nome=v_nome,
      updated_at=now()
  WHERE id=p_lancamento_id;

  PERFORM public.financeiro_registrar_auditoria(
    'lancamento', p_lancamento_id, p_lancamento_id,
    'liberado_programacao',
    jsonb_build_object('status',v_status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_liberar_programacao(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.financeiro_liberar_programacao(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_validar_programacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status TEXT;
  v_liberado TIMESTAMPTZ;
  v_uid UUID := auth.uid();
  v_nome TEXT;
BEGIN
  SELECT status, liberado_programacao_em
  INTO v_status, v_liberado
  FROM public.financeiro_lancamentos
  WHERE id=NEW.lancamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento financeiro não encontrado';
  END IF;

  IF v_status IN ('pago','conciliado','cancelado') THEN
    RAISE EXCEPTION 'Este lançamento já está % e não pode ser programado novamente', v_status;
  END IF;

  IF v_liberado IS NULL THEN
    RAISE EXCEPTION 'Este lançamento ainda não foi liberado pela gestão financeira para programação';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_programacoes fp
    WHERE fp.lancamento_id=NEW.lancamento_id
      AND fp.id IS DISTINCT FROM NEW.id
      AND fp.status IN ('aguardando_programacao','programado')
  ) THEN
    RAISE EXCEPTION 'Já existe programação ativa para este lançamento';
  END IF;

  v_nome := public.financeiro_usuario_nome(v_uid);
  NEW.registrado_por_id := COALESCE(NEW.registrado_por_id,v_uid);
  NEW.registrado_por_nome := COALESCE(NEW.registrado_por_nome,v_nome);
  NEW.programado_por_guto_em := COALESCE(NEW.programado_por_guto_em,now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_validar_programacao ON public.financeiro_programacoes;
CREATE TRIGGER trg_financeiro_validar_programacao
BEFORE INSERT OR UPDATE ON public.financeiro_programacoes
FOR EACH ROW EXECUTE FUNCTION public.financeiro_validar_programacao();

CREATE OR REPLACE FUNCTION public.financeiro_validar_conciliacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_nome TEXT;
BEGIN
  IF NEW.estava_previsto = false THEN
    IF NULLIF(btrim(COALESCE(NEW.tratamento_observacao,'')),'') IS NULL THEN
      RAISE EXCEPTION 'Movimentação não prevista exige justificativa/tratamento';
    END IF;
    IF NULLIF(btrim(COALESCE(NEW.responsavel_regularizacao,'')),'') IS NULL THEN
      RAISE EXCEPTION 'Movimentação não prevista exige responsável pela regularização';
    END IF;
    IF NEW.prazo_regularizacao IS NULL THEN
      RAISE EXCEPTION 'Movimentação não prevista exige prazo de regularização';
    END IF;
  END IF;

  v_nome := public.financeiro_usuario_nome(v_uid);
  NEW.registrado_por_id := COALESCE(NEW.registrado_por_id,v_uid);
  NEW.registrado_por_nome := COALESCE(NEW.registrado_por_nome,v_nome);
  NEW.conciliado_por := COALESCE(NEW.conciliado_por,v_uid);
  NEW.conciliado_em := COALESCE(NEW.conciliado_em,CASE WHEN NEW.tratamento_status='conciliado' THEN now() ELSE NULL END);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_validar_conciliacao ON public.financeiro_conciliacoes;
CREATE TRIGGER trg_financeiro_validar_conciliacao
BEFORE INSERT OR UPDATE ON public.financeiro_conciliacoes
FOR EACH ROW EXECUTE FUNCTION public.financeiro_validar_conciliacao();

CREATE OR REPLACE FUNCTION public.financeiro_auditar_programacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.financeiro_registrar_auditoria(
    'programacao', NEW.id, NEW.lancamento_id,
    CASE WHEN TG_OP='INSERT' THEN 'programacao_registrada' ELSE 'programacao_atualizada' END,
    jsonb_build_object('status',NEW.status,'valor',NEW.valor,'data_programada',NEW.data_programada)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_auditar_programacao ON public.financeiro_programacoes;
CREATE TRIGGER trg_financeiro_auditar_programacao
AFTER INSERT OR UPDATE ON public.financeiro_programacoes
FOR EACH ROW EXECUTE FUNCTION public.financeiro_auditar_programacao();

CREATE OR REPLACE FUNCTION public.financeiro_auditar_conciliacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.financeiro_registrar_auditoria(
    'conciliacao', NEW.id, NEW.lancamento_id,
    CASE
      WHEN TG_OP='INSERT' AND NEW.estava_previsto=false THEN 'movimentacao_nao_prevista'
      WHEN TG_OP='INSERT' THEN 'conciliacao_registrada'
      ELSE 'conciliacao_atualizada'
    END,
    jsonb_build_object(
      'tratamento_status',NEW.tratamento_status,
      'valor',NEW.valor,
      'estava_previsto',NEW.estava_previsto,
      'responsavel_regularizacao',NEW.responsavel_regularizacao,
      'prazo_regularizacao',NEW.prazo_regularizacao
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_auditar_conciliacao ON public.financeiro_conciliacoes;
CREATE TRIGGER trg_financeiro_auditar_conciliacao
AFTER INSERT OR UPDATE ON public.financeiro_conciliacoes
FOR EACH ROW EXECUTE FUNCTION public.financeiro_auditar_conciliacao();

CREATE OR REPLACE FUNCTION public.financeiro_auditar_lancamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.financeiro_registrar_auditoria(
      'lancamento',NEW.id,NEW.id,'lancamento_criado',
      jsonb_build_object('status',NEW.status,'valor_previsto',NEW.valor_previsto,'valor_realizado',NEW.valor_realizado)
    );
  ELSIF (OLD.status,OLD.valor_previsto,OLD.valor_realizado,OLD.data_prevista,OLD.data_realizada)
        IS DISTINCT FROM
        (NEW.status,NEW.valor_previsto,NEW.valor_realizado,NEW.data_prevista,NEW.data_realizada) THEN
    PERFORM public.financeiro_registrar_auditoria(
      'lancamento',NEW.id,NEW.id,'lancamento_atualizado',
      jsonb_build_object(
        'status_anterior',OLD.status,'status_novo',NEW.status,
        'valor_previsto_anterior',OLD.valor_previsto,'valor_previsto_novo',NEW.valor_previsto,
        'valor_realizado_anterior',OLD.valor_realizado,'valor_realizado_novo',NEW.valor_realizado
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_auditar_lancamento ON public.financeiro_lancamentos;
CREATE TRIGGER trg_financeiro_auditar_lancamento
AFTER INSERT OR UPDATE ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.financeiro_auditar_lancamento();

COMMIT;
