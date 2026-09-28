BEGIN;

CREATE SCHEMA IF NOT EXISTS backup_projeto_multigrupo_20260928;

CREATE TABLE IF NOT EXISTS backup_projeto_multigrupo_20260928.producao_projetos
AS SELECT * FROM public.producao_projetos;

CREATE TABLE IF NOT EXISTS backup_projeto_multigrupo_20260928.locais_utilizacao
AS SELECT * FROM public.locais_utilizacao;

CREATE TABLE IF NOT EXISTS backup_projeto_multigrupo_20260928.producao_ordens_producao
AS SELECT * FROM public.producao_ordens_producao;

CREATE TABLE IF NOT EXISTS backup_projeto_multigrupo_20260928.producao_planejamento_projeto_pecas
AS SELECT * FROM public.producao_planejamento_projeto_pecas;

CREATE TABLE IF NOT EXISTS backup_projeto_multigrupo_20260928.metadados(
  id integer PRIMARY KEY DEFAULT 1 CHECK(id=1),
  criado_em timestamptz NOT NULL DEFAULT now(),
  motivo text NOT NULL
);
INSERT INTO backup_projeto_multigrupo_20260928.metadados(id,motivo)
VALUES(
  1,
  'Evolução de Projeto de Produção para múltiplos Grupos/Cidades e destino explícito por OP. BPE permanece cadastro único.'
)
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.producao_projeto_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.producao_projetos(id) ON DELETE CASCADE,
  project_group_id uuid NOT NULL REFERENCES public.project_groups(id) ON DELETE RESTRICT,
  quantidade_planejada numeric NULL CHECK (quantidade_planejada IS NULL OR quantidade_planejada >= 0),
  origem text NOT NULL DEFAULT 'cadastro',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(projeto_id, project_group_id)
);

CREATE INDEX IF NOT EXISTS producao_projeto_grupos_projeto_idx
  ON public.producao_projeto_grupos(projeto_id);
CREATE INDEX IF NOT EXISTS producao_projeto_grupos_grupo_idx
  ON public.producao_projeto_grupos(project_group_id);

ALTER TABLE public.producao_projeto_grupos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_projeto_grupos_leitura ON public.producao_projeto_grupos;
CREATE POLICY producao_projeto_grupos_leitura
ON public.producao_projeto_grupos
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

GRANT SELECT ON public.producao_projeto_grupos TO authenticated;
REVOKE ALL ON public.producao_projeto_grupos FROM anon;

ALTER TABLE public.producao_ordens_producao
  ADD COLUMN IF NOT EXISTS project_group_id uuid
    REFERENCES public.project_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS producao_ordens_producao_project_group_idx
  ON public.producao_ordens_producao(project_group_id);

-- Migra a regra antiga 1 Local -> 1 Grupo para a nova associação universal.
INSERT INTO public.producao_projeto_grupos(
  projeto_id,project_group_id,origem,ativo
)
SELECT p.id,l.group_id,'local_legado',true
FROM public.producao_projetos p
JOIN public.locais_utilizacao l ON l.id=p.local_utilizacao_id
WHERE l.group_id IS NOT NULL
ON CONFLICT(projeto_id,project_group_id)
DO UPDATE SET ativo=true,updated_at=now();

-- OPs existentes herdam o grupo do Local quando esse vínculo é inequívoco.
UPDATE public.producao_ordens_producao o
SET project_group_id=l.group_id
FROM public.producao_projetos p
JOIN public.locais_utilizacao l ON l.id=p.local_utilizacao_id
WHERE o.projeto_id=p.id
  AND o.project_group_id IS NULL
  AND l.group_id IS NOT NULL;

DO $$
DECLARE
  v_bpe uuid;
  v_local uuid;
  v_br uuid;
  v_rol uuid;
BEGIN
  SELECT p.id,p.local_utilizacao_id
  INTO v_bpe,v_local
  FROM public.producao_projetos p
  WHERE btrim(p.nome)='BPE - Bolas Penduradas'
  LIMIT 1;

  SELECT id INTO v_br
  FROM public.project_groups
  WHERE lower(nome) LIKE '%brusque%'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO v_rol
  FROM public.project_groups
  WHERE lower(nome) LIKE 'roland%'
  ORDER BY created_at
  LIMIT 1;

  IF v_bpe IS NULL OR v_local IS NULL THEN
    RAISE EXCEPTION 'Cadastro mestre BPE - Bolas Penduradas não encontrado';
  END IF;
  IF v_br IS NULL OR v_rol IS NULL THEN
    RAISE EXCEPTION 'Grupos Brusque/Rolândia não encontrados';
  END IF;

  -- Edita o cadastro existente; não cria novo Projeto nem novo Local.
  UPDATE public.locais_utilizacao
  SET nome='TEC-24 - Bolas penduradas - 80 cm',
      group_id=NULL,
      updated_at=now()
  WHERE id=v_local;

  UPDATE public.producao_projetos
  SET nome='TEC-24 - Bolas penduradas - 80 cm',
      observacoes=concat_ws(
        E'\n',
        NULLIF(observacoes,''),
        'Cadastro mestre compartilhado entre Brusque e Rolândia. Destino operacional definido por OP.'
      ),
      atualizado_por_nome_snapshot='Correção estrutural BPE multigrupo',
      updated_at=now()
  WHERE id=v_bpe;

  INSERT INTO public.producao_projeto_grupos(
    projeto_id,project_group_id,quantidade_planejada,origem,ativo
  ) VALUES
    (v_bpe,v_br,10,'planejamento',true),
    (v_bpe,v_rol,50,'planejamento',true)
  ON CONFLICT(projeto_id,project_group_id)
  DO UPDATE SET
    quantidade_planejada=EXCLUDED.quantidade_planejada,
    origem='planejamento',
    ativo=true,
    updated_at=now();

  -- Prioridade confirmada: primeiras 10 unidades (OP 29) = Brusque.
  UPDATE public.producao_ordens_producao
  SET project_group_id=v_br,
      updated_at=now()
  WHERE projeto_id=v_bpe
    AND numero=29;

  -- Todo o fluxo posterior do cadastro mestre = Rolândia.
  UPDATE public.producao_ordens_producao
  SET project_group_id=v_rol,
      updated_at=now()
  WHERE projeto_id=v_bpe
    AND numero<>29;

  -- Planejamento continua apontando ao MESMO cadastro mestre.
  UPDATE public.producao_planejamento_projeto_pecas x
  SET codigo_peca='TEC-24',
      project_group_id=v_br,
      local_utilizacao_id=v_local,
      producao_projeto_id=v_bpe,
      quantidade_planejada=10,
      updated_at=now()
  FROM public.producao_planejamento_projetos pp,
       public.producao_planejamento_itens i
  WHERE x.planejamento_projeto_id=pp.id
    AND x.planejamento_item_id=i.id
    AND pp.chave='brusque'
    AND i.nome='Bolas penduradas - 80 cm';

  UPDATE public.producao_planejamento_projeto_pecas x
  SET codigo_peca='TEC-24',
      project_group_id=v_rol,
      local_utilizacao_id=v_local,
      producao_projeto_id=v_bpe,
      quantidade_planejada=50,
      updated_at=now()
  FROM public.producao_planejamento_projetos pp,
       public.producao_planejamento_itens i
  WHERE x.planejamento_projeto_id=pp.id
    AND x.planejamento_item_id=i.id
    AND pp.chave='rolandia'
    AND i.nome='Bolas penduradas - 80 cm';
END;
$$;

COMMIT;
