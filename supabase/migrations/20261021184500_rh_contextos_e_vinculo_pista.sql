BEGIN;

ALTER TABLE public.producao_membros
  ADD COLUMN IF NOT EXISTS rh_colaborador_id uuid NULL
  REFERENCES public.rh_colaboradores(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS producao_membros_rh_colaborador_unico
  ON public.producao_membros(rh_colaborador_id)
  WHERE rh_colaborador_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.rh_contextos_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE RESTRICT,
  administrativo_anterior boolean NOT NULL,
  administrativo_novo boolean NOT NULL,
  pista_anterior boolean NOT NULL,
  pista_novo boolean NOT NULL,
  ponto_anterior boolean NOT NULL,
  ponto_novo boolean NOT NULL,
  origem text NOT NULL DEFAULT 'interface_rh',
  alterado_por uuid NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_contextos_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_contextos_auditoria_select ON public.rh_contextos_auditoria;
CREATE POLICY rh_contextos_auditoria_select
  ON public.rh_contextos_auditoria FOR SELECT TO authenticated
  USING (
    public.permissao_individual_efetiva((select auth.uid()), 'rh_colaboradores_visualizar')
    OR public.permissao_individual_efetiva((select auth.uid()), 'rh_colaboradores_gerenciar')
  );

REVOKE ALL ON TABLE public.rh_contextos_auditoria FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.rh_contextos_auditoria TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_set_colaborador_contextos_v2(
  p_colaborador_id uuid,
  p_administrativo_ativo boolean,
  p_pista_ativo boolean,
  p_controla_ponto boolean,
  p_origem text DEFAULT 'interface_rh'
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_atual public.rh_colaboradores%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.permissao_individual_efetiva(v_user, 'rh_colaboradores_gerenciar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para gerenciar colaboradores do RH';
  END IF;

  SELECT * INTO v_atual
  FROM public.rh_colaboradores
  WHERE id = p_colaborador_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não encontrado'; END IF;

  UPDATE public.rh_colaboradores
  SET rh_ativo = coalesce(p_administrativo_ativo, false),
      pista_ativo_legado = coalesce(p_pista_ativo, false),
      controla_ponto = coalesce(p_controla_ponto, false),
      ativo = coalesce(p_administrativo_ativo, false)
        OR coalesce(p_pista_ativo, false)
        OR coalesce(p_controla_ponto, false),
      updated_at = now()
  WHERE id = p_colaborador_id;

  IF v_atual.rh_ativo IS DISTINCT FROM coalesce(p_administrativo_ativo, false)
     OR v_atual.pista_ativo_legado IS DISTINCT FROM coalesce(p_pista_ativo, false)
     OR v_atual.controla_ponto IS DISTINCT FROM coalesce(p_controla_ponto, false) THEN
    INSERT INTO public.rh_contextos_auditoria (
      colaborador_id,
      administrativo_anterior, administrativo_novo,
      pista_anterior, pista_novo,
      ponto_anterior, ponto_novo,
      origem, alterado_por
    ) VALUES (
      p_colaborador_id,
      v_atual.rh_ativo, coalesce(p_administrativo_ativo, false),
      v_atual.pista_ativo_legado, coalesce(p_pista_ativo, false),
      v_atual.controla_ponto, coalesce(p_controla_ponto, false),
      coalesce(nullif(btrim(p_origem), ''), 'interface_rh'), v_user
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rh_set_colaborador_contextos_v2(uuid, boolean, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_set_colaborador_contextos_v2(uuid, boolean, boolean, boolean, text) TO authenticated;

-- Vincula automaticamente somente nomes normalizados com correspondência 1:1.
WITH producao_normalizada AS (
  SELECT
    pm.id,
    regexp_replace(
      lower(translate(trim(coalesce(nullif(pm.nome_snapshot, ''), pm.nome)),
        'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
      '[^a-z0-9]+', '', 'g'
    ) AS chave
  FROM public.producao_membros pm
),
rh_normalizado AS (
  SELECT
    rc.id,
    regexp_replace(
      lower(translate(trim(rc.nome),
        'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
      '[^a-z0-9]+', '', 'g'
    ) AS chave
  FROM public.rh_colaboradores rc
),
pares_unicos AS (
  SELECT (array_agg(DISTINCT p.id))[1] AS producao_id, (array_agg(DISTINCT r.id))[1] AS rh_id
  FROM producao_normalizada p
  JOIN rh_normalizado r ON r.chave = p.chave AND p.chave <> ''
  GROUP BY p.chave
  HAVING count(DISTINCT p.id) = 1 AND count(DISTINCT r.id) = 1
)
UPDATE public.producao_membros pm
SET rh_colaborador_id = pu.rh_id,
    updated_at = now()
FROM pares_unicos pu
WHERE pm.id = pu.producao_id
  AND pm.rh_colaborador_id IS NULL;

UPDATE public.rh_colaboradores rc
SET pista_ativo_legado = true,
    ativo = true,
    updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM public.producao_membros pm
  WHERE pm.rh_colaborador_id = rc.id AND pm.ativo = true
);

-- Exceções confirmadas no de-para: Francis gestor e João Ricardo.
WITH francis_gestor AS (
  SELECT rc.id
  FROM public.rh_colaboradores rc
  WHERE lower(btrim(rc.nome)) = 'francis'
    AND rc.user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.usuario_permissoes_individuais up
      WHERE up.user_id = rc.user_id
        AND up.permissao = 'rh_colaboradores_gerenciar'
        AND up.efeito = 'permitir'
    )
  ORDER BY rc.created_at
  LIMIT 1
)
UPDATE public.producao_membros pm
SET rh_colaborador_id = fg.id, updated_at = now()
FROM francis_gestor fg
WHERE lower(btrim(pm.nome)) = 'francis';

UPDATE public.rh_colaboradores rc
SET pista_ativo_legado = EXISTS (
      SELECT 1 FROM public.producao_membros pm WHERE pm.rh_colaborador_id = rc.id
    ),
    ativo = rc.rh_ativo OR rc.controla_ponto OR EXISTS (
      SELECT 1 FROM public.producao_membros pm WHERE pm.rh_colaborador_id = rc.id
    ),
    updated_at = now()
WHERE lower(btrim(rc.nome)) = 'francis';

WITH joao_rh AS (
  SELECT rc.id
  FROM public.rh_colaboradores rc
  WHERE lower(translate(rc.nome, 'ãáàâéêíóôõúç', 'aaaaeeiooouc')) LIKE 'joao ricardo%'
  ORDER BY rc.created_at
  LIMIT 1
)
UPDATE public.producao_membros pm
SET rh_colaborador_id = jr.id, updated_at = now()
FROM joao_rh jr
WHERE lower(btrim(pm.nome)) = 'joao ricardo';

UPDATE public.rh_colaboradores rc
SET pista_ativo_legado = true, ativo = true, updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM public.producao_membros pm
  WHERE pm.rh_colaborador_id = rc.id AND lower(btrim(pm.nome)) = 'joao ricardo'
);

COMMIT;
