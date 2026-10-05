BEGIN;
-- Expand the existing access catalog without changing current grants.
ALTER TABLE public.usuario_permissoes_individuais DROP CONSTRAINT usuario_permissoes_individuais_permissao_valida;
ALTER TABLE public.usuario_permissoes_individuais ADD CONSTRAINT usuario_permissoes_individuais_permissao_valida CHECK ((permissao = ANY (ARRAY['pode_cadastrar_itens'::text, 'pode_editar_itens'::text, 'pode_excluir_itens'::text, 'pode_registrar_movimentacoes'::text, 'pode_solicitar_material'::text, 'pode_devolver_material'::text, 'pode_registrar_entrada'::text, 'pode_registrar_saida'::text, 'pode_transferir'::text, 'pode_editar_movimentacoes'::text, 'pode_solicitacao_material'::text, 'pode_pedido_compra'::text, 'pode_apontar_producao'::text, 'pode_conferir_producao'::text, 'pode_ver_bi_producao'::text, 'pode_configurar_producao'::text, 'pode_gerenciar_configuracoes'::text, 'pode_gerenciar_usuarios'::text, 'pode_ver_relatorios'::text, 'pode_acessar_gerencial'::text, 'pode_acessar_projetos'::text, 'pode_acessar_financeiro'::text, 'pode_gerenciar_financeiro'::text, 'pode_aprovar_financeiro'::text, 'pode_programar_financeiro'::text, 'pode_conciliar_financeiro'::text, 'pode_ver_relatorios_financeiro'::text, 'rh_acessar'::text, 'rh_colaboradores_visualizar'::text, 'rh_colaboradores_gerenciar'::text, 'rh_jornadas_gerenciar'::text, 'rh_feriados_gerenciar'::text, 'ponto_registrar'::text, 'ponto_visualizar'::text, 'ponto_gerenciar'::text, 'ponto_aprovar'::text, 'planejamento2_acessar'::text, 'acompanhamento_acessar'::text])));
CREATE OR REPLACE FUNCTION public.permissao_individual_efetiva(p_user_id uuid, p_permissao text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  IF p_permissao = 'planejamento2_acessar' THEN
    RETURN public.permissao_individual_efetiva(p_user_id,'pode_acessar_gerencial')
      OR public.permissao_individual_efetiva(p_user_id,'pode_acessar_projetos')
      OR public.permissao_individual_efetiva(p_user_id,'pode_configurar_producao');
  END IF;
  IF p_permissao = 'acompanhamento_acessar' THEN
    RETURN public.permissao_individual_efetiva(p_user_id,'pode_acessar_gerencial')
      OR public.permissao_individual_efetiva(p_user_id,'pode_acessar_projetos')
      OR public.permissao_individual_efetiva(p_user_id,'pode_apontar_producao')
      OR public.permissao_individual_efetiva(p_user_id,'pode_conferir_producao')
      OR public.permissao_individual_efetiva(p_user_id,'pode_ver_bi_producao')
      OR public.permissao_individual_efetiva(p_user_id,'pode_configurar_producao');
  END IF;

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
$function$
;
CREATE OR REPLACE FUNCTION public.obter_minhas_permissoes()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'financeiro.relatorios', public.permissao_individual_efetiva(auth.uid(),'pode_ver_relatorios_financeiro'),
    'planejamento2.acessar', public.permissao_individual_efetiva(auth.uid(),'planejamento2_acessar'),
    'acompanhamento.acessar', public.permissao_individual_efetiva(auth.uid(),'acompanhamento_acessar'),
    'rh.acessar', public.permissao_individual_efetiva(auth.uid(),'rh_acessar'),
    'rh.colaboradores.visualizar', public.permissao_individual_efetiva(auth.uid(),'rh_colaboradores_visualizar'),
    'rh.colaboradores.gerenciar', public.permissao_individual_efetiva(auth.uid(),'rh_colaboradores_gerenciar'),
    'rh.jornadas.gerenciar', public.permissao_individual_efetiva(auth.uid(),'rh_jornadas_gerenciar'),
    'rh.feriados.gerenciar', public.permissao_individual_efetiva(auth.uid(),'rh_feriados_gerenciar'),
    'ponto.registrar', public.permissao_individual_efetiva(auth.uid(),'ponto_registrar'),
    'ponto.visualizar', public.permissao_individual_efetiva(auth.uid(),'ponto_visualizar'),
    'ponto.gerenciar', public.permissao_individual_efetiva(auth.uid(),'ponto_gerenciar'),
    'ponto.aprovar', public.permissao_individual_efetiva(auth.uid(),'ponto_aprovar')
  );
