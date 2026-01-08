/*
  # Fix Break Times Constraint

  ## Problema
  Il constraint `valid_break_times` impediva di salvare solo `break_start_time` senza `break_end_time`,
  bloccando la registrazione dell'inizio pausa.

  ## Modifica
  - Rimuove il vecchio constraint troppo restrittivo
  - Aggiunge nuovo constraint che permette:
    1. Entrambi NULL (nessuna pausa)
    2. Solo break_start_time NOT NULL (pausa in corso)
    3. Entrambi NOT NULL con break_end_time > break_start_time (pausa completata)

  ## Note
  Questo permette il flusso naturale:
  - Inizio pausa → salva solo break_start_time
  - Fine pausa → salva break_end_time
*/

-- Rimuovi il constraint vecchio
ALTER TABLE warehouse_checkins 
DROP CONSTRAINT IF EXISTS valid_break_times;

-- Aggiungi il nuovo constraint che permette stati parziali
ALTER TABLE warehouse_checkins 
ADD CONSTRAINT valid_break_times CHECK (
  (break_start_time IS NULL AND break_end_time IS NULL) 
  OR 
  (break_start_time IS NOT NULL AND break_end_time IS NULL)
  OR 
  (break_start_time IS NOT NULL AND break_end_time IS NOT NULL AND break_end_time > break_start_time)
);