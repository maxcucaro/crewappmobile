/*
  # Aggiungi foreign key mancante a iscrizioni_corsi

  1. Problema
    - La tabella iscrizioni_corsi esiste ma manca la foreign key verso corsi_formazione
    - Il frontend non riesce a fare il JOIN perché la relazione non è definita

  2. Soluzione
    - Aggiungi la foreign key mancante id_corso -> corsi_formazione(id)
    - Mantieni tutto il resto invariato
*/

-- Aggiungi la foreign key mancante
ALTER TABLE iscrizioni_corsi 
ADD CONSTRAINT iscrizioni_corsi_id_corso_fkey 
FOREIGN KEY (id_corso) REFERENCES corsi_formazione(id) ON DELETE CASCADE;

-- Verifica che la foreign key sia stata aggiunta
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='iscrizioni_corsi';