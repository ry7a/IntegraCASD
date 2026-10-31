"""Regras de normalização da carga inicial dos alunos ([Distribuição.NF002]).

Cada função recebe o valor como veio da planilha (texto, número ou None) e devolve
o valor no formato do banco. Quando não dá para aproveitar o valor, a função lança
`ValorInvalido` com uma mensagem que vai para o relatório de pendências.

As regras seguem as do backend (apps/api/src/modulos/cadastros/dominio/aluno.ts e
comum.ts): o que a carga grava precisa passar na tela de edição depois.

Só funções puras: sem planilha e sem banco, para poderem ser testadas sozinhas
(test_regras.py).
"""

import re
import unicodedata


class ValorInvalido(Exception):
    """O valor da planilha não pôde ser aproveitado; a mensagem diz por quê."""


# ---------------------------------------------------------------------------
# Auxiliares
# ---------------------------------------------------------------------------


def texto(valor) -> str | None:
    """Texto livre: tira espaços das pontas e repetidos no meio. Vazio vira None.

    Igual à função `texto` do backend. Números viram texto sem o ".0" que o Excel
    acrescenta (o apelido "10" chega como 10.0).
    """
    if valor is None:
        return None
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    limpo = re.sub(r"\s+", " ", str(valor)).strip()
    return limpo or None


def sem_acento(valor: str) -> str:
    """'Intercâmbio' -> 'Intercambio'. Usado só para comparar, nunca para gravar."""
    decomposto = unicodedata.normalize("NFD", valor)
    return "".join(c for c in decomposto if unicodedata.category(c) != "Mn")


def digitos(valor) -> str:
    """Só os dígitos. Número do Excel (12345678909.0) vira '12345678909'."""
    if valor is None:
        return ""
    if isinstance(valor, float):
        valor = int(valor)
    return re.sub(r"\D", "", str(valor))


# ---------------------------------------------------------------------------
# Campos do aluno
# ---------------------------------------------------------------------------


def nome(valor) -> str:
    resultado = texto(valor)
    if resultado is None or len(resultado) < 3:
        raise ValorInvalido("nome vazio ou com menos de 3 letras")
    if len(resultado) > 120:
        raise ValorInvalido("nome com mais de 120 caracteres")
    return resultado


def cpf_valido(numeros: str) -> bool:
    """Confere os dois dígitos verificadores. Mesma conta do `cpfValido` do backend."""
    if not re.fullmatch(r"\d{11}", numeros) or len(set(numeros)) == 1:
        return False
    lista = [int(d) for d in numeros]

    def digito(quantidade: int) -> int:
        soma = sum(lista[i] * (quantidade + 1 - i) for i in range(quantidade))
        resto = (soma * 10) % 11
        return 0 if resto == 10 else resto

    return digito(9) == lista[9] and digito(10) == lista[10]


def cpf(valor) -> str:
    """CPF com 11 dígitos. A planilha perdeu os zeros à esquerda: eles são repostos.

    Não confere os dígitos verificadores: um CPF com 11 números mas inválido ainda
    entra no banco, como cadastro incompleto (ver `cadastroIncompleto` no backend).
    Quem chama usa `cpf_valido` para anotar a pendência.
    """
    numeros = digitos(valor)
    if numeros == "":
        raise ValorInvalido("CPF vazio")
    if len(numeros) > 11:
        raise ValorInvalido("CPF com mais de 11 números")
    return numeros.zfill(11)


def email(valor) -> str | None:
    """E-mail em minúsculas. None quando vazio ou fora do formato nome@dominio.com."""
    resultado = (texto(valor) or "").lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", resultado):
        return None
    return resultado


def celular(valor) -> str | None:
    """Celular com DDD, só os dígitos (10 ou 11). Aceita DDD com zero: (012)."""
    if texto(valor) is None:
        return None
    numeros = digitos(valor)
    if len(numeros) == 12 and numeros.startswith("0"):
        numeros = numeros[1:]
    if len(numeros) not in (10, 11):
        raise ValorInvalido("celular sem DDD ou com quantidade de números errada")
    return numeros


