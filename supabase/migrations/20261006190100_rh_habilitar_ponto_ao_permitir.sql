
CREATE OR REPLACE FUNCTION app_private.rh_sync_permissao_ponto_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NEW.permissao='ponto_registrar' AND NEW.efeito='permitir' THEN
 PERFORM app_private.rh_sincronizar_usuario_fluxo(NEW.user_id);
 UPDATE public.rh_colaboradores SET controla_ponto=true
 WHERE user_id=NEW.user_id AND ativo AND rh_ativo;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.rh_sync_permissao_ponto_trigger() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER rh_habilitar_ponto_ao_permitir AFTER INSERT OR UPDATE ON public.usuario_permissoes_individuais
FOR EACH ROW EXECUTE FUNCTION app_private.rh_sync_permissao_ponto_trigger();
