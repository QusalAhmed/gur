-- Migration: 20261106000001_create_sms_logs_and_settings.sql
-- Description: Creates sms_logs table for tracking SMSBangladesh dispatches and seeds default SMS site settings

-- 1. Create sms_logs table
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    order_number TEXT,
    recipient_phone TEXT NOT NULL,
    status_event TEXT NOT NULL, -- 'placed' | 'confirmed' | 'shipped' | 'delivered' | 'manual' | 'test'
    message_text TEXT NOT NULL,
    gateway TEXT DEFAULT 'smsbangladesh',
    sender_id TEXT,
    is_success BOOLEAN NOT NULL DEFAULT false,
    response_code INTEGER,
    campaign_cost NUMERIC(10, 4) DEFAULT 0,
    api_response JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indices for fast lookup
CREATE INDEX IF NOT EXISTS idx_sms_logs_order_id ON public.sms_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_order_number ON public.sms_logs(order_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON public.sms_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient_phone ON public.sms_logs(recipient_phone);

-- 3. Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Allow service role full access to sms_logs"
    ON public.sms_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to view sms_logs
CREATE POLICY "Allow authenticated users to read sms_logs"
    ON public.sms_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert sms_logs
CREATE POLICY "Allow authenticated users to insert sms_logs"
    ON public.sms_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 4. Seed initial SMS settings in public.site_settings
INSERT INTO public.site_settings (key, value, description)
VALUES
    ('notifications.sms_enabled', 'true'::jsonb, 'Master toggle to enable or disable customer SMS notifications'),
    ('notifications.sms_gateway', '"smsbangladesh"'::jsonb, 'Active SMS gateway provider'),
    ('notifications.smsbangladesh_user', '""'::jsonb, 'SMSBangladesh API username'),
    ('notifications.smsbangladesh_password', '""'::jsonb, 'SMSBangladesh API password'),
    ('notifications.smsbangladesh_from', '"MOLASSES"'::jsonb, 'SMSBangladesh Sender ID or approved masking name'),
    ('notifications.sms_placed_enabled', 'true'::jsonb, 'Send SMS when an order is placed on storefront'),
    ('notifications.sms_confirmed_enabled', 'true'::jsonb, 'Send SMS when an order is confirmed by staff'),
    ('notifications.sms_shipped_enabled', 'true'::jsonb, 'Send SMS when an order is shipped / dispatched'),
    ('notifications.sms_delivered_enabled', 'true'::jsonb, 'Send SMS when an order is delivered'),
    ('notifications.sms_template_placed', '"প্রিয় {customer_name}, আপনার অর্ডার #{order_number} সফলভাবে গৃহীত হয়েছে। মোট বিল: ৳{amount}। খুব শীঘ্রই আমাদের প্রতিনিধি যোগাযোগ করবেন। ধন্যবাদ!"'::jsonb, 'SMS template for order placed'),
    ('notifications.sms_template_confirmed', '"প্রিয় {customer_name}, আপনার অর্ডার #{order_number} কনফার্ম করা হয়েছে। মোট বিল: ৳{amount}। আপনার পার্সেলটি প্যাকিং সম্পন্ন করে দ্রুত পাঠিয়ে দেওয়া হবে। ধন্যবাদ!"'::jsonb, 'SMS template for order confirmed'),
    ('notifications.sms_template_shipped', '"প্রিয় {customer_name}, আপনার অর্ডার #{order_number} {courier_name} কুরিয়ারের মাধ্যমে পাঠানো হয়েছে। ট্র্যাকিং কোড: {tracking_code}। পার্সেল ট্র্যাক করুন: {tracking_url}"'::jsonb, 'SMS template for order shipped'),
    ('notifications.sms_template_delivered', '"প্রিয় {customer_name}, আপনার অর্ডার #{order_number} সফলভাবে ডেলিভারি সম্পন্ন হয়েছে। খেজুরের খাঁটি গুড়-এর সাথে থাকার জন্য ধন্যবাদ!"'::jsonb, 'SMS template for order delivered')
ON CONFLICT (key) DO NOTHING;
