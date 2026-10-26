import { Global, Injectable, Logger, Module } from '@nestjs/common';

// Eventos internos: um módulo avisa que algo aconteceu e outros reagem, sem que o primeiro conheça os
// demais. Exemplo: o Cadastros avisa "aluno alterado" e Cobranças atualiza o cliente no Asaas. Sem isso,
// o Cadastros teria de importar Cobranças, que já importa o Cadastros (um ciclo).
//
// É um mecanismo simples, dentro do mesmo processo. Quem ouve deve ser rápido e não falhar: trabalho
// demorado ou que fala com o Asaas vai para a fila (pg-boss), que tenta de novo se falhar.

export type EventoInterno = { tipo: 'aluno-alterado'; alunoId: string };

type Ouvinte = (evento: EventoInterno) => Promise<void>;

@Injectable()
export class EventosInternos {
  private readonly logger = new Logger(EventosInternos.name);
  private readonly ouvintes = new Map<EventoInterno['tipo'], Ouvinte[]>();

  ouvir(tipo: EventoInterno['tipo'], ouvinte: Ouvinte): void {
    this.ouvintes.set(tipo, [...(this.ouvintes.get(tipo) ?? []), ouvinte]);
  }

  // Chamado depois que a alteração já foi gravada. A falha de um ouvinte vai para o log e não desfaz
  // nem impede a operação de quem publicou.
  async publicar(evento: EventoInterno): Promise<void> {
    for (const ouvinte of this.ouvintes.get(evento.tipo) ?? []) {
      try {
        await ouvinte(evento);
      } catch (erro) {
        this.logger.error(`Falha ao tratar o evento ${evento.tipo}: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`);
      }
    }
  }
}

// @Global: registrado uma vez (AppModule e WorkerModule), fica disponível em todos os módulos.
@Global()
@Module({
  providers: [EventosInternos],
  exports: [EventosInternos],
})
export class EventosInternosModule {}
