/*
  # Fix nomi colonne nei trigger commercialista
*/

-- Fix trigger eventi: title invece di event_name
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
  SELECT COALESCE(title, 'Evento Sconosciuto') INTO v_event_name
  FROM crew_events
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

-- Fix refresh mensile: dipendente_id invece di crew_member_id
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
  WHERE dipendente_id = p_crew_id
    AND attivo = true
  ORDER BY data_inizio DESC
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
