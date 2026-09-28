BEGIN;

CREATE TABLE IF NOT EXISTS public.producao_tinta_planejada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES public.producao_projetos(id) ON DELETE SET NULL,
  peca text NOT NULL,
  subpeca text,
  material_categoria text NOT NULL,
  demão text,
  quantidade_pecas numeric,
  volume_previsto_ml numeric NOT NULL CHECK (volume_previsto_ml >= 0),
  fonte text NOT NULL,
  fonte_aba text NOT NULL,
  fonte_linha integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS producao_tinta_planejada_fonte_unique
  ON public.producao_tinta_planejada(fonte, fonte_aba, fonte_linha, material_categoria, COALESCE(subpeca,''));

ALTER TABLE public.producao_tinta_planejada ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_tinta_planejada_leitura ON public.producao_tinta_planejada;
CREATE POLICY producao_tinta_planejada_leitura
ON public.producao_tinta_planejada
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

WITH projetos AS (
  SELECT
    (SELECT id FROM public.producao_projetos WHERE nome ILIKE 'E2D - ESTRELA 5 PONTAS 2M%' LIMIT 1) estrela,
    (SELECT id FROM public.producao_projetos WHERE nome ILIKE 'BPE - Bolas Penduradas%' LIMIT 1) bola,
    (SELECT id FROM public.producao_projetos WHERE nome ILIKE 'RFM-CAIXA DE PRESENTE%' LIMIT 1) caixa,
    (SELECT id FROM public.producao_projetos WHERE nome ILIKE 'RFM-CASA NOEL%' LIMIT 1) casa
),
dados(projeto_id,peca,subpeca,material_categoria,quantidade_pecas,volume_previsto_ml,fonte_linha) AS (
  SELECT estrela,'Estrela de 2m',NULL,'Verniz Intumescente',30,1200,5 FROM projetos
  UNION ALL SELECT estrela,'Estrela de 2m',NULL,'Stain',30,1950,5 FROM projetos
  UNION ALL SELECT bola,'Bola (80 cm)',NULL,'Verniz Intumescente',12,480,9 FROM projetos
  UNION ALL SELECT caixa,'Caixa de Presente','Painéis Grandes P1 a P4','Stain',4,800,11 FROM projetos
  UNION ALL SELECT caixa,'Caixa de Presente','Painéis Porta Pp1 a Pp4','Stain',4,800,13 FROM projetos
  UNION ALL SELECT caixa,'Caixa de Presente','Painéis Laterais Ps1 a Ps4','Stain',4,800,15 FROM projetos
  UNION ALL SELECT caixa,'Caixa de Presente','Tampa / Topo P1 + P2','Verniz Intumescente',2,160,17 FROM projetos
  UNION ALL SELECT caixa,'Caixa de Presente','Tampa / Topo P1 + P2','Stain',2,800,17 FROM projetos
  UNION ALL SELECT casa,'Casa Noel',NULL,'Verniz Intumescente',60,2440,20 FROM projetos
  UNION ALL SELECT casa,'Casa Noel',NULL,'Tinta',60,7240,20 FROM projetos
  UNION ALL SELECT casa,'Casa Noel',NULL,'Stain',60,40,20 FROM projetos
)
INSERT INTO public.producao_tinta_planejada(
  projeto_id,peca,subpeca,material_categoria,quantidade_pecas,volume_previsto_ml,
  fonte,fonte_aba,fonte_linha
)
SELECT projeto_id,peca,subpeca,material_categoria,quantidade_pecas,volume_previsto_ml,
       'BRUSQUE - 2026','Controle de Tinta - Brusque',fonte_linha
