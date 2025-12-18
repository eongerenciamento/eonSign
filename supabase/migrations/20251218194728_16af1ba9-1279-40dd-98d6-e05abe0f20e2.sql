-- Inserir perfis para usuários existentes que ainda não têm perfil
INSERT INTO public.profiles (id, email, nome_completo)
SELECT id, email, COALESCE(raw_user_meta_data ->> 'nome_completo', raw_user_meta_data ->> 'name', '')
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;