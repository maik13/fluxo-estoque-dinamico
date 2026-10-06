
CREATE OR REPLACE FUNCTION app_private.rh_sincronizar_usuario_fluxo(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE p public.profiles%ROWTYPE; c public.rh_colaboradores%ROWTYPE; n integer;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO c FROM public.rh_colaboradores WHERE user_id=p_user_id FOR UPDATE;
 IF FOUND THEN RETURN; END IF;
 SELECT count(*) INTO n FROM public.rh_colaboradores WHERE nullif(lower(btrim(email)),'')=nullif(lower(btrim(p.email)),'');
 IF n>1 THEN RAISE EXCEPTION 'Há mais de um colaborador com o e-mail %. Resolva a duplicidade no RH.',p.email; END IF;
 IF n=1 THEN
 SELECT * INTO c FROM public.rh_colaboradores WHERE nullif(lower(btrim(email)),'')=nullif(lower(btrim(p.email)),'') FOR UPDATE;
 IF c.user_id IS NOT NULL THEN RAISE EXCEPTION 'O e-mail % já pertence a outro login no RH.',p.email; END IF;
 UPDATE public.rh_colaboradores SET user_id=p_user_id WHERE id=c.id;
 ELSE
 INSERT INTO public.rh_colaboradores(nome,email,user_id,ativo,rh_ativo,rh_cadastrado,controla_ponto,tipo_contrato)
 VALUES(coalesce(nullif(btrim(p.nome),''),p.email,'Usuário'),p.email,p.user_id,coalesce(p.ativo,false),true,true,public.permissao_individual_efetiva(p.user_id,'ponto_registrar'),NULL);
 END IF;
END $$;
REVOKE ALL ON FUNCTION app_private.rh_sincronizar_usuario_fluxo(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION app_private.rh_sync_profile_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN PERFORM app_private.rh_sincronizar_usuario_fluxo(NEW.user_id); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION app_private.rh_sync_profile_trigger() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER rh_sync_novo_usuario_fluxo AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION app_private.rh_sync_profile_trigger();

DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL ORDER BY user_id LOOP
 PERFORM app_private.rh_sincronizar_usuario_fluxo(p.user_id);
 END LOOP;
END $$;
