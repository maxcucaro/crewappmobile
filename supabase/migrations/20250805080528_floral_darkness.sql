/*
  # Crea bucket Storage per loghi aziendali

  1. Storage Bucket
    - Crea bucket `company-logos` se non esiste
    - Configurazione pubblica per visualizzazione loghi
    - Limite 2MB per file
    - Formati supportati: JPG, PNG, SVG, WebP

  2. Security Policies
    - Controlla esistenza prima di creare policy
    - Lettura pubblica per tutti i loghi
    - Scrittura solo per proprietari autenticati
    - Struttura file: company-logos/{user_id}/logo.{ext}

  3. Validazioni
    - Solo utenti autenticati possono caricare
    - Solo nel proprio folder (user_id)
    - Formati e dimensioni controllati lato client
*/

-- Crea il bucket se non esiste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'company-logos'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'company-logos',
      'company-logos',
      true,
      2097152, -- 2MB in bytes
      ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp']
    );
  END IF;
END $$;

-- Policy per lettura pubblica (se non esiste)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public can view company logos'
  ) THEN
    CREATE POLICY "Public can view company logos"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'company-logos');
  END IF;
END $$;

-- Policy per upload da parte del proprietario (se non esiste)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Companies can upload own logos'
  ) THEN
    CREATE POLICY "Companies can upload own logos"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'company-logos' 
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- Policy per aggiornamento da parte del proprietario (se non esiste)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Companies can update own logos'
  ) THEN
    CREATE POLICY "Companies can update own logos"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'company-logos' 
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- Policy per eliminazione da parte del proprietario (se non esiste)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Companies can delete own logos'
  ) THEN
    CREATE POLICY "Companies can delete own logos"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'company-logos' 
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;