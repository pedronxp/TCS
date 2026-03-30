---
phase: 01-correcoes-build
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - app.json
autonomous: true
requirements:
  - BUILD-01
  - BUILD-02
  - BUILD-03
  - BUILD-04
  - BUILD-05

must_haves:
  truths:
    - "npx expo install --check passa sem erros de versão incompatível"
    - "Build Android não falha por assets faltando ou malformados"
    - "Zero dependências canary ou pré-release em produção"
    - "npm test executa sem erro de configuração Jest"
    - "app.json não solicita permissões Android sem implementação"
  artifacts:
    - path: "package.json"
      provides: "Dependências alinhadas ao SDK 54, sem canary, sem pacotes mortos"
    - path: "app.json"
      provides: "Permissões Android enxutas, apenas as necessárias ao app"
  key_links:
    - from: "package.json"
      to: "expo SDK 54"
      via: "versões de pacotes alinhadas (tilde, não caret)"
      pattern: "~54\\.0|~[0-9]+\\.0\\.[0-9]+"
    - from: "app.json"
      to: "assets/android-icon-*.png"
      via: "adaptiveIcon foreground/background/monochrome"
      pattern: "foregroundImage|backgroundImage|monochromeImage"
---

<objective>
Corrigir todos os bloqueadores de build do app Defesa Civil Expo: alinhar dependências ao SDK 54,
remover pacotes canary e mortos, e enxugar permissões Android desnecessárias.

Propósito: Garantir que o build de produção APK complete sem erros, eliminando os problemas
críticos identificados na análise de dependências (C2, C3, C6 da CODEBASE_ANALYSIS.md).

Saída: `package.json` limpo com versões SDK 54, `app.json` sem permissões desnecessárias,
configuração Jest funcional.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/CODEBASE_ANALYSIS.md
</context>

<interfaces>
<!-- Estado atual relevante extraído do codebase para referência durante execução -->

De package.json — pacotes com versão errada (SDK 55 enquanto projeto é SDK 54):
  "expo-build-properties": "^55.0.10"   → deve ser "~0.13.0"
  "expo-device":           "^55.0.10"   → deve ser "~7.0.0"
  "expo-file-system":      "^55.0.11"   → deve ser "~18.0.0"
  "expo-font":             "^55.0.4"    → deve ser "~13.0.0"
  "expo-image-manipulator":"^55.0.11"   → deve ser "~13.0.0"
  "expo-sharing":          "^55.0.14"   → deve ser "~13.0.0"
  "expo-notifications":    "^55.0.13"   → deve ser "~0.29.0"

De package.json — pacotes a remover:
  "expo-crypto":           "^55.0.11-canary-20260328-2049187"  (canary + nunca importado)
  "lucide-react-native":   "^1.6.0"                            (nunca importado)

De package.json — configuração Jest com chaves inválidas:
  "setupFilesAfterFramework": []                  → renomear para "setupFilesAfterEnv"
  "testPathPattern": ".*\\.(test|spec)\\.(ts|tsx|js)$" → renomear para "testMatch" com array

De app.json — permissões Android a remover:
  "android.permission.ACCESS_BACKGROUND_LOCATION"  (isAndroidBackgroundLocationEnabled: false)
  "android.permission.USE_BIOMETRIC"               (nenhuma tela implementa biometria)
  "android.permission.USE_FINGERPRINT"             (nenhuma tela implementa biometria)

De assets/ — arquivos existentes confirmados:
  icon.png                    1024x1024 RGB  (OK)
  splash-icon.png             1024x1024 8-bit colormap (OK)
  android-icon-foreground.png 512x512 RGBA   (OK)
  android-icon-background.png 512x512 RGBA   (OK)
  android-icon-monochrome.png 432x432 RGBA   (sub-ideal; mínimo recomendado: 432x432 aceito)
  notification-icon.png       (presente)
</interfaces>

<tasks>

<!-- ═══════════════════════════════════════════════════════════════
     TAREFA 1.1 — Corrigir package.json
     ═══════════════════════════════════════════════════════════════ -->
<task type="auto">
  <name>Tarefa 1.1: Corrigir versões SDK, remover canary e mortos, consertar config Jest</name>

  <files>package.json</files>

  <action>
