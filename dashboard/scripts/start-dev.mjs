import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const easConfigPath = new URL('../../eas.json', import.meta.url);
const viteEntry = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

let publicConfig = {};

try {
  const easConfig = JSON.parse(await readFile(easConfigPath, 'utf8'));
  publicConfig = easConfig?.build?.preview?.env ?? {};
} catch (error) {
  console.warn(
    `[dashboard] Não foi possível ler a configuração pública em ${fileURLToPath(easConfigPath)}: ${error.message}`,
  );
}

const environment = {
  ...process.env,
  VITE_SUPABASE_URL:
    process.env.VITE_SUPABASE_URL ?? publicConfig.EXPO_PUBLIC_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY:
    process.env.VITE_SUPABASE_ANON_KEY ?? publicConfig.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  VITE_TURNSTILE_SITE_KEY:
    process.env.VITE_TURNSTILE_SITE_KEY ?? '',
};

const vite = spawn(process.execPath, [viteEntry, ...process.argv.slice(2)], {
  env: environment,
  stdio: 'inherit',
});

vite.on('error', (error) => {
  console.error(`[dashboard] Não foi possível iniciar o Vite: ${error.message}`);
  process.exitCode = 1;
});

vite.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
