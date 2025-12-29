-- Add rating fields to support_tickets
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS rating integer,
ADD COLUMN IF NOT EXISTS rating_comment text,
ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS reopened_at timestamp with time zone;

-- Add message_type to ticket_messages for system events
ALTER TABLE public.ticket_messages 
ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'message';

-- Add constraint for rating (1-5)
ALTER TABLE public.support_tickets 
ADD CONSTRAINT rating_range CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));