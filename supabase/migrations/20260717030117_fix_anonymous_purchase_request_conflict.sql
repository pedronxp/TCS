-- PostgreSQL requires SELECT privilege on columns referenced by ON CONFLICT and
-- RETURNING. There is deliberately no anon SELECT policy, so RLS still exposes
-- zero purchase-request rows through the Data API.
GRANT SELECT (id, contact_email, plan_id, status)
ON public.plan_purchase_requests
TO anon;
