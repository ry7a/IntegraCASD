import { Injectable } from '@nestjs/common';

// Intervalo entre os alunos nas rotinas em lote [Desempenho.NF004]: com 1.000 alunos e duas chamadas
// por aluno, 300 ms dão cerca de 10 minutos (o limite é 30) e ficam longe do limite de frequência do
// Asaas. É uma classe para os testes trocarem por uma versão que não espera.
@Injectable()
export class RitmoDoAsaas {
  aguardar(): Promise<void> {
    return new Promise((resolver) => setTimeout(resolver, 300));
  }
}
