-- Migration: 20261120000003_create_half_kg_four_item_combo.sql
-- Description: Create 0.5kg variants for Patali, Jhola, and Danadar gur,
-- and create the new 4-item combo containing 0.5kg of Patali, Jhola, Danadar, and Chocolate gur for 800 BDT.

DO $$
DECLARE
  v_warehouse_id uuid;
  v_patali_prod_id uuid := '30c1229c-0ab3-4d82-8943-3aa3b2dcdb73';
  v_danadar_prod_id uuid := '065c4e1e-4ca7-4d99-8806-9a1345ae77be';
  v_jhola_prod_id uuid := 'e706d3b7-d450-49a0-93e4-a459aa14319b';
  v_choc_prod_id uuid := '2532f515-814d-4f84-967f-138e7cfe1aed';
  
  v_patali_var_id uuid;
  v_danadar_var_id uuid;
  v_jhola_var_id uuid;
  v_choc_var_id uuid := 'f712ad5d-f7bb-40a0-a3c3-584ae34bcea1';
  
  v_combo_prod_id uuid;
  v_combo_var_id uuid;
  v_virtual_stock numeric;
  v_sort_order integer;
BEGIN
  -- 1. Identify default warehouse
  SELECT id INTO v_warehouse_id
  FROM public.warehouses
  WHERE is_default = true AND is_active = true
  LIMIT 1;

  IF v_warehouse_id IS NULL THEN
    SELECT id INTO v_warehouse_id FROM public.warehouses LIMIT 1;
  END IF;

  -- 2. Ensure 0.5kg variant for Patali Gur
  SELECT id INTO v_patali_var_id
  FROM public.product_variants
  WHERE product_id = v_patali_prod_id AND weight_grams = 500;

  IF v_patali_var_id IS NULL THEN
    INSERT INTO public.product_variants (
      product_id,
      sku,
      name,
      name_bn,
      pack_type,
      net_quantity,
      net_unit,
      price,
      compare_at_price,
      weight_grams,
      is_combo,
      is_default,
      is_active,
      track_inventory,
      stock_status,
      low_stock_threshold,
      sort_order
    ) VALUES (
      v_patali_prod_id,
      'MOL-PAT-500G',
      '0.5 kg (500g)',
      '৫০০ গ্রাম',
      'jar',
      0.500,
      'kg',
      200.00,
      300.00,
      500,
      false,
      false,
      true,
      true,
      'in_stock'::public.stock_status,
      5.000,
      1
    ) RETURNING id INTO v_patali_var_id;

    IF v_warehouse_id IS NOT NULL THEN
      INSERT INTO public.inventory_levels (variant_id, warehouse_id, on_hand, reserved)
      VALUES (v_patali_var_id, v_warehouse_id, 100, 0)
      ON CONFLICT (variant_id, warehouse_id) DO NOTHING;
    END IF;
  END IF;

  -- 3. Ensure 0.5kg variant for Danadar Jhola Gur (Grainy Liquid Gur)
  SELECT id INTO v_danadar_var_id
  FROM public.product_variants
  WHERE product_id = v_danadar_prod_id AND weight_grams = 500;

  IF v_danadar_var_id IS NULL THEN
    INSERT INTO public.product_variants (
      product_id,
      sku,
      name,
      name_bn,
      pack_type,
      net_quantity,
      net_unit,
      price,
      compare_at_price,
      weight_grams,
      is_combo,
      is_default,
      is_active,
      track_inventory,
      stock_status,
      low_stock_threshold,
      sort_order
    ) VALUES (
      v_danadar_prod_id,
      'MOL-DAN-500G',
      '0.5 kg (500g)',
      '৫০০ গ্রাম',
      'jar',
      0.500,
      'kg',
      190.00,
      250.00,
      500,
      false,
      false,
      true,
      true,
      'in_stock'::public.stock_status,
      5.000,
      1
    ) RETURNING id INTO v_danadar_var_id;

    IF v_warehouse_id IS NOT NULL THEN
      INSERT INTO public.inventory_levels (variant_id, warehouse_id, on_hand, reserved)
      VALUES (v_danadar_var_id, v_warehouse_id, 100, 0)
      ON CONFLICT (variant_id, warehouse_id) DO NOTHING;
    END IF;
  END IF;

  -- 4. Ensure 0.5kg variant for Liquid Gur (Jhola Gur)
  SELECT id INTO v_jhola_var_id
  FROM public.product_variants
  WHERE product_id = v_jhola_prod_id AND weight_grams = 500;

  IF v_jhola_var_id IS NULL THEN
    INSERT INTO public.product_variants (
      product_id,
      sku,
      name,
      name_bn,
      pack_type,
      net_quantity,
      net_unit,
      price,
      compare_at_price,
      weight_grams,
      is_combo,
      is_default,
      is_active,
      track_inventory,
      stock_status,
      low_stock_threshold,
      sort_order
    ) VALUES (
      v_jhola_prod_id,
      'MOL-LIQ-500G',
      '0.5 kg (500g)',
      '৫০০ গ্রাম',
      'jar',
      0.500,
      'kg',
      190.00,
      250.00,
      500,
      false,
      false,
      true,
      true,
      'in_stock'::public.stock_status,
      5.000,
      1
    ) RETURNING id INTO v_jhola_var_id;

    IF v_warehouse_id IS NOT NULL THEN
      INSERT INTO public.inventory_levels (variant_id, warehouse_id, on_hand, reserved)
      VALUES (v_jhola_var_id, v_warehouse_id, 100, 0)
      ON CONFLICT (variant_id, warehouse_id) DO NOTHING;
    END IF;
  END IF;

  -- 5. Ensure Chocolate Gur 0.5kg variant inventory exists
  IF v_warehouse_id IS NOT NULL THEN
    INSERT INTO public.inventory_levels (variant_id, warehouse_id, on_hand, reserved)
    VALUES (v_choc_var_id, v_warehouse_id, 100, 0)
    ON CONFLICT (variant_id, warehouse_id) DO NOTHING;
  END IF;

  -- 6. Upsert the new Combo Product
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_sort_order FROM public.products;

  SELECT id INTO v_combo_prod_id
  FROM public.products
  WHERE slug = 'combo-patali-500g-danadar-500g-liquid-500g-chocolate-500g';

  IF v_combo_prod_id IS NULL THEN
    INSERT INTO public.products (
      name,
      name_bn,
      slug,
      status,
      summary,
      summary_bn,
      description,
      description_bn,
      sort_order
    ) VALUES (
      'Combo (Patali 0.5kg + Danadar 0.5kg + Liquid 0.5kg + Chocolate Gur 0.5kg)',
      'কম্বো (৫০০গ্রাম পাটালি + ৫০০গ্রাম দানাদার + ৫০০গ্রাম ঝোলা + ৫০০গ্রাম চকলেট গুড়)',
      'combo-patali-500g-danadar-500g-liquid-500g-chocolate-500g',
      'active',
      'Special Promotional Combo Offer (0.5kg x 4)',
      'স্পেশাল কম্বো অফার প্যাকেজ (৫০০ গ্রাম x ৪)',
      'Special 2kg promotional combo pack including 0.5kg Patali Gur, 0.5kg Grainy Danadar Gur, 0.5kg Liquid Jhola Gur, and 0.5kg Chocolate Gur.',
      'স্পেশাল ২ কেজি কম্বো প্যাকেজ: ৫০০ গ্রাম পাটালি গুড়, ৫০০ গ্রাম দানাদার ঝোলা গুড়, ৫০০ গ্রাম পাতলা ঝোলা গুড় এবং ৫০০ গ্রাম চকলেট গুড়।',
      v_sort_order
    ) RETURNING id INTO v_combo_prod_id;
  END IF;

  -- 7. Upsert the Combo Product Image
  IF NOT EXISTS (SELECT 1 FROM public.product_images WHERE product_id = v_combo_prod_id) THEN
    INSERT INTO public.product_images (
      product_id,
      storage_path,
      is_primary,
      alt_text,
      sort_order
    ) VALUES (
      v_combo_prod_id,
      'https://ik.imagekit.io/qusal/combos/1794757529091-gemini-generated-image-3fpsho3_OZSZ4K9PG.webp',
      true,
      'Combo 0.5kg Patali, Danadar, Jhola and Chocolate Gur',
      0
    );
  END IF;

  -- 8. Upsert the Combo Variant
  SELECT id INTO v_combo_var_id
  FROM public.product_variants
  WHERE product_id = v_combo_prod_id AND is_combo = true;

  IF v_combo_var_id IS NULL THEN
    INSERT INTO public.product_variants (
      product_id,
      sku,
      name,
      name_bn,
      pack_type,
      net_quantity,
      net_unit,
      price,
      compare_at_price,
      weight_grams,
      is_combo,
      is_default,
      is_active,
      track_inventory,
      stock_status,
      low_stock_threshold
    ) VALUES (
      v_combo_prod_id,
      'CMB-COMBO-2K-800',
      'Combo (Patali 0.5kg + Danadar 0.5kg + Liquid 0.5kg + Chocolate Gur 0.5kg)',
      'কম্বো (৫০০গ্রাম পাটালি + ৫০০গ্রাম দানাদার + ৫০০গ্রাম ঝোলা + ৫০০গ্রাম চকলেট গুড়)',
      'box',
      2.000,
      'kg',
      800.00,
      880.00,
      2000,
      true,
      true,
      true,
      true,
      'in_stock'::public.stock_status,
      5.000
    ) RETURNING id INTO v_combo_var_id;
  ELSE
    UPDATE public.product_variants
    SET
      price = 800.00,
      compare_at_price = 880.00,
      weight_grams = 2000,
      is_active = true,
      updated_at = now()
    WHERE id = v_combo_var_id;
  END IF;

  -- 9. Insert Combo Items Recipe (BOM)
  DELETE FROM public.combo_items WHERE combo_variant_id = v_combo_var_id;

  INSERT INTO public.combo_items (
    combo_variant_id,
    component_variant_id,
    quantity,
    sort_order
  ) VALUES
    (v_combo_var_id, v_patali_var_id, 1, 0),
    (v_combo_var_id, v_danadar_var_id, 1, 1),
    (v_combo_var_id, v_jhola_var_id, 1, 2),
    (v_combo_var_id, v_choc_var_id, 1, 3);

  -- 10. Compute Virtual Inventory for the Combo
  v_virtual_stock := public.get_combo_variant_available_stock(v_combo_var_id);

  IF v_warehouse_id IS NOT NULL THEN
    INSERT INTO public.inventory_levels (
      variant_id,
      warehouse_id,
      on_hand,
      reserved
    ) VALUES (
      v_combo_var_id,
      v_warehouse_id,
      COALESCE(v_virtual_stock, 100),
      0
    )
    ON CONFLICT (variant_id, warehouse_id)
    DO UPDATE SET
      on_hand = EXCLUDED.on_hand,
      updated_at = now();
  END IF;

  UPDATE public.product_variants
  SET
    stock_status = CASE
      WHEN COALESCE(v_virtual_stock, 100) > 5 THEN 'in_stock'::public.stock_status
      WHEN COALESCE(v_virtual_stock, 100) > 0 THEN 'low_stock'::public.stock_status
      ELSE 'out_of_stock'::public.stock_status
    END,
    updated_at = now()
  WHERE id = v_combo_var_id;

END $$;
