/*
  # Aggiungi campi visibilità e conferma agli eventi

  1. Nuovi Campi
    - `visibility` (text) - 'public' o 'private' per controllare chi può vedere l'evento
    - `is_confirmed` (boolean) - se l'evento è confermato e deve apparire nel calendario
  
  2. Aggiornamenti
    - Aggiunti campi alla tabella events
    - Valori di default appropriati
    - Check constraint per visibility
*/

-- Aggiungi campo visibilità
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE events ADD COLUMN visibility text DEFAULT 'public';
  END IF;
END $$;

-- Aggiungi campo conferma
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'is_confirmed'
  ) THEN
    ALTER TABLE events ADD COLUMN is_confirmed boolean DEFAULT false;
  END IF;
END $$;

-- Aggiungi check constraint per visibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'events' AND constraint_name = 'events_visibility_check'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_visibility_check 
    CHECK (visibility IN ('public', 'private'));
  END IF;
END $$;