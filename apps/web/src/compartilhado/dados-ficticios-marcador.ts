// Marcador dos dados fictícios (função de aptidão F6).
//
// Cada features/<x>/dados-ficticios.ts chama marcarDadosFicticios('dados-ficticios-integracasd:<x>').
// Isso deixa no bundle de produção esse texto, que o script
// scripts/arquitetura/verificar-dados-ficticios.mjs procura em apps/web/dist.
// Se o texto aparecer, aquela feature ainda está exibindo dados fictícios.
// O texto é escrito por extenso em cada chamada (e não montado por código) para o
// bundler não o transformar em pedaços que o script não consegue achar.
export const MARCADOR_DADOS_FICTICIOS = 'dados-ficticios-integracasd'

const marcadas = new Set<string>()

// O tipo do parâmetro obriga o texto a começar com o marcador (o TypeScript avisa se errar).
// O Set existe porque, sem ele, o bundler perceberia que o texto não é usado e o removeria
// (tree shaking). Guardar num Set de módulo é um efeito colateral que ele não remove, e o
// marcador só vai para o bundle quando os dados fictícios daquela feature de fato vão.
export function marcarDadosFicticios(marcador: `${typeof MARCADOR_DADOS_FICTICIOS}:${string}`) {
  marcadas.add(marcador)
}

// Marcadores registrados (útil para depurar no console do navegador).
export function marcadoresRegistrados(): string[] {
  return [...marcadas]
}
