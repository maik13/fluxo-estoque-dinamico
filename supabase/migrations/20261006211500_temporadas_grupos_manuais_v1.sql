BEGIN;

CREATE SCHEMA IF NOT EXISTS backup_temporadas_grupos_20261006;

CREATE TABLE IF NOT EXISTS backup_temporadas_grupos_20261006.project_groups
AS TABLE public.project_groups WITH DATA;
CREATE TABLE IF NOT EXISTS backup_temporadas_grupos_20261006.locais_utilizacao
AS TABLE public.locais_utilizacao WITH DATA;
CREATE TABLE IF NOT EXISTS backup_temporadas_grupos_20261006.producao_planejamento_projetos
AS TABLE public.producao_planejamento_projetos WITH DATA;
CREATE TABLE IF NOT EXISTS backup_temporadas_grupos_20261006.producao_planejamento_projeto_pecas
AS TABLE public.producao_planejamento_projeto_pecas WITH DATA;
CREATE TABLE IF NOT EXISTS backup_temporadas_grupos_20261006.producao_projeto_grupos
AS TABLE public.producao_projeto_grupos WITH DATA;
CREATE TABLE IF NOT EXISTS backup_temporadas_grupos_20261006.producao_ordens_producao
AS TABLE public.producao_ordens_producao WITH DATA;

DO $$
DECLARE
  v_natal_2025 uuid;
  v_natal_2026 uuid;
