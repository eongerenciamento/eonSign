-- Create documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for documents bucket
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create document_signers table
CREATE TABLE public.document_signers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  cpf TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'rejected')),
  is_company_signer BOOLEAN NOT NULL DEFAULT false,
  signed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on document_signers
ALTER TABLE public.document_signers ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_signers
CREATE POLICY "Users can view signers of their documents"
ON public.document_signers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.documents 
    WHERE documents.id = document_signers.document_id 
    AND documents.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create signers for their documents"
ON public.document_signers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documents 
    WHERE documents.id = document_signers.document_id 
    AND documents.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update signers of their documents"
ON public.document_signers FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.documents 
    WHERE documents.id = document_signers.document_id 
    AND documents.user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_document_signers_updated_at
BEFORE UPDATE ON public.document_signers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();