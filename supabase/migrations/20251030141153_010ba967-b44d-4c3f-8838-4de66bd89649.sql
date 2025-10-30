-- Renomear tipo de operação 'saida_producao' para 'retirada' nas solicitações existentes
UPDATE public.solicitacoes
SET tipo_operacao = 'retirada'
WHERE tipo_operacao = 'saida_producao';

-- Comentário: Também existe 'saida_obra' que pode ser mantido, pois é diferente de 'saida_producao'