BEGIN;

ALTER TABLE public.cotacao_solicitacoes
  ADD COLUMN IF NOT EXISTS criado_por_email text,
  ADD COLUMN IF NOT EXISTS criado_por_perfil text;

UPDATE public.cotacao_solicitacoes s
SET
  criado_por_nome = COALESCE(s.criado_por_nome, p.nome),
  criado_por_email = COALESCE(s.criado_por_email, p.email),
  criado_por_perfil = COALESCE(s.criado_por_perfil, p.tipo_usuario)
FROM public.profiles p
WHERE p.user_id = s.criado_por
  AND (
    s.criado_por_nome IS NULL
    OR s.criado_por_email IS NULL
    OR s.criado_por_perfil IS NULL
  );

COMMIT;