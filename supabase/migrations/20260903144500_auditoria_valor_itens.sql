-- Auditoria específica de precificação dos itens.
-- Objetivo: registrar, sem alterar a lógica operacional do estoque, cada definição
-- ou alteração do campo items.valor e disponibilizar somente a última data para relatórios.

BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_auditoria_valor_item_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_acao TEXT;
  v_valor_anterior JSONB := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Só registra definição inicial quando algum valor foi efetivamente informado.
    IF NEW.valor IS NULL THEN
      RETURN NEW;
    END IF;

    v_acao := 'DEFINICAO_VALOR_ITEM';
  ELSE
    -- UPDATE sem mudança real de valor não gera ruído no log.
    IF OLD.valor IS NOT DISTINCT FROM NEW.valor THEN
      RETURN NEW;
    END IF;

    v_acao := 'ALTERACAO_VALOR_ITEM';
    v_valor_anterior := to_jsonb(OLD.valor);
  END IF;

  INSERT INTO public.action_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  VALUES (
    auth.uid(),
    v_acao,
    'items',
    NEW.id,
    jsonb_build_object(
      'item_nome', NEW.nome,
      'codigo_barras', NEW.codigo_barras,
      'valor_anterior', v_valor_anterior,
      'valor_novo', to_jsonb(NEW.valor)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_valor_item_v1 ON public.items;

CREATE TRIGGER trg_auditoria_valor_item_v1
AFTER INSERT OR UPDATE OF valor ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.registrar_auditoria_valor_item_v1();

REVOKE ALL ON FUNCTION public.registrar_auditoria_valor_item_v1() FROM PUBLIC;

-- Índice parcial para manter rápida a consulta da última atualização de preço,
-- sem interferir nas consultas operacionais de estoque/movimentações.
CREATE INDEX IF NOT EXISTS idx_action_logs_item_valor_latest
ON public.action_logs (entity_id, created_at DESC)
WHERE entity_type = 'items'
  AND action IN ('DEFINICAO_VALOR_ITEM', 'ALTERACAO_VALOR_ITEM');

-- RPC deliberadamente mínima: expõe somente item_id + data da última atualização
-- para o relatório, sem abrir os detalhes completos do action_logs a usuários não-admin.
CREATE OR REPLACE FUNCTION public.listar_ultima_atualizacao_valor_itens_v1()
RETURNS TABLE (
  item_id UUID,
  valor_atualizado_em TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    al.entity_id AS item_id,
    MAX(al.created_at) AS valor_atualizado_em
  FROM public.action_logs al
  WHERE al.entity_type = 'items'
    AND al.action IN ('DEFINICAO_VALOR_ITEM', 'ALTERACAO_VALOR_ITEM')
    AND al.entity_id IS NOT NULL
  GROUP BY al.entity_id;
$$;

REVOKE ALL ON FUNCTION public.listar_ultima_atualizacao_valor_itens_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_ultima_atualizacao_valor_itens_v1() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