Editar `package.json` realizando todas as correções abaixo em uma única operação:

**1. Corrigir versões de pacotes SDK 55 → SDK 54 na chave "dependencies":**

Alterar cada pacote conforme a tabela:

| Pacote                    | Versão atual             | Nova versão |
|---------------------------|--------------------------|-------------|
| expo-build-properties     | "^55.0.10"               | "~0.13.0"   |
| expo-device               | "^55.0.10"               | "~7.0.0"    |
| expo-file-system          | "^55.0.11"               | "~18.0.0"   |
| expo-font                 | "^55.0.4"                | "~13.0.0"   |
| expo-image-manipulator    | "^55.0.11"               | "~13.0.0"   |
| expo-sharing              | "^55.0.14"               | "~13.0.0"   |
| expo-notifications        | "^55.0.13"               | "~0.29.0"   |

Usar `~` (tilde) não `^` (caret) para evitar que npm instale versões de patch incompatíveis
com o SDK 54.

**2. Remover completamente da chave "dependencies":**

- Linha `"expo-crypto": "^55.0.11-canary-20260328-2049187"` — remover inteira.
  Justificativa: nenhum arquivo do projeto importa expo-crypto. O UUID é gerado via
  `crypto.randomUUID()` nativo do Hermes engine. Versão canary é pré-release instável.

- Linha `"lucide-react-native": "^1.6.0"` — remover inteira.
  Justificativa: busca em todos os arquivos .ts/.tsx confirma zero imports de lucide-react-native.
  Todos os ícones usam @expo/vector-icons (Feather).

**3. Corrigir a seção "jest" no mesmo arquivo (dois renomes de chave):**

Rename A: `"setupFilesAfterFramework"` → `"setupFilesAfterEnv"`
- O valor `[]` permanece inalterado.
- "setupFilesAfterFramework" não é uma chave Jest válida; a correta é "setupFilesAfterEnv".

Rename B: `"testPathPattern"` → `"testMatch"`, alterando também o valor:
- De: `"testPathPattern": ".*\\.(test|spec)\\.(ts|tsx|js)$"`
- Para: `"testMatch": ["**/?(*.)+(spec|test).[jt]s?(x)"]`
- "testPathPattern" é flag de CLI do Jest, não configuração de arquivo. "testMatch" é
  a forma correta de definir padrão de arquivos de teste na configuração estática.

O bloco "jest" resultante deve ser:

```json
"jest": {
  "preset": "jest-expo",
  "setupFilesAfterEnv": [],
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
  ],
  "moduleFileExtensions": ["ts", "tsx", "js", "jsx"],
  "testMatch": ["**/?(*.)+(spec|test).[jt]s?(x)"],
  "collectCoverageFrom": [
    "utils/**/*.ts",
    "services/**/*.ts",
    "context/**/*.tsx",
    "!**/*.d.ts"
  ],
  "coverageThreshold": {
    "global": {
      "lines": 40
    }
  }
}
```

Não alterar nenhuma outra chave do package.json (scripts, private, name, version, etc.).
  </action>

  <verify>
    <automated>
cd /c/Users/User/Desktop/Projeto/app_defasaCivil/app_defesa_civil_expo && node -e "
const p = require('./package.json');
const d = p.dependencies;
const errors = [];

// Verificar remoção de pacotes mortos/canary
if (d['expo-crypto']) errors.push('expo-crypto ainda presente');
if (d['lucide-react-native']) errors.push('lucide-react-native ainda presente');

// Verificar que não há mais versões SDK 55
const sdk55 = Object.entries(d).filter(([k,v]) => v && v.includes('55.') && k.startsWith('expo-'));
if (sdk55.length) errors.push('Pacotes ainda em SDK55: ' + sdk55.map(([k])=>k).join(', '));

// Verificar chaves Jest
const j = p.jest;
if (j.setupFilesAfterFramework !== undefined) errors.push('Jest: chave inválida setupFilesAfterFramework ainda presente');
if (!Array.isArray(j.setupFilesAfterEnv)) errors.push('Jest: setupFilesAfterEnv ausente ou não é array');
if (j.testPathPattern !== undefined) errors.push('Jest: chave inválida testPathPattern ainda presente');
if (!Array.isArray(j.testMatch)) errors.push('Jest: testMatch ausente ou não é array');

