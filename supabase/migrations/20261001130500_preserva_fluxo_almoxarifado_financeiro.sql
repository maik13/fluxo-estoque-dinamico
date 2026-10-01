BEGIN;

-- Preserva o fluxo operacional antigo do Almoxarifado.
-- Pedido de Compra manual continua operacional.
-- Pedido/RC originado de Solicitação de Material passa a ser a virada formal para o Financeiro.

ALTER TABLE public.pedidos_compra
  ADD COLUMN IF NOT EXISTS integrar_financeiro BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pedidos_compra.integrar_financeiro IS
  'Quando verdadeiro, esta RC/Pedido de Compra alimenta PN, lançamento previsto e fluxo financeiro. Pedidos operacionais manuais permanecem fora do Financeiro até virarem RC integrada.';

-- Mantém como integrado o que já havia sido sincronizado e qualquer pedido vindo de Solicitação de Material.
UPDATE public.pedidos_compra
SET integrar_financeiro = true
WHERE pn_origem_id IS NOT NULL
   OR solicitacao_material_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.financeiro_preparar_pedido_compra_rc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sol public.solicitacoes_material%ROWTYPE;
BEGIN
  IF NEW.solicitacao_material_id IS NOT NULL THEN
    SELECT * INTO v_sol
    FROM public.solicitacoes_material
    WHERE id = NEW.solicitacao_material_id;

    -- A virada Solicitação de Material -> Pedido de Compra é o ponto em que o pedido passa a alimentar o Financeiro.
    NEW.integrar_financeiro := true;

    IF FOUND THEN
      NEW.data_necessaria := COALESCE(NEW.data_necessaria, v_sol.data_necessidade);
      NEW.projeto_centro_custo := COALESCE(NEW.projeto_centro_custo, v_sol.local_origem, v_sol.origem_modulo);
      NEW.conferencia_estoque := COALESCE(
        NEW.conferencia_estoque,
        'Gerado pelo Almoxarifado a partir da Solicitação de Material #' || COALESCE(v_sol.numero::text, 'sem número') || '. Itens enviados para compra por falta de saldo, item avulso ou necessidade de aquisição.'
      );
      NEW.status_financeiro_rc := COALESCE(NEW.status_financeiro_rc, 'em_cotacao');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_preparar_pedido_compra_rc ON public.pedidos_compra;
CREATE TRIGGER trg_financeiro_preparar_pedido_compra_rc
BEFORE INSERT OR UPDATE OF solicitacao_material_id, data_necessaria, projeto_centro_custo ON public.pedidos_compra
FOR EACH ROW EXECUTE FUNCTION public.financeiro_preparar_pedido_compra_rc();

CREATE OR REPLACE FUNCTION public.financeiro_trigger_sincronizar_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(NEW.integrar_financeiro,false) THEN
    PERFORM public.financeiro_sincronizar_rc(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_trigger_sincronizar_rc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_integrar BOOLEAN;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.pedido_id ELSE NEW.pedido_id END;

  SELECT COALESCE(integrar_financeiro,false)
  INTO v_integrar
  FROM public.pedidos_compra
  WHERE id = v_id;

  IF COALESCE(v_integrar,false) THEN
    PERFORM public.financeiro_sincronizar_rc(v_id);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_pedido_compra_itens_sync ON public.pedido_compra_itens;
CREATE TRIGGER trg_financeiro_pedido_compra_itens_sync
AFTER INSERT OR UPDATE OR DELETE ON public.pedido_compra_itens
FOR EACH ROW EXECUTE FUNCTION public.financeiro_trigger_sincronizar_rc();

DROP TRIGGER IF EXISTS trg_financeiro_pedidos_compra_sync ON public.pedidos_compra;
CREATE TRIGGER trg_financeiro_pedidos_compra_sync
AFTER INSERT OR UPDATE OF status, solicitacao_material_id, data_necessaria, projeto_centro_custo, valor_estimado_cotado, frete_custos_adicionais, condicao_pagamento, status_financeiro_rc, integrar_financeiro ON public.pedidos_compra
FOR EACH ROW EXECUTE FUNCTION public.financeiro_trigger_sincronizar_pedido();

COMMIT;
