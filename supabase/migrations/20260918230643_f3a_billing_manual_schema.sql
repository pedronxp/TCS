-- ============================================================
-- F3a — Billing manual: tabelas, bucket, RLS
-- Assinatura mensal por org; comprovante manual aprovado pelo owner;
-- avisos programáveis; tolerância configurável.
-- ============================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_day integer;
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_billing_day_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_billing_day_check
  CHECK (billing_day IS NULL OR billing_day BETWEEN 1 AND 31);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id       uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  organization_id       uuid NOT NULL REFERENCES public.organizations(id),
  competencia           text NOT NULL,
  valor_centavos        integer NOT NULL CHECK (valor_centavos > 0),
  vencimento            date NOT NULL,
  status                text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta','em_analise','paga','vencida','cancelada')),
  comprovante_path      text,
  comprovante_enviado_em timestamptz,
  pago_em               timestamptz,
  aprovado_por          uuid,
  motivo_rejeicao       text,
  criado_em             timestamptz NOT NULL DEFAULT now(),
  atualizado_em         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, competencia)
);
CREATE INDEX IF NOT EXISTS billing_invoices_org_idx      ON public.billing_invoices(organization_id);
CREATE INDEX IF NOT EXISTS billing_invoices_status_idx   ON public.billing_invoices(status);
CREATE INDEX IF NOT EXISTS billing_invoices_venc_idx     ON public.billing_invoices(vencimento);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_invoices_select_member ON public.billing_invoices
FOR SELECT TO authenticated
USING (organization_id IN (SELECT my_organization_ids()));

CREATE POLICY billing_invoices_owner_all ON public.billing_invoices
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid() AND active))
WITH CHECK (EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid() AND active));

CREATE TABLE IF NOT EXISTS public.billing_notice_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dias_offset  integer NOT NULL,
  titulo       text NOT NULL CHECK (char_length(titulo) BETWEEN 3 AND 140),
  corpo        text NOT NULL CHECK (char_length(corpo) BETWEEN 3 AND 1000),
  ativo        boolean NOT NULL DEFAULT true,
  criado_por   uuid,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_notice_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_notice_rules_owner_all ON public.billing_notice_rules
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid() AND active))
WITH CHECK (EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid() AND active));

CREATE TABLE IF NOT EXISTS public.billing_settings (
  singleton               boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  tolerancia_dias         integer NOT NULL DEFAULT 5 CHECK (tolerancia_dias BETWEEN 0 AND 60),
  fatura_antecedencia_dias integer NOT NULL DEFAULT 7 CHECK (fatura_antecedencia_dias BETWEEN 1 AND 30),
  atualizado_em           timestamptz NOT NULL DEFAULT now(),
  atualizado_por          uuid
);
INSERT INTO public.billing_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_settings_owner_all ON public.billing_settings
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid() AND active))
WITH CHECK (EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid() AND active));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('comprovantes','comprovantes', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY comprovantes_insert_member ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND ((storage.foldername(name))[1])::uuid IN (SELECT my_organization_ids())
);

CREATE POLICY comprovantes_select_member_owner ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND (
    ((storage.foldername(name))[1])::uuid IN (SELECT my_organization_ids())
    OR EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid() AND active)
  )
);

CREATE POLICY comprovantes_delete_owner ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid() AND active)
);

ALTER TABLE public.notificacoes DROP CONSTRAINT notificacoes_tipo_check;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_tipo_check
CHECK (tipo = ANY (ARRAY['alto_risco','formulario_novo','novo_usuario','limite_firebase','token_usado','atribuicao_nova','cobranca']));
