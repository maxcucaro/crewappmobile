/*
  # Fix warehouse_checkins foreign key

  1. Foreign Key Check
    - Verifica se la foreign key esiste già
    - Aggiunge solo se non presente
  
  2. Security
    - Mantiene RLS esistente
    - Non modifica policy esistenti
*/

-- Aggiungi foreign key solo se non esiste già
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'warehouse_checkins_warehouse_id_fkey'
    AND table_name = 'warehouse_checkins'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE warehouse_checkins 
    ADD CONSTRAINT warehouse_checkins_warehouse_id_fkey 
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Foreign key warehouse_checkins_warehouse_id_fkey aggiunta con successo';
  ELSE
    RAISE NOTICE 'Foreign key warehouse_checkins_warehouse_id_fkey esiste già';
  END IF;
END $$;