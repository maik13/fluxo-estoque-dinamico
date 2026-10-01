BEGIN;

-- Perfil mínimo para usuários que apenas utilizam o próprio ponto.
INSERT INTO public.permissoes_tipo_usuario(
  tipo_usuario,
  pode_cadastrar_itens,pode_editar_itens,pode_excluir_itens,pode_registrar_movimentacoes,
  pode_gerenciar_configuracoes,pode_gerenciar_usuarios,pode_solicitar_material,pode_devolver_material,
  pode_registrar_entrada,pode_transferir,pode_registrar_saida,pode_pedido_compra,pode_solicitacao_material,
  pode_ver_relatorios,pode_editar_movimentacoes,pode_acessar_gerencial,pode_acessar_projetos,
  pode_apontar_producao,pode_conferir_producao,pode_ver_bi_producao,pode_configurar_producao,
  pode_acessar_financeiro,pode_gerenciar_financeiro,pode_aprovar_financeiro,pode_programar_financeiro,
  pode_conciliar_financeiro,pode_ver_relatorios_financeiro
)
SELECT
  'colaborador',
  false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,
  false,false,false,false,false,false,false,false,false,false,false
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissoes_tipo_usuario WHERE tipo_usuario='colaborador'
);

CREATE OR REPLACE FUNCTION public.rh_set_colaborador_contextos(
  p_colaborador_id uuid,
  p_rh_ativo boolean,
  p_pista_ativo boolean
)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_user uuid:=auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.permissao_individual_efetiva(v_user,'rh_colaboradores_gerenciar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para gerenciar colaboradores do RH';
  END IF;

  UPDATE public.rh_colaboradores
  SET rh_ativo=coalesce(p_rh_ativo,false),
      pista_ativo_legado=coalesce(p_pista_ativo,false),
      controla_ponto=CASE WHEN coalesce(p_rh_ativo,false) THEN controla_ponto ELSE false END,
      ativo=CASE WHEN coalesce(p_rh_ativo,false) OR coalesce(p_pista_ativo,false) THEN true ELSE ativo END
  WHERE id=p_colaborador_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não encontrado'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rh_update_colaborador_fields(
  p_colaborador_id uuid,
  p_nome text,
  p_email text,
  p_cpf_cnpj text,
  p_telefone text,
  p_data_nascimento date,
  p_endereco text,
  p_cidade text,
  p_estado text,
  p_cep text,
  p_cargo text,
  p_departamento text,
  p_salario numeric,
  p_data_admissao date,
  p_pis text,
  p_jornada_id uuid,
  p_controla_ponto boolean,
  p_tipo_contrato text,
  p_valor_contrato numeric,
  p_hora_extra_gera_valor boolean
)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_tipo text:=lower(btrim(coalesce(p_tipo_contrato,'clt')));
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.permissao_individual_efetiva(v_user,'rh_colaboradores_gerenciar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para gerenciar colaboradores do RH';
  END IF;
  IF nullif(btrim(coalesce(p_nome,'')),'') IS NULL THEN RAISE EXCEPTION 'Nome é obrigatório'; END IF;
  IF v_tipo NOT IN ('clt','pj','diarista','horista') THEN RAISE EXCEPTION 'Tipo de contrato inválido'; END IF;
  IF p_jornada_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.rh_jornadas WHERE id=p_jornada_id) THEN
    RAISE EXCEPTION 'Jornada não encontrada';
  END IF;

  UPDATE public.rh_colaboradores
  SET nome=btrim(p_nome),
      email=nullif(btrim(p_email),''),
      cpf_cnpj=nullif(btrim(p_cpf_cnpj),''),
      telefone=nullif(btrim(p_telefone),''),
      data_nascimento=p_data_nascimento,
      endereco=nullif(btrim(p_endereco),''),
      cidade=nullif(btrim(p_cidade),''),
      estado=nullif(upper(btrim(p_estado)),''),
      cep=nullif(btrim(p_cep),''),
      cargo=nullif(btrim(p_cargo),''),
      departamento=nullif(btrim(p_departamento),''),
      salario=CASE WHEN v_tipo='clt' THEN p_salario ELSE NULL END,
      data_admissao=p_data_admissao,
      pis=nullif(btrim(p_pis),''),
      jornada_id=p_jornada_id,
      controla_ponto=CASE WHEN rh_ativo THEN coalesce(p_controla_ponto,false) ELSE false END,
      tipo_contrato=v_tipo,
      valor_contrato=CASE WHEN v_tipo='clt' THEN NULL ELSE p_valor_contrato END,
      hora_extra_gera_valor=CASE WHEN v_tipo='horista' THEN false ELSE coalesce(p_hora_extra_gera_valor,true) END,
      rh_cadastrado=true
  WHERE id=p_colaborador_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não encontrado'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rh_delete_colaborador(p_colaborador_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_origem text;
  v_tem_historico boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.permissao_individual_efetiva(v_user,'rh_colaboradores_gerenciar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para gerenciar colaboradores do RH';
  END IF;

  SELECT origem_sistema,
    EXISTS(SELECT 1 FROM public.rh_registros_ponto p WHERE p.colaborador_id=c.id)
    OR EXISTS(SELECT 1 FROM public.rh_ponto_dias_pagos d WHERE d.colaborador_id=c.id)
  INTO v_origem,v_tem_historico
  FROM public.rh_colaboradores c WHERE c.id=p_colaborador_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não encontrado'; END IF;

  IF v_origem='appcontrole' OR v_tem_historico THEN
    UPDATE public.rh_colaboradores
    SET ativo=false,rh_ativo=false,controla_ponto=false,pista_ativo_legado=false
    WHERE id=p_colaborador_id;
    RETURN 'inativado';
  END IF;

  DELETE FROM public.rh_colaboradores WHERE id=p_colaborador_id;
  RETURN 'excluido';
END;
$$;

CREATE OR REPLACE FUNCTION public.rh_remover_jornada(p_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_origem text;
  v_vinculada boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.permissao_individual_efetiva(v_user,'rh_jornadas_gerenciar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para gerenciar jornadas';
  END IF;

  SELECT origem_sistema, EXISTS(SELECT 1 FROM public.rh_colaboradores c WHERE c.jornada_id=j.id)
  INTO v_origem,v_vinculada
  FROM public.rh_jornadas j WHERE j.id=p_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Jornada não encontrada'; END IF;

  IF v_origem='appcontrole' OR v_vinculada THEN
    UPDATE public.rh_jornadas SET ativo=false WHERE id=p_id;
    RETURN 'inativada';
  END IF;

  DELETE FROM public.rh_jornadas WHERE id=p_id;
  RETURN 'excluida';
END;
$$;

CREATE OR REPLACE FUNCTION public.rh_remover_feriado(p_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_origem text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.permissao_individual_efetiva(v_user,'rh_feriados_gerenciar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para gerenciar feriados';
  END IF;

  SELECT origem_sistema INTO v_origem FROM public.rh_feriados WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Feriado não encontrado'; END IF;

  IF v_origem='appcontrole' THEN
    UPDATE public.rh_feriados SET ativo=false WHERE id=p_id;
    RETURN 'inativado';
  END IF;

  DELETE FROM public.rh_feriados WHERE id=p_id;
  RETURN 'excluido';
END;
$$;

REVOKE ALL ON FUNCTION public.rh_set_colaborador_contextos(uuid,boolean,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rh_update_colaborador_fields(uuid,text,text,text,text,date,text,text,text,text,text,text,numeric,date,text,uuid,boolean,text,numeric,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rh_delete_colaborador(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rh_remover_jornada(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rh_remover_feriado(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rh_set_colaborador_contextos(uuid,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_update_colaborador_fields(uuid,text,text,text,text,date,text,text,text,text,text,text,numeric,date,text,uuid,boolean,text,numeric,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_delete_colaborador(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_remover_jornada(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rh_remover_feriado(uuid) TO authenticated;

COMMIT;
NOTIFY pgrst,'reload schema';