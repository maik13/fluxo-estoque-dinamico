BEGIN;

UPDATE public.producao_planejamento_itens
SET estrategia_atendimento='producao_nova',
    acervo_codigo_ref=NULL,
    updated_at=now()
WHERE id='811dba73-c22c-4877-8928-6ca6b2b42bcf'::uuid
  AND nome='Conjunto Cônico de Bolas';

COMMIT;
NOTIFY pgrst,'reload schema';