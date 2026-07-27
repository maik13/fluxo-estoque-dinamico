# Produção — Projeto, Etapa, OP e Apontamentos

Implementação reconstruída sobre a `main` atual.

## Estrutura funcional

1. **Projeto** — obra ou serviço completo, cadastrado uma única vez.
2. **Local operacional** — frente onde o trabalho ocorre, como fábrica, processamento, logística, instalação ou manutenção.
3. **Etapa** — pacote de trabalho planejado no cronograma, com quantidade, período, capacidade, equipe e dependências.
4. **Ordem de Produção (OP)** — autorização numerada emitida dentro da Etapa antes da execução.
5. **Apontamento** — registro real de data, horários, quantidade, equipe, tempos, atividade, observações e fotos dentro da OP.
6. **Tarefa** — classificação da atividade específica realizada no apontamento, como corte, montagem ou acabamento.

## Momento de emissão da OP

A OP é emitida na aba **Etapas**, pelo botão **Emitir OP**. Ela recebe número sequencial automático, iniciando em 1, e pode representar toda ou parte da quantidade planejada na Etapa.

Uma Etapa pode ter várias OPs. A soma das OPs abertas não pode ultrapassar a quantidade planejada da Etapa.

## Apontamentos

O apontamento planejado exige a seleção de uma OP liberada ou em execução. Ao selecionar a OP, o sistema herda automaticamente:

- Projeto;
- Etapa;
- Local operacional;
- produto ou entregável;
- unidade de medida;
- quantidade e progresso da OP.

Atividades não planejadas podem ser registradas como **avulsas — sem OP**, vinculadas diretamente ao projeto/local. Elas não atualizam automaticamente o progresso de uma Etapa.

## Cronograma

O Gantt apresenta a hierarquia:

```text
Projeto
└── Etapa
    ├── OP 000001
    └── OP 000002
```

A Etapa consolida o planejamento. Cada OP possui barra, período, status e percentual próprios. Os apontamentos não viram barras: eles alimentam o progresso da OP, que alimenta o progresso da Etapa.

As visões **Semana** e **Mês** continuam exibindo colunas diárias.

## Impressão

A impressão principal é da OP completa. O documento contém:

- número da OP;
- Projeto, Etapa e Local operacional;
- quantidade, unidade, prazo, responsável, equipe e instruções;
- status e progresso;
- todos os apontamentos vinculados;
- atividades, horários, quantidades, tempos produtivos e improdutivos;
- equipe e snapshots de jornada;
- observações, fotos e rastreabilidade;
- campos de assinatura.

## Regras de integridade

- uma OP só pode ser emitida em Etapa aberta;
- apontamento planejado exige OP;
- a quantidade apontada não pode ultrapassar o saldo da OP;
- Etapa não pode ser concluída ou cancelada enquanto houver OP aberta;
- Etapa com OP não pode ser excluída, preservando a rastreabilidade;
- apontamentos históricos sem OP permanecem como atividades avulsas.
