-- Create envelopes table
CREATE TABLE public.envelopes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on envelopes
ALTER TABLE public.envelopes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for envelopes
CREATE POLICY "Users can view their own envelopes" 
ON public.envelopes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own envelopes" 
ON public.envelopes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own envelopes" 
ON public.envelopes FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own envelopes" 
ON public.envelopes FOR DELETE 
USING (auth.uid() = user_id);

-- Add envelope_id column to documents table
ALTER TABLE public.documents ADD COLUMN envelope_id uuid REFERENCES public.envelopes(id) ON DELETE CASCADE;

-- Update the increment_document_usage trigger to count 1 credit per envelope
DROP TRIGGER IF EXISTS track_document_creation ON public.documents;
DROP FUNCTION IF EXISTS public.increment_document_usage();

CREATE OR REPLACE FUNCTION public.increment_document_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_month date;
  user_limit integer;
  current_count integer;
  envelope_already_counted boolean;
BEGIN
  current_month := date_trunc('month', CURRENT_DATE)::date;
  
  -- Get user's document limit from subscription
  SELECT COALESCE(document_limit, 5) INTO user_limit
  FROM user_subscriptions
  WHERE user_id = NEW.user_id AND status = 'active';
  
  -- If no subscription found, default to free tier limit
  IF user_limit IS NULL THEN
    user_limit := 5;
  END IF;
  
  -- Check if this document is part of an envelope and if the envelope was already counted
  envelope_already_counted := false;
  IF NEW.envelope_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM documents 
      WHERE envelope_id = NEW.envelope_id 
      AND id != NEW.id
      AND created_at < NEW.created_at
    ) INTO envelope_already_counted;
  END IF;
  
  -- Only increment if it's a standalone document OR the first document of an envelope
  IF NEW.envelope_id IS NULL OR NOT envelope_already_counted THEN
    -- Get current usage count
    SELECT COALESCE(document_count, 0) INTO current_count
    FROM monthly_document_usage
    WHERE user_id = NEW.user_id AND month = current_month;
    
    -- Check if user has reached their limit
    IF current_count >= user_limit THEN
      RAISE EXCEPTION 'Limite de documentos atingido. Faça upgrade do seu plano para continuar.'
        USING HINT = 'limit_reached';
    END IF;
    
    -- Insert or update usage record
    INSERT INTO monthly_document_usage (user_id, month, document_count, limit_reached_at)
    VALUES (NEW.user_id, current_month, 1, CASE WHEN current_count + 1 >= user_limit THEN now() ELSE NULL END)
    ON CONFLICT (user_id, month) 
    DO UPDATE SET 
      document_count = monthly_document_usage.document_count + 1,
      limit_reached_at = CASE 
        WHEN monthly_document_usage.document_count + 1 >= user_limit THEN now() 
        ELSE monthly_document_usage.limit_reached_at 
      END,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER track_document_creation
BEFORE INSERT ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.increment_document_usage();

-- Add trigger for updating envelopes timestamp
CREATE TRIGGER update_envelopes_updated_at
BEFORE UPDATE ON public.envelopes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();