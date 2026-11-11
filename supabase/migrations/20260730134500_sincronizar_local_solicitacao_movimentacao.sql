-- Garante que o local informado na Solicitação/Retirada seja preservado
-- no livro-razão oficial de movimentações.

BEGIN;

-- Toda movimentação vinculada a uma solicitação herda o mesmo local.
CREATE OR REPLACE FUNCTION public.sincronizar_local_movimentacao_com_solicitacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_local_utilizacao_id UUID;
BEGIN
  IF NEW.solicitacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.local_utilizacao_id
    INTO v_local_utilizacao_id
  FROM public.solicitacoes s
  WHERE s.id = NEW.solicitacao_id;

  IF v_local_utilizacao_id IS NOT NULL THEN
    NEW.local_utilizacao_id := v_local_utilizacao_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_local_movimentacao_com_solicitacao
  ON public.movements;
CREATE TRIGGER trg_sincronizar_local_movimentacao_com_solicitacao
BEFORE INSERT OR UPDATE OF solicitacao_id, local_utilizacao_id
ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_local_movimentacao_com_solicitacao();

-- Uma correção feita diretamente na retirada deve atualizar todas as
-- movimentações já vinculadas a ela.
CREATE OR REPLACE FUNCTION public.propagar_local_solicitacao_para_movimentos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.local_utilizacao_id IS DISTINCT FROM OLD.local_utilizacao_id THEN
    UPDATE public.movements m
       SET local_utilizacao_id = NEW.local_utilizacao_id
     WHERE m.solicitacao_id = NEW.id
       AND m.local_utilizacao_id IS DISTINCT FROM NEW.local_utilizacao_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagar_local_solicitacao_para_movimentos
  ON public.solicitacoes;
CREATE TRIGGER trg_propagar_local_solicitacao_para_movimentos
AFTER UPDATE OF local_utilizacao_id
ON public.solicitacoes
FOR EACH ROW
EXECUTE FUNCTION public.propagar_local_solicitacao_para_movimentos();

-- A Solicitação de Material é a origem do fluxo. Se o local for corrigido
-- depois da conversão, a retirada e as movimentações também devem acompanhar.
CREATE OR REPLACE FUNCTION public.propagar_local_material_para_retirada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.solicitacao_retirada_id IS NOT NULL
     AND NEW.local_origem_id IS NOT NULL THEN
    UPDATE public.solicitacoes s
       SET local_utilizacao_id = NEW.local_origem_id,
           local_utilizacao = COALESCE(
             NULLIF(BTRIM(NEW.local_origem), ''),
             s.local_utilizacao
           )
     WHERE s.id = NEW.solicitacao_retirada_id
       AND (
         s.local_utilizacao_id IS DISTINCT FROM NEW.local_origem_id
         OR (
           NULLIF(BTRIM(NEW.local_origem), '') IS NOT NULL
           AND s.local_utilizacao IS DISTINCT FROM NULLIF(BTRIM(NEW.local_origem), '')
         )
       );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagar_local_material_para_retirada_insert
  ON public.solicitacoes_material;
CREATE TRIGGER trg_propagar_local_material_para_retirada_insert
AFTER INSERT
ON public.solicitacoes_material
FOR EACH ROW
EXECUTE FUNCTION public.propagar_local_material_para_retirada();

DROP TRIGGER IF EXISTS trg_propagar_local_material_para_retirada_update
  ON public.solicitacoes_material;
CREATE TRIGGER trg_propagar_local_material_para_retirada_update
AFTER UPDATE OF local_origem_id, local_origem, solicitacao_retirada_id
ON public.solicitacoes_material
FOR EACH ROW
EXECUTE FUNCTION public.propagar_local_material_para_retirada();

-- Recupera retiradas já convertidas cujo local ficou divergente ou vazio.
UPDATE public.solicitacoes s
   SET local_utilizacao_id = sm.local_origem_id,
       local_utilizacao = COALESCE(
         NULLIF(BTRIM(sm.local_origem), ''),
         s.local_utilizacao
       )
  FROM public.solicitacoes_material sm
 WHERE sm.solicitacao_retirada_id = s.id
   AND sm.local_origem_id IS NOT NULL
   AND (
     s.local_utilizacao_id IS DISTINCT FROM sm.local_origem_id
     OR (
       NULLIF(BTRIM(sm.local_origem), '') IS NOT NULL
       AND s.local_utilizacao IS DISTINCT FROM NULLIF(BTRIM(sm.local_origem), '')
     )
   );

-- Recupera movimentações históricas ligadas a solicitações que já possuem local.
UPDATE public.movements m
   SET local_utilizacao_id = s.local_utilizacao_id
  FROM public.solicitacoes s
 WHERE m.solicitacao_id = s.id
   AND s.local_utilizacao_id IS NOT NULL
   AND m.local_utilizacao_id IS DISTINCT FROM s.local_utilizacao_id;

COMMIT;
