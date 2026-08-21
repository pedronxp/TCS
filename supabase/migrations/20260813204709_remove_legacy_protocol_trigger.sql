-- The former municipal counter trigger predates immutable server-side protocol
-- allocation and points to a retired table. Leaving it active makes every new
-- inspection fail before sync_finalized_inspection can allocate the official ID.
DROP TRIGGER IF EXISTS trg_gerar_protocolo ON public.vistorias;
