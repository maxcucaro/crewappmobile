/*
  # Trigger per Popolamento Automatico Tabelle Commercialista
  
  Questi trigger sincronizzano automaticamente:
  1. Turni magazzino da warehouse_checkins
  2. Eventi da timesheet_entries  
  3. Turni extra da extra_shifts_checkins
  4. Ferie/Permessi da vacation_leave_requests
  
  E aggiornano il riepilogo mensile
*/

-- =====================================================
-- FUNZIONE: Sync Turni Magazzino
-- =====================================================

CREATE OR REPLACE FUNCTION sync_magazzino_to_commercialista()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Rimuovi vecchio record se esiste
  DELETE FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = NEW.crew_id 
    AND giorno = NEW.date 
    AND tipo_giornata = 'magazzino';
  
  -- Inserisci solo se checkout completato
  IF NEW.check_out_time IS NOT NULL THEN
    INSERT INTO crew_commercialista_dettaglio_giorni (
      crew_id,
      giorno,
      mese,
      anno,
      tipo_giornata,
      magazzino_checkin,
      magazzino_checkout,
      magazzino_ore_lavorate,
      magazzino_note,
      benefit_giornaliero
    ) VALUES (
      NEW.crew_id,
      NEW.date,
      EXTRACT(MONTH FROM NEW.date)::int,
      EXTRACT(YEAR FROM NEW.date)::int,
      'magazzino',
      NEW.effective_check_in,
      NEW.effective_check_out,
      ROUND(NEW.effective_ore_lavorate_minuti / 60.0, 2),
      COALESCE(NEW.notes, NEW."NoteTurno"),
      0 -- Turni magazzino = €0 benefit
    );
  END IF;
  
  -- Aggiorna riepilogo mensile
  PERFORM refresh_commercialista_mensile(NEW.crew_id, EXTRACT(YEAR FROM NEW.date)::int, EXTRACT(MONTH FROM NEW.date)::int);
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_magazzino ON warehouse_checkins;
CREATE TRIGGER trigger_sync_magazzino
  AFTER INSERT OR UPDATE ON warehouse_checkins
  FOR EACH ROW
  EXECUTE FUNCTION sync_magazzino_to_commercialista();

-- =====================================================
-- FUNZIONE: Sync Eventi
-- =====================================================

CREATE OR REPLACE FUNCTION sync_eventi_to_commercialista()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_name text;
BEGIN
  -- Recupera nome evento
  SELECT COALESCE(nome, 'Evento Sconosciuto') INTO v_event_name
  FROM eventi_azienda
  WHERE id = NEW.event_id;
  
  -- Rimuovi vecchio record se esiste
  DELETE FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = NEW.crew_id 
    AND giorno = NEW.date 
    AND tipo_giornata = 'evento';
  
  -- Inserisci solo se checkout completato
  IF NEW.end_time IS NOT NULL THEN
    INSERT INTO crew_commercialista_dettaglio_giorni (
      crew_id,
      giorno,
      mese,
      anno,
      tipo_giornata,
      evento_nome,
      evento_checkin,
      evento_checkout,
      evento_benefits_breakdown,
      evento_total_benefits,
      benefit_giornaliero
    ) VALUES (
      NEW.crew_id,
      NEW.date,
      EXTRACT(MONTH FROM NEW.date)::int,
      EXTRACT(YEAR FROM NEW.date)::int,
      'evento',
      v_event_name,
      NEW.start_time,
      NEW.end_time,
      COALESCE(NEW.benefits_breakdown, '[]'::jsonb),
      COALESCE(NEW.total_benefits::numeric, 0),
      COALESCE(NEW.total_benefits::numeric, 0)
    );
  END IF;
  
  -- Aggiorna riepilogo mensile
  PERFORM refresh_commercialista_mensile(NEW.crew_id, EXTRACT(YEAR FROM NEW.date)::int, EXTRACT(MONTH FROM NEW.date)::int);
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_eventi ON timesheet_entries;
CREATE TRIGGER trigger_sync_eventi
  AFTER INSERT OR UPDATE ON timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_eventi_to_commercialista();

-- =====================================================
-- FUNZIONE: Sync Turni Extra
-- =====================================================

CREATE OR REPLACE FUNCTION sync_extra_to_commercialista()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_minuti_da_pagare int;
  v_benefit numeric(10,2);
