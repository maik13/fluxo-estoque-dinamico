# Protocolo Operacional — Módulo de Produção

## 1. Objetivo

O Módulo de Produção registra e acompanha a execução real dos trabalhos da empresa, sem movimentar automaticamente o estoque.

A estrutura operacional é:

```text
Projeto/local existente
└── Processo de produção
    └── Apontamentos
        ├── Tarefa executada
        ├── Equipe
        ├── Horários
        ├── Quantidade
        ├── Tempos produtivos e improdutivos
        ├── Observações
        └── Fotos
```

## 2. Conceitos obrigatórios

### Projeto/local

É o projeto ou local que já existe no cadastro do aplicativo, em `Configurações → Locais de utilização`.

A Produção não deve criar outro projeto com o mesmo nome. A aba Projetos apenas complementa o cadastro existente com cidade, UF, cliente, endereço e responsável.

### Processo

É uma frente macro de trabalho que possui ciclo de vida próprio.

Exemplos:

- Montagem dos painéis;
- Fabricação das estruturas;
- Instalação elétrica;
- Acabamento;
- Montagem em campo.

### Tarefa

É a atividade específica executada durante um apontamento.

Exemplos:

- Cortar ripas;
- Fixar ripas;
- Montar módulo;
- Lixar peça;
- Instalar luminária.

### Apontamento

É o registro real do trabalho executado em uma data e horário, com equipe, tarefa, quantidade, tempos, observações e evidências fotográficas.

## 3. Aba Processos

### Finalidade

Criar e controlar as frentes macro de produção.

### Botão `Novo Processo`

Abre o formulário de criação.

#### Campos

- **Buscar projeto/local existente:** filtra por nome, grupo, cliente, cidade ou UF.
- **Projeto/local existente:** seleciona o cadastro já existente no aplicativo.
- **Código opcional:** pode ser digitado manualmente; vazio gera código automático.
- **Prioridade:** baixa, normal, alta ou urgente.
- **Nome do processo:** identificação objetiva da frente de trabalho.
- **Descrição:** detalhamento do escopo.
- **Produto/entregável:** resultado esperado.
- **Unidade:** peças, módulos, m², metros etc.
- **Quantidade planejada:** meta do processo.

### Botões e estados

#### `Iniciar`

Disponível no status `Planejado`.

Resultado:

```text
Planejado → Em andamento
```

Registra usuário e data da ação.

#### `Pausar`

Disponível no status `Em andamento`.

Exige justificativa.

Resultado:

```text
Em andamento → Pausado
```

Use para interrupção temporária planejada.

#### `Retomar`

Disponível no status `Pausado`.

Resultado:

```text
Pausado → Em andamento
```

#### `Bloquear`

Disponível no status `Em andamento`.

Exige justificativa.

Resultado:

```text
Em andamento → Bloqueado
```

Use quando existe impedimento operacional, falta de material, dependência técnica ou liberação externa.

#### `Desbloquear`

Disponível no status `Bloqueado`.

Exige justificativa.

Resultado:

```text
Bloqueado → Em andamento
```

#### `Finalizar`

Disponível no status `Em andamento`.

Abre o resumo de finalização com:

- planejado x realizado;
- percentual de conclusão;
- apontamentos;
- pendências;
- tempos produtivos e improdutivos;
- horas-homem;
- justificativa final.

Resultado:

```text
Em andamento → Finalizado
```

#### `Cancelar`

Disponível enquanto o processo estiver aberto.

Exige justificativa.

Resultado:

```text
Planejado / Em andamento / Pausado / Bloqueado → Cancelado
```

#### `Reabrir`

Disponível nos processos finalizados ou cancelados quando o usuário possui permissão.

Exige justificativa.

Resultado:

```text
Finalizado / Cancelado → Planejado
```

## 4. Aba Apontamentos

### Finalidade

Registrar a execução diária real.

### Regra principal

O apontamento deve possuir:

```text
Processo em andamento
OU
Projeto/local avulso
```

Nunca os dois ao mesmo tempo.

### Campos

- **Data:** dia da execução.
- **Vincular a processo em andamento — opcional:** associa o registro a uma frente macro.
- **Projeto/local avulso:** usado quando não existe processo.
- **Tarefa:** atividade específica executada.
- **Local de execução:** Fábrica ou Execução.
- **Início:** horário inicial.
- **Término:** horário final.
- **Quantidade produzida:** produção realizada, quando mensurável.
- **Minutos improdutivos:** tempo perdido dentro do período.
- **Motivo improdutivo:** obrigatório quando houver tempo improdutivo.
- **Equipe:** membros que participaram.
- **Evidências fotográficas:** imagens JPEG, PNG ou WebP, até 10 MB cada.
- **Observações:** informações adicionais.

