/*
  # Aggiungi warehouse_id a crew_assegnazione_turni
  
  1. Modifiche
    - Aggiunge colonna `warehouse_id` (UUID, nullable) alla tabella `crew_assegnazione_turni`
    - Aggiunge foreign key constraint verso `warehouses(id)`
    - Aggiunge indice per migliorare le performance delle query
    
  2. Motivazione
    - Attualmente la tabella ha solo `nome_magazzino` e `indirizzo_magazzino` (testo)
    - Serve il riferimento UUID per collegare i turni ai magazzini reali
    - Questo permette al check-in di recuperare le coordinate GPS del magazzino
    
  3. Note
    - La colonna è nullable per non rompere i dati esistenti
    - I nuovi turni DEVONO popolare questo campo
*/

-- Aggiungi la colonna warehouse_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crew_assegnazione_turni' 
      AND column_name = 'warehouse_id'
  ) THEN
    ALTER TABLE crew_assegnazione_turni 
    ADD COLUMN warehouse_id uuid REFERENCES warehouses(id);
    
    -- Aggiungi indice per performance
    CREATE INDEX IF NOT EXISTS idx_crew_assegnazione_turni_warehouse_id 
    ON crew_assegnazione_turni(warehouse_id);
    
    -- Aggiungi commento
    COMMENT ON COLUMN crew_assegnazione_turni.warehouse_id IS 
    'Foreign key verso warehouses - ID del magazzino per questo turno';
  END IF;
END $$;
