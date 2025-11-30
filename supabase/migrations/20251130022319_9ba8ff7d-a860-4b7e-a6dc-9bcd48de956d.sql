-- Enable realtime for whatsapp_history table
ALTER TABLE public.whatsapp_history REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_history;