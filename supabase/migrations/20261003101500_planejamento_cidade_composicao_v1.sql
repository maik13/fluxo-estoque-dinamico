BEGIN;

-- Estratégia operacional da peça. É metadado novo; não altera nomes nem histórico.
ALTER TABLE public.producao_planejamento_itens
  ADD COLUMN IF NOT EXISTS estrategia_atendimento text;

UPDATE public.producao_planejamento_itens
SET estrategia_atendimento = CASE
  WHEN NULLIF(BTRIM(acervo_codigo_ref),'') IS NOT NULL THEN 'acervo'
  ELSE 'producao_nova'
END
WHERE estrategia_atendimento IS NULL;

ALTER TABLE public.producao_planejamento_itens
  ALTER COLUMN estrategia_atendimento SET DEFAULT 'producao_nova',
  ALTER COLUMN estrategia_atendimento SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='producao_planejamento_itens_estrategia_check'
  ) THEN
    ALTER TABLE public.producao_planejamento_itens
      ADD CONSTRAINT producao_planejamento_itens_estrategia_check
      CHECK (estrategia_atendimento IN ('acervo','transformacao','composicao','producao_nova'));
  END IF;
END $$;

-- Receita/BOM da peça de planejamento. Componentes vêm do cadastro oficial de items.
CREATE TABLE IF NOT EXISTS public.producao_planejamento_composicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_item_id uuid NOT NULL
    REFERENCES public.producao_planejamento_itens(id) ON DELETE RESTRICT,
  item_origem_id uuid NOT NULL
    REFERENCES public.items(id) ON DELETE RESTRICT,
  quantidade_por_unidade numeric NOT NULL CHECK (quantidade_por_unidade > 0),
  tipo_relacao text NOT NULL DEFAULT 'componente'
    CHECK (tipo_relacao IN ('origem_transformacao','componente')),
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  criado_por_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (planejamento_item_id,item_origem_id)
);

CREATE INDEX IF NOT EXISTS producao_planejamento_composicoes_item_idx
  ON public.producao_planejamento_composicoes(planejamento_item_id);
CREATE INDEX IF NOT EXISTS producao_planejamento_composicoes_origem_idx
  ON public.producao_planejamento_composicoes(item_origem_id);

ALTER TABLE public.producao_planejamento_composicoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_planejamento_composicoes_leitura
  ON public.producao_planejamento_composicoes;
CREATE POLICY producao_planejamento_composicoes_leitura
ON public.producao_planejamento_composicoes
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

