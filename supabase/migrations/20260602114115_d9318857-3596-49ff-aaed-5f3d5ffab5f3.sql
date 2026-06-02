-- Tornar a chave de deduplicação de movimentações mais robusta:
-- - usar janela de 2 minutos (em vez de 1 segundo) para pegar duplos cliques / reenvios
-- - remover tipo_operacao_id e observacoes da chave para que "mesma entrada" com
--   tipos de operação diferentes (ex.: Compra vs Entrada para acerto) também sejam barradas
CREATE OR REPLACE FUNCTION public.set_movement_dedupe_key()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.item_id IS NOT NULL AND NEW.data_hora IS NOT NULL THEN
    NEW.dedupe_key := concat_ws(
      '|',
      NEW.item_id::text,
      NEW.tipo,
      NEW.quantidade::text,
      coalesce(NEW.user_id::text, ''),
      coalesce(NEW.estoque_id::text, ''),
      -- janela de 120 segundos: agrupa requisições próximas como duplicatas
      floor(extract(epoch from NEW.data_hora) / 120)::text
    );
  ELSE
    NEW.dedupe_key := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- Garante que o trigger esteja ativo
DROP TRIGGER IF EXISTS trg_set_movement_dedupe_key ON public.movements;
CREATE TRIGGER trg_set_movement_dedupe_key
BEFORE INSERT ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.set_movement_dedupe_key();