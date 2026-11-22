-- =============================================================================
-- Migration: Clear Generic Courier Delivery Placeholders From Unbooked Orders
-- Timestamp: 2026-11-22
--
-- Cleans up generic placeholders such as 'Courier delivery' or 'courier' in 
-- orders.shipping_method_name where no courier booking/consignment has been made,
-- ensuring courier partner selection starts cleanly empty in admin forms.
-- =============================================================================

BEGIN;

UPDATE public.orders
   SET shipping_method_name = NULL
 WHERE courier_consignment_id IS NULL
   AND (
     lower(trim(coalesce(shipping_method_name, ''))) IN (
       'courier delivery',
       'courier',
       'delivery'
     )
     OR shipping_method_name = 'কুরিয়ার ডেলিভারি'
   );

COMMIT;
