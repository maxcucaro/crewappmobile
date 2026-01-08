/*
  # Fix Unique Constraint per Dettaglio Giorni Commercialista
  
  1. Modifica Constraint
    - Rimuove UNIQUE (crew_id, giorno) che impedisce record multipli nello stesso giorno
    - Aggiunge UNIQUE (crew_id, giorno, tipo_giornata) per permettere:
      * Turno magazzino + permesso ore nello stesso giorno
      * Evento + turno extra nello stesso giorno
      * Ferie ore + turno magazzino nello stesso giorno (caso parziale)
  
  2. Impatto
    - Permette la corretta registrazione di assenze parziali (ore)
    - Mantiene l'integrità: un solo record per tipo_giornata per giorno
*/

-- Rimuovi constraint UNIQUE (crew_id, giorno)
ALTER TABLE crew_commercialista_dettaglio_giorni
  DROP CONSTRAINT IF EXISTS crew_commercialista_dettaglio_giorni_crew_day_unique;

-- Aggiungi constraint UNIQUE (crew_id, giorno, tipo_giornata)
ALTER TABLE crew_commercialista_dettaglio_giorni
  ADD CONSTRAINT crew_commercialista_dettaglio_giorni_crew_day_type_unique
  UNIQUE (crew_id, giorno, tipo_giornata);
