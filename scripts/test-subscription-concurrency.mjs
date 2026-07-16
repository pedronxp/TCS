import { createClient } from '@supabase/supabase-js';

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'TCS_TEST_USER_A_EMAIL', 'TCS_TEST_USER_A_PASSWORD', 'TCS_TEST_USER_B_EMAIL', 'TCS_TEST_USER_B_PASSWORD'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Variáveis ausentes: ${missing.join(', ')}`);

const create = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const clientA = create();
const clientB = create();

const [loginA, loginB] = await Promise.all([
  clientA.auth.signInWithPassword({ email: process.env.TCS_TEST_USER_A_EMAIL, password: process.env.TCS_TEST_USER_A_PASSWORD }),
  clientB.auth.signInWithPassword({ email: process.env.TCS_TEST_USER_B_EMAIL, password: process.env.TCS_TEST_USER_B_PASSWORD }),
]);
if (loginA.error || loginB.error) throw loginA.error || loginB.error;

// Pré-condição do fixture: os dois usuários pertencem à mesma organização e resta uma unidade de "inspections".
const results = await Promise.all([
  clientA.rpc('consume_subscription_usage', { p_resource_code: 'inspections', p_amount: 1 }),
  clientB.rpc('consume_subscription_usage', { p_resource_code: 'inspections', p_amount: 1 }),
]);
const allowed = results.filter(({ data, error }) => !error && data?.allowed === true);
const blocked = results.filter(({ data, error }) => !error && data?.allowed === false && data?.reason === 'limit_reached');
if (allowed.length !== 1 || blocked.length !== 1) {
  throw new Error(`Concorrência inválida: ${JSON.stringify(results.map(r => ({ data: r.data, error: r.error?.message })))}`);
}
console.log('OK: exatamente uma das duas requisições consumiu a última unidade.');
