BEGIN;

ALTER TABLE public.cotacao_solicitacoes
  DROP CONSTRAINT IF EXISTS cotacao_solicitacoes_status_check;

ALTER TABLE public.cotacao_solicitacoes
  ALTER COLUMN status SET DEFAULT 'solicitada';

ALTER TABLE public.cotacao_solicitacoes
  ADD CONSTRAINT cotacao_solicitacoes_status_check
  CHECK (status = ANY (ARRAY[
    'solicitada',
    'aguardando_propostas',
    'em_analise',
    'escolhida',
    'encerrada',
    'cancelada'
  ]::text[]));

ALTER TABLE public.cotacao_solicitacoes
  ADD COLUMN IF NOT EXISTS data_necessaria date,
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'normal'
    CHECK (prioridade IN ('normal','urgente')),
  ADD COLUMN IF NOT EXISTS origem_frete text,
  ADD COLUMN IF NOT EXISTS destino_frete text,
  ADD COLUMN IF NOT EXISTS peso_kg numeric(14,3),
  ADD COLUMN IF NOT EXISTS cubagem_m3 numeric(14,3),
  ADD COLUMN IF NOT EXISTS volumes integer;

CREATE TABLE IF NOT EXISTS public.cotacao_solicitacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.cotacao_solicitacoes(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id),
  codigo_item text,
  descricao text NOT NULL,
  quantidade numeric(14,3),
  unidade text,
  observacoes text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cotacao_solicitacao_itens_solicitacao_idx
  ON public.cotacao_solicitacao_itens(solicitacao_id);

ALTER TABLE public.cotacao_solicitacao_itens ENABLE ROW LEVEL SECURITY;

-- Solicitação: qualquer usuário autenticado pode criar e consultar as próprias.
-- Almoxarifado/compras/admin pode consultar e operar todas.
DROP POLICY IF EXISTS cotacao_solicitacoes_select ON public.cotacao_solicitacoes;
CREATE POLICY cotacao_solicitacoes_select
ON public.cotacao_solicitacoes
FOR SELECT TO authenticated
USING (
  criado_por = auth.uid()
  OR public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.tipo_usuario = 'estoquista'
  )
);

DROP POLICY IF EXISTS cotacao_solicitacoes_insert ON public.cotacao_solicitacoes;
CREATE POLICY cotacao_solicitacoes_insert
ON public.cotacao_solicitacoes
FOR INSERT TO authenticated
WITH CHECK (criado_por = auth.uid());

DROP POLICY IF EXISTS cotacao_solicitacoes_update ON public.cotacao_solicitacoes;
CREATE POLICY cotacao_solicitacoes_update
ON public.cotacao_solicitacoes
FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.tipo_usuario = 'estoquista'
  )
  OR (criado_por = auth.uid() AND status = 'solicitada')
)
WITH CHECK (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.tipo_usuario = 'estoquista'
  )
  OR criado_por = auth.uid()
);

DROP POLICY IF EXISTS cotacao_solicitacoes_delete ON public.cotacao_solicitacoes;
CREATE POLICY cotacao_solicitacoes_delete
ON public.cotacao_solicitacoes
FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.tipo_usuario = 'estoquista'
  )
  OR (criado_por = auth.uid() AND status = 'solicitada')
);

CREATE POLICY cotacao_solicitacao_itens_select
ON public.cotacao_solicitacao_itens
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cotacao_solicitacoes s
    WHERE s.id = solicitacao_id
      AND (
        s.criado_por = auth.uid()
        OR public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.ativo = true
            AND p.tipo_usuario = 'estoquista'
        )
      )
  )
);

CREATE POLICY cotacao_solicitacao_itens_insert
ON public.cotacao_solicitacao_itens
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.cotacao_solicitacoes s
    WHERE s.id = solicitacao_id
      AND (
        s.criado_por = auth.uid()
        OR public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.ativo = true
            AND p.tipo_usuario = 'estoquista'
        )
      )
  )
);

