-- Remove the trigger that blocks document creation
DROP TRIGGER IF EXISTS track_document_creation ON documents;

-- Update the function to only track usage without blocking
CREATE OR REPLACE FUNCTION increment_document_usage()
RETURNS TRIGGER AS $$
DECLARE
  current_month date;
BEGIN
  current_month := date_trunc('month', CURRENT_DATE)::date;
  
  -- Insert or update usage record
  INSERT INTO monthly_document_usage (user_id, month, document_count)
  VALUES (NEW.user_id, current_month, 1)
  ON CONFLICT (user_id, month) 
  DO UPDATE SET 
    document_count = monthly_document_usage.document_count + 1,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger without blocking logic
CREATE TRIGGER track_document_creation
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION increment_document_usage();