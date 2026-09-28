BEGIN;

CREATE SCHEMA IF NOT EXISTS backup_correcao_referencias_20260928;

CREATE TABLE IF NOT EXISTS backup_correcao_referencias_20260928.producao_planejamento_projeto_pecas
AS TABLE public.producao_planejamento_projeto_pecas WITH DATA;
CREATE TABLE IF NOT EXISTS backup_correcao_referencias_20260928.producao_projetos
AS TABLE public.producao_projetos WITH DATA;
CREATE TABLE IF NOT EXISTS backup_correcao_referencias_20260928.locais_utilizacao
AS TABLE public.locais_utilizacao WITH DATA;
CREATE TABLE IF NOT EXISTS backup_correcao_referencias_20260928.producao_processos
AS TABLE public.producao_processos WITH DATA;

CREATE TABLE IF NOT EXISTS backup_correcao_referencias_20260928.metadados (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
  criado_em timestamptz NOT NULL DEFAULT now(),
  motivo text NOT NULL
);
INSERT INTO backup_correcao_referencias_20260928.metadados(id,motivo)
VALUES (
  1,
  'Backup antes da correção de referências BPE/E2D/E3D/JMB e criação obrigatória das Etapas 1, 2 e 3'
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION app_private.garantir_etapas_padrao_projeto_v1(
  p_projeto_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_total integer;
  v_i integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.producao_projetos WHERE id=p_projeto_id
  ) THEN
    RAISE EXCEPTION 'Projeto de Produção não encontrado';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.producao_processos
  WHERE projeto_id=p_projeto_id
    AND status <> 'cancelado';

  -- Projeto existente com Etapas próprias não é reescrito.
  IF v_total > 0 THEN
    RETURN 0;
  END IF;

  FOR v_i IN 1..3 LOOP
    INSERT INTO public.producao_processos(
      codigo,
      projeto_id,
      nome,
      status,
      prioridade,
      sequencia,
      created_at,
      updated_at
    )
    VALUES (
      public.proximo_codigo_etapa_producao_definitivo(),
      p_projeto_id,
      'Etapa ' || v_i::text,
      'planejado',
      'normal',
      900 + v_i,
      now(),
      now()
    );
  END LOOP;

  RETURN 3;
END;
$$;

REVOKE ALL ON FUNCTION app_private.garantir_etapas_padrao_projeto_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.garantir_etapas_padrao_projeto_v1(uuid) FROM anon;
REVOKE ALL ON FUNCTION app_private.garantir_etapas_padrao_projeto_v1(uuid) FROM authenticated;

CREATE TABLE IF NOT EXISTS public.producao_planejamento_referencias_pendentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_projeto_id uuid NOT NULL
    REFERENCES public.producao_planejamento_projetos(id) ON DELETE CASCADE,
  planejamento_item_id uuid NOT NULL
    REFERENCES public.producao_planejamento_itens(id) ON DELETE CASCADE,
  project_group_id uuid NOT NULL
    REFERENCES public.project_groups(id) ON DELETE RESTRICT,
  quantidade_planejada numeric NOT NULL DEFAULT 0 CHECK (quantidade_planejada >= 0),
  motivo text NOT NULL DEFAULT 'referencia_nao_confirmada',
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','resolvida','ignorada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planejamento_projeto_id, planejamento_item_id)
);

ALTER TABLE public.producao_planejamento_referencias_pendentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_planejamento_referencias_pendentes_leitura
ON public.producao_planejamento_referencias_pendentes;
CREATE POLICY producao_planejamento_referencias_pendentes_leitura
ON public.producao_planejamento_referencias_pendentes
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

DO $$
DECLARE
  v_bpe_local uuid;
  v_bpe_projeto uuid;
  v_e2d_local uuid;
  v_e2d_projeto uuid;
  v_e3d_local uuid;
  v_e3d_projeto uuid;
  v_jmb_local uuid;
  v_jmb_projeto uuid;
  v_rolandia_group uuid;
