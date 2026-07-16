# Validação final do console interno

Data: 16/07/2026
Branch: `codex/reformular-dashboard-interno-donos-programadores`

## Piloto owner

- Perfil ativo, permissões comerciais e exigência de AAL2 validados no banco.
- Fluxos transacionais validados com rollback: cliente, assinatura, plano,
  encerramento de sessão e atualização de suporte.
- Repetição do mesmo `operation_id` devolveu o mesmo resultado e persistiu uma
  única operação.

## Piloto developer

- Perfil ativo e dashboard técnico permitidos.
- Mutation comercial negada diretamente pelo servidor.
- Solicitação de build preview e criação de rascunho de formulário validadas
  em transação com rollback.
- Publicação, versão mínima, gestão de staff e aprovação de produção
  permanecem exclusivas do owner.

## Evidências automatizadas

- Supabase interno: 22/22 asserções pgTAP.
- Isolamento de organizações e cotas: 9/9 asserções pgTAP.
- App mobile: TypeScript sem erros e 127/127 testes Jest.
- Dashboard: build de produção, ESLint e 7/7 testes Vitest.
- Auditoria de dependências do dashboard: 0 vulnerabilidades.
- Lighthouse de acessibilidade na entrada: 95/100 em perfis mobile e desktop,
  sem falhas automáticas ponderadas após correção de labels e nomes de botão.

Os testes de banco executam dentro de `BEGIN`/`ROLLBACK`: nenhuma organização,
assinatura, sessão, chamado, build ou formulário de teste permanece no projeto.
