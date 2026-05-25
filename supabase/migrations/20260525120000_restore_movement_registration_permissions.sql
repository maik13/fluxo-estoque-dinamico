-- Preserve legacy access after Entrada/Saida were split out of "Registrar Movimentacoes".
UPDATE public.permissoes_tipo_usuario
SET
  pode_registrar_entrada = true,
  pode_registrar_saida = true
WHERE pode_registrar_movimentacoes = true;
