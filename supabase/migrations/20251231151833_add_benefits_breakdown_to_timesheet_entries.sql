/*
  # Aggiungi dettaglio benefit a timesheet_entries

  1. Modifiche
    - Aggiunge colonna `benefits_breakdown` (jsonb) a `timesheet_entries`
    - Memorizza i benefit dettagliati con nome, importo e categoria
    - Mantiene la colonna `total_benefits` per il totale

  2. Note
    - La colonna `benefits_breakdown` conterrà un array di oggetti:
      [{
        "id": "benefit-id",
        "nome_tariffa": "Nome Benefit",
        "importo": 50.00,
        "categoria": "benefit"
      }]
    - Questo permette di tracciare esattamente quali benefit sono stati applicati
    - Gli importi sono quelli storicizzati al momento dell'assegnazione
*/

-- Aggiungi colonna benefits_breakdown a timesheet_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_entries'
    AND column_name = 'benefits_breakdown'
  ) THEN
    ALTER TABLE timesheet_entries
    ADD COLUMN benefits_breakdown jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Aggiungi commento alla colonna
COMMENT ON COLUMN timesheet_entries.benefits_breakdown IS 
'Array di benefit dettagliati con nome, importo e categoria. Es: [{"id": "...", "nome_tariffa": "...", "importo": 50.00, "categoria": "benefit"}]';