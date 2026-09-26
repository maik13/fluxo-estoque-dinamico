-- Corrige peças de locação importadas como ferramenta patrimonial.
-- A classificação incorreta fazia o gatilho de ferramentas rejeitar entradas com quantidade maior que 1.
update public.items
set tipo_item = 'Insumo',
    updated_at = now()
where codigo_barras in (457, 676, 699, 705)
  and tipo_item = 'Ferramenta'
  and categoria_id = '3d45ae9c-5c85-480a-92a3-6dad795c24a9'
  and subcategoria_id = '31ba24d3-503f-41c5-a72d-3d2982cb3e17';
