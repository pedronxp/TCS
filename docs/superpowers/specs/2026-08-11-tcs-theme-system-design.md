# Sistema de temas Escuro e Claro do TCS

## Objetivo

Aplicar ao TCS a linguagem visual da referência aprovada: fundos grafite, superfícies discretas, bordas de baixo contraste e tipografia branco-fria. O sistema terá somente os modos **Escuro** e **Claro** como aparências oficiais. Os dois usam os mesmos papéis semânticos e não competem com as cores de risco.

## Experiência aprovada

- Na primeira abertura, o TCS respeita a aparência definida no aparelho.
- Em **Preferências > Aparência**, o usuário encontra dois cartões grandes: **Escuro** e **Claro**.
- Tocar em um cartão aplica o modo imediatamente, atualiza a prévia e persiste a escolha localmente.
- A pessoa pode voltar a seguir o dispositivo pelo controle já existente de preferência do sistema.
- As cores R1–R4 continuam exclusivas para níveis de risco, alertas e estados operacionais; elas não serão usadas em botões, cabeçalhos ou decoração.

## Tokens de cor

Os componentes passam a usar somente tokens semânticos providos por `ThemeContext`. Nenhuma tela nova deve introduzir valores hexadecimais locais.

| Papel | Escuro | Claro |
| --- | --- | --- |
| Canvas / `background` | `#1B1D21` | `#F7F7F8` |
| Superfície / `surface` | `#24272C` | `#FFFFFF` |
| Superfície elevada / `surfaceHighlight` | `#2A2D32` | `#F0F1F2` |
| Borda / `border` | `#353941` | `#D8DBE0` |
| Texto / `text` | `#F1F2F4` | `#202226` |
| Texto secundário / `textSecondary` | `#B6BBC5` | `#68707A` |
| Ação primária / `primary` | `#F1F2F4` | `#202226` |
| Texto sobre ação / `onPrimary` | `#202226` | `#F7F7F8` |

As cores de risco mantêm papéis semânticos separados em cada modo: sucesso/R1, aviso/R2, atenção/R3 e crítico/R4. O contraste entre texto e superfície deve ser preservado em ambos os temas.

## Arquitetura

1. `constants/Colors.ts` contém as duas paletas e cria os tokens de superfície, texto, foco, pressão, sobreposição e risco.
2. `context/ThemeContext.tsx` permanece como a única fonte de verdade. Ele resolve `system`, `dark` e `light`, expõe `theme`, `isDark`, `themeMode` e persiste a preferência em AsyncStorage.
3. A tela de perfil/preferências consome o contexto e renderiza o seletor de Aparência; o cartão é um componente isolado, reutilizável e acessível.
4. Telas e componentes consomem os tokens. Valores de cor fixos que representem interface comum devem ser migrados para o token equivalente; cores de risco permanecem deliberadamente semânticas.

O fluxo é local: escolha do usuário → `setThemeMode` → AsyncStorage + `Appearance.setColorScheme` → re-render do provedor → todos os consumidores recebem a nova paleta. Nenhuma preferência de tema é enviada ao Supabase.

## Estados, acessibilidade e falhas

- O cartão selecionado deve comunicar estado por borda, marca de seleção e rótulo; cor sozinha não é suficiente.
- Os cartões são controles acessíveis, com rótulo, estado selecionado e área de toque adequada.
- Se a leitura de AsyncStorage falhar, a interface usa `system` sem bloquear o acesso e registra o erro técnico existente.
- Se um valor persistido for inválido, ele é ignorado e tratado como `system`.
- O modo de alto contraste/legibilidade não altera a semântica das cores de risco.

## Movimento

A troca de tema é rara e seu objetivo é **indicação de estado/feedback**, não decoração. O seletor terá apenas feedback de seleção: opacidade e leve transformação do cartão em até **160 ms**, com saída forte; a paleta é aplicada imediatamente. Não haverá animação de entrada da tela, deslocamento de layout ou animação contínua.

Com redução de movimento ativada, a seleção elimina a transformação e mantém somente a mudança de cor/contorno. Estados de toque e hover seguem as capacidades da plataforma; não devem depender apenas de hover.

## Verificação

- Testes unitários garantem a resolução correta de `system`, `dark` e `light`, a persistência da escolha e o fallback para preferência inválida/indisponível.
- Testes de tokens confirmam que Escuro e Claro têm superfícies e texto distintos, ações primárias legíveis e cores de risco presentes nos dois modos.
- Teste do seletor confirma aplicação imediata, estado acessível do cartão e restauração ao reabrir o app.
- Verificação manual em Android, iOS e web confirma contraste, status bar e ausência de valores de cor fixos nas telas migradas.

## Fora de escopo

- Temas adicionais, paletas por município, sincronização remota da preferência e personalização de cores pelo cliente.
- Reposicionamento geral de navegação, dashboard ou formulários que não seja necessário para consumir os novos tokens.
