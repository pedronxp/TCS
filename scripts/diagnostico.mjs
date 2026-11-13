#!/usr/bin/env node
/**
 * Diagnóstico executável do TCS.
 *
 * Roda os portões de qualidade do sistema (typecheck, lint, testes, contratos
 * de design e migração) e resume o resultado em uma tabela, com a ordem de
 * execução mais barata primeiro. Serve como o "painel de controle" do plano
 * de debug: se este script verde, o sistema está íntegro para depuração.
 *
 * Uso:
 *   node scripts/diagnostico.mjs            # tudo
 *   node scripts/diagnostico.mjs --rapido   # só os portões baratos (sem suíte de UI)
 *   node scripts/diagnostico.mjs --somente typecheck
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DASHBOARD = join(ROOT, 'dashboard');

const args = process.argv.slice(2);
const RAPIDO = args.includes('--rapido');
const SOMENTE = args.includes('--somente') ? args[args.indexOf('--somente') + 1] : null;

// ── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

const VERDE = `${C.green}OK  ${C.reset}`;
const VERMELHO = `${C.red}FALHA${C.reset}`;
const AMARELO = `${C.yellow}AVISO${C.reset}`;

function titulo(texto) {
  console.log(`\n${C.bold}${C.cyan}━━ ${texto} ${C.reset}`);
}

/**
 * Executa um comando e devolve { ok, duracaoMs, saida }.
 * Nunca lança: uma ferramenta ausente é um portão falho, não um crash do runner.
 */
function executar(comando, args, cwd = ROOT, timeoutMs = 900_000) {
  const inicio = Date.now();
  const resultado = spawnSync(comando, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
  });
  const duracaoMs = Date.now() - inicio;
  const saida = `${resultado.stdout ?? ''}${resultado.stderr ?? ''}`;
  return {
    ok: resultado.status === 0,
    status: resultado.status,
    duracaoMs,
    saida,
    erro: resultado.error ?? null,
  };
}

const portoes = [];
function portao({ id, nome, escopo, critico, rapido = false, requerDashboard = false, executar: run }) {
  portoes.push({ id, nome, escopo, critico, rapido, requerDashboard, run });
}

/**
 * O dashboard tem um `node_modules` próprio, instalado a partir do
 * `dashboard/package-lock.json` (que não traz os pacotes nativos do Expo).
 * O job raiz do CI instala apenas as dependências da raiz — lá, os portões de
 * dashboard não podem rodar. Skip explícito é melhor que um falso verde.
 */
const dashboardInstalado = existsSync(join(DASHBOARD, 'node_modules', '.bin', 'tsc'));

// ── Portão 0: sombra de tipos (barato e causa raiz de outros portões) ───────
/**
 * Distingue duas coisas que uma varredura ingenua de `declare module` confunde:
 *
 *  1. **Sombra real** — um `declare module 'pacote'` dentro do programa do
 *     tsconfig raiz. O tsconfig raiz não restringe `include`, então esse
 *     arquivo passa a definir o tipo daquele pacote para o app inteiro. Foi
 *     exatamente o que aconteceu com `expo-file-system` (o stub gerava
 *     `export const File: any` — um valor sem tipo — e o `File` em posição de
 *     tipo caía no `interface File` do `lib.dom`).
 *
 *  2. **Shim legítimo** — os tipos do módulo nativo dentro do dashboard. O
 *     dashboard web não instala os pacotes do Expo (o CI instala só
 *     `dashboard/package-lock.json`), então precisa de tipos para o
 *     `utils/` compartilhado. Esses shims ficam FORA do programa raiz
 *     (`exclude: ["dashboard"]`) e não sombriam nada.
 *
 * O portão falha quando há sombra real; os shims legítimos são verificados
 * quanto à fidelidade da API (o shim precisa expor a mesma superfície do
 * pacote real, senão esconde erros de verdade).
 */
