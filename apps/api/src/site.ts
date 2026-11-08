import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

// Em produção a API também serve o site (o build do Vite) no MESMO endereço. Precisa ser assim: o
// frontend chama /api por caminho relativo e o cookie de sessão é SameSite=Strict com path=/api.
// Em desenvolvimento nada disto roda: o Vite serve o site e repassa /api para a porta 3000.

// Cabeçalhos de segurança de toda resposta (site e API) em produção, sem dependência nova:
// - nosniff: o navegador não "adivinha" o tipo do arquivo (evita executar texto como script);
// - Referrer-Policy: não vaza o caminho completo das telas para outros sites;
// - HSTS: depois da primeira visita, o navegador só usa HTTPS por 180 dias;
// - CSP: só carrega scripts, estilos, fontes e chamadas do próprio endereço, e ninguém põe o
//   sistema dentro de um <iframe> (frame-ancestors). style-src aceita 'unsafe-inline' porque bibliotecas
//   de interface costumam pôr estilos direto na página; scripts continuam só do próprio endereço.
export const CABECALHOS_DE_SEGURANCA: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=15552000',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
};

// Onde está o build do web. Por padrão, de apps/api/dist (onde roda o main.js) chega em apps/web/dist,
// que é onde o Dockerfile deixa o build. CAMINHO_DO_SITE troca o lugar, se um dia precisar.
export function pastaDoSite(env: NodeJS.ProcessEnv, pastaDoMain: string): string {
  const configurada = (env.CAMINHO_DO_SITE ?? '').trim();
  return configurada !== '' ? path.resolve(configurada) : path.resolve(pastaDoMain, '../../web/dist');
}

// Os arquivos de /assets têm o hash do conteúdo no nome (index-3f9a1c.js): mudou o conteúdo, mudou o
// nome. Por isso podem ficar no cache para sempre. O resto (index.html, favicon) é conferido a cada
// visita (no-cache = pode guardar, mas pergunta ao servidor antes de usar), para uma versão nova
// aparecer logo depois da implantação.
export function cacheDoArquivo(caminhoNoSite: string): string {
  return caminhoNoSite.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
}

// Pedido que o site responde com o index.html quando não é um arquivo: GET ou HEAD fora de /api.
// Assim, recarregar /cobrancas abre a tela (o React Router resolve a rota no navegador), e um /api/...
// desconhecido continua chegando ao Nest, que responde 404 em JSON.
// /assets também fica de fora: um arquivo que não existe mais (aba aberta antes de uma implantação pede o
// index-antigo.js) precisa dar 404. Com o index.html e 200, o navegador recusaria o "script" com um erro de
// tipo (MIME) confuso, por causa do nosniff.
export function ehPaginaDoSite(metodo: string, caminho: string): boolean {
  if (metodo !== 'GET' && metodo !== 'HEAD') return false;
  const ehDaApi = caminho === '/api' || caminho.startsWith('/api/');
  const ehArquivoDoBuild = caminho === '/assets' || caminho.startsWith('/assets/');
  return !ehDaApi && !ehArquivoDoBuild;
}

// Liga tudo no app. Chamada só em produção (main.ts), antes do app.listen: os middlewares do Express
// rodam na ordem em que são registrados, e as rotas do Nest só entram no listen, depois destes.
export function servirOSite(app: NestExpressApplication, pasta: string): void {
  const indexHtml = path.join(pasta, 'index.html');
  if (!existsSync(indexHtml)) {
    throw new Error(`Build do site não encontrado em ${pasta}. Rode "pnpm --filter web build" ou ajuste CAMINHO_DO_SITE.`);
  }

  // 1. Cabeçalhos de segurança em toda resposta.
  app.use((_requisicao: Request, resposta: Response, proximo: NextFunction) => {
    for (const [nome, valor] of Object.entries(CABECALHOS_DE_SEGURANCA)) {
      resposta.setHeader(nome, valor);
    }
    proximo();
  });

  // 2. Arquivos que existem no build (js, css, imagens). index: false porque o index.html sai pelo
  //    passo 3, sempre com no-cache. Se o arquivo não existe, segue adiante.
  app.useStaticAssets(pasta, {
    index: false,
    setHeaders: (resposta: Response, caminhoDoArquivo: string) => {
      const caminhoNoSite = '/' + path.relative(pasta, caminhoDoArquivo).split(path.sep).join('/');
      resposta.setHeader('Cache-Control', cacheDoArquivo(caminhoNoSite));
    },
  });

  // 3. Qualquer outra página do site (/, /cobrancas, /alunos/123...) recebe o index.html.
  app.use((requisicao: Request, resposta: Response, proximo: NextFunction) => {
    if (!ehPaginaDoSite(requisicao.method, requisicao.path)) {
      proximo();
      return;
    }
    resposta.setHeader('Cache-Control', 'no-cache');
    // Com `root`, o Express só confere o nome relativo ("index.html"). Com o caminho absoluto, ele
    // recusaria (404) uma pasta-mãe que comece com ponto, como .claude/ ou /home/x/.local/.
    resposta.sendFile('index.html', { root: pasta });
  });
}
