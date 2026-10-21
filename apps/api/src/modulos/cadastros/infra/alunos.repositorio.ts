import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';

// Acesso ao banco para alunos. Só esta camada conhece o Prisma; o caso de uso
// recebe os registros e não sabe como foram buscados.
@Injectable()
export class AlunosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  listarAtivos() {
    return this.prisma.aluno.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      include: { turma: true },
    });
  }
}
