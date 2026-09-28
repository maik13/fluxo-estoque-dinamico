BEGIN;

-- Backup aditivo antes de integrar Planejamento aos cadastros oficiais.
CREATE SCHEMA IF NOT EXISTS backup_planejamento_projetos_20260928;

CREATE TABLE IF NOT EXISTS backup_planejamento_projetos_20260928.project_groups
AS TABLE public.project_groups WITH DATA;
CREATE TABLE IF NOT EXISTS backup_planejamento_projetos_20260928.locais_utilizacao
AS TABLE public.locais_utilizacao WITH DATA;
CREATE TABLE IF NOT EXISTS backup_planejamento_projetos_20260928.producao_projetos
AS TABLE public.producao_projetos WITH DATA;
CREATE TABLE IF NOT EXISTS backup_planejamento_projetos_20260928.producao_planejamento_projetos
AS TABLE public.producao_planejamento_projetos WITH DATA;
CREATE TABLE IF NOT EXISTS backup_planejamento_projetos_20260928.producao_planejamento_itens
AS TABLE public.producao_planejamento_itens WITH DATA;

CREATE TABLE IF NOT EXISTS backup_planejamento_projetos_20260928.metadados (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  criado_em timestamptz NOT NULL DEFAULT now(),
  motivo text NOT NULL
);
INSERT INTO backup_planejamento_projetos_20260928.metadados(id,motivo)
VALUES (
  1,
  'Backup antes do provisionamento automático Planejamento -> Grupo -> Local de Utilização -> Projeto'
)
ON CONFLICT (id) DO NOTHING;

-- Código interno de peça. Não é o codigo_barras do almoxarifado.
ALTER TABLE public.producao_planejamento_itens
  ADD COLUMN IF NOT EXISTS codigo_producao text;

CREATE SEQUENCE IF NOT EXISTS public.producao_planejamento_codigo_peca_seq
  START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.normalizar_nome_peca_v1(p_valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(
            lower(coalesce(p_valor,'')),
            'áàãâäéèêëíìîïóòõôöúùûüç',
            'aaaaaeeeeiiiiooooouuuuc'
          ),
          '^\s*[a-z0-9._]{2,12}\s*-\s*',
          '',
          'i'
        ),
        '(\mpapai\M|\mmodelo\M\s*[0-9]+|\mde\M|\mda\M|\mdo\M|\mdas\M|\mdos\M|\me\M)',
        ' ',
        'g'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.preencher_codigo_peca_planejamento_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_codigo text;
BEGIN
  IF NULLIF(BTRIM(NEW.codigo_producao),'') IS NOT NULL THEN
    NEW.codigo_producao := UPPER(BTRIM(NEW.codigo_producao));
    RETURN NEW;
  END IF;

  SELECT i.codigo_producao
    INTO v_codigo
  FROM public.producao_planejamento_itens i
  WHERE i.id IS DISTINCT FROM NEW.id
    AND NULLIF(BTRIM(i.codigo_producao),'') IS NOT NULL
    AND public.normalizar_nome_peca_v1(i.nome) = public.normalizar_nome_peca_v1(NEW.nome)
  ORDER BY i.created_at
  LIMIT 1;

  IF v_codigo IS NULL AND NULLIF(BTRIM(NEW.acervo_codigo_ref),'') IS NOT NULL THEN
    v_codigo := UPPER(BTRIM(NEW.acervo_codigo_ref));
  END IF;

  IF v_codigo IS NULL THEN
    v_codigo := 'PCE-' || LPAD(
      nextval('public.producao_planejamento_codigo_peca_seq')::text,
      4,
      '0'
    );
  END IF;

  NEW.codigo_producao := v_codigo;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.preencher_codigo_peca_planejamento_v1() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_preencher_codigo_peca_planejamento_v1
ON public.producao_planejamento_itens;
CREATE TRIGGER trg_preencher_codigo_peca_planejamento_v1
BEFORE INSERT OR UPDATE OF nome, acervo_codigo_ref, codigo_producao
ON public.producao_planejamento_itens
FOR EACH ROW
EXECUTE FUNCTION public.preencher_codigo_peca_planejamento_v1();

-- Inicializa códigos das peças existentes sem alterar sua demanda/histórico.
UPDATE public.producao_planejamento_itens
SET codigo_producao = UPPER(BTRIM(acervo_codigo_ref))
WHERE NULLIF(BTRIM(codigo_producao),'') IS NULL
  AND NULLIF(BTRIM(acervo_codigo_ref),'') IS NOT NULL;

DO $$
DECLARE
  r record;
  v_codigo text;
