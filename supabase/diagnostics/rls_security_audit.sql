/**
 * Diagnóstico de Row Level Security (RLS)
 *
 * Analisa políticas RLS, permissões e potenciais vulnerabilidades
 * no banco de dados Supabase
 */

-- ============================================================================
-- PARTE 1: INVENTÁRIO DE TABELAS E RLS
-- ============================================================================

-- Tabelas públicas sem RLS habilitado (RISCO DE SEGURANÇA)
SELECT
  schemaname,
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS DISABLED (RISK!)'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY rowsecurity ASC, tablename;

-- ============================================================================
-- PARTE 2: POLÍTICAS RLS EXISTENTES
-- ============================================================================

-- Listar todas as políticas RLS
SELECT
  schemaname,
  tablename,
  policyname,
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as command,
  CASE
    WHEN permissive THEN 'PERMISSIVE'
    ELSE 'RESTRICTIVE'
  END as type,
  CASE
    WHEN roles::text = '{public}' THEN 'PUBLIC (⚠️)'
    WHEN roles::text LIKE '%authenticated%' THEN 'AUTHENTICATED'
    WHEN roles::text LIKE '%anon%' THEN 'ANONYMOUS'
    ELSE roles::text
  END as applies_to,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- PARTE 3: FUNÇÕES SECURITY DEFINER
-- ============================================================================

-- Funções com SECURITY DEFINER (executam com permissões do owner)
SELECT
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE p.prosecdef
    WHEN true THEN '🔐 SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_mode,
  CASE
    WHEN p.proconfig IS NOT NULL AND
         'search_path' = ANY(SELECT split_part(unnest(p.proconfig), '=', 1))
    THEN '✅ search_path set'
    ELSE '⚠️ search_path NOT set (RISK!)'
  END as search_path_status,
  pg_get_userbyid(p.proowner) as owner
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'private')
  AND p.prosecdef = true
ORDER BY n.nspname, p.proname;

-- ============================================================================
-- PARTE 4: PERMISSÕES DE SCHEMA
-- ============================================================================

-- Permissões no schema private (deve ser restrito)
SELECT
  nspname as schema,
  CASE
    WHEN nspacl IS NULL THEN '⚠️ DEFAULT PERMISSIONS'
    WHEN nspacl::text LIKE '%=UC/%' THEN '❌ PUBLIC HAS ACCESS (CRITICAL!)'
    ELSE '✅ Restricted'
  END as access_status,
  nspacl as acl
FROM pg_namespace
WHERE nspname IN ('public', 'private')
ORDER BY nspname;

-- ============================================================================
-- PARTE 5: TABELAS CRÍTICAS
-- ============================================================================

-- Verificar RLS em tabelas críticas
WITH critical_tables AS (
  SELECT unnest(ARRAY[
    'profiles',
    'organization_members',
    'vistorias',
    'invite_tokens',
    'documentos_gerados',
    'agendamentos',
    'customer_organizations',
    'commercial_subscriptions'
  ]) AS table_name
)
SELECT
  ct.table_name,
  CASE
    WHEN pt.rowsecurity THEN '✅ RLS Enabled'
    WHEN pt.tablename IS NULL THEN '❌ TABLE NOT FOUND'
    ELSE '❌ RLS DISABLED (CRITICAL!)'
  END as status,
  COUNT(pp.policyname) as policy_count
FROM critical_tables ct
LEFT JOIN pg_tables pt ON pt.tablename = ct.table_name AND pt.schemaname = 'public'
LEFT JOIN pg_policies pp ON pp.tablename = ct.table_name AND pp.schemaname = 'public'
GROUP BY ct.table_name, pt.rowsecurity, pt.tablename
ORDER BY status ASC, ct.table_name;

-- ============================================================================
-- PARTE 6: GRANTS PERIGOSOS
-- ============================================================================

