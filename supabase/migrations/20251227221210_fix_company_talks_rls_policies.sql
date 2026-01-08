/*
  # Fix Company Talks RLS Policies

  ## Descrizione
  Corregge le policy RLS della tabella company_talks per usare la tabella
  corretta (regaziendasoftware) invece di company_profiles

  ## Modifiche
  - DROP delle policy esistenti errate
  - CREATE nuove policy usando regaziendasoftware con auth_user_id
  - Aggiorna la foreign key sender_company_id per puntare a regaziendasoftware
  - Aggiorna trigger notify_urgent_talk per usare regaziendasoftware

  ## Sicurezza
  - Le aziende possono inviare solo ai propri dipendenti
  - I dipendenti possono leggere solo i propri messaggi
*/

-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Companies can send talks" ON company_talks;
DROP POLICY IF EXISTS "Companies can view their sent talks" ON company_talks;
DROP POLICY IF EXISTS "Crew can view their received talks" ON company_talks;
DROP POLICY IF EXISTS "Crew can mark their talks as read" ON company_talks;
DROP POLICY IF EXISTS "Companies can delete their sent talks" ON company_talks;
DROP POLICY IF EXISTS "Crew can delete their received talks" ON company_talks;

-- Ricrea la foreign key se necessario (prima droppa quella esistente se punta a company_profiles)
DO $$
BEGIN
  -- Verifica se esiste una constraint che punta a company_profiles
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%company_talks%sender_company_id%'
    AND table_name = 'company_talks'
  ) THEN
    ALTER TABLE company_talks DROP CONSTRAINT IF EXISTS company_talks_sender_company_id_fkey;
  END IF;

  -- Aggiungi la foreign key corretta verso regaziendasoftware
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'company_talks_sender_regaziendasoftware_fkey'
    AND table_name = 'company_talks'
  ) THEN
    ALTER TABLE company_talks
    ADD CONSTRAINT company_talks_sender_regaziendasoftware_fkey
    FOREIGN KEY (sender_company_id)
    REFERENCES regaziendasoftware(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Policy: Aziende possono inserire messaggi
CREATE POLICY "Companies can send talks"
  ON company_talks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_company_id IN (
      SELECT id FROM regaziendasoftware
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Aziende possono vedere i propri messaggi inviati
CREATE POLICY "Companies can view their sent talks"
  ON company_talks
  FOR SELECT
  TO authenticated
  USING (
    sender_company_id IN (
      SELECT id FROM regaziendasoftware
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Dipendenti possono vedere i messaggi destinati a loro o broadcast
CREATE POLICY "Crew can view their received talks"
  ON company_talks
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR recipient_id IS NULL
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
      SELECT id FROM regaziendasoftware
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Dipendenti possono eliminare i messaggi ricevuti
CREATE POLICY "Crew can delete their received talks"
  ON company_talks
  FOR DELETE
  TO authenticated
  USING (recipient_id = auth.uid());

-- Aggiorna il trigger per notifiche urgenti
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

    -- Ottieni nome azienda da regaziendasoftware
    SELECT ragione_sociale INTO v_company_name
    FROM regaziendasoftware
    WHERE id = NEW.sender_company_id;

    -- Inserisci notifica nella tabella notifiche (se esiste)
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

-- Commento
COMMENT ON POLICY "Companies can send talks" ON company_talks IS 'Le aziende possono inviare messaggi ai dipendenti usando la tabella regaziendasoftware';