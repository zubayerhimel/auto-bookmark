-- Supabase keeps extensions in the "extensions" schema, which is on the search path.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