function detectarDeclaracoesAmbientes() {
  const achados = [];
  const sombra = [];
  const shims = [];
  const ignorar = new Set(['node_modules', '.git', 'dashboard', 'dist', '.laudo-gen-build', 'build']);

  function varrer(dir, profundidade) {
    if (profundidade > 4) return;
    let entradas;
    try {
      entradas = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entrada of entradas) {
      if (ignorar.has(entrada.name)) continue;
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        varrer(caminho, profundidade + 1);
        continue;
      }
      if (!entrada.name.endsWith('.d.ts')) continue;
      let conteudo;
      try {
        conteudo = readFileSync(caminho, 'utf8');
      } catch {
        continue;
      }
      const re = /declare module ['"]([^'"]+)['"]/g;
      let achado;
      while ((achado = re.exec(conteudo)) !== null) {
        const modulo = achado[1];
        const registro = {
          arquivo: relative(ROOT, caminho),
          modulo,
          trecho: conteudo.slice(achado.index, achado.index + 220).replace(/\s+/g, ' '),
          // Um shim que declara tudo como `any` não checa nada — é sombra
          // disfarçada, mesmo que o arquivo esteja num diretório isolado.
          tipado: !/:\s*any\b|as\s+any\b/.test(conteudo),
        };
        achados.push(registro);
        sombra.push(registro);
      }
    }
  }

  varrer(ROOT, 0);

  // Shims do dashboard: ficam fora do programa raiz, então não sombriam o
  // app. Ainda assim precisam cobrir a API real do pacote.
  const dirTipos = join(DASHBOARD, 'src', 'types');
  if (existsSync(dirTipos)) {
    for (const nome of readdirSync(dirTipos)) {
      if (!nome.endsWith('.d.ts')) continue;
      const caminho = join(dirTipos, nome);
      const conteudo = readFileSync(caminho, 'utf8');
      const modulos = [...conteudo.matchAll(/declare module ['"]([^'"]+)['"]/g)].map((m) => m[1]);
      if (modulos.length === 0) continue;
      shims.push({
        arquivo: relative(ROOT, caminho),
        modulos,
        tipado: !/:\s*any\b|as\s+any\b/.test(conteudo),
        // Superfície mínima que o `utils/` compartilhado exige do pacote.
        exige: {
          'expo-file-system': ['base64', 'bytes', 'exists', 'delete', 'downloadFileAsync'],
          'expo-crypto': ['digestStringAsync', 'digest', 'CryptoDigestAlgorithm', 'CryptoEncoding'],
        },
      });
    }
  }

  return { sombra, shims, achados };
}

/** Superfície de API que o `utils/` compartilhado usa de cada pacote nativo. */
const SUPERFICIE_EXIGIDA = {
  'expo-file-system': ['base64', 'bytes', 'exists', 'delete', 'downloadFileAsync'],
  'expo-crypto': ['digestStringAsync', 'digest', 'CryptoDigestAlgorithm', 'CryptoEncoding'],
};

portao({
  id: 'sombras-tipos',
  nome: 'Declarações de módulo ambiente',
  escopo: 'types',
  critico: true,
  rapido: true,
  executar: () => {
    const { sombra, shims } = detectarDeclaracoesAmbientes();
    const problemas = [];

    for (const s of sombra) {
      problemas.push(`${s.arquivo} → module '${s.modulo}'${s.tipado ? '' : ' (tipado como any)'}`);
    }
    for (const shim of shims) {
      for (const modulo of shim.modulos) {
        const exigido = SUPERFICIE_EXIGIDA[modulo];
        if (!exigido) continue;
        const conteudo = readFileSync(join(ROOT, shim.arquivo), 'utf8');
        const faltando = exigido.filter((membro) => !conteudo.includes(membro));
        if (faltando.length > 0) {
          problemas.push(`${shim.arquivo} → module '${modulo}' sem: ${faltando.join(', ')}`);
        }
      }
      if (!shim.tipado) problemas.push(`${shim.arquivo} usa 'any' — shim sem tipagem real`);
    }

    const ok = problemas.length === 0;
    const detalhe = ok
      ? `nenhuma sombra; ${shims.length} shim(s) legítimos com API verificada`
      : `${problemas.length} problema(s)`;
    if (!ok) {
      for (const p of problemas) console.log(`  ${C.yellow}•${C.reset} ${p}`);
    }
    return { ok, detalhe };
  },
});

