/*
  # Crea bucket Storage per loghi aziendali

  1. Storage Bucket
    - Crea bucket `company-logos` pubblico
    - Configura policy per upload autenticati
    - Configura policy per lettura pubblica

  2. Security
    - Solo utenti autenticati possono caricare
    - Tutti possono leggere (loghi pubblici)
    - Ogni utente può caricare solo nel proprio folder
*/

-- Crea il bucket per i loghi aziendali
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos', 
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Policy per permettere agli utenti autenticati di caricare loghi
CREATE POLICY "Authenticated users can upload company logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy per permettere agli utenti autenticati di aggiornare i propri loghi
CREATE POLICY "Users can update own company logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'company-logos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy per permettere agli utenti autenticati di eliminare i propri loghi
CREATE POLICY "Users can delete own company logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy per permettere la lettura pubblica dei loghi
CREATE POLICY "Public can view company logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');