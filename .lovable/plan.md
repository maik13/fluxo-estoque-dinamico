# Sinalizador visual Página54 no Financeiro

## Objetivo
Tornar inequívoca a origem Página54, sem alterar sincronização, dados ou regras financeiras.

## Implementação
- Criar um indicador reutilizável com triângulo âmbar, etiqueta “Página54” e detalhes acessíveis por tooltip/título.
- Identificar lançamentos Página54 pelas quatro condições informadas, preservando linha, ID, status e erro abaixo da descrição.
- Aplicar o indicador nos lançamentos do Fluxo de Caixa e em exibições equivalentes nos relatórios financeiros.
- Marcar os cards de Saldo bancário e Saldo financeiro gerencial somente quando seus valores vierem da importação Página54.
- Substituir “Planilha histórica” pelo indicador nas linhas de categorias e subcategorias com `origem_planilha=true`.
- Preservar todas as ações, filtros, aprovações, programações, relatórios e configurações existentes.

## Detalhes técnicos
- Usar `AlertTriangle` e componentes visuais já existentes no projeto, com cores semânticas de aviso.
- Centralizar a regra de identificação e a montagem dos detalhes no componente reutilizável, sem adicionar `any` desnecessário.
- Validar com a checagem TypeScript e os testes financeiros aplicáveis; conferir o resultado visual no desktop.
