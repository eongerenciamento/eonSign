-- Create table for certificate requests
CREATE TABLE public.certificate_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  signer_id UUID REFERENCES public.document_signers(id),
  document_id UUID REFERENCES public.documents(id),
  
  -- Request data
  protocol TEXT,
  type TEXT NOT NULL DEFAULT 'PF', -- PF or PJ
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_validation, approved, validation_rejected, rejected, issued, revoked
  
  -- Signer/holder data
  common_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  
  -- PJ specific
  cnpj TEXT,
  responsible_name TEXT,
  
  -- BRy API data
  product_id INTEGER NOT NULL DEFAULT 106,
  registration_authority_id INTEGER NOT NULL DEFAULT 61,
  registry_office_id INTEGER NOT NULL DEFAULT 658,
  
  -- Status tracking
  videoconference_completed BOOLEAN DEFAULT false,
  certificate_issued BOOLEAN DEFAULT false,
  certificate_downloaded BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  issued_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.certificate_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own certificate requests" 
ON public.certificate_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own certificate requests" 
ON public.certificate_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own certificate requests" 
ON public.certificate_requests 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_certificate_requests_updated_at
BEFORE UPDATE ON public.certificate_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();