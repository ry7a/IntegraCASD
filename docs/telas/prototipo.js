/*
 * Comportamento compartilhado do protótipo de telas.
 * Monta o menu lateral e a barra do topo (iguais em todas as páginas), e liga abas, diálogos e dicas.
 * É só um protótipo navegável: nada aqui fala com a API, e todos os dados são fictícios.
 */

// Ícones no estilo lucide (o mesmo pacote de ícones que o shadcn/ui usa).
const ICONES = {
  indicadores: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  cadastros:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  cobrancas:
    '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  movimentacoes: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  administracao:
    '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  busca: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  mais: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  fechar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alerta:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  sincronizar:
    '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
  baixar:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  email: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  opcoes: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  estornar: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  copiar:
    '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  trilha: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  voltar: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  cadeado:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
};

function icone(nome) {
  return `<svg class="icone" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome]}</svg>`;
}

const ITENS_DO_MENU = [
  { id: 'indicadores', titulo: 'Indicadores', arquivo: 'indicadores.html' },
  { id: 'cadastros', titulo: 'Cadastros', arquivo: 'cadastros.html' },
  { id: 'cobrancas', titulo: 'Cobranças', arquivo: 'cobrancas.html' },
  { id: 'movimentacoes', titulo: 'Movimentações', arquivo: 'movimentacoes.html' },
  { id: 'administracao', titulo: 'Administração', arquivo: 'administracao.html', etiqueta: 'Diretoria' },
];

function montarEstrutura() {
  const paginaAtual = document.body.dataset.pagina;
  const conteudoDaPagina = document.querySelector('main');

  const itens = ITENS_DO_MENU.map((item) => {
    const atual = item.id === paginaAtual ? ' aria-current="page"' : '';
    const etiqueta = item.etiqueta ? `<span class="etiqueta">${item.etiqueta}</span>` : '';
    return `<a class="menu-item" href="${item.arquivo}"${atual}>${icone(item.id)}${item.titulo}${etiqueta}</a>`;
  }).join('');

  const estrutura = document.createElement('div');
  estrutura.innerHTML = `
    <div class="faixa-testes" role="status">
      Ambiente de testes do Asaas: as cobranças emitidas aqui não são reais.
    </div>
    <div class="app">
      <aside class="menu">
        <a class="marca" href="indicadores.html">
          <span class="marca-selo">CASD</span>
          <span class="marca-nome">IntegraCASD</span>
        </a>
        <nav aria-label="Menu principal">${itens}</nav>
        <div class="menu-usuario">
          <strong>Marina Teixeira</strong>
          <span>Diretoria financeira</span>
        </div>
      </aside>
      <div class="conteudo">
        <header class="barra-topo">
          <div class="busca-global">
            ${icone('busca')}
            <input id="busca-aluno" type="search" placeholder="Buscar aluno por nome ou CPF" aria-label="Buscar aluno por nome ou CPF" />
          </div>
          <div class="acoes-rapidas">
            <button class="botao" type="button" data-abrir="dialogo-nova-movimentacao">${icone('mais')}Nova movimentação</button>
            <button class="botao botao-principal" type="button" data-abrir="dialogo-nova-cobranca">${icone('mais')}Nova cobrança</button>
          </div>
        </header>
      </div>
    </div>
    ${DIALOGOS_GLOBAIS}
    <div class="dica-flutuante" hidden></div>
  `;

  estrutura.querySelector('.conteudo').appendChild(conteudoDaPagina);
  document.body.prepend(...estrutura.childNodes);
}

