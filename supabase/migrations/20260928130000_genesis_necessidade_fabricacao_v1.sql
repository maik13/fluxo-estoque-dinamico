BEGIN;

CREATE TABLE IF NOT EXISTS public.producao_necessidades_fabricacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_item_id uuid NOT NULL REFERENCES public.producao_planejamento_itens(id) ON DELETE RESTRICT,
  item_nome_snapshot text NOT NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  unidade text NOT NULL DEFAULT 'un',
  status text NOT NULL DEFAULT 'a_programar'
    CHECK (status IN ('a_programar','programada','atendida','cancelada')),
  projetos_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculo_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  processo_id uuid REFERENCES public.producao_processos(id) ON DELETE SET NULL,
  ordem_producao_id uuid REFERENCES public.producao_ordens_producao(id) ON DELETE SET NULL,
  observacoes text,
  criado_por_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS producao_necessidades_item_aberta_unique
  ON public.producao_necessidades_fabricacao(planejamento_item_id)
  WHERE status = 'a_programar';

CREATE INDEX IF NOT EXISTS producao_necessidades_status_idx
  ON public.producao_necessidades_fabricacao(status, created_at DESC);

ALTER TABLE public.producao_necessidades_fabricacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_necessidades_leitura ON public.producao_necessidades_fabricacao;
CREATE POLICY producao_necessidades_leitura
ON public.producao_necessidades_fabricacao
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

CREATE OR REPLACE FUNCTION public.enviar_necessidade_fabricacao_v1(
  p_planejamento_item_id uuid,
  p_quantidade numeric DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item public.producao_planejamento_itens%ROWTYPE;
  v_acervo_id uuid;
  v_estoque numeric := 0;
  v_reservado numeric := 0;
  v_disponivel numeric := 0;
  v_necessidade numeric := 0;
  v_deficit numeric := 0;
  v_quantidade numeric := 0;
  v_projetos jsonb := '[]'::jsonb;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para enviar necessidade à Produção';
  END IF;

  SELECT * INTO v_item
  FROM public.producao_planejamento_itens
  WHERE id = p_planejamento_item_id AND ativo = true;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Item de planejamento não encontrado';
  END IF;

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'chave', p.chave,
      'nome', p.nome,
      'projectGroupId', p.project_group_id,
      'necessidade', COALESCE((v_item.demandas ->> p.chave)::numeric, 0)
    ) ORDER BY p.ordem), '[]'::jsonb),
    COALESCE(SUM(COALESCE((v_item.demandas ->> p.chave)::numeric, 0)), 0)
  INTO v_projetos, v_necessidade
  FROM public.producao_planejamento_projetos p
  WHERE p.ativo_calculo = true;

  IF v_item.acervo_codigo_ref IS NOT NULL THEN
    SELECT id, quantidade_estoque
      INTO v_acervo_id, v_estoque
    FROM public.producao_acervo_cenografico
    WHERE codigo = v_item.acervo_codigo_ref
      AND ativo = true
    LIMIT 1;
  END IF;

  IF v_acervo_id IS NOT NULL THEN
    SELECT COALESCE(SUM(quantidade),0)
      INTO v_reservado
    FROM public.producao_acervo_reservas
    WHERE acervo_id = v_acervo_id
      AND status = 'ativa';
  END IF;

  v_disponivel := GREATEST(COALESCE(v_estoque,0) - COALESCE(v_reservado,0), 0);
  v_deficit := GREATEST(v_necessidade - v_disponivel, 0);
  v_quantidade := COALESCE(p_quantidade, v_deficit);

  IF v_deficit <= 0 THEN
    RAISE EXCEPTION 'Este item não possui déficit de fabricação no cálculo atual';
  END IF;
  IF v_quantidade <= 0 OR v_quantidade > v_deficit THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero e não pode exceder o déficit atual (%)', v_deficit;
  END IF;

  INSERT INTO public.producao_necessidades_fabricacao (
    planejamento_item_id,
    item_nome_snapshot,
    quantidade,
    projetos_snapshot,
    calculo_snapshot,
    observacoes,
    criado_por_id
  ) VALUES (
    v_item.id,
    v_item.nome,
    v_quantidade,
    v_projetos,
    jsonb_build_object(
      'necessidade', v_necessidade,
      'acervoFisico', COALESCE(v_estoque,0),
      'reservado', COALESCE(v_reservado,0),
      'disponivelReal', v_disponivel,
      'deficit', v_deficit,
      'capturadoEm', now()
    ),
    p_observacoes,
    auth.uid()
  )
  ON CONFLICT (planejamento_item_id) WHERE status = 'a_programar'
  DO UPDATE SET
    item_nome_snapshot = EXCLUDED.item_nome_snapshot,
    quantidade = EXCLUDED.quantidade,
    projetos_snapshot = EXCLUDED.projetos_snapshot,
    calculo_snapshot = EXCLUDED.calculo_snapshot,
    observacoes = EXCLUDED.observacoes,
    atualizado_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Corrige nome da coluna em instalações onde a função acima for recompilada.
