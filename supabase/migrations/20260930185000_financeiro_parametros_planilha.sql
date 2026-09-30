BEGIN;

CREATE TABLE IF NOT EXISTS public.financeiro_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  origem_planilha BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  observacao TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financeiro_subcategorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  origem_planilha BOOLEAN NOT NULL DEFAULT false,
  revisao_pendente BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  observacao TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financeiro_categoria_subcategorias (
  categoria_id UUID NOT NULL REFERENCES public.financeiro_categorias(id) ON DELETE CASCADE,
  subcategoria_id UUID NOT NULL REFERENCES public.financeiro_subcategorias(id) ON DELETE CASCADE,
  origem_planilha BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (categoria_id, subcategoria_id)
);

INSERT INTO public.financeiro_categorias(nome, origem_planilha, ordem)
VALUES
  ('CUSTO', true, 10),
  ('DESPESAS', true, 20),
  ('DESPESA', true, 30),
  ('RECEITA', true, 40),
  ('AMARANTES', true, 50),
  ('NATAL', true, 60),
  ('DESPES', true, 70),
  ('SICOOB', true, 80)
ON CONFLICT (nome) DO UPDATE
SET origem_planilha = true,
    ordem = EXCLUDED.ordem,
    updated_at = now();

INSERT INTO public.financeiro_subcategorias(nome, origem_planilha, revisao_pendente, ordem)
VALUES
  ('FIXO', true, false, 10),
  ('VARIAVEL', true, false, 20),
  ('NATAL', true, false, 30),
  ('BANCO DO BRASIL', true, false, 40),
  ('SICOOB', true, false, 50),
  ('AMARANTES', true, false, 60),
  ('TOCTAO', true, false, 70),
  ('ENCARGOS', true, false, 80),
  ('RECEITA', true, false, 90),
  ('IMPOSTO', true, false, 100),
  ('????', true, true, 110),
  ('PAGAMENTO ÚNICO', true, false, 120),
  ('PAGAMENTO 1/5', true, false, 130),
  ('PAGAMENTO 2/5', true, false, 140),
  ('JUROS', true, false, 150),
  ('PAGAMENTO 3/5', true, false, 160),
  ('PAGAMENTO 4/5', true, false, 170),
  ('PAGAMENTO 5/5', true, false, 180)
ON CONFLICT (nome) DO UPDATE
SET origem_planilha = true,
    revisao_pendente = EXCLUDED.revisao_pendente,
    ordem = EXCLUDED.ordem,
    updated_at = now();

WITH pares(categoria, subcategoria) AS (
  VALUES
    ('CUSTO','FIXO'),
    ('CUSTO','VARIAVEL'),
    ('CUSTO','NATAL'),
    ('DESPESAS','FIXO'),
    ('DESPESAS','VARIAVEL'),
    ('DESPESAS','ENCARGOS'),
    ('DESPESA','FIXO'),
    ('DESPESA','VARIAVEL'),
    ('DESPESA','IMPOSTO'),
    ('RECEITA','TOCTAO'),
    ('AMARANTES','RECEITA'),
    ('NATAL','RECEITA'),
    ('DESPES','FIXO'),
    ('SICOOB','SICOOB')
)
INSERT INTO public.financeiro_categoria_subcategorias(categoria_id, subcategoria_id, origem_planilha)
SELECT c.id, s.id, true
FROM pares p
JOIN public.financeiro_categorias c ON c.nome = p.categoria
JOIN public.financeiro_subcategorias s ON s.nome = p.subcategoria
ON CONFLICT (categoria_id, subcategoria_id) DO UPDATE
SET origem_planilha = true;

ALTER TABLE public.financeiro_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_subcategorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_categoria_subcategorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_categorias_select ON public.financeiro_categorias;
CREATE POLICY fin_categorias_select ON public.financeiro_categorias
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro')
);

DROP POLICY IF EXISTS fin_categorias_write ON public.financeiro_categorias;
CREATE POLICY fin_categorias_write ON public.financeiro_categorias
FOR ALL TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'));

DROP POLICY IF EXISTS fin_subcategorias_select ON public.financeiro_subcategorias;
CREATE POLICY fin_subcategorias_select ON public.financeiro_subcategorias
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro')
);

DROP POLICY IF EXISTS fin_subcategorias_write ON public.financeiro_subcategorias;
CREATE POLICY fin_subcategorias_write ON public.financeiro_subcategorias
FOR ALL TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'));

DROP POLICY IF EXISTS fin_cat_sub_select ON public.financeiro_categoria_subcategorias;
CREATE POLICY fin_cat_sub_select ON public.financeiro_categoria_subcategorias
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro')
);

DROP POLICY IF EXISTS fin_cat_sub_write ON public.financeiro_categoria_subcategorias;
CREATE POLICY fin_cat_sub_write ON public.financeiro_categoria_subcategorias
FOR ALL TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'));

COMMIT;
