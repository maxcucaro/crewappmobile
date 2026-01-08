/*
  # Aggiungi colonna status mancante a training_courses

  1. Modifiche
    - Aggiungi colonna `status` alla tabella `training_courses`
    - Imposta valore di default 'draft'
    - Aggiungi constraint per valori validi
*/

-- Aggiungi la colonna status mancante
ALTER TABLE training_courses 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft' NOT NULL;

-- Aggiungi constraint per valori validi
ALTER TABLE training_courses 
ADD CONSTRAINT training_courses_status_check 
CHECK (status IN ('draft', 'published', 'confirmed', 'completed', 'cancelled'));

-- Verifica che la tabella sia corretta
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'training_courses' 
ORDER BY ordinal_position;