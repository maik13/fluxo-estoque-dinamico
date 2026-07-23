-- Sistema global de permissões: perfil-base + exceções individuais.
-- Mantém compatibilidade com permissoes_tipo_usuario durante a transição.

BEGIN;

CREATE TABLE IF NOT EXISTS public.permissoes_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  modulo TEXT NOT NULL,
  grupo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT permissoes_catalogo_chave_valida CHECK (chave ~ '^[a-z0-9_]+(\.[a-z0-9_]+)+$'),
  CONSTRAINT permissoes_catalogo_nome_nao_vazio CHECK (btrim(nome) <> '')
);

CREATE TABLE IF NOT EXISTS public.perfil_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_usuario TEXT NOT NULL,
  permissao_id UUID NOT NULL REFERENCES public.permissoes_catalogo(id) ON DELETE CASCADE,
  permitido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo_usuario, permissao_id)
);

CREATE TABLE IF NOT EXISTS public.usuario_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissao_id UUID NOT NULL REFERENCES public.permissoes_catalogo(id) ON DELETE CASCADE,
  efeito TEXT NOT NULL CHECK (efeito IN ('permitir', 'negar')),
  criado_por UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  atualizado_por UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, permissao_id)
);

CREATE TABLE IF NOT EXISTS public.permissoes_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_alvo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissao_id UUID NULL REFERENCES public.permissoes_catalogo(id) ON DELETE SET NULL,
  chave_snapshot TEXT NOT NULL,
  estado_anterior TEXT NOT NULL CHECK (estado_anterior IN ('herdar', 'permitir', 'negar')),
  estado_novo TEXT NOT NULL CHECK (estado_novo IN ('herdar', 'permitir', 'negar')),
  alterado_por_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  alterado_por_nome_snapshot TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS perfil_permissoes_tipo_idx
  ON public.perfil_permissoes(tipo_usuario, permissao_id);
CREATE INDEX IF NOT EXISTS usuario_permissoes_user_idx
  ON public.usuario_permissoes(user_id, permissao_id);
