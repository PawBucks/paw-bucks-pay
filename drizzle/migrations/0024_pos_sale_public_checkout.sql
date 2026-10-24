CREATE OR REPLACE FUNCTION public.get_pos_sale_public(_sale_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'merchant_id', s.merchant_id, 'subtotal', s.subtotal, 'discount', s.discount,
    'tax', s.tax, 'tip', s.tip, 'total', s.total, 'status', s.status,
    'business_name', m.business_name, 'logo_url', m.logo_url,
    'payable', (m.stripe_account_id IS NOT NULL AND COALESCE(m.onboarding_complete,false)),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', li.name, 'quantity', li.quantity, 'unit_price', li.unit_price))
                       FROM merchant_pos_sale_items li WHERE li.sale_id = s.id), '[]'::jsonb))
  FROM merchant_pos_sales s JOIN merchants m ON m.id = s.merchant_id
  WHERE s.id = _sale_id AND s.status IN ('awaiting_payment','completed');
$$;
REVOKE EXECUTE ON FUNCTION public.get_pos_sale_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pos_sale_public(uuid) TO anon, authenticated;