/*
  # Rimuove constraint vecchio
  
  Rimuove il constraint crew_id + giorno per permettere
  più record per giorno con tipi diversi.
*/

ALTER TABLE crew_commercialista_dettaglio_giorni
  DROP CONSTRAINT IF EXISTS crew_commercialista_dettaglio_giorni_crew_id_giorno_key;
