/*
  # Supporto Check-in Forzato (Senza GPS)

  1. Modifiche alle Tabelle
    - Aggiunge campo `forced_checkin` (boolean) a `presenze` per eventi
    - Aggiunge campo `forced_checkin` (boolean) a `warehouse_checkins` per magazzino
    - Aggiunge campo `gps_error_reason` (text) per documentare il motivo del check-in forzato

  2. Logica
    - Se il GPS non funziona o non si trova la posizione, il dipendente può fare check-in forzato
    - Il check-in forzato viene flaggato come `forced_checkin = true`
    - La posizione GPS viene salvata come NULL o con errore
    - Viene salvato il motivo (GPS non disponibile, permessi negati, timeout, ecc.)

  3. Visualizzazione
    - I check-in forzati vengono mostrati con un badge/icona speciale
    - Gli admin possono vedere quali check-in sono stati forzati
    - Utile per tracciare problemi tecnici e verifiche

  4. Note di Sicurezza
    - RLS policies mantengono le stesse regole di sicurezza
    - Solo il dipendente può fare check-in forzato per se stesso
    - Gli admin possono vedere tutti i check-in forzati
*/

-- ===================================
-- TABELLA PRESENZE (Eventi)
-- ===================================

-- Aggiungi campo forced_checkin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'presenze' AND column_name = 'forced_checkin'
  ) THEN
    ALTER TABLE presenze ADD COLUMN forced_checkin boolean DEFAULT false;
  END IF;
END $$;

-- Aggiungi campo gps_error_reason
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'presenze' AND column_name = 'gps_error_reason'
  ) THEN
    ALTER TABLE presenze ADD COLUMN gps_error_reason text;
  END IF;
END $$;

-- ===================================
-- TABELLA WAREHOUSE_CHECKINS (Magazzino)
-- ===================================

-- Aggiungi campo forced_checkin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' AND column_name = 'forced_checkin'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN forced_checkin boolean DEFAULT false;
  END IF;
END $$;

-- Aggiungi campo gps_error_reason
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'warehouse_checkins' AND column_name = 'gps_error_reason'
  ) THEN
    ALTER TABLE warehouse_checkins ADD COLUMN gps_error_reason text;
  END IF;
END $$;

-- ===================================
-- INDICI PER PERFORMANCE
-- ===================================

-- Indice per trovare velocemente check-in forzati
CREATE INDEX IF NOT EXISTS idx_presenze_forced_checkin 
ON presenze(forced_checkin) 
WHERE forced_checkin = true;

CREATE INDEX IF NOT EXISTS idx_warehouse_checkins_forced_checkin 
ON warehouse_checkins(forced_checkin) 
WHERE forced_checkin = true;

-- ===================================
-- FUNZIONE HELPER PER STATISTICHE
-- ===================================

-- Funzione per ottenere statistiche check-in forzati per dipendente
CREATE OR REPLACE FUNCTION get_forced_checkin_stats(p_crew_id uuid, p_start_date date, p_end_date date)
RETURNS TABLE (
  total_checkins bigint,
  forced_checkins bigint,
  forced_percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_checkins,
    COUNT(*) FILTER (WHERE forced_checkin = true)::bigint as forced_checkins,
    ROUND(
      (COUNT(*) FILTER (WHERE forced_checkin = true)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
      2
    ) as forced_percentage
  FROM (
    SELECT forced_checkin FROM presenze 
    WHERE id_tecnico = p_crew_id 
    AND data BETWEEN p_start_date AND p_end_date
    
    UNION ALL
    
    SELECT forced_checkin FROM warehouse_checkins 
    WHERE crew_id = p_crew_id 
    AND date BETWEEN p_start_date AND p_end_date
  ) all_checkins;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================
-- VIEW PER ADMIN: CHECK-IN FORZATI
-- ===================================

-- Vista per gli admin per monitorare check-in forzati
CREATE OR REPLACE VIEW admin_forced_checkins_view AS
SELECT 
  'evento' as tipo_checkin,
  p.id,
  p.id_tecnico as crew_id,
  rr.full_name as crew_name,
  rr.email as crew_email,
  ce.title as evento_nome,
  p.data,
  p.ora_inizio as check_in_time,
  p.forced_checkin,
  p.gps_error_reason,
  p.posizione_gps,
  p.data_creazione as created_at
FROM presenze p
LEFT JOIN registration_requests rr ON rr.id = p.id_tecnico
LEFT JOIN crew_events ce ON ce.id = p.id_evento
WHERE p.forced_checkin = true

UNION ALL

SELECT 
  'magazzino' as tipo_checkin,
  wc.id,
  wc.crew_id,
  rr.full_name as crew_name,
  rr.email as crew_email,
  COALESCE(wc.nome_turno, 'Turno Magazzino') as evento_nome,
  wc.date as data,
  wc.check_in_time,
  wc.forced_checkin,
  wc.gps_error_reason,
  wc.location as posizione_gps,
  wc.created_at
FROM warehouse_checkins wc
LEFT JOIN registration_requests rr ON rr.id = wc.crew_id
WHERE wc.forced_checkin = true

ORDER BY created_at DESC;

-- ===================================
-- COMMENTI
-- ===================================

COMMENT ON COLUMN presenze.forced_checkin IS 'Indica se il check-in è stato fatto senza GPS (forzato)';
COMMENT ON COLUMN presenze.gps_error_reason IS 'Motivo per cui il GPS non era disponibile durante il check-in';
COMMENT ON COLUMN warehouse_checkins.forced_checkin IS 'Indica se il check-in è stato fatto senza GPS (forzato)';
COMMENT ON COLUMN warehouse_checkins.gps_error_reason IS 'Motivo per cui il GPS non era disponibile durante il check-in';
COMMENT ON FUNCTION get_forced_checkin_stats IS 'Ottiene statistiche sui check-in forzati per un dipendente in un periodo';
COMMENT ON VIEW admin_forced_checkins_view IS 'Vista per admin che mostra tutti i check-in forzati (eventi e magazzino)';