// Diálogos abertos pela barra do topo, disponíveis em todas as telas.
const DIALOGOS_GLOBAIS = `
  <dialog id="dialogo-nova-cobranca" aria-labelledby="titulo-nova-cobranca">
    <form method="dialog">
      <div class="dialogo-cabecalho">
        <div>
          <h2 id="titulo-nova-cobranca">Nova cobrança avulsa</h2>
          <p>O Asaas emite o boleto e envia por e-mail ao aluno.</p>
        </div>
        <button class="botao botao-fantasma botao-pequeno" value="cancelar" aria-label="Fechar">${icone('fechar')}</button>
      </div>
      <div class="dialogo-corpo">
        <div class="formulario">
          <div class="campo inteiro">
            <label for="nc-aluno">Aluno</label>
            <input id="nc-aluno" list="alunos-ficticios" placeholder="Digite o nome ou o CPF" />
            <datalist id="alunos-ficticios">
              <option value="Lucas Andrade Ferreira"></option>
              <option value="Beatriz Moura Lima"></option>
              <option value="Rafael Tavares Costa"></option>
            </datalist>
          </div>
          <div class="campo">
            <label for="nc-valor">Valor</label>
            <input id="nc-valor" inputmode="decimal" placeholder="R$ 0,00" />
          </div>
          <div class="campo">
            <label for="nc-vencimento">Vencimento</label>
            <input id="nc-vencimento" type="date" value="2026-11-10" />
            <span class="dica">Sugerido pelos parâmetros de cobrança.</span>
          </div>
          <div class="campo inteiro">
            <label for="nc-descricao">Descrição</label>
            <input id="nc-descricao" placeholder="Ex.: Camiseta do CASD, inscrição no evento" />
          </div>
        </div>
        <div class="aviso">${icone('relogio')}<span>Multa de 2% e juros de 1% ao mês em caso de atraso, aplicados pelo Asaas conforme os parâmetros vigentes.</span></div>
      </div>
      <div class="dialogo-rodape">
        <button class="botao" value="cancelar">Cancelar</button>
        <button class="botao botao-principal" value="emitir">Emitir cobrança</button>
      </div>
    </form>
  </dialog>

  <dialog id="dialogo-nova-movimentacao" aria-labelledby="titulo-nova-movimentacao">
    <form method="dialog">
      <div class="dialogo-cabecalho">
        <div>
          <h2 id="titulo-nova-movimentacao">Nova movimentação</h2>
          <p>Lançamento manual de entrada ou saída (Pix, dinheiro, cartão, transferência).</p>
        </div>
        <button class="botao botao-fantasma botao-pequeno" value="cancelar" aria-label="Fechar">${icone('fechar')}</button>
      </div>
      <div class="dialogo-corpo">
        <div class="formulario">
          <div class="campo inteiro">
            <span class="rotulo-campo" id="nm-tipo">Tipo</span>
            <div class="segmentado" role="radiogroup" aria-labelledby="nm-tipo">
              <label><input type="radio" name="nm-tipo" value="saida" checked />Saída</label>
              <label><input type="radio" name="nm-tipo" value="entrada" />Entrada</label>
            </div>
          </div>
          <div class="campo">
            <label for="nm-valor">Valor</label>
            <input id="nm-valor" inputmode="decimal" value="R$ 1.200,00" />
          </div>
          <div class="campo">
            <label for="nm-data">Data</label>
            <input id="nm-data" type="date" value="2026-10-19" />
          </div>
          <div class="campo">
            <label for="nm-categoria">Categoria</label>
            <select id="nm-categoria">
              <option>Lavanderia</option>
              <option>Eventos</option>
              <option>Pessoal</option>
              <option>Manutenção</option>
              <option>Material de escritório</option>
            </select>
          </div>
          <div class="campo">
            <label for="nm-forma">Forma de pagamento</label>
            <select id="nm-forma">
              <option>Pix</option>
              <option>Transferência</option>
              <option>Dinheiro</option>
              <option>Cartão</option>
            </select>
          </div>
          <div class="campo">
            <label for="nm-vinculo-tipo">Vincular a</label>
            <select id="nm-vinculo-tipo">
              <option>Contrato</option>
              <option>Projeto</option>
              <option>Funcionário</option>
              <option>Nenhum</option>
            </select>
          </div>
          <div class="campo">
            <label for="nm-vinculo">Contrato</label>
            <select id="nm-vinculo">
              <option>Lavanderia Bem Lavado (manutenção mensal)</option>
              <option>Gráfica Pontual (impressões)</option>
            </select>
          </div>
          <div class="campo inteiro">
            <label for="nm-descricao">Descrição</label>
            <input id="nm-descricao" value="Manutenção das máquinas, outubro/2026" />
          </div>
        </div>
        <div class="aviso">${icone('check')}<span>Valor previsto no contrato: <strong>R$ 1.200,00</strong> por mês. Já pago neste contrato em 2026: <strong>R$ 10.800,00</strong>.</span></div>
      </div>
      <div class="dialogo-rodape">
        <button class="botao" value="cancelar">Cancelar</button>
        <button class="botao botao-principal" value="salvar">Registrar movimentação</button>
      </div>
    </form>
  </dialog>
`;

