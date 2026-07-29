# PCP de Materiais — Etapa, OP e Almoxarifado

## Regra funcional

O planejamento de materiais acontece na **Etapa de Produção**.

- Salvar o PCP da Etapa **não cria Solicitação de Material**.
- Salvar o PCP da Etapa **não reserva nem baixa o estoque**.
- A quantidade informada representa a necessidade total da Etapa.
- Ao emitir uma OP parcial, o sistema cria um snapshot proporcional dos materiais.
- O snapshot deixa de ser reescrito quando a OP entra em execução ou recebe uma solicitação.
- A Solicitação de Material é gerada somente por confirmação explícita dentro da OP.
- A solicitação entra no fluxo atual do Almoxarifado com status `pendente`.
- O prazo operacional máximo informado para separação é de **1 dia após a solicitação**, podendo ocorrer antes.
- A geração da solicitação não cria baixa nem reserva; a saída ocorre somente na conversão em retirada.

## Fluxo

```text
Etapa
  └─ PCP de materiais previstos
       └─ salvar planejamento
            ├─ sem solicitação
            ├─ sem reserva
            └─ sem baixa

Ordem de Produção
  └─ snapshot proporcional dos materiais
       └─ confirmar “Gerar Solicitação de Material”
            └─ Solicitação de Material pendente
                 ├─ aprovação do Almoxarifado
                 ├─ Pedido de Compra para falta de saldo
                 └─ conversão em retirada e saída do estoque
```

## Alertas obrigatórios na interface

### Ao salvar o PCP

A interface apresenta aviso pulsante e confirmação em destaque:

> ISTO É SOMENTE PLANEJAMENTO. SALVAR O PCP NÃO CRIA SOLICITAÇÃO DE MATERIAL, NÃO RESERVA E NÃO BAIXA O ESTOQUE.

Também informa que, após a geração oficial dentro da OP, o Almoxarifado terá prazo máximo de 1 dia para a separação.

### Ao gerar a solicitação na OP

A interface apresenta novo aviso pulsante e exige confirmação:

> ESTA AÇÃO GERA UMA SOLICITAÇÃO OFICIAL. O ALMOXARIFADO TERÁ PRAZO MÁXIMO DE 1 DIA PARA SEPARAR OS MATERIAIS.

O aviso reforça que a ação ainda não realiza baixa ou reserva automática.

## Estruturas de dados

### `producao_etapa_materiais`

Planejamento total da Etapa, vinculado aos itens reais do cadastro do Almoxarifado.

### `producao_ordem_materiais`

Snapshot proporcional e preservado dos materiais da OP.

### `solicitacoes_material`

Continua sendo a fonte oficial da solicitação. Recebe os vínculos opcionais:

- `origem_modulo = 'producao'`
- `producao_projeto_id`
- `processo_id`
- `ordem_producao_id`
- `data_necessidade`
- `data_limite_separacao`

## Regras de integridade

- O mesmo item não pode aparecer duas vezes no PCP da mesma Etapa.
- Apenas itens ativos podem ser incluídos.
- Quantidades devem ser maiores que zero.
- Ferramentas são planejadas como uma unidade por código na interface.
- Uma OP não pode gerar duas solicitações ativas simultâneas.
- Uma solicitação rejeitada permite nova geração posterior.
- OP concluída ou cancelada não pode gerar nova solicitação.
- Alterar o PCP não reescreve OP em execução nem material já solicitado.
- Itens sem saldo continuam seguindo para Pedido de Compra durante a aprovação pelo fluxo existente.

## Migration

```text
supabase/migrations/20260729110000_pcp_materiais_etapa_op.sql
```

A interface depende da execução dessa migration no Supabase. O merge do código não confirma a aplicação da estrutura no banco.
