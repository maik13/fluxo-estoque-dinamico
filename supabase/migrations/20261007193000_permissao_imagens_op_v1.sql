BEGIN;

ALTER TABLE public.usuario_permissoes_individuais
  DROP CONSTRAINT IF EXISTS usuario_permissoes_individuais_permissao_valida;

ALTER TABLE public.usuario_permissoes_individuais
  ADD CONSTRAINT usuario_permissoes_individuais_permissao_valida
  CHECK (permissao = ANY (ARRAY[
    'pode_cadastrar_itens','pode_editar_itens','pode_excluir_itens',
    'pode_registrar_movimentacoes','pode_solicitar_material','pode_devolver_material',
    'pode_registrar_entrada','pode_registrar_saida','pode_transferir',
    'pode_editar_movimentacoes','pode_solicitacao_material','pode_pedido_compra',
    'pode_apontar_producao','pode_conferir_producao','pode_ver_bi_producao',
    'pode_configurar_producao','pode_gerenciar_configuracoes','pode_gerenciar_usuarios',
    'pode_ver_relatorios','pode_acessar_gerencial','pode_acessar_projetos',
    'pode_acessar_financeiro','pode_gerenciar_financeiro','pode_aprovar_financeiro',
    'pode_programar_financeiro','pode_conciliar_financeiro','pode_ver_relatorios_financeiro',
    'rh_acessar','rh_colaboradores_visualizar','rh_colaboradores_gerenciar',
    'rh_jornadas_gerenciar','rh_feriados_gerenciar',
    'ponto_registrar','ponto_visualizar','ponto_gerenciar','ponto_aprovar',
    'planejamento2_acessar','acompanhamento_acessar','imagens_op_acessar'
  ]));

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
    'producao.acessar', public.permissao_individual_efetiva(auth.uid(),'pode_apontar_producao')
      OR public.permissao_individual_efetiva(auth.uid(),'pode_conferir_producao')
      OR public.permissao_individual_efetiva(auth.uid(),'pode_ver_bi_producao')
      OR public.permissao_individual_efetiva(auth.uid(),'pode_configurar_producao'),
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
    'imagensop.acessar', public.permissao_individual_efetiva(auth.uid(),'imagens_op_acessar'),
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
$function$;

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
      ('acompanhamento_acessar','Acompanhamento do Pedido','Acesso','Acessar acompanhamento de pedidos','Exibe o módulo; dados continuam sujeitos à autorização do App Controle.',610),
      ('imagens_op_acessar','Imagens OP','Acesso','Acessar Imagens OP','Visualiza no Fluxo de Estoque as fotos das OPs armazenadas no App Controle.',620)
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
$function$;

COMMIT;