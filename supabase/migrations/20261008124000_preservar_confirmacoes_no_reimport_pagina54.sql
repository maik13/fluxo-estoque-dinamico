-- A reimportação da Página54 atualiza os dados de origem, mas não pode
-- desfazer uma confirmação bancária ou uma conciliação feita no sistema.
CREATE OR REPLACE FUNCTION public.financeiro_preservar_confirmacoes_pagina54()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.pagina54_sync_import', true) = 'on' THEN
    IF NEW.status = 'cancelado' THEN
      -- Cancelamento vindo da fonte continua prevalecendo.
      RETURN NEW;
    END IF;

    IF OLD.status = 'conciliado' THEN
      NEW.status := 'conciliado';
    ELSIF NEW.status <> 'pago' AND OLD.status = 'programado' THEN
      -- A confirmação de agendamento no banco é um dado operacional do sistema.
      NEW.status := 'programado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_preservar_confirmacoes_pagina54 ON public.financeiro_lancamentos;
CREATE TRIGGER trg_financeiro_preservar_confirmacoes_pagina54
BEFORE UPDATE ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.financeiro_preservar_confirmacoes_pagina54();

REVOKE ALL ON FUNCTION public.financeiro_preservar_confirmacoes_pagina54() FROM PUBLIC;
