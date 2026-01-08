/*
  # Sync Ferie, Permessi e Malattie al Commercialista
  
  1. Trigger per crew_richiesteferie_permessi
    - Sincronizza solo richieste con stato = 'approvata'
    - Distingue tra giornata intera e ore
    - Gestisce range di date (data_inizio -> data_fine)
  
  2. Trigger per crew_malattia_infortunio
    - Sincronizza tutte le malattie/infortuni
    - Non richiede approvazione
    - Gestisce range di date
*/

-- =====================================================
-- FUNZIONE: Sync Ferie/Permessi
-- =====================================================

CREATE OR REPLACE FUNCTION sync_ferie_permessi_to_commercialista()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_date date;
  v_tipo_giornata text;
BEGIN
  -- Rimuovi vecchi record per questo range di date
  DELETE FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = NEW.dipendente_id 
    AND giorno >= COALESCE(OLD.data_inizio, NEW.data_inizio)
    AND giorno <= COALESCE(OLD.data_fine, NEW.data_fine)
    AND tipo_giornata IN ('ferie_giornata_intera', 'ferie_ore', 'permesso_giornata_intera', 'permesso_ore');
  
  -- Inserisci solo se approvata
  IF NEW.stato = 'approvata' THEN
    -- Determina tipo giornata
    IF NEW.tipo_richiesta = 'ferie' THEN
      IF COALESCE(NEW.ore_richieste, 0) > 0 THEN
        v_tipo_giornata := 'ferie_ore';
      ELSE
        v_tipo_giornata := 'ferie_giornata_intera';
      END IF;
    ELSE -- permesso
      IF COALESCE(NEW.ore_richieste, 0) > 0 THEN
        v_tipo_giornata := 'permesso_ore';
      ELSE
        v_tipo_giornata := 'permesso_giornata_intera';
      END IF;
    END IF;
    
    -- Inserisci un record per ogni giorno nel range
    v_current_date := NEW.data_inizio;
    WHILE v_current_date <= NEW.data_fine LOOP
      INSERT INTO crew_commercialista_dettaglio_giorni (
        crew_id,
        giorno,
        mese,
        anno,
        tipo_giornata,
        assenza_tipo,
        assenza_ore_richieste,
        assenza_note,
        benefit_giornaliero
      ) VALUES (
        NEW.dipendente_id,
        v_current_date,
        EXTRACT(MONTH FROM v_current_date)::int,
        EXTRACT(YEAR FROM v_current_date)::int,
        v_tipo_giornata,
        NEW.tipo_richiesta,
        NEW.ore_richieste,
        COALESCE(NEW.note, NEW.motivo),
        0
      )
      ON CONFLICT (crew_id, giorno, tipo_giornata) DO UPDATE SET
        assenza_tipo = EXCLUDED.assenza_tipo,
        assenza_ore_richieste = EXCLUDED.assenza_ore_richieste,
        assenza_note = EXCLUDED.assenza_note,
        updated_at = now();
      
      -- Aggiorna riepilogo mensile
      PERFORM refresh_commercialista_mensile(
        NEW.dipendente_id, 
        EXTRACT(YEAR FROM v_current_date)::int, 
        EXTRACT(MONTH FROM v_current_date)::int
      );
      
      v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_ferie_permessi ON crew_richiesteferie_permessi;
CREATE TRIGGER trigger_sync_ferie_permessi
  AFTER INSERT OR UPDATE ON crew_richiesteferie_permessi
  FOR EACH ROW
  EXECUTE FUNCTION sync_ferie_permessi_to_commercialista();

-- =====================================================
-- FUNZIONE: Sync Malattia/Infortunio
-- =====================================================

CREATE OR REPLACE FUNCTION sync_malattia_to_commercialista()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_date date;
BEGIN
  -- Rimuovi vecchi record per questo range di date
  DELETE FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = NEW.crew_id 
    AND giorno >= COALESCE(OLD.data_inizio, NEW.data_inizio)
    AND giorno <= COALESCE(OLD.data_fine, NEW.data_fine)
    AND tipo_giornata = 'malattia';
  
  -- Inserisci un record per ogni giorno nel range
  v_current_date := NEW.data_inizio;
  WHILE v_current_date <= NEW.data_fine LOOP
    INSERT INTO crew_commercialista_dettaglio_giorni (
      crew_id,
      giorno,
      mese,
      anno,
      tipo_giornata,
      assenza_tipo,
      assenza_note,
      benefit_giornaliero
    ) VALUES (
      NEW.crew_id,
      v_current_date,
      EXTRACT(MONTH FROM v_current_date)::int,
      EXTRACT(YEAR FROM v_current_date)::int,
      'malattia',
      NEW.tipo,
      NEW.note,
      0
    )
    ON CONFLICT (crew_id, giorno, tipo_giornata) DO UPDATE SET
      assenza_tipo = EXCLUDED.assenza_tipo,
      assenza_note = EXCLUDED.assenza_note,
      updated_at = now();
    
    -- Aggiorna riepilogo mensile
    PERFORM refresh_commercialista_mensile(
      NEW.crew_id, 
      EXTRACT(YEAR FROM v_current_date)::int, 
      EXTRACT(MONTH FROM v_current_date)::int
    );
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_malattia ON crew_malattia_infortunio;
CREATE TRIGGER trigger_sync_malattia
  AFTER INSERT OR UPDATE ON crew_malattia_infortunio
  FOR EACH ROW
  EXECUTE FUNCTION sync_malattia_to_commercialista();

