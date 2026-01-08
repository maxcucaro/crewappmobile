/*
  # Fix Constraint Unico per Dettaglio Giorni
  
  Un dipendente può avere più record nello stesso giorno con tipi diversi.
  Cambiamo la constraint per permettere più record per giorno, ma unici per tipo.
*/

-- Rimuovi constraint unico se esiste
ALTER TABLE crew_commercialista_dettaglio_giorni
  DROP CONSTRAINT IF EXISTS crew_commercialista_dettaglio_giorni_crew_id_giorno_tipo_key;

-- Aggiungi constraint unico su crew_id + giorno + tipo_giornata
ALTER TABLE crew_commercialista_dettaglio_giorni
  ADD CONSTRAINT crew_commercialista_dettaglio_giorni_crew_id_giorno_tipo_key 
  UNIQUE (crew_id, giorno, tipo_giornata);