BEGIN
  -- Rimuovi vecchio record se esiste
  DELETE FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = NEW.crew_id 
    AND giorno = NEW.date 
    AND tipo_giornata = 'extra';
  
  -- Inserisci solo se checkout completato
  IF NEW.check_out_time IS NOT NULL THEN
    -- Calcola minuti da pagare
    IF NEW.ha_turno_magazzino THEN
      v_minuti_da_pagare := GREATEST(0, NEW.effective_ore_lavorate_minuti - 480);
    ELSE
      v_minuti_da_pagare := NEW.effective_ore_lavorate_minuti;
    END IF;
    
    -- Calcola benefit
    v_benefit := ROUND((v_minuti_da_pagare::numeric / 60) * COALESCE(NEW.benefit_importo_orario::numeric, 0), 2);
    
    INSERT INTO crew_commercialista_dettaglio_giorni (
      crew_id,
      giorno,
      mese,
      anno,
      tipo_giornata,
      extra_checkin,
      extra_checkout,
      extra_ore_effettive_minuti,
      extra_ha_turno_magazzino,
      extra_ore_magazzino_previste,
      extra_minuti_da_pagare,
      extra_tariffa_oraria,
      extra_benefit,
      extra_note,
      benefit_giornaliero
    ) VALUES (
      NEW.crew_id,
      NEW.date,
      EXTRACT(MONTH FROM NEW.date)::int,
      EXTRACT(YEAR FROM NEW.date)::int,
      'extra',
      NEW.effective_check_in,
      NEW.effective_check_out,
      NEW.effective_ore_lavorate_minuti,
      COALESCE(NEW.ha_turno_magazzino, false),
      CASE WHEN NEW.ha_turno_magazzino THEN 480 ELSE 0 END,
      v_minuti_da_pagare,
      COALESCE(NEW.benefit_importo_orario::numeric, 0),
      v_benefit,
      NEW.notes,
      v_benefit
    );
  END IF;
  
  -- Aggiorna riepilogo mensile
  PERFORM refresh_commercialista_mensile(NEW.crew_id, EXTRACT(YEAR FROM NEW.date)::int, EXTRACT(MONTH FROM NEW.date)::int);
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_extra ON extra_shifts_checkins;
CREATE TRIGGER trigger_sync_extra
  AFTER INSERT OR UPDATE ON extra_shifts_checkins
  FOR EACH ROW
  EXECUTE FUNCTION sync_extra_to_commercialista();

-- =====================================================
-- FUNZIONE: Refresh Riepilogo Mensile
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_commercialista_mensile(
  p_crew_id uuid,
  p_anno int,
  p_mese int
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_stipendio_base numeric(10,2);
  v_giorni_magazzino int;
  v_ore_magazzino numeric(10,2);
  v_numero_eventi int;
  v_benefit_eventi numeric(10,2);
  v_numero_extra int;
  v_ore_extra numeric(10,2);
  v_benefit_extra numeric(10,2);
BEGIN
  -- Recupera stipendio base
  SELECT COALESCE(importo_mensile_personalizzato::numeric, 0)
  INTO v_stipendio_base
  FROM crew_assegnazionetariffa
  WHERE crew_member_id = p_crew_id
  LIMIT 1;
  
  -- Conta turni magazzino
  SELECT 
    COUNT(*),
    COALESCE(SUM(magazzino_ore_lavorate), 0)
  INTO v_giorni_magazzino, v_ore_magazzino
  FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = p_crew_id
    AND anno = p_anno
    AND mese = p_mese
    AND tipo_giornata = 'magazzino';
  
  -- Conta eventi e benefit
  SELECT 
    COUNT(*),
    COALESCE(SUM(evento_total_benefits), 0)
  INTO v_numero_eventi, v_benefit_eventi
  FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = p_crew_id
    AND anno = p_anno
    AND mese = p_mese
    AND tipo_giornata = 'evento';
  
  -- Conta turni extra e benefit
  SELECT 
    COUNT(*),
    COALESCE(SUM(extra_minuti_da_pagare), 0) / 60.0,
    COALESCE(SUM(extra_benefit), 0)
  INTO v_numero_extra, v_ore_extra, v_benefit_extra
  FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = p_crew_id
    AND anno = p_anno
    AND mese = p_mese
    AND tipo_giornata = 'extra';
  
  -- Inserisci o aggiorna riepilogo mensile
  INSERT INTO crew_commercialista_mensile (
    crew_id,
    mese,
    anno,
    stipendio_base,
    giorni_magazzino,
    ore_magazzino,
    benefit_magazzino,
    numero_eventi,
    benefit_eventi,
    numero_turni_extra,
    ore_extra_pagate,
    benefit_extra
  ) VALUES (
    p_crew_id,
    p_mese,
    p_anno,
    v_stipendio_base,
    v_giorni_magazzino,
    v_ore_magazzino,
    0, -- Sempre 0 per magazzino
    v_numero_eventi,
    v_benefit_eventi,
    v_numero_extra,
    v_ore_extra,
    v_benefit_extra
  )
  ON CONFLICT (crew_id, anno, mese) 
  DO UPDATE SET
    stipendio_base = EXCLUDED.stipendio_base,
    giorni_magazzino = EXCLUDED.giorni_magazzino,
    ore_magazzino = EXCLUDED.ore_magazzino,
    benefit_magazzino = EXCLUDED.benefit_magazzino,
    numero_eventi = EXCLUDED.numero_eventi,
    benefit_eventi = EXCLUDED.benefit_eventi,
    numero_turni_extra = EXCLUDED.numero_turni_extra,
    ore_extra_pagate = EXCLUDED.ore_extra_pagate,
    benefit_extra = EXCLUDED.benefit_extra,
    updated_at = now();
END;
$$;
