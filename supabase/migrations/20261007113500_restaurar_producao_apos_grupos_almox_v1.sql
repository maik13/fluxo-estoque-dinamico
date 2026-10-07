BEGIN;

-- Corrige apenas o agrupamento compartilhado da Produção alterado pela migração anterior.
-- Nenhum status, apontamento, PCP, quantidade, jornada ou movimentação de estoque é restaurado.

DO $$
DECLARE
  v_natal_2026 uuid;
BEGIN
  SELECT id INTO v_natal_2026
  FROM public.project_groups
  WHERE lower(btrim(nome))='natal 2026'
  ORDER BY created_at
  LIMIT 1;

  -- Locais: volta exatamente o group_id existente antes da intervenção.
  UPDATE public.locais_utilizacao l
  SET group_id=b.group_id,
      updated_at=now()
  FROM backup_temporadas_grupos_20261006.locais_utilizacao b
  WHERE l.id=b.id
    AND l.group_id IS DISTINCT FROM b.group_id
    AND (
      l.group_id=v_natal_2026
      OR lower(btrim(coalesce((select nome from public.project_groups where id=l.group_id),'')))='natal 2025'
    );

  -- Planejamento: cidades voltam aos seus agrupamentos originais.
  UPDATE public.producao_planejamento_projetos p
  SET project_group_id=b.project_group_id,
      updated_at=now()
  FROM backup_temporadas_grupos_20261006.producao_planejamento_projetos b
  WHERE p.id=b.id
    AND p.project_group_id IS DISTINCT FROM b.project_group_id;

  -- Peças provisionadas pelo Planejamento voltam ao grupo/cidade original.
  UPDATE public.producao_planejamento_projeto_pecas x
  SET project_group_id=b.project_group_id,
      updated_at=now()
  FROM backup_temporadas_grupos_20261006.producao_planejamento_projeto_pecas b
  WHERE x.id=b.id
    AND x.project_group_id IS DISTINCT FROM b.project_group_id;

  -- OPs: restaura somente o project_group_id original.
  UPDATE public.producao_ordens_producao op
  SET project_group_id=b.project_group_id,
      updated_at=now()
  FROM backup_temporadas_grupos_20261006.producao_ordens_producao b
  WHERE op.id=b.id
    AND op.project_group_id IS DISTINCT FROM b.project_group_id;

  -- Agenda: deriva novamente o grupo da cidade/projeto do Planejamento.
  UPDATE public.producao_planejamento_agenda a
  SET project_group_id=p.project_group_id,
      updated_at=now()
  FROM public.producao_planejamento_projetos p
  WHERE v_natal_2026 IS NOT NULL
    AND a.project_group_id=v_natal_2026
    AND a.projeto_chave=p.chave
    AND p.project_group_id IS NOT NULL;

  -- Pendências de referência: volta ao grupo do respectivo projeto de Planejamento.
  UPDATE public.producao_planejamento_referencias_pendentes r
  SET project_group_id=p.project_group_id,
      updated_at=now()
  FROM public.producao_planejamento_projetos p
  WHERE v_natal_2026 IS NOT NULL
    AND r.project_group_id=v_natal_2026
    AND r.planejamento_projeto_id=p.id
    AND p.project_group_id IS NOT NULL;

  -- Marcos importados da agenda: acompanha novamente o grupo da linha de origem.
  UPDATE public.producao_cronograma_marcos m
  SET project_group_id=a.project_group_id,
      updated_at=now()
  FROM public.producao_planejamento_agenda a
  WHERE v_natal_2026 IS NOT NULL
    AND m.project_group_id=v_natal_2026
    AND m.origem_id=a.id
    AND a.project_group_id IS NOT NULL;

  -- Remove somente as relações artificiais criadas pela migração equivocada.
  IF v_natal_2026 IS NOT NULL THEN
    DELETE FROM public.producao_projeto_grupos
    WHERE project_group_id=v_natal_2026
      AND origem='migracao_temporada_2026';
  END IF;

  -- Recoloca as relações Projeto <-> grupo/cidade que existiam antes.
  INSERT INTO public.producao_projeto_grupos(
    id,projeto_id,project_group_id,quantidade_planejada,origem,ativo,created_at,updated_at
  )
  SELECT
    b.id,b.projeto_id,b.project_group_id,b.quantidade_planejada,b.origem,b.ativo,b.created_at,b.updated_at
  FROM backup_temporadas_grupos_20261006.producao_projeto_grupos b
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.producao_projeto_grupos x
    WHERE x.projeto_id=b.projeto_id
      AND x.project_group_id=b.project_group_id
  );

  -- Reativa os grupos de cidade que a Produção já utilizava.
  UPDATE public.project_groups g
  SET ativo=b.ativo,
      nome=b.nome,
      updated_at=now()
  FROM backup_temporadas_grupos_20261006.project_groups b
  WHERE g.id=b.id
    AND lower(btrim(b.nome)) IN (
      lower('Cianorte'),
      lower('Florianópolis'),
      lower('Natal  Brusque'),
      lower('Pq do Japão (Mga)'),
      lower('ROLANDIA'),
      lower('Três Lagoas')
    );
