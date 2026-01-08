/*
  # Aggiornamento Categorie Note Spese in Italiano

  1. Modifiche
    - Rimuove il constraint `expenses_category_check` esistente
    - Aggiunge nuovo constraint con categorie in italiano:
      - 'vitto' (era 'food')
      - 'alloggio' (confermato)
      - 'trasporto' (era 'transport')
      - 'materiali' (era 'materials')
      - 'comunicazioni' (era 'communication')
      - 'altro' (era 'other')
    - Aggiorna le righe esistenti per convertire i valori inglesi in italiano

  2. Note
    - Mantiene tutti i dati esistenti convertendoli automaticamente
    - Non elimina nessuna nota spesa
*/

-- Aggiorna prima i valori esistenti da inglese a italiano
UPDATE expenses 
SET category = CASE 
  WHEN category = 'food' THEN 'vitto'
  WHEN category = 'accommodation' THEN 'alloggio'
  WHEN category = 'transport' THEN 'trasporto'
  WHEN category = 'materials' THEN 'materiali'
  WHEN category = 'communication' THEN 'comunicazioni'
  WHEN category = 'other' THEN 'altro'
  ELSE category
END
WHERE category IN ('food', 'accommodation', 'transport', 'materials', 'communication', 'other');

-- Rimuove il vecchio constraint
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- Aggiunge il nuovo constraint con categorie italiane
ALTER TABLE expenses ADD CONSTRAINT expenses_category_check CHECK (
  category = ANY (ARRAY[
    'vitto'::text,
    'alloggio'::text,
    'trasporto'::text,
    'materiali'::text,
    'comunicazioni'::text,
    'altro'::text
  ])
);
