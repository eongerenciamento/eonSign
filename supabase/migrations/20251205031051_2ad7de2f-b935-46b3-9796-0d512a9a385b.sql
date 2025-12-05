-- Enable realtime for certificate_requests table
ALTER TABLE public.certificate_requests REPLICA IDENTITY FULL;

-- Add table to realtime publication if not already there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'certificate_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.certificate_requests;
  END IF;
END $$;