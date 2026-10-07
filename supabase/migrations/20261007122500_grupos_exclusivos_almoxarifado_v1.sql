BEGIN;

CREATE TABLE IF NOT EXISTS public.almoxarifado_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS almoxarifado_grupos_nome_normalizado_uidx
  ON public.almoxarifado_grupos ((lower(btrim(nome))));

CREATE TABLE IF NOT EXISTS public.almoxarifado_grupo_locais (
  grupo_id uuid NOT NULL REFERENCES public.almoxarifado_grupos(id) ON DELETE CASCADE,
  local_utilizacao_id uuid NOT NULL REFERENCES public.locais_utilizacao(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grupo_id, local_utilizacao_id),
  UNIQUE (local_utilizacao_id)
);

CREATE INDEX IF NOT EXISTS almoxarifado_grupo_locais_grupo_idx
  ON public.almoxarifado_grupo_locais(grupo_id);

ALTER TABLE public.almoxarifado_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almoxarifado_grupo_locais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS almoxarifado_grupos_leitura ON public.almoxarifado_grupos;
CREATE POLICY almoxarifado_grupos_leitura
ON public.almoxarifado_grupos
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS almoxarifado_grupo_locais_leitura ON public.almoxarifado_grupo_locais;
CREATE POLICY almoxarifado_grupo_locais_leitura
ON public.almoxarifado_grupo_locais
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

INSERT INTO public.almoxarifado_grupos(nome)
SELECT 'Natal 2025'
WHERE NOT EXISTS (
  SELECT 1 FROM public.almoxarifado_grupos WHERE lower(btrim(nome))='natal 2025'
);

INSERT INTO public.almoxarifado_grupos(nome)
SELECT 'Natal 2026'
WHERE NOT EXISTS (
  SELECT 1 FROM public.almoxarifado_grupos WHERE lower(btrim(nome))='natal 2026'
);

INSERT INTO public.almoxarifado_grupos(nome)
SELECT 'PÁSCOA'
WHERE NOT EXISTS (
  SELECT 1 FROM public.almoxarifado_grupos WHERE lower(btrim(nome)) in ('páscoa','pascoa')
);

INSERT INTO public.almoxarifado_grupos(nome)
SELECT 'TOCTAL'
WHERE NOT EXISTS (
  SELECT 1 FROM public.almoxarifado_grupos WHERE lower(btrim(nome))='toctal'
);

-- Copia para o Almoxarifado os agrupamentos históricos que já existiam,
-- sem alterar o group_id compartilhado com a Produção.
INSERT INTO public.almoxarifado_grupo_locais(grupo_id,local_utilizacao_id)
SELECT ag.id,l.id
FROM public.locais_utilizacao l
JOIN public.project_groups pg ON pg.id=l.group_id
JOIN public.almoxarifado_grupos ag ON lower(btrim(ag.nome)) in ('páscoa','pascoa')
WHERE lower(btrim(pg.nome))='pascoa'
ON CONFLICT (local_utilizacao_id) DO UPDATE
SET grupo_id=EXCLUDED.grupo_id;

INSERT INTO public.almoxarifado_grupo_locais(grupo_id,local_utilizacao_id)
SELECT ag.id,l.id
FROM public.locais_utilizacao l
JOIN public.project_groups pg ON pg.id=l.group_id
JOIN public.almoxarifado_grupos ag ON lower(btrim(ag.nome))='toctal'
WHERE lower(btrim(pg.nome))='toctal'
ON CONFLICT (local_utilizacao_id) DO UPDATE
SET grupo_id=EXCLUDED.grupo_id;

-- Natal 2025: destinos históricos conhecidos.
INSERT INTO public.almoxarifado_grupo_locais(grupo_id,local_utilizacao_id)
SELECT ag.id,l.id
FROM public.locais_utilizacao l
JOIN public.almoxarifado_grupos ag ON lower(btrim(ag.nome))='natal 2025'
WHERE l.nome IN (
  'Natal Foz do Iguaçu 2025',
  'Restauros Foz Iguaçu 2025',
  'Natal Cascavel 2025',
  'Restauros Cascavel 2025'
)
ON CONFLICT (local_utilizacao_id) DO UPDATE
SET grupo_id=EXCLUDED.grupo_id;

-- Natal 2026 no Almoxarifado: Brusque, Rolândia e Parque do Japão.
-- Todos os locais operacionais desses destinos entram na temporada do Almoxarifado,
-- mas continuam nos grupos originais da Produção.
INSERT INTO public.almoxarifado_grupo_locais(grupo_id,local_utilizacao_id)
SELECT ag.id,l.id
FROM public.locais_utilizacao l
JOIN public.project_groups pg ON pg.id=l.group_id
JOIN public.almoxarifado_grupos ag ON lower(btrim(ag.nome))='natal 2026'
WHERE lower(btrim(pg.nome)) IN (
  lower('Natal  Brusque'),
  lower('ROLANDIA'),
  lower('Pq do Japão (Mga)')
)
ON CONFLICT (local_utilizacao_id) DO UPDATE
SET grupo_id=EXCLUDED.grupo_id;

-- Os três locais genéricos deixam de ter o mesmo nome e passam a representar
-- somente o destino dentro do agrupamento do Almoxarifado.
UPDATE public.locais_utilizacao
SET nome = CASE id
  WHEN 'd0c0b683-39d6-479b-b0e1-a4f5ef302ea0'::uuid THEN 'Brusque'
  WHEN '171bcfe5-e18f-424d-9f01-7795edab780a'::uuid THEN 'Rolândia'
  WHEN '83de8922-f069-4690-8662-449e4dbc4fc0'::uuid THEN 'Pq do Japão (Mga)'
  ELSE nome
END,
updated_at=now()
WHERE id IN (
  'd0c0b683-39d6-479b-b0e1-a4f5ef302ea0'::uuid,
  '171bcfe5-e18f-424d-9f01-7795edab780a'::uuid,
  '83de8922-f069-4690-8662-449e4dbc4fc0'::uuid
);

UPDATE public.solicitacoes_material sm
SET local_origem=l.nome,
    updated_at=now()
FROM public.locais_utilizacao l
WHERE sm.local_origem_id=l.id
  AND l.id IN (
    'd0c0b683-39d6-479b-b0e1-a4f5ef302ea0'::uuid,
    '171bcfe5-e18f-424d-9f01-7795edab780a'::uuid,
    '83de8922-f069-4690-8662-449e4dbc4fc0'::uuid
  );

COMMIT;