FROM dados
WHERE projeto_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.listar_tinta_previsto_real_v1()
RETURNS TABLE(
  projeto_id uuid,
  projeto_nome text,
  material_categoria text,
  volume_previsto_ml numeric,
  volume_real_ml numeric,
  desvio_ml numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  WITH previsto AS (
    SELECT projeto_id, material_categoria, SUM(volume_previsto_ml) volume_previsto_ml
    FROM public.producao_tinta_planejada
    WHERE projeto_id IS NOT NULL
    GROUP BY projeto_id, material_categoria
  ),
  real_base AS (
    SELECT
      o.projeto_id,
      CASE
        WHEN lower(trim(c.cor)) LIKE '%stain%' THEN 'Stain'
        WHEN lower(trim(c.cor)) LIKE '%verniz%' OR lower(trim(c.cor)) LIKE '%vernis%' THEN 'Verniz Intumescente'
        WHEN lower(trim(c.cor)) LIKE '%thinner%' OR lower(trim(c.cor)) LIKE '%solvente%' THEN 'Auxiliar'
        ELSE 'Tinta'
      END material_categoria,
      SUM(c.quantidade_ml) volume_real_ml
    FROM public.producao_consumos_tinta c
    JOIN public.producao_ordens_producao o ON o.id=c.ordem_producao_id
    GROUP BY o.projeto_id, 2
  ),
  combinado AS (
    SELECT
      COALESCE(p.projeto_id,r.projeto_id) projeto_id,
      COALESCE(p.material_categoria,r.material_categoria) material_categoria,
      COALESCE(p.volume_previsto_ml,0) volume_previsto_ml,
      COALESCE(r.volume_real_ml,0) volume_real_ml
    FROM previsto p
    FULL JOIN real_base r
      ON r.projeto_id=p.projeto_id
     AND r.material_categoria=p.material_categoria
  )
  SELECT c.projeto_id, pr.nome, c.material_categoria,
         c.volume_previsto_ml, c.volume_real_ml,
         c.volume_real_ml-c.volume_previsto_ml
  FROM combinado c
  JOIN public.producao_projetos pr ON pr.id=c.projeto_id
  WHERE public.usuario_tem_permissao_producao('visualizar')
  ORDER BY pr.nome,c.material_categoria;
$$;

CREATE TABLE IF NOT EXISTS public.producao_led_planejado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES public.producao_projetos(id) ON DELETE SET NULL,
  referencia text NOT NULL,
  peca text NOT NULL,
  quantidade_pecas numeric NOT NULL DEFAULT 0,
  cordoes_por_peca numeric NOT NULL DEFAULT 0,
  total_previsto numeric NOT NULL DEFAULT 0,
  especificacao text,
  detalhamento jsonb NOT NULL DEFAULT '{}'::jsonb,
  fonte text NOT NULL,
  fonte_aba text NOT NULL,
  fonte_linha integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS producao_led_planejado_fonte_unique
  ON public.producao_led_planejado(fonte,fonte_aba,referencia);

ALTER TABLE public.producao_led_planejado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_led_planejado_leitura ON public.producao_led_planejado;
CREATE POLICY producao_led_planejado_leitura
ON public.producao_led_planejado
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

WITH projetos AS (
  SELECT
    (SELECT id FROM public.producao_projetos WHERE nome ILIKE 'E2D - ESTRELA 5 PONTAS 2M%' LIMIT 1) estrela,
    (SELECT id FROM public.producao_projetos WHERE nome ILIKE 'RFM-CAIXA DE PRESENTE%' LIMIT 1) caixa
)
INSERT INTO public.producao_led_planejado(
  projeto_id,referencia,peca,quantidade_pecas,cordoes_por_peca,total_previsto,
  especificacao,detalhamento,fonte,fonte_aba,fonte_linha
)
SELECT estrela,'LED-03','Estrela pendurada (2m)',30,3,90,'BQS / GOLD','{}'::jsonb,
       'BRUSQUE - 2026','Controle de LED - Brusque',9 FROM projetos
WHERE estrela IS NOT NULL
UNION ALL
SELECT caixa,'LED-04','Caixa de Presente (Estrutura Completa - 14 painéis)',14,0,56,'BQS / GOLD',
       jsonb_build_object(
         'painéis grandes',16,
         'painéis laterais porta',12,
         'painéis laterais superiores',16,
         'tampa/topo',12
       ),
       'BRUSQUE - 2026','Controle de LED - Brusque',10 FROM projetos
WHERE caixa IS NOT NULL
UNION ALL
SELECT NULL,'LED-07','Varal LED 50 m com estrelas',1,5,5,NULL,'{}'::jsonb,
       'BRUSQUE - 2026','Controle de LED - Brusque',17
UNION ALL
SELECT NULL,'LED-08','Reserva Técnica / Manutenção',1,10,10,'Cordões Avulsos Reserva','{}'::jsonb,
       'BRUSQUE - 2026','Controle de LED - Brusque',18
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.producao_led_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id uuid NOT NULL REFERENCES public.producao_ordens_producao(id) ON DELETE RESTRICT,
  apontamento_id uuid REFERENCES public.producao_apontamentos(id) ON DELETE SET NULL,
  quantidade_cordoes numeric NOT NULL CHECK (quantidade_cordoes > 0),
  origem text,
  voltagem text,
  especificacao text,
  teste_funcional boolean,
  status text,
  observacoes text,
  criado_por_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por_nome_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS producao_led_registros_op_idx
  ON public.producao_led_registros(ordem_producao_id,created_at DESC);

ALTER TABLE public.producao_led_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS producao_led_registros_leitura ON public.producao_led_registros;
CREATE POLICY producao_led_registros_leitura
ON public.producao_led_registros
FOR SELECT TO authenticated
USING (public.usuario_tem_permissao_producao('visualizar'));

CREATE OR REPLACE FUNCTION public.registrar_led_op_v1(
  p_ordem_producao_id uuid,
  p_quantidade_cordoes numeric,
  p_origem text DEFAULT NULL,
  p_voltagem text DEFAULT NULL,
  p_especificacao text DEFAULT NULL,
  p_teste_funcional boolean DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_observacoes text DEFAULT NULL,
  p_apontamento_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_id uuid;
  v_nome text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para registrar aplicação de LED';
  END IF;
  IF COALESCE(p_quantidade_cordoes,0) <= 0 THEN
    RAISE EXCEPTION 'Quantidade de cordões deve ser maior que zero';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.producao_ordens_producao WHERE id=p_ordem_producao_id) THEN
    RAISE EXCEPTION 'OP não encontrada';
  END IF;
  SELECT COALESCE(pr.nome,u.email) INTO v_nome
  FROM auth.users u
  LEFT JOIN public.profiles pr ON pr.user_id=u.id
  WHERE u.id=auth.uid();

  INSERT INTO public.producao_led_registros(
    ordem_producao_id,apontamento_id,quantidade_cordoes,origem,voltagem,
    especificacao,teste_funcional,status,observacoes,criado_por_id,criado_por_nome_snapshot
  ) VALUES (
    p_ordem_producao_id,p_apontamento_id,p_quantidade_cordoes,p_origem,p_voltagem,
    p_especificacao,p_teste_funcional,p_status,p_observacoes,auth.uid(),v_nome
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_led_previsto_real_v1()
RETURNS TABLE(
  projeto_id uuid,
  projeto_nome text,
  total_previsto numeric,
  total_aplicado numeric,
  saldo numeric,
  testes_ok bigint,
  registros bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  WITH previsto AS (
    SELECT projeto_id,SUM(total_previsto) total_previsto
    FROM public.producao_led_planejado
    WHERE projeto_id IS NOT NULL
    GROUP BY projeto_id
  ),
  real AS (
    SELECT o.projeto_id,
           SUM(r.quantidade_cordoes) total_aplicado,
           COUNT(*) FILTER (WHERE r.teste_funcional IS TRUE) testes_ok,
           COUNT(*) registros
    FROM public.producao_led_registros r
    JOIN public.producao_ordens_producao o ON o.id=r.ordem_producao_id
    GROUP BY o.projeto_id
  )
  SELECT
    COALESCE(p.projeto_id,r.projeto_id),
    pr.nome,
    COALESCE(p.total_previsto,0),
    COALESCE(r.total_aplicado,0),
    GREATEST(COALESCE(p.total_previsto,0)-COALESCE(r.total_aplicado,0),0),
    COALESCE(r.testes_ok,0),
    COALESCE(r.registros,0)
  FROM previsto p
  FULL JOIN real r ON r.projeto_id=p.projeto_id
  JOIN public.producao_projetos pr ON pr.id=COALESCE(p.projeto_id,r.projeto_id)
  WHERE public.usuario_tem_permissao_producao('visualizar')
  ORDER BY pr.nome;
$$;

REVOKE ALL ON FUNCTION public.listar_tinta_previsto_real_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_led_op_v1(uuid,numeric,text,text,text,boolean,text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_led_previsto_real_v1() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.listar_tinta_previsto_real_v1() FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_led_op_v1(uuid,numeric,text,text,text,boolean,text,text,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.listar_led_previsto_real_v1() FROM anon;
GRANT EXECUTE ON FUNCTION public.listar_tinta_previsto_real_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_led_op_v1(uuid,numeric,text,text,text,boolean,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_led_previsto_real_v1() TO authenticated;

COMMIT;
