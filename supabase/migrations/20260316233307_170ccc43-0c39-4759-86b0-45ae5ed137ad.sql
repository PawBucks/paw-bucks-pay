
-- Table to track launch clusters and their Pet Fund spot limits
CREATE TABLE public.launch_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  areas text[] NOT NULL DEFAULT '{}',
  max_pet_fund_spots integer NOT NULL DEFAULT 500,
  pet_fund_spots_used integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.launch_clusters ENABLE ROW LEVEL SECURITY;

-- Admins/superadmins can manage, everyone can read active clusters
CREATE POLICY "Anyone can view active launch clusters"
  ON public.launch_clusters FOR SELECT
  USING (is_active = true);

CREATE POLICY "Superadmins can manage launch clusters"
  ON public.launch_clusters FOR ALL
  TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- Track which promotion type each user received
ALTER TABLE public.user_welcome_credits
  ADD COLUMN IF NOT EXISTS promotion_type text NOT NULL DEFAULT 'pet_fund',
  ADD COLUMN IF NOT EXISTS cluster_id uuid REFERENCES public.launch_clusters(id);

-- Function to atomically claim a Pet Fund spot
CREATE OR REPLACE FUNCTION public.claim_pet_fund_spot(p_cluster_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE launch_clusters
  SET pet_fund_spots_used = pet_fund_spots_used + 1,
      updated_at = now()
  WHERE id = p_cluster_id
    AND is_active = true
    AND pet_fund_spots_used < max_pet_fund_spots;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Function to check if Pet Fund spots are available for a cluster
CREATE OR REPLACE FUNCTION public.get_active_promotion(p_cluster_id uuid DEFAULT NULL)
RETURNS TABLE(promotion_type text, cluster_id uuid, cluster_name text, spots_remaining integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cluster RECORD;
BEGIN
  -- If no cluster specified, get first active cluster
  IF p_cluster_id IS NULL THEN
    SELECT * INTO v_cluster FROM launch_clusters WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
  ELSE
    SELECT * INTO v_cluster FROM launch_clusters WHERE id = p_cluster_id AND is_active = true;
  END IF;

  IF NOT FOUND THEN
    -- No active cluster, default to welcome credit
    RETURN QUERY SELECT 'welcome_credit'::text, NULL::uuid, NULL::text, NULL::integer;
    RETURN;
  END IF;

  IF v_cluster.pet_fund_spots_used < v_cluster.max_pet_fund_spots THEN
    RETURN QUERY SELECT 'pet_fund'::text, v_cluster.id, v_cluster.name, (v_cluster.max_pet_fund_spots - v_cluster.pet_fund_spots_used)::integer;
  ELSE
    RETURN QUERY SELECT 'welcome_credit'::text, v_cluster.id, v_cluster.name, 0::integer;
  END IF;
END;
$$;
