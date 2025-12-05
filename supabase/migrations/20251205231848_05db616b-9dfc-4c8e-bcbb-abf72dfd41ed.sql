-- Create patients table for healthcare professionals
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cpf TEXT,
  birth_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own patients" 
ON public.patients 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patients" 
ON public.patients 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patients" 
ON public.patients 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_patients_updated_at
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_patients_user_id ON public.patients(user_id);
CREATE INDEX idx_patients_name ON public.patients(name);