// Qualquer elemento com data-abrir="id-do-dialogo" abre aquele <dialog>.
function ligarDialogos() {
  document.addEventListener('click', (evento) => {
    const gatilho = evento.target.closest('[data-abrir]');
    if (!gatilho) return;
    const dialogo = document.getElementById(gatilho.dataset.abrir);
    if (dialogo) {
      evento.preventDefault();
      gatilho.closest('details')?.removeAttribute('open');
      // Quem abre o diálogo já sabe o aluno (ex.: tela do aluno): preenchemos para ele não digitar de novo.
      if (gatilho.dataset.aluno) {
        const campoAluno = dialogo.querySelector('#nc-aluno');
        if (campoAluno) campoAluno.value = gatilho.dataset.aluno;
      }
      dialogo.showModal();
    }
  });
}

// Abas: botões role="tab" com aria-controls apontando para o painel.
function selecionarAba(aba) {
  const abas = aba.closest('[role="tablist"]').querySelectorAll('[role="tab"]');
  abas.forEach((outra) => {
    const selecionada = outra === aba;
    outra.setAttribute('aria-selected', String(selecionada));
    document.getElementById(outra.getAttribute('aria-controls')).hidden = !selecionada;
  });
}

function ligarAbas() {
  document.querySelectorAll('[role="tab"]').forEach((aba) => {
    aba.addEventListener('click', () => selecionarAba(aba));
  });
}

// Link direto para revisão: pagina.html#painel-x abre a aba, pagina.html#dialogo-y abre o diálogo.
function abrirPeloEndereco() {
  const alvo = location.hash.slice(1);
  if (!alvo) return;
  const aba = document.querySelector(`[role="tab"][aria-controls="${alvo}"]`);
  if (aba) selecionarAba(aba);
  const elemento = document.getElementById(alvo);
  if (elemento instanceof HTMLDialogElement) elemento.showModal();
}

// Botões que alternam entre pressionado e não pressionado (filtros por situação).
function ligarAlternancias() {
  document.querySelectorAll('[aria-pressed]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const pressionado = botao.getAttribute('aria-pressed') === 'true';
      botao.setAttribute('aria-pressed', String(!pressionado));
    });
  });
}

// Fecha o menu de ações de uma linha ao clicar fora dele.
function ligarMenusDeAcoes() {
  document.addEventListener('click', (evento) => {
    document.querySelectorAll('details.menu-acoes[open]').forEach((menu) => {
      if (!menu.contains(evento.target)) menu.removeAttribute('open');
    });
  });
}

// Dica flutuante: qualquer elemento com data-dica mostra o texto ao passar o mouse.
function ligarDicas() {
  const dica = document.querySelector('.dica-flutuante');
  document.addEventListener('mousemove', (evento) => {
    const alvo = evento.target.closest('[data-dica]');
    if (!alvo) {
      dica.hidden = true;
      return;
    }
    dica.textContent = alvo.dataset.dica;
    dica.hidden = false;
    const margem = 14;
    const largura = dica.offsetWidth;
    const esquerda = Math.min(evento.clientX + margem, window.innerWidth - largura - 8);
    dica.style.left = `${esquerda}px`;
    dica.style.top = `${evento.clientY + margem}px`;
  });
}

// Troca <i data-icone="nome"></i> pelo SVG correspondente, para as páginas não repetirem os ícones.
function preencherIcones() {
  document.querySelectorAll('i[data-icone]').forEach((marcador) => {
    marcador.outerHTML = icone(marcador.dataset.icone);
  });
}

montarEstrutura();
preencherIcones();
ligarDialogos();
ligarAbas();
ligarAlternancias();
ligarMenusDeAcoes();
ligarDicas();
abrirPeloEndereco();
