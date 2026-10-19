BEGIN;

-- NEW.id ainda não existe durante um BEFORE INSERT. O vínculo da PN acontece
-- no gatilho AFTER já existente (financeiro_atualizar_pn_apos_rc), depois que
-- a RC foi gravada e pode ser referenciada pela chave estrangeira.
CREATE OR REPLACE FUNCTION public.financeiro_preparar_pedido_compra_rc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sol public.solicitacoes_material%ROWTYPE;
BEGIN
  IF NEW.solicitacao_material_id IS NOT NULL THEN
    SELECT * INTO v_sol
    FROM public.solicitacoes_material solicitacao
    WHERE solicitacao.id = NEW.solicitacao_material_id;

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

COMMIT;
