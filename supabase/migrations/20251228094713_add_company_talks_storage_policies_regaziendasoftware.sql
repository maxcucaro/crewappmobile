/*
  # Add Company Talks Storage Policies for regaziendasoftware

  ## Descrizione
  Aggiunge nuove policy allo storage bucket 'company-talks' per supportare
  la tabella regaziendasoftware (senza rimuovere le policy esistenti)

  ## Problema
  Le policy esistenti cercano in company_profiles.user_id
  Le nuove policy cercano in regaziendasoftware.auth_user_id

  ## Modifiche
  - Aggiunge policy per upload da regaziendasoftware
  - Aggiunge policy per delete da regaziendasoftware

  ## Sicurezza
  - Le aziende in regaziendasoftware possono caricare ed eliminare file
*/

-- Crea funzione temporanea per aggiungere policy storage
CREATE OR REPLACE FUNCTION add_regaziendasoftware_storage_policies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Policy storage: Aziende in regaziendasoftware possono caricare file
  EXECUTE 'CREATE POLICY "Companies from regaziendasoftware can upload talk files"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = ''company-talks''
      AND auth.uid() IN (
        SELECT auth_user_id FROM public.regaziendasoftware WHERE auth_user_id IS NOT NULL
      )
    )';

  -- Policy storage: Aziende in regaziendasoftware possono eliminare file
  EXECUTE 'CREATE POLICY "Companies from regaziendasoftware can delete talk files"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = ''company-talks''
      AND auth.uid() IN (
        SELECT auth_user_id FROM public.regaziendasoftware WHERE auth_user_id IS NOT NULL
      )
    )';
    
EXCEPTION
  WHEN duplicate_object THEN
    -- Policy già esiste, ignora
    NULL;
END;
$$;

-- Esegui la funzione
SELECT add_regaziendasoftware_storage_policies();

-- Elimina la funzione temporanea
DROP FUNCTION IF EXISTS add_regaziendasoftware_storage_policies();
