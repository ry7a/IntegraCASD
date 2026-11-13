// CT-NF-03 do Plano de Testes, [Desempenho.NF001]: mede o tempo de resposta do webhook do Asaas.
// Manda N notificações seguidas (padrão: 100) e mostra no terminal mínimo, média, p95 e máximo.
// Passa se todas responderem 200 em menos de 5 s. Serve para a API local e para a homologação na Railway.
//
// Uso (na raiz):
//   pnpm medir:webhook                          API local (http://localhost:3000), token do .env
//   pnpm medir:webhook -- --alvo homologacao    endereço e token do .env.homologacao (fora do git)
//   pnpm medir:webhook -- --quantidade 20       outra quantidade
//
// O .env.homologacao tem duas linhas:
//   HOMOLOGACAO_URL=https://<endereço da homologação>
//   ASAAS_WEBHOOK_TOKEN=<o token do webhook da homologação>
//
// As notificações são do tipo PAYMENT_UPDATED, sem cobrança: ficam gravadas na tabela de eventos com o id
// "evt_medicao_...", e o worker as marca como processadas sem efeito. Nenhuma cobrança muda.
// O token nunca é impresso.
import { existsSync } from 'node:fs';
import path from 'node:path';

const LIMITE_POR_RESPOSTA_EM_MS = 5000;
const RAIZ = path.resolve(import.meta.dirname, '..', '..');

function lerArgumento(nome, padrao) {
  const posicao = process.argv.indexOf(`--${nome}`);
  return posicao >= 0 && process.argv[posicao + 1] ? process.argv[posicao + 1] : padrao;
}

function configuracao() {
  const alvo = lerArgumento('alvo', 'local');
  const quantidade = Number(lerArgumento('quantidade', '100'));
  if (!Number.isInteger(quantidade) || quantidade < 1) throw new Error('--quantidade precisa ser um inteiro positivo.');

  if (alvo === 'local') {
    const arquivo = path.join(RAIZ, '.env');
    if (existsSync(arquivo)) process.loadEnvFile(arquivo);
    return { alvo, quantidade, urlBase: `http://localhost:${process.env.PORT ?? 3000}`, token: process.env.ASAAS_WEBHOOK_TOKEN };
  }
  if (alvo === 'homologacao') {
    const arquivo = path.join(RAIZ, '.env.homologacao');
    if (!existsSync(arquivo)) throw new Error('Crie o arquivo .env.homologacao na raiz (veja o comentário no topo deste script).');
    process.loadEnvFile(arquivo);
    return { alvo, quantidade, urlBase: process.env.HOMOLOGACAO_URL?.replace(/\/+$/, ''), token: process.env.ASAAS_WEBHOOK_TOKEN };
  }
  throw new Error('--alvo precisa ser "local" ou "homologacao".');
}

const ms = (valor) => `${String(Math.round(valor)).padStart(5)} ms`;

async function medir() {
  const { alvo, quantidade, urlBase, token } = configuracao();
  if (!urlBase) throw new Error('Falta o endereço (HOMOLOGACAO_URL).');
  if (!token) throw new Error('Falta o ASAAS_WEBHOOK_TOKEN.');

  console.log('CT-NF-03 [Desempenho.NF001]: tempo de resposta do webhook do Asaas');
  console.log(`Alvo: ${alvo} (${urlBase})`);
  console.log(`Início: ${new Date().toISOString()}`);

  // A homologação "dorme" quando ninguém usa (Serverless): a primeira requisição acorda o serviço e demora.
  // O aquecimento não entra na conta; o tempo dele aparece só para registro.
  const inicioDoAquecimento = performance.now();
  const aquecimento = await fetch(`${urlBase}/api/saude`);
  console.log(`Aquecimento (GET /api/saude): ${aquecimento.status} em ${ms(performance.now() - inicioDoAquecimento).trim()} (não entra na conta)`);

  const lote = `evt_medicao_${Date.now()}`;
  const tempos = [];
  const statusRecebidos = [];
  for (let numero = 1; numero <= quantidade; numero += 1) {
    const inicio = performance.now();
    let status = 0;
    try {
      const resposta = await fetch(`${urlBase}/api/webhooks/asaas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'asaas-access-token': token },
        body: JSON.stringify({ id: `${lote}_${numero}`, event: 'PAYMENT_UPDATED' }),
        signal: AbortSignal.timeout(30_000),
      });
      await resposta.text();
      status = resposta.status;
    } catch {
      status = 0; // sem resposta (rede ou tempo esgotado)
    }
    tempos.push(performance.now() - inicio);
    statusRecebidos.push(status);
  }

  const ordenados = [...tempos].sort((a, b) => a - b);
  const respostas200 = statusRecebidos.filter((status) => status === 200).length;
  const acimaDoLimite = tempos.filter((tempo) => tempo >= LIMITE_POR_RESPOSTA_EM_MS).length;
  const outros = [...new Set(statusRecebidos.filter((status) => status !== 200))];

  console.log(`\n${quantidade} notificações seguidas (ids ${lote}_1 a ${lote}_${quantidade}):`);
  console.log(`  respostas 200 ...... ${respostas200} de ${quantidade}${outros.length ? ` (outros códigos: ${outros.join(', ')}; 0 = sem resposta)` : ''}`);
  console.log(`  mínimo ............. ${ms(ordenados[0])}`);
  console.log(`  média .............. ${ms(tempos.reduce((soma, tempo) => soma + tempo, 0) / quantidade)}`);
  console.log(`  p95 ................ ${ms(ordenados[Math.ceil(quantidade * 0.95) - 1])}`);
  console.log(`  máximo ............. ${ms(ordenados[quantidade - 1])}`);
  console.log(`  limite ............. ${ms(LIMITE_POR_RESPOSTA_EM_MS)} por resposta`);
  console.log(`  acima do limite .... ${acimaDoLimite}`);
  console.log(`Fim: ${new Date().toISOString()}`);

  const passou = respostas200 === quantidade && acimaDoLimite === 0;
  console.log(`\nResultado: ${passou ? 'PASSOU' : 'FALHOU'}`);
  process.exitCode = passou ? 0 : 1;
}

medir().catch((erro) => {
  console.error(`Medição interrompida: ${erro instanceof Error ? erro.message : erro}`);
  process.exitCode = 1;
});
