# Integração controlada do MS Project — Natal 2026

## O que a primeira carga faz

1. Lê somente as tarefas-folha do arquivo `.mpp` original.
2. Armazena datas planejadas, hierarquia, referência, cidade e predecessoras em uma área de pré-importação auditável.
3. Classifica cada atividade como sugestão para as etapas 2 a 5, sem criar OPs.
4. Mantém as datas reais, os apontamentos, materiais, estoque e OPs existentes intactos.

O arquivo `Natal 2026 v21.mpp` não contém linha de base preenchida nas tarefas-folha. Por isso, as datas existentes nele entram no sistema explicitamente como **plano original importado**, não como linha de base nativa do Project.

## Como gerar o arquivo de pré-importação

Com o runtime MPXJ instalado fora do aplicativo web:

```powershell
python scripts/extrair_msproject_natal.py `
  "C:\Users\maiko\Downloads\Natal 2026 v21.mpp" `
  "C:\Users\maiko\Downloads\Natal-2026-v21.pre-importacao.json"
```

Depois, em **Produção → Configurações → Integração controlada — Microsoft Project**, selecione o JSON produzido. O registro ficará como `aguardando_conciliacao`.

## Regras de conciliação

- A chave de conciliação é `referência do Project + cidade`.
- Projetos que não existirem no sistema continuam como `sem projeto` e não podem gerar OP automaticamente.
- Atividades do Project viram candidatas a OPs; elas nunca viram novas etapas.
- A classificação segue as etapas existentes: fabricação (2), acabamento/iluminação/embalagem/logística (3), montagem e manutenção em campo (4), desmontagem e retorno (5).
- Dependências são conservadas na área de origem para, depois da aprovação, virarem dependências entre OPs.

## Antes de criar qualquer OP

1. Fazer backup integral e verificar a restauração em ambiente controlado.
2. Conferir e aprovar os mapeamentos referência/cidade → projeto existente.
3. Revisar tarefas sem referência/cidade ou sem classificação.
4. Executar a criação das OPs faltantes em lote controlado, sem substituir OPs, APs ou datas reais existentes.
