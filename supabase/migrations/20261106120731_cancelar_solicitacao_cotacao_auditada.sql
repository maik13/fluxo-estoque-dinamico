BEGIN;

CREATE OR REPLACE FUNCTION public.cotacao_cancelar_solicitacao_v1(
  p_solicitacao_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_solicitacao public.cotacao_solicitacoes%ROWTYPE;
  v_pode_gerenciar boolean := false;
  v_cotacoes_vinculadas integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT *
  INTO v_solicitacao
  FROM public.cotacao_solicitacoes s
  WHERE s.id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  v_pode_gerenciar :=
    public.is_admin()
    OR public.permissao_individual_efetiva(v_user, 'pode_pedido_compra')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = v_user
        AND p.ativo = true
        AND p.tipo_usuario = 'estoquista'
    )
    OR (
      v_solicitacao.criado_por = v_user
      AND v_solicitacao.status = 'solicitada'
    );

  IF NOT v_pode_gerenciar THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta solicitação';
  END IF;

  IF v_solicitacao.status = 'cancelada' THEN
    RETURN jsonb_build_object(
      'solicitacao_id', v_solicitacao.id,
      'status', v_solicitacao.status,
      'ja_cancelada', true
    );
  END IF;

  IF v_solicitacao.status = 'encerrada' THEN
    RAISE EXCEPTION 'Uma solicitação encerrada não pode ser excluída';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cotacao_solicitacoes_vinculos v
    JOIN public.cotacoes c ON c.id = v.cotacao_id
    WHERE v.solicitacao_id = p_solicitacao_id
      AND (
        c.financeiro_necessidade_id IS NOT NULL
        OR c.status = 'convertida_pn'
      )
  ) THEN
    RAISE EXCEPTION 'A solicitação já possui PN vinculada e deve permanecer no histórico';
  END IF;

  SELECT count(*)::integer
  INTO v_cotacoes_vinculadas
  FROM public.cotacao_solicitacoes_vinculos v
  WHERE v.solicitacao_id = p_solicitacao_id;

  UPDATE public.cotacao_solicitacoes
  SET status = 'cancelada',
      updated_at = now()
  WHERE id = p_solicitacao_id;

  INSERT INTO public.cotacao_fluxo_auditoria(
    solicitacao_id,
    evento,
    status_anterior,
    status_novo,
    detalhes,
    criado_por
  ) VALUES (
    p_solicitacao_id,
    'solicitacao_cancelada',
    v_solicitacao.status,
    'cancelada',
    jsonb_build_object(
      'numero', v_solicitacao.numero,
      'titulo', v_solicitacao.titulo,
      'motivo', NULLIF(btrim(coalesce(p_motivo, '')), ''),
      'cotacoes_vinculadas', v_cotacoes_vinculadas,
      'exclusao_logica', true
    ),
    v_user
  );

  RETURN jsonb_build_object(
    'solicitacao_id', p_solicitacao_id,
    'status', 'cancelada',
    'cotacoes_vinculadas', v_cotacoes_vinculadas,
    'auditado', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cotacao_cancelar_solicitacao_v1(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cotacao_cancelar_solicitacao_v1(uuid, text)
  TO authenticated;

COMMENT ON FUNCTION public.cotacao_cancelar_solicitacao_v1(uuid, text) IS
  'Cancela (exclusão lógica) uma solicitação de cotação, preservando vínculos e auditoria.';

COMMIT;