BEGIN
  FOR r IN
    SELECT id,nome
    FROM public.producao_planejamento_itens
    WHERE NULLIF(BTRIM(codigo_producao),'') IS NULL
    ORDER BY fonte,fonte_linha,id
  LOOP
    SELECT codigo_producao
      INTO v_codigo
    FROM public.producao_planejamento_itens
    WHERE id <> r.id
      AND NULLIF(BTRIM(codigo_producao),'') IS NOT NULL
      AND public.normalizar_nome_peca_v1(nome)=public.normalizar_nome_peca_v1(r.nome)
    ORDER BY created_at
    LIMIT 1;

    IF v_codigo IS NULL THEN
      v_codigo := 'PCE-' || LPAD(
        nextval('public.producao_planejamento_codigo_peca_seq')::text,
        4,
        '0'
      );
    END IF;

    UPDATE public.producao_planejamento_itens
    SET codigo_producao=v_codigo
    WHERE id=r.id;
  END LOOP;
END;
$$;

ALTER TABLE public.producao_planejamento_itens
  ALTER COLUMN codigo_producao SET NOT NULL;

CREATE INDEX IF NOT EXISTS producao_planejamento_itens_codigo_idx
  ON public.producao_planejamento_itens(codigo_producao);

-- Vínculo explícito: cidade/projeto de planejamento -> peça -> cadastro oficial.
CREATE TABLE IF NOT EXISTS public.producao_planejamento_projeto_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_projeto_id uuid NOT NULL
    REFERENCES public.producao_planejamento_projetos(id) ON DELETE CASCADE,
  planejamento_item_id uuid
    REFERENCES public.producao_planejamento_itens(id) ON DELETE SET NULL,
  codigo_peca text NOT NULL,
  project_group_id uuid NOT NULL
    REFERENCES public.project_groups(id) ON DELETE RESTRICT,
  local_utilizacao_id uuid NOT NULL
    REFERENCES public.locais_utilizacao(id) ON DELETE RESTRICT,
  producao_projeto_id uuid NOT NULL
    REFERENCES public.producao_projetos(id) ON DELETE RESTRICT,
  quantidade_planejada numeric NOT NULL DEFAULT 0 CHECK (quantidade_planejada >= 0),
  origem text NOT NULL DEFAULT 'planejamento',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planejamento_projeto_id,codigo_peca)
);

CREATE INDEX IF NOT EXISTS producao_planejamento_projeto_pecas_group_idx
  ON public.producao_planejamento_projeto_pecas(project_group_id);
CREATE INDEX IF NOT EXISTS producao_planejamento_projeto_pecas_local_idx
  ON public.producao_planejamento_projeto_pecas(local_utilizacao_id);
CREATE INDEX IF NOT EXISTS producao_planejamento_projeto_pecas_projeto_idx
  ON public.producao_planejamento_projeto_pecas(producao_projeto_id);

ALTER TABLE public.producao_planejamento_projeto_pecas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_planejamento_projeto_pecas_leitura
ON public.producao_planejamento_projeto_pecas;
CREATE POLICY producao_planejamento_projeto_pecas_leitura
ON public.producao_planejamento_projeto_pecas
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

-- Funções internas ficam fora da Data API.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon;
REVOKE ALL ON SCHEMA app_private FROM authenticated;

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

