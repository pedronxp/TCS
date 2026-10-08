/* Falha quando existem versões de migration duplicadas — o `supabase db push`
 * recusa o diretório inteiro nesse caso e nenhuma migration nova chega ao banco.
 * Gere versões sempre com `supabase migration new` (timestamp único). */
import { readdirSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const versions = new Map();
for (const file of readdirSync(new URL('../supabase/migrations', import.meta.url)).sort()) {
  const match = file.match(/^(\d{14})_/);
  if (!match) continue; // nomes legados anteriores ao fluxo do CLI não participam
  const previous = versions.get(match[1]);
  if (previous) throw new Error(`versão duplicada ${match[1]}: ${previous} e ${file}`);
  versions.set(match[1], file);
}

test('todas as versões de migration são únicas', () => {
  assert.ok(versions.size > 0, 'nenhuma migration encontrada no diretório');
  console.log(`✓ ${versions.size} versões de migration únicas`);
});
