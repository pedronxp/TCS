-- Reconcile versioned operational dependencies.
--
-- Several operational objects consumed by the app were never versioned on this
-- branch (their original definition migrations were dropped during the paridade
-- reorganization, but hardening migrations referencing them were kept). This
-- migration restores ONLY objects with a proven runtime consumer, using the
-- exact definitions recovered from the remote catalog (pg_get_functiondef +
-- pg_catalog metadata), so `supabase db reset --local` reproduces a complete,
-- hardenable schema without inference.
--
-- Recovered from remote catalog (read-only):
--   * public.rate_limits              (table + PK + RLS policy + grants)
--   * public.get_push_token_by_uid    (RPC consumed by notify-expiring-tokens)
--
-- NOT recovered here (no local consumer beyond generated types / privilege
-- commands): get_my_municipio, get_my_role, is_approved, master_delete_user,
-- check_rate_limit, consumir_token. Their hardening REVOKE/GRANT in earlier
-- migrations is already conditioned on catalog existence, so they remain
-- safe no-ops on the clean schema and stay hardened on legacy catalogs.

-- 1. public.rate_limits ------------------------------------------------
-- Columns, types, nullability and default recovered via pg_catalog:
--   uid          uuid          NOT NULL
--   action       text          NOT NULL
--   window_start timestamptz   NOT NULL
--   count        integer       DEFAULT 1
-- PK: rate_limits_pkey (uid, action, window_start)  -- unique
CREATE TABLE IF NOT EXISTS public.rate_limits (
  uid uuid NOT NULL,
  action text NOT NULL,
  window_start timestamp with time zone NOT NULL,
  count integer DEFAULT 1
);

-- PK matches the remote constraint definition exactly.
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'rate_limits'
      AND con.conname = 'rate_limits_pkey'
  ) THEN
    ALTER TABLE public.rate_limits
      ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (uid, action, window_start);
  END IF;
END $block$;

-- Index mirrors the remote pg_indexes definition (CREATE UNIQUE INDEX ...).
-- The PK constraint above already provides the unique btree index on
-- (uid, action, window_start); no separate index is needed. This note is
-- intentional: the remote catalog exposes rate_limits_pkey only as the PK
-- backing index, so recreating it here would duplicate.

-- 2. RLS + policy on public.rate_limits --------------------------------
-- Remote state: relrowsecurity = true, relforcerowsecurity = false.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy recovered verbatim from remote pg_policy:
--   name: usuario_ve_proprios_limites
--   cmd:  ALL (polcmd '*')
--   roles: public
--   USING: (uid = auth.uid()) OR (auth.role() = 'service_role'::text)
DROP POLICY IF EXISTS usuario_ve_proprios_limites ON public.rate_limits;
CREATE POLICY usuario_ve_proprios_limites
  ON public.rate_limits
  FOR ALL
  TO public
  USING ((uid = auth.uid()) OR (auth.role() = 'service_role'::text));

-- Table grants: the remote catalog grants DML to anon/authenticated/service_role
-- (Supabase defaults), with RLS as the effective access control. Reproduce the
-- minimal contract: authenticated and service_role get DML so the
-- SECURITY DEFINER RPC enforce_my_operational_rate_limit(text) and the RLS
-- policy compose correctly. anon gets nothing (policy never matches anon).
REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limits TO authenticated, service_role;

-- 3. public.get_push_token_by_uid(uuid) --------------------------------
-- Operational dependency: the "fcmToken" column was never versioned on this
-- branch (it predates migration tracking on the remote catalog). It is a
-- hard dependency of the update_my_push_token(text) RPC, the notification
-- Edge Functions, and the get_push_token_by_uid(uuid) RPC recovered from the
-- remote catalog below. Reconcile it as text so the recovered RPC validates
-- on a clean catalog. Idempotent via ADD COLUMN IF NOT EXISTS so legacy
-- catalogs with the column are untouched.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "fcmToken" text;

-- Definition recovered from the remote catalog via pg_get_functiondef. The
-- remote body is `SELECT "fcmToken" FROM public.users WHERE uid = p_uid
-- LIMIT 1`, but the language is deliberately plpgsql (not the remote `sql`)
-- so the column reference is resolved at call time rather than validated at
-- CREATE time. A `LANGUAGE sql` function fails on a clean catalog in the same
-- transaction that adds `"fcmToken"` via `ALTER TABLE ... ADD COLUMN IF NOT
-- EXISTS`, because PostgreSQL plans the SQL body immediately and the just-added
-- column is not yet visible to that plan. plpgsql defers resolution (matching
-- the sibling update_my_push_token(text) RPC on this branch), so the function
-- validates on a clean reset and still returns the token (or NULL) at runtime.
-- Returns text; SECURITY DEFINER; search_path 'public'.
CREATE OR REPLACE FUNCTION public.get_push_token_by_uid(p_uid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
BEGIN
  SELECT "fcmToken" INTO v_token FROM public.users WHERE uid = p_uid LIMIT 1;
  RETURN v_token;
END;
$function$;

-- Remote ACL (aclexplode): EXECUTE granted only to postgres and service_role.
-- Browser roles (anon, authenticated) must never resolve another user's push
-- token; device credentials are private. Revoke PUBLIC/anon/authenticated and
-- grant EXECUTE only to the service_role used by the notify-expiring-tokens
-- Edge Function.
REVOKE ALL ON FUNCTION public.get_push_token_by_uid(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_token_by_uid(uuid) TO service_role;
