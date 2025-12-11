-- Grant SELECT permissions to anon and authenticated roles on merchant_service_purchases
GRANT SELECT ON public.merchant_service_purchases TO anon, authenticated;

-- Also ensure the merchant_market_services table has grants for the join
GRANT SELECT ON public.merchant_market_services TO anon, authenticated;