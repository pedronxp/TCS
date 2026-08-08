-- Public professional accounts are enabled. Municipal self-provisioning stays
-- disabled because municipal users must join through an organization invite.
UPDATE public.subscription_settings
SET individual_bootstrap_enabled = true,
    municipal_bootstrap_enabled = false,
    updated_at = now()
WHERE singleton;
