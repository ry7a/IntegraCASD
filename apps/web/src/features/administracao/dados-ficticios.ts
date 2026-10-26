// Dados FICTÍCIOS de Administração, iguais aos do mockup (docs/telas/administracao.html).
// Usuários e endereço são inventados (LGPD). Não há chave do Asaas aqui, nem poderia haver.
import { marcarDadosFicticios } from '@/compartilhado/dados-ficticios-marcador'
import type {
  IntegracaoAsaasDto,
  ListaDeUsuariosDto,
  RegistroAuditoriaDto,
} from './contrato'

// Deixa no bundle o marcador que o verificar-dados-ficticios.mjs procura (F6).
marcarDadosFicticios('dados-ficticios-integracasd:administracao')

export const usuarios: ListaDeUsuariosDto = {
  itens: [
    { id: 'usuario-marina', nome: 'Marina Teixeira', email: 'marina.teixeira@exemplo.com', perfil: 'DIRETORIA', ativo: true, observacao: null, ultimoAcessoEm: '2026-10-19T08:02:00-03:00' },
    { id: 'usuario-sonia', nome: 'Sônia Aparecida Martins', email: 'sonia.martins@exemplo.com', perfil: 'ADMINISTRATIVO', ativo: true, observacao: null, ultimoAcessoEm: '2026-10-19T07:45:00-03:00' },
    { id: 'usuario-thiago', nome: 'Thiago Rezende', email: 'thiago.rezende@exemplo.com', perfil: 'DIRETORIA', ativo: true, observacao: null, ultimoAcessoEm: '2026-10-14T21:10:00-03:00' },
    { id: 'usuario-gabriela', nome: 'Gabriela Sato', email: 'gabriela.sato@exemplo.com', perfil: 'DIRETORIA', ativo: false, observacao: 'Gestão 2025', ultimoAcessoEm: '2025-12-20T18:30:00-03:00' },
  ],
}

export const integracao: IntegracaoAsaasDto = {
  ambiente: 'SANDBOX',
  conectada: true,
  ultimoTesteEm: '2026-10-19T06:00:00-03:00',
  ultimaNotificacaoEm: '2026-10-19T08:48:00-03:00',
  falhasSeguidas: 0,
  limiteFalhas: 15,
  chaveCadastradaEm: '2026-10-02',
  enderecoNotificacao: 'https://integracasd.exemplo.org/webhooks/asaas',
  horasAlertaSemNotificacao: 24,
}

export const trilha: RegistroAuditoriaDto[] = [
  { id: 'aud-1', ocorridoEm: '2026-10-18T10:21:00-03:00', usuarioNome: 'Sônia Aparecida Martins', operacao: 'INCLUSAO', entidade: 'MOVIMENTACAO', detalhe: 'Manutenção das máquinas, outubro/2026 · − R$ 1.200,00' },
  { id: 'aud-2', ocorridoEm: '2026-10-16T14:05:00-03:00', usuarioNome: 'Marina Teixeira', operacao: 'INCLUSAO', entidade: 'MOVIMENTACAO', detalhe: 'Tinta e materiais para a reforma · − R$ 2.380,00' },
  { id: 'aud-3', ocorridoEm: '2026-10-15T11:30:00-03:00', usuarioNome: 'Sônia Aparecida Martins', operacao: 'REGISTRO_MANUAL_DE_PAGAMENTO', entidade: 'COBRANCA', detalhe: 'Mensalidade 10/2026 de Rafael Tavares Costa · justificativa: Pix na conta do CASD' },
  { id: 'aud-4', ocorridoEm: '2026-10-14T09:12:00-03:00', usuarioNome: 'Marina Teixeira', operacao: 'ESTORNO', entidade: 'MOVIMENTACAO', detalhe: 'Impressão de banners · motivo: lançada em duplicidade' },
  { id: 'aud-5', ocorridoEm: '2026-10-02T16:40:00-03:00', usuarioNome: 'Marina Teixeira', operacao: 'ALTERACAO', entidade: 'CONFIGURACAO', detalhe: 'Chave de acesso do Asaas substituída (o valor não é registrado)' },
  { id: 'aud-6', ocorridoEm: '2026-10-01T06:14:00-03:00', usuarioNome: null, operacao: 'GERACAO_RECORRENTE', entidade: 'COBRANCA', detalhe: '739 mensalidades criadas · 3 falhas' },
]
