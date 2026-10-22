BEGIN;

CREATE TABLE IF NOT EXISTS public.cotacao_solicitacoes_vinculos (
  cotacao_id uuid NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  solicitacao_id uuid NOT NULL REFERENCES public.cotacao_solicitacoes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cotacao_id, solicitacao_id)
);

CREATE INDEX IF NOT EXISTS idx_cotacao_solicitacoes_vinculos_solicitacao
  ON public.cotacao_solicitacoes_vinculos(solicitacao_id);

ALTER TABLE public.cotacao_solicitacoes_vinculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cotacao_solicitacoes_vinculos_select_authenticated
  ON public.cotacao_solicitacoes_vinculos;
CREATE POLICY cotacao_solicitacoes_vinculos_select_authenticated
  ON public.cotacao_solicitacoes_vinculos
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id=auth.uid() AND p.ativo=true AND p.tipo_usuario='estoquista'
    )
  );

INSERT INTO public.cotacao_solicitacoes_vinculos(cotacao_id, solicitacao_id)
SELECT id, solicitacao_id
FROM public.cotacoes
WHERE solicitacao_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.cotacao_definir_solicitacoes_v1(
  p_cotacao_id uuid,
  p_solicitacao_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_ids uuid[] := COALESCE(p_solicitacao_ids, ARRAY[]::uuid[]);
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.is_admin()
    OR public.permissao_individual_efetiva(v_user,'pode_pedido_compra')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id=v_user AND p.ativo=true AND p.tipo_usuario='estoquista'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para vincular solicitações à cotação';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cotacoes WHERE id=p_cotacao_id) THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_ids) id
    WHERE NOT EXISTS (SELECT 1 FROM public.cotacao_solicitacoes s WHERE s.id=id)
  ) THEN
    RAISE EXCEPTION 'Uma ou mais solicitações não existem';
  END IF;

  DELETE FROM public.cotacao_solicitacoes_vinculos WHERE cotacao_id=p_cotacao_id;

  INSERT INTO public.cotacao_solicitacoes_vinculos(cotacao_id, solicitacao_id)
  SELECT p_cotacao_id, id FROM (SELECT DISTINCT unnest(v_ids) AS id) x;

  UPDATE public.cotacoes
  SET solicitacao_id=v_ids[1], updated_at=now()
  WHERE id=p_cotacao_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN cardinality(v_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.cotacao_definir_solicitacoes_v1(uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotacao_definir_solicitacoes_v1(uuid,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.cotacao_escolher_proposta_multi_v1(p_cotacao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cotacao public.cotacoes%ROWTYPE;
  v_primeira_solicitacao uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT (
    public.is_admin()
    OR public.permissao_individual_efetiva(v_user,'pode_pedido_compra')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=v_user AND p.ativo=true AND p.tipo_usuario='estoquista')
  ) THEN RAISE EXCEPTION 'Sem permissão para escolher proposta'; END IF;

  SELECT * INTO v_cotacao FROM public.cotacoes WHERE id=p_cotacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF v_cotacao.status NOT IN ('confirmada','escolhida') THEN
    RAISE EXCEPTION 'Confirme a cotação antes de escolhê-la';
  END IF;

  SELECT solicitacao_id INTO v_primeira_solicitacao
  FROM public.cotacao_solicitacoes_vinculos
  WHERE cotacao_id=p_cotacao_id ORDER BY created_at, solicitacao_id LIMIT 1;
  IF v_primeira_solicitacao IS NULL THEN
    RAISE EXCEPTION 'Esta cotação não está vinculada a uma solicitação';
  END IF;

  UPDATE public.cotacoes c
  SET status='rejeitada', updated_at=now()
  WHERE c.id<>p_cotacao_id
    AND c.status IN ('confirmada','escolhida')
    AND EXISTS (
      SELECT 1
      FROM public.cotacao_solicitacoes_vinculos atual
      JOIN public.cotacao_solicitacoes_vinculos outra
        ON outra.solicitacao_id=atual.solicitacao_id
      WHERE atual.cotacao_id=p_cotacao_id AND outra.cotacao_id=c.id
    );

  UPDATE public.cotacoes SET status='escolhida', updated_at=now() WHERE id=p_cotacao_id;
  UPDATE public.cotacao_solicitacoes s SET status='escolhida', updated_at=now()
  WHERE EXISTS (
    SELECT 1 FROM public.cotacao_solicitacoes_vinculos v
    WHERE v.cotacao_id=p_cotacao_id AND v.solicitacao_id=s.id
  );

  RETURN v_primeira_solicitacao;
END;
$$;

REVOKE ALL ON FUNCTION public.cotacao_escolher_proposta_multi_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cotacao_escolher_proposta_multi_v1(uuid) TO authenticated;

-- A função já existente continua criando uma única PN para o documento consolidado.
-- Este gatilho lógico fecha todas as solicitações atendidas quando a cotação vira PN.
CREATE OR REPLACE FUNCTION public.cotacao_encerrar_solicitacoes_ao_converter_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF NEW.status='convertida_pn' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.cotacao_solicitacoes s
    SET status='encerrada', updated_at=now()
    WHERE EXISTS (
      SELECT 1 FROM public.cotacao_solicitacoes_vinculos v
      WHERE v.cotacao_id=NEW.id AND v.solicitacao_id=s.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotacao_encerrar_solicitacoes_ao_converter ON public.cotacoes;
CREATE TRIGGER trg_cotacao_encerrar_solicitacoes_ao_converter
AFTER UPDATE OF status ON public.cotacoes
FOR EACH ROW EXECUTE FUNCTION public.cotacao_encerrar_solicitacoes_ao_converter_v1();

COMMIT;
