# Correções das capturas mobile — 12/11/2026

## Escopo e causas confirmadas

- Início profissional: resposta vazia de configuração de widgets era tratada como painel integralmente oculto. Aplicado layout padrão, preservando ocultação explícita.
- Login: removida a opção WhatsApp indisponível.
- Suporte: cabeçalho e retorno preservados no carregamento/erro; falha no histórico não apaga o chamado.
- Revisão de qualidade: após confirmação do servidor, volta à fila sem depender do botão do alerta. Bloqueio de envio duplicado e retorno nos estados de erro.
- Documentos: decodificador usava a chave JavaScript `documentEvidence` como bucket, em vez de `document-evidence`. Consultas simultâneas são deduplicadas.
- Relatórios: cartões sem encolhimento, escopo por agente/município e acesso específico de agente/supervisor condicionado ao recurso contratado.
- Assinatura: contexto e cache separados por usuário; contexto ausente não concede recursos; falha na atualização preserva dados confirmados. Reconciliação de ciclos individuais preparada em migração isolada, sem simular pagamento nem zerar consumo.
- Limites: falha online na consulta não equivale a autorização. Coleta explicitamente offline mantém operação diferida. Envio final do formulário protegido contra toque duplicado.

## Entrega e limitações

Validação: suíte mobile completa 64/64 conjuntos, 443/443 testes antes dos dois últimos ajustes de assinatura; helpers finais 15/15 e regressões SQL/PGlite passaram após esses ajustes. Portal de cobrança 30/30; build de produção do dashboard passou. Bundle iOS minificado do Expo retornou HTTP 200 (4.049.010 bytes). Uma repetição do teste de contexto excedeu 5 segundos sob carga; a suíte completa e a execução focada anterior desse contexto haviam passado. Não houve alteração de timeout nos arquivos de teste.

As alterações são locais. Migrações novas de ciclo individual e limite do proprietário não foram aplicadas remotamente nesta correção.

O checkout em produção retorna `payment_provider_not_configured`; a interface agora apresenta essa condição. Pagamento real exige configuração do provedor, que não pode ser inferida a partir de um status local.

Não houve validação física no iPhone. Revalidar após publicação: conta profissional/Início; login sem WhatsApp; suporte abrir/voltar; aprovar QE e conferir fila; abrir PDF/ciência; relatórios por perfil; consumo e vencimento com conta de teste; coleta offline e sincronização posterior.
