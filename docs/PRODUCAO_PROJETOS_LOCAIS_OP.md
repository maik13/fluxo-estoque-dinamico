# Produção — projetos, locais operacionais e OPs

Implementação em andamento sobre a `main` atual.

## Estrutura funcional

- Projeto: cadastro único da obra ou serviço.
- Local operacional: frente onde a etapa será executada, como fábrica, processamento, logística, instalação ou manutenção.
- Etapa: unidade planejada do projeto, vinculada a um local operacional.
- Tarefa: atividade específica executada no apontamento.
- Apontamento: registro real de execução.
- OP: documento sequencial emitido a partir do apontamento salvo.

## OP do apontamento

- numeração automática e única iniciando em 1;
- registros existentes numerados pela ordem de criação;
- impressão disponível no Histórico;
- contém projeto, local, etapa, tarefa, execução, equipe, tempos, quantidade, observações, fotos, status e rastreabilidade;
- apontamentos avulsos são identificados como sem etapa vinculada.
