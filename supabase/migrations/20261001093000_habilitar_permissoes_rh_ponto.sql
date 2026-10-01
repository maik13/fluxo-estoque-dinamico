BEGIN;

ALTER TABLE public.usuario_permissoes_individuais
  DROP CONSTRAINT IF EXISTS usuario_permissoes_individuais_permissao_valida;

ALTER TABLE public.usuario_permissoes_individuais
  ADD CONSTRAINT usuario_permissoes_individuais_permissao_valida
  CHECK (permissao = ANY (ARRAY[
    'pode_cadastrar_itens','pode_editar_itens','pode_excluir_itens','pode_registrar_movimentacoes',
    'pode_solicitar_material','pode_devolver_material','pode_registrar_entrada','pode_registrar_saida',
    'pode_transferir','pode_editar_movimentacoes','pode_solicitacao_material','pode_pedido_compra',
    'pode_apontar_producao','pode_conferir_producao','pode_ver_bi_producao','pode_configurar_producao',
    'pode_gerenciar_configuracoes','pode_gerenciar_usuarios','pode_ver_relatorios','pode_acessar_gerencial',
    'pode_acessar_projetos','pode_acessar_financeiro','pode_gerenciar_financeiro','pode_aprovar_financeiro',
    'pode_programar_financeiro','pode_conciliar_financeiro','pode_ver_relatorios_financeiro',
    'rh_acessar','rh_colaboradores_visualizar','rh_colaboradores_gerenciar','rh_jornadas_gerenciar',
    'rh_feriados_gerenciar','ponto_registrar','ponto_visualizar','ponto_gerenciar','ponto_aprovar'
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

COMMIT;
NOTIFY pgrst,'reload schema';