-- Numeração sequencial das Ordens de Produção geradas a partir dos apontamentos.
-- Registros existentes são numerados pela ordem de criação, iniciando em 1.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.producao_apontamento_op_seq
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO CYCLE;

ALTER TABLE public.producao_apontamentos
  ADD COLUMN IF NOT EXISTS numero_op BIGINT NULL;

LOCK TABLE public.producao_apontamentos IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  v_base BIGINT;
  v_maximo BIGINT;
BEGIN
  SELECT COALESCE(MAX(numero_op), 0)
  INTO v_base
  FROM public.producao_apontamentos;

  WITH pendentes AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY created_at, id) AS ordem
    FROM public.producao_apontamentos
    WHERE numero_op IS NULL
  )
  UPDATE public.producao_apontamentos a
  SET numero_op = v_base + p.ordem
  FROM pendentes p
  WHERE a.id = p.id;

  SELECT COALESCE(MAX(numero_op), 0)
  INTO v_maximo
  FROM public.producao_apontamentos;

  IF v_maximo > 0 THEN
    PERFORM setval('public.producao_apontamento_op_seq', v_maximo, TRUE);
  ELSE
    PERFORM setval('public.producao_apontamento_op_seq', 1, FALSE);
  END IF;
END;
$$;

ALTER TABLE public.producao_apontamentos
  ALTER COLUMN numero_op SET DEFAULT nextval('public.producao_apontamento_op_seq'),
  ALTER COLUMN numero_op SET NOT NULL;

ALTER SEQUENCE public.producao_apontamento_op_seq
  OWNED BY public.producao_apontamentos.numero_op;

CREATE UNIQUE INDEX IF NOT EXISTS producao_apontamentos_numero_op_unique
  ON public.producao_apontamentos(numero_op);

COMMENT ON COLUMN public.producao_apontamentos.numero_op IS
  'Número sequencial da Ordem de Produção emitida a partir do apontamento.';

NOTIFY pgrst, 'reload schema';
COMMIT;
