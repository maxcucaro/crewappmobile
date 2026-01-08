/*
  # ROLLBACK - Ripristino auth_user_id originali

  ATTENZIONE: Questa migration ripristina la situazione precedente
  Usare SOLO se la sincronizzazione degli ID causa problemi

  1. Ripristino
    - Ripristina auth_user_id dai dati di backup
    - Rimuove la tabella di backup
    - Torna alla situazione originale

  2. Uso
    - Eseguire SOLO se necessario rollback
    - Verificare che registration_requests_backup esista
    - Controllare i dati prima del ripristino
*/

-- ROLLBACK: Ripristina i dati originali dal backup
UPDATE registration_requests 
SET auth_user_id = backup.auth_user_id
FROM registration_requests_backup backup
WHERE registration_requests.id = backup.id;

-- Verifica ripristino
DO $$
BEGIN
  RAISE NOTICE 'Rollback completato. Records ripristinati: %', (
    SELECT COUNT(*) 
    FROM registration_requests r
    JOIN registration_requests_backup b ON r.id = b.id
    WHERE r.auth_user_id = b.auth_user_id
  );
END $$;

-- Rimuovi tabella backup (opzionale - commentato per sicurezza)
-- DROP TABLE IF EXISTS registration_requests_backup;