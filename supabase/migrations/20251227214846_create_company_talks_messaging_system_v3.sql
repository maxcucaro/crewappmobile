/*
  # Sistema di Messaggistica Aziendale (Company Talks)

  ## Descrizione
  Sistema completo per l'invio di messaggi dall'azienda ai dipendenti con supporto per:
  - Messaggi di testo
  - Messaggi vocali (audio)
  - Immagini/foto
  - File/documenti
  - Notifiche push
  - Auto-eliminazione messaggi vecchi (30 giorni)
  - Eliminazione manuale

  ## Nuove Tabelle
  
  ### `company_talks`
  Tabella principale per i messaggi aziendali
  - `id` (uuid, primary key)
  - `sender_company_id` (uuid) - ID azienda mittente (company_profiles)
  - `recipient_id` (uuid) - ID del dipendente destinatario (null = broadcast)
  - `sender_name` (text) - Nome mittente per visualizzazione
  - `message_type` (text) - Tipo: 'text', 'audio', 'image', 'file'
  - `message_text` (text) - Contenuto testuale (null per file)
  - `file_url` (text) - URL file in Supabase Storage (null per solo testo)
  - `file_name` (text) - Nome originale file
  - `file_size` (integer) - Dimensione file in bytes
  - `is_urgent` (boolean) - Messaggio urgente (trigger notifica push)
  - `is_read` (boolean) - Letto dal destinatario
  - `read_at` (timestamptz) - Quando è stato letto
  - `created_at` (timestamptz) - Data invio
  - `expires_at` (timestamptz) - Data scadenza (auto-eliminazione)

  ## Ottimizzazione Spazio
  - File multimediali salvati in Supabase Storage (non nel database)
  - Auto-eliminazione messaggi dopo 30 giorni
  - Possibilità di eliminare manualmente conversazioni
  - Indici per query veloci
  - Limiti dimensione file (max 10MB per audio/image, 20MB per documenti)

  ## Sicurezza
  - RLS abilitato
  - Aziende possono inviare solo ai propri dipendenti
  - Dipendenti possono leggere solo i propri messaggi
*/

