-- Criar tabela locais_utilizacao
CREATE TABLE public.locais_utilizacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.locais_utilizacao ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Usuários autenticados podem visualizar locais de utilização"
ON public.locais_utilizacao
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Gestores e admins podem criar locais de utilização"
ON public.locais_utilizacao
FOR INSERT
TO authenticated
WITH CHECK (can_manage_inventory());

CREATE POLICY "Gestores e admins podem atualizar locais de utilização"
ON public.locais_utilizacao
FOR UPDATE
TO authenticated
USING (can_manage_inventory());

CREATE POLICY "Gestores e admins podem deletar locais de utilização"
ON public.locais_utilizacao
FOR DELETE
TO authenticated
USING (can_manage_inventory());

-- Adicionar trigger para updated_at
CREATE TRIGGER update_locais_utilizacao_updated_at
BEFORE UPDATE ON public.locais_utilizacao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar nova coluna local_utilizacao_id nas tabelas solicitacoes e movements
ALTER TABLE public.solicitacoes 
ADD COLUMN local_utilizacao_id UUID REFERENCES public.locais_utilizacao(id);

ALTER TABLE public.movements 
ADD COLUMN local_utilizacao_id UUID REFERENCES public.locais_utilizacao(id);

-- Migrar dados existentes (criar registros de locais únicos e atualizar referências)
-- Primeiro, inserir locais únicos da tabela solicitacoes
INSERT INTO public.locais_utilizacao (nome)
SELECT DISTINCT local_utilizacao
FROM public.solicitacoes
WHERE local_utilizacao IS NOT NULL AND local_utilizacao != ''
ON CONFLICT DO NOTHING;

-- Inserir locais únicos da tabela movements que não existem ainda
INSERT INTO public.locais_utilizacao (nome)
SELECT DISTINCT m.local_utilizacao
FROM public.movements m
WHERE m.local_utilizacao IS NOT NULL 
  AND m.local_utilizacao != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.locais_utilizacao l 
    WHERE l.nome = m.local_utilizacao
  )
ON CONFLICT DO NOTHING;

-- Atualizar referências em solicitacoes
UPDATE public.solicitacoes s
SET local_utilizacao_id = l.id
FROM public.locais_utilizacao l
WHERE s.local_utilizacao = l.nome;

-- Atualizar referências em movements
UPDATE public.movements m
SET local_utilizacao_id = l.id
FROM public.locais_utilizacao l
WHERE m.local_utilizacao = l.nome;

-- Agora podemos remover as colunas antigas (opcional, manter por segurança por enquanto)
-- ALTER TABLE public.solicitacoes DROP COLUMN local_utilizacao;
-- ALTER TABLE public.movements DROP COLUMN local_utilizacao;