def apelido(valor) -> str | None:
    resultado = texto(valor)
    if resultado is not None and len(resultado) > 40:
        raise ValorInvalido("apelido com mais de 40 caracteres")
    return resultado


def matricula(valor) -> int | None:
    if texto(valor) is None:
        return None
    numeros = digitos(valor)
    if numeros == "" or int(numeros) <= 0:
        raise ValorInvalido("matrícula não é um número inteiro positivo")
    return int(numeros)


def turma(valor) -> str | None:
    """Ano de formatura (2028, "2028'") vira o nome da turma no sistema: "T28"."""
    if texto(valor) is None:
        return None
    achado = re.search(r"(20\d{2})", digitos(valor))
    if achado is None:
        raise ValorInvalido("turma não é um ano de formatura (ex.: 2028)")
    return "T" + achado.group(1)[2:]


# Curso como aparece depois do ano ("1º Comp" -> "comp"). Vazio e "Fund" (os dois
# primeiros anos, o Fundamental) ainda não têm curso: ficam sem curso, sem pendência.
CURSOS = {
    "aer": "AER",
    "ele": "ELE",
    "mec": "MEC",
    "civ": "CIV",
    "civil": "CIV",
    "comp": "COMP",
    "aesp": "AESP",
}


def curso(valor) -> str | None:
    bruto = texto(valor)
    if bruto is None:
        return None
    # Tira o ano e marcas na frente: "*1º Aesp" -> "aesp".
    chave = re.sub(r"^[^A-Za-z]*", "", sem_acento(bruto)).strip().lower()
    if chave in ("", "fund"):
        return None
    if chave not in CURSOS:
        raise ValorInvalido("curso fora da lista (AER, ELE, MEC, CIV, COMP, AESP)")
    return CURSOS[chave]


# Posto sem espaços, pontos e caixa: "Asp OF" -> "aspof".
POSTOS = {
    "almil": "ALUNO_MILITAR",
    "aspof": "ASP_OF",
    "asp": "ASP_OF",
}


def posto(valor) -> str | None:
    """Vazio fica sem posto. A planilha não diz se vazio é civil: não supomos."""
    bruto = texto(valor)
    if bruto is None:
        return None
    chave = re.sub(r"[\s.]", "", sem_acento(bruto)).lower()
    if chave not in POSTOS:
        raise ValorInvalido("posto fora da lista (civil, aluno militar, aspirante)")
    return POSTOS[chave]


def alojamento(aloj, apto, vaga) -> tuple[str, str, str] | None:
    """Vaga do H8: ('A', '105', 'C') a partir de ALOJ 'H-8A', APTO 105 e VAGA 'C'.

    Os três juntos ou nenhum, como no backend.
    """
    partes = [texto(aloj), texto(apto), texto(vaga)]
    if all(parte is None for parte in partes):
        return None
    if any(parte is None for parte in partes):
        raise ValorInvalido("alojamento incompleto: precisa de bloco, apartamento e vaga")
    achado = re.fullmatch(r"H-?8\s*-?\s*([A-Za-z])", partes[0])
    if achado is None:
        raise ValorInvalido("bloco fora do formato H-8A")
    bloco = achado.group(1).upper()
    numero_apto = partes[1].upper()
    letra_vaga = partes[2].upper()
    if len(numero_apto) > 10 or len(letra_vaga) > 10:
        raise ValorInvalido("apartamento ou vaga com mais de 10 caracteres")
    return (bloco, numero_apto, letra_vaga)


# Decisão da equipe (30/10/2026): ficam ativos (entram na cobrança recorrente) os
# matriculados e quem está na aba sem situação preenchida. Trancado, Intercâmbio,
# Desligado, Suspenso e "Fora do H8" ficam inativos.
SITUACOES_ATIVAS = {"matriculado", "matriculada"}


def ativo(situacao) -> bool:
    bruto = texto(situacao)
    if bruto is None:
        return True
    return sem_acento(bruto).lower() in SITUACOES_ATIVAS