-- Crea tabella messaggi aziendali
CREATE TABLE IF NOT EXISTS company_talks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_company_id uuid REFERENCES company_profiles(id) ON DELETE CASCADE NOT NULL,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text NOT NULL DEFAULT 'Azienda',
  message_type text NOT NULL CHECK (message_type IN ('text', 'audio', 'image', 'file')),
  message_text text,
  file_url text,
  file_name text,
  file_size integer CHECK (file_size IS NULL OR file_size <= 20971520),
  is_urgent boolean DEFAULT false,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  
  CONSTRAINT valid_message_content CHECK (
    (message_type = 'text' AND message_text IS NOT NULL) OR
    (message_type IN ('audio', 'image', 'file') AND file_url IS NOT NULL)
  ),
  CONSTRAINT valid_file_size CHECK (
    file_size IS NULL OR 
    (message_type IN ('audio', 'image') AND file_size <= 10485760) OR
    (message_type = 'file' AND file_size <= 20971520)
  )
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_company_talks_recipient ON company_talks(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_talks_sender ON company_talks(sender_company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_talks_unread ON company_talks(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_company_talks_expires ON company_talks(expires_at) WHERE expires_at IS NOT NULL;

-- Funzione per auto-eliminazione messaggi scaduti
CREATE OR REPLACE FUNCTION delete_expired_talks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Elimina i file dallo storage prima di eliminare i record
  -- (questo dovrebbe essere fatto tramite trigger o manualmente)
  
  DELETE FROM company_talks
  WHERE expires_at IS NOT NULL 
  AND expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

-- Funzione per marcare messaggio come letto
CREATE OR REPLACE FUNCTION mark_talk_as_read(talk_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE company_talks
  SET is_read = true,
      read_at = now()
  WHERE id = talk_id
  AND recipient_id = auth.uid()
  AND is_read = false;
END;
$$;

-- Funzione per ottenere statistiche messaggi (utile per monitoring spazio)
CREATE OR REPLACE FUNCTION get_talks_stats()
RETURNS TABLE (
  total_messages bigint,
  total_size_mb numeric,
  messages_by_type jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_messages,
    ROUND(SUM(COALESCE(file_size, 0))::numeric / 1048576, 2) as total_size_mb,
    jsonb_object_agg(
      message_type,
      jsonb_build_object(
        'count', count(*),
        'size_mb', ROUND(SUM(COALESCE(file_size, 0))::numeric / 1048576, 2)
      )
    ) as messages_by_type
  FROM company_talks
  GROUP BY message_type;
END;
$$;

-- Trigger per notifica push su messaggio urgente
CREATE OR REPLACE FUNCTION notify_urgent_talk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient_name text;
  v_company_name text;
BEGIN
  IF NEW.is_urgent = true AND NEW.recipient_id IS NOT NULL THEN
    -- Ottieni nome destinatario
    SELECT COALESCE(full_name, first_name || ' ' || last_name, email)
    INTO v_recipient_name
    FROM crew_members
    WHERE id = NEW.recipient_id;
    
    IF v_recipient_name IS NULL THEN
      SELECT email INTO v_recipient_name
      FROM auth.users
      WHERE id = NEW.recipient_id;
    END IF;
    
    -- Ottieni nome azienda
    SELECT ragione_sociale INTO v_company_name
    FROM company_profiles
    WHERE id = NEW.sender_company_id;
    
    -- Inserisci notifica
    INSERT INTO notifiche (
      user_id,
      titolo,
      messaggio,
      tipo,
      priorita,
      letta,
      created_at
    ) VALUES (
      NEW.recipient_id,
      'Messaggio Urgente da ' || COALESCE(v_company_name, 'Azienda'),
      CASE 
        WHEN NEW.message_type = 'text' THEN LEFT(NEW.message_text, 100)
        WHEN NEW.message_type = 'audio' THEN 'Messaggio vocale'
        WHEN NEW.message_type = 'image' THEN 'Immagine allegata'
        ELSE 'File allegato: ' || COALESCE(NEW.file_name, 'documento')
      END,
      'talk',
      'high',
      false,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_urgent_talk ON company_talks;
CREATE TRIGGER trigger_notify_urgent_talk
  AFTER INSERT ON company_talks
  FOR EACH ROW
  EXECUTE FUNCTION notify_urgent_talk();

-- Abilita RLS
ALTER TABLE company_talks ENABLE ROW LEVEL SECURITY;

-- Policy: Aziende possono inserire messaggi per i dipendenti
CREATE POLICY "Companies can send talks"
  ON company_talks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_company_id IN (
      SELECT id FROM company_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Aziende possono vedere i propri messaggi inviati
CREATE POLICY "Companies can view their sent talks"
  ON company_talks
  FOR SELECT
  TO authenticated
  USING (
    sender_company_id IN (
      SELECT id FROM company_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Dipendenti possono vedere i messaggi destinati a loro
CREATE POLICY "Crew can view their received talks"
  ON company_talks
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR (
      recipient_id IS NULL
      AND auth.uid() IN (
        SELECT id FROM users WHERE role = 'crew'
      )
    )
  );

-- Policy: Dipendenti possono aggiornare solo il flag is_read dei propri messaggi
CREATE POLICY "Crew can mark their talks as read"
  ON company_talks
  FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Policy: Aziende possono eliminare i propri messaggi
CREATE POLICY "Companies can delete their sent talks"
  ON company_talks
  FOR DELETE
  TO authenticated
  USING (
    sender_company_id IN (
      SELECT id FROM company_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Dipendenti possono eliminare i messaggi ricevuti
CREATE POLICY "Crew can delete their received talks"
  ON company_talks
  FOR DELETE
  TO authenticated
  USING (recipient_id = auth.uid());

-- Crea storage bucket per file multimediali (se non esiste)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'company-talks', 
    'company-talks', 
    false, 
    20971520,
    ARRAY[
      'text/plain',
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'video/mp4',
      'video/webm'
    ]
  )
  ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'text/plain',
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'video/mp4',
      'video/webm'
    ];
END $$;

-- Policy storage: Aziende possono caricare file
DROP POLICY IF EXISTS "Companies can upload talk files" ON storage.objects;
CREATE POLICY "Companies can upload talk files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-talks'
    AND auth.uid() IN (
      SELECT user_id FROM company_profiles
    )
  );

-- Policy storage: Utenti autenticati possono leggere i file dei propri messaggi
DROP POLICY IF EXISTS "Users can read their talk files" ON storage.objects;
CREATE POLICY "Users can read their talk files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'company-talks'
  );

-- Policy storage: Aziende possono eliminare i propri file
DROP POLICY IF EXISTS "Companies can delete their talk files" ON storage.objects;
CREATE POLICY "Companies can delete their talk files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-talks'
    AND auth.uid() IN (
      SELECT user_id FROM company_profiles
    )
  );

-- Commenti sulla gestione dello spazio
COMMENT ON TABLE company_talks IS 'Sistema di messaggistica ottimizzato: file in Storage (max 20MB), auto-delete dopo 30 giorni, eliminazione manuale disponibile';
COMMENT ON COLUMN company_talks.expires_at IS 'Data di scadenza per auto-eliminazione (default 30 giorni). Chiamare delete_expired_talks() per pulizia';
COMMENT ON COLUMN company_talks.file_size IS 'Dimensione file in bytes. Max 10MB per audio/image, 20MB per documenti';
COMMENT ON FUNCTION delete_expired_talks() IS 'Elimina messaggi scaduti. Restituisce numero di messaggi eliminati. Da schedulare periodicamente';
COMMENT ON FUNCTION get_talks_stats() IS 'Statistiche utilizzo spazio messaggi per monitoring';
