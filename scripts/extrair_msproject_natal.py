#!/usr/bin/env python3
"""Gera a pré-importação auditável a partir do .MPP original.

Uso:
  python scripts/extrair_msproject_natal.py "C:\\...\\Natal 2026 v21.mpp" \
    "C:\\...\\natal-2026-v21.pre-importacao.json"

Dependência de operação (fora do aplicativo web): MPXJ com o leitor MPP.
O resultado contém somente tarefas-folha e não escreve no Supabase.
"""

import hashlib
import json
import sys
from pathlib import Path

try:
    import jpype
    import mpxj
    from jpype import JClass
except ImportError as error:
    raise SystemExit(
        "MPXJ não está disponível. Instale o runtime de extração antes de executar este script."
    ) from error

if not jpype.isJVMStarted():
    jpype.startJVM()

MPPReader = JClass("org.mpxj.mpp.MPPReader")


def texto(valor):
    if valor is None:
        return None
    resultado = str(valor).strip()
    return resultado or None


def data_iso(valor):
    if valor is None:
        return None
    # O MPP fornece LocalDateTime, sem offset. O Project de origem opera em
    # America/Sao_Paulo (UTC-03 em 2026); registrar o offset evita que a
    # conversão para TIMESTAMPTZ desloque o cronograma para outro dia.
    return f"{valor}-03:00"


def minutos_duracao(valor):
    if valor is None:
        return None
    try:
        return round(float(valor.getDuration()) * 60)
    except (AttributeError, TypeError, ValueError):
        return None


def predecessoras(tarefa):
    resultado = []
    for relacao in tarefa.getPredecessors():
        predecessora = relacao.getPredecessorTask()
        if predecessora is None or predecessora.getUniqueID() is None:
            continue
        resultado.append(
            {
                "uid_origem": int(predecessora.getUniqueID()),
                "tipo": texto(relacao.getType()),
                "defasagem_minutos": minutos_duracao(relacao.getLag()),
            }
        )
    return resultado


def caminho_e_contexto(tarefa):
    caminho = []
    referencia = None
    cidade = None
    grupo = None
    atual = tarefa.getParentTask()
    while atual is not None:
        nome = texto(atual.getName())
        if nome:
            caminho.append(nome)
            grupo = grupo or nome
        # A API do MPXJ recebe aqui o índice do campo Text (1..30), não o
        # valor interno do enum TaskField.
        referencia = referencia or texto(atual.getText(3))
        cidade = cidade or texto(atual.getText(1))
        atual = atual.getParentTask()
    caminho.reverse()
    return caminho, referencia, cidade, grupo


def classificar_etapa(nome, caminho):
    texto_base = " ".join([nome, *caminho]).lower()
    if any(palavra in texto_base for palavra in ("desmonte", "desmontagem", "recolher", "retorno", "reintegr")):
        return 5, "Desmontagem, retorno ou reintegração identificados no cronograma do Project."
    if "manuten" in texto_base or "montagem in loco" in texto_base:
        return 4, "Manutenção ou montagem em campo identificada no cronograma do Project."
    if any(
        palavra in texto_base
        for palavra in (
            "pintura",
            "stain",
            "anti-chamas",
            "antichamas",
            "pisca",
            "ilumina",
            "led",
            "embalag",
            "frete",
            "carregar",
            "descarregar",
            "logística",
            "logistica",
            "teste",
        )
    ):
        return 3, "Acabamento, iluminação, teste, embalagem ou logística identificados."
    if any(
        palavra in texto_base
        for palavra in (
            "fábrica",
            "fabrica",
            "serralher",
            "bambu",
            "madeirite",
            "estrutur",
            "produzir",
            "tramar",
            "cortar",
        )
    ):
        return 2, "Fabricação ou estrutura identificada no cronograma do Project."
    return None, "Classificação pendente de revisão humana."


def tarefa_normalizada(tarefa):
    caminho, referencia, cidade, grupo = caminho_e_contexto(tarefa)
    etapa, justificativa = classificar_etapa(str(tarefa.getName()), caminho)
    pai = tarefa.getParentTask()
    return {
        "uid_origem": int(tarefa.getUniqueID()),
        "uid_pai_origem": int(pai.getUniqueID()) if pai and pai.getUniqueID() is not None else None,
        "nivel_estrutura": int(tarefa.getOutlineLevel()),
        "caminho_estrutura": caminho,
        "nome": str(tarefa.getName()).strip(),
        "referencia_msproject": referencia,
        "cidade_msproject": cidade,
        "grupo_origem": grupo,
        "inicio_planejado_original": data_iso(tarefa.getStart()),
        "fim_planejado_original": data_iso(tarefa.getFinish()),
        "duracao_minutos_origem": minutos_duracao(tarefa.getDuration()),
        "marco": bool(tarefa.getMilestone()),
        "percentual_concluido_origem": float(tarefa.getPercentageComplete() or 0),
        "inicio_real_origem": data_iso(tarefa.getActualStart()),
        "fim_real_origem": data_iso(tarefa.getActualFinish()),
        "predecessoras_origem": predecessoras(tarefa),
        "etapa_sugerida": etapa,
        "justificativa_etapa_sugerida": justificativa,
    }


def main(arquivo_entrada, arquivo_saida):
    origem = Path(arquivo_entrada).expanduser().resolve()
    destino = Path(arquivo_saida).expanduser().resolve()
    if not origem.is_file():
        raise SystemExit(f"Arquivo Project não encontrado: {origem}")

    projeto = MPPReader().read(str(origem))
    tarefas = []
    for tarefa in projeto.getTasks():
        if tarefa.getSummary() or not texto(tarefa.getName()):
            continue
        if tarefa.getStart() is None or tarefa.getFinish() is None:
            continue
        tarefas.append(tarefa_normalizada(tarefa))

    if not tarefas:
        raise SystemExit("Nenhuma tarefa-folha com período planejado foi encontrada no Project.")

    payload = {
        "schema_version": 1,
        "arquivo_nome": origem.name,
        "versao_origem": "Microsoft Project — snapshot do plano original",
        "fuso_horario_origem": "America/Sao_Paulo",
        "inicio_planejado_original": min(tarefa["inicio_planejado_original"] for tarefa in tarefas),
        "fim_planejado_original": max(tarefa["fim_planejado_original"] for tarefa in tarefas),
        "arquivo_origem_sha256": hashlib.sha256(origem.read_bytes()).hexdigest(),
        "tarefas": tarefas,
    }
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Pré-importação criada: {destino} ({len(tarefas)} tarefas-folha)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Uso: extrair_msproject_natal.py <arquivo.mpp> <saida.json>")
    main(sys.argv[1], sys.argv[2])
