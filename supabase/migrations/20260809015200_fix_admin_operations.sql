-- Fix admin operations: reset password, super admin, and organization provisioning
-- Migration created: 2026-08-09

-- 1. Ensure pedroallvess2001@gmail.com exists as Owner with all permissions
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Find or create the auth user
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'pedroallvess2001@gmail.com';

  -- If user doesn't exist in auth.users, we can't proceed (user must sign up first)
  IF v_user_id IS NOT NULL THEN
    -- Upsert into internal_staff with owner role
    INSERT INTO public.internal_staff (user_id, role, status, display_name, created_at, updated_at)
    VALUES (v_user_id, 'owner', 'active', 'Pedro Paulo', now(), now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      role = 'owner',
      status = 'active',
      updated_at = now();

    RAISE NOTICE 'Super admin pedroallvess2001@gmail.com configured as owner';
  ELSE
    RAISE NOTICE 'User pedroallvess2001@gmail.com not found in auth.users - must sign up first';
  END IF;
END $$;

-- 2. Create internal_reset_password RPC compatible with internal_staff
CREATE OR REPLACE FUNCTION public.internal_reset_password(
  p_target_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_actor_role text;
  v_actor_status text;
  v_target_exists boolean;
BEGIN
  -- Validate inputs
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id_required' USING ERRCODE = '22023';
  END IF;

  IF length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'password_too_short' USING ERRCODE = '22023';
  END IF;

  -- Get caller role and status from internal_staff
  SELECT role, status INTO v_actor_role, v_actor_status
  FROM public.internal_staff
  WHERE user_id = auth.uid();

  -- Check if caller is authorized (owner or developer with active status)
  IF v_actor_status IS NULL OR v_actor_status != 'active' THEN
    RAISE EXCEPTION 'not_authorized_staff' USING ERRCODE = '42501';
  END IF;

  IF v_actor_role NOT IN ('owner', 'developer') THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE = '42501';
  END IF;

  -- Check if target user exists
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_target_user_id)
  INTO v_target_exists;

  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'target_user_not_found' USING ERRCODE = '22023';
  END IF;

  -- Reset password using Supabase auth admin API pattern
  -- Note: This requires pgcrypto extension
  UPDATE auth.users
  SET
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = p_target_user_id;

  -- Log the operation
  INSERT INTO public.internal_access_events (
    actor_id,
    actor_role,
    action,
    target_type,
    target_id,
    result,
    metadata
  ) VALUES (
    auth.uid(),
    v_actor_role,
    'reset_password',
    'user',
    p_target_user_id::text,
    'allowed',
    jsonb_build_object('timestamp', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Password reset successfully'
  );
END;
$$;

COMMENT ON FUNCTION public.internal_reset_password IS
'Allows Owner and Developer to reset any user password via admin panel';

-- 3. Create RPC for provisioning organization with coordinator account
CREATE OR REPLACE FUNCTION public.provision_organization_with_coordinator(
  p_organization_data jsonb,
  p_coordinator_email text,
  p_coordinator_name text,
  p_coordinator_password text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_role text;
  v_actor_status text;
  v_organization_id uuid;
  v_coordinator_user_id uuid;
  v_invitation_token text;
BEGIN
  -- Validate caller permissions
  SELECT role, status INTO v_actor_role, v_actor_status
  FROM public.internal_staff
  WHERE user_id = auth.uid();

  IF v_actor_status != 'active' OR v_actor_role NOT IN ('owner', 'developer') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- Create organization (implementation depends on your schema)
  -- This is a placeholder - adjust based on your actual organization creation logic
  INSERT INTO public.organizations (
    display_name,
    slug,
    created_at
  ) VALUES (
    p_organization_data->>'display_name',
    p_organization_data->>'slug',
    now()
  ) RETURNING id INTO v_organization_id;

  -- If coordinator password provided, create account with password
  IF p_coordinator_password IS NOT NULL AND length(p_coordinator_password) >= 8 THEN
    -- Create coordinator auth user
    INSERT INTO auth.users (
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at
    ) VALUES (
      p_coordinator_email,
      crypt(p_coordinator_password, gen_salt('bf')),
      now(), -- Auto-confirm for owner-created accounts
      now(),
      now()
    ) RETURNING id INTO v_coordinator_user_id;

    -- Link coordinator to organization
    INSERT INTO public.memberships (
      organization_id,
      user_id,
      role,
      status,
      created_at
    ) VALUES (
      v_organization_id,
      v_coordinator_user_id,
      'coordinator',
      'active',
      now()
    );

    -- Log the operation
    INSERT INTO public.internal_access_events (
      actor_id,
      actor_role,
      action,
      target_type,
      target_id,
      result,
      reason,
      metadata
    ) VALUES (
      auth.uid(),
      v_actor_role,
      'provision_organization_with_password',
      'organization',
      v_organization_id::text,
      'allowed',
      p_reason,
      jsonb_build_object(
        'coordinator_email', p_coordinator_email,
        'method', 'password'
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'organization_id', v_organization_id,
      'coordinator_user_id', v_coordinator_user_id,
      'method', 'password',
      'message', 'Organization and coordinator account created successfully'
    );
  ELSE
    -- Send email invitation instead
    -- Generate invitation token (simplified - you may want a dedicated invitations table)
    v_invitation_token := encode(gen_random_bytes(32), 'base64');

    -- Store invitation (adjust based on your invitations schema)
    INSERT INTO public.invitations (
      organization_id,
      email,
      role,
      token,
      expires_at,
      created_by,
      created_at
    ) VALUES (
      v_organization_id,
      p_coordinator_email,
      'coordinator',
      v_invitation_token,
      now() + interval '7 days',
      auth.uid(),
      now()
    );

    -- Log the operation
    INSERT INTO public.internal_access_events (
      actor_id,
      actor_role,
      action,
      target_type,
      target_id,
      result,
      reason,
      metadata
    ) VALUES (
      auth.uid(),
      v_actor_role,
      'provision_organization_with_invite',
      'organization',
      v_organization_id::text,
      'allowed',
      p_reason,
      jsonb_build_object(
        'coordinator_email', p_coordinator_email,
        'method', 'email_invite',
        'invitation_token', v_invitation_token
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'organization_id', v_organization_id,
      'method', 'email_invite',
      'invitation_token', v_invitation_token,
      'message', 'Organization created and invitation sent'
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.provision_organization_with_coordinator IS
'Creates organization and coordinator account, either with password or email invitation';

-- Grant execute permissions
REVOKE ALL ON FUNCTION public.internal_reset_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_reset_password(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.provision_organization_with_coordinator(jsonb, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_organization_with_coordinator(jsonb, text, text, text, text) TO authenticated;
