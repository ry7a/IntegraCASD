"""Anonimiza os alunos da carga inicial para o ambiente de homologação ([Padrões.NF001]).

Trocar só o nome, o CPF e o e-mail não basta: quem conhece o H8 reconhece o aluno pela vaga, pela
turma e pelo curso, e veria os débitos dele. Por isso, além de trocar os identificadores, este módulo
embaralha os débitos entre alunos da mesma turma e as vagas entre os alunos ativos (e, à parte, entre
os inativos). Os totais, a inadimplência por turma e a ocupação do H8 continuam iguais aos da planilha,
mas nenhum aluno fictício corresponde a uma pessoa real.

O módulo não conhece a planilha nem o banco: recebe os alunos já normalizados por
carregar_alunos.normalizar e devolve uma lista nova, sem alterar a recebida.
"""

import dataclasses
import random
from collections import Counter

import regras

# Nomes comuns, sem apóstrofo (o SQL dobraria a aspa, e a trava procura o nome real como literal SQL).
PRIMEIROS_NOMES = [
    "Ana", "Beatriz", "Bruna", "Camila", "Carolina", "Fernanda", "Gabriela", "Isabela", "Júlia", "Larissa",
    "Letícia", "Mariana", "Natália", "Rafaela", "Sofia", "André", "Bruno", "Caio", "Daniel", "Eduardo",
    "Felipe", "Gabriel", "Gustavo", "Henrique", "João", "Lucas", "Mateus", "Pedro", "Rafael", "Thiago",
]
SOBRENOMES = [
    "Almeida", "Alves", "Andrade", "Barbosa", "Cardoso", "Carvalho", "Castro", "Correia", "Costa", "Dias",
    "Duarte", "Fernandes", "Ferreira", "Freitas", "Gomes", "Lima", "Lopes", "Machado", "Martins", "Melo",
    "Mendes", "Moreira", "Nogueira", "Oliveira", "Pereira", "Ramos", "Ribeiro", "Rocha", "Santos", "Teixeira",
]
DOMINIO_DOS_EMAILS = "exemplo.com"  # o mesmo do apps/api/prisma/dados-ficticios.sql
MENOR_MATRICULA = 100000
MAIOR_MATRICULA = 999999
# Menor grupo em que embaralhar esconde alguém. Turma menor é embaralhada junto com as outras pequenas;
# grupo de vagas menor fica sem vaga.
MINIMO_DO_GRUPO = 5
GRUPO_DOS_PEQUENOS = ("grupos pequenos",)  # chave que não coincide com o nome de nenhuma turma


def cpf_ficticio(gerador: random.Random, valido: bool) -> str:
    """CPF de 11 dígitos sorteado. Com `valido`, passa na conta dos dígitos verificadores;
    sem, tem o último dígito errado (como os CPFs inválidos da planilha, que viram cadastro incompleto)."""
    while True:
        base = "".join(str(gerador.randint(0, 9)) for _ in range(9))
        # Procura os dois dígitos verificadores com a mesma conta que a carga usa (regras.cpf_valido).
        numero = next((base + f"{final:02d}" for final in range(100) if regras.cpf_valido(base + f"{final:02d}")), None)
        if numero is None:
            continue  # só acontece com os nove dígitos iguais, que nunca formam CPF válido
        if valido:
            return numero
        return numero[:10] + str((int(numero[10]) + 1) % 10)


def juntar_grupos_pequenos(grupos: list, minimo: int) -> list:
    """Embaralhar dentro de um grupo de 1 ou 2 alunos não esconde ninguém: os grupos com menos de
    `minimo` membros são embaralhados juntos. Se nem juntos chegam ao mínimo, vão para o maior grupo."""
    tamanhos = Counter(grupos)
    pequenos = {grupo for grupo, tamanho in tamanhos.items() if tamanho < minimo}
    if not pequenos:
        return list(grupos)
    destino = GRUPO_DOS_PEQUENOS
    grandes = [grupo for grupo in tamanhos if grupo not in pequenos]
    if sum(tamanhos[grupo] for grupo in pequenos) < minimo and grandes:
        destino = max(grandes, key=lambda grupo: tamanhos[grupo])
    return [destino if grupo in pequenos else grupo for grupo in grupos]


def embaralhar_dentro_dos_grupos(valores: list, grupos: list, gerador: random.Random) -> list:
    """Embaralha `valores` só entre posições do mesmo grupo: valores[i] pertence ao grupo grupos[i].
    Devolve uma lista nova; a recebida não muda."""
    posicoes_por_grupo: dict = {}
    for posicao, grupo in enumerate(grupos):
        posicoes_por_grupo.setdefault(grupo, []).append(posicao)
    resultado = list(valores)
    for posicoes in posicoes_por_grupo.values():
        sorteados = [valores[p] for p in posicoes]
        gerador.shuffle(sorteados)
        for posicao, valor in zip(posicoes, sorteados):
            resultado[posicao] = valor
    return resultado