-- A tabela usa updated_at.
CREATE OR REPLACE FUNCTION public.enviar_necessidade_fabricacao_v1(
  p_planejamento_item_id uuid,
  p_quantidade numeric DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item public.producao_planejamento_itens%ROWTYPE;
  v_acervo_id uuid;
  v_estoque numeric := 0;
  v_reservado numeric := 0;
  v_disponivel numeric := 0;
  v_necessidade numeric := 0;
  v_deficit numeric := 0;
  v_quantidade numeric := 0;
  v_projetos jsonb := '[]'::jsonb;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para enviar necessidade à Produção';
  END IF;

  SELECT * INTO v_item
  FROM public.producao_planejamento_itens
  WHERE id = p_planejamento_item_id AND ativo = true;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'Item de planejamento não encontrado'; END IF;

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id, 'chave', p.chave, 'nome', p.nome,
      'projectGroupId', p.project_group_id,
      'necessidade', COALESCE((v_item.demandas ->> p.chave)::numeric, 0)
    ) ORDER BY p.ordem), '[]'::jsonb),
    COALESCE(SUM(COALESCE((v_item.demandas ->> p.chave)::numeric, 0)), 0)
  INTO v_projetos, v_necessidade
  FROM public.producao_planejamento_projetos p
  WHERE p.ativo_calculo = true;

  IF v_item.acervo_codigo_ref IS NOT NULL THEN
    SELECT id, quantidade_estoque INTO v_acervo_id, v_estoque
    FROM public.producao_acervo_cenografico
    WHERE codigo = v_item.acervo_codigo_ref AND ativo = true LIMIT 1;
  END IF;

  IF v_acervo_id IS NOT NULL THEN
    SELECT COALESCE(SUM(quantidade),0) INTO v_reservado
    FROM public.producao_acervo_reservas
    WHERE acervo_id = v_acervo_id AND status = 'ativa';
  END IF;

  v_disponivel := GREATEST(COALESCE(v_estoque,0) - COALESCE(v_reservado,0), 0);
  v_deficit := GREATEST(v_necessidade - v_disponivel, 0);
  v_quantidade := COALESCE(p_quantidade, v_deficit);

  IF v_deficit <= 0 THEN RAISE EXCEPTION 'Este item não possui déficit de fabricação no cálculo atual'; END IF;
  IF v_quantidade <= 0 OR v_quantidade > v_deficit THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero e não pode exceder o déficit atual (%)', v_deficit;
  END IF;

  INSERT INTO public.producao_necessidades_fabricacao (
    planejamento_item_id, item_nome_snapshot, quantidade, projetos_snapshot,
    calculo_snapshot, observacoes, criado_por_id
  ) VALUES (
    v_item.id, v_item.nome, v_quantidade, v_projetos,
    jsonb_build_object(
      'necessidade', v_necessidade,
      'acervoFisico', COALESCE(v_estoque,0),
      'reservado', COALESCE(v_reservado,0),
      'disponivelReal', v_disponivel,
      'deficit', v_deficit,
      'capturadoEm', now()
    ),
    p_observacoes, auth.uid()
  )
  ON CONFLICT (planejamento_item_id) WHERE status = 'a_programar'
  DO UPDATE SET
    item_nome_snapshot = EXCLUDED.item_nome_snapshot,
    quantidade = EXCLUDED.quantidade,
    projetos_snapshot = EXCLUDED.projetos_snapshot,
    calculo_snapshot = EXCLUDED.calculo_snapshot,
    observacoes = EXCLUDED.observacoes,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_necessidades_fabricacao_v1()
RETURNS TABLE (
  id uuid,
  planejamento_item_id uuid,
  item_nome text,
  quantidade numeric,
  status text,
  projetos_snapshot jsonb,
  calculo_snapshot jsonb,
  processo_id uuid,
  processo_nome text,
  ordem_producao_id uuid,
  ordem_numero bigint,
  observacoes text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    n.id, n.planejamento_item_id, n.item_nome_snapshot, n.quantidade, n.status,
    n.projetos_snapshot, n.calculo_snapshot,
    n.processo_id, p.nome, n.ordem_producao_id, o.numero,
    n.observacoes, n.created_at
  FROM public.producao_necessidades_fabricacao n
  LEFT JOIN public.producao_processos p ON p.id=n.processo_id
  LEFT JOIN public.producao_ordens_producao o ON o.id=n.ordem_producao_id
  WHERE public.usuario_tem_permissao_producao('visualizar')
  ORDER BY
    CASE n.status WHEN 'a_programar' THEN 0 WHEN 'programada' THEN 1 WHEN 'atendida' THEN 2 ELSE 3 END,
    n.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_necessidade_fabricacao_v1(p_necessidade_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('projetos') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar necessidade';
  END IF;

  UPDATE public.producao_necessidades_fabricacao
  SET status='cancelada', updated_at=now()
  WHERE id=p_necessidade_id AND status='a_programar';

  IF NOT FOUND THEN RAISE EXCEPTION 'Necessidade a programar não encontrada'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enviar_necessidade_fabricacao_v1(uuid,numeric,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_necessidades_fabricacao_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancelar_necessidade_fabricacao_v1(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enviar_necessidade_fabricacao_v1(uuid,numeric,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.listar_necessidades_fabricacao_v1() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_necessidade_fabricacao_v1(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.enviar_necessidade_fabricacao_v1(uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_necessidades_fabricacao_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_necessidade_fabricacao_v1(uuid) TO authenticated;

COMMIT;
