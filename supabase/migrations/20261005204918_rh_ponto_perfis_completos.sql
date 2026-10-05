BEGIN;
ALTER TABLE public.permissoes_tipo_usuario
  ADD COLUMN IF NOT EXISTS rh_acessar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rh_colaboradores_visualizar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rh_colaboradores_gerenciar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rh_jornadas_gerenciar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rh_feriados_gerenciar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ponto_registrar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ponto_visualizar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ponto_gerenciar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ponto_aprovar boolean NOT NULL DEFAULT false;
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
    WHEN 'rh_acessar' THEN v_perfil.rh_acessar
    WHEN 'rh_colaboradores_visualizar' THEN v_perfil.rh_colaboradores_visualizar
    WHEN 'rh_colaboradores_gerenciar' THEN v_perfil.rh_colaboradores_gerenciar
    WHEN 'rh_jornadas_gerenciar' THEN v_perfil.rh_jornadas_gerenciar
    WHEN 'rh_feriados_gerenciar' THEN v_perfil.rh_feriados_gerenciar
    WHEN 'ponto_registrar' THEN v_perfil.ponto_registrar
    WHEN 'ponto_visualizar' THEN v_perfil.ponto_visualizar
    WHEN 'ponto_gerenciar' THEN v_perfil.ponto_gerenciar
    WHEN 'ponto_aprovar' THEN v_perfil.ponto_aprovar
    ELSE false
  END;

  RETURN COALESCE(v_padrao, false);
END;
$function$
;
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
    WHEN 'rh_acessar' THEN v.rh_acessar
    WHEN 'rh_colaboradores_visualizar' THEN v.rh_colaboradores_visualizar
    WHEN 'rh_colaboradores_gerenciar' THEN v.rh_colaboradores_gerenciar
    WHEN 'rh_jornadas_gerenciar' THEN v.rh_jornadas_gerenciar
    WHEN 'rh_feriados_gerenciar' THEN v.rh_feriados_gerenciar
    WHEN 'ponto_registrar' THEN v.ponto_registrar
    WHEN 'ponto_visualizar' THEN v.ponto_visualizar
    WHEN 'ponto_gerenciar' THEN v.ponto_gerenciar
    WHEN 'ponto_aprovar' THEN v.ponto_aprovar
    ELSE false END, false);
END;
$function$
;
NOTIFY pgrst, 'reload schema';
COMMIT;
