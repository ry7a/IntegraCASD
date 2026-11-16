"""Regras da carga das movimentações: como cada texto da planilha do Fundo de Manutenção vira dado.

Segue a tabela "Da planilha para o modelo" do docs/arquitetura/mer-financeiro.md. A coluna
"Projetização" das saídas diz a que a despesa pertence:

    26C001 - Contraparte - Objeto   contrato (ano + C + sequência)
    25P013 - Nome do projeto        projeto (ano + P + sequência; o formato antigo 23Z005 também é projeto)
    Z - Jardins                     centro de custo da zeladoria
    A - Impostos                    administrativo: vira só a categoria "Impostos"

Funções puras: não leem a planilha nem falam com o banco, para poderem ser testadas sozinhas.
"""

import re
from dataclasses import dataclass

CATEGORIA_SEM_CLASSIFICACAO = "Outros"
CATEGORIA_DAS_FUNCIONARIAS = "Funcionárias"  # de "A - Funcionárias"; o MER pede vínculo com funcionário
MESES_PARA_SER_MENSAL = 6  # contrato pago em 6 meses ou mais do ano é tratado como mensal

_CODIGO = re.compile(r"^(\d{2})([CPZ])(\d{3})\s*-\s*(.*)$")
_PREFIXO = re.compile(r"^([ZA])\s*-\s*(.+)$")
_SEPARADOR = re.compile(r"\s+-\s+")
# "NF 685", "nf: 1234", "Nota Fiscal nº 77", "NF-e 3456"
_NF = r"(?:NF(?:-?e)?|Nota\s+Fiscal)\b\s*(?:n[º°o]\.?)?\s*[:\-#]?\s*"
_NUMERO_DE_NF = re.compile(r"\b" + _NF + r"(\d+)", re.IGNORECASE)
_SO_NF = re.compile(r"^" + _NF + r"[\d./-]+$", re.IGNORECASE)


@dataclass(frozen=True)
class Rotulo:
    """A projetização de uma saída, já separada. `partes` são os textos depois do código ou do prefixo."""
    tipo: str  # CONTRATO, PROJETO, CENTRO, ADMINISTRATIVO ou NENHUM
    codigo: str | None
    partes: tuple[str, ...]
    reconhecido: bool  # False quando havia texto, mas fora dos formatos conhecidos


def _texto(valor) -> str:
    return "" if valor is None else " ".join(str(valor).split())


def _dividir(resto: str) -> tuple[str, ...]:
    partes = (parte.strip(" _") for parte in _SEPARADOR.split(resto))
    return tuple(parte for parte in partes if parte)


def rotulo(valor) -> Rotulo:
    texto = _texto(valor)
    if texto == "":
        return Rotulo("NENHUM", None, (), True)
    codigo = _CODIGO.match(texto)
    if codigo:
        ano, letra, sequencia, resto = codigo.groups()
        tipo = "CONTRATO" if letra == "C" else "PROJETO"
        return Rotulo(tipo, f"{ano}{letra}{sequencia}", _dividir(resto), True)
    prefixo = _PREFIXO.match(texto)
    if prefixo:
        letra, resto = prefixo.groups()
        tipo = "CENTRO" if letra == "Z" else "ADMINISTRATIVO"
        return Rotulo(tipo, None, _dividir(resto), True)
    return Rotulo("NENHUM", None, (texto,), False)


def nome_do_rotulo(r: Rotulo) -> str:
    """Nome do projeto, do centro de custo ou da categoria administrativa."""
    return " - ".join(r.partes) or (r.codigo or "")


def contraparte_e_objeto(r: Rotulo) -> tuple[str, str]:
    """Com duas partes ou mais, a primeira é a contraparte e o resto é o objeto.
    Com uma parte só, ela serve para as duas coisas."""
    if not r.partes:
        sem_texto = f"Contrato {r.codigo}"
        return sem_texto, sem_texto
    if len(r.partes) == 1:
        return r.partes[0], r.partes[0]
    return r.partes[0], " - ".join(r.partes[1:])


def categoria_da_saida(r: Rotulo, coluna) -> str:
    """Administrativo (A - X) vira a categoria X (decisão 4 do MER); o resto usa a coluna Categoria."""
    if r.tipo == "ADMINISTRATIVO":
        return nome_do_rotulo(r)
    return _texto(coluna) or CATEGORIA_SEM_CLASSIFICACAO


def numero_de_nf(descricao) -> str | None:
    achado = _NUMERO_DE_NF.search(_texto(descricao))
    return achado.group(1) if achado else None


def so_numero_de_nf(descricao) -> bool:
    """A descrição é só o número da nota ("NF 685")? Esse texto não identifica ninguém."""
    return bool(_SO_NF.match(_texto(descricao)))


def descricao_neutra(r: Rotulo, categoria: str) -> str:
    """Descrição montada só com o que a planilha diz da despesa, sem o texto livre (que pode ter nomes)."""
    if r.tipo == "CONTRATO":
        return f"Pagamento do contrato {r.codigo}"
    if r.tipo == "PROJETO":
        return f"Despesa do projeto {r.codigo}"
    if r.tipo == "CENTRO":
        return f"Zeladoria: {nome_do_rotulo(r)}"
    if r.tipo == "ADMINISTRATIVO":
        return categoria
    return "Lançamento sem projetização"


def periodicidade(meses_com_pagamento: int) -> str:
    return "MENSAL" if meses_com_pagamento >= MESES_PARA_SER_MENSAL else "POR_DEMANDA"


def mediana_centavos(valores: list[int]) -> int:
    """Mediana em centavos, só com inteiros: com quantidade par, a média (para baixo) dos dois do meio."""
    if not valores:
        raise ValueError("mediana de uma lista vazia")
    ordenados = sorted(valores)
    meio = len(ordenados) // 2
    if len(ordenados) % 2 == 1:
        return ordenados[meio]
    return (ordenados[meio - 1] + ordenados[meio]) // 2
