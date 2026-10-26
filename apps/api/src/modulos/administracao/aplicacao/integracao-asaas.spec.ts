import { randomBytes } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { ClienteAsaasFalso } from '../../../compartilhado/asaas/cliente-asaas.falso.js';
import type {
  ConfiguracaoAsaasRepositorio,
  ConfiguracaoGuardada,
  NovaConfiguracao,
} from '../../../compartilhado/asaas/configuracao-asaas.repositorio.js';
import type { FonteDaConfiguracaoAsaas } from '../../../compartilhado/asaas/fonte-da-configuracao.js';
import { decifrar } from '../../../compartilhado/seguranca/cifra.js';
import { AlterarPrazoDoAlerta, ConsultarIntegracaoAsaas, SubstituirChaveAsaas } from './integracao-asaas.js';

const chaveMestra = randomBytes(32);
const CHAVE_BOA = 'chave-ficticia-boa-0123456789';
const CHAVE_RUIM = 'chave-ficticia-ruim-0123456789';

function repositorioFalso(vigente: ConfiguracaoGuardada | null = null) {
  const gravadas: Array<{ nova: NovaConfiguracao; autorId: string; descricao: string }> = [];
  const repositorio = {
    vigente: async () => vigente,
    gravar: async (nova: NovaConfiguracao, autorId: string, descricao: string) => void gravadas.push({ nova, autorId, descricao }),
  } as unknown as ConfiguracaoAsaasRepositorio;
  return { repositorio, gravadas };
}

const guardada: ConfiguracaoGuardada = {
  id: 'configuracao-1',
  ambiente: 'SANDBOX',
  chaveCifrada: 'cifrada-ficticia',
  prazoAlertaHoras: 24,
  testadaEm: new Date('2026-10-20T10:00:00Z'),
  cadastradaEm: new Date('2026-10-20T10:00:00Z'),
  alteradoPor: 'Diretora Fictícia',
};

