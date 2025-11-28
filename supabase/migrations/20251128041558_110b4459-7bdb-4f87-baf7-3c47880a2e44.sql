-- Create company_settings table to store company and admin information
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  logo_url TEXT,
  cep TEXT NOT NULL,
  street TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  admin_cpf TEXT NOT NULL,
  admin_phone TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own company settings" 
ON public.company_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own company settings" 
ON public.company_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own company settings" 
ON public.company_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();