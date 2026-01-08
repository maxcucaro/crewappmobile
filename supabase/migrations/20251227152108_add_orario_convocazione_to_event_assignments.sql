/*
  # Aggiungi campo orario_convocazione agli eventi

  1. Modifiche
    - Aggiunge colonna `orario_convocazione` (time) a `crew_event_assegnazione`
      Per memorizzare l'orario specifico di convocazione del dipendente all'evento
*/

ALTER TABLE crew_event_assegnazione 
ADD COLUMN IF NOT EXISTS orario_convocazione time;
