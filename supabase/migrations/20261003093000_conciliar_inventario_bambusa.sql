BEGIN;
CREATE TABLE IF NOT EXISTS public.inventario_conciliacao_20261003 (
  fonte_linha integer primary key,
  tec_codigo text not null,
  categoria_planilha text,
  nome_planilha text not null,
  especificacoes_dimensoes text,
  ano_origem text,
  item_id uuid null references public.items(id) on delete set null,
  codigo_sistema text,
  nome_sistema text,
  classificacao text not null,
  revisado boolean not null default false,
  observacoes text,
  created_at timestamptz not null default now()
);
INSERT INTO public.inventario_conciliacao_20261003(
  fonte_linha,tec_codigo,categoria_planilha,nome_planilha,especificacoes_dimensoes,ano_origem,classificacao
) VALUES
(10,'TEC-01','Figuras & Personagens','Anjo Ecológico','A: 2,7 m × base  1,15 m','2023','revisar_novo_remasterizado_composto'),
(11,'TEC-02','Árvores Cenográficas','Árvore de Inverno','Padrão','2024','revisar_novo_remasterizado_composto'),
(12,'TEC-03','Árvores Cenográficas','Árvore de Outono','4,5 m','2024','revisar_novo_remasterizado_composto'),
(13,'TEC-04','Árvores Cenográficas','Árvore de Pinha','3,0 m','2024','revisar_novo_remasterizado_composto'),
(14,'TEC-05','Árvores Cenográficas','Árvore de Primavera','4,5 m','2024','revisar_novo_remasterizado_composto'),
(15,'TEC-06','Árvores Cenográficas','Árvore dos Sonhos','6,0 m','2024','revisar_novo_remasterizado_composto'),
(16,'TEC-07','Árvores Cenográficas','Árvore Estilizada','2,5 m','2024','revisar_novo_remasterizado_composto'),
(17,'TEC-08','Árvores Cenográficas','Árvore Estilizada','3,5 m','2024','revisar_novo_remasterizado_composto'),
(18,'TEC-10','Árvores Cenográficas','Árvore Estilizada','4,5 m','2024','revisar_novo_remasterizado_composto'),
(19,'TEC-11','Árvores Cenográficas','Árvore Modular Pinheiro','A: 6,0 m + L: 2,0 m','2025','revisar_novo_remasterizado_composto'),
(20,'TEC-12','Árvores Cenográficas','Árvore Pinheiro','A: 6,0 m × L: 2,8 m','2024','revisar_novo_remasterizado_composto'),
(21,'TEC-13','Estruturas Especiais','Avião 14-Bis / Santos Dumont','6,0 m comp.','2025','revisar_novo_remasterizado_composto'),
(22,'TEC-14','Mobiliário Cenográfico','Banco Onda','C: 3,5 m','2024','revisar_novo_remasterizado_composto'),
(23,'TEC-15','Figuras & Personagens','Beija-flor Escultural','A: 4,2 m × L: 4,0 m × P: 4,0 m','2025','revisar_novo_remasterizado_composto'),
(24,'TEC-16','Enfeites & Pendentes','Bengala Natalina','A: 1,5 m','2024','revisar_novo_remasterizado_composto'),
(25,'TEC-17','Enfeites & Pendentes','Bengala Natalina','A: 2,5 m','2024','revisar_novo_remasterizado_composto'),
(26,'TEC-18','Bolas Cenográficas','Bola Natalina G','D: 1,0 m','2023 /2024','revisar_novo_remasterizado_composto'),
(27,'TEC-19','Bolas Cenográficas','Bola Natalina GG','D: 2,0 m','2023','revisar_novo_remasterizado_composto'),
(28,'TEC-20','Estruturas Especiais','Bola Noel','A: 3,5 m × L: 2,0 m','2025','revisar_novo_remasterizado_composto'),
(29,'TEC-22','Bolas Cenográficas','Bolas Penduradas','D: 40 cm','2024/2025','revisar_novo_remasterizado_composto'),
(30,'TEC-23','Bolas Cenográficas','Bolas Penduradas','D: 60 cm','2024/2025','revisar_novo_remasterizado_composto'),
(31,'TEC-24','Bolas Cenográficas','Bolas Penduradas','D: 80 cm','2024/2025','revisar_novo_remasterizado_composto'),
(32,'TEC-25','Figuras & Personagens','Boneco de Neve','Padrão','2024','revisar_novo_remasterizado_composto'),
(33,'TEC-26','Figuras & Personagens','Borboleta 2D','Envergadura: 2,0 m','2024','revisar_novo_remasterizado_composto'),
(34,'TEC-27','Estruturas Especiais','Caixa de Presente - Modelo 1','4,0 × 4,0 × 4,0 m','2025','revisar_novo_remasterizado_composto'),
(35,'TEC-28','Figuras & Personagens','Capivara Escultural','A: 3,0 m × L: 1,3 m × C: 4,5 m','2024','revisar_novo_remasterizado_composto'),
(36,'TEC-29','Estruturas Especiais','Casa do Papai Noel','A: 4,5 m × L: 6,6 m','2024','revisar_novo_remasterizado_composto'),
(37,'TEC-62','Estruturas Especiais','Casinha 2D','A: 1,8m','2026','revisar_novo_remasterizado_composto'),
(38,'TEC-61','Estruturas Especiais','Casinhas Bolas','A: 1,5m','2026','revisar_novo_remasterizado_composto'),
(39,'TEC-55','Figuras & Personagens','Coelha 2D detalhada','A: 1,8m','2026','revisar_novo_remasterizado_composto'),
(40,'TEC-56','Figuras & Personagens','Coelho 2D minimalista','A: 1,8m','2026','revisar_novo_remasterizado_composto'),
(41,'TEC-60','Figuras & Personagens','Coelho 3D','A:2,5m','2026','revisar_novo_remasterizado_composto'),
(42,'TEC-31','Flores & Domos','Conjunto de Pétalas','3,5 m','2023','revisar_novo_remasterizado_composto'),
(43,'TEC-33','Flores & Domos','Domo de Pétalas','A: 3,5 m × L 7,0 m','2024','revisar_novo_remasterizado_composto'),
(44,'TEC-34','Estrelas & Iluminação','Estrela Grande','A: 2,4 m','2025','revisar_novo_remasterizado_composto'),
(45,'TEC-35','Estrelas & Iluminação','Estrelas Penduradas (5 Pontas)','A: 1,0 m','2025','revisar_novo_remasterizado_composto'),
(46,'TEC-36','Estrelas & Iluminação','Estrelas Penduradas (5 Pontas)','A: 2,0 m','2026','revisar_novo_remasterizado_composto'),
(47,'TEC-37','Enfeites & Pendentes','Floco de Neve','A: 1,5 m','2024','revisar_novo_remasterizado_composto'),
(48,'TEC-38','Figuras & Personagens','Gralha-azul Escultural','A: 4,0 m × L: 4,5 m × P: 2,0 m','2025','revisar_novo_remasterizado_composto'),
(49,'TEC-39','Estruturas Especiais','Jardim Florido - Torre','A: 4,0 m','2024','revisar_novo_remasterizado_composto'),
(50,'TEC-40','Figuras & Personagens','Joaninha Escultural','A: 1,6 m ×  base 1,8 m','2024','revisar_novo_remasterizado_composto'),
(51,'TEC-43','Lanternas Orientais','Lanterna Japonesa G','40 × 40 × 40 cm','2024','revisar_novo_remasterizado_composto'),
(52,'TEC-44','Lanternas Orientais','Lanterna Japonesa GG','70 × 70 × 70 cm','2024','revisar_novo_remasterizado_composto'),
(53,'TEC-42','Lanternas Orientais','Lanterna Japonesa M','35 × 35 × 35 cm','2024','revisar_novo_remasterizado_composto'),
(54,'TEC-41','Lanternas Orientais','Lanterna Japonesa P','25 × 25 × 25 cm','2024','revisar_novo_remasterizado_composto'),
(55,'TEC-45','Estruturas Especiais','Letreiro de Bambu (''Feliz Natal'')','L: 3,5 m × A: 8,0 m','2025','revisar_novo_remasterizado_composto'),
(56,'TEC-46','Estruturas Especiais','Portal com Letreiro de Bambu (Feliz Natal)','L: 3,5 m × A: 8,0 m','2025','revisar_novo_remasterizado_composto'),
(57,'TEC-46','Presépio & Religioso','Maria, José e o Burrinho','A: 3,4 m','2025','revisar_novo_remasterizado_composto'),
(58,'TEC-59','Estruturas Especiais','Ovos 2D','A: 2m','2026','revisar_novo_remasterizado_composto'),
(59,'TEC-57','Estruturas Especiais','Ovos 3D G','1,20m','2026','revisar_novo_remasterizado_composto'),
(60,'TEC-58','Estruturas Especiais','Ovos 3D  M','0,80c m','2026','revisar_novo_remasterizado_composto'),
(61,'TEC-48','Presépio & Religioso','Presépio - Estrutura','3,85 m','2024','revisar_novo_remasterizado_composto'),
(62,'TEC-49','Presépio & Religioso','Presépio - Personagens (conjunto de 9 pçs)','Padrão','2024','revisar_novo_remasterizado_composto'),
(63,'TEC-47','Presépio & Religioso','Presépio c/ Rampa e Passarela','4,0 × 8,0 × 4,0 m','2025','revisar_novo_remasterizado_composto'),
(64,'TEC-50','Figuras & Personagens','Quati Escultural','A: 3,0 m × L: 1,1 m × P: 2,5 m','2025','revisar_novo_remasterizado_composto'),
(65,'TEC-51','Figuras & Personagens','Rena Escultural','A: 2,5 m','2024','revisar_novo_remasterizado_composto'),
(66,'TEC-52','Figuras & Personagens','Rena Escultural','A: 3,5 m','2024','revisar_novo_remasterizado_composto'),
(67,'TEC-53','Presépio & Religioso','Sagrada Família','A: 3,0 m × L: 2,0 m × P: 1,3 m','2025','revisar_novo_remasterizado_composto'),
(68,'TEC-54','Estruturas Especiais','Sol Cenográfico','D 3,5 m × P: 0,5 m','2024','revisar_novo_remasterizado_composto')
ON CONFLICT (fonte_linha) DO UPDATE SET
  tec_codigo=excluded.tec_codigo,
  categoria_planilha=excluded.categoria_planilha,
  nome_planilha=excluded.nome_planilha,
  especificacoes_dimensoes=excluded.especificacoes_dimensoes,
  ano_origem=excluded.ano_origem;

