-- ============================================================
-- DIAGNÓSTICO E CORREÇÃO: Login de conta owner no console
-- Execute esse script no painel SQL do Supabase (projeto de produção).
-- ============================================================

-- 1. Verificar se o usuário existe na tabela auth.users
SELECT id, email, email_confirmed_at, last_sign_in_at, created_at
FROM auth.users
WHERE email ILIKE '%pedro%'  -- <- substitua pelo e-mail real do owner
   OR email ILIKE '%owner%'
ORDER BY created_at;

-- 2. Verificar se o usuário existe em owner_admins (tabela legada)
SELECT oa.user_id, oa.active, oa.created_at, u.email
FROM public.owner_admins oa
LEFT JOIN auth.users u ON u.id = oa.user_id
ORDER BY oa.created_at;

-- 3. Verificar se o usuário existe em internal_staff (tabela nova)
SELECT s.id, s.user_id, s.role, s.status, s.display_name, s.created_at,
       u.email
FROM public.internal_staff s
LEFT JOIN auth.users u ON u.id = s.user_id
ORDER BY s.created_at;

-- ============================================================
-- SE o usuário não estiver em internal_staff com status='active',
-- execute o INSERT abaixo substituindo o UUID correto.
-- Use o id retornado na query 1 acima.
-- ============================================================

-- 4. Inserir/atualizar o owner em internal_staff
-- ATENÇÃO: substitua '<UUID-do-owner>' pelo UUID real do seu usuário
/*
INSERT INTO public.internal_staff (user_id, role, status, display_name, created_by)
VALUES (
  '<UUID-do-owner>',   -- <- cole o id da query 1
  'owner',
  'active',
  'Pedro',             -- <- nome de exibição
  '<UUID-do-owner>'    -- <- mesmo UUID (criado por si mesmo)
)
ON CONFLICT (user_id) DO UPDATE
SET role = 'owner',
    status = 'active',
    display_name = COALESCE(EXCLUDED.display_name, public.internal_staff.display_name),
    updated_at = now();
*/

-- 5. Verificar resultado final
SELECT s.id, s.user_id, s.role, s.status, s.display_name,
       u.email, u.email_confirmed_at
FROM public.internal_staff s
JOIN auth.users u ON u.id = s.user_id
WHERE s.status = 'active' AND s.role = 'owner';
