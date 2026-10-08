BEGIN;

-- Snapshot recuperável da carga-piloto imediatamente antes da troca pela base final.
CREATE TABLE public.backup_pagina54_20261007_lancamentos AS
SELECT *
FROM public.financeiro_lancamentos
WHERE origem_tipo = 'pagina54';

CREATE TABLE public.backup_pagina54_20261007_importacoes AS
SELECT *
FROM public.financeiro_importacao_pagina54
WHERE spreadsheet_id = '1rbdYW0eFmVZr4BQ2l_Q3KFIRheaxQY8XR2HvGstLgPA'
  AND aba = 'Página54';

CREATE TABLE public.backup_pagina54_20261007_posicoes AS
SELECT *
FROM public.financeiro_posicoes_diarias
WHERE responsavel = 'Importação Página54';

-- Remove exclusivamente registros oriundos da carga-piloto.
-- RCs, pedidos de compra, estoque, usuários, permissões e cadastros não são tocados.
DELETE FROM public.financeiro_lancamentos
WHERE origem_tipo = 'pagina54';

DELETE FROM public.financeiro_importacao_pagina54
WHERE spreadsheet_id = '1rbdYW0eFmVZr4BQ2l_Q3KFIRheaxQY8XR2HvGstLgPA'
  AND aba = 'Página54';

DELETE FROM public.financeiro_posicoes_diarias
WHERE responsavel = 'Importação Página54';

COMMIT;
