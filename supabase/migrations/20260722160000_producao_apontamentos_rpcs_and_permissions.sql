-- Segurança, Permissões e RPCs Transacionais do Módulo de Produção

-- 1. Estrutura de Permissões Exclusiva da Produção
CREATE TABLE IF NOT EXISTS public.producao_permissoes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pode_visualizar BOOLEAN NOT NULL DEFAULT false,
  pode_lancar_apontamentos BOOLEAN NOT NULL DEFAULT false,
  pode_gerenciar_processos BOOLEAN NOT NULL DEFAULT false,
  pode_vincular_membros BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.producao_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados podem ler suas próprias permissões de produção"
  ON public.producao_permissoes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Restrição estrita de leitura/escrita via RLS nas tabelas da produção
-- Primeiro revogar políticas abertas genéricas antigas
DO $$
DECLARE
  t_name text;
BEGIN
  FOR t_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'producao_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem visualizar %I" ON public.%I;', t_name, t_name);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem criar %I" ON public.%I;', t_name, t_name);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem atualizar %I" ON public.%I;', t_name, t_name);
    EXECUTE format('DROP POLICY IF EXISTS "Usuários autenticados podem excluir %I" ON public.%I;', t_name, t_name);
  END LOOP;
END
$$;

-- Recriar RLS estrito (apenas visualização caso o usuário possua 'pode_visualizar' ou seja um gestor)
CREATE OR REPLACE FUNCTION public.usuario_pode_visualizar_producao() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.producao_permissoes WHERE user_id = auth.uid() AND (pode_visualizar = true OR pode_gerenciar_processos = true)
  );
$$;

-- Aplicar nas tabelas principais
CREATE POLICY "Permite leitura para quem tem permissao de producao" ON public.producao_projetos FOR SELECT TO authenticated USING (public.usuario_pode_visualizar_producao());
CREATE POLICY "Permite leitura para quem tem permissao de producao" ON public.producao_processos FOR SELECT TO authenticated USING (public.usuario_pode_visualizar_producao());
CREATE POLICY "Permite leitura para quem tem permissao de producao" ON public.producao_apontamentos FOR SELECT TO authenticated USING (public.usuario_pode_visualizar_producao());
CREATE POLICY "Permite leitura para quem tem permissao de producao" ON public.producao_processo_eventos FOR SELECT TO authenticated USING (public.usuario_pode_visualizar_producao());
CREATE POLICY "Permite leitura para quem tem permissao de producao" ON public.producao_apontamento_eventos FOR SELECT TO authenticated USING (public.usuario_pode_visualizar_producao());
CREATE POLICY "Permite leitura para quem tem permissao de producao" ON public.producao_membros FOR SELECT TO authenticated USING (public.usuario_pode_visualizar_producao());

-- 3. Constraint em Apontamentos (Ou processo_id ou projeto_local_id, nunca ambos ou nenhum)
-- Precisamos preencher projeto_local_id com NULL quando processo_id estiver presente para apontamentos antigos ou adaptar a interface.
ALTER TABLE public.producao_apontamentos
  DROP CONSTRAINT IF EXISTS producao_apontamentos_origem_mutuamente_exclusiva;
  
ALTER TABLE public.producao_apontamentos
  ADD CONSTRAINT producao_apontamentos_origem_mutuamente_exclusiva 
  CHECK (
    (processo_id IS NOT NULL AND projeto_local_id IS NULL) OR 
    (processo_id IS NULL AND projeto_local_id IS NOT NULL)
  );

