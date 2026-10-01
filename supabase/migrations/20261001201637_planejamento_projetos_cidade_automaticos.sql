CREATE OR REPLACE FUNCTION app_private.provisionar_projeto_planejamento_v1(p_planejamento_projeto_id uuid, p_usuario_id uuid DEFAULT NULL::uuid, p_usuario_nome text DEFAULT 'Planejamento automático'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  WHERE id=p_planejamento_projeto_id FOR UPDATE;

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
      -- A exclusão explícita continua prevalecendo; não recriar projeto excluído.
      IF EXISTS (SELECT 1 FROM public.producao_projetos WHERE id=v_prod_id AND excluido_em IS NOT NULL) THEN
        CONTINUE;
      END IF;
      UPDATE public.locais_utilizacao
      SET nome=r.codigo_producao || ' - ' || r.nome || ' · ' || v_plan.nome
      WHERE id=v_local_id AND nome IS DISTINCT FROM r.codigo_producao || ' - ' || r.nome || ' · ' || v_plan.nome;
      UPDATE public.producao_projetos SET cidade=v_plan.nome
      WHERE id=v_prod_id AND cidade IS DISTINCT FROM v_plan.nome;
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

    v_codigo := r.codigo_producao;
    v_local_nome := v_codigo || ' - ' || r.nome || ' · ' || v_plan.nome;

    SELECT l.id,p.id,l.nome
      INTO v_local_id,v_prod_id,v_local_nome
    FROM public.locais_utilizacao l
    LEFT JOIN public.producao_projetos p ON p.local_utilizacao_id=l.id
    WHERE l.group_id=v_group_id
      AND l.ativo=TRUE
      AND (
        BTRIM(l.nome)=v_local_nome
        OR l.nome LIKE v_codigo || ' - %'
      )
    ORDER BY l.created_at
    LIMIT 1;

    IF v_local_id IS NULL THEN
      v_local_nome := v_codigo || ' - ' || r.nome || ' · ' || v_plan.nome;
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

      PERFORM app_private.garantir_etapas_padrao_projeto_v1(v_prod_id);
      v_criados_projetos := v_criados_projetos+1;
    END IF;

    IF EXISTS (SELECT 1 FROM public.producao_projetos WHERE id=v_prod_id AND excluido_em IS NOT NULL) THEN
      CONTINUE;
    END IF;
    UPDATE public.locais_utilizacao SET nome=v_codigo || ' - ' || r.nome || ' · ' || v_plan.nome
    WHERE id=v_local_id AND nome IS DISTINCT FROM v_codigo || ' - ' || r.nome || ' · ' || v_plan.nome;
    UPDATE public.producao_projetos SET cidade=v_plan.nome
    WHERE id=v_prod_id AND cidade IS DISTINCT FROM v_plan.nome;
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

    UPDATE public.producao_planejamento_referencias_pendentes
    SET status='resolvida',updated_at=now()
    WHERE planejamento_projeto_id=v_plan.id AND planejamento_item_id=r.planejamento_item_id AND status='pendente';
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
$function$;
REVOKE ALL ON FUNCTION app_private.provisionar_projeto_planejamento_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION app_private.sincronizar_demanda_planejamento_projetos_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.producao_planejamento_projetos WHERE ativo_calculo ORDER BY id LOOP
    PERFORM app_private.provisionar_projeto_planejamento_v1(r.id,auth.uid(),'Planejamento automático');
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.sincronizar_demanda_planejamento_projetos_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sincronizar_demanda_planejamento_projetos_v1
AFTER INSERT OR UPDATE OF demandas,ativo,nome,codigo_producao ON public.producao_planejamento_itens
FOR EACH ROW EXECUTE FUNCTION app_private.sincronizar_demanda_planejamento_projetos_v1();

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.producao_planejamento_projetos WHERE ativo_calculo ORDER BY id LOOP
    PERFORM app_private.provisionar_projeto_planejamento_v1(r.id,NULL,'Correção de integração Planejamento');
  END LOOP;
END; $$;
