-- Adicionar tabelas à publicação realtime se ainda não estiverem
-- Usamos DO $$ para criar um bloco anônimo que ignora erros se a tabela já estiver na publicação

DO $$
BEGIN
  -- movements
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movements;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- categorias
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categorias;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- subcategorias
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subcategorias;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- categoria_subcategoria
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categoria_subcategoria;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- locais_utilizacao
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locais_utilizacao;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- solicitacoes
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- solicitacao_itens
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacao_itens;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- solicitantes
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitantes;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- tipos_operacao
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tipos_operacao;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- estoques
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.estoques;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- transferencias
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transferencias;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- transferencia_itens
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transferencia_itens;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;