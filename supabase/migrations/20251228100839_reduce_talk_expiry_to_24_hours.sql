/*
  # Riduzione Scadenza Messaggi Company Talks a 24 Ore
  
  ## Descrizione
  Riduce il tempo di conservazione dei messaggi da 30 giorni a 24 ore per
  ottimizzare lo spazio di archiviazione e garantire che i messaggi vecchi
  vengano eliminati automaticamente.
  
  ## Modifiche
  
  1. **Colonna expires_at**
     - Modifica default da 30 giorni a 24 ore (1 giorno)
     - I messaggi futuri avranno scadenza automatica dopo 24 ore
  
  2. **Messaggi Esistenti**
     - Aggiorna tutti i messaggi esistenti non ancora scaduti
     - Imposta nuova scadenza a 24 ore dalla creazione originale
  
  ## Note Importanti
  - I messaggi esistenti più vecchi di 24 ore verranno eliminati 
    dalla prossima esecuzione della pulizia automatica
  - I nuovi messaggi avranno automaticamente scadenza 24 ore
*/

-- Modifica il default della colonna expires_at a 24 ore
ALTER TABLE company_talks 
  ALTER COLUMN expires_at 
  SET DEFAULT (now() + interval '24 hours');

-- Aggiorna i messaggi esistenti per riflettere la nuova policy
-- (solo messaggi non ancora scaduti con il vecchio default di 30 giorni)
UPDATE company_talks
SET expires_at = created_at + interval '24 hours'
WHERE expires_at > now();

-- Aggiorna il commento della colonna
COMMENT ON COLUMN company_talks.expires_at IS 'Data di scadenza per auto-eliminazione (default 24 ore). Chiamare delete_expired_talks() per pulizia automatica';

-- Aggiorna il commento della tabella
COMMENT ON TABLE company_talks IS 'Sistema di messaggistica ottimizzato: file in Storage (max 20MB), auto-delete dopo 24 ore, eliminazione manuale disponibile';
