BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;

CREATE TABLE IF NOT EXISTS public.cotacao_fluxo_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.cotacao_solicitacoes(id) ON DELETE RESTRICT,
  cotacao_id uuid REFERENCES public.cotacoes(id) ON DELETE SET NULL,
  evento text NOT NULL,
  status_anterior text,
  status_novo text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cotacao_fluxo_auditoria_solicitacao_idx
  ON public.cotacao_fluxo_auditoria(solicitacao_id, created_at DESC);

ALTER TABLE public.cotacao_fluxo_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cotacao_fluxo_auditoria_select ON public.cotacao_fluxo_auditoria;
CREATE POLICY cotacao_fluxo_auditoria_select
ON public.cotacao_fluxo_auditoria FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva((SELECT auth.uid()), 'pode_pedido_compra')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.ativo = true
      AND p.tipo_usuario = 'estoquista'
  )
  OR EXISTS (
    SELECT 1 FROM public.cotacao_solicitacoes s
    WHERE s.id = solicitacao_id
      AND s.criado_por = (SELECT auth.uid())
  )
);

REVOKE ALL ON TABLE public.cotacao_fluxo_auditoria FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.cotacao_fluxo_auditoria TO authenticated;

CREATE OR REPLACE FUNCTION app_private.cotacao_marcar_solicitacao_com_orcamento_v1(
  p_cotacao_id uuid,
  p_solicitacao_id uuid,
  p_evento text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cotacao public.cotacoes%ROWTYPE;
  v_status_anterior text;
  v_status_novo text;
BEGIN
  SELECT * INTO v_cotacao
  FROM public.cotacoes c
  WHERE c.id = p_cotacao_id;

  IF NOT FOUND OR NOT (
    v_cotacao.arquivo_path IS NOT NULL
    OR (
      v_cotacao.origem_cadastro = 'link'
      AND NULLIF(btrim(v_cotacao.url_origem), '') IS NOT NULL
    )
  ) THEN
    RETURN;
  END IF;

  SELECT s.status INTO v_status_anterior
  FROM public.cotacao_solicitacoes s
  WHERE s.id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  v_status_novo := CASE
    WHEN v_status_anterior IN ('solicitada', 'aguardando_propostas') THEN 'em_analise'
    ELSE v_status_anterior
  END;

  IF v_status_novo IS DISTINCT FROM v_status_anterior THEN
    UPDATE public.cotacao_solicitacoes
    SET status = v_status_novo, updated_at = now()
    WHERE id = p_solicitacao_id;
  END IF;

  INSERT INTO public.cotacao_fluxo_auditoria(
    solicitacao_id, cotacao_id, evento, status_anterior, status_novo, detalhes
  ) VALUES (
    p_solicitacao_id,
    p_cotacao_id,
    p_evento,
    v_status_anterior,
    v_status_novo,
    jsonb_build_object(
      'origem_cadastro', v_cotacao.origem_cadastro,
      'possui_pdf', v_cotacao.arquivo_path IS NOT NULL,
      'possui_link', NULLIF(btrim(v_cotacao.url_origem), '') IS NOT NULL
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION app_private.cotacao_marcar_solicitacao_com_orcamento_v1(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.cotacao_fluxo_ao_vincular_v1()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app_private.cotacao_marcar_solicitacao_com_orcamento_v1(
    NEW.cotacao_id,
    NEW.solicitacao_id,
    'orcamento_vinculado'
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.cotacao_fluxo_ao_vincular_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cotacao_fluxo_ao_vincular
  ON public.cotacao_solicitacoes_vinculos;
CREATE TRIGGER trg_cotacao_fluxo_ao_vincular
AFTER INSERT ON public.cotacao_solicitacoes_vinculos
FOR EACH ROW EXECUTE FUNCTION app_private.cotacao_fluxo_ao_vincular_v1();

CREATE OR REPLACE FUNCTION app_private.cotacao_fluxo_ao_receber_orcamento_v1()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vinculo record;
BEGIN
  IF NEW.arquivo_path IS NOT NULL
     OR (NEW.origem_cadastro = 'link' AND NULLIF(btrim(NEW.url_origem), '') IS NOT NULL)
  THEN
    FOR v_vinculo IN
      SELECT v.solicitacao_id
      FROM public.cotacao_solicitacoes_vinculos v
      WHERE v.cotacao_id = NEW.id
    LOOP
      PERFORM app_private.cotacao_marcar_solicitacao_com_orcamento_v1(
        NEW.id,
        v_vinculo.solicitacao_id,
        CASE WHEN NEW.arquivo_path IS NOT NULL
          THEN 'pdf_recebido'
          ELSE 'link_recebido'
        END
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.cotacao_fluxo_ao_receber_orcamento_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cotacao_fluxo_ao_receber_orcamento ON public.cotacoes;
CREATE TRIGGER trg_cotacao_fluxo_ao_receber_orcamento
AFTER INSERT OR UPDATE OF arquivo_path, url_origem, origem_cadastro ON public.cotacoes
FOR EACH ROW EXECUTE FUNCTION app_private.cotacao_fluxo_ao_receber_orcamento_v1();

-- Garante o vínculo formal para cotações antigas que ainda usam apenas a
-- coluna legada solicitacao_id. O gatilho acima registra e corrige o status.
INSERT INTO public.cotacao_solicitacoes_vinculos(cotacao_id, solicitacao_id)
SELECT c.id, c.solicitacao_id
FROM public.cotacoes c
WHERE c.solicitacao_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Saneia solicitações já vinculadas a PDF/link que permaneceram na fila. É o
-- cenário observado na Solicitação 7; não altera a cotação nem seus anexos.
DO $$
DECLARE
  v_vinculo record;
BEGIN
  FOR v_vinculo IN
    SELECT v.cotacao_id, v.solicitacao_id
    FROM public.cotacao_solicitacoes_vinculos v
    JOIN public.cotacoes c ON c.id = v.cotacao_id
    JOIN public.cotacao_solicitacoes s ON s.id = v.solicitacao_id
    WHERE s.status IN ('solicitada', 'aguardando_propostas')
      AND (
        c.arquivo_path IS NOT NULL
        OR (c.origem_cadastro = 'link' AND NULLIF(btrim(c.url_origem), '') IS NOT NULL)
      )
  LOOP
    PERFORM app_private.cotacao_marcar_solicitacao_com_orcamento_v1(
      v_vinculo.cotacao_id,
      v_vinculo.solicitacao_id,
      'saneamento_orcamento_existente'
    );
  END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
