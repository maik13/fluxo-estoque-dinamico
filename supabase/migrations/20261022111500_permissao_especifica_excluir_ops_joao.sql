BEGIN;

ALTER TABLE public.usuario_permissoes_individuais
  DROP CONSTRAINT usuario_permissoes_individuais_permissao_valida;
ALTER TABLE public.usuario_permissoes_individuais
  ADD CONSTRAINT usuario_permissoes_individuais_permissao_valida CHECK (
    permissao = ANY (ARRAY[
      'pode_cadastrar_itens','pode_editar_itens','pode_excluir_itens','pode_registrar_movimentacoes',
      'pode_solicitar_material','pode_devolver_material','pode_registrar_entrada','pode_registrar_saida',
      'pode_transferir','pode_editar_movimentacoes','pode_solicitacao_material','pode_pedido_compra',
      'pode_apontar_producao','pode_conferir_producao','pode_ver_bi_producao','pode_configurar_producao',
      'pode_excluir_ops','pode_gerenciar_configuracoes','pode_gerenciar_usuarios','pode_ver_relatorios',
      'pode_acessar_gerencial','pode_acessar_projetos','pode_acessar_financeiro','pode_gerenciar_financeiro',
      'pode_aprovar_financeiro','pode_programar_financeiro','pode_conciliar_financeiro',
      'pode_ver_relatorios_financeiro','rh_acessar','rh_colaboradores_visualizar','rh_colaboradores_gerenciar',
      'rh_jornadas_gerenciar','rh_feriados_gerenciar','ponto_registrar','ponto_visualizar','ponto_gerenciar',
      'ponto_aprovar','planejamento2_acessar','acompanhamento_acessar','imagens_op_acessar','orcamento_solicitar'
    ])
  );

DO $$
DECLARE
  v_user_id uuid;
  v_estado_anterior text;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE lower(email) = 'jr84@me.com'
    AND nome = 'João Ricardo Maia da rocha'
    AND ativo = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Cadastro ativo de João Ricardo Maia da rocha não encontrado';
  END IF;

  SELECT efeito INTO v_estado_anterior
  FROM public.usuario_permissoes_individuais
  WHERE user_id = v_user_id AND permissao = 'pode_excluir_ops';

  INSERT INTO public.usuario_permissoes_individuais (user_id, permissao, efeito)
  VALUES (v_user_id, 'pode_excluir_ops', 'permitir')
  ON CONFLICT (user_id, permissao) DO UPDATE
  SET efeito = 'permitir', updated_at = now();

  IF v_estado_anterior IS DISTINCT FROM 'permitir' THEN
    INSERT INTO public.usuario_permissoes_individuais_auditoria (
      user_id, permissao, estado_anterior, estado_novo, alterado_por_nome
    ) VALUES (
      v_user_id, 'pode_excluir_ops', coalesce(v_estado_anterior, 'herdar'), 'permitir',
      'Migração autorizada - liberação específica para excluir OPs'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.usuario_pode_excluir_op_v1()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.permissao_individual_efetiva(auth.uid(), 'pode_excluir_ops')
    OR public.usuario_tem_permissao_producao('processos')
  );
$$;

REVOKE ALL ON FUNCTION public.usuario_pode_excluir_op_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuario_pode_excluir_op_v1() TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_ordem_producao_v1(
  p_ordem_producao_id uuid,
  p_justificativa text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_nome text;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_ativos integer;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_pode_excluir_op_v1() THEN
    RAISE EXCEPTION 'Sem permissão para excluir Ordens de Produção';
  END IF;
  IF btrim(coalesce(p_justificativa, '')) = '' THEN
    RAISE EXCEPTION 'A justificativa é obrigatória';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de Produção não encontrada'; END IF;
  IF v_op.status IN ('concluida', 'cancelada') THEN RAISE EXCEPTION 'A OP já está encerrada'; END IF;

  SELECT count(*) INTO v_ativos
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id = v_op.id AND a.status <> 'cancelado';
  IF v_ativos > 0 THEN RAISE EXCEPTION 'Cancele os apontamentos da OP antes de excluí-la'; END IF;

  v_nome := public.nome_usuario_producao(v_user);
  UPDATE public.producao_ordens_producao
  SET status = 'cancelada',
      motivo_cancelamento = btrim(p_justificativa),
      atualizado_por_id = v_user,
      atualizado_por_nome_snapshot = v_nome,
      updated_at = now()
  WHERE id = v_op.id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, status_anterior, novo_status,
    usuario_id, nome_usuario_snapshot, justificativa
  ) VALUES (
    v_op.id, 'cancelar', v_op.status, 'cancelada',
    v_user, v_nome, btrim(p_justificativa)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_ordem_producao_v1(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_ordem_producao_v1(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
