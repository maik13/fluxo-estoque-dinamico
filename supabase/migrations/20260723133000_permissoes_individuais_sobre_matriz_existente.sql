-- Permissões individuais sobre a matriz existente permissoes_tipo_usuario.
-- Não cria um segundo catálogo. Cada usuário herda os campos do perfil-base
-- e armazena somente exceções: permitir ou negar.

BEGIN;

CREATE TABLE IF NOT EXISTS public.usuario_permissoes_individuais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissao TEXT NOT NULL,
  efeito TEXT NOT NULL CHECK (efeito IN ('permitir', 'negar')),
  criado_por UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  atualizado_por UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, permissao),
  CONSTRAINT usuario_permissoes_individuais_permissao_valida CHECK (
    permissao IN (
      'pode_cadastrar_itens',
      'pode_editar_itens',
      'pode_excluir_itens',
      'pode_registrar_movimentacoes',
      'pode_solicitar_material',
      'pode_devolver_material',
      'pode_registrar_entrada',
      'pode_registrar_saida',
      'pode_transferir',
      'pode_editar_movimentacoes',
      'pode_solicitacao_material',
      'pode_pedido_compra',
      'pode_apontar_producao',
      'pode_conferir_producao',
      'pode_ver_bi_producao',
      'pode_configurar_producao',
      'pode_gerenciar_configuracoes',
      'pode_gerenciar_usuarios',
      'pode_ver_relatorios',
      'pode_acessar_gerencial',
      'pode_acessar_projetos'
    )
  )
);

CREATE TABLE IF NOT EXISTS public.usuario_permissoes_individuais_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissao TEXT NOT NULL,
  estado_anterior TEXT NOT NULL CHECK (estado_anterior IN ('herdar', 'permitir', 'negar')),
  estado_novo TEXT NOT NULL CHECK (estado_novo IN ('herdar', 'permitir', 'negar')),
  alterado_por UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  alterado_por_nome TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usuario_permissoes_individuais_user_idx
  ON public.usuario_permissoes_individuais(user_id, permissao);
