-- clinvar_cache is a server-side cache of NCBI dbSNP/ClinVar lookups, read and
-- written only by the server through the service-role client (which bypasses
-- RLS). It was the one public table without RLS, and the default Supabase
-- grants let anon and authenticated insert and update it through the Data API.
-- Turn RLS on without policies and drop those grants. Idempotent.

ALTER TABLE public.clinvar_cache ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.clinvar_cache FROM anon, authenticated;
