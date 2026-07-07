ALTER TABLE public.producao_membros
  ADD COLUMN IF NOT EXISTS valor_hora numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'producao_membros_valor_hora_nao_negativo'
      AND conrelid = 'public.producao_membros'::regclass
  ) THEN
    ALTER TABLE public.producao_membros
      ADD CONSTRAINT producao_membros_valor_hora_nao_negativo
      CHECK (valor_hora IS NULL OR valor_hora >= 0);
  END IF;
END $$;

ALTER TABLE public.producao_apontamento_membros
  ADD COLUMN IF NOT EXISTS valor_hora_snapshot numeric(12,2);

ALTER TABLE public.producao_apontamentos
  ADD COLUMN IF NOT EXISTS minutos_produtivos integer,
  ADD COLUMN IF NOT EXISTS minutos_improdutivos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo_improdutivo text;

UPDATE public.producao_apontamentos
SET minutos_produtivos = duracao_minutos
WHERE minutos_produtivos IS NULL;

ALTER TABLE public.producao_apontamentos
  ALTER COLUMN minutos_produtivos SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'producao_apontamentos_minutos_produtivos_nao_negativo'
      AND conrelid = 'public.producao_apontamentos'::regclass
  ) THEN
    ALTER TABLE public.producao_apontamentos
      ADD CONSTRAINT producao_apontamentos_minutos_produtivos_nao_negativo
      CHECK (minutos_produtivos >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'producao_apontamentos_minutos_improdutivos_nao_negativo'
      AND conrelid = 'public.producao_apontamentos'::regclass
  ) THEN
    ALTER TABLE public.producao_apontamentos
      ADD CONSTRAINT producao_apontamentos_minutos_improdutivos_nao_negativo
      CHECK (minutos_improdutivos >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'producao_apontamentos_tempos_fecham_duracao'
      AND conrelid = 'public.producao_apontamentos'::regclass
  ) THEN
    ALTER TABLE public.producao_apontamentos
      ADD CONSTRAINT producao_apontamentos_tempos_fecham_duracao
      CHECK (minutos_produtivos + minutos_improdutivos = duracao_minutos);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'producao_apontamentos_motivo_improdutivo_obrigatorio'
      AND conrelid = 'public.producao_apontamentos'::regclass
  ) THEN
    ALTER TABLE public.producao_apontamentos
      ADD CONSTRAINT producao_apontamentos_motivo_improdutivo_obrigatorio
      CHECK (
        minutos_improdutivos = 0
        OR btrim(coalesce(motivo_improdutivo, '')) <> ''
      );
  END IF;
END $$;
