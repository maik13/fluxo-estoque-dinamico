-- Habilitar REPLICA IDENTITY FULL nas tabelas para capturar todos os dados
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER TABLE public.movements REPLICA IDENTITY FULL;
ALTER TABLE public.categorias REPLICA IDENTITY FULL;
ALTER TABLE public.subcategorias REPLICA IDENTITY FULL;
ALTER TABLE public.categoria_subcategoria REPLICA IDENTITY FULL;
ALTER TABLE public.estoques REPLICA IDENTITY FULL;
ALTER TABLE public.locais_utilizacao REPLICA IDENTITY FULL;
ALTER TABLE public.tipos_operacao REPLICA IDENTITY FULL;
ALTER TABLE public.solicitacoes REPLICA IDENTITY FULL;
ALTER TABLE public.solicitacao_itens REPLICA IDENTITY FULL;
ALTER TABLE public.solicitantes REPLICA IDENTITY FULL;
ALTER TABLE public.transferencias REPLICA IDENTITY FULL;
ALTER TABLE public.transferencia_itens REPLICA IDENTITY FULL;

-- Adicionar as tabelas à publicação de real-time do Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categorias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subcategorias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categoria_subcategoria;
ALTER PUBLICATION supabase_realtime ADD TABLE public.estoques;
ALTER PUBLICATION supabase_realtime ADD TABLE public.locais_utilizacao;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tipos_operacao;
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacao_itens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitantes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transferencias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transferencia_itens;