CREATE OR REPLACE FUNCTION app_private.provisionar_projeto_planejamento_v1(
  p_planejamento_projeto_id uuid,
  p_usuario_id uuid DEFAULT NULL,
  p_usuario_nome text DEFAULT 'Planejamento automático'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.producao_planejamento_projetos%ROWTYPE;
  v_group_id uuid;
  v_local_id uuid;
  v_prod_id uuid;
  v_local_nome text;
  v_criados_locais integer := 0;
  v_reutilizados_locais integer := 0;
  v_criados_projetos integer := 0;
  v_vinculos integer := 0;
  r record;
BEGIN
  SELECT * INTO v_plan
  FROM public.producao_planejamento_projetos
  WHERE id=p_planejamento_projeto_id;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'Projeto de planejamento não encontrado';
  END IF;

  v_group_id := app_private.garantir_grupo_planejamento_v1(v_plan.id);

  FOR r IN
    SELECT
      i.codigo_producao AS codigo,
      MIN(i.id::text)::uuid AS planejamento_item_id,
      MIN(i.nome) AS nome,
      SUM(COALESCE((i.demandas->>v_plan.chave)::numeric,0)) AS quantidade
    FROM public.producao_planejamento_itens i
    WHERE i.ativo=TRUE
      AND COALESCE((i.demandas->>v_plan.chave)::numeric,0)>0
    GROUP BY i.codigo_producao
    ORDER BY i.codigo_producao
  LOOP
    v_local_id := NULL;
    v_prod_id := NULL;
    v_local_nome := NULL;

    SELECT x.local_utilizacao_id,x.producao_projeto_id,l.nome
      INTO v_local_id,v_prod_id,v_local_nome
    FROM public.producao_planejamento_projeto_pecas x
    JOIN public.locais_utilizacao l ON l.id=x.local_utilizacao_id
    WHERE x.planejamento_projeto_id=v_plan.id
      AND x.codigo_peca=r.codigo
    LIMIT 1;

    IF v_local_id IS NULL THEN
      SELECT l.id,p.id,l.nome
        INTO v_local_id,v_prod_id,v_local_nome
      FROM public.locais_utilizacao l
      LEFT JOIN public.producao_projetos p
        ON p.local_utilizacao_id=l.id
      WHERE l.group_id=v_group_id
        AND l.ativo=TRUE
        AND (
          UPPER(BTRIM(split_part(l.nome,'-',1)))=UPPER(BTRIM(r.codigo))
          OR public.normalizar_nome_peca_v1(l.nome)
             = public.normalizar_nome_peca_v1(r.nome)
        )
      ORDER BY
        CASE
          WHEN UPPER(BTRIM(split_part(l.nome,'-',1)))=UPPER(BTRIM(r.codigo)) THEN 0
          ELSE 1
        END,
        l.created_at
      LIMIT 1;

      IF v_local_id IS NOT NULL THEN
        v_reutilizados_locais := v_reutilizados_locais+1;
      END IF;
    END IF;

    IF v_local_id IS NULL THEN
      v_local_nome := r.codigo || ' - ' || r.nome;
      INSERT INTO public.locais_utilizacao(
        id,nome,ativo,created_at,updated_at,group_id
      ) VALUES (
        gen_random_uuid(),v_local_nome,TRUE,now(),now(),v_group_id
      )
      RETURNING id INTO v_local_id;
      v_criados_locais := v_criados_locais+1;
    END IF;

    IF v_prod_id IS NULL THEN
      SELECT id INTO v_prod_id
      FROM public.producao_projetos
      WHERE local_utilizacao_id=v_local_id
      LIMIT 1;
    END IF;

    IF v_prod_id IS NULL THEN
      INSERT INTO public.producao_projetos(
        local_utilizacao_id,
        nome,
        cidade,
        ativo,
        status,
        criado_por_id,
        criado_por_nome_snapshot,
        atualizado_por_id,
        atualizado_por_nome_snapshot
      ) VALUES (
        v_local_id,
        v_local_nome,
        v_plan.nome,
        TRUE,
        'planejado',
        p_usuario_id,
        p_usuario_nome,
        p_usuario_id,
        p_usuario_nome
      )
      RETURNING id INTO v_prod_id;
      v_criados_projetos := v_criados_projetos+1;
    END IF;

    INSERT INTO public.producao_planejamento_projeto_pecas(
      planejamento_projeto_id,
      planejamento_item_id,
      codigo_peca,
      project_group_id,
      local_utilizacao_id,
      producao_projeto_id,
      quantidade_planejada,
      origem
    ) VALUES (
      v_plan.id,
      r.planejamento_item_id,
      r.codigo,
      v_group_id,
      v_local_id,
      v_prod_id,
      r.quantidade,
      'planejamento'
    )
    ON CONFLICT (planejamento_projeto_id,codigo_peca)
    DO UPDATE SET
      planejamento_item_id=EXCLUDED.planejamento_item_id,
      project_group_id=EXCLUDED.project_group_id,
      local_utilizacao_id=EXCLUDED.local_utilizacao_id,
      producao_projeto_id=EXCLUDED.producao_projeto_id,
      quantidade_planejada=EXCLUDED.quantidade_planejada,
      updated_at=now();

    v_vinculos := v_vinculos+1;
  END LOOP;

  RETURN jsonb_build_object(
    'projectGroupId',v_group_id,
    'locaisCriados',v_criados_locais,
    'locaisReutilizados',v_reutilizados_locais,
    'projetosCriados',v_criados_projetos,
    'pecasVinculadas',v_vinculos
  );
END;
$$;

REVOKE ALL ON FUNCTION app_private.provisionar_projeto_planejamento_v1(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.provisionar_projeto_planejamento_v1(uuid,uuid,text) FROM anon;
REVOKE ALL ON FUNCTION app_private.provisionar_projeto_planejamento_v1(uuid,uuid,text) FROM authenticated;

-- O mesmo RPC já chamado pela interface agora também provisiona os cadastros oficiais.
CREATE OR REPLACE FUNCTION public.atualizar_planejamento_projeto_v1(
  p_projeto_id uuid,
  p_ativo_calculo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_nome text;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para alterar o planejamento da Produção';
  END IF;

  UPDATE public.producao_planejamento_projetos
  SET ativo_calculo=p_ativo_calculo,
      updated_at=now()
  WHERE id=p_projeto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto de planejamento não encontrado';
  END IF;

  -- Desmarcar nunca apaga, desativa ou reescreve Projeto/Etapa/OP existente.
  IF p_ativo_calculo THEN
    SELECT COALESCE(nome,email,'Usuário')
      INTO v_nome
    FROM public.profiles
    WHERE user_id=v_user
    LIMIT 1;

    PERFORM app_private.provisionar_projeto_planejamento_v1(
      p_projeto_id,
      v_user,
      COALESCE(v_nome,'Usuário')
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_planejamento_projeto_v1(uuid,boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atualizar_planejamento_projeto_v1(uuid,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.atualizar_planejamento_projeto_v1(uuid,boolean) TO authenticated;

-- Cadastro genérico de nova cidade/projeto de planejamento.
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

-- Cadastro genérico de nova peça/demanda.
CREATE OR REPLACE FUNCTION public.criar_peca_planejamento_v1(
  p_nome text,
  p_planejamento_projeto_id uuid DEFAULT NULL,
  p_quantidade numeric DEFAULT 0,
  p_codigo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_nome text := NULLIF(BTRIM(p_nome),'');
  v_item public.producao_planejamento_itens%ROWTYPE;
  v_plan public.producao_planejamento_projetos%ROWTYPE;
  v_linha integer;
  v_demandas jsonb := '{}'::jsonb;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar peça no Planejamento';
  END IF;
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da peça';
  END IF;
  IF COALESCE(p_quantidade,0)<0 THEN
    RAISE EXCEPTION 'Quantidade não pode ser negativa';
  END IF;

  IF p_planejamento_projeto_id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM public.producao_planejamento_projetos
    WHERE id=p_planejamento_projeto_id;
    IF v_plan.id IS NULL THEN
      RAISE EXCEPTION 'Cidade/projeto de planejamento não encontrado';
    END IF;
  END IF;

  SELECT * INTO v_item
  FROM public.producao_planejamento_itens
  WHERE ativo=TRUE
    AND public.normalizar_nome_peca_v1(nome)=public.normalizar_nome_peca_v1(v_nome)
  ORDER BY created_at
  LIMIT 1;

  IF v_item.id IS NULL THEN
    SELECT COALESCE(MAX(fonte_linha),0)+1 INTO v_linha
    FROM public.producao_planejamento_itens
    WHERE fonte='SISTEMA';

    IF v_plan.id IS NOT NULL AND COALESCE(p_quantidade,0)>0 THEN
      v_demandas := jsonb_build_object(v_plan.chave,p_quantidade);
    END IF;

    INSERT INTO public.producao_planejamento_itens(
      fonte,fonte_linha,nome,codigo_producao,qtd_estoque_referencia,
      status_planilha,demandas,observacoes,ativo
    ) VALUES (
      'SISTEMA',v_linha,v_nome,NULLIF(UPPER(BTRIM(p_codigo)),''),
      0,'Ativo',v_demandas,NULL,TRUE
    )
    RETURNING * INTO v_item;
  ELSIF v_plan.id IS NOT NULL THEN
    UPDATE public.producao_planejamento_itens
    SET demandas=jsonb_set(
          demandas,
          ARRAY[v_plan.chave],
          to_jsonb(COALESCE(p_quantidade,0)),
          TRUE
        ),
        updated_at=now()
    WHERE id=v_item.id
    RETURNING * INTO v_item;
  END IF;

  IF v_plan.id IS NOT NULL
     AND v_plan.ativo_calculo=TRUE
     AND COALESCE(p_quantidade,0)>0 THEN
    PERFORM app_private.provisionar_projeto_planejamento_v1(
      v_plan.id,
      v_user,
      'Planejamento'
    );
  END IF;

  RETURN jsonb_build_object(
    'id',v_item.id,
    'codigo',v_item.codigo_producao,
    'nome',v_item.nome
  );
END;
$$;

REVOKE ALL ON FUNCTION public.criar_peca_planejamento_v1(text,uuid,numeric,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.criar_peca_planejamento_v1(text,uuid,numeric,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.criar_peca_planejamento_v1(text,uuid,numeric,text) TO authenticated;

-- Vínculos de cidades solicitados. Permanecem fora do cálculo até o usuário selecionar.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.producao_planejamento_projetos
    WHERE chave IN ('pq_do_japao_mga','tres_lagoas','florianopolis')
  LOOP
    PERFORM app_private.garantir_grupo_planejamento_v1(r.id);
  END LOOP;
END;
$$;

-- Provisiona apenas cidades que JÁ estavam ativas. É aditivo e não cria Etapa/OP.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.producao_planejamento_projetos
    WHERE ativo_calculo=TRUE
  LOOP
    PERFORM app_private.provisionar_projeto_planejamento_v1(
      r.id,
      NULL,
      'Planejamento automático'
    );
  END LOOP;
END;
$$;

COMMIT;
