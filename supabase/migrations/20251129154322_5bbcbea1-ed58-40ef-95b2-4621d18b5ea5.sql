-- Habilitar REPLICA IDENTITY FULL para capturar todos os dados em updates
-- Isso garante que o realtime receba os dados completos nas atualizações
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER TABLE public.movements REPLICA IDENTITY FULL;
ALTER TABLE public.categorias REPLICA IDENTITY FULL;
ALTER TABLE public.subcategorias REPLICA IDENTITY FULL;
ALTER TABLE public.categoria_subcategoria REPLICA IDENTITY FULL;
ALTER TABLE public.locais_utilizacao REPLICA IDENTITY FULL;
ALTER TABLE public.solicitacoes REPLICA IDENTITY FULL;
ALTER TABLE public.solicitacao_itens REPLICA IDENTITY FULL;
ALTER TABLE public.solicitantes REPLICA IDENTITY FULL;
ALTER TABLE public.tipos_operacao REPLICA IDENTITY FULL;
ALTER TABLE public.estoques REPLICA IDENTITY FULL;
ALTER TABLE public.transferencias REPLICA IDENTITY FULL;
ALTER TABLE public.transferencia_itens REPLICA IDENTITY FULL;