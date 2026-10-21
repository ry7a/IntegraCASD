import { Abas, PainelDaAba } from '@/compartilhado/componentes/Abas'
import { useAbaDaUrl } from '@/compartilhado/hooks'
import AbaContratos from './AbaContratos'
import AbaFuncionarios from './AbaFuncionarios'
import AbaProjetos from './AbaProjetos'
import ListaDeAlunos from './ListaDeAlunos'

const ABAS = [
  { id: 'alunos', titulo: 'Alunos' },
  { id: 'funcionarios', titulo: 'Funcionários' },
  { id: 'contratos', titulo: 'Contratos' },
  { id: 'projetos', titulo: 'Projetos' },
] as const

// [Cadastros.RF001 a RF005] A aba aberta fica na URL (?aba=contratos).
function PaginaCadastros() {
  const [aba, mudarAba] = useAbaDaUrl(ABAS.map((a) => a.id), 'alunos')

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Cadastros</h1>
          <p>
            Alunos, funcionários, contratos e projetos que originam cobranças e despesas. Nada é excluído: cadastros
            são inativados.
          </p>
        </div>
      </div>

      <Abas abas={ABAS} atual={aba} aoMudar={mudarAba} rotulo="Tipos de cadastro" />

      <PainelDaAba id={aba}>
        {aba === 'alunos' && <ListaDeAlunos />}
        {aba === 'funcionarios' && <AbaFuncionarios />}
        {aba === 'contratos' && <AbaContratos />}
        {aba === 'projetos' && <AbaProjetos />}
      </PainelDaAba>
    </>
  )
}

export default PaginaCadastros
