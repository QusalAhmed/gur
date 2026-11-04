-- Seed Brevo transactional email notification settings
insert into public.site_settings (key, value, description, is_public) values
  ('notifications.brevo_enabled',      'true'::jsonb,                                'Enable Brevo transactional email notifications for admin', false),
  ('notifications.brevo_admin_email',  '""'::jsonb,                                  'Admin email address(es) to receive new order notifications (comma-separated)', false),
  ('notifications.brevo_sender_email', '""'::jsonb,                                  'Verified sender email in Brevo account', false),
  ('notifications.brevo_sender_name',  '"খেজুরের খাঁটি গুড়"'::jsonb,                 'Sender display name for Brevo notification emails', false),
  ('notifications.brevo_api_key',      '""'::jsonb,                                  'Brevo API key override (optional; process.env.BREVO_API_KEY takes priority)', false)
on conflict (key) do nothing;

