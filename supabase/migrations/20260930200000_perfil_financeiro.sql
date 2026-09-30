BEGIN;

INSERT INTO public.permissoes_tipo_usuario(
  tipo_usuario,
  pode_cadastrar_itens,pode_editar_itens,pode_excluir_itens,pode_registrar_movimentacoes,
  pode_gerenciar_configuracoes,pode_gerenciar_usuarios,pode_solicitar_material,pode_devolver_material,
  pode_registrar_entrada,pode_transferir,pode_registrar_saida,pode_pedido_compra,pode_solicitacao_material,
  pode_ver_relatorios,pode_editar_movimentacoes,pode_acessar_gerencial,pode_acessar_projetos,
  pode_apontar_producao,pode_conferir_producao,pode_ver_bi_producao,pode_configurar_producao,
  pode_acessar_financeiro,pode_gerenciar_financeiro,pode_aprovar_financeiro,pode_programar_financeiro,pode_conciliar_financeiro
) VALUES (
  'financeiro',
  false,false,false,false,
  false,false,false,false,
  false,false,false,false,false,
  false,false,false,false,
  false,false,false,false,
  true,true,true,true,true
)
ON CONFLICT (tipo_usuario) DO UPDATE SET
  pode_acessar_financeiro=true,
  pode_gerenciar_financeiro=true,
  pode_aprovar_financeiro=true,
  pode_programar_financeiro=true,
  pode_conciliar_financeiro=true,
  updated_at=now();

COMMIT;