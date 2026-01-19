CREATE OR REPLACE FUNCTION public.increment_document_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- CORREÇÃO: Se plano é ilimitado (document_limit = -1), permitir sempre
  IF user_limit = -1 THEN
    RETURN NEW;
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
$function$;