-- Migration: Create customer_delivery_reports table to store customer fraud check & delivery record
CREATE TABLE IF NOT EXISTS public.customer_delivery_reports (
  phone TEXT PRIMARY KEY,
  delivery_ratio NUMERIC(5, 2),
  cancellation_ratio NUMERIC(5, 2),
  return_ratio NUMERIC(5, 2),
  volume_band TEXT,
  volume_range TEXT,
  delivered_count INT,
  cancelled_count INT,
  total_reports INT DEFAULT 0,
  fraud_categories JSONB DEFAULT '{}'::jsonb,
  doubtful_reports BOOLEAN DEFAULT false,
  raw_response JSONB,
  stored_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for timestamp queries and cache expiration checks
CREATE INDEX IF NOT EXISTS idx_customer_delivery_reports_updated_at 
  ON public.customer_delivery_reports (updated_at);

-- Enable RLS
ALTER TABLE public.customer_delivery_reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (staff / admin) full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_delivery_reports' 
    AND policyname = 'Allow authenticated staff to read customer delivery reports'
  ) THEN
    CREATE POLICY "Allow authenticated staff to read customer delivery reports"
      ON public.customer_delivery_reports
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_delivery_reports' 
    AND policyname = 'Allow authenticated staff to write customer delivery reports'
  ) THEN
    CREATE POLICY "Allow authenticated staff to write customer delivery reports"
      ON public.customer_delivery_reports
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_delivery_reports' 
    AND policyname = 'Allow anon to read customer delivery reports'
  ) THEN
    CREATE POLICY "Allow anon to read customer delivery reports"
      ON public.customer_delivery_reports
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

