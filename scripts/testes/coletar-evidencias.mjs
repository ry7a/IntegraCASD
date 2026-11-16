// Plano de Testes v1.2 (roteiro em docs/testes/roteiro-de-execucao.md): roda as fases automáticas, guarda a saída
// de cada uma como evidência e monta o RESULTADOS.md com o resultado dos 33 casos e o critério de aceite.
//
// Uso (na raiz, com o Docker Desktop ligado):
//   pnpm evidencias                          E00 a E07 numa pasta nova de docs/testes/evidencias (uns 20 min)
//   pnpm evidencias -- --rascunho            o mesmo, aceitando mudanças não commitadas (não vale como evidência)
//   pnpm evidencias -- --fechar <pasta>      depois das fases manuais: refaz o RESULTADOS.md, procura segredos e
//                                            grava o MANIFESTO-sha256.txt
//   pnpm evidencias -- --conferir <pasta>    confere cada arquivo com o manifesto (para quem audita)
//
// O script não julga as verificações manuais (prints da homologação, backup): quem confere anota o resultado em
// verificacoes-manuais.json, na pasta da execução, e o --fechar junta tudo.
import { execFileSync, execSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const PASTA_DAS_EVIDENCIAS = path.join(RAIZ, 'docs', 'testes', 'evidencias');
const EXECUCAO = 'execucao.json';
// Plano vigente: pelo qual os casos são avaliados. Uma pasta executada por um plano anterior é reavaliada por ele.
const PLANO = 'IntegraCASD_PlanoDeTestes_v1.2';
const VERIFICACOES = 'verificacoes-manuais.json';
const RESULTADOS = 'RESULTADOS.md';
const MANIFESTO = 'MANIFESTO-sha256.txt';
const RESULTADOS_VALIDOS = ['Passou', 'Falhou', 'Bloqueado'];

// Prioridade de cada requisito citado pelo plano, copiada do Documento de Requisitos v1.2
// (E = essencial, I = importante, D = desejável). A prioridade de um caso é a maior entre os requisitos dele.
const PRIORIDADE_DOS_REQUISITOS = {
  'Cadastros.RF001': 'E', 'Cadastros.RF002': 'E', 'Cadastros.RF004': 'I', 'Cadastros.RF005': 'I',
  'Cobranças.RF001': 'E', 'Cobranças.RF002': 'E', 'Cobranças.RF003': 'I', 'Cobranças.RF004': 'I',
  'Cobranças.RF005': 'E', 'Cobranças.RF006': 'I', 'Cobranças.RF007': 'I', 'Cobranças.RF008': 'E',
  'Movimentações.RF001': 'E', 'Movimentações.RF002': 'I', 'Movimentações.RF003': 'E',
  'Indicadores.RF001': 'E', 'Indicadores.RF002': 'E', 'Indicadores.RF003': 'I',
  'Administração.RF001': 'E', 'Administração.RF002': 'E', 'Administração.RF003': 'E',
  'Administração.RF004': 'E', 'Administração.RF005': 'D',
  'Usabilidade.NF001': 'I', 'Usabilidade.NF002': 'I', 'Usabilidade.NF003': 'E', 'Usabilidade.NF004': 'I',
  'Confiabilidade.NF001': 'E', 'Confiabilidade.NF002': 'E', 'Confiabilidade.NF003': 'E', 'Confiabilidade.NF004': 'E',
  'Desempenho.NF001': 'E', 'Desempenho.NF004': 'I', 'Desempenho.NF005': 'I',
  'Segurança.NF001': 'E', 'Segurança.NF002': 'E', 'Segurança.NF003': 'E', 'Segurança.NF005': 'E',
  'Segurança.NF006': 'I', 'Segurança.NF007': 'I',
  'Padrões.NF001': 'E', 'Padrões.NF003': 'D',
  'Hardware e software.NF005': 'E',
};
const NOME_DA_PRIORIDADE = { E: 'Essencial', I: 'Importante', D: 'Desejável' };

// Os 33 casos do plano (Capítulo 5). O teste automatizado de um caso é achado pelo id do caso no nome do teste
// (todo `describe` dos testes do plano cita o caso). `automatico: false`: o caso só tem roteiro manual.
// `manuais`: verificações das Seções 5 a 7 do roteiro que o caso também exige. `etapas`: fases que têm de terminar
// com código 0 para o caso passar.
const CASOS = [
  { id: 'CT-CAD-01', nome: 'Cadastro de aluno', nivel: 'I', requisitos: ['Cadastros.RF001'], manuais: ['M02'] },
  { id: 'CT-CAD-02', nome: 'Cadastro de funcionário', nivel: 'I', requisitos: ['Cadastros.RF002'] },
  { id: 'CT-CAD-03', nome: 'Contratos', nivel: 'U', requisitos: ['Cadastros.RF004'] },
  { id: 'CT-CAD-04', nome: 'Projetos', nivel: 'I', requisitos: ['Cadastros.RF005'] },
  { id: 'CT-COB-01', nome: 'Geração recorrente', nivel: 'I', requisitos: ['Cobranças.RF001'] },
  { id: 'CT-COB-02', nome: 'Emissão avulsa', nivel: 'I', requisitos: ['Cobranças.RF002'] },
  { id: 'CT-COB-03', nome: 'Boleto', nivel: 'I', requisitos: ['Cobranças.RF003'] },
  { id: 'CT-COB-04', nome: 'Cancelamento', nivel: 'I', requisitos: ['Cobranças.RF004'] },
  { id: 'CT-COB-05', nome: 'Webhook e baixa', nivel: 'S', requisitos: ['Cobranças.RF005'], manuais: ['H03'] },
  { id: 'CT-COB-06', nome: 'Pagamento manual', nivel: 'I', requisitos: ['Cobranças.RF006'] },
  { id: 'CT-COB-07', nome: 'Sincronização', nivel: 'I', requisitos: ['Cobranças.RF007'] },
  { id: 'CT-COB-08', nome: 'Consulta de cobranças', nivel: 'S', requisitos: ['Cobranças.RF008'] },
  { id: 'CT-MOV-01', nome: 'Registro de movimentação', nivel: 'I', requisitos: ['Movimentações.RF001'] },
  { id: 'CT-MOV-02', nome: 'Estorno', nivel: 'I', requisitos: ['Movimentações.RF002'] },
  { id: 'CT-MOV-03', nome: 'Consulta de movimentações', nivel: 'S', requisitos: ['Movimentações.RF003'] },
  { id: 'CT-IND-01', nome: 'Painel de indicadores', nivel: 'U', requisitos: ['Indicadores.RF001'] },
  { id: 'CT-IND-02', nome: 'Inadimplência', nivel: 'U', requisitos: ['Indicadores.RF002'] },
  { id: 'CT-IND-03', nome: 'Gastos por categoria', nivel: 'U', requisitos: ['Indicadores.RF003'] },
  { id: 'CT-ADM-01', nome: 'Usuários e permissões', nivel: 'S', requisitos: ['Administração.RF001'] },
  { id: 'CT-ADM-02', nome: 'Categorias', nivel: 'U', requisitos: ['Administração.RF002'] },
  { id: 'CT-ADM-03', nome: 'Parâmetros de cobrança', nivel: 'U', requisitos: ['Administração.RF003'] },
  { id: 'CT-ADM-04', nome: 'Chave do Asaas', nivel: 'I', requisitos: ['Administração.RF004'] },
  { id: 'CT-ADM-05', nome: 'Trilha de auditoria', nivel: 'S', requisitos: ['Administração.RF005'] },
  {
    id: 'CT-SIS-01', nome: 'Ponta a ponta no sandbox', nivel: 'S', automatico: false, manuais: ['M01'],
    requisitos: ['Cobranças.RF002', 'Cobranças.RF005', 'Indicadores.RF001'],
  },
  {
    id: 'CT-NF-01', nome: 'Usabilidade nas telas', nivel: 'S', automatico: false, manuais: ['M03'],
    requisitos: ['Usabilidade.NF001', 'Usabilidade.NF003', 'Usabilidade.NF004'],
  },
  { id: 'CT-NF-02', nome: 'Falha injetada desfaz a baixa', nivel: 'I', requisitos: ['Confiabilidade.NF004', 'Hardware e software.NF005'] },
  { id: 'CT-NF-03', nome: 'Tempo de resposta do webhook', nivel: 'S', requisitos: ['Confiabilidade.NF001', 'Desempenho.NF001'], manuais: ['H01'] },
  { id: 'CT-NF-04', nome: 'Alerta de webhook parado', nivel: 'I', requisitos: ['Confiabilidade.NF002'] },
  { id: 'CT-NF-05', nome: '1.000 alunos com 429 do Asaas', nivel: 'I', requisitos: ['Desempenho.NF004', 'Desempenho.NF005'] },
  { id: 'CT-NF-06', nome: 'Autenticação e bloqueio', nivel: 'I', requisitos: ['Segurança.NF001', 'Segurança.NF005', 'Segurança.NF007'] },
  {
    id: 'CT-NF-07', nome: 'Funções de aptidão e ganchos', nivel: 'U', etapas: ['E04'], manuais: ['I02'],
    requisitos: ['Segurança.NF003', 'Segurança.NF006', 'Padrões.NF001', 'Padrões.NF003'],
  },
  { id: 'CT-FZ-01', nome: 'Fuzzing do webhook', nivel: 'S', requisitos: ['Cobranças.RF005', 'Segurança.NF002', 'Confiabilidade.NF003'] },
  {
    id: 'CT-FZ-02', nome: 'Fuzzing de formulários e filtros', nivel: 'S',
    requisitos: ['Cadastros.RF001', 'Cobranças.RF002', 'Movimentações.RF001', 'Usabilidade.NF002'],
  },
];

// Defeitos em aberto que fazem um caso falhar mesmo com os testes automatizados passando (Seção 8 do roteiro).
// Quando o defeito for corrigido (com teste), apague a linha. Formato:
//   { caso: 'CT-XXX-NN', id: 'Dn', descricao: '<o que falta>', issue: <número> },
// O D2 (CT-COB-03, reenvio do boleto por e-mail) saiu em 15/11/2026: a v1.2 dos requisitos tirou o reenvio do MVP.
const DEFEITOS_EM_ABERTO = [];

// Verificações feitas à mão (Seções 5 a 7 do roteiro). Os arquivos de cada uma começam pelo id (ex.: M02-...png).
const VERIFICACOES_MANUAIS = [
  { id: 'H00', descricao: 'A homologação (app e worker) roda o commit testado' },
  { id: 'H01', descricao: 'Tempo de resposta do webhook na homologação' },
  { id: 'H02', descricao: 'Segurança do ambiente de homologação [Segurança.NF004]' },
  { id: 'H03', descricao: 'Webhook com token errado na homologação responde 401' },
  { id: 'M01', descricao: 'Ponta a ponta com o Asaas sandbox' },
  { id: 'M02', descricao: 'Inativar aluno com débito vencido e com débito aberto' },
  { id: 'M03', descricao: 'Usabilidade nas telas' },
  { id: 'X01', descricao: 'Sessão exploratória: totais coerentes entre cobranças, movimentações e indicadores' },
  { id: 'I01', descricao: 'Backup e restauração [Confiabilidade.NF006]' },
  { id: 'I02', descricao: 'O gancho do git barra merge com teste falhando' },
];

// ---------------------------------------------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------------------------------------------

// Data e hora locais com o fuso, ex.: "2026-11-14 09:05:12 (UTC-03:00)". O relatório é lido no Brasil; o fuso
// fica escrito para ninguém confundir com UTC.
function dataHora(data = new Date()) {
  const minutosDeFuso = -data.getTimezoneOffset();
  const local = new Date(data.getTime() + minutosDeFuso * 60_000).toISOString().slice(0, 19).replace('T', ' ');
  const sinal = minutosDeFuso >= 0 ? '+' : '-';
  const doisDigitos = (numero) => String(Math.floor(Math.abs(numero))).padStart(2, '0');
  return `${local} (UTC${sinal}${doisDigitos(minutosDeFuso / 60)}:${doisDigitos(minutosDeFuso % 60)})`;
}

// Saída de um comando curto (versões, git). Devolve o texto, ou "não disponível" se o comando falhar.
function saidaDe(comando) {
  try {
    return execSync(comando, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return 'não disponível';
  }
}

function sha256(conteudo) {
  return createHash('sha256').update(conteudo).digest('hex');
}

// Todos os arquivos da pasta (e subpastas), com caminho relativo e barra "/", em ordem alfabética.
function listarArquivos(pasta) {
  return readdirSync(pasta, { recursive: true, withFileTypes: true })
    .filter((item) => item.isFile())
    .map((item) => path.relative(pasta, path.join(item.parentPath, item.name)).split(path.sep).join('/'))
    .sort();
}

function lerJson(caminho) {
  return existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')) : null;
}

// Texto de teste (que pode vir do fuzzing, com caracteres estranhos) pronto para entrar no Markdown sem quebrar a
// formatação: caracteres de controle viram "\u0000" visível e os símbolos do Markdown são escapados.
function textoSeguro(texto) {
  return String(texto)
    .toWellFormed()
    .replace(/[\u0000-\u001f\u007f]/g, (caractere) => `\\u${caractere.charCodeAt(0).toString(16).padStart(4, '0')}`)
    .replace(/[\\`*_<>[\]|#]/g, (simbolo) => `\\${simbolo}`);
}

// Lê um arquivo de texto da evidência. A saída do Tee-Object do Windows PowerShell 5.1 é UTF-16: reconhece pelo BOM.
function lerTexto(caminho) {
  const bytes = readFileSync(caminho);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString('utf16le');
  return bytes.toString('utf8');
}

function resolverPasta(argumento) {
  if (!argumento) throw new Error('Informe a pasta da execução (ex.: 2026-11-14-4df48b4).');
  const candidatos = [path.resolve(argumento), path.join(PASTA_DAS_EVIDENCIAS, argumento)];
  const pasta = candidatos.find((candidato) => existsSync(path.join(candidato, EXECUCAO)));
  if (!pasta) throw new Error(`Não achei ${EXECUCAO} em "${argumento}" nem em docs/testes/evidencias/${argumento}.`);
  return pasta;
}

// ---------------------------------------------------------------------------------------------------------------
// Fases automáticas (E00 a E07)
// ---------------------------------------------------------------------------------------------------------------

// Roda um comando no shell, mostrando a saída no terminal e gravando a mesma saída no arquivo da evidência.
function rodar(comando, arquivo, ambiente) {
  return new Promise((resolver) => {
    const filho = spawn(comando, { cwd: RAIZ, shell: true, env: ambiente });
    const copiar = (pedaco) => {
      process.stdout.write(pedaco);
      arquivo.write(pedaco);
    };
    filho.stdout.on('data', copiar);
    filho.stderr.on('data', copiar);
    filho.on('error', (erro) => {
      arquivo.write(`\nNão foi possível rodar o comando: ${erro.message}\n`);
      resolver(1);
    });
    filho.on('close', (codigo) => resolver(codigo ?? 1));
  });
}

// Uma etapa vira um arquivo <id>-<nome>.txt com cabeçalho (o que é, commit, início), cada comando com a saída
// inteira e o código de saída, e o rodapé (fim, duração, código da etapa). É o "print" do terminal, mas em texto.
async function executarEtapa(etapa, pasta, commit, ambiente) {
  console.log(`\n=== ${etapa.id}: ${etapa.titulo} ===`);
  const arquivo = createWriteStream(path.join(pasta, etapa.arquivo), { encoding: 'utf8' });
  const inicio = new Date();
  arquivo.write(`Evidência ${etapa.id}: ${etapa.titulo}\nCommit: ${commit}\nInício: ${dataHora(inicio)}\n`);

  const comandos = [];
  for (const comando of etapa.comandos) {
    arquivo.write(`\n$ ${comando}\n`);
    console.log(`$ ${comando}`);
    const codigo = await rodar(comando, arquivo, { ...ambiente, ...etapa.ambiente });
    arquivo.write(`\n(código de saída: ${codigo})\n`);
    comandos.push({ comando, codigo });
  }
  let codigo = comandos.find((item) => item.codigo !== 0)?.codigo ?? 0;
  if (etapa.depois) {
    const conferencia = etapa.depois();
    arquivo.write(`\n${conferencia.texto}\n`);
    if (codigo === 0) codigo = conferencia.codigo;
  }

  const fim = new Date();
  const duracaoEmSegundos = Math.round((fim.getTime() - inicio.getTime()) / 1000);
  arquivo.write(`\nFim: ${dataHora(fim)}\nDuração: ${duracaoEmSegundos} s\nCódigo de saída da etapa: ${codigo}\n`);
  await new Promise((resolver) => arquivo.end(resolver));
  return { titulo: etapa.titulo, arquivo: etapa.arquivo, inicio: dataHora(inicio), fim: dataHora(fim), duracaoEmSegundos, comandos, codigo };
}

// Arquivos versionados com mudança local. A execução que vale como evidência é de um commit, sem mudanças.
function mudancasLocais() {
  return saidaDe('git status --porcelain --untracked-files=no');
}

function ambienteDaExecucao(rascunho) {
  const linhas = [
    `Sistema: ${os.type()} ${os.release()} (${os.arch()})`,
    `Node: ${process.version}`,
    `pnpm: ${saidaDe('pnpm -v')}`,
    `Vitest: ${saidaDe('pnpm --filter api exec vitest --version')}`,
    `Docker (servidor): ${saidaDe('docker version --format "{{.Server.Version}}"')}`,
    `PostgreSQL (docker compose): ${saidaDe('docker compose exec -T db postgres --version')}`,
    `Mudanças locais em arquivos versionados: ${mudancasLocais().split('\n').map((linha) => linha.trim()).join(', ') || 'nenhuma'}`,
    `Arquivos não versionados: ${saidaDe('git ls-files --others --exclude-standard --directory').split('\n').join(', ') || 'nenhum'}`,
    rascunho
      ? `PULAR_CT_NF_05: ${process.env.PULAR_CT_NF_05 === '1' ? 'definida (o CT-NF-05 não roda)' : 'não definida'}`
      : 'PULAR_CT_NF_05: ignorada (na execução que vale como evidência, o CT-NF-05 sempre roda)',
  ];
  return { texto: `Ambiente:\n${linhas.map((linha) => `  ${linha}`).join('\n')}`, codigo: 0 };
}

function etapasAutomaticas(pasta, rascunho) {
  // O Vitest roda dentro de apps/api: o caminho do relatório JSON é relativo a essa pasta.
  const relatorioJson = (arquivo) =>
    path.relative(path.join(RAIZ, 'apps', 'api'), path.join(pasta, arquivo)).split(path.sep).join('/');
  return [
    {
      id: 'E00', titulo: 'Preparação e ambiente', arquivo: 'E00-ambiente.txt',
      comandos: ['pnpm install --frozen-lockfile', 'docker compose up -d'],
      depois: () => ambienteDaExecucao(rascunho),
    },
    { id: 'E01', titulo: 'Lint', arquivo: 'E01-lint.txt', comandos: ['pnpm lint'] },
    {
      id: 'E02', titulo: 'Testes de unidade e de arquitetura', arquivo: 'E02-unidade.txt',
      comandos: [`pnpm --filter api exec vitest run --reporter=verbose --reporter=json --outputFile.json=${relatorioJson('E02-unidade.json')}`],
    },
    { id: 'E03', titulo: 'Cobertura dos testes de unidade', arquivo: 'E03-cobertura.txt', comandos: ['pnpm cobertura'] },
    { id: 'E04', titulo: 'Funções de aptidão: migrações imutáveis e cores', arquivo: 'E04-arquitetura.txt', comandos: ['pnpm verificar:arquitetura'] },
    {
      id: 'E05', titulo: 'Build, orçamento do bundle, dados fictícios e contrato OpenAPI', arquivo: 'E05-build-e-contrato.txt',
      comandos: ['pnpm build', 'pnpm verificar:build', 'pnpm verificar:contrato'],
      // Como no CI: gerar o openapi.json não conecta no banco, mas o PgBossService exige DATABASE_URL no construtor.
      ambiente: { DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://ci:ci@localhost:5432/ci' },
      // O build e o contrato não podem mudar nenhum arquivo versionado (o cliente da API tem de estar em dia).
      depois: () => {
        const mudancas = mudancasLocais();
        if (rascunho) return { texto: 'Arquivos versionados alterados: não conferido (rascunho).', codigo: 0 };
        return mudancas
          ? { texto: `Arquivos versionados alterados pelo build ou pelo contrato:\n${mudancas}`, codigo: 1 }
          : { texto: 'Arquivos versionados alterados pelo build ou pelo contrato: nenhum.', codigo: 0 };
      },
    },
    {
      id: 'E07', titulo: 'Testes de integração e de sistema com PostgreSQL real', arquivo: 'E07-integracao.txt',
      comandos: [`pnpm --filter api exec vitest run --config vitest.integracao.config.ts --reporter=verbose --reporter=json --outputFile.json=${relatorioJson('E07-integracao.json')}`],
    },
  ];
}

// E06: a execução do CI no GitHub para o mesmo commit. É a evidência que não depende da máquina de quem testou.
function coletarCI(pasta, commit) {
  let execucao = null;
  let erro = null;
  try {
    const lista = JSON.parse(execFileSync('gh', [
      'run', 'list', '--commit', commit, '--workflow', 'CI', '--limit', '1',
      '--json', 'databaseId,status,conclusion,url,headSha,event,createdAt,updatedAt',
    ], { cwd: RAIZ, encoding: 'utf8' }));
    execucao = lista[0] ?? null;
  } catch (falha) {
    erro = `gh indisponível ou sem acesso: ${falha.message.split('\n')[0]}`;
  }
  writeFileSync(path.join(pasta, 'E06-ci.json'), `${JSON.stringify({ consultadoEm: dataHora(), commit, execucao, erro }, null, 2)}\n`);
  if (execucao?.status === 'completed') {
    // O GitHub apaga o log depois de 90 dias: a cópia fica aqui.
    try {
      const log = execFileSync('gh', ['run', 'view', String(execucao.databaseId), '--log'], { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024 });
      writeFileSync(path.join(pasta, 'E06-ci-log.txt'), log);
    } catch (falha) {
      console.error(`Não consegui baixar o log do CI: ${falha.message.split('\n')[0]}`);
    }
  }
  return execucao;
}

function pastaNova(commit, rascunho) {
  const dia = dataHora().slice(0, 10);
  const base = `${dia}-${commit.slice(0, 7)}${rascunho ? '-rascunho' : ''}`;
  let nome = base;
  for (let numero = 2; existsSync(path.join(PASTA_DAS_EVIDENCIAS, nome)); numero += 1) nome = `${base}-${numero}`;
  const pasta = path.join(PASTA_DAS_EVIDENCIAS, nome);
  mkdirSync(pasta, { recursive: true });
  return pasta;
}

async function executar(rascunho) {
  const mudancas = mudancasLocais();
  if (mudancas && !rascunho) {
    throw new Error(
      `Há arquivos versionados com mudança local:\n${mudancas}\n` +
        'A execução que vale como evidência é de um commit só (regra 1 do roteiro): faça commit ou stash. ' +
        'Para só experimentar, use --rascunho.',
    );
  }
  const commit = saidaDe('git rev-parse HEAD');
  const pasta = pastaNova(commit, rascunho);
  // Branches do GitHub que já têm o commit (a linha "origin/HEAD -> origin/main" é só um apelido).
  const publicadoEm = saidaDe(`git branch -r --contains ${commit}`)
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha && linha !== 'não disponível' && !linha.includes('->'));
  const execucao = {
    plano: PLANO,
    rascunho,
    commit,
    assunto: saidaDe('git log -1 --format=%s'),
    dataDoCommit: saidaDe('git log -1 --format=%ci'),
    branch: saidaDe('git branch --show-current'),
    publicadoEm,
    executor: saidaDe('git config user.name'),
    inicio: dataHora(),
    fim: null,
    etapas: {},
  };
  console.log(`Evidências em ${path.relative(RAIZ, pasta)}`);

  // Saída sem cores (o texto fica limpo no arquivo). Fora do rascunho, o CT-NF-05 sempre roda.
  const ambiente = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
  if (!rascunho) delete ambiente.PULAR_CT_NF_05;

  for (const etapa of etapasAutomaticas(pasta, rascunho)) {
    if (etapa.id === 'E07') coletarCI(pasta, commit); // E06 antes da etapa longa: dá tempo de o CI terminar
    execucao.etapas[etapa.id] = await executarEtapa(etapa, pasta, commit, ambiente);
    writeFileSync(path.join(pasta, EXECUCAO), `${JSON.stringify(execucao, null, 2)}\n`);
    if (etapa.id === 'E00' && execucao.etapas.E00.comandos[0].codigo !== 0) {
      throw new Error('pnpm install falhou: sem as dependências, nenhuma outra fase vale. Veja o E00-ambiente.txt.');
    }
  }
  if (!rascunho) coletarCI(pasta, commit); // de novo: se o CI ainda rodava antes do E07, agora deve ter terminado
  execucao.fim = dataHora();
  writeFileSync(path.join(pasta, EXECUCAO), `${JSON.stringify(execucao, null, 2)}\n`);

  fechar(pasta);
  const relativa = path.relative(RAIZ, pasta);
  console.log(`\nPróximos passos (Seções 5 a 9 do roteiro):`);
  console.log(`  1. No PowerShell: $ev = "${relativa}"  e faça as verificações manuais salvando os arquivos nessa pasta.`);
  console.log(`  2. Anote o resultado de cada uma em ${path.join(relativa, VERIFICACOES)}.`);
  console.log(`  3. pnpm evidencias -- --fechar ${path.basename(pasta)}`);
}

// ---------------------------------------------------------------------------------------------------------------
// RESULTADOS.md
// ---------------------------------------------------------------------------------------------------------------

// Lê os relatórios JSON do Vitest (E02 e E07): a lista de testes com o nome completo e a situação de cada um.
function lerTestes(pasta) {
  const testes = [];
  const relatorios = {};
  for (const [fonte, arquivo] of [['E02', 'E02-unidade.json'], ['E07', 'E07-integracao.json']]) {
    const relatorio = lerJson(path.join(pasta, arquivo));
    relatorios[fonte] = relatorio;
    for (const arquivoDeTeste of relatorio?.testResults ?? []) {
      for (const teste of arquivoDeTeste.assertionResults) {
        testes.push({ fonte, nome: [...teste.ancestorTitles, teste.title].join(' › '), situacao: teste.status });
      }
    }
  }
  return { testes, relatorios };
}

function resumoDoRelatorio(relatorio) {
  if (!relatorio) return 'relatório JSON ausente';
  const arquivosComFalha = relatorio.testResults.filter((arquivo) => arquivo.status === 'failed').length;
  const naoRodaram = relatorio.numPendingTests + relatorio.numTodoTests;
  return [
    `${relatorio.testResults.length} arquivos${arquivosComFalha ? ` (${arquivosComFalha} com falha)` : ''}`,
    `${relatorio.numTotalTests} testes: ${relatorio.numPassedTests} passaram, ${relatorio.numFailedTests} falharam` +
      (naoRodaram ? `, ${naoRodaram} não rodaram` : ''),
  ].join('; ');
}

// "Linhas 87,31% (2913/3336)" a partir do resumo que o `pnpm cobertura` imprime.
function resumoDaCobertura(pasta) {
  const caminho = path.join(pasta, 'E03-cobertura.txt');
  if (!existsSync(caminho)) return '';
  const texto = lerTexto(caminho);
  const nomes = { Statements: 'instruções', Branches: 'ramos', Functions: 'funções', Lines: 'linhas' };
  return Object.entries(nomes)
    .map(([chave, nome]) => {
      const achado = texto.match(new RegExp(`${chave}\\s*:\\s*([\\d.]+)%\\s*\\(\\s*(\\d+)/(\\d+)\\s*\\)`));
      return achado ? `${nome} ${achado[1].replace('.', ',')}% (${achado[2]}/${achado[3]})` : null;
    })
    .filter(Boolean)
    .join(', ');
}

const ORDEM_DE_GRAVIDADE = ['Passou', 'Pendente', 'Bloqueado', 'Falhou'];
const pior = (...resultados) =>
  resultados.reduce((atual, outro) => (ORDEM_DE_GRAVIDADE.indexOf(outro) > ORDEM_DE_GRAVIDADE.indexOf(atual) ? outro : atual), 'Passou');

function prioridadeDoCaso(caso) {
  const prioridades = caso.requisitos.map((requisito) => {
    const prioridade = PRIORIDADE_DOS_REQUISITOS[requisito];
    if (!prioridade) throw new Error(`Requisito sem prioridade na tabela: ${requisito}`);
    return prioridade;
  });
  return ['E', 'I', 'D'].find((prioridade) => prioridades.includes(prioridade));
}

// Resultado de um caso: o pior entre a parte automática, as verificações manuais e os defeitos em aberto.
function avaliarCaso(caso, contexto) {
  const partes = [];
  const detalhes = [];
  const testes = contexto.testes.filter((teste) => new RegExp(`\\b${caso.id}\\b`).test(teste.nome));

  if (caso.automatico !== false) {
    const passaram = testes.filter((teste) => teste.situacao === 'passed').length;
    const falharam = testes.filter((teste) => teste.situacao === 'failed').length;
    const naoRodaram = testes.length - passaram - falharam;
    const fontes = [...new Set(testes.map((teste) => teste.fonte))].join(' + ');
    if (testes.length === 0) {
      partes.push('Bloqueado');
      detalhes.push('nenhum teste automatizado encontrado');
    } else {
      partes.push(falharam ? 'Falhou' : naoRodaram ? 'Bloqueado' : 'Passou');
      detalhes.push(
        `${passaram} de ${testes.length} testes passaram (${fontes})` +
          (falharam ? `; ${falharam} falharam` : '') +
          (naoRodaram ? `; ${naoRodaram} não rodaram` : ''),
      );
    }
  }
  for (const etapa of caso.etapas ?? []) {
    const codigo = contexto.execucao.etapas[etapa]?.codigo;
    partes.push(codigo === 0 ? 'Passou' : 'Falhou');
    detalhes.push(`${etapa} ${codigo === 0 ? 'com código 0' : `com código ${codigo ?? 'ausente'}`}`);
  }
  for (const id of manuaisDoCaso(caso)) {
    const { resultado, texto } = avaliarVerificacao(id, contexto);
    partes.push(resultado === 'Passou' || resultado === 'Falhou' || resultado === 'Bloqueado' ? resultado : 'Pendente');
    detalhes.push(texto);
  }
  for (const defeito of DEFEITOS_EM_ABERTO.filter((item) => item.caso === caso.id)) {
    partes.push('Falhou');
    detalhes.push(`defeito ${defeito.id} em aberto: ${defeito.descricao} (issue #${defeito.issue})`);
  }
  return { caso, prioridade: prioridadeDoCaso(caso), resultado: pior(...partes), detalhes, testes };
}

// Verificações feitas na homologação (H) ou nas telas dela (M) só valem se a homologação roda o commit testado:
// por isso o H00 entra em todo caso que tem uma delas.
function manuaisDoCaso(caso) {
  const manuais = caso.manuais ?? [];
  return manuais.some((id) => id.startsWith('H') || id.startsWith('M')) ? ['H00', ...manuais] : manuais;
}

// Uma verificação manual só conta com resultado anotado e ao menos um arquivo de evidência na pasta.
function avaliarVerificacao(id, contexto) {
  const anotacao = contexto.verificacoes[id] ?? {};
  const arquivos = contexto.arquivos.filter((arquivo) => arquivo.startsWith(id));
  if (!anotacao.resultado) return { resultado: 'Pendente', texto: `${id} pendente`, arquivos };
  if (!RESULTADOS_VALIDOS.includes(anotacao.resultado)) {
    return { resultado: 'Pendente', texto: `${id} com resultado inválido ("${anotacao.resultado}")`, arquivos };
  }
  if (arquivos.length === 0) return { resultado: 'Pendente', texto: `${id} anotado sem arquivo de evidência`, arquivos };
  return { resultado: anotacao.resultado, texto: `${id}: ${anotacao.resultado.toLowerCase()}`, arquivos };
}

function modeloDasVerificacoes() {
  const modelo = {
    _como_preencher:
      'Para cada verificação feita: resultado = "Passou", "Falhou" ou "Bloqueado"; responsavel = quem conferiu; ' +
      'data = AAAA-MM-DD; observacao = o que foi visto. Os arquivos ficam nesta pasta com o nome começando pelo id ' +
      '(ex.: M02-confirmacao-vencida.png). Depois rode: pnpm evidencias -- --fechar <esta pasta>',
  };
  for (const verificacao of VERIFICACOES_MANUAIS) {
    modelo[verificacao.id] = { o_que_e: verificacao.descricao, resultado: '', responsavel: '', data: '', observacao: '' };
  }
  return modelo;
}

function criterioDeAceite(avaliacoes) {
  const naoPassou = (avaliacao) => avaliacao.resultado === 'Falhou' || avaliacao.resultado === 'Bloqueado';
  const essenciais = avaliacoes.filter((avaliacao) => avaliacao.prioridade === 'E');
  const essenciaisQueNaoPassaram = essenciais.filter(naoPassou);
  const outrosQueNaoPassaram = avaliacoes.filter((avaliacao) => avaliacao.prioridade !== 'E' && naoPassou(avaliacao));
  const pendentes = avaliacoes.filter((avaliacao) => avaliacao.resultado === 'Pendente');
  const lista = (itens) => itens.map((avaliacao) => `${avaliacao.caso.id} (${avaliacao.resultado.toLowerCase()})`).join(', ');

  let veredito;
  if (essenciaisQueNaoPassaram.length) veredito = 'NÃO ACEITO: há caso de requisito essencial que não passou.';
  else if (pendentes.length) veredito = `INCOMPLETO: ${pendentes.length} caso(s) ainda dependem de verificação manual.`;
  else if (outrosQueNaoPassaram.length) veredito = 'ACEITO SÓ COM DECISÃO REGISTRADA DA EQUIPE sobre os casos importantes ou desejáveis que não passaram.';
  else veredito = 'ACEITO: todos os casos passaram.';

  return [
    'O MVP pode ser entregue quando todos os casos de requisitos essenciais passam. Falha em requisito importante',
    'ou desejável só é aceita com decisão registrada da equipe (Seção 6.1 do plano).',
    '',
    `**${veredito}**`,
    '',
    `- Casos de requisito essencial: ${essenciais.filter((avaliacao) => avaliacao.resultado === 'Passou').length} de ${essenciais.length} passaram.` +
      (essenciaisQueNaoPassaram.length ? ` Não passaram: ${lista(essenciaisQueNaoPassaram)}.` : ''),
    `- Casos de requisito importante ou desejável que não passaram: ${outrosQueNaoPassaram.length ? lista(outrosQueNaoPassaram) : 'nenhum'}.`,
    `- Casos pendentes de verificação manual: ${pendentes.length ? pendentes.map((avaliacao) => avaliacao.caso.id).join(', ') : 'nenhum'}.`,
  ];
}

function montarResultados(pasta) {
  const execucao = lerJson(path.join(pasta, EXECUCAO));
  const { testes, relatorios } = lerTestes(pasta);
  const verificacoes = lerJson(path.join(pasta, VERIFICACOES)) ?? {};
  const arquivos = listarArquivos(pasta);
  const ci = lerJson(path.join(pasta, 'E06-ci.json'));
  const contexto = { execucao, testes, verificacoes, arquivos };
  const avaliacoes = CASOS.map((caso) => avaliarCaso(caso, contexto));

  const linhas = [];
  const adicionar = (...novas) => linhas.push(...novas);
  const celula = (texto) => textoSeguro(texto);

  adicionar('# Resultados do Plano de Testes v1.2', '');
  if (execucao.rascunho) adicionar('> **RASCUNHO:** executado com mudanças não commitadas ou sem o CT-NF-05. Não vale como evidência.', '');
  adicionar(
    `Gerado por \`pnpm evidencias\` em ${dataHora()}. Não edite à mão: rode \`pnpm evidencias -- --fechar ${path.basename(pasta)}\`.`,
    'Como cada evidência foi produzida: `docs/testes/roteiro-de-execucao.md`.',
    '',
    '| | |',
    '|---|---|',
    `| Commit testado | \`${execucao.commit}\` (${celula(execucao.assunto)}) |`,
    `| Data do commit | ${execucao.dataDoCommit} |`,
    ...(execucao.plano === PLANO
      ? []
      : [`| Plano | executado pela ${celula(execucao.plano)}; casos avaliados pela ${celula(PLANO)} (Seção 8 do roteiro) |`]),
    `| Publicado no GitHub | ${execucao.publicadoEm.length ? `sim (${execucao.publicadoEm.join(', ')})` : '**não**: sem push, ninguém consegue repetir'} |`,
    `| Executado por | ${celula(execucao.executor)} |`,
    `| Início e fim das fases automáticas | ${execucao.inicio} a ${execucao.fim ?? 'não terminou'} |`,
    '| Ambiente | `E00-ambiente.txt` |',
    '',
  );

  adicionar('## Critério de aceite', '', ...criterioDeAceite(avaliacoes), '');

  adicionar('## Resumo por nível', '', '| Resultado | Unidade | Integração | Sistema | Total |', '|---|---|---|---|---|');
  for (const resultado of ['Passou', 'Falhou', 'Bloqueado', 'Pendente']) {
    const conta = (nivel) => avaliacoes.filter((avaliacao) => avaliacao.resultado === resultado && (!nivel || avaliacao.caso.nivel === nivel)).length;
    adicionar(`| ${resultado} | ${conta('U')} | ${conta('I')} | ${conta('S')} | ${conta()} |`);
  }
  const porNivel = (nivel) => avaliacoes.filter((avaliacao) => avaliacao.caso.nivel === nivel).length;
  adicionar(`| **Total** | ${porNivel('U')} | ${porNivel('I')} | ${porNivel('S')} | ${avaliacoes.length} |`, '');

  const etapa = (id) => execucao.etapas[id];
  const codigo = (id) => (etapa(id) ? `código ${etapa(id).codigo}, ${etapa(id).duracaoEmSegundos} s` : 'não rodou');
  const situacaoDoCi = ci?.execucao
    ? `${ci.execucao.status === 'completed' ? ci.execucao.conclusion : `ainda ${ci.execucao.status}`}: ${ci.execucao.url}`
    : `sem execução do CI para este commit${ci?.erro ? ` (${celula(ci.erro)})` : ' (falta o push?)'}`;
  adicionar(
    '## Fases automáticas',
    '',
    '| Evidência | O que é | Resultado |',
    '|---|---|---|',
    `| E00 | Preparação e ambiente | ${codigo('E00')} |`,
    `| E01 | Lint | ${codigo('E01')} |`,
    `| E02 | Testes de unidade e de arquitetura | ${codigo('E02')}; ${resumoDoRelatorio(relatorios.E02)} |`,
    `| E03 | Cobertura dos testes de unidade | ${codigo('E03')}; ${resumoDaCobertura(pasta) || 'resumo não encontrado'} |`,
    `| E04 | Funções de aptidão (migrações e cores) | ${codigo('E04')} |`,
    `| E05 | Build, bundle, dados fictícios e contrato | ${codigo('E05')} |`,
    `| E06 | CI no GitHub, mesmo commit | ${situacaoDoCi} |`,
    `| E07 | Integração e sistema, PostgreSQL real | ${codigo('E07')}; ${resumoDoRelatorio(relatorios.E07)} |`,
    '',
  );

  adicionar(
    '## Resultado por caso',
    '',
    '| Caso | Nome | Requisitos | Prioridade | Nível | O que sustenta o resultado | Resultado |',
    '|---|---|---|---|---|---|---|',
  );
  for (const avaliacao of avaliacoes) {
    const { caso } = avaliacao;
    const resultado = avaliacao.resultado === 'Passou' ? 'Passou' : `**${avaliacao.resultado}**`;
    adicionar(
      `| ${caso.id} | ${celula(caso.nome)} | ${caso.requisitos.join(', ')} | ${NOME_DA_PRIORIDADE[avaliacao.prioridade]} | ${caso.nivel} | ${celula(avaliacao.detalhes.join('; '))} | ${resultado} |`,
    );
  }
  adicionar('');

  adicionar(
    '## Verificações manuais e de homologação',
    '',
    `Anotadas em \`${VERIFICACOES}\`. Só contam com o resultado anotado e ao menos um arquivo cujo nome começa pelo id.`,
    '',
    '| Id | O que é | Casos | Arquivos | Resultado | Responsável | Data | Observação |',
    '|---|---|---|---|---|---|---|---|',
  );
  for (const verificacao of VERIFICACOES_MANUAIS) {
    const anotacao = verificacoes[verificacao.id] ?? {};
    const { resultado, arquivos: arquivosDaVerificacao } = avaliarVerificacao(verificacao.id, contexto);
    const casos = CASOS.filter((caso) => manuaisDoCaso(caso).includes(verificacao.id)).map((caso) => caso.id).join(', ') || 'fora dos 33 casos';
    adicionar(
      `| ${verificacao.id} | ${celula(verificacao.descricao)} | ${casos} | ${celula(arquivosDaVerificacao.join(', ') || 'nenhum')} | ${resultado} | ${celula(anotacao.responsavel ?? '')} | ${celula(anotacao.data ?? '')} | ${celula(anotacao.observacao ?? '')} |`,
    );
  }
  adicionar('');

  adicionar('## Defeitos em aberto', '');
  if (DEFEITOS_EM_ABERTO.length === 0) adicionar('Nenhum.');
  for (const defeito of DEFEITOS_EM_ABERTO) adicionar(`- ${defeito.id} (${defeito.caso}): ${defeito.descricao}. Issue #${defeito.issue}.`);
  adicionar('', 'Todo teste que falhar nesta execução vira issue no GitHub, citando o caso e o requisito (Seção 8 do roteiro).', '');

  adicionar(
    '## Anexo: os testes de cada caso',
    '',
    'Nome de cada teste, sem o `describe` que cita o caso; busque o nome no `E02-unidade.txt` ou no `E07-integracao.txt`.',
    '✓ passou, ✗ falhou, – não rodou.',
    '',
  );
  const marca = { passed: '✓', failed: '✗' };
  for (const avaliacao of avaliacoes) {
    adicionar(`### ${avaliacao.caso.id}: ${textoSeguro(avaliacao.caso.nome)}`, '');
    if (avaliacao.testes.length === 0) adicionar(avaliacao.caso.automatico === false ? 'Só verificação manual.' : 'Nenhum teste automatizado encontrado.');
    for (const teste of avaliacao.testes) {
      const nome = teste.nome.split(' › ').filter((parte) => !parte.includes(avaliacao.caso.id)).join(' › ');
      adicionar(`- ${marca[teste.situacao] ?? '–'} (${teste.fonte}) ${textoSeguro(nome)}`);
    }
    adicionar('');
  }
  return { texto: linhas.join('\n'), avaliacoes };
}

// ---------------------------------------------------------------------------------------------------------------
// Fechar (segredos, arquivos ignorados pelo git, manifesto) e conferir
// ---------------------------------------------------------------------------------------------------------------

// Valores do .env e do .env.homologacao que são segredo (token, chave, senha). Placeholders e valores curtos ficam
// de fora para não acusar à toa. Os valores nunca são impressos: só o nome da variável.
function segredosConhecidos() {
  const segredos = [];
  for (const nomeDoArquivo of ['.env', '.env.homologacao']) {
    const caminho = path.join(RAIZ, nomeDoArquivo);
    if (!existsSync(caminho)) continue;
    for (const [nome, valor] of Object.entries(parseEnv(readFileSync(caminho, 'utf8')))) {
      if (/TOKEN|KEY|SECRET|SENHA|PASSWORD|CHAVE/i.test(nome) && valor.length >= 8 && !valor.startsWith('coloque')) {
        segredos.push({ nome: `${nome} do ${nomeDoArquivo}`, valor });
      }
    }
  }
  return segredos;
}

function procurarProblemas(pasta, rascunho) {
  const problemas = [];
  const arquivos = listarArquivos(pasta);
  const segredos = segredosConhecidos();
  const prefixoDaChaveDoAsaas = '$aact' + '_'; // em duas partes, como no teste B11, para este arquivo não ser apontado
  for (const arquivo of arquivos.filter((nome) => /\.(txt|json|md|log|html|xml)$/i.test(nome))) {
    const conteudo = lerTexto(path.join(pasta, arquivo));
    if (conteudo.includes(prefixoDaChaveDoAsaas)) problemas.push(`${arquivo}: contém o prefixo de chave do Asaas`);
    for (const segredo of segredos) {
      if (conteudo.includes(segredo.valor)) problemas.push(`${arquivo}: contém o valor de ${segredo.nome}`);
    }
  }
  // Arquivo que o git ignora (.csv, .xlsx, .dump...) não entraria no commit e o manifesto não bateria depois.
  // A pasta de rascunho inteira é ignorada de propósito (.gitignore): nela não há o que conferir.
  if (rascunho) return problemas;
  // --stdin -z: os caminhos vão e voltam separados por \0, sem aspas nem escapes (nome com acento sairia escapado).
  const pastaRelativa = path.relative(RAIZ, pasta).split(path.sep).join('/');
  let ignorados = '';
  try {
    const caminhos = arquivos.map((arquivo) => `${pastaRelativa}/${arquivo}`).join('\0');
    ignorados = execFileSync('git', ['check-ignore', '--stdin', '-z'], { cwd: RAIZ, encoding: 'utf8', input: caminhos });
  } catch {
    // código 1: nenhum arquivo ignorado
  }
  for (const ignorado of ignorados.split('\0').filter(Boolean)) {
    problemas.push(`${ignorado.slice(pastaRelativa.length + 1)}: o git ignora este tipo de arquivo (LGPD); ele não entraria no commit`);
  }
  return problemas;
}

function fechar(pasta) {
  const execucao = lerJson(path.join(pasta, EXECUCAO));
  if (!existsSync(path.join(pasta, VERIFICACOES))) {
    writeFileSync(path.join(pasta, VERIFICACOES), `${JSON.stringify(modeloDasVerificacoes(), null, 2)}\n`);
  }
  const ci = lerJson(path.join(pasta, 'E06-ci.json'));
  if (!execucao.rascunho && ci?.execucao?.status !== 'completed') coletarCI(pasta, execucao.commit);

  const { texto, avaliacoes } = montarResultados(pasta);
  writeFileSync(path.join(pasta, RESULTADOS), `${texto}\n`);

  const problemas = procurarProblemas(pasta, execucao.rascunho);
  if (problemas.length) {
    console.error(`\nNão gravei o manifesto. Resolva antes de versionar:\n${problemas.map((problema) => `  - ${problema}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }
  const linhas = listarArquivos(pasta)
    .filter((arquivo) => arquivo !== MANIFESTO)
    .map((arquivo) => `${sha256(readFileSync(path.join(pasta, arquivo)))}  ${arquivo}`);
  const manifesto = `${linhas.join('\n')}\n`;
  writeFileSync(path.join(pasta, MANIFESTO), manifesto);

  const contagem = (resultado) => avaliacoes.filter((avaliacao) => avaliacao.resultado === resultado).length;
  console.log(`\n${RESULTADOS} e ${MANIFESTO} gravados em ${path.relative(RAIZ, pasta)}`);
  console.log(`Casos: ${contagem('Passou')} passaram, ${contagem('Falhou')} falharam, ${contagem('Bloqueado')} bloqueados, ${contagem('Pendente')} pendentes.`);
  console.log(`SHA-256 do manifesto: ${sha256(manifesto)}  (vai na capa do PDF)`);
  console.log('Os prints não são lidos pelo script: confira você que só mostram dados fictícios.');
}

function conferir(pasta) {
  const caminho = path.join(pasta, MANIFESTO);
  if (!existsSync(caminho)) throw new Error(`Não há ${MANIFESTO} em ${pasta}.`);
  const manifesto = readFileSync(caminho);
  const esperados = new Map(
    manifesto.toString('utf8').split(/\r?\n/).filter(Boolean).map((linha) => [linha.slice(66), linha.slice(0, 64)]),
  );
  const problemas = [];
  for (const [arquivo, hash] of esperados) {
    const completo = path.join(pasta, arquivo);
    if (!existsSync(completo)) problemas.push(`FALTA     ${arquivo}`);
    else if (sha256(readFileSync(completo)) !== hash) problemas.push(`ALTERADO  ${arquivo}`);
  }
  for (const arquivo of listarArquivos(pasta)) {
    if (arquivo !== MANIFESTO && !esperados.has(arquivo)) problemas.push(`A MAIS    ${arquivo}`);
  }
  console.log(`SHA-256 do manifesto: ${sha256(manifesto)}  (compare com o da capa do PDF)`);
  if (problemas.length) {
    console.log(`\n${problemas.join('\n')}\n\nResultado: as evidências NÃO batem com o manifesto.`);
    process.exitCode = 1;
  } else {
    console.log(`Os ${esperados.size} arquivos batem com o manifesto.`);
  }
}

// ---------------------------------------------------------------------------------------------------------------

function argumento(nome) {
  const posicao = process.argv.indexOf(`--${nome}`);
  return posicao >= 0 ? (process.argv[posicao + 1] ?? '') : null;
}

async function principal() {
  if (argumento('conferir') !== null) return conferir(resolverPasta(argumento('conferir')));
  if (argumento('fechar') !== null) return fechar(resolverPasta(argumento('fechar')));
  return executar(process.argv.includes('--rascunho'));
}

principal().catch((erro) => {
  console.error(`\n${erro instanceof Error ? erro.message : erro}`);
  process.exitCode = 1;
});
