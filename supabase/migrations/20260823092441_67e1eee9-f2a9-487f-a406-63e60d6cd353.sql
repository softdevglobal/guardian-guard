INSERT INTO public.user_roles (user_id, role)
VALUES ('fffb42d5-1558-4d85-8fcc-bde2eca867e4', 'platform_super_admin')
ON CONFLICT (user_id, role) DO NOTHING;