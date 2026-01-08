/*
  # Aggiungi tutte le colonne mancanti a training_courses

  1. Colonne Aggiunte
    - `is_confirmed` (boolean) - Se il corso è confermato nel calendario
    - `visibility` (text) - Visibilità del corso (public/private)
    - `max_participants` (integer) - Numero massimo partecipanti
    - `materials` (text[]) - Array di materiali del corso

  2. Constraints
    - Check constraint per visibility
    - Check constraint per max_participants

  3. Indici
    - Indice per visibility
    - Indice per is_confirmed
*/

-- Aggiungi tutte le colonne mancanti alla tabella training_courses
DO $$
BEGIN
  -- Aggiungi is_confirmed se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_courses' AND column_name = 'is_confirmed'
  ) THEN
    ALTER TABLE training_courses ADD COLUMN is_confirmed boolean DEFAULT false;
  END IF;

  -- Aggiungi visibility se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_courses' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE training_courses ADD COLUMN visibility text DEFAULT 'public';
  END IF;

  -- Aggiungi max_participants se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_courses' AND column_name = 'max_participants'
  ) THEN
    ALTER TABLE training_courses ADD COLUMN max_participants integer DEFAULT 20;
  END IF;

  -- Aggiungi materials se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_courses' AND column_name = 'materials'
  ) THEN
    ALTER TABLE training_courses ADD COLUMN materials text[] DEFAULT '{}';
  END IF;
END $$;

-- Aggiungi constraints
DO $$
BEGIN
  -- Constraint per visibility
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'training_courses' AND constraint_name = 'training_courses_visibility_check'
  ) THEN
    ALTER TABLE training_courses ADD CONSTRAINT training_courses_visibility_check 
    CHECK (visibility IN ('public', 'private'));
  END IF;

  -- Constraint per max_participants
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'training_courses' AND constraint_name = 'training_courses_max_participants_check'
  ) THEN
    ALTER TABLE training_courses ADD CONSTRAINT training_courses_max_participants_check 
    CHECK (max_participants > 0);
  END IF;
END $$;

-- Aggiungi indici per performance
CREATE INDEX IF NOT EXISTS idx_training_courses_visibility 
ON training_courses(visibility);

CREATE INDEX IF NOT EXISTS idx_training_courses_confirmed 
ON training_courses(is_confirmed);

CREATE INDEX IF NOT EXISTS idx_training_courses_company_status 
ON training_courses(company_id, status);

-- Verifica che tutte le colonne esistano
DO $$
DECLARE
  missing_columns text[] := '{}';
  col_name text;
BEGIN
  -- Lista delle colonne richieste
  FOR col_name IN SELECT unnest(ARRAY['is_confirmed', 'visibility', 'max_participants', 'materials']) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'training_courses' AND column_name = col_name
    ) THEN
      missing_columns := array_append(missing_columns, col_name);
    END IF;
  END LOOP;
  
  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION 'Colonne mancanti in training_courses: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✅ Tutte le colonne richieste esistono in training_courses';
  END IF;
END $$;