def literal_sql(texto: str) -> str:
    """Texto como aparece no SQL gerado: entre aspas simples, com a aspa dobrada (mesma regra de
    carregar_alunos.sql_texto, repetida aqui porque este módulo não pode importar aquele)."""
    return "'" + texto.replace("'", "''") + "'"


def dados_reais_no_sql(sql: str, reais: list) -> dict[str, int]:
    """Trava da carga anonimizada: quantos alunos têm algum dado pessoal real no texto do SQL, por campo.

    Procura cada valor na forma em que o SQL o escreveria (literal entre aspas; a matrícula, na
    condição `matricula = N)`). Devolve só contagens, nunca os valores: o terminal não pode mostrar
    dado real.
    """
    achados = {"nome": 0, "cpf": 0, "email": 0, "celular": 0, "apelido": 0, "matricula": 0}
    for a in reais:
        for campo in ("nome", "cpf", "email", "celular", "apelido"):
            valor = getattr(a, campo)
            if valor and literal_sql(valor) in sql:
                achados[campo] += 1
        if a.matricula is not None and f"matricula = {a.matricula})" in sql:
            achados["matricula"] += 1
    return achados


def anonimizar(alunos: list, gerador: random.Random) -> list:
    """Lista nova de alunos fictícios com a mesma "cara" dos recebidos (ver a docstring do módulo).

    - nome, CPF, e-mail e matrícula fictícios, nunca iguais a um valor recebido; celular e apelido em branco;
    - cadastro incompleto continua incompleto (e-mail vazio continua vazio; CPF inválido continua inválido);
    - turma, curso, posto e situação ficam com o aluno; débitos e vagas são embaralhados;
    - a ordem da lista é embaralhada e `linha` vira 0 (não aponta mais para a planilha).
    """
    nomes_reais = {a.nome for a in alunos}
    cpfs_usados = {a.cpf for a in alunos}
    emails_reais = {a.email for a in alunos}
    matriculas_usadas = {a.matricula for a in alunos}

    turmas = juntar_grupos_pequenos([a.turma for a in alunos], MINIMO_DO_GRUPO)
    debitos = embaralhar_dentro_dos_grupos([a.debitos for a in alunos], turmas, gerador)
    # Vaga de ativo só vai para ativo: o banco recusa dois alunos ativos na mesma vaga. Por isso o grupo
    # pequeno de vagas não pode se juntar a outro: a vaga dele fica em branco.
    grupos_de_vaga = [(a.ativo, a.alojamento is not None) for a in alunos]
    tamanhos = Counter(grupos_de_vaga)
    vagas = embaralhar_dentro_dos_grupos([a.alojamento for a in alunos], grupos_de_vaga, gerador)
    vagas = [None if tamanhos[grupo] < MINIMO_DO_GRUPO else vaga for vaga, grupo in zip(vagas, grupos_de_vaga)]

    sem_email = []  # (aluno fictício ainda sem e-mail, usuário do e-mail ou None se o cadastro não tem e-mail)
    for posicao, a in enumerate(alunos):
        nome = None
        while nome is None or nome in nomes_reais:
            primeiro = gerador.choice(PRIMEIROS_NOMES)
            sobrenome_do_meio, ultimo_sobrenome = gerador.sample(SOBRENOMES, 2)
            nome = f"{primeiro} {sobrenome_do_meio} {ultimo_sobrenome}"

        cpf = None
        while cpf is None or cpf in cpfs_usados:
            cpf = cpf_ficticio(gerador, valido=regras.cpf_valido(a.cpf))
        cpfs_usados.add(cpf)

        usuario = None
        if a.email != "":
            usuario = regras.sem_acento(f"{primeiro}.{ultimo_sobrenome}").lower()

        matricula = None
        if a.matricula is not None:
            while matricula is None or matricula in matriculas_usadas:
                matricula = gerador.randint(MENOR_MATRICULA, MAIOR_MATRICULA)
            matriculas_usadas.add(matricula)

        sem_email.append((dataclasses.replace(
            a, linha=0, nome=nome, cpf=cpf, email="", celular=None, apelido=None,
            matricula=matricula, alojamento=vagas[posicao], debitos=list(debitos[posicao]),
        ), usuario))

    # Embaralha antes de numerar os e-mails: numerados na ordem de entrada, os números devolveriam
    # a ordem da planilha. O número no fim garante e-mails diferentes mesmo com nomes iguais.
    gerador.shuffle(sem_email)
    anonimos = []
    for numero, (aluno, usuario) in enumerate(sem_email, start=1):
        if usuario is not None:
            email = f"{usuario}.{numero}@{DOMINIO_DOS_EMAILS}"
            if email in emails_reais:
                raise ValueError("e-mail fictício igual a um real: o domínio de exemplo foi usado na planilha?")
            aluno = dataclasses.replace(aluno, email=email)
        anonimos.append(aluno)
    return anonimos
