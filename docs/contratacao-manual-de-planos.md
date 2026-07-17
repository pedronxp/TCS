# Contratação manual de planos

O TCS permite que visitantes e usuários autenticados consultem o catálogo comercial e enviem uma solicitação sem pagamento imediato.

## Jornada do interessado

1. A pessoa abre **Conhecer planos** na entrada pública ou em **Minha assinatura**.
2. Escolhe o público, o ciclo mensal/anual e o plano.
3. Informa os dados de contato e, nos planos municipais, a prefeitura ou órgão.
4. O pedido é registrado como `pending`. Pedidos repetidos para o mesmo e-mail e plano não criam duplicatas.
5. A tela confirma o recebimento sem liberar recursos ou gerar cobrança.

## Jornada administrativa

O master admin acessa **Módulos > Contratações** e pode:

- marcar que o contato comercial foi iniciado;
- recusar e registrar uma observação interna;
- ativar a assinatura manualmente.

Para ativar, o contato precisa possuir uma conta aprovada com o mesmo e-mail. Nos planos municipais, a aprovação cria a organização e vincula o contratante como responsável quando necessário.

## Integração de pagamento futura

O gateway deverá confirmar o pagamento por webhook e resolver o mesmo pedido de contratação. Até essa integração existir, somente a RPC protegida de revisão cria uma assinatura ativa.

## Segurança

- A tabela usa RLS.
- Visitantes podem inserir pedidos válidos, mas não podem consultar pedidos.
- Usuários autenticados visualizam somente seus próprios pedidos.
- A ativação é atômica e exige um usuário presente em `owner_admins`.
- Nenhuma chave privilegiada é enviada ao aplicativo.
