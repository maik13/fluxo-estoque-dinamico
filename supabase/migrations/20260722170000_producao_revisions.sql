-- Revisão final de segurança e consistência do Módulo de Produção.
-- Esta migration é progressiva: não altera tabelas nem regras do almoxarifado.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Ajustes de schema sem duplicar conceitos do legado
-- ---------------------------------------------------------------------------
ALTER TABLE public.producao_projetos
  ADD COLUMN IF NOT EXISTS descricao TEXT NULL;

-- A coluna nome continua sendo o nome operacional usado pelo módulo.
ALTER TABLE public.producao_membros
  ADD COLUMN IF NOT EXISTS nome TEXT NULL;

UPDATE public.producao_membros
SET nome = COALESCE(NULLIF(btrim(nome), ''), nome_snapshot)
WHERE nome IS NULL OR btrim(nome) = '';

ALTER TABLE public.producao_membros
  ALTER COLUMN nome SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'producao_membros_nome_nao_vazio'
      AND conrelid = 'public.producao_membros'::regclass
  ) THEN
    ALTER TABLE public.producao_membros
      ADD CONSTRAINT producao_membros_nome_nao_vazio CHECK (btrim(nome) <> '');
  END IF;
END $$;

-- Permissões granulares e isoladas da produção.
ALTER TABLE public.producao_permissoes
  ADD COLUMN IF NOT EXISTS pode_visualizar_auditoria BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_projetos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_finalizar_processos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_reabrir_processos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_editar_apontamentos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_cancelar_apontamentos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_conferir_apontamentos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_tarefas BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_membros BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_anexos BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2. Remoção de funções antigas/inseguras e sobrecargas obsoletas
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.iniciar_processo_producao(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.finalizar_processo_producao(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.conferir_apontamento_producao(UUID, UUID, TEXT);

-- ---------------------------------------------------------------------------
-- 3. Remoção integral das policies antigas do módulo
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename LIKE 'producao\_%' ESCAPE '\'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      p.policyname, p.schemaname, p.tablename
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Função única de autorização para as RPCs e policies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.usuario_tem_permissao_producao(p_permissao TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v public.producao_permissoes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v
  FROM public.producao_permissoes
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN CASE p_permissao
    WHEN 'visualizar' THEN v.pode_visualizar OR v.pode_gerenciar_processos
    WHEN 'auditoria' THEN v.pode_visualizar_auditoria
    WHEN 'projetos' THEN v.pode_gerenciar_projetos OR v.pode_gerenciar_processos
    WHEN 'processos' THEN v.pode_gerenciar_processos
    WHEN 'finalizar' THEN v.pode_finalizar_processos OR v.pode_gerenciar_processos
    WHEN 'reabrir' THEN v.pode_reabrir_processos OR v.pode_gerenciar_processos
    WHEN 'lancar' THEN v.pode_lancar_apontamentos
    WHEN 'editar_apontamento' THEN v.pode_editar_apontamentos
    WHEN 'cancelar_apontamento' THEN v.pode_cancelar_apontamentos
    WHEN 'conferir_apontamento' THEN v.pode_conferir_apontamentos
    WHEN 'tarefas' THEN v.pode_gerenciar_tarefas
    WHEN 'membros' THEN v.pode_gerenciar_membros
    WHEN 'vincular_membros' THEN v.pode_vincular_membros
    WHEN 'anexos' THEN v.pode_gerenciar_anexos
    ELSE false
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.usuario_tem_permissao_producao(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_tem_permissao_producao(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS: leitura direta controlada; nenhuma escrita direta pelo cliente
-- ---------------------------------------------------------------------------
ALTER TABLE public.producao_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY producao_permissoes_ler_propria
ON public.producao_permissoes FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'producao_projetos',
    'producao_processos',
    'producao_apontamentos',
    'producao_membros',
    'producao_tarefas',
    'producao_apontamento_membros',
    'producao_materiais_projeto',
    'producao_apontamento_anexos'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.usuario_tem_permissao_producao(''visualizar''))',
        t || '_leitura', t
      );
    END IF;
  END LOOP;
END $$;

CREATE POLICY producao_processo_eventos_leitura
ON public.producao_processo_eventos FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('auditoria'));

CREATE POLICY producao_apontamento_eventos_leitura
ON public.producao_apontamento_eventos FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('auditoria'));

-- ---------------------------------------------------------------------------
-- 6. RPCs seguras para projetos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_projeto_producao(
  p_nome TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_cliente TEXT DEFAULT NULL,
  p_cidade TEXT DEFAULT NULL,
  p_uf TEXT DEFAULT NULL,
  p_local_execucao TEXT DEFAULT NULL,
  p_endereco_execucao TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_user UUID := auth.uid();
  v_nome TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para criar projetos de produção';
  END IF;
  IF btrim(COALESCE(p_nome, '')) = '' THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  IF p_uf IS NOT NULL AND length(btrim(p_uf)) <> 2 THEN RAISE EXCEPTION 'UF deve possuir 2 caracteres'; END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário') INTO v_nome
  FROM auth.users WHERE id = v_user;

  INSERT INTO public.producao_projetos (
    nome, descricao, cliente, cidade, uf, local_execucao, endereco_execucao,
    criado_por_id, criado_por_nome_snapshot
  ) VALUES (
    btrim(p_nome), NULLIF(btrim(p_descricao), ''), NULLIF(btrim(p_cliente), ''),
    NULLIF(btrim(p_cidade), ''), upper(NULLIF(btrim(p_uf), '')),
    NULLIF(btrim(p_local_execucao), ''), NULLIF(btrim(p_endereco_execucao), ''),
    v_user, v_nome
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_projeto_producao(
  p_id UUID,
  p_nome TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_cliente TEXT DEFAULT NULL,
  p_cidade TEXT DEFAULT NULL,
  p_uf TEXT DEFAULT NULL,
  p_local_execucao TEXT DEFAULT NULL,
  p_endereco_execucao TEXT DEFAULT NULL,
  p_ativo BOOLEAN DEFAULT true
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para editar projetos de produção';
  END IF;
  PERFORM 1 FROM public.producao_projetos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário') INTO v_nome FROM auth.users WHERE id = v_user;

  UPDATE public.producao_projetos SET
    nome = btrim(p_nome), descricao = NULLIF(btrim(p_descricao), ''),
    cliente = NULLIF(btrim(p_cliente), ''), cidade = NULLIF(btrim(p_cidade), ''),
    uf = upper(NULLIF(btrim(p_uf), '')), local_execucao = NULLIF(btrim(p_local_execucao), ''),
    endereco_execucao = NULLIF(btrim(p_endereco_execucao), ''), ativo = p_ativo,
    atualizado_por_id = v_user, atualizado_por_nome_snapshot = v_nome, updated_at = now()
  WHERE id = p_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPCs seguras para processos
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.producao_processo_codigo_seq;

CREATE OR REPLACE FUNCTION public.criar_processo_producao(
  p_projeto_id UUID,
  p_nome TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_prioridade TEXT DEFAULT 'normal',
  p_codigo TEXT DEFAULT NULL,
  p_produto_entregavel TEXT DEFAULT NULL,
  p_unidade_medida TEXT DEFAULT NULL,
  p_quantidade_planejada NUMERIC DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_user UUID := auth.uid();
  v_codigo TEXT;
  v_nome_user TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para criar processos';
  END IF;
  IF p_prioridade NOT IN ('baixa','normal','alta','urgente') THEN RAISE EXCEPTION 'Prioridade inválida'; END IF;
  PERFORM 1 FROM public.producao_projetos WHERE id = p_projeto_id AND ativo = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto inexistente ou inativo'; END IF;

  v_codigo := COALESCE(NULLIF(btrim(p_codigo), ''),
    'PRD-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('public.producao_processo_codigo_seq')::TEXT, 6, '0'));
  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário') INTO v_nome_user FROM auth.users WHERE id = v_user;

  INSERT INTO public.producao_processos (
    codigo, projeto_id, nome, descricao, produto_entregavel, unidade_medida,
    quantidade_planejada, prioridade, criado_por_id, criado_por_nome_snapshot
  ) VALUES (
    v_codigo, p_projeto_id, btrim(p_nome), NULLIF(btrim(p_descricao), ''),
    NULLIF(btrim(p_produto_entregavel), ''), NULLIF(btrim(p_unidade_medida), ''),
    p_quantidade_planejada, p_prioridade, v_user, v_nome_user
  ) RETURNING id INTO v_id;

  INSERT INTO public.producao_processo_eventos (
    processo_id, tipo_evento, novo_status, usuario_responsavel_id,
    nome_usuario_snapshot, valores_posteriores
  ) VALUES (
    v_id, 'processo_criado', 'planejado', v_user, v_nome_user,
    jsonb_build_object('codigo', v_codigo, 'nome', btrim(p_nome), 'prioridade', p_prioridade)
  );
  RETURN v_id;
END;
$$;

-- Transição consolidada e auditada.
CREATE OR REPLACE FUNCTION public.transicao_processo_producao(
  p_processo_id UUID,
  p_acao TEXT,
  p_justificativa TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v public.producao_processos%ROWTYPE;
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_novo TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_acao = 'finalizar' AND NOT public.usuario_tem_permissao_producao('finalizar') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_acao = 'reabrir' AND NOT public.usuario_tem_permissao_producao('reabrir') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_acao NOT IN ('finalizar','reabrir') AND NOT public.usuario_tem_permissao_producao('processos') THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT * INTO v FROM public.producao_processos WHERE id = p_processo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;
  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário') INTO v_nome FROM auth.users WHERE id = v_user;

  CASE p_acao
    WHEN 'iniciar' THEN
      IF v.status <> 'planejado' THEN RAISE EXCEPTION 'Transição inválida'; END IF;
      v_novo := 'em_andamento';
    WHEN 'pausar' THEN
      IF v.status <> 'em_andamento' OR btrim(COALESCE(p_justificativa,'')) = '' THEN RAISE EXCEPTION 'Pausa exige processo em andamento e justificativa'; END IF;
      v_novo := 'pausado';
    WHEN 'retomar' THEN
      IF v.status <> 'pausado' THEN RAISE EXCEPTION 'Somente processo pausado pode ser retomado'; END IF;
      v_novo := 'em_andamento';
    WHEN 'bloquear' THEN
      IF v.status <> 'em_andamento' OR btrim(COALESCE(p_justificativa,'')) = '' THEN RAISE EXCEPTION 'Bloqueio exige justificativa'; END IF;
      v_novo := 'bloqueado';
    WHEN 'desbloquear' THEN
      IF v.status <> 'bloqueado' OR btrim(COALESCE(p_justificativa,'')) = '' THEN RAISE EXCEPTION 'Desbloqueio exige justificativa'; END IF;
      v_novo := 'em_andamento';
    WHEN 'finalizar' THEN
      IF v.status <> 'em_andamento' OR btrim(COALESCE(p_justificativa,'')) = '' THEN RAISE EXCEPTION 'Finalização exige justificativa'; END IF;
      IF EXISTS (SELECT 1 FROM public.producao_apontamentos WHERE processo_id = p_processo_id AND status = 'lancado') THEN
        RAISE EXCEPTION 'Existem apontamentos pendentes';
      END IF;
      v_novo := 'finalizado';
    WHEN 'cancelar' THEN
      IF v.status IN ('finalizado','cancelado') OR btrim(COALESCE(p_justificativa,'')) = '' THEN RAISE EXCEPTION 'Cancelamento inválido'; END IF;
      v_novo := 'cancelado';
    WHEN 'reabrir' THEN
      IF v.status NOT IN ('finalizado','cancelado') OR btrim(COALESCE(p_justificativa,'')) = '' THEN RAISE EXCEPTION 'Reabertura inválida'; END IF;
      v_novo := 'em_andamento';
    ELSE RAISE EXCEPTION 'Ação desconhecida';
  END CASE;

  UPDATE public.producao_processos SET
    status = v_novo,
    data_inicio_real = CASE WHEN p_acao='iniciar' THEN CURRENT_DATE ELSE data_inicio_real END,
    data_fim_real = CASE WHEN p_acao='finalizar' THEN CURRENT_DATE WHEN p_acao='reabrir' THEN NULL ELSE data_fim_real END,
    motivo_pausa = CASE WHEN p_acao='pausar' THEN p_justificativa ELSE motivo_pausa END,
    motivo_bloqueio = CASE WHEN p_acao='bloquear' THEN p_justificativa WHEN p_acao='desbloquear' THEN NULL ELSE motivo_bloqueio END,
    motivo_cancelamento = CASE WHEN p_acao='cancelar' THEN p_justificativa WHEN p_acao='reabrir' THEN NULL ELSE motivo_cancelamento END,
    finalizado_por_id = CASE WHEN p_acao='finalizar' THEN v_user WHEN p_acao='reabrir' THEN NULL ELSE finalizado_por_id END,
    finalizado_por_nome_snapshot = CASE WHEN p_acao='finalizar' THEN v_nome WHEN p_acao='reabrir' THEN NULL ELSE finalizado_por_nome_snapshot END,
    finalizado_em = CASE WHEN p_acao='finalizar' THEN now() WHEN p_acao='reabrir' THEN NULL ELSE finalizado_em END,
    cancelado_por_id = CASE WHEN p_acao='cancelar' THEN v_user WHEN p_acao='reabrir' THEN NULL ELSE cancelado_por_id END,
    cancelado_por_nome_snapshot = CASE WHEN p_acao='cancelar' THEN v_nome WHEN p_acao='reabrir' THEN NULL ELSE cancelado_por_nome_snapshot END,
    cancelado_em = CASE WHEN p_acao='cancelar' THEN now() WHEN p_acao='reabrir' THEN NULL ELSE cancelado_em END,
    atualizado_por_id = v_user, atualizado_por_nome_snapshot = v_nome, updated_at = now()
  WHERE id = p_processo_id;

  INSERT INTO public.producao_processo_eventos (
    processo_id, tipo_evento, status_anterior, novo_status,
    usuario_responsavel_id, nome_usuario_snapshot, justificativa,
    valores_anteriores, valores_posteriores
  ) VALUES (
    p_processo_id, p_acao, v.status, v_novo, v_user, v_nome, p_justificativa,
    jsonb_build_object('status', v.status), jsonb_build_object('status', v_novo)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. RPCs para tarefas e membros
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_tarefa_producao(p_nome TEXT, p_categoria TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.usuario_tem_permissao_producao('tarefas') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  INSERT INTO public.producao_tarefas(nome,categoria)
  VALUES (btrim(p_nome), NULLIF(btrim(p_categoria),'')) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.salvar_membro_producao(
  p_id UUID DEFAULT NULL,
  p_nome TEXT DEFAULT NULL,
  p_apelido TEXT DEFAULT NULL,
  p_funcao TEXT DEFAULT NULL,
  p_valor_hora NUMERIC DEFAULT NULL,
  p_ativo BOOLEAN DEFAULT true
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.usuario_tem_permissao_producao('membros') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_valor_hora IS NOT NULL AND p_valor_hora < 0 THEN RAISE EXCEPTION 'Valor-hora inválido'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.producao_membros(nome,nome_snapshot,origem,apelido,funcao,valor_hora,ativo)
    VALUES (btrim(p_nome),btrim(p_nome),'producao',NULLIF(btrim(p_apelido),''),NULLIF(btrim(p_funcao),''),p_valor_hora,p_ativo)
    RETURNING id INTO v_id;
  ELSE
    PERFORM 1 FROM public.producao_membros WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Membro não encontrado'; END IF;
    UPDATE public.producao_membros SET
      nome=btrim(p_nome), nome_snapshot=btrim(p_nome), apelido=NULLIF(btrim(p_apelido),''),
      funcao=NULLIF(btrim(p_funcao),''), valor_hora=p_valor_hora, ativo=p_ativo, updated_at=now()
    WHERE id=p_id RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.vincular_membro_legado_pendente(
  p_membro_id UUID, p_solicitante_id UUID, p_justificativa TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID:=auth.uid(); v_nome TEXT; v_membro public.producao_membros%ROWTYPE; v_solicitante TEXT;
BEGIN
  IF NOT public.usuario_tem_permissao_producao('vincular_membros') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF btrim(COALESCE(p_justificativa,''))='' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  SELECT * INTO v_membro FROM public.producao_membros WHERE id=p_membro_id FOR UPDATE;
  IF NOT FOUND OR v_membro.origem::TEXT <> 'legado_pendente' THEN RAISE EXCEPTION 'Membro pendente inválido'; END IF;
  SELECT nome INTO v_solicitante FROM public.solicitantes WHERE id=p_solicitante_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitante não encontrado'; END IF;
  SELECT COALESCE(raw_user_meta_data->>'name',email,'Usuário') INTO v_nome FROM auth.users WHERE id=v_user;
  UPDATE public.producao_membros SET solicitante_id=p_solicitante_id, origem='solicitante', nome=v_solicitante,
    nome_snapshot=v_solicitante, updated_at=now() WHERE id=p_membro_id;
  INSERT INTO public.producao_apontamento_eventos(apontamento_id,evento,usuario_id,nome_usuario_snapshot,justificativa)
  SELECT pam.apontamento_id,'membro_vinculado_solicitante',v_user,v_nome,p_justificativa
  FROM public.producao_apontamento_membros pam WHERE pam.membro_id=p_membro_id
  LIMIT 1;
END $$;

-- ---------------------------------------------------------------------------
-- 9. RPCs transacionais de apontamento
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_apontamento_producao(
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
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user UUID:=auth.uid(); v_nome TEXT; v_id UUID; v_membro RECORD; v_processo public.producao_processos%ROWTYPE;
BEGIN
  IF NOT public.usuario_tem_permissao_producao('lancar') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF num_nonnulls(p_processo_id,p_projeto_local_id) <> 1 THEN RAISE EXCEPTION 'Informe processo ou projeto/local'; END IF;
  IF p_termino <= p_inicio OR p_duracao_minutos <= 0 THEN RAISE EXCEPTION 'Horário inválido'; END IF;
  IF p_minutos_produtivos + p_minutos_improdutivos <> p_duracao_minutos THEN RAISE EXCEPTION 'Tempos não fecham'; END IF;
  IF p_minutos_improdutivos > 0 AND btrim(COALESCE(p_motivo_improdutivo,''))='' THEN RAISE EXCEPTION 'Motivo improdutivo obrigatório'; END IF;
  IF COALESCE(array_length(p_membros,1),0)=0 THEN RAISE EXCEPTION 'Informe membros'; END IF;
  IF p_processo_id IS NOT NULL THEN
    SELECT * INTO v_processo FROM public.producao_processos WHERE id=p_processo_id FOR SHARE;
    IF NOT FOUND OR v_processo.status <> 'em_andamento' THEN RAISE EXCEPTION 'Processo não está em andamento'; END IF;
  END IF;
  SELECT COALESCE(raw_user_meta_data->>'name',email,'Usuário') INTO v_nome FROM auth.users WHERE id=v_user;
  INSERT INTO public.producao_apontamentos(
    data,processo_id,projeto_local_id,tarefa_id,local_tipo,quantidade_produzida,inicio,termino,
    duracao_minutos,minutos_produtivos,minutos_improdutivos,motivo_improdutivo,observacoes,
    criado_por_id,criado_por_nome_snapshot
  ) VALUES (
    p_data,p_processo_id,p_projeto_local_id,p_tarefa_id,p_local_tipo,p_quantidade_produzida,p_inicio,p_termino,
    p_duracao_minutos,p_minutos_produtivos,p_minutos_improdutivos,NULLIF(btrim(p_motivo_improdutivo),''),
    NULLIF(btrim(p_observacoes),''),v_user,v_nome
  ) RETURNING id INTO v_id;

  FOR v_membro IN
    SELECT id,nome,valor_hora FROM public.producao_membros
    WHERE id=ANY(p_membros) AND ativo=true
  LOOP
    INSERT INTO public.producao_apontamento_membros(apontamento_id,membro_id,nome_snapshot,valor_hora_snapshot)
    VALUES(v_id,v_membro.id,v_membro.nome,v_membro.valor_hora);
  END LOOP;
  IF (SELECT count(*) FROM public.producao_apontamento_membros WHERE apontamento_id=v_id) <> cardinality(p_membros) THEN
    RAISE EXCEPTION 'Um ou mais membros são inválidos ou inativos';
  END IF;

  INSERT INTO public.producao_apontamento_eventos(apontamento_id,evento,usuario_id,nome_usuario_snapshot,valor_novo)
  VALUES(v_id,'criacao',v_user,v_nome,jsonb_build_object('processo_id',p_processo_id,'projeto_local_id',p_projeto_local_id)::TEXT);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancelar_apontamento_producao(p_apontamento_id UUID,p_justificativa TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID:=auth.uid(); v_nome TEXT; v_status TEXT;
BEGIN
  IF NOT public.usuario_tem_permissao_producao('cancelar_apontamento') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF btrim(COALESCE(p_justificativa,''))='' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  SELECT status INTO v_status FROM public.producao_apontamentos WHERE id=p_apontamento_id FOR UPDATE;
  IF v_status <> 'lancado' THEN RAISE EXCEPTION 'Somente apontamento lançado pode ser cancelado'; END IF;
  SELECT COALESCE(raw_user_meta_data->>'name',email,'Usuário') INTO v_nome FROM auth.users WHERE id=v_user;
  UPDATE public.producao_apontamentos SET status='cancelado',cancelado_por_id=v_user,cancelado_por_nome_snapshot=v_nome,
    cancelado_em=now(),motivo_cancelamento=p_justificativa,updated_at=now() WHERE id=p_apontamento_id;
  INSERT INTO public.producao_apontamento_eventos(apontamento_id,evento,campo_alterado,valor_anterior,valor_novo,usuario_id,nome_usuario_snapshot,justificativa)
  VALUES(p_apontamento_id,'cancelamento','status',v_status,'cancelado',v_user,v_nome,p_justificativa);
END $$;

CREATE OR REPLACE FUNCTION public.conferir_apontamento_producao(p_apontamento_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID:=auth.uid(); v_nome TEXT; v_status TEXT;
BEGIN
  IF NOT public.usuario_tem_permissao_producao('conferir_apontamento') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT status INTO v_status FROM public.producao_apontamentos WHERE id=p_apontamento_id FOR UPDATE;
  IF v_status <> 'lancado' THEN RAISE EXCEPTION 'Somente apontamento lançado pode ser conferido'; END IF;
  SELECT COALESCE(raw_user_meta_data->>'name',email,'Usuário') INTO v_nome FROM auth.users WHERE id=v_user;
  UPDATE public.producao_apontamentos SET status='conferido',conferido_por_id=v_user,conferido_por_nome_snapshot=v_nome,
    conferido_em=now(),updated_at=now() WHERE id=p_apontamento_id;
  INSERT INTO public.producao_apontamento_eventos(apontamento_id,evento,campo_alterado,valor_anterior,valor_novo,usuario_id,nome_usuario_snapshot)
  VALUES(p_apontamento_id,'conferencia','status',v_status,'conferido',v_user,v_nome);
END $$;

-- Resumo de finalização calculado no servidor.
CREATE OR REPLACE FUNCTION public.obter_resumo_finalizacao_processo(p_processo_id UUID)
RETURNS TABLE(
  quantidade_planejada NUMERIC,
  quantidade_realizada NUMERIC,
  percentual_conclusao NUMERIC,
  total_apontamentos BIGINT,
  apontamentos_pendentes BIGINT,
  minutos_totais BIGINT,
  minutos_produtivos BIGINT,
  minutos_improdutivos BIGINT,
  horas_homem NUMERIC
) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    p.quantidade_planejada,
    COALESCE(sum(a.quantidade_produzida) FILTER (WHERE a.status='conferido'),0),
    CASE WHEN COALESCE(p.quantidade_planejada,0)>0 THEN
      round((COALESCE(sum(a.quantidade_produzida) FILTER (WHERE a.status='conferido'),0)/p.quantidade_planejada)*100,2)
    ELSE NULL END,
    count(a.id),
    count(a.id) FILTER (WHERE a.status='lancado'),
    COALESCE(sum(a.duracao_minutos) FILTER (WHERE a.status<>'cancelado'),0),
    COALESCE(sum(a.minutos_produtivos) FILTER (WHERE a.status<>'cancelado'),0),
    COALESCE(sum(a.minutos_improdutivos) FILTER (WHERE a.status<>'cancelado'),0),
    COALESCE(sum(a.duracao_minutos * COALESCE(m.qtd,0)) FILTER (WHERE a.status<>'cancelado'),0)/60.0
  FROM public.producao_processos p
  LEFT JOIN public.producao_apontamentos a ON a.processo_id=p.id
  LEFT JOIN LATERAL (
    SELECT count(*) qtd FROM public.producao_apontamento_membros pam WHERE pam.apontamento_id=a.id
  ) m ON true
  WHERE p.id=p_processo_id
  GROUP BY p.id,p.quantidade_planejada;
$$;

-- ---------------------------------------------------------------------------
-- 10. Grants: somente RPCs públicas necessárias
-- ---------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS assinatura
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname IN (
             'criar_projeto_producao','editar_projeto_producao','criar_processo_producao',
             'transicao_processo_producao','criar_tarefa_producao','salvar_membro_producao',
             'vincular_membro_legado_pendente','criar_apontamento_producao',
             'cancelar_apontamento_producao','conferir_apontamento_producao',
             'obter_resumo_finalizacao_processo'
           )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.assinatura);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.assinatura);
  END LOOP;
END $$;

COMMIT;
