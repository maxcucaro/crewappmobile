/*
  # Aggiungi campo ore straordinario a turni completati

  ## Cambiamenti
  - Aggiunge colonna `ore_straordinario` a `crew_turni_completati`
  - Tipo: numeric (per supportare decimali come 2.5 ore)
  - Valore di default: 0
  - Nullable: true (per permettere NULL se non ci sono straordinari)

  ## Note
  - Le ore di straordinario possono essere inserite solo se il dipendente ha
    un benefit per straordinari nel contratto
  - Questo campo viene popolato manualmente dal dipendente tramite l'app
*/

-- Aggiungi colonna ore_straordinario
ALTER TABLE crew_turni_completati
ADD COLUMN IF NOT EXISTS ore_straordinario numeric DEFAULT 0;

-- Aggiungi commento per documentazione
COMMENT ON COLUMN crew_turni_completati.ore_straordinario IS 
'Ore di straordinario effettuate durante il turno. Inseribile solo se il dipendente ha benefit per straordinari nel contratto.';
