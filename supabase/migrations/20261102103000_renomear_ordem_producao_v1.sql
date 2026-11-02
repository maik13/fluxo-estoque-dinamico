BEGIN;

CREATE OR REPLACE FUNCTION public.renomear_ordem_producao_v1(
  p_ordem_producao_id UUID,
  p_novo_nome TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_usuario_nome TEXT;
  v_novo_nome TEXT := REGEXP_REPLACE(BTRIM(COALESCE(p_novo_nome, '')), '\s+', ' ', 'g');
  v_op public.producao_ordens_producao%ROWTYPE;
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para renomear Ordens de Produção';
  END IF;

  IF v_novo_nome = '' THEN
    RAISE EXCEPTION 'Informe o novo nome da OP';
  END IF;

  IF CHAR_LENGTH(v_novo_nome) > 200 THEN
    RAISE EXCEPTION 'O nome da OP deve ter no máximo 200 caracteres';
  END IF;

  SELECT *
    INTO v_op
    FROM public.producao_ordens_producao
   WHERE id = p_ordem_producao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_novo_nome = BTRIM(COALESCE(v_op.tarefa_nome_snapshot, '')) THEN
    RETURN;
  END IF;

  v_usuario_nome := public.nome_usuario_producao(v_user);

  UPDATE public.producao_ordens_producao
     SET tarefa_nome_snapshot = v_novo_nome,
         atualizado_por_id = v_user,
         atualizado_por_nome_snapshot = v_usuario_nome,
         updated_at = NOW()
   WHERE id = v_op.id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id,
    evento,
    status_anterior,
    novo_status,
    usuario_id,
    nome_usuario_snapshot,
    justificativa,
    dados
  ) VALUES (
    v_op.id,
    'op_renomeada_v1',
    v_op.status,
    v_op.status,
    v_user,
    v_usuario_nome,
    'Alteração do nome exibido da OP',
    jsonb_build_object(
      'nome_anterior', v_op.tarefa_nome_snapshot,
      'nome_novo', v_novo_nome,
      'tarefa_id_preservada', v_op.tarefa_id,
      'processo_id_preservado', v_op.processo_id,
      'projeto_id_preservado', v_op.projeto_id,
      'versao_rpc', 1
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.renomear_ordem_producao_v1(UUID, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.renomear_ordem_producao_v1(UUID, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.renomear_ordem_producao_v1(UUID, TEXT) IS
  'Altera somente o nome exibido da OP, preservando número, tarefa vinculada, projeto, etapa e apontamentos, com auditoria.';

NOTIFY pgrst, 'reload schema';

COMMIT;
