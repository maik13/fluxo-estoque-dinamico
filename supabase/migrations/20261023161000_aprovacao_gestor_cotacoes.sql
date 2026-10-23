BEGIN;

ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS aprovacao_status text,
  ADD COLUMN IF NOT EXISTS aprovacao_solicitada_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovacao_solicitada_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovacao_justificativa text;

ALTER TABLE public.cotacoes DROP CONSTRAINT IF EXISTS cotacoes_aprovacao_status_check;
ALTER TABLE public.cotacoes ADD CONSTRAINT cotacoes_aprovacao_status_check
  CHECK (aprovacao_status IS NULL OR aprovacao_status IN ('pendente', 'aprovada', 'rejeitada'));

CREATE OR REPLACE FUNCTION public.cotacao_solicitar_aprovacao_v1(p_cotacao_id uuid)
RETURNS public.cotacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_result public.cotacoes%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT (
    public.is_gestor_or_admin()
    OR public.permissao_individual_efetiva(v_user, 'pode_pedido_compra')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = v_user AND COALESCE(p.ativo, true) AND p.tipo_usuario = 'estoquista'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para enviar cotação para aprovação';
  END IF;

  UPDATE public.cotacoes c
  SET aprovacao_status = 'pendente',
      aprovacao_solicitada_por = v_user,
      aprovacao_solicitada_em = now(),
      aprovado_por = NULL,
      aprovado_em = NULL,
      aprovacao_justificativa = NULL,
      updated_at = now()
  WHERE c.id = p_cotacao_id
    AND c.status = 'escolhida'
    AND c.financeiro_necessidade_id IS NULL
  RETURNING c.* INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Somente a proposta escolhida e ainda não convertida pode ser enviada para aprovação';
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cotacao_decidir_aprovacao_v1(
  p_cotacao_id uuid,
  p_aprovar boolean,
  p_justificativa text DEFAULT NULL
)
RETURNS public.cotacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_result public.cotacoes%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.is_gestor_or_admin() THEN
    RAISE EXCEPTION 'Somente gestor ou administrador pode aprovar ou rejeitar um orçamento';
  END IF;
  IF NOT p_aprovar AND NULLIF(btrim(COALESCE(p_justificativa, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição';
  END IF;

  UPDATE public.cotacoes c
  SET aprovacao_status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'rejeitada' END,
      aprovado_por = v_user,
      aprovado_em = now(),
      aprovacao_justificativa = NULLIF(btrim(COALESCE(p_justificativa, '')), ''),
      updated_at = now()
  WHERE c.id = p_cotacao_id
    AND c.aprovacao_status = 'pendente'
    AND c.status = 'escolhida'
    AND c.financeiro_necessidade_id IS NULL
  RETURNING c.* INTO v_result;

  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não está aguardando aprovação'; END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cotacao_bloquear_pn_sem_aprovacao_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (NEW.status = 'convertida_pn' OR NEW.financeiro_necessidade_id IS NOT NULL)
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.financeiro_necessidade_id IS DISTINCT FROM NEW.financeiro_necessidade_id)
     AND NEW.aprovacao_status IS DISTINCT FROM 'aprovada' THEN
    RAISE EXCEPTION 'Orçamento precisa ser aprovado pelo gestor antes de virar PN';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotacao_bloquear_pn_sem_aprovacao ON public.cotacoes;
CREATE TRIGGER trg_cotacao_bloquear_pn_sem_aprovacao
BEFORE UPDATE OF status, financeiro_necessidade_id ON public.cotacoes
FOR EACH ROW EXECUTE FUNCTION public.cotacao_bloquear_pn_sem_aprovacao_v1();

REVOKE ALL ON FUNCTION public.cotacao_solicitar_aprovacao_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cotacao_decidir_aprovacao_v1(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotacao_solicitar_aprovacao_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cotacao_decidir_aprovacao_v1(uuid, boolean, text) TO authenticated;

COMMIT;
