-- Add prescription_doc_type column to store the type of prescription document
ALTER TABLE public.documents 
ADD COLUMN prescription_doc_type text DEFAULT NULL;