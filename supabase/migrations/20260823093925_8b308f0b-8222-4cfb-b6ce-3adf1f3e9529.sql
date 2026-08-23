
CREATE UNIQUE INDEX IF NOT EXISTS organisations_abn_unique
ON public.organisations (abn)
WHERE abn IS NOT NULL AND abn <> '';