-- 4. Função auxiliar para registrar eventos de processos
CREATE OR REPLACE FUNCTION public.registrar_evento_processo(
  p_processo_id UUID,
  p_tipo_evento TEXT,
  p_status_anterior TEXT,
  p_novo_status TEXT,
  p_usuario_id UUID,
  p_justificativa TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.producao_processo_eventos (
    processo_id, tipo_evento, status_anterior, novo_status, 
    usuario_responsavel_id, nome_usuario_snapshot, justificativa
  ) VALUES (
    p_processo_id, p_tipo_evento, p_status_anterior, p_novo_status,
    p_usuario_id, (SELECT coalesce(raw_user_meta_data->>'name', 'Usuário ' || p_usuario_id) FROM auth.users WHERE id = p_usuario_id), p_justificativa
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.registrar_evento_processo FROM PUBLIC;

-- 5. RPCs Transacionais para Processos
CREATE OR REPLACE FUNCTION public.transicao_processo_producao(
  p_processo_id UUID,
  p_acao TEXT,
  p_justificativa TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_processo RECORD;
  v_user_id UUID := auth.uid();
  v_pode_gerenciar BOOLEAN;
  v_novo_status TEXT;
BEGIN
  SELECT pode_gerenciar_processos INTO v_pode_gerenciar FROM public.producao_permissoes WHERE user_id = v_user_id;
  IF NOT COALESCE(v_pode_gerenciar, false) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT * INTO v_processo FROM public.producao_processos WHERE id = p_processo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;

  IF p_acao = 'iniciar' THEN
    IF v_processo.status <> 'planejado' THEN RAISE EXCEPTION 'Apenas processos planejados podem ser iniciados'; END IF;
    v_novo_status := 'em_andamento';
    UPDATE public.producao_processos SET status = v_novo_status, data_inicio_real = CURRENT_DATE, updated_at = now() WHERE id = p_processo_id;
  
  ELSIF p_acao = 'pausar' THEN
    IF v_processo.status <> 'em_andamento' THEN RAISE EXCEPTION 'Apenas processos em andamento podem ser pausados'; END IF;
    IF p_justificativa IS NULL THEN RAISE EXCEPTION 'Justificativa obrigatória para pausa'; END IF;
    v_novo_status := 'pausado';
    UPDATE public.producao_processos SET status = v_novo_status, motivo_pausa = p_justificativa, updated_at = now() WHERE id = p_processo_id;

  ELSIF p_acao = 'retomar' THEN
    IF v_processo.status NOT IN ('pausado', 'bloqueado') THEN RAISE EXCEPTION 'Processo não está pausado ou bloqueado'; END IF;
    v_novo_status := 'em_andamento';
    UPDATE public.producao_processos SET status = v_novo_status, updated_at = now() WHERE id = p_processo_id;

  ELSIF p_acao = 'bloquear' THEN
    IF v_processo.status <> 'em_andamento' THEN RAISE EXCEPTION 'Apenas processos em andamento podem ser bloqueados'; END IF;
    IF p_justificativa IS NULL THEN RAISE EXCEPTION 'Justificativa obrigatória para bloqueio'; END IF;
    v_novo_status := 'bloqueado';
    UPDATE public.producao_processos SET status = v_novo_status, motivo_bloqueio = p_justificativa, updated_at = now() WHERE id = p_processo_id;

  ELSIF p_acao = 'finalizar' THEN
    IF v_processo.status <> 'em_andamento' THEN RAISE EXCEPTION 'Apenas processos em andamento podem ser finalizados'; END IF;
    v_novo_status := 'finalizado';
    UPDATE public.producao_processos SET status = v_novo_status, data_fim_real = CURRENT_DATE, finalizado_por_id = v_user_id, finalizado_em = now(), updated_at = now() WHERE id = p_processo_id;

  ELSIF p_acao = 'cancelar' THEN
    IF v_processo.status IN ('finalizado', 'cancelado') THEN RAISE EXCEPTION 'Processo já encerrado'; END IF;
    IF p_justificativa IS NULL THEN RAISE EXCEPTION 'Justificativa obrigatória para cancelamento'; END IF;
    v_novo_status := 'cancelado';
    UPDATE public.producao_processos SET status = v_novo_status, motivo_cancelamento = p_justificativa, cancelado_por_id = v_user_id, cancelado_em = now(), updated_at = now() WHERE id = p_processo_id;

  ELSIF p_acao = 'reabrir' THEN
    IF v_processo.status NOT IN ('finalizado', 'cancelado') THEN RAISE EXCEPTION 'Processo não está encerrado'; END IF;
    IF p_justificativa IS NULL THEN RAISE EXCEPTION 'Justificativa obrigatória para reabertura'; END IF;
    v_novo_status := 'em_andamento';
    UPDATE public.producao_processos SET status = v_novo_status, updated_at = now() WHERE id = p_processo_id;
  
  ELSE
    RAISE EXCEPTION 'Ação desconhecida';
  END IF;

  PERFORM public.registrar_evento_processo(p_processo_id, p_acao, v_processo.status, v_novo_status, v_user_id, p_justificativa);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.transicao_processo_producao FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transicao_processo_producao TO authenticated;

-- 6. RPC para Apontamentos
CREATE OR REPLACE FUNCTION public.criar_apontamento_producao(
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
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pode_lancar BOOLEAN;
  v_processo RECORD;
  v_apontamento_id UUID;
  v_membro_id UUID;
BEGIN
  SELECT pode_lancar_apontamentos INTO v_pode_lancar FROM public.producao_permissoes WHERE user_id = v_user_id;
  IF NOT COALESCE(v_pode_lancar, false) THEN RAISE EXCEPTION 'Sem permissão para lançar apontamentos'; END IF;

  IF p_processo_id IS NOT NULL THEN
    SELECT * INTO v_processo FROM public.producao_processos WHERE id = p_processo_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;
    IF v_processo.status <> 'em_andamento' THEN RAISE EXCEPTION 'Processo não está em andamento (status atual: %)', v_processo.status; END IF;
  END IF;

  IF (p_processo_id IS NOT NULL AND p_projeto_local_id IS NOT NULL) OR (p_processo_id IS NULL AND p_projeto_local_id IS NULL) THEN
    RAISE EXCEPTION 'O apontamento deve ter ou processo_id ou projeto_local_id, nunca ambos nem nenhum';
  END IF;

  INSERT INTO public.producao_apontamentos (
    data, processo_id, projeto_local_id, tarefa_id, local_tipo, 
    quantidade_produzida, inicio, termino, duracao_minutos,
    minutos_produtivos, minutos_improdutivos, motivo_improdutivo, observacoes, criado_por_id
  ) VALUES (
    CURRENT_DATE, p_processo_id, p_projeto_local_id, p_tarefa_id, p_local_tipo,
    p_quantidade_produzida, p_inicio, p_termino, p_duracao_minutos,
    p_minutos_produtivos, p_minutos_improdutivos, p_motivo_improdutivo, p_observacoes, v_user_id
  ) RETURNING id INTO v_apontamento_id;

  FOREACH v_membro_id IN ARRAY p_membros
  LOOP
    INSERT INTO public.producao_apontamento_membros (apontamento_id, membro_id) VALUES (v_apontamento_id, v_membro_id);
  END LOOP;

  INSERT INTO public.producao_apontamento_eventos (
    apontamento_id, evento, usuario_id, nome_usuario_snapshot
  ) VALUES (
    v_apontamento_id, 'criacao', v_user_id, (SELECT coalesce(raw_user_meta_data->>'name', 'Usuário ' || v_user_id) FROM auth.users WHERE id = v_user_id)
  );

  RETURN v_apontamento_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.criar_apontamento_producao FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_apontamento_producao TO authenticated;
