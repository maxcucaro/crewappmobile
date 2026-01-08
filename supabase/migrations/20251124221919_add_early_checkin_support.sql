/*
  # Aggiungi supporto per check-in anticipato

  ## Descrizione
  Aggiunge la colonna `early_checkin` alla tabella `warehouse_checkins` per tracciare
  quando un dipendente fa check-in in anticipo rispetto all'orario programmato del turno.

  ## Modifiche
  1. Nuova colonna
    - `early_checkin` (boolean) - True se il check-in è stato fatto in anticipo (entro 4 ore prima dell'inizio turno)

  ## Motivo
  Permettere ai dipendenti di fare check-in fino a 4 ore prima dell'orario di inizio turno,
  mantenendo traccia di questa informazione per scopi di reportistica e gestione.

  ## Sicurezza
  - La colonna è nullable per compatibilità con i record esistenti
  - Default false per i nuovi record
  - Non vengono modificati trigger o policy RLS esistenti
*/

-- Aggiungi colonna per tracciare check-in anticipati
ALTER TABLE warehouse_checkins
ADD COLUMN IF NOT EXISTS early_checkin boolean DEFAULT false;

-- Commento sulla colonna per documentazione
COMMENT ON COLUMN warehouse_checkins.early_checkin IS 'True se il check-in è stato effettuato in anticipo (entro 4 ore prima dell''orario programmato di inizio turno)';
