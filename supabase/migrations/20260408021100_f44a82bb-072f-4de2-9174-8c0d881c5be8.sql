
CREATE OR REPLACE FUNCTION public.prevent_delete_training_links()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN RAISE EXCEPTION 'Deletion not allowed — archive only'; END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_delete_approvals()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN RAISE EXCEPTION 'Deletion not allowed — archive only'; END;
$$;