BEGIN
  SELECT l.id,p.id
    INTO v_bpe_local,v_bpe_projeto
  FROM public.locais_utilizacao l
  JOIN public.producao_projetos p ON p.local_utilizacao_id=l.id
  WHERE BTRIM(l.nome)='BPE - Bolas Penduradas'
  ORDER BY l.created_at
  LIMIT 1;

  IF v_bpe_projeto IS NULL THEN
    RAISE EXCEPTION 'Referência BPE - Bolas Penduradas não encontrada';
  END IF;

  SELECT l.id,p.id
    INTO v_e2d_local,v_e2d_projeto
  FROM public.locais_utilizacao l
  JOIN public.producao_projetos p ON p.local_utilizacao_id=l.id
  WHERE BTRIM(l.nome)='E2D - ESTRELA 5 PONTAS 2M'
  ORDER BY l.created_at
  LIMIT 1;

  IF v_e2d_projeto IS NULL THEN
    RAISE EXCEPTION 'Referência E2D - ESTRELA 5 PONTAS 2M não encontrada';
  END IF;

  SELECT l.id,p.id
    INTO v_e3d_local,v_e3d_projeto
  FROM public.locais_utilizacao l
  JOIN public.producao_projetos p ON p.local_utilizacao_id=l.id
  WHERE BTRIM(l.nome)='E3D - Estrela 3D 5 Pontas 1m'
  ORDER BY l.created_at
  LIMIT 1;

  IF v_e3d_projeto IS NULL THEN
    RAISE EXCEPTION 'Referência E3D - Estrela 3D 5 Pontas 1m não encontrada';
  END IF;

  SELECT id INTO v_jmb_local
  FROM public.locais_utilizacao
  WHERE BTRIM(nome)='JMB - José Maria e Burrinho'
  ORDER BY created_at
  LIMIT 1;

  IF v_jmb_local IS NULL THEN
    RAISE EXCEPTION 'Referência JMB - José Maria e Burrinho não encontrada';
  END IF;

  SELECT project_group_id INTO v_rolandia_group
  FROM public.producao_planejamento_projetos
  WHERE chave='rolandia';

  SELECT id INTO v_jmb_projeto
  FROM public.producao_projetos
  WHERE local_utilizacao_id=v_jmb_local
  LIMIT 1;

  IF v_jmb_projeto IS NULL THEN
    INSERT INTO public.producao_projetos(
      local_utilizacao_id,
      nome,
      ativo,
      status,
      criado_por_nome_snapshot,
      atualizado_por_nome_snapshot
    )
    SELECT
      l.id,
      BTRIM(l.nome),
      TRUE,
      'planejado',
      'Planejamento automático',
      'Planejamento automático'
    FROM public.locais_utilizacao l
    WHERE l.id=v_jmb_local
    RETURNING id INTO v_jmb_projeto;
  END IF;

  PERFORM app_private.garantir_etapas_padrao_projeto_v1(v_jmb_projeto);

  -- Confirmações fornecidas pelo usuário.
  UPDATE public.producao_planejamento_projeto_pecas x
  SET codigo_peca='BPE',
      local_utilizacao_id=v_bpe_local,
      producao_projeto_id=v_bpe_projeto,
      updated_at=now()
  FROM public.producao_planejamento_projetos pp,
       public.producao_planejamento_itens i
  WHERE x.planejamento_projeto_id=pp.id
    AND x.planejamento_item_id=i.id
    AND pp.chave IN ('brusque','rolandia')
    AND i.nome='Bolas penduradas - 80 cm';

  UPDATE public.producao_planejamento_projeto_pecas x
  SET codigo_peca='E2D',
      local_utilizacao_id=v_e2d_local,
      producao_projeto_id=v_e2d_projeto,
      updated_at=now()
  FROM public.producao_planejamento_projetos pp,
       public.producao_planejamento_itens i
  WHERE x.planejamento_projeto_id=pp.id
    AND x.planejamento_item_id=i.id
    AND pp.chave='brusque'
    AND i.nome='Estrela pendurada';

  UPDATE public.producao_planejamento_projeto_pecas x
  SET codigo_peca='E3D',
      local_utilizacao_id=v_e3d_local,
      producao_projeto_id=v_e3d_projeto,
      updated_at=now()
  FROM public.producao_planejamento_projetos pp,
       public.producao_planejamento_itens i
  WHERE x.planejamento_projeto_id=pp.id
    AND x.planejamento_item_id=i.id
    AND pp.chave='rolandia'
    AND i.nome='Estrela pendurada';

  UPDATE public.producao_planejamento_projeto_pecas x
  SET codigo_peca='JMB',
      local_utilizacao_id=v_jmb_local,
      producao_projeto_id=v_jmb_projeto,
      project_group_id=v_rolandia_group,
      updated_at=now()
  FROM public.producao_planejamento_projetos pp,
       public.producao_planejamento_itens i
  WHERE x.planejamento_projeto_id=pp.id
    AND x.planejamento_item_id=i.id
    AND pp.chave='rolandia'
    AND i.nome='Conjunto Maria, José e Burrinho';
END;
$$;

-- Remove somente os projetos criados pela automação equivocada e já reapontados.
-- Qualquer dependência operacional faria a FK impedir a exclusão e abortaria a transação.
DELETE FROM public.producao_projetos
WHERE created_at >= '2026-09-28T14:48:30Z'
  AND nome IN (
    'TEC-24 - Bolas penduradas - 80 cm',
    'TEC-35 - Estrela pendurada',
    'TEC-46 - Conjunto Maria, José e Burrinho'
  );

DELETE FROM public.locais_utilizacao
WHERE created_at >= '2026-09-28T14:48:30Z'
  AND nome IN (
    'TEC-24 - Bolas penduradas - 80 cm',
    'TEC-35 - Estrela pendurada',
    'TEC-46 - Conjunto Maria, José e Burrinho'
  );

-- Todo projeto realmente novo criado pela automação deve nascer com Etapa 1, 2 e 3.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.producao_projetos
    WHERE created_at >= '2026-09-28T14:48:30Z'
      AND ativo=TRUE
  LOOP
    PERFORM app_private.garantir_etapas_padrao_projeto_v1(r.id);
  END LOOP;
