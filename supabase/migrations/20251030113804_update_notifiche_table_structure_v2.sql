/*
  # Aggiornamento Tabella Notifiche per Sistema Campanella

  1. Modifiche alla Tabella Esistente
    - Aggiungere colonne necessarie per sistema campanella
    - Migrare dati esistenti

  2. Funzioni Helper
    - Crea notifica in-app
    - Segna come letta
    - Elimina notifica
*/

-- Aggiungi nuove colonne se non esistono
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifiche' AND column_name = 'stato'
  ) THEN
    ALTER TABLE notifiche ADD COLUMN stato text DEFAULT 'non_letta' CHECK (stato IN ('non_letta', 'letta', 'eliminata'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifiche' AND column_name = 'shift_type'
  ) THEN
    ALTER TABLE notifiche ADD COLUMN shift_type text CHECK (shift_type IN ('event', 'warehouse') OR shift_type IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifiche' AND column_name = 'shift_id'
  ) THEN
    ALTER TABLE notifiche ADD COLUMN shift_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifiche' AND column_name = 'priorita'
  ) THEN
    ALTER TABLE notifiche ADD COLUMN priorita text DEFAULT 'media' CHECK (priorita IN ('bassa', 'media', 'alta', 'urgente'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifiche' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE notifiche ADD COLUMN read_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifiche' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE notifiche ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifiche' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE notifiche ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Migra dati esistenti da colonna letta a stato
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifiche' AND column_name = 'letta'
  ) THEN
    UPDATE notifiche
    SET stato = CASE
      WHEN letta = true THEN 'letta'
      ELSE 'non_letta'
    END
    WHERE stato IS NULL OR stato = 'non_letta';
  END IF;
END $$;

-- Popola created_at da data_creazione se esiste
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifiche' AND column_name = 'data_creazione'
  ) THEN
    UPDATE notifiche
    SET created_at = data_creazione
    WHERE created_at IS NULL;
  END IF;
END $$;

-- Crea indexes se non esistono
CREATE INDEX IF NOT EXISTS idx_notifiche_id_utente ON notifiche(id_utente);
CREATE INDEX IF NOT EXISTS idx_notifiche_created_at_desc ON notifiche(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifiche_tipo ON notifiche(tipo);

-- Index condizionale su stato
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifiche_stato_non_letta'
  ) THEN
    CREATE INDEX idx_notifiche_stato_non_letta ON notifiche(stato) WHERE stato = 'non_letta';
  END IF;
END $$;

-- Indice composto per query comuni
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifiche_utente_stato_created'
  ) THEN
    CREATE INDEX idx_notifiche_utente_stato_created 
      ON notifiche(id_utente, stato, created_at DESC);
  END IF;
END $$;

-- Aggiorna RLS policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifiche;
CREATE POLICY "Users can view own notifications"
  ON notifiche FOR SELECT
  TO authenticated
  USING (auth.uid() = id_utente AND (stato IS NULL OR stato != 'eliminata'));

DROP POLICY IF EXISTS "Users can update own notifications" ON notifiche;
CREATE POLICY "Users can update own notifications"
  ON notifiche FOR UPDATE
  TO authenticated
  USING (auth.uid() = id_utente)
  WITH CHECK (auth.uid() = id_utente);

DROP POLICY IF EXISTS "Service can insert notifications" ON notifiche;
CREATE POLICY "Service can insert notifications"
  ON notifiche FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Rimuovi vecchia funzione create_notification con meno parametri
DROP FUNCTION IF EXISTS create_notification(uuid, text, text, text);

-- Funzione per creare notifica in-app (versione completa)
CREATE OR REPLACE FUNCTION create_notification_full(
  p_id_utente uuid,
  p_titolo text,
  p_messaggio text,
  p_tipo text,
  p_shift_type text DEFAULT NULL,
  p_shift_id uuid DEFAULT NULL,
  p_url_azione text DEFAULT NULL,
  p_priorita text DEFAULT 'media'
) RETURNS uuid AS $$
DECLARE
  v_notifica_id uuid;
BEGIN
  INSERT INTO notifiche (
    id_utente,
    titolo,
    messaggio,
    tipo,
    shift_type,
    shift_id,
    url_azione,
    priorita,
    stato,
    created_at
  ) VALUES (
    p_id_utente,
    p_titolo,
    p_messaggio,
    p_tipo,
    p_shift_type,
    p_shift_id,
    p_url_azione,
    p_priorita,
    'non_letta',
    NOW()
  ) RETURNING id INTO v_notifica_id;
  
  RETURN v_notifica_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per segnare notifica come letta
CREATE OR REPLACE FUNCTION mark_notification_read(p_notifica_id uuid, p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE notifiche
  SET 
    stato = 'letta',
    read_at = NOW()
  WHERE id = p_notifica_id
    AND id_utente = p_user_id
    AND (stato = 'non_letta' OR stato IS NULL);
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per eliminare notifica
CREATE OR REPLACE FUNCTION delete_notification(p_notifica_id uuid, p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE notifiche
  SET 
    stato = 'eliminata',
    deleted_at = NOW()
  WHERE id = p_notifica_id
    AND id_utente = p_user_id
    AND (stato != 'eliminata' OR stato IS NULL);
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per segnare tutte le notifiche come lette
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE notifiche
  SET 
    stato = 'letta',
    read_at = NOW()
  WHERE id_utente = p_user_id
    AND (stato = 'non_letta' OR stato IS NULL);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per ottenere conteggio notifiche non lette
CREATE OR REPLACE FUNCTION get_unread_notifications_count(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM notifiche
  WHERE id_utente = p_user_id
    AND (stato = 'non_letta' OR stato IS NULL);
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commenti
COMMENT ON COLUMN notifiche.stato IS 'Stato corrente: non_letta (badge rosso), letta, eliminata (non visibile)';
COMMENT ON COLUMN notifiche.shift_type IS 'Se relativa a turno: event (evento) o warehouse (magazzino)';
COMMENT ON COLUMN notifiche.shift_id IS 'ID del turno/evento di riferimento';
COMMENT ON COLUMN notifiche.priorita IS 'Priorita visiva: urgente (rosso), alta (arancione), media, bassa';
COMMENT ON FUNCTION create_notification_full IS 'Crea una nuova notifica in-app per un utente (versione completa)';
COMMENT ON FUNCTION mark_notification_read IS 'Segna una notifica come letta';
COMMENT ON FUNCTION delete_notification IS 'Elimina (nasconde) una notifica';
