-- Create whatsapp_history table for tracking WhatsApp message delivery
CREATE TABLE public.whatsapp_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_id UUID NULL,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  message_type TEXT NOT NULL, -- 'signature_invitation' or 'document_completed'
  message_sid TEXT NULL, -- Twilio message SID
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed', 'undelivered'
  error_code TEXT NULL,
  error_message TEXT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE NULL,
  read_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_history ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own WhatsApp history
CREATE POLICY "Users can view their own whatsapp history"
ON public.whatsapp_history
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_whatsapp_history_user_id ON public.whatsapp_history(user_id);
CREATE INDEX idx_whatsapp_history_message_sid ON public.whatsapp_history(message_sid);