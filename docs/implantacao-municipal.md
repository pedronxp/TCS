# Checklist de implantação municipal

## Antes do piloto

- Confirmar responsável institucional e coordenador operacional.
- Criar a organização e revisar nome, UF, contato e referência contratual.
- Definir plano, período, recursos, limites e política de sessão sem ativar cobrança automática.
- Cadastrar o coordenador com vínculo persistido em `organization_members`.
- Revisar e executar o backfill de usuários e vistorias legadas.
- Testar um convite de agente, expiração, uso único e tentativa entre duas prefeituras.
- Confirmar que o coordenador visualiza apenas sua organização.
- Configurar canais e metas de suporte aprovados.

## Treinamento do coordenador

- Criar, copiar e revogar convites.
- Consultar consumo e alertas de 80% e 100%.
- Consultar agentes e encerrar sessão de aparelho perdido.
- Abrir chamado com contexto da organização.
- Explicar tolerância offline e comportamento ao atingir limite.

## Liberação

- Registrar as evidências no checklist de `organization_onboarding`.
- Ativar entitlements e sessão única separadamente no ambiente de teste.
- Somente depois da validação, repetir a ativação para a organização piloto.
