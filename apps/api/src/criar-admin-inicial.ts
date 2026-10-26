import { existsSync } from 'node:fs';
import path from 'node:path';
import { criarHashDaSenha } from './compartilhado/autenticacao/senha.js';
import { PrismaService } from './compartilhado/prisma/prisma.service.js';
import { PerfilUsuario } from './generated/prisma/client.js';

const arquivoEnv = path.resolve(import.meta.dirname, '../../../.env');
if (existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

async function criar(): Promise<void> {
  const nome = process.env.ADMIN_INICIAL_NOME?.trim() ?? '';
  const email = process.env.ADMIN_INICIAL_EMAIL?.trim().toLowerCase() ?? '';
  const senha = process.env.ADMIN_INICIAL_SENHA ?? '';
  if (nome.length < 2 || !email.includes('@') || senha.length < 12) {
    throw new Error('Preencha ADMIN_INICIAL_NOME, ADMIN_INICIAL_EMAIL e uma ADMIN_INICIAL_SENHA de 12 caracteres.');
  }

  const prisma = new PrismaService();
  try {
    if ((await prisma.usuario.count()) > 0) {
      throw new Error('Ja existe um usuario. Use a tela de Administracao para criar os demais acessos.');
    }
    await prisma.usuario.create({
      data: { nome, email, senhaHash: await criarHashDaSenha(senha), perfil: PerfilUsuario.DIRETORIA },
    });
    process.stdout.write(`Acesso inicial criado para ${email}. Remova ADMIN_INICIAL_SENHA do .env.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

await criar();
