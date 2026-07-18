# Ciência eletrônica de documentos

## Escopo inicial

O TCS permite registrar presencialmente, no aparelho do agente, três resultados para uma versão de relatório/laudo ou termo de interdição:

- ciência confirmada com assinatura manuscrita;
- recusa, com motivo obrigatório;
- impossibilidade de assinatura, com motivo obrigatório.

O recurso registra evidência operacional de apresentação e recebimento. Ele não deve ser descrito como assinatura digital qualificada, certificação ICP-Brasil ou validação biométrica da identidade.

## Declaração inicial

Versão `tcs-ack-v1`:

> Declaro que tive acesso ao documento apresentado, recebi as orientações nele registradas e estou ciente de seu conteúdo. Esta ciência registra o recebimento e não substitui assinatura digital qualificada.

Qualquer mudança de texto exige nova versão. Eventos antigos permanecem associados ao texto exibido no momento da coleta.

## Campos mínimos

Para ciência confirmada:

- nome do destinatário;
- relação declarada com o imóvel ou atendimento;
- confirmação explícita da declaração;
- assinatura manuscrita não vazia;
- agente, documento/versão, hashes, aparelho pseudonimizado e horários do dispositivo e servidor.

Para recusa ou impossibilidade:

- nome e relação do destinatário;
- resultado e motivo;
- testemunha quando a política institucional exigir.

CPF ou outro identificador civil não é obrigatório nesta versão. Sua inclusão depende de finalidade documentada, revisão jurídica/de privacidade e política de retenção aprovada.

## Funcionamento offline

Sem internet, a tela mostra `Pendente de sincronização` e não emite protocolo definitivo. O PDF e a evidência permanecem no diretório privado do aplicativo. Ao reconectar, a fila usa o mesmo `client_event_id`, envia somente etapas pendentes e finaliza o registro idempotentemente. O arquivo temporário só é removido depois de a cópia remota autenticada estar disponível.

Falhas permanentes como perda de autorização permanecem visíveis. O usuário deve abrir o registro e usar **Tentar sincronizar novamente** após corrigir a sessão ou solicitar suporte.

## Integridade e comprovante

Cada versão preserva:

- snapshot canônico e versão do template;
- SHA-256 do conteúdo;
- SHA-256 dos bytes do PDF;
- PDF original em Storage privado.

O comprovante é separado do documento apresentado. A exportação combinada cria uma cópia com o comprovante anexado e não substitui os arquivos-fonte.

## Segurança e retenção

- Buckets e tabelas permanecem privados, com acesso por RLS e URLs assinadas curtas.
- Eventos confirmados não aceitam edição ou exclusão direta; correções e invalidações são novos eventos auditados.
- Nome, assinatura e motivo não devem aparecer em logs ou telemetria.
- O modo treinamento é marcado como sem validade operacional e não sincroniza evidência real.
- O prazo de retenção e o atendimento a solicitações de titulares devem ser aprovados por cada contratante antes do piloto. Até essa aprovação, não automatizar exclusões de evidências confirmadas.

## Implantação e suporte

1. Aplicar a migração e executar os testes SQL/RLS em ambiente de homologação.
2. Habilitar o recurso com `EXPO_PUBLIC_ELECTRONIC_ACKNOWLEDGEMENT=true`, limitar tipos em `EXPO_PUBLIC_ELECTRONIC_ACKNOWLEDGEMENT_TYPES` e, no piloto, informar os UUIDs permitidos em `EXPO_PUBLIC_ELECTRONIC_ACKNOWLEDGEMENT_ORGANIZATIONS`.
3. Validar Android e iOS com coleta online, offline, retry, rotação, acessibilidade, comprovante e exportação.
4. Monitorar falhas de sincronização e objetos enviados sem evento finalizado.
5. Em incidente, desabilitar novas coletas e manter os registros existentes somente para leitura; nunca apagar evidências como mecanismo de rollback.

Ao abrir chamado, informar apenas IDs de vistoria, documento e evento. Não copiar nome ou assinatura do destinatário em canais de suporte sem necessidade e autorização.
