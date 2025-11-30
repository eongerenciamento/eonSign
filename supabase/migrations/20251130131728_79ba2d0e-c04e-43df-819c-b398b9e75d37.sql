-- Create enum for subscription status
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'unpaid', 'trialing', 'incomplete');

-- Table: user_subscriptions
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  plan_name TEXT NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  document_limit INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
  ON public.user_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Table: monthly_document_usage
CREATE TABLE public.monthly_document_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  document_count INTEGER DEFAULT 0 NOT NULL,
  limit_reached_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, month)
);

ALTER TABLE public.monthly_document_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
  ON public.monthly_document_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Table: stripe_webhook_events
CREATE TABLE public.stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed BOOLEAN DEFAULT false NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- No RLS on webhook events (only accessed via Edge Functions)
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Trigger to update updated_at on user_subscriptions
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_document_usage_updated_at
  BEFORE UPDATE ON public.monthly_document_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to increment document count and check limit
CREATE OR REPLACE FUNCTION public.increment_document_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month DATE;
  user_limit INTEGER;
  current_count INTEGER;
BEGIN
  -- Get first day of current month
  current_month := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  -- Get user's document limit from subscription (default to 5 for free tier)
  SELECT COALESCE(document_limit, 5) INTO user_limit
  FROM public.user_subscriptions
  WHERE user_id = NEW.user_id AND status = 'active'
  LIMIT 1;
  
  -- If no subscription found, use free tier limit
  IF user_limit IS NULL THEN
    user_limit := 5;
  END IF;
  
  -- Insert or update usage record
  INSERT INTO public.monthly_document_usage (user_id, month, document_count)
  VALUES (NEW.user_id, current_month, 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    document_count = monthly_document_usage.document_count + 1,
    updated_at = now();
  
  -- Get current count
  SELECT document_count INTO current_count
  FROM public.monthly_document_usage
  WHERE user_id = NEW.user_id AND month = current_month;
  
  -- Check if limit reached
  IF current_count > user_limit THEN
    -- Update limit_reached_at if not already set
    UPDATE public.monthly_document_usage
    SET limit_reached_at = now()
    WHERE user_id = NEW.user_id 
      AND month = current_month 
      AND limit_reached_at IS NULL;
    
    RAISE EXCEPTION 'Document limit reached. You have created % documents this month. Your plan allows %', current_count - 1, user_limit;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on documents table to track usage
CREATE TRIGGER track_document_creation
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_document_usage();