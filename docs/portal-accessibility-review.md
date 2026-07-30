# Revisão de acessibilidade dos portais

Data da revisão: 29 de julho de 2026
Contrato semântico: `1.0.0`

## Web — concluído

- 30 rotas públicas e autenticadas verificadas em 1440, 1024, 768 e 390 px.
- Axe executado no Chromium real com WCAG 2 A/AA, WCAG 2.1 AA e WCAG 2.2 AA, incluindo contraste.
- Cada rota exige exatamente um `main`, exatamente um `h1` e nenhum `id` duplicado.
- A preferência `prefers-reduced-motion: reduce` é aplicada explicitamente antes da navegação; animações e transições acima de 0,1 ms são bloqueadas.
- Em 390 px, controles não textuais e links compostos exigem área mínima de 44 × 44 px.
- Em 390 px, texto a 200% não pode criar overflow horizontal nem ocultar conteúdo ou ações essenciais.
- Cinco fluxos dedicados verificam skip links, ordem de foco do login, menu móvel, `Escape`, retorno de foco e saída do vínculo municipal inativo.
- A árvore assistiva foi inspecionada no navegador para planos, autenticação, convite e retorno do checkout.

Correções resultantes:

- controle de exibição da senha elevado de 40 × 40 para 44 × 44 px;
- marca e links institucionais públicos elevados para 44 px;
- controles do mapa, saída do portal e ações compactas elevados para 44 px;
- convite e retorno do checkout passaram a expor região `main`;
- convite passou a expor título de nível 1;
- emulação de movimento reduzido tornou-se explícita nos testes.

## Android/iOS — concluído por contrato e testes

- Ações dos componentes nativos possuem no mínimo 44 px e a ação principal mantém 46 px.
- Loading é exposto com estado assistivo `busy`.
- Status de assinatura possui nome acessível independente de cor.
- Escala de texto permanece habilitada nos títulos e descrições.
- Pares de texto dos temas claro e escuro são testados com contraste mínimo de 4,5:1.
- Os tons claros de aviso e perigo foram ajustados para atingir contraste AA sobre suas superfícies.

## Checkpoint humano pendente

A tarefa 10.6 permanece aberta até uma pessoa executar e ouvir os fluxos essenciais com leitor de tela
real. A passagem mínima deve cobrir:

1. criar conta e entrar;
2. abrir o menu móvel e navegar para uma seção;
3. compreender loading, vazio, erro e retry;
4. compreender permissão negada e bloqueio por plano;
5. revisar status e ações de assinatura;
6. aceitar ou rejeitar um convite;
7. abrir uma vistoria e acessar o documento;
8. confirmar que o mapa possui alternativa textual.

No Windows, a passagem pode usar Narrador ou NVDA. Em dispositivos, deve usar TalkBack no Android e
VoiceOver no iOS. O aceite deve registrar leitor, plataforma, versão e qualquer problema encontrado.