END $$;

-- Restaura a regra original do Planejamento: o agrupamento interno da Produção
-- continua independente de qualquer agrupamento gerencial do Almoxarifado.
CREATE OR REPLACE FUNCTION app_private.garantir_grupo_planejamento_v1(
  p_planejamento_projeto_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_projeto public.producao_planejamento_projetos%ROWTYPE;
  v_group_id uuid;
BEGIN
  SELECT * INTO v_projeto
  FROM public.producao_planejamento_projetos
  WHERE id=p_planejamento_projeto_id;

  IF v_projeto.id IS NULL THEN
    RAISE EXCEPTION 'Projeto de planejamento não encontrado';
  END IF;

  v_group_id := v_projeto.project_group_id;

  IF v_group_id IS NULL THEN
    SELECT g.id INTO v_group_id
    FROM public.project_groups g
    WHERE g.ativo IS DISTINCT FROM FALSE
      AND public.normalizar_nome_peca_v1(g.nome)
          = public.normalizar_nome_peca_v1(v_projeto.nome)
    ORDER BY g.created_at
    LIMIT 1;

    IF v_group_id IS NULL THEN
      INSERT INTO public.project_groups(nome,ativo)
      VALUES (v_projeto.nome,TRUE)
      RETURNING id INTO v_group_id;
    END IF;

    UPDATE public.producao_planejamento_projetos
    SET project_group_id=v_group_id,
        updated_at=now()
    WHERE id=v_projeto.id;
  END IF;

  RETURN v_group_id;
END;
$$;

REVOKE ALL ON FUNCTION app_private.garantir_grupo_planejamento_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.garantir_grupo_planejamento_v1(uuid) FROM anon;
REVOKE ALL ON FUNCTION app_private.garantir_grupo_planejamento_v1(uuid) FROM authenticated;

DROP FUNCTION IF EXISTS public.criar_cidade_planejamento_v1(text,uuid);
DROP FUNCTION IF EXISTS public.definir_grupo_planejamento_projeto_v1(uuid,uuid);

CREATE OR REPLACE FUNCTION public.criar_cidade_planejamento_v1(
  p_nome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_nome text := NULLIF(BTRIM(p_nome),'');
  v_chave_base text;
  v_chave text;
  v_suffix integer := 1;
  v_group_id uuid;
  v_id uuid;
  v_ordem integer;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar cidade no Planejamento';
  END IF;
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da cidade/projeto';
  END IF;

  SELECT id,project_group_id
    INTO v_id,v_group_id
  FROM public.producao_planejamento_projetos
  WHERE public.normalizar_nome_peca_v1(nome)=public.normalizar_nome_peca_v1(v_nome)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    IF v_group_id IS NULL THEN
      v_group_id := app_private.garantir_grupo_planejamento_v1(v_id);
    END IF;
    RETURN jsonb_build_object(
      'id',v_id,'projectGroupId',v_group_id,'existente',TRUE
    );
  END IF;

  v_chave_base := regexp_replace(
    translate(
      lower(v_nome),
      'áàãâäéèêëíìîïóòõôöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '[^a-z0-9]+','_','g'
  );
  v_chave_base := trim(BOTH '_' FROM v_chave_base);
  IF v_chave_base='' THEN v_chave_base := 'projeto'; END IF;
  v_chave := v_chave_base;

  WHILE EXISTS (
    SELECT 1 FROM public.producao_planejamento_projetos WHERE chave=v_chave
  ) LOOP
    v_suffix := v_suffix+1;
    v_chave := v_chave_base || '_' || v_suffix::text;
  END LOOP;

  SELECT COALESCE(MAX(ordem),0)+1 INTO v_ordem
  FROM public.producao_planejamento_projetos;

  INSERT INTO public.producao_planejamento_projetos(
    chave,nome,ativo_calculo,ordem,fonte,fonte_coluna
  ) VALUES (
    v_chave,v_nome,FALSE,v_ordem,'SISTEMA',NULL
  )
  RETURNING id INTO v_id;

  v_group_id := app_private.garantir_grupo_planejamento_v1(v_id);

  RETURN jsonb_build_object(
    'id',v_id,'chave',v_chave,'projectGroupId',v_group_id,'existente',FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.criar_cidade_planejamento_v1(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.criar_cidade_planejamento_v1(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.criar_cidade_planejamento_v1(text) TO authenticated;

COMMIT;