-- =====================================================
-- Aggiorna funzione refresh_commercialista_mensile
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
  v_nome_dipendente text;
  v_stipendio_base numeric(10,2);
  v_giorni_magazzino int;
  v_ore_magazzino numeric(10,2);
  v_numero_eventi int;
  v_benefit_eventi numeric(10,2);
  v_numero_extra int;
  v_ore_extra numeric(10,2);
  v_benefit_extra numeric(10,2);
  v_giorni_ferie int;
  v_ore_ferie numeric(10,2);
  v_giorni_permessi int;
  v_ore_permessi numeric(10,2);
  v_giorni_malattia int;
BEGIN
  -- Recupera nome dipendente
  SELECT full_name
  INTO v_nome_dipendente
  FROM crew_members
  WHERE id = p_crew_id;
  
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
  
  -- Conta ferie
  SELECT 
    COUNT(*),
    COALESCE(SUM(assenza_ore_richieste), 0)
  INTO v_giorni_ferie, v_ore_ferie
  FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = p_crew_id
    AND anno = p_anno
    AND mese = p_mese
    AND tipo_giornata IN ('ferie_giornata_intera', 'ferie_ore');
  
  -- Conta permessi
  SELECT 
    COUNT(*),
    COALESCE(SUM(assenza_ore_richieste), 0)
  INTO v_giorni_permessi, v_ore_permessi
  FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = p_crew_id
    AND anno = p_anno
    AND mese = p_mese
    AND tipo_giornata IN ('permesso_giornata_intera', 'permesso_ore');
  
  -- Conta malattie
  SELECT COUNT(*)
  INTO v_giorni_malattia
  FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = p_crew_id
    AND anno = p_anno
    AND mese = p_mese
    AND tipo_giornata = 'malattia';
  
  -- Inserisci o aggiorna riepilogo mensile
  INSERT INTO crew_commercialista_mensile (
    crew_id,
    mese,
    anno,
    nome_dipendente,
    stipendio_base,
    giorni_magazzino,
    ore_magazzino,
    benefit_magazzino,
    numero_eventi,
    benefit_eventi,
    numero_turni_extra,
    ore_extra_pagate,
    benefit_extra,
    giorni_ferie,
    ore_ferie,
    giorni_permessi,
    ore_permessi,
    giorni_malattia
  ) VALUES (
    p_crew_id,
    p_mese,
    p_anno,
    v_nome_dipendente,
    v_stipendio_base,
    v_giorni_magazzino,
    v_ore_magazzino,
    0,
    v_numero_eventi,
    v_benefit_eventi,
    v_numero_extra,
    v_ore_extra,
    v_benefit_extra,
    v_giorni_ferie,
    v_ore_ferie,
    v_giorni_permessi,
    v_ore_permessi,
    v_giorni_malattia
  )
  ON CONFLICT (crew_id, anno, mese) 
  DO UPDATE SET
    nome_dipendente = EXCLUDED.nome_dipendente,
    stipendio_base = EXCLUDED.stipendio_base,
    giorni_magazzino = EXCLUDED.giorni_magazzino,
    ore_magazzino = EXCLUDED.ore_magazzino,
    benefit_magazzino = EXCLUDED.benefit_magazzino,
    numero_eventi = EXCLUDED.numero_eventi,
    benefit_eventi = EXCLUDED.benefit_eventi,
    numero_turni_extra = EXCLUDED.numero_turni_extra,
    ore_extra_pagate = EXCLUDED.ore_extra_pagate,
    benefit_extra = EXCLUDED.benefit_extra,
    giorni_ferie = EXCLUDED.giorni_ferie,
    ore_ferie = EXCLUDED.ore_ferie,
    giorni_permessi = EXCLUDED.giorni_permessi,
    ore_permessi = EXCLUDED.ore_permessi,
    giorni_malattia = EXCLUDED.giorni_malattia,
    updated_at = now();
END;
$$;
