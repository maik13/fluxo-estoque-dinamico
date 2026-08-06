# Produção — Projeto, Etapa, OP e Apontamentos

## Estrutura funcional

1. **Projeto** — obra ou serviço completo, cadastrado uma única vez, como `Caixa de Presente · Brusque/SC`.
2. **Etapa** — fase do projeto, como `Laços`, `Painéis`, `Estrutura`, `Elétrica` ou `Acabamento`.
3. **Ordem de Produção (OP)** — autorização numerada emitida dentro da Etapa antes da execução.
4. **Apontamento** — registro real de data, horários, quantidade, equipe, atividade, observações e fotos dentro da OP.
5. **Tarefa** — classificação da atividade específica realizada no apontamento, como corte, montagem ou acabamento.

## Momento de emissão da OP

A OP é emitida na aba **Etapas**, pelo botão **Emitir nova OP**. Ela recebe número sequencial automático e é salva inicialmente com status `Liberada`.

Uma Etapa aberta pode receber quantas OPs forem necessárias. A quantidade planejada informada na Etapa é uma **meta de referência gerencial** e não limita a soma das quantidades das OPs.

Exemplo:

```text
Projeto: Caixa de Presente · Brusque/SC
└── Etapa: Painéis
    ├── OP 000001 — primeiro lote
    ├── OP 000002 — segundo lote
    ├── OP 000003 — correção ou complemento
    └── novas OPs enquanto a Etapa estiver aberta
```

A emissão de novas OPs é bloqueada somente quando a Etapa estiver `finalizada` ou `cancelada`.

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
    ├── OP 000002
    └── OP 000003
```

A Etapa consolida o planejamento. Cada OP possui período, status, quantidade e percentual próprios. Os apontamentos alimentam o progresso da OP, que alimenta o acompanhamento da Etapa.

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

- uma OP só pode ser emitida em Etapa não finalizada e não cancelada;
- não existe limite de quantidade acumulada ou de quantidade de OPs por Etapa aberta;
- cada OP exige quantidade própria maior que zero;
- apontamento planejado exige OP;
- a quantidade apontada não pode ultrapassar a quantidade da própria OP;
- Etapa não pode ser concluída ou cancelada enquanto houver OP aberta;
- apontamentos históricos sem OP permanecem como atividades avulsas.
