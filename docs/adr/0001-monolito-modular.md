# ADR-0001: Monólito modular como estilo arquitetural

- **Status:** Aceita
- **Data:** 2026-10-09
- **Decisores:** Marcello Ryaj
- **Requisitos relacionados:** [Confiabilidade.NF004], [Hardware e software.NF005]

## Contexto

O IntegraCASD precisa ser entregue como MVP em 2 meses por uma equipe de 4 alunos que estão aprendendo a stack. A carga é pequena: cerca de 800 alunos cobrados por mês e poucos usuários simultâneos.

O sistema será mantido por várias gestões do CASD, por pessoas que não participaram da construção, e deve aceitar funcionalidades novas ao longo do tempo.

Há um requisito que pesa diretamente na estrutura: a baixa de uma cobrança e a criação da movimentação de entrada correspondente precisam acontecer de forma atômica ([Confiabilidade.NF004]). Essas duas operações pertencem a áreas diferentes do domínio (Cobranças e Movimentações).

## Decisão

Vamos construir o backend como um **monólito modular**: uma única aplicação NestJS, implantada como uma unidade e com um único banco PostgreSQL, organizada internamente em módulos com fronteiras explícitas.

- Os módulos seguem as subseções do documento de requisitos: Cadastros, Cobranças, Movimentações, Indicadores e Administração.
- Um módulo só usa outro pelo que ele exporta no `@Module`; nunca importa arquivos internos de outro módulo.
- A API HTTP e o worker são o mesmo código, executado em dois processos.
- Pontos de extensão previsíveis (provedor de pagamento, indicadores, reações a eventos) ficam atrás de interfaces.

## Alternativas consideradas

### Alternativa 1: microsserviços

- **Prós:** escalabilidade e implantação independentes por serviço; isolamento de falhas.
- **Contras:** a baixa atômica exigiria transação distribuída (saga, outbox); maior custo operacional com mais contêineres, pipelines e comunicação de rede.
- **Por que não:** a carga não exige escala independente, a equipe é pequena demais para se beneficiar da autonomia entre serviços, e o requisito de atomicidade se tornaria complexo e frágil.

### Alternativa 2: monólito sem divisão em módulos

- **Prós:** o mais simples de começar.
- **Contras:** sem fronteiras, os módulos passam a acessar as tabelas uns dos outros, e cada mudança afeta partes distantes do sistema.
- **Por que não:** dificultaria o trabalho em paralelo da equipe e a manutenção por gestões futuras.

### Alternativa 3: arquitetura de plugins (microkernel)

- **Prós:** extensibilidade sem tocar no núcleo.
- **Contras:** exige prever agora os pontos de extensão e manter um contrato de plugin estável; dificulta transações e auditoria que atravessam plugins.
- **Por que não:** quem vai estender o sistema são os próprios mantenedores, com acesso ao código-fonte, e as mudanças prováveis atingem o núcleo do domínio, não a periferia.

## Consequências

**Positivas:**

- A baixa atômica é uma transação local do banco.
- Uma única implantação, um único banco para fazer backup.
- Módulos permitem que cada pessoa da equipe trabalhe numa área com poucos conflitos.

**Negativas e riscos:**

- As fronteiras dependem de disciplina e revisão de código, não de uma barreira física.
- Uma falha grave no processo afeta o sistema inteiro (mitigado ao separar API e worker em processos distintos).
- Não é possível escalar partes do sistema de forma independente.

**Quando revisitar:**

Se um módulo passar a ter carga ou ciclo de mudança muito diferente dos outros, por exemplo, se a integração com o Asaas passar a atender outros centros acadêmicos. As fronteiras modulares permitem extrair esse módulo como serviço nesse momento.
