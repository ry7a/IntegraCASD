import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CABECALHOS_DE_SEGURANCA, cacheDoArquivo, ehPaginaDoSite, pastaDoSite, servirOSite } from './site.js';

describe('pastaDoSite', () => {
  it('por padrão, de apps/api/dist chega em apps/web/dist', () => {
    const pastaDoMain = path.resolve('/repo/apps/api/dist');
    expect(pastaDoSite({}, pastaDoMain)).toBe(path.resolve('/repo/apps/web/dist'));
  });

  it('CAMINHO_DO_SITE troca o lugar', () => {
    expect(pastaDoSite({ CAMINHO_DO_SITE: '/outro/lugar' }, '/repo/apps/api/dist')).toBe(path.resolve('/outro/lugar'));
  });
});

describe('cacheDoArquivo', () => {
  it('/assets fica no cache para sempre; o resto é conferido a cada visita', () => {
    expect(cacheDoArquivo('/assets/index-3f9a1c.js')).toBe('public, max-age=31536000, immutable');
    expect(cacheDoArquivo('/index.html')).toBe('no-cache');
    expect(cacheDoArquivo('/favicon.svg')).toBe('no-cache');
  });
});

describe('ehPaginaDoSite', () => {
  it('GET e HEAD fora de /api são páginas do site', () => {
    expect(ehPaginaDoSite('GET', '/')).toBe(true);
    expect(ehPaginaDoSite('HEAD', '/cobrancas')).toBe(true);
    expect(ehPaginaDoSite('GET', '/apiario')).toBe(true);
  });

  it('/api e outros métodos não são', () => {
    expect(ehPaginaDoSite('GET', '/api')).toBe(false);
    expect(ehPaginaDoSite('GET', '/api/alunos')).toBe(false);
    expect(ehPaginaDoSite('POST', '/cobrancas')).toBe(false);
  });
});

// Controller de mentira, só para ter uma rota do Nest sob /api no teste.
@Controller('exemplo')
class ExemploController {
  @Get()
  responder() {
    return { ok: true };
  }
}

describe('servirOSite (Express de verdade, sem banco)', () => {
  let raiz: string;
  let pasta: string;
  let app: NestExpressApplication;

  beforeAll(async () => {
    // Um "build do web" mínimo numa pasta temporária. A pasta-mãe começa com ponto de propósito: o
    // sendFile com caminho absoluto respondia 404 nesse caso (aconteceu num worktree em .claude/).
    raiz = mkdtempSync(path.join(tmpdir(), 'site-'));
    pasta = path.join(raiz, '.oculta', 'dist');
    mkdirSync(pasta, { recursive: true });
    writeFileSync(path.join(pasta, 'index.html'), '<!doctype html><title>IntegraCASD</title>');
    writeFileSync(path.join(pasta, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    mkdirSync(path.join(pasta, 'assets'));
    writeFileSync(path.join(pasta, 'assets', 'index-abc123.js'), 'console.log(1);');

    const modulo = await Test.createTestingModule({ controllers: [ExemploController] }).compile();
    app = modulo.createNestApplication<NestExpressApplication>({ logger: false });
    app.setGlobalPrefix('api');
    servirOSite(app, pasta);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(raiz, { recursive: true, force: true });
  });

  it('a raiz e qualquer rota do React Router devolvem o index.html, com no-cache', async () => {
    for (const caminho of ['/', '/cobrancas', '/alunos/123']) {
      const resposta = await request(app.getHttpServer()).get(caminho);
      expect(resposta.status).toBe(200);
      expect(resposta.text).toContain('<title>IntegraCASD</title>');
      expect(resposta.headers['cache-control']).toBe('no-cache');
    }
  });

  it('HEAD de uma rota do site também responde 200', async () => {
    const resposta = await request(app.getHttpServer()).head('/cobrancas');
    expect(resposta.status).toBe(200);
  });

  it('/assets com cache imutável; outros arquivos com no-cache', async () => {
    const asset = await request(app.getHttpServer()).get('/assets/index-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    const favicon = await request(app.getHttpServer()).get('/favicon.svg');
    expect(favicon.status).toBe(200);
    expect(favicon.headers['cache-control']).toBe('no-cache');
  });

  it('/api continua com o Nest: rota conhecida responde, desconhecida dá 404 em JSON', async () => {
    const conhecida = await request(app.getHttpServer()).get('/api/exemplo');
    expect(conhecida.body).toEqual({ ok: true });
    for (const caminho of ['/api/nao-existe', '/api']) {
      const desconhecida = await request(app.getHttpServer()).get(caminho);
      expect(desconhecida.status).toBe(404);
      expect(desconhecida.headers['content-type']).toContain('application/json');
    }
  });

  it('POST fora de /api não recebe o index.html', async () => {
    const resposta = await request(app.getHttpServer()).post('/cobrancas');
    expect(resposta.status).toBe(404);
  });

  it('cabeçalhos de segurança no site e na API', async () => {
    for (const caminho of ['/', '/assets/index-abc123.js', '/api/exemplo']) {
      const resposta = await request(app.getHttpServer()).get(caminho);
      for (const [nome, valor] of Object.entries(CABECALHOS_DE_SEGURANCA)) {
        expect(resposta.headers[nome.toLowerCase()]).toBe(valor);
      }
    }
  });

  it('sem o build do site, recusa subir com mensagem clara', async () => {
    const vazia = mkdtempSync(path.join(tmpdir(), 'site-vazio-'));
    const modulo = await Test.createTestingModule({}).compile();
    const outra = modulo.createNestApplication<NestExpressApplication>({ logger: false });
    expect(() => servirOSite(outra, vazia)).toThrow(/Build do site não encontrado/);
    await outra.close();
    rmSync(vazia, { recursive: true, force: true });
  });
});