// ── Portão 1: typecheck do app ─────────────────────────────────────────────
portao({
  id: 'tsc-app',
  nome: 'TypeScript · app Expo',
  escopo: 'app',
  critico: true,
  rapido: true,
  executar: () => {
    const r = executar('npx', ['tsc', '--noEmit', '--pretty', 'false']);
    const erros = (r.saida.match(/error TS\d+/g) ?? []).length;
    return {
      ok: r.ok,
      detalhe: r.ok ? 'sem erros' : `${erros} erro(s) — ${r.saida.split('\n').filter((l) => /error TS/.test(l)).slice(0, 3).join(' | ').slice(0, 160)}`,
    };
  },
});

// ── Portão 2: typecheck do dashboard ───────────────────────────────────────
portao({
  id: 'tsc-dashboard',
  requerDashboard: true,
  nome: 'TypeScript · console/portal',
  escopo: 'dashboard',
  critico: true,
  rapido: true,
  executar: () => {
    const r = executar('npx', ['tsc', '-b', '--force', '--pretty', 'false'], DASHBOARD);
    const erros = (r.saida.match(/error TS\d+/g) ?? []).length;
    return {
      ok: r.ok,
      detalhe: r.ok ? 'sem erros' : `${erros} erro(s) — ${r.saida.split('\n').filter((l) => /error TS/.test(l)).slice(0, 3).join(' | ').slice(0, 160)}`,
    };
  },
});

// ── Portão 3: lint do dashboard ─────────────────────────────────────────────
portao({
  id: 'lint-dashboard',
  requerDashboard: true,
  nome: 'ESLint · console/portal',
  escopo: 'dashboard',
  critico: false,
  rapido: true,
  executar: () => {
    const r = executar('npx', ['eslint', '.', '-f', 'json'], DASHBOARD);
    if (!r.ok && r.status !== 1) {
      return { ok: false, detalhe: `eslint falhou ao rodar (status ${r.status})` };
    }
    let erros = 0;
    let avisos = 0;
    try {
      // A saída pode vir precedida de ruído do npm; extrai o primeiro array JSON.
      const inicioJson = r.saida.indexOf('[');
      const fimJson = r.saida.lastIndexOf(']');
      const relatorio = JSON.parse(r.saida.slice(inicioJson, fimJson + 1));
      for (const arquivo of relatorio) {
        for (const mensagem of arquivo.messages) {
          if (mensagem.severity === 2) erros += 1;
          else avisos += 1;
        }
      }
    } catch {
      return { ok: false, detalhe: 'não foi possível interpretar a saída do eslint' };
    }
    return {
      ok: erros === 0,
      detalhe: erros === 0 ? `${avisos} aviso(s)` : `${erros} erro(s) e ${avisos} aviso(s)`,
    };
  },
});

// ── Portão 4: contratos de design ──────────────────────────────────────────
portao({
  id: 'design',
  nome: 'Contratos de design (manifesto, RLS, Penpot)',
  escopo: 'design',
  critico: false,
  rapido: true,
  executar: () => {
    // Os scripts de validação usam apenas `node` (sem dependências do
    // dashboard), então rodam também no job raiz do CI.
    const scripts = [
      'validate-route-manifest.mjs',
      'validate-design-governance.mjs',
      'validate-penpot-handoff.mjs',
      'validate-portal-boundary.mjs',
    ];
    for (const script of scripts) {
      const r = executar('node', [join(DASHBOARD, 'scripts', script)], DASHBOARD);
      if (!r.ok) {
        return {
          ok: false,
          detalhe: `${script} falhou — ${r.saida.split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 140)}`,
        };
      }
    }
    return { ok: true, detalhe: 'manifesto, governança, Penpot e fronteira do portal válidos' };
  },
});

