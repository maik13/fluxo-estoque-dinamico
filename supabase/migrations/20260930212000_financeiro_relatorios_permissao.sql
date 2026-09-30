BEGIN;

ALTER TABLE public.permissoes_tipo_usuario
  ADD COLUMN IF NOT EXISTS pode_ver_relatorios_financeiro BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.usuario_permissoes_individuais
  DROP CONSTRAINT IF EXISTS usuario_permissoes_individuais_permissao_valida;

ALTER TABLE public.usuario_permissoes_individuais
  ADD CONSTRAINT usuario_permissoes_individuais_permissao_valida CHECK (
    permissao IN (
      'pode_cadastrar_itens','pode_editar_itens','pode_excluir_itens',
      'pode_registrar_movimentacoes','pode_solicitar_material','pode_devolver_material',
      'pode_registrar_entrada','pode_registrar_saida','pode_transferir',
      'pode_editar_movimentacoes','pode_solicitacao_material','pode_pedido_compra',
      'pode_apontar_producao','pode_conferir_producao','pode_ver_bi_producao',
      'pode_configurar_producao','pode_gerenciar_configuracoes','pode_gerenciar_usuarios',
      'pode_ver_relatorios','pode_acessar_gerencial','pode_acessar_projetos',
      'pode_acessar_financeiro','pode_gerenciar_financeiro','pode_aprovar_financeiro',
      'pode_programar_financeiro','pode_conciliar_financeiro','pode_ver_relatorios_financeiro'
    )
  );

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
    WHEN 'pode_acessar_financeiro' THEN v_perfil.pode_acessar_financeiro
    WHEN 'pode_gerenciar_financeiro' THEN v_perfil.pode_gerenciar_financeiro
    WHEN 'pode_aprovar_financeiro' THEN v_perfil.pode_aprovar_financeiro
    WHEN 'pode_programar_financeiro' THEN v_perfil.pode_programar_financeiro
    WHEN 'pode_conciliar_financeiro' THEN v_perfil.pode_conciliar_financeiro
    WHEN 'pode_ver_relatorios_financeiro' THEN v_perfil.pode_ver_relatorios_financeiro
    ELSE false
  END;

  RETURN COALESCE(v_padrao, false);
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
    WHEN 'pode_acessar_financeiro' THEN v.pode_acessar_financeiro
    WHEN 'pode_gerenciar_financeiro' THEN v.pode_gerenciar_financeiro
    WHEN 'pode_aprovar_financeiro' THEN v.pode_aprovar_financeiro
    WHEN 'pode_programar_financeiro' THEN v.pode_programar_financeiro
    WHEN 'pode_conciliar_financeiro' THEN v.pode_conciliar_financeiro
    WHEN 'pode_ver_relatorios_financeiro' THEN v.pode_ver_relatorios_financeiro
    ELSE false END, false);
END;
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
      ('pode_registrar_movimentacoes','Estoque','Movimentações diretas','Registrar movimentações','Permissão geral para registrar movimentações.',40),
      ('pode_solicitar_material','Estoque','Retirada e devolução','Retirada de Material','Solicita itens existentes no estoque.',50),
      ('pode_devolver_material','Estoque','Retirada e devolução','Devolver material','Registra devoluções.',60),
      ('pode_registrar_entrada','Estoque','Movimentações diretas','Registrar entrada','Registra entradas no estoque.',70),
      ('pode_registrar_saida','Estoque','Movimentações diretas','Registrar saída','Registra saídas diretas do estoque.',80),
      ('pode_transferir','Estoque','Movimentações diretas','Transferir entre estoques','Transfere materiais entre estoques.',90),
      ('pode_editar_movimentacoes','Estoque','Movimentações diretas','Editar movimentações','Corrige movimentações existentes.',100),
      ('pode_solicitacao_material','Estoque','Solicitações e Compras','Solicitação de Material','Gerencia solicitações, inclusive itens sem saldo ou não cadastrados.',110),
      ('pode_pedido_compra','Compras','Solicitações e Compras','Requisição de compra (RC)','Acessa e gerencia requisições de compra.',120),
      ('pode_apontar_producao','Produção','Produção','Apontar Produção','Registra apontamentos de produção.',130),
      ('pode_conferir_producao','Produção','Produção','Conferir Produção','Confere apontamentos de produção.',140),
      ('pode_ver_bi_producao','Gerencial','BI Produção','Ver somente BI Produção','Libera exclusivamente o BI Produção.',150),
      ('pode_configurar_producao','Produção','Produção','Configurar Produção','Gerencia configurações da Produção.',160),
      ('pode_gerenciar_configuracoes','Administração','Administração','Gerenciar configurações','Altera configurações gerais.',170),
      ('pode_gerenciar_usuarios','Administração','Administração','Gerenciar usuários','Cria, edita e ativa usuários e acessos.',180),
      ('pode_ver_relatorios','Administração','Administração','Ver relatórios','Acessa relatórios gerais.',190),
      ('pode_acessar_gerencial','Gerencial','Gerencial de Almoxarifado','Acessar Gerencial de Almoxarifado','Acessa indicadores gerenciais.',200),
      ('pode_acessar_projetos','Administração','Administração','Acessar projetos','Acessa a área de projetos.',210),
      ('pode_acessar_financeiro','Financeiro','Acesso','Acessar Financeiro','Visualiza o módulo Financeiro e seus dados permitidos.',300),
      ('pode_gerenciar_financeiro','Financeiro','Operação','Gerenciar Financeiro','Cria e ajusta PN, previsões, RCs e PCs.',310),
      ('pode_aprovar_financeiro','Financeiro','Aprovação','Aprovar compromissos','Permite aprovar ou rejeitar compromissos financeiros.',320),
      ('pode_programar_financeiro','Financeiro','Programação bancária','Programar pagamentos','Permite registrar a programação bancária operacional.',330),
      ('pode_conciliar_financeiro','Financeiro','Conciliação','Conciliar banco','Permite fechar posição bancária e tratar divergências.',340),
      ('pode_ver_relatorios_financeiro','Financeiro','Relatórios','Visualizar relatórios financeiros','Permite consultar e exportar relatórios do módulo Financeiro.',350)
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
    'administracao.permissoes.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_usuarios'),
    'financeiro.visualizar', public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro'),
    'financeiro.gerenciar', public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'),
    'financeiro.aprovar', public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro'),
    'financeiro.programar', public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro'),
    'financeiro.conciliar', public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro'),
    'financeiro.relatorios', public.permissao_individual_efetiva(auth.uid(),'pode_ver_relatorios_financeiro')
  );
$$;

COMMIT;