-- Verificar se anon ou authenticated têm permissões diretas perigosas
SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type,
  CASE
    WHEN privilege_type IN ('INSERT', 'UPDATE', 'DELETE') AND grantee = 'anon'
    THEN '🚨 CRITICAL: anon can modify data!'
    WHEN privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
    THEN '⚠️ Write permission'
    ELSE '✅ Read only'
  END as risk_level
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'public')
ORDER BY
  CASE
    WHEN privilege_type IN ('INSERT', 'UPDATE', 'DELETE') AND grantee = 'anon' THEN 1
    WHEN privilege_type IN ('INSERT', 'UPDATE', 'DELETE') THEN 2
    ELSE 3
  END,
  table_name;

-- ============================================================================
-- PARTE 7: TRIGGERS DE SEGURANÇA
-- ============================================================================

-- Listar triggers (especialmente os de auth)
SELECT
  event_object_schema as schema,
  event_object_table as table_name,
  trigger_name,
  event_manipulation as trigger_event,
  action_timing as timing,
  action_statement as action
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  OR trigger_name LIKE '%auth%'
  OR trigger_name LIKE '%security%'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- PARTE 8: RESUMO E SCORE DE SEGURANÇA
-- ============================================================================

-- Score de segurança (0-100)
WITH security_metrics AS (
  SELECT
    (SELECT COUNT(*)::float FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) as tables_with_rls,
    (SELECT COUNT(*)::float FROM pg_tables WHERE schemaname = 'public') as total_tables,
    (SELECT COUNT(*)::float FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname IN ('public', 'private') AND p.prosecdef = true
     AND 'search_path' = ANY(SELECT split_part(unnest(p.proconfig), '=', 1))) as safe_definer_functions,
    (SELECT COUNT(*)::float FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname IN ('public', 'private') AND p.prosecdef = true) as total_definer_functions
)
SELECT
  ROUND(
    (
      (tables_with_rls / NULLIF(total_tables, 0) * 50) +
      (safe_definer_functions / NULLIF(total_definer_functions, 0) * 50)
    )::numeric,
    2
  ) as security_score,
  tables_with_rls || '/' || total_tables as rls_coverage,
  safe_definer_functions || '/' || total_definer_functions as safe_functions,
  CASE
    WHEN (tables_with_rls / NULLIF(total_tables, 0)) >= 0.9
         AND (safe_definer_functions / NULLIF(total_definer_functions, 0)) >= 0.9
    THEN '✅ EXCELLENT'
    WHEN (tables_with_rls / NULLIF(total_tables, 0)) >= 0.7
    THEN '⚠️ GOOD - needs attention'
    ELSE '🚨 CRITICAL - immediate action required'
  END as overall_status
FROM security_metrics;

-- ============================================================================
-- RECOMENDAÇÕES
-- ============================================================================

/*
INTERPRETAÇÃO DOS RESULTADOS:

1. TABELAS SEM RLS (❌)
   - Qualquer tabela pública sem RLS permite acesso total
   - AÇÃO: Habilitar RLS imediatamente
   - COMANDO: ALTER TABLE tablename ENABLE ROW LEVEL SECURITY;

2. FUNÇÕES SECURITY DEFINER SEM search_path (⚠️)
   - Vulnerável a SQL injection via search_path
   - AÇÃO: Adicionar SET search_path = '' em todas as funções
   - RISCO: HIGH

3. SCHEMA private COM ACESSO PUBLIC (❌)
   - Schema privado deve ser inacessível
   - AÇÃO: REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;

4. anon COM PERMISSÕES DE ESCRITA (🚨)
   - Usuários anônimos nunca devem modificar dados
   - AÇÃO: REVOKE INSERT, UPDATE, DELETE FROM anon;
   - RISCO: CRITICAL

5. SECURITY SCORE < 70%
   - Sistema tem vulnerabilidades significativas
   - AÇÃO: Revisar e corrigir todos os itens acima

COMANDOS DE CORREÇÃO RÁPIDA:

-- Habilitar RLS em todas as tabelas públicas
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false
  LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;

-- Revogar permissões perigosas de anon
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- Proteger schema private
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
*/
