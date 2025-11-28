-- Add parent_folder_id column to folders table to support subfolders
ALTER TABLE public.folders 
ADD COLUMN parent_folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE;