CREATE SEQUENCE IF NOT EXISTS public.order_code_seq;
GRANT USAGE ON SEQUENCE public.order_code_seq TO service_role;
ALTER TABLE public.team_registrations
  ADD COLUMN order_code text UNIQUE DEFAULT ('PED-' || lpad(nextval('public.order_code_seq')::text, 5, '0')),
  ADD COLUMN payment_status text NOT NULL DEFAULT 'aguardando_pagamento' CHECK (payment_status IN ('aguardando_pagamento','aguardando_confirmacao','confirmado','recusado')),
  ADD COLUMN receipt_path text,
  ADD COLUMN paid_claimed_at timestamptz,
  ADD COLUMN decided_at timestamptz,
  ADD COLUMN refusal_reason text;
UPDATE public.team_registrations SET order_code = DEFAULT WHERE order_code IS NULL;