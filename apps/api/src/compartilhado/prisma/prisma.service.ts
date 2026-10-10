import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

// Cliente do banco, injetável nos repositórios (camada infra/ de cada módulo).
// No Prisma 7 a conexão é feita por um "driver adapter": aqui, o driver `pg` do Node.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter });
  }

  // Fecha as conexões quando a aplicação (API ou worker) é encerrada.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
