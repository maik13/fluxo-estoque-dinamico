-- Criar tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS public.action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB
);

-- Habilitar RLS
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Qualquer usuário autenticado pode inserir logs" 
ON public.action_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Apenas administradores podem ler logs" 
ON public.action_logs FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.user_id = auth.uid() 
    AND public.profiles.tipo_usuario = 'administrador'
  )
);

-- Adicionar comentário para documentação
COMMENT ON TABLE public.action_logs IS 'Registros de auditoria para ações importantes do sistema.';