CREATE POLICY cotacao_solicitacao_itens_update
ON public.cotacao_solicitacao_itens
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cotacao_solicitacoes s
    WHERE s.id = solicitacao_id
      AND (
        public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.ativo = true
            AND p.tipo_usuario = 'estoquista'
        )
        OR (s.criado_por = auth.uid() AND s.status = 'solicitada')
      )
  )
);

CREATE POLICY cotacao_solicitacao_itens_delete
ON public.cotacao_solicitacao_itens
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cotacao_solicitacoes s
    WHERE s.id = solicitacao_id
      AND (
        public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.ativo = true
            AND p.tipo_usuario = 'estoquista'
        )
        OR (s.criado_por = auth.uid() AND s.status = 'solicitada')
      )
  )
);

-- A Central de Cotações pertence operacionalmente ao Almoxarifado.
DROP POLICY IF EXISTS cotacoes_select ON public.cotacoes;
CREATE POLICY cotacoes_select ON public.cotacoes
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.tipo_usuario = 'estoquista'
  )
);

DROP POLICY IF EXISTS cotacoes_insert ON public.cotacoes;
CREATE POLICY cotacoes_insert ON public.cotacoes
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.tipo_usuario = 'estoquista'
  )
);

DROP POLICY IF EXISTS cotacoes_update ON public.cotacoes;
CREATE POLICY cotacoes_update ON public.cotacoes
FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.tipo_usuario = 'estoquista'
  )
)
WITH CHECK (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.tipo_usuario = 'estoquista'
  )
);

DROP POLICY IF EXISTS cotacoes_delete ON public.cotacoes;
CREATE POLICY cotacoes_delete ON public.cotacoes
FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.tipo_usuario = 'estoquista'
  )
);

DROP POLICY IF EXISTS cotacao_itens_select ON public.cotacao_itens;
CREATE POLICY cotacao_itens_select ON public.cotacao_itens
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id = cotacao_id
      AND (
        public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.ativo = true
            AND p.tipo_usuario = 'estoquista'
        )
      )
  )
);

DROP POLICY IF EXISTS cotacao_itens_insert ON public.cotacao_itens;
CREATE POLICY cotacao_itens_insert ON public.cotacao_itens
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id = cotacao_id
      AND (
        public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.ativo = true
            AND p.tipo_usuario = 'estoquista'
        )
      )
  )
);

DROP POLICY IF EXISTS cotacao_itens_update ON public.cotacao_itens;
CREATE POLICY cotacao_itens_update ON public.cotacao_itens
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id = cotacao_id
      AND (
        public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.ativo = true
            AND p.tipo_usuario = 'estoquista'
        )
      )
  )
);

DROP POLICY IF EXISTS cotacao_itens_delete ON public.cotacao_itens;
CREATE POLICY cotacao_itens_delete ON public.cotacao_itens
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id = cotacao_id
      AND (
        public.is_admin()
        OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.ativo = true
            AND p.tipo_usuario = 'estoquista'
        )
      )
  )
);

DROP POLICY IF EXISTS cotacoes_documentos_select ON storage.objects;
CREATE POLICY cotacoes_documentos_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='cotacoes-documentos'
  AND (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.ativo = true
        AND p.tipo_usuario = 'estoquista'
    )
  )
);

DROP POLICY IF EXISTS cotacoes_documentos_insert ON storage.objects;
CREATE POLICY cotacoes_documentos_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='cotacoes-documentos'
  AND (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.ativo = true
        AND p.tipo_usuario = 'estoquista'
    )
  )
);

DROP POLICY IF EXISTS cotacoes_documentos_update ON storage.objects;
CREATE POLICY cotacoes_documentos_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id='cotacoes-documentos'
  AND (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.ativo = true
        AND p.tipo_usuario = 'estoquista'
    )
  )
)
WITH CHECK (
  bucket_id='cotacoes-documentos'
  AND (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.ativo = true
        AND p.tipo_usuario = 'estoquista'
    )
  )
);

DROP POLICY IF EXISTS cotacoes_documentos_delete ON storage.objects;
CREATE POLICY cotacoes_documentos_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id='cotacoes-documentos'
  AND (
    public.is_admin()
    OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.ativo = true
        AND p.tipo_usuario = 'estoquista'
    )
  )
);

COMMIT;