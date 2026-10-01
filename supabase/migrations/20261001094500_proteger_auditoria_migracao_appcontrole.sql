CREATE TABLE IF NOT EXISTS public.appcontrole_usuarios_importacao(
  source_user_id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  nome text,
  ativo boolean NOT NULL DEFAULT true,
  source_role text,
  source_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  destino_user_id uuid,
  status text NOT NULL DEFAULT 'pendente',
  erro text,
  migrado_em timestamptz
);
ALTER TABLE public.appcontrole_usuarios_importacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.appcontrole_usuarios_importacao FROM anon, authenticated;
COMMENT ON TABLE public.appcontrole_usuarios_importacao IS
  'Auditoria protegida da migração de usuários/acessos do App Controle para o Fluxo. Sem acesso direto por clientes.';