if (errors.length) { console.error('FALHAS:\\n' + errors.join('\\n')); process.exit(1); }
console.log('OK — package.json validado com sucesso');
"
    </automated>
  </verify>

  <done>
- 7 pacotes com versão SDK 55 corrigidos para suas versões SDK 54 correspondentes
- expo-crypto canary removido de dependencies
- lucide-react-native removido de dependencies
- Chave Jest "setupFilesAfterFramework" renomeada para "setupFilesAfterEnv"
- Chave Jest "testPathPattern" renomeada para "testMatch" com valor de array correto
- npm test executa sem avisos de configuração inválida
  </done>
</task>


<!-- ═══════════════════════════════════════════════════════════════
     TAREFA 1.2 — Instalar as dependências atualizadas
     ═══════════════════════════════════════════════════════════════ -->
<task type="auto">
  <name>Tarefa 1.2: Instalar pacotes atualizados e verificar alinhamento com SDK 54</name>

  <files>package-lock.json</files>

  <action>
Com o `package.json` corrigido pela Tarefa 1.1, executar na raiz do projeto:

```bash
npm install
```

Este comando vai:
- Remover `expo-crypto` e `lucide-react-native` de `node_modules/`
- Instalar as versões SDK 54 corretas para os 7 pacotes atualizados
- Atualizar `package-lock.json` automaticamente

Após o `npm install`, executar a verificação oficial do Expo:

```bash
npx expo install --check
```

Este comando compara as versões instaladas contra o manifesto oficial do SDK 54 e lista
incompatibilidades. Objetivo: o comando deve completar sem listar pacotes desalinhados.

Se o comando listar algum pacote ainda incompatível:
1. Verificar qual versão o Expo recomenda na saída do comando
2. Atualizar a versão desse pacote no `package.json` para a versão recomendada
3. Executar `npm install` novamente para esse pacote
4. Repetir até `npx expo install --check` passar limpo

Não usar `npx expo install --fix` pois sobrescreve o arquivo sem revisão manual.
  </action>

  <verify>
    <automated>
cd /c/Users/User/Desktop/Projeto/app_defasaCivil/app_defesa_civil_expo && node -e "
const errors = [];
// Verificar remoção física de node_modules
const fs = require('fs');
const path = require('path');
const cryptoPath = path.join('node_modules', 'expo-crypto');
const lucidePath = path.join('node_modules', 'lucide-react-native');
if (fs.existsSync(cryptoPath)) errors.push('expo-crypto ainda em node_modules');
if (fs.existsSync(lucidePath)) errors.push('lucide-react-native ainda em node_modules');
// Verificar que pacotes SDK 54 estão instalados
const pkgs = ['expo-device','expo-file-system','expo-font','expo-sharing','expo-notifications'];
pkgs.forEach(pkg => {
  const pkgPath = path.join('node_modules', pkg, 'package.json');
  if (!fs.existsSync(pkgPath)) errors.push(pkg + ' não instalado');
});
if (errors.length) { console.error('FALHAS:\\n' + errors.join('\\n')); process.exit(1); }
console.log('OK — node_modules verificado');
"
    </automated>
  </verify>

  <done>
- npm install completa sem erros
- expo-crypto e lucide-react-native ausentes de node_modules/
- 7 pacotes SDK 54 presentes em node_modules/ com versões corretas
- npx expo install --check não lista incompatibilidades de versão
  </done>
</task>


<!-- ═══════════════════════════════════════════════════════════════
     TAREFA 1.3 — Remover permissões Android desnecessárias do app.json
     ═══════════════════════════════════════════════════════════════ -->
<task type="auto">
  <name>Tarefa 1.3: Remover permissões Android não utilizadas do app.json</name>

  <files>app.json</files>

  <action>
Editar `app.json` e remover as três permissões Android desnecessárias do array
`expo.android.permissions`:

**Permissões a remover:**

1. `"android.permission.ACCESS_BACKGROUND_LOCATION"`
   - Motivo: `isAndroidBackgroundLocationEnabled: false` na configuração do plugin
     `expo-location` (linha 85). A permissão está listada mas o recurso está explicitamente
     desabilitado. No Android 12+, essa permissão exige justificativa extra na Play Store.