CREATE INDEX IF NOT EXISTS permissoes_auditoria_alvo_idx
  ON public.permissoes_auditoria(usuario_alvo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS permissoes_catalogo_organizacao_idx
  ON public.permissoes_catalogo(modulo, grupo, ordem, nome);

INSERT INTO public.permissoes_catalogo (chave, modulo, grupo, nome, descricao, ordem)
VALUES
  ('sistema.acessar', 'Sistema', 'Acesso geral', 'Acessar o sistema', 'Permite entrar e utilizar o aplicativo.', 10),
  ('estoque.itens.visualizar', 'Estoque', 'Itens', 'Visualizar itens', 'Consulta itens, saldos e detalhes do estoque.', 100),
  ('estoque.itens.criar', 'Estoque', 'Itens', 'Cadastrar itens', 'Cria novos itens no catálogo.', 110),
  ('estoque.itens.editar', 'Estoque', 'Itens', 'Editar itens', 'Altera dados cadastrais dos itens.', 120),
  ('estoque.itens.excluir', 'Estoque', 'Itens', 'Excluir itens', 'Exclui itens quando permitido pelas regras de integridade.', 130),
  ('estoque.movimentacoes.visualizar', 'Estoque', 'Movimentações', 'Visualizar movimentações', 'Consulta entradas, saídas, transferências e histórico.', 200),
  ('estoque.movimentacoes.registrar', 'Estoque', 'Movimentações', 'Registrar movimentações', 'Permissão geral para registrar movimentações.', 210),
  ('estoque.movimentacoes.entrada', 'Estoque', 'Movimentações', 'Registrar entrada', 'Registra entrada de materiais.', 220),
  ('estoque.movimentacoes.saida', 'Estoque', 'Movimentações', 'Registrar saída', 'Registra saída de materiais.', 230),
  ('estoque.movimentacoes.transferir', 'Estoque', 'Movimentações', 'Transferir entre estoques', 'Transfere materiais entre estoques.', 240),
  ('estoque.movimentacoes.editar', 'Estoque', 'Movimentações', 'Editar movimentações', 'Corrige movimentações existentes.', 250),
  ('estoque.solicitacoes.visualizar', 'Estoque', 'Solicitações', 'Visualizar solicitações', 'Consulta solicitações de materiais.', 300),
  ('estoque.solicitacoes.solicitar', 'Estoque', 'Solicitações', 'Solicitar material', 'Cria solicitações de retirada.', 310),
  ('estoque.solicitacoes.devolver', 'Estoque', 'Solicitações', 'Devolver material', 'Registra devoluções de materiais.', 320),
  ('estoque.solicitacoes.gerenciar', 'Estoque', 'Solicitações', 'Gerenciar solicitações', 'Consulta, aprova, atende ou cancela solicitações.', 330),
  ('compras.pedidos.visualizar', 'Compras', 'Pedidos', 'Visualizar pedidos de compra', 'Consulta pedidos de compra.', 400),
  ('compras.pedidos.criar', 'Compras', 'Pedidos', 'Criar pedido de compra', 'Cria pedidos de compra.', 410),
  ('compras.pedidos.editar', 'Compras', 'Pedidos', 'Editar pedido de compra', 'Altera pedidos de compra.', 420),
  ('compras.pedidos.aprovar', 'Compras', 'Pedidos', 'Aprovar pedido de compra', 'Aprova ou rejeita pedidos de compra.', 430),
  ('projetos.visualizar', 'Projetos', 'Projetos', 'Visualizar projetos', 'Acessa a visão de projetos e seus materiais.', 500),
  ('projetos.gerenciar', 'Projetos', 'Projetos', 'Gerenciar projetos', 'Cria, edita e organiza projetos.', 510),
  ('gerencial.visualizar', 'Gerencial', 'Painel', 'Acessar painel gerencial', 'Acessa indicadores gerenciais.', 600),
  ('relatorios.visualizar', 'Relatórios', 'Relatórios', 'Visualizar relatórios', 'Acessa relatórios do sistema.', 610),
  ('relatorios.exportar', 'Relatórios', 'Relatórios', 'Exportar relatórios', 'Exporta Excel, PDF ou impressão.', 620),
  ('mensagens.visualizar', 'Comunicação', 'Mensagens', 'Acessar mensagens', 'Acessa o mensageiro interno.', 700),
  ('producao.acessar', 'Produção', 'Acesso', 'Acessar Produção', 'Abre o módulo de Produção.', 800),
  ('producao.projetos.visualizar', 'Produção', 'Projetos', 'Visualizar projetos de Produção', 'Consulta os projetos usados pela Produção.', 810),
  ('producao.projetos.gerenciar', 'Produção', 'Projetos', 'Gerenciar projetos de Produção', 'Cria e edita projetos de Produção.', 820),
  ('producao.etapas.visualizar', 'Produção', 'Etapas', 'Visualizar etapas', 'Consulta etapas e estados operacionais.', 830),
  ('producao.etapas.gerenciar', 'Produção', 'Etapas', 'Criar e editar etapas', 'Cria e altera planejamento de etapas.', 840),
  ('producao.etapas.transicionar', 'Produção', 'Etapas', 'Alterar status das etapas', 'Inicia, pausa, bloqueia, finaliza, cancela ou reabre etapas.', 850),
  ('producao.cronograma.visualizar', 'Produção', 'Cronograma', 'Visualizar cronograma', 'Consulta Gantt e Plano Diário.', 860),
  ('producao.cronograma.recalcular', 'Produção', 'Cronograma', 'Recalcular cronograma', 'Redistribui o saldo futuro das etapas.', 870),
  ('producao.cronograma.configurar', 'Produção', 'Cronograma', 'Configurar capacidade e calendário', 'Altera equipe disponível, dias úteis e horizonte.', 880),
  ('producao.apontamentos.criar', 'Produção', 'Apontamentos', 'Criar apontamentos', 'Registra execução, equipe, quantidade e evidências.', 890),
  ('producao.apontamentos.editar', 'Produção', 'Apontamentos', 'Editar apontamentos', 'Edita apontamentos ainda pendentes.', 900),
  ('producao.apontamentos.conferir', 'Produção', 'Apontamentos', 'Conferir apontamentos', 'Valida apontamentos pendentes.', 910),
  ('producao.apontamentos.cancelar', 'Produção', 'Apontamentos', 'Cancelar apontamentos', 'Cancela apontamentos com justificativa.', 920),
  ('producao.historico.visualizar', 'Produção', 'Histórico', 'Visualizar Histórico', 'Consulta apontamentos, eventos e evidências.', 930),
  ('producao.bi.visualizar', 'Produção', 'BI Produção', 'Visualizar BI Produção', 'Acessa indicadores de Produção.', 940),
  ('producao.bi.custos', 'Produção', 'BI Produção', 'Visualizar custos de Produção', 'Exibe custos de mão de obra e improdutividade.', 950),
  ('producao.configuracoes.gerenciar', 'Produção', 'Configurações', 'Configurar Produção', 'Gerencia equipe e tarefas da Produção.', 960),
  ('administracao.configuracoes.visualizar', 'Administração', 'Configurações', 'Visualizar configurações', 'Abre as configurações gerais do sistema.', 1000),
  ('administracao.configuracoes.gerenciar', 'Administração', 'Configurações', 'Gerenciar configurações', 'Altera cadastros e parâmetros gerais.', 1010),
  ('administracao.usuarios.visualizar', 'Administração', 'Usuários', 'Visualizar usuários', 'Consulta a lista de usuários.', 1020),
  ('administracao.usuarios.criar', 'Administração', 'Usuários', 'Criar usuários', 'Cadastra novos usuários.', 1030),
  ('administracao.usuarios.editar', 'Administração', 'Usuários', 'Editar usuários', 'Altera nome, e-mail e dados do usuário.', 1040),
  ('administracao.usuarios.ativar', 'Administração', 'Usuários', 'Ativar ou desativar usuários', 'Controla o status de acesso do usuário.', 1050),
  ('administracao.usuarios.redefinir_senha', 'Administração', 'Usuários', 'Redefinir senha', 'Redefine a senha de outro usuário.', 1060),
  ('administracao.usuarios.alterar_perfil', 'Administração', 'Usuários', 'Alterar perfil-base', 'Altera o tipo de usuário usado como padrão.', 1070),
  ('administracao.permissoes.gerenciar', 'Administração', 'Permissões', 'Gerenciar permissões', 'Altera padrões de perfil e exceções individuais.', 1080),
  ('administracao.auditoria.visualizar', 'Administração', 'Auditoria', 'Visualizar auditoria', 'Consulta registros de auditoria do sistema.', 1090)
ON CONFLICT (chave) DO UPDATE SET
  modulo = EXCLUDED.modulo,
  grupo = EXCLUDED.grupo,
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  ordem = EXCLUDED.ordem,
  ativo = true,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.sincronizar_perfil_legado_permissoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.perfil_permissoes (tipo_usuario, permissao_id, permitido)
  SELECT NEW.tipo_usuario, c.id,
    CASE c.chave
      WHEN 'sistema.acessar' THEN true
      WHEN 'estoque.itens.visualizar' THEN true
      WHEN 'estoque.itens.criar' THEN NEW.pode_cadastrar_itens
      WHEN 'estoque.itens.editar' THEN NEW.pode_editar_itens
      WHEN 'estoque.itens.excluir' THEN NEW.pode_excluir_itens
      WHEN 'estoque.movimentacoes.visualizar' THEN NEW.pode_registrar_movimentacoes
      WHEN 'estoque.movimentacoes.registrar' THEN NEW.pode_registrar_movimentacoes
      WHEN 'estoque.movimentacoes.entrada' THEN COALESCE(NEW.pode_registrar_entrada, NEW.pode_registrar_movimentacoes)
      WHEN 'estoque.movimentacoes.saida' THEN COALESCE(NEW.pode_registrar_saida, NEW.pode_registrar_movimentacoes)
      WHEN 'estoque.movimentacoes.transferir' THEN COALESCE(NEW.pode_transferir, false)
      WHEN 'estoque.movimentacoes.editar' THEN COALESCE(NEW.pode_editar_movimentacoes, false)
      WHEN 'estoque.solicitacoes.visualizar' THEN COALESCE(NEW.pode_solicitacao_material, false) OR COALESCE(NEW.pode_solicitar_material, false)
      WHEN 'estoque.solicitacoes.solicitar' THEN COALESCE(NEW.pode_solicitar_material, false)
      WHEN 'estoque.solicitacoes.devolver' THEN COALESCE(NEW.pode_devolver_material, false)
      WHEN 'estoque.solicitacoes.gerenciar' THEN COALESCE(NEW.pode_solicitacao_material, false)
      WHEN 'compras.pedidos.visualizar' THEN COALESCE(NEW.pode_pedido_compra, false)
      WHEN 'compras.pedidos.criar' THEN COALESCE(NEW.pode_pedido_compra, false)
      WHEN 'compras.pedidos.editar' THEN COALESCE(NEW.pode_pedido_compra, false)
      WHEN 'compras.pedidos.aprovar' THEN NEW.tipo_usuario IN ('administrador', 'gestor')
      WHEN 'projetos.visualizar' THEN COALESCE(NEW.pode_acessar_projetos, false)
      WHEN 'projetos.gerenciar' THEN COALESCE(NEW.pode_acessar_projetos, false) AND NEW.tipo_usuario IN ('administrador', 'gestor', 'engenharia')
      WHEN 'gerencial.visualizar' THEN COALESCE(NEW.pode_acessar_gerencial, false)
      WHEN 'relatorios.visualizar' THEN COALESCE(NEW.pode_ver_relatorios, false)
      WHEN 'relatorios.exportar' THEN COALESCE(NEW.pode_ver_relatorios, false)
      WHEN 'mensagens.visualizar' THEN true
      WHEN 'producao.acessar' THEN COALESCE(NEW.pode_apontar_producao, false) OR COALESCE(NEW.pode_conferir_producao, false) OR COALESCE(NEW.pode_ver_bi_producao, false) OR COALESCE(NEW.pode_configurar_producao, false)
      WHEN 'producao.projetos.visualizar' THEN COALESCE(NEW.pode_apontar_producao, false) OR COALESCE(NEW.pode_conferir_producao, false) OR COALESCE(NEW.pode_ver_bi_producao, false) OR COALESCE(NEW.pode_configurar_producao, false)
      WHEN 'producao.projetos.gerenciar' THEN COALESCE(NEW.pode_configurar_producao, false)
      WHEN 'producao.etapas.visualizar' THEN COALESCE(NEW.pode_apontar_producao, false) OR COALESCE(NEW.pode_conferir_producao, false) OR COALESCE(NEW.pode_ver_bi_producao, false) OR COALESCE(NEW.pode_configurar_producao, false)
      WHEN 'producao.etapas.gerenciar' THEN COALESCE(NEW.pode_configurar_producao, false)
      WHEN 'producao.etapas.transicionar' THEN COALESCE(NEW.pode_conferir_producao, false) OR COALESCE(NEW.pode_configurar_producao, false)
      WHEN 'producao.cronograma.visualizar' THEN COALESCE(NEW.pode_ver_bi_producao, false) OR COALESCE(NEW.pode_configurar_producao, false) OR COALESCE(NEW.pode_conferir_producao, false)
      WHEN 'producao.cronograma.recalcular' THEN COALESCE(NEW.pode_configurar_producao, false)
      WHEN 'producao.cronograma.configurar' THEN COALESCE(NEW.pode_configurar_producao, false)
      WHEN 'producao.apontamentos.criar' THEN COALESCE(NEW.pode_apontar_producao, false)
      WHEN 'producao.apontamentos.editar' THEN COALESCE(NEW.pode_apontar_producao, false)
      WHEN 'producao.apontamentos.conferir' THEN COALESCE(NEW.pode_conferir_producao, false)
      WHEN 'producao.apontamentos.cancelar' THEN COALESCE(NEW.pode_conferir_producao, false)
      WHEN 'producao.historico.visualizar' THEN COALESCE(NEW.pode_apontar_producao, false) OR COALESCE(NEW.pode_conferir_producao, false) OR COALESCE(NEW.pode_ver_bi_producao, false)
      WHEN 'producao.bi.visualizar' THEN COALESCE(NEW.pode_ver_bi_producao, false)
      WHEN 'producao.bi.custos' THEN COALESCE(NEW.pode_ver_bi_producao, false) AND NEW.tipo_usuario IN ('administrador', 'gestor')
      WHEN 'producao.configuracoes.gerenciar' THEN COALESCE(NEW.pode_configurar_producao, false)
      WHEN 'administracao.configuracoes.visualizar' THEN COALESCE(NEW.pode_gerenciar_configuracoes, false) OR COALESCE(NEW.pode_gerenciar_usuarios, false)
      WHEN 'administracao.configuracoes.gerenciar' THEN COALESCE(NEW.pode_gerenciar_configuracoes, false)
      WHEN 'administracao.usuarios.visualizar' THEN COALESCE(NEW.pode_gerenciar_usuarios, false)
      WHEN 'administracao.usuarios.criar' THEN COALESCE(NEW.pode_gerenciar_usuarios, false)
      WHEN 'administracao.usuarios.editar' THEN COALESCE(NEW.pode_gerenciar_usuarios, false)
      WHEN 'administracao.usuarios.ativar' THEN COALESCE(NEW.pode_gerenciar_usuarios, false)
      WHEN 'administracao.usuarios.redefinir_senha' THEN NEW.tipo_usuario = 'administrador'
      WHEN 'administracao.usuarios.alterar_perfil' THEN COALESCE(NEW.pode_gerenciar_usuarios, false)
      WHEN 'administracao.permissoes.gerenciar' THEN NEW.tipo_usuario = 'administrador'
      WHEN 'administracao.auditoria.visualizar' THEN NEW.tipo_usuario = 'administrador'
      ELSE false
    END
  FROM public.permissoes_catalogo c
  WHERE c.ativo = true
  ON CONFLICT (tipo_usuario, permissao_id) DO UPDATE SET
    permitido = EXCLUDED.permitido,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_perfil_legado_permissoes ON public.permissoes_tipo_usuario;
CREATE TRIGGER trg_sincronizar_perfil_legado_permissoes
AFTER INSERT OR UPDATE ON public.permissoes_tipo_usuario
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_perfil_legado_permissoes();

-- Inicializa os padrões a partir da matriz atual, preservando os acessos existentes.
DO $$
DECLARE v_registro public.permissoes_tipo_usuario%ROWTYPE;
BEGIN
  FOR v_registro IN SELECT * FROM public.permissoes_tipo_usuario LOOP
    PERFORM public.sincronizar_perfil_legado_permissoes_row(v_registro);
  END LOOP;
EXCEPTION WHEN undefined_function THEN
  -- A função auxiliar não existe; replica a chamada do trigger por UPDATE sem alterar valores.
  UPDATE public.permissoes_tipo_usuario SET updated_at = updated_at;
END $$;

CREATE OR REPLACE FUNCTION public.usuario_tem_permissao(
  p_chave TEXT,
  p_user_id UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_tipo TEXT;
  v_efeito TEXT;
  v_permitido BOOLEAN;
BEGIN
  IF v_user_id IS NULL OR btrim(COALESCE(p_chave, '')) = '' THEN RETURN false; END IF;

  SELECT tipo_usuario INTO v_tipo
  FROM public.profiles
  WHERE user_id = v_user_id AND COALESCE(ativo, true) = true
  LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_tipo = 'administrador' THEN RETURN true; END IF;

  SELECT up.efeito INTO v_efeito
  FROM public.usuario_permissoes up
  JOIN public.permissoes_catalogo c ON c.id = up.permissao_id
  WHERE up.user_id = v_user_id AND c.chave = p_chave AND c.ativo = true
  LIMIT 1;

  IF v_efeito = 'negar' THEN RETURN false; END IF;
  IF v_efeito = 'permitir' THEN RETURN true; END IF;

  SELECT pp.permitido INTO v_permitido
  FROM public.perfil_permissoes pp
  JOIN public.permissoes_catalogo c ON c.id = pp.permissao_id
  WHERE pp.tipo_usuario = v_tipo AND c.chave = p_chave AND c.ativo = true
  LIMIT 1;

  RETURN COALESCE(v_permitido, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_minhas_permissoes()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_object_agg(c.chave, public.usuario_tem_permissao(c.chave)), '{}'::jsonb)
  FROM public.permissoes_catalogo c
  WHERE c.ativo = true;
$$;

CREATE OR REPLACE FUNCTION public.listar_permissoes_usuario(p_user_id UUID)
RETURNS TABLE (
  permissao_id UUID,
  chave TEXT,
  modulo TEXT,
  grupo TEXT,
  nome TEXT,
  descricao TEXT,
  ordem INTEGER,
  perfil_permitido BOOLEAN,
  estado_individual TEXT,
  permitido_efetivo BOOLEAN,
  origem TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE v_tipo TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_user_id <> auth.uid()
    AND NOT public.usuario_tem_permissao('administracao.permissoes.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para consultar acessos de outro usuário';
  END IF;

  SELECT tipo_usuario INTO v_tipo FROM public.profiles
  WHERE user_id = p_user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.chave,
    c.modulo,
    c.grupo,
    c.nome,
    c.descricao,
    c.ordem,
    COALESCE(pp.permitido, false),
    COALESCE(up.efeito, 'herdar'),
    public.usuario_tem_permissao(c.chave, p_user_id),
    CASE
      WHEN v_tipo = 'administrador' THEN 'administrador'
      WHEN up.efeito IS NOT NULL THEN 'individual'
      ELSE 'perfil'
    END
  FROM public.permissoes_catalogo c
  LEFT JOIN public.perfil_permissoes pp
    ON pp.permissao_id = c.id AND pp.tipo_usuario = v_tipo
  LEFT JOIN public.usuario_permissoes up
    ON up.permissao_id = c.id AND up.user_id = p_user_id
  WHERE c.ativo = true
  ORDER BY c.modulo, c.grupo, c.ordem, c.nome;
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_permissoes_usuario(
  p_user_id UUID,
  p_alteracoes JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item JSONB;
  v_chave TEXT;
  v_estado TEXT;
  v_permissao_id UUID;
  v_anterior TEXT;
  v_nome_operador TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao('administracao.permissoes.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar acessos individuais';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
  IF jsonb_typeof(COALESCE(p_alteracoes, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Formato de alterações inválido';
  END IF;

  SELECT COALESCE(p.nome, u.email, 'Usuário') INTO v_nome_operador
  FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = auth.uid();

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_alteracoes, '[]'::jsonb)) LOOP
    v_chave := btrim(COALESCE(v_item->>'chave', ''));
    v_estado := COALESCE(v_item->>'estado', 'herdar');
    IF v_estado NOT IN ('herdar', 'permitir', 'negar') THEN
      RAISE EXCEPTION 'Estado inválido para a permissão %', v_chave;
    END IF;

    SELECT id INTO v_permissao_id FROM public.permissoes_catalogo
    WHERE chave = v_chave AND ativo = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Permissão inexistente: %', v_chave; END IF;

    SELECT COALESCE(efeito, 'herdar') INTO v_anterior
    FROM public.usuario_permissoes
    WHERE user_id = p_user_id AND permissao_id = v_permissao_id;
    IF NOT FOUND THEN v_anterior := 'herdar'; END IF;

    IF v_estado = 'herdar' THEN
      DELETE FROM public.usuario_permissoes
      WHERE user_id = p_user_id AND permissao_id = v_permissao_id;
    ELSE
      INSERT INTO public.usuario_permissoes (
        user_id, permissao_id, efeito, criado_por, atualizado_por
      ) VALUES (
        p_user_id, v_permissao_id, v_estado, auth.uid(), auth.uid()
      )
      ON CONFLICT (user_id, permissao_id) DO UPDATE SET
        efeito = EXCLUDED.efeito,
        atualizado_por = auth.uid(),
        updated_at = now();
    END IF;

    IF v_anterior IS DISTINCT FROM v_estado THEN
      INSERT INTO public.permissoes_auditoria (
        usuario_alvo_id, permissao_id, chave_snapshot,
        estado_anterior, estado_novo, alterado_por_id, alterado_por_nome_snapshot
      ) VALUES (
        p_user_id, v_permissao_id, v_chave,
        v_anterior, v_estado, auth.uid(), v_nome_operador
      );
    END IF;
  END LOOP;
END;
$$;

-- Compatibilidade: funções e RLS históricas passam a consultar a autorização efetiva.
CREATE OR REPLACE FUNCTION public.can_create_items()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT public.usuario_tem_permissao('estoque.itens.criar');
$$;
CREATE OR REPLACE FUNCTION public.can_manage_inventory()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT public.usuario_tem_permissao('estoque.movimentacoes.registrar');
$$;

ALTER TABLE public.permissoes_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissoes_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissoes_catalogo_leitura ON public.permissoes_catalogo;
CREATE POLICY permissoes_catalogo_leitura ON public.permissoes_catalogo
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS perfil_permissoes_leitura ON public.perfil_permissoes;
CREATE POLICY perfil_permissoes_leitura ON public.perfil_permissoes
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS usuario_permissoes_leitura ON public.usuario_permissoes;
CREATE POLICY usuario_permissoes_leitura ON public.usuario_permissoes
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.usuario_tem_permissao('administracao.permissoes.gerenciar'));

DROP POLICY IF EXISTS permissoes_auditoria_leitura ON public.permissoes_auditoria;
CREATE POLICY permissoes_auditoria_leitura ON public.permissoes_auditoria
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao('administracao.auditoria.visualizar'));

REVOKE ALL ON FUNCTION public.usuario_tem_permissao(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obter_minhas_permissoes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_permissoes_usuario(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_permissoes_usuario(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_tem_permissao(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obter_minhas_permissoes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_permissoes_usuario(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_permissoes_usuario(UUID, JSONB) TO authenticated;

COMMIT;