BEGIN
  SELECT id INTO v_natal_2025
  FROM public.project_groups
  WHERE lower(btrim(nome))='natal 2025'
  ORDER BY created_at
  LIMIT 1;

  IF v_natal_2025 IS NULL THEN
    SELECT id INTO v_natal_2025
    FROM public.project_groups
    WHERE lower(btrim(nome))='natal 25'
    ORDER BY created_at
    LIMIT 1;

    IF v_natal_2025 IS NOT NULL THEN
      UPDATE public.project_groups
      SET nome='Natal 2025', ativo=TRUE, updated_at=now()
      WHERE id=v_natal_2025;
    ELSE
      INSERT INTO public.project_groups(nome,ativo)
      VALUES ('Natal 2025',TRUE)
      RETURNING id INTO v_natal_2025;
    END IF;
  ELSE
    UPDATE public.project_groups
    SET ativo=TRUE, updated_at=now()
    WHERE id=v_natal_2025;
  END IF;

  SELECT id INTO v_natal_2026
  FROM public.project_groups
  WHERE lower(btrim(nome))='natal 2026'
  ORDER BY created_at
  LIMIT 1;

  IF v_natal_2026 IS NULL THEN
    INSERT INTO public.project_groups(nome,ativo)
    VALUES ('Natal 2026',TRUE)
    RETURNING id INTO v_natal_2026;
  ELSE
    UPDATE public.project_groups
    SET ativo=TRUE, updated_at=now()
    WHERE id=v_natal_2026;
  END IF;

  UPDATE public.locais_utilizacao
  SET group_id=v_natal_2025, updated_at=now()
  WHERE nome IN (
    'Natal Foz do Iguaçu 2025',
    'Restauros Foz Iguaçu 2025',
    'Natal Cascavel 2025',
    'Restauros Cascavel 2025'
  );

  UPDATE public.locais_utilizacao l
  SET group_id=v_natal_2026, updated_at=now()
  WHERE l.group_id IN (
    SELECT g.id
    FROM public.project_groups g
    WHERE lower(btrim(g.nome)) IN (
      lower('Cianorte'),
      lower('Florianópolis'),
      lower('Natal  Brusque'),
      lower('Pq do Japão (Mga)'),
      lower('ROLANDIA'),
      lower('Três Lagoas')
    )
  );

  UPDATE public.locais_utilizacao
  SET group_id=v_natal_2026, updated_at=now()
  WHERE group_id IS NULL
    AND nome='TEC-46 - Conjunto Maria, José e Burrinho · Rolândia';

  UPDATE public.producao_planejamento_projetos p
  SET project_group_id=v_natal_2026, updated_at=now()
  WHERE p.project_group_id IN (
    SELECT g.id FROM public.project_groups g
    WHERE lower(btrim(g.nome)) IN (
      lower('Cianorte'),
      lower('Florianópolis'),
      lower('Natal  Brusque'),
      lower('Pq do Japão (Mga)'),
      lower('ROLANDIA'),
      lower('Três Lagoas')
    )
  );

  UPDATE public.producao_planejamento_projeto_pecas x
  SET project_group_id=v_natal_2026, updated_at=now()
  WHERE x.project_group_id IN (
    SELECT g.id FROM public.project_groups g
    WHERE lower(btrim(g.nome)) IN (
      lower('Cianorte'),
      lower('Florianópolis'),
      lower('Natal  Brusque'),
      lower('Pq do Japão (Mga)'),
      lower('ROLANDIA'),
      lower('Três Lagoas')
    )
  );

  UPDATE public.producao_planejamento_agenda x
  SET project_group_id=v_natal_2026, updated_at=now()
  WHERE x.project_group_id IN (
    SELECT g.id FROM public.project_groups g
    WHERE lower(btrim(g.nome)) IN (
      lower('Cianorte'),
      lower('Florianópolis'),
      lower('Natal  Brusque'),
      lower('Pq do Japão (Mga)'),
      lower('ROLANDIA'),
      lower('Três Lagoas')
    )
  );

  UPDATE public.producao_programacao_diaria x
  SET project_group_id=v_natal_2026, updated_at=now()
  WHERE x.project_group_id IN (
    SELECT g.id FROM public.project_groups g
    WHERE lower(btrim(g.nome)) IN (
      lower('Cianorte'),
      lower('Florianópolis'),
      lower('Natal  Brusque'),
      lower('Pq do Japão (Mga)'),
      lower('ROLANDIA'),
      lower('Três Lagoas')
    )
  );

  UPDATE public.producao_ordens_producao x
  SET project_group_id=v_natal_2026, updated_at=now()
  WHERE x.project_group_id IN (
    SELECT g.id FROM public.project_groups g
    WHERE lower(btrim(g.nome)) IN (
      lower('Cianorte'),
      lower('Florianópolis'),
      lower('Natal  Brusque'),
      lower('Pq do Japão (Mga)'),
      lower('ROLANDIA'),
      lower('Três Lagoas')
    )
  );

  UPDATE public.producao_acervo_reservas x
  SET project_group_id=v_natal_2026, updated_at=now()
  WHERE x.project_group_id IN (
    SELECT g.id FROM public.project_groups g
    WHERE lower(btrim(g.nome)) IN (
      lower('Cianorte'),
      lower('Florianópolis'),
      lower('Natal  Brusque'),
      lower('Pq do Japão (Mga)'),
      lower('ROLANDIA'),
      lower('Três Lagoas')
    )
  );

  UPDATE public.producao_cronograma_marcos x
  SET project_group_id=v_natal_2026, updated_at=now()
  WHERE x.project_group_id IN (
    SELECT g.id FROM public.project_groups g
    WHERE lower(btrim(g.nome)) IN (
      lower('Cianorte'),
      lower('Florianópolis'),
      lower('Natal  Brusque'),
      lower('Pq do Japão (Mga)'),
      lower('ROLANDIA'),
      lower('Três Lagoas')
    )
  );

  UPDATE public.producao_planejamento_referencias_pendentes x
  SET project_group_id=v_natal_2026, updated_at=now()
  WHERE x.project_group_id IN (
    SELECT g.id FROM public.project_groups g
    WHERE lower(btrim(g.nome)) IN (
      lower('Cianorte'),
      lower('Florianópolis'),
      lower('Natal  Brusque'),
      lower('Pq do Japão (Mga)'),
      lower('ROLANDIA'),
      lower('Três Lagoas')
    )
  );

  INSERT INTO public.producao_projeto_grupos(
    projeto_id,project_group_id,quantidade_planejada,origem,ativo,created_at,updated_at
  )
  SELECT
    pg.projeto_id,
    v_natal_2026,
    max(pg.quantidade_planejada),
    'migracao_temporada_2026',
    bool_or(pg.ativo),
    min(pg.created_at),
    now()
  FROM public.producao_projeto_grupos pg
  WHERE pg.project_group_id IN (
    SELECT g.id FROM public.project_groups g
    WHERE lower(btrim(g.nome)) IN (
      lower('Cianorte'),
      lower('Florianópolis'),
      lower('Natal  Brusque'),
      lower('Pq do Japão (Mga)'),
      lower('ROLANDIA'),
      lower('Três Lagoas')
    )
  )
  GROUP BY pg.projeto_id
  ON CONFLICT (projeto_id,project_group_id) DO UPDATE
  SET
    quantidade_planejada=COALESCE(EXCLUDED.quantidade_planejada,public.producao_projeto_grupos.quantidade_planejada),
    ativo=EXCLUDED.ativo,
    updated_at=now();

  DELETE FROM public.producao_projeto_grupos pg
  WHERE pg.project_group_id IN (
    SELECT g.id FROM public.project_groups g
    WHERE lower(btrim(g.nome)) IN (
      lower('Cianorte'),
      lower('Florianópolis'),
      lower('Natal  Brusque'),
      lower('Pq do Japão (Mga)'),
      lower('ROLANDIA'),
      lower('Três Lagoas')
    )
  );

  UPDATE public.project_groups g
  SET ativo=FALSE, updated_at=now()
  WHERE lower(btrim(g.nome)) IN (
    lower('Cianorte'),
    lower('Florianópolis'),
    lower('Natal  Brusque'),
    lower('Pq do Japão (Mga)'),
    lower('ROLANDIA'),
    lower('Três Lagoas')
  );