2. `"android.permission.USE_BIOMETRIC"`
   - Motivo: nenhuma tela do app implementa autenticação biométrica. Permissão sem uso
     é sinalizada como problemática na análise de privacidade do Play Store.

3. `"android.permission.USE_FINGERPRINT"`
   - Motivo: mesmo que USE_BIOMETRIC acima; legado Android pre-28 que também não está
     implementado.

**Permissões que DEVEM permanecer (não remover):**
- CAMERA, RECORD_AUDIO, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE
- READ_MEDIA_IMAGES, READ_MEDIA_VIDEO
- ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION
- INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE
- VIBRATE, RECEIVE_BOOT_COMPLETED, POST_NOTIFICATIONS
- FOREGROUND_SERVICE

O array de permissões resultante deve ter 16 itens (era 19, removidos 3).

Não alterar nenhuma outra configuração do app.json (ícones, splash, plugins, etc.).
  </action>

  <verify>
    <automated>
cd /c/Users/User/Desktop/Projeto/app_defasaCivil/app_defesa_civil_expo && node -e "
const app = require('./app.json');
const perms = app.expo.android.permissions;
const errors = [];
const forbidden = [
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT'
];
forbidden.forEach(p => {
  if (perms.includes(p)) errors.push('Permissão ainda presente: ' + p);
});
const required = ['android.permission.CAMERA','android.permission.INTERNET','android.permission.ACCESS_FINE_LOCATION'];
required.forEach(p => {
  if (!perms.includes(p)) errors.push('Permissão necessária removida por engano: ' + p);
});
if (errors.length) { console.error('FALHAS:\\n' + errors.join('\\n')); process.exit(1); }
console.log('OK — app.json validado: ' + perms.length + ' permissoes restantes');
"
    </automated>
  </verify>

  <done>
- ACCESS_BACKGROUND_LOCATION removida de app.json
- USE_BIOMETRIC removida de app.json
- USE_FINGERPRINT removida de app.json
- 16 permissões Android restantes, todas com implementação no app
- Permissões essenciais (CAMERA, LOCATION, INTERNET, etc.) intactas
  </done>
</task>

</tasks>

<verification>
Verificação global da Fase 1 após todas as tarefas:

1. Checar package.json final:
   ```bash
   node -e "const p=require('./package.json'); console.log('expo principal:', p.dependencies.expo); console.log('expo-crypto:', p.dependencies['expo-crypto'] || 'REMOVIDO OK'); console.log('lucide:', p.dependencies['lucide-react-native'] || 'REMOVIDO OK');"
   ```

2. Verificar alinhamento SDK com o Expo:
   ```bash
   npx expo install --check
   ```
   Esperado: sem warnings de versão incompatível.

3. Executar testes para confirmar config Jest funcional:
   ```bash
   npm test -- --passWithNoTests
   ```
   Esperado: suíte executa sem erros de configuração (pode haver 0 testes, está ok).

4. Checar permissões do app.json:
   ```bash
   node -e "const a=require('./app.json'); console.log('Permissoes:', a.expo.android.permissions.length, 'itens');"
   ```
   Esperado: 16 permissões.
</verification>

<success_criteria>
A Fase 1 está completa quando:
- `npx expo install --check` retorna sem listar nenhum pacote incompatível
- `npm test -- --passWithNoTests` completa sem erros de configuração Jest
- `package.json` não contém nenhuma versão `55.x` em pacotes expo-*, nem canary, nem lucide
- `app.json` contém exatamente 16 permissões Android (sem ACCESS_BACKGROUND_LOCATION,
  USE_BIOMETRIC, USE_FINGERPRINT)
- `npx expo run:android` ou build APK não falha por problemas de dependência ou permissão
</success_criteria>

<output>
Após conclusão, criar `.planning/phases/01-correcoes-build/01-correcoes-build-01-SUMMARY.md`
com:
- Lista de todas as alterações feitas em package.json (antes/depois por pacote)
- Lista das 3 permissões removidas do app.json
- Resultado de `npx expo install --check`
- Resultado de `npm test`
- Qualquer desvio do plano encontrado durante execução
</output>
