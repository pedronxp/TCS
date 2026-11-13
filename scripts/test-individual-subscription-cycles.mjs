import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const actor = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.actor')::uuid $$;
    CREATE TABLE plans(id uuid PRIMARY KEY, current_version int);
    CREATE TABLE plan_versions(id uuid, plan_id uuid, version int, configuration jsonb);
    CREATE TABLE subscriptions(id uuid PRIMARY KEY, user_id uuid, organization_id uuid, plan_id uuid,
      status text, trial_ends_at timestamptz, current_period_start timestamptz, current_period_end timestamptz,
      grace_ends_at timestamptz, canceled_at timestamptz, updated_at timestamptz,
      overrides jsonb DEFAULT '{}', cancel_at_period_end boolean DEFAULT false);
    CREATE TABLE active_sessions(user_id uuid, status text);
    CREATE TABLE test_ledger(consumed int); INSERT INTO test_ledger VALUES (3);
    CREATE FUNCTION public.get_subscription_context() RETURNS jsonb LANGUAGE sql SET search_path = public AS $$
      SELECT jsonb_build_object('organization',null,'subscription',jsonb_build_object('id',s.id,'status',s.status),
        'usage',jsonb_build_array(jsonb_build_object('resource','users','consumed',0),
          jsonb_build_object('resource','sessions','consumed',0),
          jsonb_build_object('resource','inspections','consumed',(SELECT consumed FROM test_ledger))))
      FROM subscriptions s WHERE user_id=auth.uid()
    $$;
    CREATE FUNCTION public.consume_subscription_usage(text,bigint DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
    BEGIN
      IF EXISTS(SELECT 1 FROM subscriptions WHERE user_id=auth.uid() AND status IN ('trial','active','grace')) THEN
        UPDATE test_ledger SET consumed=consumed+$2;
        RETURN '{"allowed":true}'::jsonb;
      END IF;
      RETURN '{"allowed":false}'::jsonb;
    END $$;
    INSERT INTO plans VALUES ('${actor}',1);
    INSERT INTO plan_versions VALUES ('${actor}','${actor}',1,'{"commercial":{"monthly_price_cents":15000,"grace_days":2}}');
    INSERT INTO subscriptions(id,user_id,plan_id,status,current_period_start,current_period_end)
      VALUES ('${actor}','${actor}','${actor}','active',now()-interval '40 days',now()-interval '10 days'),
        ('${other}','${other}','${actor}','active',now()-interval '40 days',now()-interval '10 days');
    INSERT INTO active_sessions VALUES ('${actor}','active'),('${actor}','ended'),('${other}','active');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261112193646_individual_subscription_cycle_reconciliation.sql', import.meta.url), 'utf8'));
  await db.query("select set_config('test.actor',$1,false)", [actor]);
  const context = (await db.query('select public.get_subscription_context() as value')).rows[0].value;
  assert.equal(context.subscription.status, 'past_due');
  assert.deepEqual(context.usage.map(item => item.consumed), [1, 1, 3]);
  assert.equal((await db.query('select status from subscriptions where id=$1', [other])).rows[0].status, 'active');
  assert.equal((await db.query("select public.consume_subscription_usage('inspections',1) as value")).rows[0].value.allowed, false);
  assert.equal((await db.query('select consumed from test_ledger')).rows[0].consumed, 3);
  await db.query("update subscriptions set status='active',current_period_end=now()-interval '1 hour',grace_ends_at=null where id=$1", [actor]);
  assert.equal((await db.query('select public.get_subscription_context() as value')).rows[0].value.subscription.status, 'grace');
  await db.query("update subscriptions set status='active',cancel_at_period_end=true where id=$1", [actor]);
  assert.equal((await db.query('select public.get_subscription_context() as value')).rows[0].value.subscription.status, 'canceled');
  await db.query("update subscriptions set status='active',current_period_end=now()+interval '1 day' where id=$1", [actor]);
  assert.equal((await db.query('select public.get_subscription_context() as value')).rows[0].value.subscription.status, 'active');
  await db.query("update subscriptions set status='trial',trial_ends_at=now()-interval '1 second' where id=$1", [actor]);
  assert.equal((await db.query('select public.get_subscription_context() as value')).rows[0].value.subscription.status, 'expired');
  for (const end of [null, new Date(Date.now() + 86400000).toISOString()]) {
    await db.query("update subscriptions set status='grace',cancel_at_period_end=false,current_period_end=$2,grace_ends_at=now()-interval '1 second' where id=$1", [actor, end]);
    assert.equal((await db.query('select public.get_subscription_context() as value')).rows[0].value.subscription.status, 'past_due');
    assert.equal((await db.query("select public.consume_subscription_usage('inspections',1) as value")).rows[0].value.allowed, false);
  }
  await db.exec(`UPDATE plan_versions SET configuration='{"commercial":{"monthly_price_cents":0,"annual_price_cents":12000}}';`);
  await db.query("update subscriptions set status='active',current_period_end=now()-interval '10 days',grace_ends_at=null,overrides='{}' where id=$1", [actor]);
  const freeMonthly = (await db.query('select public.get_subscription_context() as value')).rows[0].value.subscription;
  assert.equal(freeMonthly.status, 'active'); assert.equal(freeMonthly.renewal_required, false); assert.equal(freeMonthly.billing_cycle, 'monthly');
  await db.query(`update subscriptions set overrides='{"billing_cycle":"annual"}' where id=$1`, [actor]);
  const paidAnnual = (await db.query('select public.get_subscription_context() as value')).rows[0].value.subscription;
  assert.equal(paidAnnual.status, 'past_due'); assert.equal(paidAnnual.renewal_required, true);
  await db.exec(`UPDATE plan_versions SET configuration='{"commercial":{"annual_price_cents":0}}';`);
  await db.query("update subscriptions set status='active' where id=$1", [actor]);
  const freeAnnual = (await db.query('select public.get_subscription_context() as value')).rows[0].value.subscription;
  assert.equal(freeAnnual.status, 'active'); assert.equal(freeAnnual.renewal_required, false);
  console.log('Individual cycle reconciliation: deadline, grace, cancellation, trial, actor isolation, occupancy and preserved ledger passed.');
} finally {
  await db.close();
}
