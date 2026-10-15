DO $$ DECLARE d text; BEGIN
SELECT pg_get_constraintdef(oid) INTO d FROM pg_constraint WHERE conname='usuario_permissoes_individuais_permissao_valida';
IF position('orcamento_solicitar' in d)=0 THEN
d:=replace(d,'''imagens_op_acessar''::text','''imagens_op_acessar''::text, ''orcamento_solicitar''::text');
ALTER TABLE public.usuario_permissoes_individuais DROP CONSTRAINT usuario_permissoes_individuais_permissao_valida;
EXECUTE 'ALTER TABLE public.usuario_permissoes_individuais ADD CONSTRAINT usuario_permissoes_individuais_permissao_valida '||d;
END IF; END $$;
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
      ('orcamento_solicitar','Compras','Solicitações e Compras','Solicitar orçamento','Envia solicitações de orçamento ao Almoxarifado, sem gerenciar cotações ou compras.',115),
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
$function$
