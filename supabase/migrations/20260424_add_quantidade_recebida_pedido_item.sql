-- Adiciona a coluna quantidade_recebida na tabela pedido_compra_itens
-- Usada quando o estoquista sinaliza que um item veio parcialmente

ALTER TABLE pedido_compra_itens
  ADD COLUMN IF NOT EXISTS quantidade_recebida NUMERIC(10, 3) DEFAULT NULL;

COMMENT ON COLUMN pedido_compra_itens.quantidade_recebida IS
  'Quantidade efetivamente recebida quando o status do item é "parcial". '
  'Menor que "quantidade" (quantidade pedida). '
  'NULL quando o status é "pendente" ou "comprado" (recebimento total).';