### Botão `Agora`

Preenche o horário atual no campo Início ou Término.

### Botão `Adicionar fotos`

Permite selecionar várias imagens antes de salvar.

As fotos aparecem na lista de arquivos selecionados e podem ser removidas antes do envio.

### Botão `Salvar como pendente`

Cria o apontamento com status `Pendente`.

Depois de criar o registro, envia as fotos selecionadas.

O apontamento não é conferido automaticamente.

## 5. Aba Histórico

### Finalidade

Consultar, conferir e rastrear os registros realizados.

### Filtros

- data inicial;
- data final;
- projeto/local;
- processo;
- status.

### Colunas

- Data e horário;
- Projeto/local e cidade/UF;
- Processo;
- Tarefa;
- Equipe;
- Criado por;
- Fotos;
- Status;
- Ações.

### Botão de fotos

O número exibido na coluna Fotos abre a galeria de imagens do apontamento.

### Botão `Conferir`

Disponível para usuários autorizados quando o status é `Pendente`.

Resultado:

```text
Pendente → Conferido
```

Registra usuário e horário da conferência.

### Botão `Cancelar`

Disponível enquanto o apontamento estiver pendente.

Exige justificativa.

Resultado:

```text
Pendente → Cancelado
```

### Botão `Detalhes`

Mostra:

- responsável pela criação;
- data e hora de criação;
- responsável pela última edição;
- responsável pela conferência;
- responsável pelo cancelamento;
- quantidade;
- tempos produtivos e improdutivos;
- motivo do cancelamento;
- observações.

## 6. Aba Projetos

### Finalidade

Exibir os projetos/locais já cadastrados no aplicativo e complementar suas informações para uso na Produção.

### Origem obrigatória

A lista deve vir de:

```text
Configurações → Locais de utilização
```

A configuração complementar não pode impedir que os projetos existentes apareçam.

### Botão `Configurar Projeto`

Permite selecionar um projeto/local existente e complementar:

- descrição;
- cliente;
- cidade;
- UF;
- local de execução;
- endereço;
- responsável.

### Busca

Filtra por:

- projeto/local;
- grupo;
- cliente;
- cidade;
- UF.

## 7. Aba BI Produção

### Finalidade

Consolidar os dados dos apontamentos e processos.

### Informações esperadas

- horas-relógio;
- horas-homem;
- eficiência;
- tempo produtivo;
- tempo improdutivo;
- custo de mão de obra;
- produção por projeto;
- produção por tarefa;
- produção por membro;
- fotos por período e projeto;
- distribuição por status.

O BI é uma visão gerencial. A inclusão de fotos acontece na aba Apontamentos.

## 8. Aba Configurações

### Finalidade

Administrar os cadastros auxiliares exclusivos da Produção.

### Tarefas

Cadastrar atividades específicas que serão utilizadas nos apontamentos.

### Equipe / membros

Cadastrar ou manter:

- nome;
- apelido;
- função;
- valor-hora;
- situação ativa ou inativa.

## 9. Fluxo operacional recomendado

```text
1. Confirmar projeto/local existente
2. Configurar cidade, UF e responsável
3. Cadastrar tarefas e membros
4. Criar processo
5. Iniciar processo
6. Lançar apontamentos com fotos
7. Conferir apontamentos
8. Pausar ou bloquear quando necessário
9. Retomar ou desbloquear
10. Finalizar processo
11. Consultar Histórico
12. Consultar BI Produção
```

## 10. Checklist de homologação

Antes de liberar o módulo:

- [ ] Os projetos existentes aparecem no Novo Processo.
- [ ] A busca encontra projeto por nome, grupo ou cidade.
- [ ] Cidade e UF aparecem nos processos e no Histórico.
- [ ] Processo e tarefa são campos separados.
- [ ] O processo pode ser iniciado, pausado, bloqueado, finalizado, cancelado e reaberto.
- [ ] O apontamento permite adicionar várias fotos.
- [ ] As fotos aparecem no Histórico.
- [ ] O Histórico mostra quem criou, conferiu e cancelou.
- [ ] O apontamento permanece pendente até conferência manual.
- [ ] A aba mantém o nome BI Produção.
- [ ] Nenhuma ação da Produção movimenta estoque automaticamente.
