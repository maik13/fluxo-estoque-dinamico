BEGIN;

CREATE OR REPLACE FUNCTION public.rh_atualizar_status_ponto(
  p_registro_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status text := lower(btrim(coalesce(p_status,'')));
  v_registro public.rh_registros_ponto%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.permissao_individual_efetiva(v_user_id,'ponto_aprovar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para aprovar ou rejeitar ponto';
  END IF;
  IF v_status NOT IN ('aprovado','rejeitado','pendente') THEN
    RAISE EXCEPTION 'Status de ponto inválido';
  END IF;

  UPDATE public.rh_registros_ponto
  SET status=v_status,
      aprovado_por=CASE WHEN v_status IN ('aprovado','rejeitado') THEN v_user_id ELSE NULL END,
      aprovado_em=CASE WHEN v_status IN ('aprovado','rejeitado') THEN clock_timestamp() ELSE NULL END
  WHERE id=p_registro_id
  RETURNING * INTO v_registro;

  IF v_registro.id IS NULL THEN RAISE EXCEPTION 'Registro de ponto não encontrado'; END IF;

  RETURN jsonb_build_object(
    'id',v_registro.id,
    'status',v_registro.status,
    'aprovado_por',v_registro.aprovado_por,
    'aprovado_em',v_registro.aprovado_em
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rh_atualizar_status_ponto(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_atualizar_status_ponto(uuid,text) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
