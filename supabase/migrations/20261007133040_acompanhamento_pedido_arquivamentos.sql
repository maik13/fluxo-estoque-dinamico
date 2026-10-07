-- Arquivamento local e reversível da visualização do Acompanhamento do Pedido.
-- Os pedidos e projetos oficiais continuam íntegros no App Controle.
CREATE TABLE IF NOT EXISTS public.acompanhamento_pedido_arquivamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_project_setting_id text NOT NULL UNIQUE,
  project_name_snapshot text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  unarchived_at timestamptz,
  unarchived_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.acompanhamento_pedido_arquivamentos IS
  'Oculta ou restaura localmente acompanhamentos de pedido no Fluxo de Estoque; não altera dados do App Controle.';

ALTER TABLE public.acompanhamento_pedido_arquivamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.acompanhamento_pedido_arquivamentos FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.acompanhamento_pedido_arquivamentos TO authenticated;

CREATE POLICY acompanhamento_pedido_arquivamentos_admin_select
  ON public.acompanhamento_pedido_arquivamentos
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY acompanhamento_pedido_arquivamentos_admin_insert
  ON public.acompanhamento_pedido_arquivamentos
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) AND archived_by = (SELECT auth.uid()));

CREATE POLICY acompanhamento_pedido_arquivamentos_admin_update
  ON public.acompanhamento_pedido_arquivamentos
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));
