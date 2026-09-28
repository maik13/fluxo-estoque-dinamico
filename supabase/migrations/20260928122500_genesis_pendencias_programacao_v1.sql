BEGIN;

CREATE OR REPLACE FUNCTION public.ignorar_programacao_planejamento_v1(
  p_agenda_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para revisar programação importada';
  END IF;

  UPDATE public.producao_planejamento_agenda
  SET integracao_status = 'ignorado',
      integrado_em = now(),
      updated_at = now()
  WHERE id = p_agenda_id
    AND tipo = 'turno'
    AND integracao_status = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pendência de programação não encontrada';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ignorar_programacao_planejamento_v1(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ignorar_programacao_planejamento_v1(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ignorar_programacao_planejamento_v1(uuid) TO authenticated;

COMMIT;
