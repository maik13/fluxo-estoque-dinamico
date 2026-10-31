-- O Planejamento usa "Pq do Japão (Mga)" como nome do projeto/local.
-- Esse valor não pode substituir a cidade real das peças, que é Maringá.
CREATE OR REPLACE FUNCTION app_private.normalizar_cidade_projeto_producao_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  IF lower(btrim(COALESCE(NEW.cidade, ''))) = lower('Pq do Japão (Mga)') THEN
    NEW.cidade := 'Maringá';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.normalizar_cidade_projeto_producao_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_normalizar_cidade_projeto_producao
  ON public.producao_projetos;

CREATE TRIGGER trg_normalizar_cidade_projeto_producao
BEFORE INSERT OR UPDATE OF cidade ON public.producao_projetos
FOR EACH ROW
EXECUTE FUNCTION app_private.normalizar_cidade_projeto_producao_v1();

-- Saneia todas as peças já vinculadas ao projeto Parque do Japão.
UPDATE public.producao_projetos AS projeto
SET cidade = 'Maringá',
    updated_at = now()
FROM public.locais_utilizacao AS local,
     public.project_groups AS grupo
WHERE local.id = projeto.local_utilizacao_id
  AND grupo.id = local.group_id
  AND lower(btrim(grupo.nome)) = lower('Pq do Japão (Mga)')
  AND projeto.excluido_em IS NULL
  AND projeto.cidade IS DISTINCT FROM 'Maringá';
