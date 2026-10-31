-- Seed additional site settings for store profile, inventory thresholds, and notification channels
insert into public.site_settings (key, value, description, is_public) values
  ('store.name_bn',                       '"মোলাসেস স্টোর বাংলাদেশ"',                                                     'Store name in Bengali',                                     true),
  ('store.email',                         '"billing@molassesstore.com"',                                                  'Official invoicing and contact email',                      true),
  ('store.address',                       '"24/B Industrial Area, Tejgaon Industrial Area, Dhaka-1208, Bangladesh"',       'Headquarters physical address',                             true),
  ('store.timezone',                      '"Asia/Dhaka"',                                                                 'Store default timezone',                                    true),
  ('store.language',                      '"bn_en"',                                                                      'Default storefront language configuration',                 true),
  ('orders.auto_cancel_cod_hours',        '"48"',                                                                         'Auto-cancel unpaid COD orders after hours threshold',       false),
  ('orders.allow_backorders',             '"no"',                                                                         'Allow customer backorders when out of stock',               false),
  ('inventory.low_stock_threshold_bulk',   '10',                                                                           'Low stock alert threshold for bulk stock in metric tons',   false),
  ('inventory.low_stock_threshold_retail', '20',                                                                           'Low stock alert threshold for retail packs in units',       false),
  ('notifications.sms_gateway',           '"greenweb"',                                                                   'SMS gateway provider',                                      false),
  ('notifications.sms_sender_id',         '"MOLASSES"',                                                                   'Sender ID / Masking name for SMS',                          false),
  ('notifications.smtp_server',           '"smtp.sendgrid.net (Port 587)"',                                               'SMTP transactional email server endpoint',                  false),
  ('store.logo_url',                      '""',                                                                           'Public URL of store business logo',                         true),
  ('store.favicon_url',                   '""',                                                                           'Public URL of store browser favicon icon',                  true),
  ('admin.root_avatar_url',               '""',                                                                           'Root administrator profile avatar URL',                     false),
  ('admin.root_name',                     '"Administrator"',                                                              'Root administrator display name',                           false)
on conflict (key) do nothing;