$function$
;
CREATE OR REPLACE FUNCTION public.listar_permissoes_usuario(p_user_id uuid)
 RETURNS TABLE(permissao_id uuid, chave text, modulo text, grupo text, nome text, descricao text, ordem integer, perfil_permitido boolean, estado_individual text, permitido_efetivo boolean, origem text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      ('pode_ver_relatorios_financeiro','Financeiro','Relatórios','Visualizar relatórios financeiros','Permite consultar e exportar relatórios do módulo Financeiro.',350),
      ('rh_acessar','RH','Acesso','Acessar RH','Acessa as informações de RH autorizadas.',400),
      ('rh_colaboradores_visualizar','RH','Funcionários','Visualizar funcionários','Consulta funcionários do RH.',410),
      ('rh_colaboradores_gerenciar','RH','Funcionários','Gerenciar funcionários','Cadastra, edita e vincula usuários existentes aos funcionários.',420),
      ('rh_jornadas_gerenciar','RH','Jornadas','Gerenciar jornadas','Configura jornadas de trabalho.',430),
      ('rh_feriados_gerenciar','RH','Feriados','Gerenciar feriados','Configura feriados do ponto.',440),
      ('ponto_registrar','Ponto','Meu Ponto','Registrar o próprio ponto','Requer funcionário ativo com participação no ponto e login vinculado.',500),
      ('ponto_visualizar','Ponto','Controle','Visualizar ponto','Consulta os espelhos de ponto dos funcionários.',510),
      ('ponto_gerenciar','Ponto','Controle','Gerenciar ponto','Altera e fecha registros de ponto.',520),
      ('ponto_aprovar','Ponto','Controle','Aprovar ponto','Aprova registros de ponto.',530),
      ('planejamento2_acessar','Planejamento 2.0','Acesso','Acessar Planejamento 2.0','Exibe o módulo; dados e operações continuam sujeitos à autorização do App Controle.',600),
      ('acompanhamento_acessar','Acompanhamento do Pedido','Acesso','Acessar acompanhamento de pedidos','Exibe o módulo; dados continuam sujeitos à autorização do App Controle.',610)
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
$function$
;

CREATE UNIQUE INDEX IF NOT EXISTS rh_colaboradores_login_unico
  ON public.rh_colaboradores(user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION app_private.rh_listar_usuarios_vinculaveis()
RETURNS TABLE(user_id uuid,nome text,email text,colaborador_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.permissao_individual_efetiva(auth.uid(),'rh_colaboradores_gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar funcionários';
  END IF;
  RETURN QUERY SELECT p.user_id,p.nome,p.email,c.id
    FROM public.profiles p
    LEFT JOIN public.rh_colaboradores c ON c.user_id=p.user_id
    WHERE p.ativo=true
    ORDER BY p.nome,p.user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION app_private.rh_vincular_usuario_existente(p_colaborador_id uuid,p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_employee public.rh_colaboradores%ROWTYPE;
  v_previous text;
  v_actor text;
BEGIN
  IF v_user IS NULL OR NOT public.permissao_individual_efetiva(v_user,'rh_colaboradores_gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar funcionários';
  END IF;
  IF p_user_id IS NULL OR p_colaborador_id IS NULL THEN RAISE EXCEPTION 'Informe o usuário e o funcionário'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_profile.ativo IS DISTINCT FROM true THEN RAISE EXCEPTION 'Usuário não encontrado ou inativo'; END IF;
  SELECT * INTO v_employee FROM public.rh_colaboradores WHERE id=p_colaborador_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não encontrado'; END IF;
  IF v_employee.user_id IS NOT NULL AND v_employee.user_id<>p_user_id THEN
    RAISE EXCEPTION 'Este funcionário já possui outro login vinculado';
  END IF;
  IF EXISTS(SELECT 1 FROM public.rh_colaboradores WHERE user_id=p_user_id AND id<>p_colaborador_id) THEN
    RAISE EXCEPTION 'Este usuário já está vinculado a outro funcionário; edite o cadastro existente';
  END IF;
  UPDATE public.rh_colaboradores SET user_id=p_user_id,email=coalesce(v_profile.email,email)
    WHERE id=p_colaborador_id;
  IF v_employee.ativo AND v_employee.rh_ativo AND v_employee.controla_ponto THEN
    SELECT efeito INTO v_previous FROM public.usuario_permissoes_individuais
      WHERE user_id=p_user_id AND permissao='ponto_registrar';
    IF v_previous IS DISTINCT FROM 'permitir' THEN
      INSERT INTO public.usuario_permissoes_individuais(user_id,permissao,efeito,criado_por,atualizado_por)
        VALUES(p_user_id,'ponto_registrar','permitir',v_user,v_user)
        ON CONFLICT(user_id,permissao) DO UPDATE SET efeito='permitir',atualizado_por=v_user,updated_at=now();
      SELECT coalesce(nome,email,'Usuário') INTO v_actor FROM public.profiles WHERE user_id=v_user;
      INSERT INTO public.usuario_permissoes_individuais_auditoria(user_id,permissao,estado_anterior,estado_novo,alterado_por,alterado_por_nome)
        VALUES(p_user_id,'ponto_registrar',coalesce(v_previous,'herdar'),'permitir',v_user,v_actor);
    END IF;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.rh_listar_usuarios_vinculaveis() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION app_private.rh_vincular_usuario_existente(uuid,uuid) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.rh_listar_usuarios_vinculaveis() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.rh_vincular_usuario_existente(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_listar_usuarios_vinculaveis()
RETURNS TABLE(user_id uuid,nome text,email text,colaborador_id uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $function$ SELECT * FROM app_private.rh_listar_usuarios_vinculaveis(); $function$;
CREATE OR REPLACE FUNCTION public.rh_vincular_usuario_existente(p_colaborador_id uuid,p_user_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $function$ SELECT app_private.rh_vincular_usuario_existente(p_colaborador_id,p_user_id); $function$;
REVOKE ALL ON FUNCTION public.rh_listar_usuarios_vinculaveis() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.rh_vincular_usuario_existente(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rh_listar_usuarios_vinculaveis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_vincular_usuario_existente(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.permissao_individual_efetiva_por_perfil(p_tipo text, p_permissao text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    WHEN 'planejamento2_acessar' THEN v.pode_acessar_gerencial OR v.pode_acessar_projetos OR v.pode_configurar_producao
    WHEN 'acompanhamento_acessar' THEN v.pode_acessar_gerencial OR v.pode_acessar_projetos OR v.pode_apontar_producao OR v.pode_conferir_producao OR v.pode_ver_bi_producao OR v.pode_configurar_producao
    ELSE false END, false);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.rh_meu_ponto_disponivel()
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $function$
  SELECT CASE WHEN public.permissao_individual_efetiva(auth.uid(),'ponto_registrar')
    THEN public.rh_current_user_colaborador_id() IS NOT NULL ELSE false END;
$function$;
REVOKE ALL ON FUNCTION public.rh_meu_ponto_disponivel() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rh_meu_ponto_disponivel() TO authenticated;
COMMIT;
