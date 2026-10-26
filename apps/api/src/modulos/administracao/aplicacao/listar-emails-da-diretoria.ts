import { Injectable } from '@nestjs/common';
import { PerfilUsuario } from '../../../compartilhado/autenticacao/perfil.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';

// Caso de uso: os e-mails dos usuários de diretoria ativos. Quem recebe os alertas do sistema
// ([Confiabilidade.NF002]). Usuário inativado deixa de receber; o e-mail é o do cadastro do usuário.
@Injectable()
export class ListarEmailsDaDiretoria {
  constructor(private readonly prisma: PrismaService) {}

  async executar(): Promise<string[]> {
    const usuarios = await this.prisma.usuario.findMany({
      where: { ativo: true, perfil: PerfilUsuario.DIRETORIA },
      select: { email: true },
      orderBy: { email: 'asc' },
    });
    return usuarios.map((usuario) => usuario.email);
  }
}
