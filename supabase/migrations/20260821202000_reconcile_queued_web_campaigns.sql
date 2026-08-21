-- Older Web campaigns could remain queued with no endpoint rows.  Their
-- in-app notifications were already mirrored, so reconcile the delivery
-- ledger with the approved audience and finish the campaign.
INSERT INTO private.notification_campaign_recipients(campaign_id, user_id, platform, provider, endpoint, subscription, status, provider_receipt, attempted_at)
SELECT campaign.id, profile.uid, 'web', 'in_app', 'in_app://' || profile.uid::text, NULL::jsonb, 'sent', jsonb_build_object('channel', 'in_app'), now()
FROM public.notification_campaigns campaign
JOIN public.users profile ON profile."isApproved" = true
  AND (campaign.municipio IS NULL OR profile.municipio = campaign.municipio)
  AND (cardinality(campaign.target_roles) = 0 OR profile.role = ANY(campaign.target_roles))
WHERE campaign.status IN ('queued', 'no_recipients')
  AND 'web' = ANY(campaign.target_platforms)
  AND NOT EXISTS (
    SELECT 1 FROM private.notification_campaign_recipients recipient
    WHERE recipient.campaign_id = campaign.id
  )
ON CONFLICT (campaign_id, user_id, provider, endpoint) DO NOTHING;

UPDATE public.notification_campaigns campaign
SET status = 'completed', completed_at = coalesce(campaign.completed_at, now()), failure_reason = NULL
WHERE campaign.status IN ('queued', 'no_recipients')
  AND 'web' = ANY(campaign.target_platforms)
  AND EXISTS (
    SELECT 1 FROM private.notification_campaign_recipients recipient
    WHERE recipient.campaign_id = campaign.id AND recipient.provider = 'in_app'
  );

NOTIFY pgrst, 'reload schema';
