BEGIN;

CREATE OR REPLACE FUNCTION public.rh_salvar_colaborador(
  p_id uuid DEFAULT NULL,
  p_nome text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_cpf_cnpj text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_data_nascimento date DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_cep text DEFAULT NULL,
  p_cargo text DEFAULT NULL,
  p_departamento text DEFAULT NULL,
  p_salario numeric DEFAULT NULL,
  p_data_admissao date DEFAULT NULL,
  p_pis text DEFAULT NULL,
  p_jornada_id uuid DEFAULT NULL,
  p_tipo_contrato text DEFAULT 'clt',
  p_valor_contrato numeric DEFAULT NULL,
  p_controla_ponto boolean DEFAULT false,
  p_hora_extra_gera_valor boolean DEFAULT true,
  p_rh_ativo boolean DEFAULT true,
  p_ativo boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_id uuid;
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

  IF p_id IS NULL THEN
    INSERT INTO public.rh_colaboradores(
      nome,email,cpf_cnpj,telefone,data_nascimento,endereco,cidade,estado,cep,cargo,departamento,
      salario,data_admissao,pis,jornada_id,tipo_contrato,valor_contrato,controla_ponto,
      hora_extra_gera_valor,rh_ativo,rh_cadastrado,ativo
    ) VALUES(
      btrim(p_nome),nullif(btrim(p_email),''),nullif(btrim(p_cpf_cnpj),''),nullif(btrim(p_telefone),''),
      p_data_nascimento,nullif(btrim(p_endereco),''),nullif(btrim(p_cidade),''),nullif(upper(btrim(p_estado)),''),
      nullif(btrim(p_cep),''),nullif(btrim(p_cargo),''),nullif(btrim(p_departamento),''),
      CASE WHEN v_tipo='clt' THEN p_salario ELSE NULL END,p_data_admissao,nullif(btrim(p_pis),''),
      p_jornada_id,v_tipo,CASE WHEN v_tipo='clt' THEN NULL ELSE p_valor_contrato END,
      CASE WHEN p_rh_ativo THEN coalesce(p_controla_ponto,false) ELSE false END,
      CASE WHEN v_tipo='horista' THEN false ELSE coalesce(p_hora_extra_gera_valor,true) END,
      coalesce(p_rh_ativo,true),true,coalesce(p_ativo,true)
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.rh_colaboradores SET
      nome=btrim(p_nome),email=nullif(btrim(p_email),''),cpf_cnpj=nullif(btrim(p_cpf_cnpj),''),
      telefone=nullif(btrim(p_telefone),''),data_nascimento=p_data_nascimento,endereco=nullif(btrim(p_endereco),''),
      cidade=nullif(btrim(p_cidade),''),estado=nullif(upper(btrim(p_estado)),''),cep=nullif(btrim(p_cep),''),
      cargo=nullif(btrim(p_cargo),''),departamento=nullif(btrim(p_departamento),''),
      salario=CASE WHEN v_tipo='clt' THEN p_salario ELSE NULL END,data_admissao=p_data_admissao,
      pis=nullif(btrim(p_pis),''),jornada_id=p_jornada_id,tipo_contrato=v_tipo,
      valor_contrato=CASE WHEN v_tipo='clt' THEN NULL ELSE p_valor_contrato END,
      controla_ponto=CASE WHEN p_rh_ativo THEN coalesce(p_controla_ponto,false) ELSE false END,
      hora_extra_gera_valor=CASE WHEN v_tipo='horista' THEN false ELSE coalesce(p_hora_extra_gera_valor,true) END,
      rh_ativo=coalesce(p_rh_ativo,true),rh_cadastrado=true,ativo=coalesce(p_ativo,true)
    WHERE id=p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Colaborador não encontrado'; END IF;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rh_salvar_colaborador(uuid,text,text,text,text,date,text,text,text,text,text,text,numeric,date,text,uuid,text,numeric,boolean,boolean,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_salvar_colaborador(uuid,text,text,text,text,date,text,text,text,text,text,text,numeric,date,text,uuid,text,numeric,boolean,boolean,boolean,boolean) TO authenticated;

COMMIT;
NOTIFY pgrst,'reload schema';