END;
$$;

-- Nova regra: dados importados não criam referência produtiva sem confirmação.
-- Peça cadastrada explicitamente dentro do SISTEMA continua podendo criar um novo projeto.
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
  v_codigo text;
  v_criados_locais integer := 0;
  v_reutilizados integer := 0;
  v_criados_projetos integer := 0;
  v_vinculos integer := 0;
  v_pendencias integer := 0;
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
      i.id AS planejamento_item_id,
      i.codigo_producao,
      i.nome,
      i.fonte,
      COALESCE((i.demandas->>v_plan.chave)::numeric,0) AS quantidade
    FROM public.producao_planejamento_itens i
    WHERE i.ativo=TRUE
      AND COALESCE((i.demandas->>v_plan.chave)::numeric,0)>0
    ORDER BY i.fonte_linha,i.id
  LOOP
    v_local_id := NULL;
    v_prod_id := NULL;
    v_local_nome := NULL;
    v_codigo := NULL;

    SELECT
      x.local_utilizacao_id,
      x.producao_projeto_id,
      x.codigo_peca,
      l.nome
    INTO
      v_local_id,
      v_prod_id,
      v_codigo,
      v_local_nome
    FROM public.producao_planejamento_projeto_pecas x
    JOIN public.locais_utilizacao l ON l.id=x.local_utilizacao_id
    WHERE x.planejamento_projeto_id=v_plan.id
      AND x.planejamento_item_id=r.planejamento_item_id
    LIMIT 1;

    IF v_local_id IS NOT NULL AND v_prod_id IS NOT NULL THEN
      UPDATE public.producao_planejamento_projeto_pecas
      SET quantidade_planejada=r.quantidade,
          project_group_id=v_group_id,
          updated_at=now()
      WHERE planejamento_projeto_id=v_plan.id
        AND planejamento_item_id=r.planejamento_item_id;

      UPDATE public.producao_planejamento_referencias_pendentes
      SET status='resolvida',updated_at=now()
      WHERE planejamento_projeto_id=v_plan.id
        AND planejamento_item_id=r.planejamento_item_id
        AND status='pendente';

      v_reutilizados := v_reutilizados+1;
      v_vinculos := v_vinculos+1;
      CONTINUE;
    END IF;

    IF r.fonte IS DISTINCT FROM 'SISTEMA' THEN
      INSERT INTO public.producao_planejamento_referencias_pendentes(
        planejamento_projeto_id,
        planejamento_item_id,
        project_group_id,
        quantidade_planejada,
        motivo,
        status
      ) VALUES (
        v_plan.id,
        r.planejamento_item_id,
        v_group_id,
        r.quantidade,
        'referencia_nao_confirmada',
        'pendente'
      )
      ON CONFLICT (planejamento_projeto_id,planejamento_item_id)
      DO UPDATE SET
        project_group_id=EXCLUDED.project_group_id,
        quantidade_planejada=EXCLUDED.quantidade_planejada,
        motivo='referencia_nao_confirmada',
        status='pendente',
        updated_at=now();

      v_pendencias := v_pendencias+1;
      CONTINUE;
    END IF;

    v_codigo := r.codigo_producao;
    v_local_nome := v_codigo || ' - ' || r.nome;

    SELECT l.id,p.id,l.nome
      INTO v_local_id,v_prod_id,v_local_nome
    FROM public.locais_utilizacao l
    LEFT JOIN public.producao_projetos p ON p.local_utilizacao_id=l.id
    WHERE l.group_id=v_group_id
      AND l.ativo=TRUE
      AND (
        BTRIM(l.nome)=v_local_nome
        OR UPPER(BTRIM(split_part(l.nome,'-',1)))=UPPER(BTRIM(v_codigo))
      )
    ORDER BY l.created_at
    LIMIT 1;

    IF v_local_id IS NULL THEN
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
        ativo,
        status,
        criado_por_id,
        criado_por_nome_snapshot,
        atualizado_por_id,
        atualizado_por_nome_snapshot
      ) VALUES (
        v_local_id,
        v_local_nome,
        TRUE,
        'planejado',
        p_usuario_id,
        p_usuario_nome,
        p_usuario_id,
        p_usuario_nome
      )
      RETURNING id INTO v_prod_id;

      PERFORM app_private.garantir_etapas_padrao_projeto_v1(v_prod_id);
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
      v_codigo,
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
    'referenciasReutilizadas',v_reutilizados,
    'projetosCriados',v_criados_projetos,
    'pecasVinculadas',v_vinculos,
    'pendenciasReferencia',v_pendencias
  );
END;
$$;

REVOKE ALL ON FUNCTION app_private.provisionar_projeto_planejamento_v1(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.provisionar_projeto_planejamento_v1(uuid,uuid,text) FROM anon;
REVOKE ALL ON FUNCTION app_private.provisionar_projeto_planejamento_v1(uuid,uuid,text) FROM authenticated;

COMMIT;
