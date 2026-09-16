-- Mantém o cadastro mestre de locais como fonte canônica do nome exibido nos módulos operacionais.
-- Ao renomear um local, qualquer projeto de Produção vinculado ao mesmo local é atualizado automaticamente.
-- O backfill corrige divergências já existentes sem alterar históricos/auditorias de apontamentos.

CREATE OR REPLACE FUNCTION public.sincronizar_projeto_producao_com_local_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE public.producao_projetos
       SET nome = NEW.nome
     WHERE local_utilizacao_id = NEW.id
       AND nome IS DISTINCT FROM NEW.nome;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_projeto_producao_com_local_v1
ON public.locais_utilizacao;

CREATE TRIGGER trg_sincronizar_projeto_producao_com_local_v1
AFTER UPDATE OF nome ON public.locais_utilizacao
FOR EACH ROW
WHEN (OLD.nome IS DISTINCT FROM NEW.nome)
EXECUTE FUNCTION public.sincronizar_projeto_producao_com_local_v1();

-- Corrige os projetos já vinculados que ficaram com nome antigo.
UPDATE public.producao_projetos AS projeto
   SET nome = local.nome
  FROM public.locais_utilizacao AS local
 WHERE projeto.local_utilizacao_id = local.id
   AND projeto.nome IS DISTINCT FROM local.nome;
