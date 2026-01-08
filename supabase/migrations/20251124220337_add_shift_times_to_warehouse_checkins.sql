/*
  # Aggiungi orari turno a warehouse_checkins

  ## Descrizione
  Aggiunge le colonne `ora_inizio_turno` e `ora_fine_turno` alla tabella `warehouse_checkins`
  per risolvere il problema dell'auto-checkout che usa il default '17:00' invece dell'orario
  effettivo del turno.

  ## Modifiche
  1. Nuove colonne
    - `ora_inizio_turno` (time) - Orario di inizio turno programmato
    - `ora_fine_turno` (time) - Orario di fine turno programmato

  ## Motivo
  Attualmente il sistema fa auto-checkout alle 17:00 (default) anche se il turno finisce
  a un orario diverso (es. 17:30), perché non trova i dati del template nel JOIN.
  Salvando gli orari direttamente nella tabella warehouse_checkins durante il check-in,
  eliminiamo la dipendenza dal JOIN e garantiamo che l'auto-checkout usi sempre l'orario corretto.

  ## Sicurezza
  - Le colonne sono nullable per compatibilità con i record esistenti
  - Non vengono modificati dati esistenti
  - Non viene modificato nessun trigger o policy RLS
*/

-- Aggiungi colonne per gli orari del turno
ALTER TABLE warehouse_checkins
ADD COLUMN IF NOT EXISTS ora_inizio_turno time,
ADD COLUMN IF NOT EXISTS ora_fine_turno time;

-- Commento sulle colonne per documentazione
COMMENT ON COLUMN warehouse_checkins.ora_inizio_turno IS 'Orario di inizio turno programmato (copiato dal template al momento del check-in)';
COMMENT ON COLUMN warehouse_checkins.ora_fine_turno IS 'Orario di fine turno programmato (copiato dal template al momento del check-in, usato per auto-checkout)';
