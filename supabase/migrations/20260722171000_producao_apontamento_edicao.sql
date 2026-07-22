BEGIN;

CREATE OR REPLACE FUNCTION public.editar_apontamento_producao(
  p_apontamento_id UUID,
  p_data DATE,
  p_processo_id UUID,
  p_projeto_local_id UUID,
  p_tarefa_id UUID,
  p_local_tipo TEXT,
  p_quantidade_produzida NUMERIC,
  p_inicio TIME,
  p_termino TIME,
  p_duracao_minutos INTEGER,
  p_minutos_produtivos INTEGER,
  p_minutos_improdutivos INTEGER,
  p_motivo_improdutivo TEXT,
  p_observacoes TEXT,
  p_membros UUID[]
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_atual public.producao_apontamentos%ROWTYPE;
  v_membro RECORD;
  v_antes JSONB;
  v_depois JSONB;
BEGIN
  IF NOT public.usuario_tem_permissao_producao('editar_apontamento') THEN
    RAISE EXCEPTION 'Sem permissão para editar apontamentos';
  END IF;

  SELECT * INTO v_atual
  FROM public.producao_apontamentos
  WHERE id = p_apontamento_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Apontamento não encontrado'; END IF;
  IF v_atual.status <> 'lancado' THEN RAISE EXCEPTION 'Somente apontamento lançado pode ser editado'; END IF;
  IF num_nonnulls(p_processo_id, p_projeto_local_id) <> 1 THEN RAISE EXCEPTION 'Informe processo ou projeto/local'; END IF;
  IF p_termino <= p_inicio OR p_duracao_minutos <= 0 THEN RAISE EXCEPTION 'Horário inválido'; END IF;
  IF p_minutos_produtivos + p_minutos_improdutivos <> p_duracao_minutos THEN RAISE EXCEPTION 'Tempos não fecham'; END IF;
  IF p_minutos_improdutivos > 0 AND btrim(COALESCE(p_motivo_improdutivo, '')) = '' THEN
    RAISE EXCEPTION 'Motivo improdutivo obrigatório';
  END IF;
  IF COALESCE(array_length(p_membros, 1), 0) = 0 THEN RAISE EXCEPTION 'Informe membros'; END IF;

  IF p_processo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.producao_processos
    WHERE id = p_processo_id AND status = 'em_andamento'
  ) THEN
    RAISE EXCEPTION 'Processo não está em andamento';
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome FROM auth.users WHERE id = v_user;

  v_antes := to_jsonb(v_atual) - 'updated_at';

  UPDATE public.producao_apontamentos SET
    data = p_data,
    processo_id = p_processo_id,
    projeto_local_id = p_projeto_local_id,
    tarefa_id = p_tarefa_id,
    local_tipo = p_local_tipo,
    quantidade_produzida = p_quantidade_produzida,
    inicio = p_inicio,
    termino = p_termino,
    duracao_minutos = p_duracao_minutos,
    minutos_produtivos = p_minutos_produtivos,
    minutos_improdutivos = p_minutos_improdutivos,
    motivo_improdutivo = NULLIF(btrim(p_motivo_improdutivo), ''),
    observacoes = NULLIF(btrim(p_observacoes), ''),
    ultima_edicao_por_id = v_user,
    ultima_edicao_por_nome_snapshot = v_nome,
    ultima_edicao_em = now(),
    updated_at = now()
  WHERE id = p_apontamento_id;

  DELETE FROM public.producao_apontamento_membros
  WHERE apontamento_id = p_apontamento_id;

  FOR v_membro IN
    SELECT id, nome, valor_hora
    FROM public.producao_membros
    WHERE id = ANY(p_membros) AND ativo = true
  LOOP
    INSERT INTO public.producao_apontamento_membros(
      apontamento_id, membro_id, nome_snapshot, valor_hora_snapshot
    ) VALUES (
      p_apontamento_id, v_membro.id, v_membro.nome, v_membro.valor_hora
    );
  END LOOP;

  IF (SELECT count(*) FROM public.producao_apontamento_membros WHERE apontamento_id = p_apontamento_id)
     <> cardinality(p_membros) THEN
    RAISE EXCEPTION 'Um ou mais membros são inválidos ou inativos';
  END IF;

  SELECT to_jsonb(a) - 'updated_at' INTO v_depois
  FROM public.producao_apontamentos a WHERE a.id = p_apontamento_id;

  INSERT INTO public.producao_apontamento_eventos(
    apontamento_id, evento, usuario_id, nome_usuario_snapshot,
    valor_anterior, valor_novo
  ) VALUES (
    p_apontamento_id, 'edicao', v_user, v_nome,
    v_antes::TEXT, v_depois::TEXT
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.editar_apontamento_producao(
  UUID, DATE, UUID, UUID, UUID, TEXT, NUMERIC, TIME, TIME, INTEGER,
  INTEGER, INTEGER, TEXT, TEXT, UUID[]
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_apontamento_producao(
  UUID, DATE, UUID, UUID, UUID, TEXT, NUMERIC, TIME, TIME, INTEGER,
  INTEGER, INTEGER, TEXT, TEXT, UUID[]
) TO authenticated;

COMMIT;