UPDATE public.inventario_conciliacao_20261003
SET item_id=NULL,codigo_sistema=NULL,nome_sistema=NULL,
    classificacao='revisar_novo_remasterizado_composto',
    revisado=FALSE,observacoes=NULL;

WITH mapa(fonte_linha,codigo_barras) AS (
  VALUES
    (11,7::bigint),(12,49::bigint),(13,57::bigint),(14,70::bigint),(15,75::bigint),
    (16,90::bigint),(17,93::bigint),(18,101::bigint),(22,139::bigint),(28,30039::bigint),
    (32,225::bigint),(36,251::bigint),(40,1226::bigint),(42,30050::bigint),(47,30055::bigint),
    (57,30060::bigint),(67,30066::bigint)
)
UPDATE public.inventario_conciliacao_20261003 c
SET item_id=i.id,
    codigo_sistema=i.codigo_barras::text,
    nome_sistema=i.nome,
    classificacao='mesmo_item',
    revisado=TRUE,
    observacoes='Correspondência conservadora confirmada por nome/base e dimensão.'
FROM mapa m
JOIN public.items i ON i.codigo_barras=m.codigo_barras
WHERE c.fonte_linha=m.fonte_linha;

UPDATE public.items i
SET especificacoes_dimensoes=c.especificacoes_dimensoes
FROM public.inventario_conciliacao_20261003 c
WHERE c.item_id=i.id
  AND c.classificacao='mesmo_item'
  AND nullif(btrim(c.especificacoes_dimensoes),'') IS NOT NULL;
COMMIT;
NOTIFY pgrst,'reload schema';