-- Define quantidade de uma peça dentro de uma cidade.
CREATE OR REPLACE FUNCTION public.salvar_demanda_planejamento_cidade_v1(
  p_planejamento_projeto_id uuid,
  p_planejamento_item_id uuid,
  p_quantidade numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_plan public.producao_planejamento_projetos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para parametrizar peças por cidade';
  END IF;
  IF COALESCE(p_quantidade,0) < 0 THEN
    RAISE EXCEPTION 'Quantidade não pode ser negativa';
  END IF;

  SELECT * INTO v_plan
  FROM public.producao_planejamento_projetos
  WHERE id=p_planejamento_projeto_id;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'Cidade/projeto não encontrado';
  END IF;

  UPDATE public.producao_planejamento_itens
  SET demandas = jsonb_set(
        COALESCE(demandas,'{}'::jsonb),
        ARRAY[v_plan.chave],
        to_jsonb(COALESCE(p_quantidade,0)),
        true
      ),
      updated_at=now()
  WHERE id=p_planejamento_item_id
    AND ativo=true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Peça de planejamento não encontrada';
  END IF;

  -- O trigger existente sincroniza automaticamente todas as cidades ativas
  -- com Projetos. Não cria OP manual nem necessidade intermediária.
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_demanda_planejamento_cidade_v1(uuid,uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_demanda_planejamento_cidade_v1(uuid,uuid,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_estrategia_planejamento_item_v1(
  p_planejamento_item_id uuid,
  p_estrategia text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para parametrizar composição';
  END IF;
  IF p_estrategia NOT IN ('acervo','transformacao','composicao','producao_nova') THEN
    RAISE EXCEPTION 'Estratégia inválida';
  END IF;

  UPDATE public.producao_planejamento_itens
  SET estrategia_atendimento=p_estrategia,updated_at=now()
  WHERE id=p_planejamento_item_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Peça não encontrada'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_estrategia_planejamento_item_v1(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_estrategia_planejamento_item_v1(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.buscar_itens_composicao_planejamento_v1(
  p_busca text DEFAULT NULL,
  p_limite integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  codigo_barras bigint,
  nome text,
  catalogo_ano smallint,
  catalogo_nome_original text,
  especificacoes_dimensoes text,
  unidade text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT
    i.id,
    i.codigo_barras,
    i.nome,
    i.catalogo_ano,
    i.catalogo_nome_original,
    i.especificacoes_dimensoes,
    i.unidade
  FROM public.items i
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND i.ativo IS DISTINCT FROM false
    AND (
      NULLIF(BTRIM(COALESCE(p_busca,'')),'') IS NULL
      OR i.nome ILIKE '%' || BTRIM(p_busca) || '%'
      OR COALESCE(i.catalogo_nome_original,'') ILIKE '%' || BTRIM(p_busca) || '%'
      OR i.codigo_barras::text ILIKE '%' || BTRIM(p_busca) || '%'
    )
  ORDER BY
    CASE WHEN i.nome ILIKE BTRIM(COALESCE(p_busca,'')) || '%' THEN 0 ELSE 1 END,
    i.nome
  LIMIT LEAST(GREATEST(COALESCE(p_limite,30),1),100);
$$;

REVOKE ALL ON FUNCTION public.buscar_itens_composicao_planejamento_v1(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buscar_itens_composicao_planejamento_v1(text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_composicao_planejamento_v1(
  p_planejamento_item_id uuid
)
RETURNS TABLE (
  id uuid,
  item_origem_id uuid,
  codigo_barras bigint,
  nome text,
  catalogo_ano smallint,
  especificacoes_dimensoes text,
  quantidade_por_unidade numeric,
  tipo_relacao text,
  observacoes text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT
    c.id,
    c.item_origem_id,
    i.codigo_barras,
    i.nome,
    i.catalogo_ano,
    i.especificacoes_dimensoes,
    c.quantidade_por_unidade,
    c.tipo_relacao,
    c.observacoes
  FROM public.producao_planejamento_composicoes c
  JOIN public.items i ON i.id=c.item_origem_id
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND c.planejamento_item_id=p_planejamento_item_id
    AND c.ativo=true
  ORDER BY i.nome,i.codigo_barras;
$$;

REVOKE ALL ON FUNCTION public.listar_composicao_planejamento_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_composicao_planejamento_v1(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_componente_planejamento_v1(
  p_planejamento_item_id uuid,
  p_item_origem_id uuid,
  p_quantidade_por_unidade numeric,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_id uuid;
  v_estrategia text;
  v_tipo text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para parametrizar composição';
  END IF;
  IF COALESCE(p_quantidade_por_unidade,0) <= 0 THEN
    RAISE EXCEPTION 'Quantidade por unidade deve ser maior que zero';
  END IF;

  SELECT estrategia_atendimento INTO v_estrategia
  FROM public.producao_planejamento_itens
  WHERE id=p_planejamento_item_id AND ativo=true;

  IF v_estrategia IS NULL THEN RAISE EXCEPTION 'Peça não encontrada'; END IF;

  v_tipo := CASE WHEN v_estrategia='transformacao'
                 THEN 'origem_transformacao'
                 ELSE 'componente' END;

  INSERT INTO public.producao_planejamento_composicoes(
    planejamento_item_id,item_origem_id,quantidade_por_unidade,
    tipo_relacao,observacoes,ativo,criado_por_id
  ) VALUES (
    p_planejamento_item_id,p_item_origem_id,p_quantidade_por_unidade,
    v_tipo,NULLIF(BTRIM(p_observacoes),''),true,auth.uid()
  )
  ON CONFLICT (planejamento_item_id,item_origem_id)
  DO UPDATE SET
    quantidade_por_unidade=EXCLUDED.quantidade_por_unidade,
    tipo_relacao=EXCLUDED.tipo_relacao,
    observacoes=EXCLUDED.observacoes,
    ativo=true,
    updated_at=now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_componente_planejamento_v1(uuid,uuid,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_componente_planejamento_v1(uuid,uuid,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remover_componente_planejamento_v1(
  p_composicao_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para parametrizar composição';
  END IF;

  UPDATE public.producao_planejamento_composicoes
  SET ativo=false,updated_at=now()
  WHERE id=p_composicao_id AND ativo=true;

  IF NOT FOUND THEN RAISE EXCEPTION 'Componente não encontrado'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.remover_componente_planejamento_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remover_componente_planejamento_v1(uuid) TO authenticated;

-- Expõe a estratégia e a referência técnica na mesma RPC usada pela tela.
CREATE OR REPLACE FUNCTION public.listar_planejamento_producao_v2()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('visualizar')
      THEN jsonb_build_object('projetos','[]'::jsonb,'itens','[]'::jsonb,'fonte',NULL)
    ELSE jsonb_build_object(
      'projetos',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id,
          'chave', p.chave,
          'nome', p.nome,
          'ativoCalculo', p.ativo_calculo,
          'ordem', p.ordem,
          'projectGroupId', p.project_group_id
        ) ORDER BY p.ordem, p.nome)
        FROM public.producao_planejamento_projetos p
      ), '[]'::jsonb),
      'itens',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id,
          'fonteLinha', i.fonte_linha,
          'nome', i.nome,
          'codigoProducao', i.codigo_producao,
          'acervoCodigo', i.acervo_codigo_ref,
          'qtdEstoqueReferencia', i.qtd_estoque_referencia,
          'qtdEstoqueAtual', COALESCE(a.quantidade_estoque, 0),
          'qtdReservada', COALESCE(r.quantidade_reservada, 0),
          'qtdDisponivelAtual', GREATEST(COALESCE(a.quantidade_estoque, 0) - COALESCE(r.quantidade_reservada, 0), 0),
          'statusPlanilha', i.status_planilha,
          'demandas', i.demandas,
          'acervoId', a.id,
          'acervoNome', a.nome,
          'acervoCategoria', a.categoria,
          'acervoEspecificacoes', a.especificacoes,
          'estrategiaAtendimento', i.estrategia_atendimento,
          'componentesConfigurados', (
            SELECT COUNT(*) FROM public.producao_planejamento_composicoes c
            WHERE c.planejamento_item_id=i.id AND c.ativo=true
          )
        ) ORDER BY i.fonte_linha)
        FROM public.producao_planejamento_itens i
        LEFT JOIN public.producao_acervo_cenografico a
          ON a.codigo = i.acervo_codigo_ref
         AND a.ativo = TRUE
        LEFT JOIN (
          SELECT acervo_id, SUM(quantidade) AS quantidade_reservada
          FROM public.producao_acervo_reservas
          WHERE status = 'ativa'
          GROUP BY acervo_id
        ) r ON r.acervo_id = a.id
        WHERE i.ativo = TRUE
      ), '[]'::jsonb),
      'fonte',
      (
        SELECT jsonb_build_object(
          'chave', f.chave,
          'nome', f.nome,
          'url', f.url,
          'modo', f.modo,
          'status', f.status,
          'ultimaSincronizacao', f.ultima_sincronizacao,
          'ultimoResultado', f.ultimo_resultado
        )
        FROM public.producao_planejamento_fontes f
        WHERE f.chave = 'brusque_2026'
        LIMIT 1
      )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.listar_planejamento_producao_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_planejamento_producao_v2() TO authenticated;

COMMIT;
NOTIFY pgrst,'reload schema';