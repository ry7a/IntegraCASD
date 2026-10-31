# ADR-0005: Débitos em aberto da planilha como cobranças herdadas, sem Asaas

- **Status:** Proposta
- **Data:** 2026-10-31
- **Decisores:** Ryaj (aguarda a equipe)
- **Requisitos relacionados:** [Confiabilidade.NF005], [Distribuição.NF002], [Indicadores.RF002], [Cobranças.RF004], [Cobranças.RF006]

## Contexto

A planilha do H8 registra, mês a mês, se cada aluno pagou o Fundo de Manutenção. Na carga inicial
de 30/10/2026, 281 dos 890 alunos tinham pelo menos um mês "não pago", alguns com mais de 20. Esses
débitos precisam entrar no sistema: sem eles, a inadimplência ([Indicadores.RF002]) aparece zerada e a
diretoria perde o histórico de quem deve.

A regra [Confiabilidade.NF005] diz que nenhuma cobrança existe só no banco: o Asaas cria primeiro, o
banco grava depois, com o id do Asaas obrigatório. Mas esses débitos não podem ser recriados no Asaas
como estão: o Asaas não aceita vencimento no passado, e emitir boletos novos para meses antigos é uma
decisão de cobrança, não de migração de dados.

## Decisão

Vamos trazer cada mês "não pago" da planilha como uma cobrança aberta de origem nova, `HERDADA`, sem
id do Asaas, e manter a regra para todas as outras origens.

- **No banco:** `id_asaas` passa a aceitar nulo, e um `CHECK` exige que ele seja nulo se e somente se a
  origem é `HERDADA`. Mensalidade e avulsa continuam sempre com id do Asaas.
- **Na aplicação:** nenhuma rota cria cobrança herdada. Só a carga inicial (`scripts/carga-inicial/`) a
  grava. O tipo `OrigemEmitida` impede, já na compilação, que um caso de uso grave uma herdada pelo
  caminho da emissão.
- **Comportamento da herdada:**
  - não tem boleto: a tela orienta a renegociar;
  - fica fora da conciliação, da sincronização e do aviso de "vencidas sem sincronizar";
  - é paga por registro manual ([Cobranças.RF006]), com a entrada na categoria das mensalidades;
  - é cancelada só no banco ([Cobranças.RF004]), porque não há boleto circulando;
  - é renegociada pelo fluxo que já existe: cancela-se a herdada e emite-se uma avulsa no Asaas, com
    vencimento futuro;
  - entra na inadimplência como qualquer cobrança aberta vencida.
- **Mês de referência:** guardado, para a geração recorrente não cobrar de novo um mês que veio da planilha.

## Alternativas consideradas

### Alternativa 1: emitir os atrasados no Asaas na implantação

- **Prós:** a regra NF005 continua sem exceção; o aluno recebe boleto.
- **Contras:** o Asaas não aceita vencimento no passado, então a data original se perde; é preciso
  decidir valores, multa e prazo de cada débito antes da carga; o envio vira cobrança real.
- **Por que não:** mistura migração de dados com uma decisão de cobrança que é da diretoria. A
  renegociação continua disponível depois da carga, aluno a aluno.

### Alternativa 2: tabela própria de "débito anterior à implantação"

- **Prós:** a tabela `cobrancas` não muda; a separação fica explícita.
- **Contras:** inadimplência, aba do aluno, pagamento manual e renegociação teriam de somar duas fontes.
- **Por que não:** duplica regras que a cobrança já tem, e o pagamento e a renegociação desses débitos
  são exatamente os de uma cobrança.

### Alternativa 3: só um relatório, fora do sistema

- **Prós:** nenhuma mudança no modelo.
- **Contras:** a inadimplência fica zerada nas telas; o histórico fica num arquivo solto.
- **Por que não:** a diretoria precisa ver e tratar os débitos no próprio sistema.

## Consequências

**Positivas:**

- A inadimplência mostra a situação real desde o primeiro dia.
- Os débitos antigos são tratados pelos fluxos que já existem: registro manual e renegociação.
- A exceção fica estreita e verificada pelo banco: só a origem `HERDADA` fica sem id do Asaas.

**Negativas e riscos:**

- O código que lê cobranças precisa lidar com `idAsaas` nulo. O TypeScript aponta os lugares, mas uma
  consulta nova à tabela pode esquecer de excluir a herdada do que depende do Asaas.
- Multa e juros da herdada ficam zerados: o valor é o da planilha.

**Quando revisitar:**

- Se surgir outro caso de cobrança fora do Asaas: este ADR não abre exceção para nada além da carga inicial.