CREATE INDEX IF NOT EXISTS usuario_permissoes_individuais_auditoria_idx
  ON public.usuario_permissoes_individuais_auditoria(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.permissao_individual_efetiva(
  p_user_id UUID,
  p_permissao TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_tipo TEXT;
  v_efeito TEXT;
  v_perfil public.permissoes_tipo_usuario%ROWTYPE;
  v_padrao BOOLEAN := false;
BEGIN
  SELECT tipo_usuario INTO v_tipo
  FROM public.profiles
  WHERE user_id = p_user_id AND COALESCE(ativo, true) = true
  LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_tipo = 'administrador' THEN RETURN true; END IF;

  SELECT efeito INTO v_efeito
  FROM public.usuario_permissoes_individuais
  WHERE user_id = p_user_id AND permissao = p_permissao;

  IF v_efeito = 'permitir' THEN RETURN true; END IF;
  IF v_efeito = 'negar' THEN RETURN false; END IF;

  SELECT * INTO v_perfil
  FROM public.permissoes_tipo_usuario
  WHERE tipo_usuario = v_tipo
  LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;

  v_padrao := CASE p_permissao
    WHEN 'pode_cadastrar_itens' THEN v_perfil.pode_cadastrar_itens
    WHEN 'pode_editar_itens' THEN v_perfil.pode_editar_itens
    WHEN 'pode_excluir_itens' THEN v_perfil.pode_excluir_itens
    WHEN 'pode_registrar_movimentacoes' THEN v_perfil.pode_registrar_movimentacoes
    WHEN 'pode_solicitar_material' THEN v_perfil.pode_solicitar_material
    WHEN 'pode_devolver_material' THEN v_perfil.pode_devolver_material
    WHEN 'pode_registrar_entrada' THEN v_perfil.pode_registrar_entrada
    WHEN 'pode_registrar_saida' THEN v_perfil.pode_registrar_saida
    WHEN 'pode_transferir' THEN v_perfil.pode_transferir
    WHEN 'pode_editar_movimentacoes' THEN v_perfil.pode_editar_movimentacoes
    WHEN 'pode_solicitacao_material' THEN v_perfil.pode_solicitacao_material
    WHEN 'pode_pedido_compra' THEN v_perfil.pode_pedido_compra
    WHEN 'pode_apontar_producao' THEN v_perfil.pode_apontar_producao
    WHEN 'pode_conferir_producao' THEN v_perfil.pode_conferir_producao
    WHEN 'pode_ver_bi_producao' THEN v_perfil.pode_ver_bi_producao
    WHEN 'pode_configurar_producao' THEN v_perfil.pode_configurar_producao
    WHEN 'pode_gerenciar_configuracoes' THEN v_perfil.pode_gerenciar_configuracoes
    WHEN 'pode_gerenciar_usuarios' THEN v_perfil.pode_gerenciar_usuarios
    WHEN 'pode_ver_relatorios' THEN v_perfil.pode_ver_relatorios
    WHEN 'pode_acessar_gerencial' THEN v_perfil.pode_acessar_gerencial
    WHEN 'pode_acessar_projetos' THEN v_perfil.pode_acessar_projetos
    ELSE false
  END;

  RETURN COALESCE(v_padrao, false);
END;
$$;

-- Mantém os mesmos nomes de RPC já usados pela interface, mas agora lendo
-- diretamente a matriz permissoes_tipo_usuario.
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
DECLARE
  v_tipo TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_user_id <> auth.uid()
     AND NOT public.is_admin()
     AND NOT public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_usuarios') THEN
    RAISE EXCEPTION 'Sem permissão para consultar acessos de outro usuário';
  END IF;

  SELECT tipo_usuario INTO v_tipo FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;

  RETURN QUERY
  WITH catalogo(chave, modulo, grupo, nome, descricao, ordem) AS (
    VALUES
      ('pode_cadastrar_itens','Estoque','Gestão de Itens','Cadastrar itens','Cadastra novos itens no estoque.',10),
      ('pode_editar_itens','Estoque','Gestão de Itens','Editar itens','Altera dados cadastrais dos itens.',20),
      ('pode_excluir_itens','Estoque','Gestão de Itens','Excluir itens','Exclui itens quando permitido.',30),
      ('pode_registrar_movimentacoes','Estoque','Movimentações','Registrar movimentações','Permissão geral de movimentação.',40),
      ('pode_solicitar_material','Estoque','Movimentações','Solicitar material','Cria solicitações de material.',50),
      ('pode_devolver_material','Estoque','Movimentações','Devolver material','Registra devoluções.',60),
      ('pode_registrar_entrada','Estoque','Movimentações','Registrar entrada','Registra entradas no estoque.',70),
      ('pode_registrar_saida','Estoque','Movimentações','Registrar saída','Registra saídas do estoque.',80),
      ('pode_transferir','Estoque','Movimentações','Transferir entre estoques','Transfere materiais entre estoques.',90),
      ('pode_editar_movimentacoes','Estoque','Movimentações','Editar movimentações','Corrige movimentações existentes.',100),
      ('pode_solicitacao_material','Estoque','Solicitações e Compras','Gerenciar solicitações','Consulta e gerencia solicitações.',110),
      ('pode_pedido_compra','Compras','Solicitações e Compras','Pedido de compra','Acessa pedidos de compra.',120),
      ('pode_apontar_producao','Produção','Produção','Apontar Produção','Registra apontamentos de produção.',130),
      ('pode_conferir_producao','Produção','Produção','Conferir Produção','Confere apontamentos de produção.',140),
      ('pode_ver_bi_producao','Produção','Produção','Ver BI Produção','Acessa o BI de Produção.',150),
      ('pode_configurar_producao','Produção','Produção','Configurar Produção','Gerencia configurações da Produção.',160),
      ('pode_gerenciar_configuracoes','Administração','Administração','Gerenciar configurações','Altera configurações gerais.',170),
      ('pode_gerenciar_usuarios','Administração','Administração','Gerenciar usuários','Cria, edita e ativa usuários e acessos.',180),
      ('pode_ver_relatorios','Administração','Administração','Ver relatórios','Acessa relatórios.',190),
      ('pode_acessar_gerencial','Administração','Administração','Acessar painel gerencial','Acessa indicadores gerenciais.',200),
      ('pode_acessar_projetos','Administração','Administração','Acessar projetos','Acessa a área de projetos.',210)
  )
  SELECT
    md5(c.chave)::uuid,
    c.chave,
    c.modulo,
    c.grupo,
    c.nome,
    c.descricao,
    c.ordem,
    public.permissao_individual_efetiva_por_perfil(v_tipo, c.chave),
    COALESCE(up.efeito, 'herdar'),
    public.permissao_individual_efetiva(p_user_id, c.chave),
    CASE WHEN v_tipo = 'administrador' THEN 'administrador'
         WHEN up.efeito IS NOT NULL THEN 'individual'
         ELSE 'perfil' END
  FROM catalogo c
  LEFT JOIN public.usuario_permissoes_individuais up
    ON up.user_id = p_user_id AND up.permissao = c.chave
  ORDER BY c.ordem;
END;
$$;

CREATE OR REPLACE FUNCTION public.permissao_individual_efetiva_por_perfil(
  p_tipo TEXT,
  p_permissao TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE v public.permissoes_tipo_usuario%ROWTYPE;
BEGIN
  IF p_tipo = 'administrador' THEN RETURN true; END IF;
  SELECT * INTO v FROM public.permissoes_tipo_usuario WHERE tipo_usuario = p_tipo LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN COALESCE(CASE p_permissao
    WHEN 'pode_cadastrar_itens' THEN v.pode_cadastrar_itens
    WHEN 'pode_editar_itens' THEN v.pode_editar_itens
    WHEN 'pode_excluir_itens' THEN v.pode_excluir_itens
    WHEN 'pode_registrar_movimentacoes' THEN v.pode_registrar_movimentacoes
    WHEN 'pode_solicitar_material' THEN v.pode_solicitar_material
    WHEN 'pode_devolver_material' THEN v.pode_devolver_material
    WHEN 'pode_registrar_entrada' THEN v.pode_registrar_entrada
    WHEN 'pode_registrar_saida' THEN v.pode_registrar_saida
    WHEN 'pode_transferir' THEN v.pode_transferir
    WHEN 'pode_editar_movimentacoes' THEN v.pode_editar_movimentacoes
    WHEN 'pode_solicitacao_material' THEN v.pode_solicitacao_material
    WHEN 'pode_pedido_compra' THEN v.pode_pedido_compra
    WHEN 'pode_apontar_producao' THEN v.pode_apontar_producao
    WHEN 'pode_conferir_producao' THEN v.pode_conferir_producao
    WHEN 'pode_ver_bi_producao' THEN v.pode_ver_bi_producao
    WHEN 'pode_configurar_producao' THEN v.pode_configurar_producao
    WHEN 'pode_gerenciar_configuracoes' THEN v.pode_gerenciar_configuracoes
    WHEN 'pode_gerenciar_usuarios' THEN v.pode_gerenciar_usuarios
    WHEN 'pode_ver_relatorios' THEN v.pode_ver_relatorios
    WHEN 'pode_acessar_gerencial' THEN v.pode_acessar_gerencial
    WHEN 'pode_acessar_projetos' THEN v.pode_acessar_projetos
    ELSE false END, false);
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
  v_permissao TEXT;
  v_estado TEXT;
  v_anterior TEXT;
  v_nome TEXT;
BEGIN
  IF auth.uid() IS NULL OR (
    NOT public.is_admin()
    AND NOT public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_usuarios')
  ) THEN RAISE EXCEPTION 'Sem permissão para gerenciar acessos'; END IF;

  SELECT COALESCE(p.nome, p.email, 'Usuário') INTO v_nome
  FROM public.profiles p WHERE p.user_id = auth.uid();

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_alteracoes, '[]'::jsonb)) LOOP
    v_permissao := COALESCE(v_item->>'chave', '');
    v_estado := COALESCE(v_item->>'estado', 'herdar');
    IF v_estado NOT IN ('herdar','permitir','negar') THEN
      RAISE EXCEPTION 'Estado inválido';
    END IF;

    SELECT efeito INTO v_anterior
    FROM public.usuario_permissoes_individuais
    WHERE user_id = p_user_id AND permissao = v_permissao;
    v_anterior := COALESCE(v_anterior, 'herdar');

    IF v_estado = 'herdar' THEN
      DELETE FROM public.usuario_permissoes_individuais
      WHERE user_id = p_user_id AND permissao = v_permissao;
    ELSE
      INSERT INTO public.usuario_permissoes_individuais(
        user_id, permissao, efeito, criado_por, atualizado_por
      ) VALUES (p_user_id, v_permissao, v_estado, auth.uid(), auth.uid())
      ON CONFLICT(user_id, permissao) DO UPDATE SET
        efeito = EXCLUDED.efeito,
        atualizado_por = auth.uid(),
        updated_at = now();
    END IF;

    IF v_anterior IS DISTINCT FROM v_estado THEN
      INSERT INTO public.usuario_permissoes_individuais_auditoria(
        user_id, permissao, estado_anterior, estado_novo,
        alterado_por, alterado_por_nome
      ) VALUES (
        p_user_id, v_permissao, v_anterior, v_estado,
        auth.uid(), v_nome
      );
    END IF;
  END LOOP;
END;
$$;

-- Mapa esperado pelo hook atual da aplicação.
CREATE OR REPLACE FUNCTION public.obter_minhas_permissoes()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'estoque.itens.criar', public.permissao_individual_efetiva(auth.uid(),'pode_cadastrar_itens'),
    'estoque.itens.editar', public.permissao_individual_efetiva(auth.uid(),'pode_editar_itens'),
    'estoque.itens.excluir', public.permissao_individual_efetiva(auth.uid(),'pode_excluir_itens'),
    'estoque.movimentacoes.registrar', public.permissao_individual_efetiva(auth.uid(),'pode_registrar_movimentacoes'),
    'estoque.movimentacoes.entrada', public.permissao_individual_efetiva(auth.uid(),'pode_registrar_entrada'),
    'estoque.movimentacoes.saida', public.permissao_individual_efetiva(auth.uid(),'pode_registrar_saida'),
    'estoque.movimentacoes.transferir', public.permissao_individual_efetiva(auth.uid(),'pode_transferir'),
    'estoque.movimentacoes.editar', public.permissao_individual_efetiva(auth.uid(),'pode_editar_movimentacoes'),
    'estoque.solicitacoes.solicitar', public.permissao_individual_efetiva(auth.uid(),'pode_solicitar_material'),
    'estoque.solicitacoes.devolver', public.permissao_individual_efetiva(auth.uid(),'pode_devolver_material'),
    'estoque.solicitacoes.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_solicitacao_material'),
    'compras.pedidos.criar', public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra'),
    'compras.pedidos.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra'),
    'projetos.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_acessar_projetos'),
    'gerencial.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_acessar_gerencial'),
    'relatorios.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_ver_relatorios'),
    'producao.acessar', public.permissao_individual_efetiva(auth.uid(),'pode_apontar_producao') OR public.permissao_individual_efetiva(auth.uid(),'pode_conferir_producao') OR public.permissao_individual_efetiva(auth.uid(),'pode_ver_bi_producao') OR public.permissao_individual_efetiva(auth.uid(),'pode_configurar_producao'),
    'producao.apontamentos.criar', public.permissao_individual_efetiva(auth.uid(),'pode_apontar_producao'),
    'producao.apontamentos.editar', public.permissao_individual_efetiva(auth.uid(),'pode_apontar_producao'),
    'producao.apontamentos.conferir', public.permissao_individual_efetiva(auth.uid(),'pode_conferir_producao'),
    'producao.bi.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_ver_bi_producao'),
    'producao.configuracoes.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_configurar_producao'),
    'producao.projetos.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_configurar_producao'),
    'producao.etapas.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_configurar_producao'),
    'producao.cronograma.configurar', public.permissao_individual_efetiva(auth.uid(),'pode_configurar_producao'),
    'administracao.configuracoes.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_configuracoes'),
    'administracao.usuarios.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_usuarios'),
    'administracao.usuarios.criar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_usuarios'),
    'administracao.usuarios.editar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_usuarios'),
    'administracao.usuarios.ativar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_usuarios'),
    'administracao.permissoes.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_usuarios')
  );
$$;

ALTER TABLE public.usuario_permissoes_individuais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_permissoes_individuais_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuario_permissoes_individuais_leitura ON public.usuario_permissoes_individuais;
CREATE POLICY usuario_permissoes_individuais_leitura
ON public.usuario_permissoes_individuais FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_usuarios')
);

DROP POLICY IF EXISTS usuario_permissoes_individuais_auditoria_leitura ON public.usuario_permissoes_individuais_auditoria;
CREATE POLICY usuario_permissoes_individuais_auditoria_leitura
ON public.usuario_permissoes_individuais_auditoria FOR SELECT TO authenticated
USING (public.is_admin());

REVOKE ALL ON FUNCTION public.listar_permissoes_usuario(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_permissoes_usuario(UUID,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obter_minhas_permissoes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_permissoes_usuario(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_permissoes_usuario(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obter_minhas_permissoes() TO authenticated;

COMMIT;
