/* Gera dashboard/src/data/brazilianMunicipalities.ts a partir da API do IBGE.
 * Execute quando quiser atualizar o catálogo local: node scripts/generate-brazilian-municipalities.mjs */
import { mkdir, writeFile } from 'node:fs/promises';

const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
if (!response.ok) throw new Error(`IBGE respondeu ${response.status}`);
const rows = await response.json();

const entries = rows
  .map((row) => [
    row.microrregiao?.mesorregiao?.UF?.sigla ?? row['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ?? '',
    String(row.nome).replaceAll('\\', '\\\\').replaceAll("'", "\\'"),
  ])
  .sort((left, right) => left[1].localeCompare(right[1], 'pt-BR'));

const body = entries.map(([uf, name]) => `  ['${uf}', '${name}'],`).join('\n');
const file = `/* Gerado por scripts/generate-brazilian-municipalities.mjs (fonte: IBGE). Não editar à mão. */
/** Catálogo local de municípios — o seletor funciona sem depender do IBGE em tempo real. */
export const BRAZILIAN_MUNICIPALITIES: readonly (readonly [uf: string, name: string])[] = [
${body}
];
`;

const target = new URL('../dashboard/src/data/brazilianMunicipalities.ts', import.meta.url);
await mkdir(new URL('.', target), { recursive: true });
await writeFile(target, file);
console.log(`${entries.length} municípios gravados em dashboard/src/data/brazilianMunicipalities.ts`);
