-- 005_fix_channels_text.sql
-- The access_token_enc / webhook_secret_enc columns were defined as bytea but we
-- store them as base64 strings. Supabase-JS silently writes the ASCII bytes of the
-- string instead of the actual binary ciphertext, which breaks decryption later.
-- Fix: change to text so what we write is exactly what we read.

alter table public.channels
  alter column access_token_enc type text using access_token_enc::text,
  alter column webhook_secret_enc type text using webhook_secret_enc::text;