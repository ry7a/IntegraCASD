"""Anonimiza a carga das movimentações para o ambiente de homologação ([Padrões.NF001]).

Valores, datas, categorias, centros de custo, códigos, nomes de projeto e objetos de contrato são
dados do CASD, não de pessoas: ficam como na planilha. Muda só o que pode identificar alguém:

- as descrições (texto livre, que cita fornecedores, funcionárias e quem pagou) viram uma descrição
  neutra montada da projetização; o número da NF, quando havia, continua;
- os pagamentos às funcionárias são somados por mês ("Folha das funcionárias de MM/AAAA"), para o
  salário de cada uma não aparecer;
- a contraparte de contrato com mais de uma parte no rótulo (pode ser pessoa física) vira
  "Contratada do contrato <código>".

Recebe a Carga de carregar_movimentacoes.ler_planilha e devolve outra, sem alterar a recebida.
"""

import dataclasses

from anonimizar import literal_sql
from regras_movimentacoes import CATEGORIA_DAS_FUNCIONARIAS, descricao_neutra, numero_de_nf, so_numero_de_nf

TAMANHO_MINIMO_PARA_A_TRAVA = 4  # textos muito curtos ("Pix", "x") aparecem por acaso em qualquer SQL


def e_da_folha(l) -> bool:
    return l.tipo == "SAIDA" and l.rotulo.tipo == "ADMINISTRATIVO" and l.categoria == CATEGORIA_DAS_FUNCIONARIAS


def mes_e_ano(data: str) -> str:
    """"2026-01-20" -> "01/2026"."""
    return f"{data[5:7]}/{data[:4]}"


def descricao_anonima(l) -> str:
    if l.conta == "APLICACAO":
        return f"Rendimento de {mes_e_ano(l.data)}"
    if l.tipo == "ENTRADA":
        return l.categoria
    neutra = descricao_neutra(l.rotulo, l.categoria)
    nota = numero_de_nf(l.descricao)
    return f"{neutra} (NF {nota})" if nota else neutra


def folhas_por_mes(lancamentos: list) -> list:
    """Um lançamento por mês com a soma dos pagamentos às funcionárias, na última data do mês entre eles."""
    por_mes: dict[str, list] = {}
    for l in lancamentos:
        if e_da_folha(l):
            por_mes.setdefault(l.data[:7], []).append(l)
    folhas = []
    for mes, lista in sorted(por_mes.items()):
        ultimo = max(lista, key=lambda l: l.data)
        folhas.append(dataclasses.replace(
            ultimo, linha=0, valor_centavos=sum(l.valor_centavos for l in lista),
            descricao=f"Folha das funcionárias de {mes_e_ano(ultimo.data)}",
        ))
    return folhas


def anonimizar(carga):
    lancamentos = [dataclasses.replace(l, linha=0, descricao=descricao_anonima(l))
                   for l in carga.lancamentos if not e_da_folha(l)]
    lancamentos += folhas_por_mes(carga.lancamentos)
    lancamentos.sort(key=lambda l: l.data)
    contratos = [
        dataclasses.replace(c, contraparte=f"Contratada do contrato {c.codigo}") if c.contraparte != c.objeto else c
        for c in carga.contratos
    ]
    return dataclasses.replace(carga, lancamentos=lancamentos, contratos=contratos, pendencias=[])


def meses_com_um_pagamento_de_funcionaria(carga) -> list[str]:
    """Meses ("AAAA-MM") em que a folha somada seria um pagamento só: aí a soma é o próprio pagamento."""
    contagem: dict[str, int] = {}
    for l in carga.lancamentos:
        if e_da_folha(l):
            contagem[l.data[:7]] = contagem.get(l.data[:7], 0) + 1
    return sorted(mes for mes, quantidade in contagem.items() if quantidade == 1)


def textos_pessoais_no_sql(sql: str, original, anonima) -> dict[str, int]:
    """Trava: quantas descrições originais e contrapartes trocadas aparecem no SQL (como literal SQL).

    Ignora o texto que a carga anônima também grava de propósito (uma descrição original "Impostos"
    é igual à categoria). Devolve só contagens, nunca os textos.
    """
    mantidos = {l.descricao for l in anonima.lancamentos}
    mantidos |= {l.categoria for l in anonima.lancamentos}
    mantidos |= set(anonima.centros)
    mantidos |= {p.nome for p in anonima.projetos}
    mantidos |= {c.objeto for c in anonima.contratos}

    def aparece(texto: str) -> bool:
        return (len(texto) >= TAMANHO_MINIMO_PARA_A_TRAVA and texto not in mantidos
                and literal_sql(texto) in sql)

    descricoes = {l.descricao for l in original.lancamentos if l.descricao and not so_numero_de_nf(l.descricao)}
    contrapartes = {c.contraparte for c in original.contratos if c.contraparte != c.objeto}
    return {
        "descricao": sum(1 for texto in descricoes if aparece(texto)),
        "contraparte": sum(1 for texto in contrapartes if aparece(texto)),
    }
