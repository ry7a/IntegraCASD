import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';

@Injectable()
export class EncerrarSessao {
  constructor(private readonly prisma: PrismaService) {}

  async executar(sessaoId: string): Promise<void> {
    await this.prisma.sessao.updateMany({
      where: { id: sessaoId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }
}