describe('integração com o Asaas [Administração.RF004]', () => {
  const ambienteOriginal = process.env.CHAVE_DE_CIFRAGEM;
  beforeEach(() => {
    process.env.CHAVE_DE_CIFRAGEM = chaveMestra.toString('base64');
  });
  afterEach(() => {
    // Atribuir undefined a process.env grava o texto "undefined"; por isso o delete.
    if (ambienteOriginal === undefined) delete process.env.CHAVE_DE_CIFRAGEM;
    else process.env.CHAVE_DE_CIFRAGEM = ambienteOriginal;
  });

  it('testa a chave nova antes de guardar e guarda só a versão cifrada [Segurança.NF003]', async () => {
    const asaas = new ClienteAsaasFalso();
    const { repositorio, gravadas } = repositorioFalso();
    await new SubstituirChaveAsaas(repositorio, asaas).executar({ ambiente: 'SANDBOX', chave: CHAVE_BOA }, 'usuario-1');

    expect(asaas.credenciaisTestadas).toEqual([{ ambiente: 'SANDBOX', chaveApi: CHAVE_BOA }]);
    expect(gravadas).toHaveLength(1);
    const [{ nova, autorId, descricao }] = gravadas;
    expect(autorId).toBe('usuario-1');
    expect(nova.prazoAlertaHoras).toBe(24);
    expect(nova.chaveCifrada).not.toContain(CHAVE_BOA);
    expect(decifrar(nova.chaveCifrada, chaveMestra)).toBe(CHAVE_BOA);
    // A trilha descreve a operação sem a chave.
    expect(descricao).not.toContain(CHAVE_BOA);
  });

  it('chave recusada pelo Asaas não é guardada e a anterior continua valendo (fluxo E1)', async () => {
    const asaas = new ClienteAsaasFalso();
    asaas.chavesRecusadas.add(CHAVE_RUIM);
    const { repositorio, gravadas } = repositorioFalso(guardada);
    const tentativa = new SubstituirChaveAsaas(repositorio, asaas).executar(
      { ambiente: 'PRODUCAO', chave: CHAVE_RUIM },
      'usuario-1',
    );

    await expect(tentativa).rejects.toBeInstanceOf(BadRequestException);
    await expect(tentativa).rejects.toThrow(/chave anterior continua valendo/);
    expect(gravadas).toEqual([]);
  });

  it('com o Asaas fora do ar, também não guarda', async () => {
    const asaas = new ClienteAsaasFalso();
    asaas.indisponivel = true;
    const { repositorio, gravadas } = repositorioFalso();
    await expect(
      new SubstituirChaveAsaas(repositorio, asaas).executar({ ambiente: 'SANDBOX', chave: CHAVE_BOA }, 'usuario-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gravadas).toEqual([]);
  });

  it('recusa ambiente, chave ou prazo inválidos sem chamar o Asaas', async () => {
    const asaas = new ClienteAsaasFalso();
    const { repositorio } = repositorioFalso();
    const substituir = new SubstituirChaveAsaas(repositorio, asaas);
    await expect(substituir.executar({ ambiente: 'OUTRO', chave: CHAVE_BOA }, 'u')).rejects.toBeInstanceOf(BadRequestException);
    await expect(substituir.executar({ ambiente: 'SANDBOX', chave: 'curta' }, 'u')).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      substituir.executar({ ambiente: 'SANDBOX', chave: CHAVE_BOA, prazoAlertaHoras: 72 }, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(asaas.credenciaisTestadas).toEqual([]);
  });

  it('sem CHAVE_DE_CIFRAGEM no servidor, avisa e não guarda', async () => {
    delete process.env.CHAVE_DE_CIFRAGEM;
    const asaas = new ClienteAsaasFalso();
    const { repositorio, gravadas } = repositorioFalso();
    await expect(
      new SubstituirChaveAsaas(repositorio, asaas).executar({ ambiente: 'SANDBOX', chave: CHAVE_BOA }, 'u'),
    ).rejects.toThrow(/CHAVE_DE_CIFRAGEM/);
    expect(gravadas).toEqual([]);
  });

  it('muda só o prazo do alerta, mantendo a chave (fluxo A2)', async () => {
    const { repositorio, gravadas } = repositorioFalso(guardada);
    await new AlterarPrazoDoAlerta(repositorio).executar({ prazoAlertaHoras: 48 }, 'usuario-2');
    expect(gravadas[0].nova).toEqual({
      ambiente: 'SANDBOX',
      chaveCifrada: 'cifrada-ficticia',
      prazoAlertaHoras: 48,
      testadaEm: guardada.testadaEm,
    });
  });

  it('não muda o prazo antes de haver chave cadastrada', async () => {
    const { repositorio } = repositorioFalso();
    await expect(new AlterarPrazoDoAlerta(repositorio).executar({ prazoAlertaHoras: 12 }, 'u')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('a consulta informa o ambiente e a origem da chave, nunca a chave', async () => {
    const { repositorio } = repositorioFalso(guardada);
    const fonte = {
      emUso: async () => ({ urlBase: 'x', chaveApi: CHAVE_BOA, ambiente: 'SANDBOX', origem: 'BANCO' }),
    } as unknown as FonteDaConfiguracaoAsaas;
    const situacao = await new ConsultarIntegracaoAsaas(repositorio, fonte).executar();
    expect(situacao).toEqual({
      ambiente: 'SANDBOX',
      conectada: true,
      origemDaChave: 'TELA',
      chaveCadastradaEm: guardada.testadaEm,
      ultimoTesteEm: guardada.testadaEm,
      alteradoPor: 'Diretora Fictícia',
      prazoAlertaHoras: 24,
    });
    expect(JSON.stringify(situacao)).not.toContain(CHAVE_BOA);
  });

  it('sem chave em lugar nenhum, a integração aparece desconectada', async () => {
    const { repositorio } = repositorioFalso();
    const fonte = { emUso: async () => null } as unknown as FonteDaConfiguracaoAsaas;
    expect(await new ConsultarIntegracaoAsaas(repositorio, fonte).executar()).toMatchObject({
      ambiente: null,
      conectada: false,
      origemDaChave: null,
      prazoAlertaHoras: 24,
    });
  });
});
