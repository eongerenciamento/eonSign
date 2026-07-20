-- Remove the support ticket feature entirely: tables, enum, and storage bucket

-- Stop replicating ticket_messages before dropping it
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.ticket_messages;

-- Drop tables (CASCADE removes dependent policies, indexes, and triggers)
DROP TABLE IF EXISTS public.ticket_messages CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;

-- Drop the ticket status enum
DROP TYPE IF EXISTS public.ticket_status;

-- Remove storage policies for the support-attachments bucket
DROP POLICY IF EXISTS "Users can upload their own support attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own support attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own support attachments" ON storage.objects;

-- Remove stored attachment objects, then the bucket itself
DELETE FROM storage.objects WHERE bucket_id = 'support-attachments';
DELETE FROM storage.buckets WHERE id = 'support-attachments';
