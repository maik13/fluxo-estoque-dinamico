# Integração MS Project Natal 2026 — regras operacionais aprovadas
Status: especificação de implantação. Nenhuma importação automática autorizada antes da conciliação dos IDs do .mpp e backup restaurável do banco.

## Objetivo e restrição
Integrar atividades do MS Project como OPs dentro do módulo Produção/Fluxo de Estoque, mantendo experiência atual de Planejamento, Projetos, Etapas, OPs, APs, PCP e estoque. Não criar um sistema paralelo e não sobrescrever histórico de execução.

## Mapeamento de macroprocessos
- Etapa 1: manter definição operacional já existente, sem remapeamento genérico.
- Etapa 2 — Fabricação: fabricação, serralheria, estruturas, preparo fabril, montagem fabril, restauro correspondente, demais tarefas de fabricação.
- Etapa 3 — Acabamento, iluminação e expedição: pintura, stain, proteção antichamas quando constituir acabamento, piscas, LED, testes elétricos dessa frente, embalagem, preparação de expedição e atividades de transporte aprovadas no escopo.
- Etapa 4 — Instalação in loco: montagem e fixação em campo, conexões, testes de entrega e OP de manutenção vigente durante o prazo do contrato; APs sucessivas registram intervenções reais.
- Etapa 5 — Desmontagem (futura): desinstalação, retirada, retorno, carga/descarga correspondente e conferência do acervo.

## Semântica dos registros
- Macroprocesso = etapa.
- Atividade detalhada do Project = OP, vinculada ao projeto e à etapa.
- Execução real = AP, vinculada à OP. Uma OP pode ter múltiplas APs.
- OP do Project com mesma descrição não é necessariamente duplicata: usar identificador original da tarefa, peça/referência, projeto/cidade, lote e relacionamentos.
- OP existente mantém ID, registros reais, anexos, consumo, materiais e status.
- Datas do Project são linha de base planejada; datas atuais e reais são preservadas como campos distintos.
- Tarefas não reconciliadas devem ser apenas candidatas e exigir validação antes da criação.

## Planejamento, materiais e Gantt
- Origem de projetos/peças/quantidades: Planejamento existente; evitar demanda duplicada.
- Não gerar solicitação ou consumo de estoque apenas porque uma OP foi importada.
- Gantt deve ler OPs do sistema com seus períodos e status, agrupadas em projeto, peça/cidade e etapa.
- Reagendamento por dependências entre OPs deve propagar apenas planejamento não concluído, sem modificar APs históricas; simular antes de confirmar.
- Alocação, calendário e duração devem respeitar dados originais do Project após extração estruturada, nunca inferidos de ocorrência textual.

## Gates para implementação em produção
1. Extrair corretamente o formato MPP (Task UID, OutlineLevel, datas, duração, calendário, predecessoras e recursos).
2. Gerar matriz exaustiva tarefa MSP ↔ peça/projeto/etapa/OP/AP e divergências.
3. Obter snapshot integral do banco; ensaiar restauração com evidências. Branch Git isolada não protege dados.
4. Aplicar migrações reversíveis e idempotentes, após revisão, sem alterações destrutivas.
5. Testar prévia/importação repetida, OPs já concluídas e operativas, efeitos em PCP/estoque, Gantt e reprogramação.
6. Não publicar no Lovable, não fazer merge ou mudar main sem aprovação explícita.

## Estado do diagnóstico
Banco consultado em modo somente leitura: 106 OPs; 89 concluídas, 7 em execução, 4 liberadas, 4 rascunhos, 2 canceladas; 12 OPs sem tarefa_nome_snapshot; 0 dependências de processo cadastradas na tabela consultada.
O arquivo de pré-triagem contém ocorrências textuais extraídas do binário, NÃO uma lista de OPs com datas e dependências verificadas.
