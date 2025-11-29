-- Criar tabela para histórico de emails
CREATE TABLE public.email_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'signature_invitation', 'welcome', 'document_completed', 'password_reset'
  document_id UUID,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;

-- Política para visualizar próprios emails
CREATE POLICY "Users can view their own email history"
ON public.email_history
FOR SELECT
USING (auth.uid() = user_id);

-- Criar índices para melhor performance
CREATE INDEX idx_email_history_user_id ON public.email_history(user_id);
CREATE INDEX idx_email_history_sent_at ON public.email_history(sent_at DESC);
CREATE INDEX idx_email_history_email_type ON public.email_history(email_type);
CREATE INDEX idx_email_history_document_id ON public.email_history(document_id) WHERE document_id IS NOT NULL;