import { Abas, PainelDaAba } from '@/compartilhado/componentes/Abas'
import { useAbaDaUrl } from '@/compartilhado/hooks'
import AbaCategorias from './AbaCategorias'
import AbaIntegracao from './AbaIntegracao'
import AbaParametros from './AbaParametros'
import AbaTrilha from './AbaTrilha'
import AbaUsuarios from './AbaUsuarios'

const ABAS = [
  { id: 'usuarios', titulo: 'Usuários' },
  { id: 'categorias', titulo: 'Categorias' },
  { id: 'parametros', titulo: 'Parâmetros de cobrança' },
  { id: 'integracao', titulo: 'Integração com o Asaas' },
  { id: 'trilha', titulo: 'Trilha de auditoria' },
] as const

// [Administração.RF001 a RF005] So a diretoria usa esta tela.
function PaginaAdministracao() {
  const [aba, mudarAba] = useAbaDaUrl(ABAS.map((a) => a.id), 'usuarios')

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Administração</h1>
          <p>Configurações que mudam o comportamento do sistema. Visível só para o perfil de diretoria.</p>
        </div>
      </div>

      <Abas abas={ABAS} atual={aba} aoMudar={mudarAba} rotulo="Seções da administração" />

      <PainelDaAba id={aba}>
        {aba === 'usuarios' && <AbaUsuarios />}
        {aba === 'categorias' && <AbaCategorias />}
        {aba === 'parametros' && <AbaParametros />}
        {aba === 'integracao' && <AbaIntegracao />}
        {aba === 'trilha' && <AbaTrilha />}
      </PainelDaAba>
    </>
  )
}

export default PaginaAdministracao