// ── Portão 5: suíte do app ──────────────────────────────────────────────────
portao({
  id: 'jest-app',
  nome: 'Jest · app Expo',
  escopo: 'app',
  critico: true,
  rapido: false,
  executar: () => {
    const r = executar('npx', ['jest', '--passWithNoTests', '--ci'], ROOT);
    const resumo = r.saida.match(/Tests:\s+(.+)/)?.[1] ?? '';
    const falhas = r.saida.match(/Test Suites:\s+(.+)/)?.[1] ?? '';
    return { ok: r.ok, detalhe: r.ok ? `${resumo}` : `${falhas} · ${resumo}` };
  },
});

// ── Portão 6: suíte do dashboard ────────────────────────────────────────────
portao({
  id: 'vitest-dashboard',
  nome: 'Vitest · console/portal',
  escopo: 'dashboard',
  critico: true,
  rapido: false,
  requerDashboard: true,
  executar: () => {
    const r = executar('npx', ['vitest', 'run', '--exclude=tests/visual/**'], DASHBOARD);
    const arquivos = r.saida.match(/Test Files\s+(.+)/)?.[1] ?? '';
    const testes = r.saida.match(/Tests\s+(.+)/)?.[1] ?? '';
    return { ok: r.ok, detalhe: r.ok ? `${testes}` : `${arquivos} · ${testes}` };
  },
});

// ── Execução ────────────────────────────────────────────────────────────────
const selecionados = SOMENTE
  ? portoes.filter((p) => p.id === SOMENTE)
  : RAPIDO
    ? portoes.filter((p) => p.rapido)
    : portoes;

console.log(`${C.bold}Diagnóstico TCS${C.reset} ${C.dim}(${RAPIDO ? 'modo rápido' : 'completo'})${C.reset}`);
console.log(`${C.dim}${ROOT}${C.reset}`);

const resultados = [];
for (const p of selecionados) {
  if (p.requerDashboard && !dashboardInstalado) {
    console.log(`  ${C.dim}SKIP${C.reset} ${C.dim}dependências do dashboard não instaladas (rode \`npm ci\` em dashboard/)${C.reset}`);
    resultados.push({ ...p, ok: true, pulado: true, detalhe: 'pulado — dependências do dashboard ausentes' });
    continue;
  }
  titulo(`${p.nome}  ${C.dim}[${p.escopo}]${C.reset}`);
  let saida;
  try {
    saida = p.run();
  } catch (erro) {
    saida = { ok: false, detalhe: `exceção: ${erro.message}` };
  }
  const marca = saida.ok ? VERDE : p.critico ? VERMELHO : AMARELO;
  console.log(`  ${marca} ${saida.detalhe}`);
  resultados.push({ ...p, ...saida });
}

console.log(`\n${C.bold}Resumo${C.reset}`);
console.log(`${C.dim}${'─'.repeat(72)}${C.reset}`);
for (const r of resultados) {
  const marca = r.pulado ? `${C.dim}SKIP${C.reset}` : r.ok ? VERDE : r.critico ? VERMELHO : AMARELO;
  const rotulo = `${r.nome} (${r.escopo})`;
  console.log(`${marca} ${rotulo.padEnd(38)} ${C.dim}${r.detalhe}${C.reset}`);
}

const criticosQuebrados = resultados.filter((r) => !r.ok && r.critico);
const naoCriticosQuebrados = resultados.filter((r) => !r.ok && !r.critico);
console.log(`${C.dim}${'─'.repeat(72)}${C.reset}`);
if (criticosQuebrados.length === 0) {
  console.log(`${VERDE} portões críticos íntegros`);
} else {
  console.log(`${VERMELHO} ${criticosQuebrados.length} portão(ões) crítico(s) quebrado(s): ${criticosQuebrados.map((r) => r.id).join(', ')}`);
}
if (naoCriticosQuebrados.length > 0) {
  console.log(`${AMARELO} ${naoCriticosQuebrados.length} portão(ões) não crítico(s) com pendência: ${naoCriticosQuebrados.map((r) => r.id).join(', ')}`);
}
console.log(`${C.dim}Plano completo: docs/debug/PLANO-DE-DEBUG.md · Relatório: docs/debug/RELATORIO-DIAGNOSTICO-ATUAL.md${C.reset}`);

process.exit(criticosQuebrados.length > 0 ? 1 : 0);