END $$;

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
  v_group_ativo boolean;
BEGIN
  SELECT * INTO v_projeto
  FROM public.producao_planejamento_projetos
  WHERE id=p_planejamento_projeto_id;

  IF v_projeto.id IS NULL THEN
    RAISE EXCEPTION 'Projeto de planejamento não encontrado';
  END IF;

  v_group_id := v_projeto.project_group_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Defina a Temporada / Grupo da cidade antes de integrar o Planejamento';
  END IF;

  SELECT ativo INTO v_group_ativo
  FROM public.project_groups
  WHERE id=v_group_id;

  IF NOT FOUND OR v_group_ativo IS FALSE THEN
    RAISE EXCEPTION 'A Temporada / Grupo vinculada à cidade não está ativa';
  END IF;

  RETURN v_group_id;
END;
$$;

REVOKE ALL ON FUNCTION app_private.garantir_grupo_planejamento_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.garantir_grupo_planejamento_v1(uuid) FROM anon;
REVOKE ALL ON FUNCTION app_private.garantir_grupo_planejamento_v1(uuid) FROM authenticated;

DROP FUNCTION IF EXISTS public.criar_cidade_planejamento_v1(text);

CREATE OR REPLACE FUNCTION public.criar_cidade_planejamento_v1(
  p_nome text,
  p_project_group_id uuid DEFAULT NULL
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
  v_group_id uuid := p_project_group_id;
  v_id uuid;
  v_ordem integer;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar cidade no Planejamento';
  END IF;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da cidade/projeto';
  END IF;

  IF v_group_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.project_groups g
    WHERE g.id=v_group_id AND g.ativo IS DISTINCT FROM FALSE
  ) THEN
    RAISE EXCEPTION 'Selecione uma Temporada / Grupo ativa antes de cadastrar a cidade';
  END IF;

  SELECT id,project_group_id
    INTO v_id,v_group_id
  FROM public.producao_planejamento_projetos
  WHERE public.normalizar_nome_peca_v1(nome)=public.normalizar_nome_peca_v1(v_nome)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    IF v_group_id IS NULL THEN
      UPDATE public.producao_planejamento_projetos
      SET project_group_id=p_project_group_id, updated_at=now()
      WHERE id=v_id;
      v_group_id := p_project_group_id;
    ELSIF v_group_id <> p_project_group_id THEN
      RAISE EXCEPTION 'A cidade já pertence a outra Temporada / Grupo. Altere o vínculo pela própria cidade antes de continuar';
    END IF;

    RETURN jsonb_build_object(
      'id',v_id,'projectGroupId',v_group_id,'existente',TRUE
    );
  END IF;

  v_group_id := p_project_group_id;

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
    chave,nome,project_group_id,ativo_calculo,ordem,fonte,fonte_coluna
  ) VALUES (
    v_chave,v_nome,v_group_id,FALSE,v_ordem,'SISTEMA',NULL
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',v_id,'chave',v_chave,'projectGroupId',v_group_id,'existente',FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.criar_cidade_planejamento_v1(text,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.criar_cidade_planejamento_v1(text,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.criar_cidade_planejamento_v1(text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_grupo_planejamento_projeto_v1(
  p_projeto_id uuid,
  p_project_group_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_atual uuid;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para alterar a Temporada / Grupo do Planejamento';
  END IF;

  IF p_project_group_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.project_groups g
    WHERE g.id=p_project_group_id AND g.ativo IS DISTINCT FROM FALSE
  ) THEN
    RAISE EXCEPTION 'Selecione uma Temporada / Grupo ativa';
  END IF;

  SELECT project_group_id INTO v_atual
  FROM public.producao_planejamento_projetos
  WHERE id=p_projeto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cidade/projeto de planejamento não encontrado';
  END IF;

  IF v_atual IS NOT DISTINCT FROM p_project_group_id THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.producao_planejamento_projeto_pecas
    WHERE planejamento_projeto_id=p_projeto_id
  ) THEN
    RAISE EXCEPTION 'Esta cidade já possui Projetos/peças integrados. A reclassificação exige migração controlada para preservar o histórico';
  END IF;

  UPDATE public.producao_planejamento_projetos
  SET project_group_id=p_project_group_id, updated_at=now()
  WHERE id=p_projeto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_grupo_planejamento_projeto_v1(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.definir_grupo_planejamento_projeto_v1(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.definir_grupo_planejamento_projeto_v1(uuid,uuid) TO authenticated;

COMMIT;