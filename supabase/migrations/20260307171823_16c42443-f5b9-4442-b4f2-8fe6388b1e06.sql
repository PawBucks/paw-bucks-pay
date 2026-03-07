ALTER TABLE public.welcome_credit_analytics DROP CONSTRAINT welcome_credit_analytics_event_type_check;

ALTER TABLE public.welcome_credit_analytics ADD CONSTRAINT welcome_credit_analytics_event_type_check 
CHECK (event_type = ANY (ARRAY[
  'credit_issued'::text, 
  'credit_used'::text, 
  'credit_expired'::text, 
  'credit_revoked'::text, 
  'merchant_opted_in'::text, 
  'merchant_opted_out'::text, 
  'abuse_detected'::text,
  'credit_blocked'::text,
  'credit_skipped_program_paused'::text,
  'phase_2_unlocked'::text
]));