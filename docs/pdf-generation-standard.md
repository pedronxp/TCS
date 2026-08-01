# Padrão de geração de PDFs da Defesa Civil

Versão visual: `defesa-civil-pdf-v2`

## Escopo

O padrão se aplica aos documentos gerados no aplicativo e na web:

- Relatório Técnico de Vistoria;
- Termo de Interdição;
- Comprovante de Ciência;
- laudo de vistoria gerado no aplicativo e disponibilizado no portal web.

## Contrato visual

- Papel A4 retrato.
- Margens laterais simétricas de 16 mm.
- Tipografia sem serifa, com hierarquia curta e legível.
- Azul institucional nos cabeçalhos e títulos de seção.
- Cores R1-R4 reservadas para a classificação de risco.
- Tabelas com coluna de rótulo em fundo neutro e linhas que não são partidas entre páginas.
- Rodapé com identificação institucional, versão do modelo e protocolo.
- A geração web inclui numeração `Página atual/total`; o app não usa contador CSS, pois o motor de impressão pode retornar página zero ou posicionar o contador incorretamente.
- Emojis não são usados no documento para evitar glifos ausentes ou quadrados na impressão.
- O Relatório Técnico de Vistoria usa a mesma composição visual no app e na
  web: logo da Defesa Civil, painel de classificação 60/40, ordem das seções, tabelas,
  base legal e assinatura técnica.

Os tokens compartilhados ficam em
`supabase/functions/_shared/pdfDesignSystem.ts`. O módulo não depende de Expo,
Deno ou `pdf-lib`, podendo ser consumido pelos dois motores.

## Origem do documento oficial

- O aplicativo gera a primeira versão oficial usando o template HTML completo.
- Depois da geração, o aplicativo envia o mesmo arquivo ao bucket `laudos` e
  registra a data da emissão na vistoria.
- O portal web somente cria uma URL temporária para visualizar ou baixar o
  arquivo que já foi sincronizado.
- Se ainda não existir arquivo, a web orienta o operador a gerar o documento no
  aplicativo; ela não monta uma versão alternativa.

## Ordem do Relatório de Vistoria

1. Identificação do documento.
2. Resultado e pontuação de risco.
3. Dados da vistoria.
4. Metodologia, quando aplicável.
5. Itens avaliados.
6. Evidências fotográficas.
7. Observações técnicas.
8. Base legal.
9. Responsabilidade técnica.
10. Rodapé de identificação.

A ciência do destinatário é emitida em comprovante próprio e não cria uma
segunda composição manual dentro do PDF de Vistoria.

## Política de conteúdo

“Conduta Recomendada”, “Coordenadas” e “Formulário utilizado” não são exibidos
no PDF de Vistoria. Esses dados podem continuar existindo no fluxo operacional
e em snapshots antigos, mas são filtrados tanto no gerador do app quanto no
gerador da web.

Uma alteração de estrutura ou conteúdo deve incrementar
`DOCUMENT_TEMPLATE_VERSIONS`, para que a ciência eletrônica continue vinculada
à versão exata apresentada ao destinatário.

## Verificação

Para cada mudança de layout:

1. gerar amostras com conteúdo curto e longo;
2. confirmar tamanho A4 e quantidade de páginas;
3. renderizar todas as páginas em PNG;
4. revisar margens, quebras de tabela, assinatura, rodapé, acentos e imagens;
5. executar os testes do builder, TypeScript e `deno check` da Edge Function.
