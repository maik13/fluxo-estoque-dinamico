-- Criar tabela tipos_operacao
CREATE TABLE public.tipos_operacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.tipos_operacao ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários autenticados podem visualizar tipos de operação"
ON public.tipos_operacao
FOR SELECT
USING (true);

CREATE POLICY "Gestores e admins podem criar tipos de operação"
ON public.tipos_operacao
FOR INSERT
WITH CHECK (can_manage_inventory());

CREATE POLICY "Gestores e admins podem atualizar tipos de operação"
ON public.tipos_operacao
FOR UPDATE
USING (can_manage_inventory());

CREATE POLICY "Gestores e admins podem deletar tipos de operação"
ON public.tipos_operacao
FOR DELETE
USING (can_manage_inventory());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_tipos_operacao_updated_at
BEFORE UPDATE ON public.tipos_operacao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir tipos de operação padrão
INSERT INTO public.tipos_operacao (nome, descricao, tipo) VALUES
  ('Compra', 'Entrada de materiais por compra', 'entrada'),
  ('Saída para Produção', 'Saída de materiais para uso na produção', 'saida'),
  ('Quebra', 'Perda de material por quebra ou dano', 'saida'),
  ('Devolução', 'Retorno de materiais ao estoque', 'entrada');

-- Adicionar coluna tipo_operacao_id nas tabelas solicitacoes e movements
ALTER TABLE public.solicitacoes ADD COLUMN tipo_operacao_id UUID REFERENCES public.tipos_operacao(id);
ALTER TABLE public.movements ADD COLUMN tipo_operacao_id UUID REFERENCES public.tipos_operacao(id);

-- Migrar dados existentes (mapear tipo texto para ID)
UPDATE public.solicitacoes s
SET tipo_operacao_id = (
  SELECT id FROM public.tipos_operacao 
  WHERE nome = 'Saída para Produção' 
  LIMIT 1
)
WHERE s.tipo_operacao = 'saida_producao' OR s.tipo_operacao IS NULL;

UPDATE public.movements m
SET tipo_operacao_id = (
  SELECT id FROM public.tipos_operacao 
  WHERE nome = CASE 
    WHEN m.tipo = 'entrada' THEN 'Compra'
    WHEN m.tipo = 'saida' THEN 'Saída para Produção'
    WHEN m.tipo = 'quebra' THEN 'Quebra'
    WHEN m.tipo = 'devolucao' THEN 'Devolução'
    ELSE 'Saída para Produção'
  END
  LIMIT 1
);