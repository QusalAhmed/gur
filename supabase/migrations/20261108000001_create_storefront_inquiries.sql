-- Migration: Create storefront_inquiries table to bridge WhatsApp and Phone click attribution
CREATE TABLE IF NOT EXISTS public.storefront_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_code text NOT NULL UNIQUE,
  channel text NOT NULL DEFAULT 'whatsapp',
  customer_phone text,
  fbp text,
  fbc text,
  client_ip text,
  user_agent text,
  event_source_url text,
  meta_tracking jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'converted', 'expired')),
  converted_order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storefront_inquiries_ref_code ON public.storefront_inquiries (ref_code);
CREATE INDEX IF NOT EXISTS idx_storefront_inquiries_phone ON public.storefront_inquiries (customer_phone) WHERE customer_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_storefront_inquiries_created_at ON public.storefront_inquiries (created_at DESC);

-- Enable RLS
ALTER TABLE public.storefront_inquiries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public insert of storefront inquiries" ON public.storefront_inquiries;
DROP POLICY IF EXISTS "Allow select of storefront inquiries by ref_code" ON public.storefront_inquiries;
DROP POLICY IF EXISTS "Allow staff update of storefront inquiries" ON public.storefront_inquiries;

-- Allow public / anonymous storefront visitors to insert/upsert inquiries
CREATE POLICY "Allow public insert of storefront inquiries"
  ON public.storefront_inquiries
  FOR INSERT
  WITH CHECK (true);

-- Allow select of storefront inquiries
CREATE POLICY "Allow select of storefront inquiries by ref_code"
  ON public.storefront_inquiries
  FOR SELECT
  USING (true);

-- Allow staff and service role update
CREATE POLICY "Allow staff update of storefront inquiries"
  ON public.storefront_inquiries
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
