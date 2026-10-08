-- A situação da Página54 informa o que foi lançado na planilha, mas não é
-- prova de que o agendamento foi efetivado no banco. A confirmação passa a
-- ocorrer somente no módulo de Programação, com registro auditável.
CREATE OR REPLACE FUNCTION public.financeiro_pagina54_status(p_situacao text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := upper(btrim(coalesce(p_situacao, '')));
BEGIN
  IF v = 'PAGO' THEN
    RETURN 'pago';
  ELSIF v IN ('AGENDADO', 'PROGRAMADO', 'PROGRAMAÇÃO', 'PROGRAMACAO', 'AGUARDANDO VENCIMENTO') THEN
    RETURN 'aguardando_vencimento';
  ELSIF v IN ('PREVISÃO', 'PREVISAO') THEN
    RETURN 'previsto';
  ELSIF v = 'CANCELADO' THEN
    RETURN 'cancelado';
  END IF;
  RETURN 'previsto';
END;
$$;

-- Corrige a leitura histórica equivocada que tratou "aguardando vencimento"
-- como confirmação bancária. As programações sintéticas são preservadas no
-- histórico como canceladas, em vez de serem apagadas.
UPDATE public.financeiro_programacoes p
SET status = 'cancelado',
    observacao = coalesce(p.observacao, '') || ' | Cancelada: origem Página54 não comprova agendamento bancário.',
    updated_at = now()
FROM public.financeiro_lancamentos l
WHERE p.lancamento_id = l.id
  AND p.observacao = 'Programação histórica importada da Página54'
  AND l.origem_tipo = 'pagina54'
  AND upper(btrim(coalesce(l.situacao_original, ''))) IN (
    'AGENDADO', 'PROGRAMADO', 'PROGRAMAÇÃO', 'PROGRAMACAO', 'AGUARDANDO VENCIMENTO'
  )
  AND p.status = 'programado';

UPDATE public.financeiro_lancamentos
SET status = 'aguardando_vencimento',
    liberado_programacao_em = NULL,
    liberado_programacao_por_id = NULL,
    liberado_programacao_por_nome = NULL,
    updated_at = now()
WHERE origem_tipo = 'pagina54'
  AND upper(btrim(coalesce(situacao_original, ''))) IN (
    'AGENDADO', 'PROGRAMADO', 'PROGRAMAÇÃO', 'PROGRAMACAO', 'AGUARDANDO VENCIMENTO'
  )
  AND status = 'programado';

-- A programação criada no sistema começa como "aguardando programação".
-- Somente a ação explícita "Confirmar no banco" a torna programada.
CREATE OR REPLACE FUNCTION public.financeiro_validar_programacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_liberado timestamptz;
  v_uid uuid := auth.uid();
  v_nome text;
BEGIN
  SELECT status, liberado_programacao_em
  INTO v_status, v_liberado
  FROM public.financeiro_lancamentos
  WHERE id = NEW.lancamento_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento financeiro não encontrado'; END IF;
  IF v_status IN ('pago', 'conciliado', 'cancelado') THEN
    RAISE EXCEPTION 'Este lançamento já está % e não pode ser programado novamente', v_status;
  END IF;
  IF v_liberado IS NULL THEN
    RAISE EXCEPTION 'Este lançamento ainda não foi liberado pela gestão financeira para programação';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.financeiro_programacoes fp
    WHERE fp.lancamento_id = NEW.lancamento_id
      AND fp.id IS DISTINCT FROM NEW.id
      AND fp.status IN ('aguardando_programacao', 'programado')
  ) THEN
    RAISE EXCEPTION 'Já existe programação ativa para este lançamento';
  END IF;

  v_nome := public.financeiro_usuario_nome(v_uid);
  NEW.registrado_por_id := coalesce(NEW.registrado_por_id, v_uid);
  NEW.registrado_por_nome := coalesce(NEW.registrado_por_nome, v_nome);
  IF NEW.status = 'programado' THEN
    NEW.programado_por_guto_em := coalesce(NEW.programado_por_guto_em, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_refletir_programacao_confirmada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'programado' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'programado') THEN
    UPDATE public.financeiro_lancamentos
    SET status = 'programado', updated_at = now()
    WHERE id = NEW.lancamento_id
      AND status NOT IN ('pago', 'conciliado', 'cancelado');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_refletir_programacao_confirmada ON public.financeiro_programacoes;
CREATE TRIGGER trg_financeiro_refletir_programacao_confirmada
AFTER INSERT OR UPDATE OF status ON public.financeiro_programacoes
FOR EACH ROW EXECUTE FUNCTION public.financeiro_refletir_programacao_confirmada();

-- A conciliação só altera o lançamento quando ela estiver vinculada ao
-- pagamento e explicitamente marcada como conciliada.
CREATE OR REPLACE FUNCTION public.financeiro_refletir_conciliacao_confirmada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.lancamento_id IS NOT NULL AND NEW.tratamento_status = 'conciliado' THEN
    UPDATE public.financeiro_lancamentos
    SET status = 'conciliado',
        data_realizada = coalesce(data_realizada, NEW.data),
        valor_realizado = coalesce(valor_realizado, NEW.valor),
        updated_at = now()
    WHERE id = NEW.lancamento_id
      AND status <> 'cancelado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_refletir_conciliacao_confirmada ON public.financeiro_conciliacoes;
CREATE TRIGGER trg_financeiro_refletir_conciliacao_confirmada
AFTER INSERT OR UPDATE OF tratamento_status, lancamento_id ON public.financeiro_conciliacoes
FOR EACH ROW EXECUTE FUNCTION public.financeiro_refletir_conciliacao_confirmada();

REVOKE ALL ON FUNCTION public.financeiro_refletir_programacao_confirmada() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.financeiro_refletir_conciliacao_confirmada() FROM PUBLIC;
