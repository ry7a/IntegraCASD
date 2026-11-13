// Endereço do banco usado pelos testes de integração e de sistema (pnpm test:integracao).
//
// O banco é APAGADO e recriado a cada execução. Por isso ele tem um nome próprio e a função
// `conferirQueEhBancoDeTeste` recusa qualquer endereço que não seja local e não tenha "integracao" no nome:
// assim o teste nunca apaga o banco de desenvolvimento, nem o da homologação ou o da produção.
//
// Padrão: o PostgreSQL do docker compose (porta 5434), banco `integracasd_integracao`.
// Para usar outro, defina DATABASE_URL_INTEGRACAO antes de rodar.

export const URL_PADRAO_DO_BANCO_DE_INTEGRACAO = 'postgresql://integracasd:integracasd@localhost:5434/integracasd_integracao';

export function urlDoBancoDeIntegracao(): string {
  const definida = process.env.DATABASE_URL_INTEGRACAO?.trim();
  return definida ? definida : URL_PADRAO_DO_BANCO_DE_INTEGRACAO;
}

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Devolve o nome do banco se o endereço é seguro para apagar; senão, lança um erro que explica por quê.
export function conferirQueEhBancoDeTeste(url: string): string {
  const endereco = new URL(url);
  const nome = decodeURIComponent(endereco.pathname.replace(/^\//, ''));
  if (!HOSTS_LOCAIS.has(endereco.hostname)) {
    throw new Error(`Os testes de integração só rodam num PostgreSQL local; recusado o host "${endereco.hostname}".`);
  }
  if (!/^[a-z0-9_]+$/.test(nome) || !nome.includes('integracao')) {
    throw new Error(`O banco dos testes de integração precisa ter "integracao" no nome (só letras minúsculas, números e _); recusado "${nome}".`);
  }
  return nome;
}

// O mesmo servidor, no banco de manutenção "postgres": é dele que se apaga e recria o banco de teste.
export function urlDoBancoDeManutencao(url: string): string {
  const endereco = new URL(url);
  endereco.pathname = '/postgres';
  return endereco.toString();
}
