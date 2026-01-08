/*
  # Crea bucket Storage per loghi aziendali

  1. Storage
    - Crea bucket `company-logos` pubblico
    - Configura policy RLS per upload/update/delete
    - Limiti: 2MB, formati immagine

  2. Security
    - Upload: solo utenti autenticati nel proprio folder
    - Update/Delete: solo proprietario
    - Read: pubblico
*/

-- Crea bucket per loghi aziendali se non esiste
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos', 
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy per lettura pubblica (tutti possono vedere i loghi)
CREATE POLICY "Public read access for company logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- Policy per upload (utenti autenticati possono caricare nel proprio folder)
CREATE POLICY "Authenticated users can upload own logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy per update (utenti possono aggiornare i propri loghi)
CREATE POLICY "Users can update own logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'company-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy per delete (utenti possono eliminare i propri loghi)
CREATE POLICY "Users can delete own logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);