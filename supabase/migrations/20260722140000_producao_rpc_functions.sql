-- Funções Transacionais para o Módulo de Produção

CREATE OR REPLACE FUNCTION public.iniciar_processo_producao(
  p_processo_id UUID,
  p_usuario_id UUID,
  p_nome_usuario TEXT,
  p_justificativa TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_status_atual TEXT;
BEGIN
  -- Validar status atual
  SELECT status INTO v_status_atual FROM public.producao_processos WHERE id = p_processo_id;
  
  IF v_status_atual <> 'planejado' THEN
    RAISE EXCEPTION 'Apenas processos planejados podem ser iniciados. Status atual: %', v_status_atual;
  END IF;

  -- Atualizar processo
  UPDATE public.producao_processos
  SET status = 'em_andamento',
      data_inicio_real = CURRENT_DATE,
      atualizado_por_id = p_usuario_id,
      atualizado_por_nome_snapshot = p_nome_usuario,
      updated_at = now()
  WHERE id = p_processo_id;

  -- Registrar evento
  INSERT INTO public.producao_processo_eventos (
    processo_id, tipo_evento, status_anterior, novo_status, 
    usuario_responsavel_id, nome_usuario_snapshot, justificativa
  ) VALUES (
    p_processo_id, 'processo_iniciado', 'planejado', 'em_andamento',
    p_usuario_id, p_nome_usuario, p_justificativa
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.finalizar_processo_producao(
  p_processo_id UUID,
  p_usuario_id UUID,
  p_nome_usuario TEXT,
  p_justificativa TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_status_atual TEXT;
BEGIN
  -- Validar status atual
  SELECT status INTO v_status_atual FROM public.producao_processos WHERE id = p_processo_id;
  
  IF v_status_atual NOT IN ('em_andamento') THEN
    RAISE EXCEPTION 'Apenas processos em andamento podem ser finalizados. Status atual: %', v_status_atual;
  END IF;

  -- Atualizar processo
  UPDATE public.producao_processos
  SET status = 'finalizado',
      data_fim_real = CURRENT_DATE,
      finalizado_por_id = p_usuario_id,
      finalizado_por_nome_snapshot = p_nome_usuario,
      finalizado_em = now(),
      atualizado_por_id = p_usuario_id,
      atualizado_por_nome_snapshot = p_nome_usuario,
      updated_at = now()
  WHERE id = p_processo_id;

  -- Registrar evento
  INSERT INTO public.producao_processo_eventos (
    processo_id, tipo_evento, status_anterior, novo_status, 
    usuario_responsavel_id, nome_usuario_snapshot, justificativa
  ) VALUES (
    p_processo_id, 'processo_finalizado', v_status_atual, 'finalizado',
    p_usuario_id, p_nome_usuario, p_justificativa
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.conferir_apontamento_producao(
  p_apontamento_id UUID,
  p_usuario_id UUID,
  p_nome_usuario TEXT
) RETURNS void AS $$
DECLARE
  v_status_atual TEXT;
BEGIN
  -- Validar status atual
  SELECT status INTO v_status_atual FROM public.producao_apontamentos WHERE id = p_apontamento_id;
  
  IF v_status_atual = 'conferido' THEN
    RAISE EXCEPTION 'Apontamento já está conferido.';
  END IF;
  
  IF v_status_atual = 'cancelado' THEN
    RAISE EXCEPTION 'Apontamentos cancelados não podem ser conferidos.';
  END IF;

  -- Atualizar apontamento
  UPDATE public.producao_apontamentos
  SET status = 'conferido',
      conferido_por_id = p_usuario_id,
      conferido_em = now(),
      conferido_por_nome_snapshot = p_nome_usuario,
      updated_at = now()
  WHERE id = p_apontamento_id;

  -- Registrar evento
  INSERT INTO public.producao_apontamento_eventos (
    apontamento_id, evento, campo_alterado, valor_anterior, valor_novo,
    usuario_id, nome_usuario_snapshot
  ) VALUES (
    p_apontamento_id, 'apontamento_conferido', 'status', v_status_atual, 'conferido',
    p_usuario_id, p_nome_usuario
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
