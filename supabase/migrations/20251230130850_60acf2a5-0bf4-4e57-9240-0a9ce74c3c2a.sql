-- Add read_at column to ticket_messages for read receipts
ALTER TABLE ticket_messages 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Enable realtime for ticket_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_messages;