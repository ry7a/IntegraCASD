// O CASD fica em São José dos Campos: "hoje" é o dia no fuso de São Paulo, não o do servidor
// (que pode estar em UTC, onde o dia vira às 21h de Brasília).

// Devolve a data no formato "AAAA-MM-DD". O locale en-CA escreve exatamente nesse formato.
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
}

// Coluna @db.Date do Prisma chega como Date à meia-noite UTC; aqui vira "AAAA-MM-DD".
export function paraDia(data: Date): string {
  return data.toISOString().slice(0, 10);
}

// "AAAA-MM-DD" para o Date que o Prisma grava numa coluna @db.Date.
export function deDia(dia: string): Date {
  return new Date(`${dia}T00:00:00Z`);
}
