BEGIN;

CREATE TABLE IF NOT EXISTS public.producao_planejamento_divergencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_item_id uuid NOT NULL REFERENCES public.producao_planejamento_itens(id) ON DELETE CASCADE,
  necessidade_fabricacao_id uuid REFERENCES public.producao_necessidades_fabricacao(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('necessidade_alterada','planejamento_op','acervo_reserva')),
  valor_anterior numeric,
  valor_novo numeric,
  diferenca numeric,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','resolvida','ignorada')),
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS producao_planejamento_divergencias_status_idx
  ON public.producao_planejamento_divergencias(status, created_at DESC);

ALTER TABLE public.producao_planejamento_divergencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_planejamento_divergencias_leitura ON public.producao_planejamento_divergencias;
CREATE POLICY producao_planejamento_divergencias_leitura
ON public.producao_planejamento_divergencias
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

CREATE OR REPLACE FUNCTION public.sincronizar_planejamento_payload_v1(
  p_arquivo text,
  p_aba text,
  p_payload jsonb,
  p_origem_usuario text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_item jsonb;
  v_project jsonb;
  v_existing public.producao_planejamento_itens%ROWTYPE;
  v_proj public.producao_planejamento_projetos%ROWTYPE;
  v_old jsonb;
  v_new jsonb;
  v_count integer := 0;
  v_log_count integer := 0;
  v_necessidade_atual numeric;
  v_acervo_id uuid;
  v_estoque numeric;
  v_reservado numeric;
  v_disponivel numeric;
  v_deficit numeric;
  v_open_need public.producao_necessidades_fabricacao%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para sincronizar o Planejamento';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload inválido';
  END IF;

  FOR v_project IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'projetos','[]'::jsonb))
  LOOP
    IF NULLIF(BTRIM(v_project->>'chave'),'') IS NULL THEN CONTINUE; END IF;
    SELECT * INTO v_proj
    FROM public.producao_planejamento_projetos
    WHERE chave=v_project->>'chave'
    LIMIT 1;

    IF v_proj.id IS NULL THEN
      INSERT INTO public.producao_planejamento_sincronizacoes(
        arquivo,aba,identificador,campo,valor_anterior,valor_novo,resultado,erro,origem_usuario
      ) VALUES (
        p_arquivo,p_aba,v_project->>'chave','projeto',NULL,v_project,'ignorado',
        'Projeto não possui matching existente; criação automática bloqueada',p_origem_usuario
      );
      v_log_count := v_log_count+1;
      CONTINUE;
    END IF;

    IF v_project ? 'ativoCalculo' THEN
      v_old := to_jsonb(v_proj.ativo_calculo);
      v_new := to_jsonb((v_project->>'ativoCalculo')::boolean);
      IF v_old IS DISTINCT FROM v_new THEN
        UPDATE public.producao_planejamento_projetos
        SET ativo_calculo=(v_project->>'ativoCalculo')::boolean, updated_at=now()
        WHERE id=v_proj.id;
        INSERT INTO public.producao_planejamento_sincronizacoes(
          arquivo,aba,identificador,campo,valor_anterior,valor_novo,resultado,origem_usuario
        ) VALUES (p_arquivo,p_aba,v_proj.chave,'ativo_calculo',v_old,v_new,'sincronizado',p_origem_usuario);
        v_log_count := v_log_count+1;
      END IF;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'itens','[]'::jsonb))
  LOOP
    IF NULLIF(BTRIM(v_item->>'nome'),'') IS NULL THEN
      INSERT INTO public.producao_planejamento_sincronizacoes(
        arquivo,aba,identificador,campo,valor_anterior,valor_novo,resultado,erro,origem_usuario
      ) VALUES (p_arquivo,p_aba,COALESCE(v_item->>'fonteLinha','?'),'item',NULL,v_item,'ignorado',
                'Linha sem nome significativo',p_origem_usuario);
      v_log_count := v_log_count+1;
      CONTINUE;
    END IF;

    SELECT * INTO v_existing
    FROM public.producao_planejamento_itens
    WHERE fonte=p_arquivo
      AND (
        (v_item ? 'fonteLinha' AND fonte_linha=(v_item->>'fonteLinha')::integer)
        OR lower(nome)=lower(v_item->>'nome')
      )
    ORDER BY CASE WHEN v_item ? 'fonteLinha' AND fonte_linha=(v_item->>'fonteLinha')::integer THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_existing.id IS NULL THEN
      INSERT INTO public.producao_planejamento_sincronizacoes(
        arquivo,aba,identificador,campo,valor_anterior,valor_novo,resultado,erro,origem_usuario
      ) VALUES (p_arquivo,p_aba,v_item->>'nome','item',NULL,v_item,'ignorado',
                'Item não possui matching existente; criação automática bloqueada',p_origem_usuario);
      v_log_count := v_log_count+1;
      CONTINUE;
    END IF;

    IF v_item ? 'demandas' AND jsonb_typeof(v_item->'demandas')='object' THEN
      v_old := v_existing.demandas;
      v_new := v_item->'demandas';
      IF v_old IS DISTINCT FROM v_new THEN
        UPDATE public.producao_planejamento_itens
        SET demandas=v_new,
            observacoes=COALESCE(NULLIF(v_item->>'observacoes',''),observacoes),
            status_planilha=COALESCE(NULLIF(v_item->>'status',''),status_planilha),
            updated_at=now()
        WHERE id=v_existing.id;

        INSERT INTO public.producao_planejamento_sincronizacoes(
          arquivo,aba,identificador,campo,valor_anterior,valor_novo,resultado,origem_usuario
        ) VALUES (p_arquivo,p_aba,v_existing.nome,'demandas',v_old,v_new,'sincronizado',p_origem_usuario);
        v_log_count := v_log_count+1;
        v_count := v_count+1;

        SELECT COALESCE(SUM(COALESCE((v_new->>p.chave)::numeric,0)),0)
          INTO v_necessidade_atual
        FROM public.producao_planejamento_projetos p
        WHERE p.ativo_calculo=true;

        v_acervo_id := NULL;
        v_estoque := 0;
        v_reservado := 0;
        IF v_existing.acervo_codigo_ref IS NOT NULL THEN
          SELECT id,quantidade_estoque INTO v_acervo_id,v_estoque
          FROM public.producao_acervo_cenografico
          WHERE codigo=v_existing.acervo_codigo_ref AND ativo=true
          LIMIT 1;
        END IF;
        IF v_acervo_id IS NOT NULL THEN
          SELECT COALESCE(SUM(quantidade),0) INTO v_reservado
          FROM public.producao_acervo_reservas
          WHERE acervo_id=v_acervo_id AND status='ativa';
        END IF;
        v_disponivel := GREATEST(COALESCE(v_estoque,0)-COALESCE(v_reservado,0),0);
        v_deficit := GREATEST(v_necessidade_atual-v_disponivel,0);

        SELECT * INTO v_open_need
        FROM public.producao_necessidades_fabricacao
        WHERE planejamento_item_id=v_existing.id
          AND status='a_programar'
        LIMIT 1;

        IF v_open_need.id IS NOT NULL AND v_open_need.quantidade IS DISTINCT FROM v_deficit THEN
          INSERT INTO public.producao_planejamento_divergencias(
            planejamento_item_id,necessidade_fabricacao_id,tipo,
            valor_anterior,valor_novo,diferenca,detalhes
          ) VALUES (
            v_existing.id,v_open_need.id,'necessidade_alterada',
            v_open_need.quantidade,v_deficit,v_deficit-v_open_need.quantidade,
            jsonb_build_object(
              'mensagem', CASE
                WHEN v_deficit-v_open_need.quantidade >= 0
                  THEN 'Necessidade alterada: +'||(v_deficit-v_open_need.quantidade)::text
                ELSE 'Necessidade alterada: '||(v_deficit-v_open_need.quantidade)::text
              END,
              'arquivo',p_arquivo,'aba',p_aba
            )
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.producao_planejamento_fontes
  SET ultima_sincronizacao=now(),
      status='sincronizado',
      ultimo_resultado=jsonb_build_object(
        'itensAtualizados',v_count,
        'logs',v_log_count,
        'arquivo',p_arquivo,
        'aba',p_aba
      ),
      updated_at=now()
  WHERE nome=p_arquivo OR chave='brusque_2026';

  RETURN jsonb_build_object(
    'itensAtualizados',v_count,
    'logs',v_log_count,
    'status','ok'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_divergencias_planejamento_v1()
RETURNS TABLE(
  id uuid,
  planejamento_item_id uuid,
  item_nome text,
  tipo text,
  valor_anterior numeric,
  valor_novo numeric,
  diferenca numeric,
  status text,
  detalhes jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT d.id,d.planejamento_item_id,i.nome,d.tipo,
         d.valor_anterior,d.valor_novo,d.diferenca,d.status,d.detalhes,d.created_at
  FROM public.producao_planejamento_divergencias d
  JOIN public.producao_planejamento_itens i ON i.id=d.planejamento_item_id
  WHERE public.usuario_tem_permissao_producao('visualizar')
  ORDER BY CASE d.status WHEN 'pendente' THEN 0 ELSE 1 END,d.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.resolver_divergencia_planejamento_v1(
  p_divergencia_id uuid,
  p_acao text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v public.producao_planejamento_divergencias%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para resolver divergências';
  END IF;
  IF p_acao NOT IN ('revisada','ignorada') THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;
  SELECT * INTO v FROM public.producao_planejamento_divergencias WHERE id=p_divergencia_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Divergência não encontrada'; END IF;
  UPDATE public.producao_planejamento_divergencias
  SET status=CASE WHEN p_acao='ignorada' THEN 'ignorada' ELSE 'resolvida' END,
      resolved_at=now()
  WHERE id=v.id;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_planejamento_payload_v1(text,text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_divergencias_planejamento_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolver_divergencia_planejamento_v1(uuid,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sincronizar_planejamento_payload_v1(text,text,jsonb,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.listar_divergencias_planejamento_v1() FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolver_divergencia_planejamento_v1(uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_planejamento_payload_v1(text,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_divergencias_planejamento_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_divergencia_planejamento_v1(uuid,text) TO authenticated;

COMMIT;
