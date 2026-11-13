#!/usr/bin/env node
/**
 * TCS · Design System builder
 *
 * Fonte única: design-tokens/tokens.json
 * Saídas:
 *   - figcraft/design-system/tokens.css   (custom properties para o guia vivo)
 *   - constants/tokens.ts                 (constantes para o app React Native)
 *   - dashboard/src/design-tokens.css      (custom properties para o console web)
 *
 * O build falha se qualquer par de contraste declarado em `contrast` ficar abaixo
 * do mínimo AA. A governança é por teste, não por revisão visual.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(resolve(root, 'design-tokens/tokens.json'), 'utf8'));

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function flatten(obj, prefix = []) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, [...prefix, kebab(key)]));
    } else {
      out[[...prefix, kebab(key)].join('-')] = value;
    }
  }
  return out;
}

/* ---------- contraste ---------- */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const failures = [];
const rows = [];

for (const pair of tokens.contrast) {
  const ratio = contrastRatio(pair.fg, pair.bg);
  const pass = ratio >= pair.min;
  rows.push({ name: pair.name, fg: pair.fg, bg: pair.bg, ratio: Number(ratio.toFixed(2)), min: pair.min, pass });
  if (!pass) failures.push(`${pair.name}: ${ratio.toFixed(2)}:1 (mínimo ${pair.min}:1)`);
}

/* ---------- CSS ---------- */

const color = flatten(tokens.color);
const radius = flatten(tokens.radius);
const space = flatten(tokens.space);
const size = flatten(tokens.size);
const elevation = flatten(tokens.elevation);
const motion = flatten(tokens.motion);
const type = tokens.type;

const cssVars = [];
for (const [k, v] of Object.entries(color)) cssVars.push(`  --tc-color-${k}: ${v};`);
for (const [k, v] of Object.entries(radius)) cssVars.push(`  --tc-radius-${k}: ${v}px;`);
for (const [k, v] of Object.entries(space)) cssVars.push(`  --tc-space-${k}: ${v}px;`);
for (const [k, v] of Object.entries(size)) cssVars.push(`  --tc-size-${k}: ${v}px;`);
for (const [k, v] of Object.entries(elevation)) cssVars.push(`  --tc-elevation-${k}: ${v};`);
for (const [k, v] of Object.entries(motion)) {
  const name = k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  cssVars.push(`  --tc-motion-${name}: ${v}${typeof v === 'number' ? 'ms' : ''};`);
}
cssVars.push(`  --tc-font-ui: ${tokens.font.ui};`);
cssVars.push(`  --tc-font-mono: ${tokens.font.mono};`);
cssVars.push(`  --tc-font-brand: ${tokens.font.brand};`);
for (const [k, v] of Object.entries(type)) {
  const family = v.family === 'mono' ? 'var(--tc-font-mono)' : v.family === 'brand' ? 'var(--tc-font-brand)' : 'var(--tc-font-ui)';
  cssVars.push(`  --tc-type-${kebab(k)}-size: ${v.size}px;`);
  cssVars.push(`  --tc-type-${kebab(k)}-weight: ${v.weight};`);
  cssVars.push(`  --tc-type-${kebab(k)}-line: ${v.lineHeight}px;`);
  cssVars.push(`  --tc-type-${kebab(k)}-tracking: ${v.tracking}px;`);
  cssVars.push(`  --tc-type-${kebab(k)}-family: ${family};`);
}

const banner = `/* ============================================================
   TCS · Design System ${tokens.version} — tokens gerados
   NÃO EDITE ESTE ARQUIVO. Fonte: design-tokens/tokens.json
   Gerado por: scripts/build-design-tokens.mjs
   ============================================================ */
:root {
${cssVars.join('\n')}
}
`;

mkdirSync(resolve(root, 'figcraft/design-system'), { recursive: true });
mkdirSync(resolve(root, 'dashboard/src'), { recursive: true });
writeFileSync(resolve(root, 'figcraft/design-system/tokens.css'), banner);
writeFileSync(resolve(root, 'dashboard/src/design-tokens.css'), banner);

/* ---------- TypeScript (React Native) ---------- */

const ts = `/**
 * TCS · Design System ${tokens.version} — constantes geradas
 *
 * NÃO EDITE ESTE ARQUIVO. Fonte: design-tokens/tokens.json
 * Gerado por: scripts/build-design-tokens.mjs
 */

export const tcColor = ${JSON.stringify(color, null, 2)} as const;

export const tcRadius = ${JSON.stringify(radius, null, 2)} as const;

export const tcSpace = ${JSON.stringify(space, null, 2)} as const;

export const tcSize = ${JSON.stringify(size, null, 2)} as const;

export const tcMotion = ${JSON.stringify(motion, null, 2)} as const;

export const tcFont = ${JSON.stringify(tokens.font, null, 2)} as const;

export const tcType = ${JSON.stringify(type, null, 2)} as const;

export type TcRisk = 'r1' | 'r2' | 'r3' | 'r4';

export const tcRiskScale: TcRisk[] = ['r1', 'r2', 'r3', 'r4'];
`;

writeFileSync(resolve(root, 'constants/tokens.ts'), ts);

/* ---------- relatório ---------- */

const report = [
  '# Auditoria de contraste — TCS Design System',
  '',
  `Gerado por \`scripts/build-design-tokens.mjs\` a partir de \`design-tokens/tokens.json\` (versão ${tokens.version}).`,
  '',
  '| Par | Primeiro plano | Fundo | Razão | Mínimo | Estado |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows.map(
    (r) =>
      `| ${r.name} | \`${r.fg}\` | \`${r.bg}\` | ${r.ratio}:1 | ${r.min}:1 | ${r.pass ? 'aprovado' : 'FALHA'} |`
  ),
  '',
].join('\n');

mkdirSync(resolve(root, 'docs/design-system'), { recursive: true });
writeFileSync(resolve(root, 'docs/design-system/05-contraste.md'), report);

console.log(`tokens: ${Object.keys(color).length} cores · ${Object.keys(type).length} estilos de texto · ${Object.keys(radius).length} raios`);
console.log(`saídas: figcraft/design-system/tokens.css · dashboard/src/design-tokens.css · constants/tokens.ts · docs/design-system/05-contraste.md`);

if (failures.length) {
  console.error('\ncontraste abaixo do mínimo:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`contraste: ${rows.length}/${rows.length} pares aprovados`);
