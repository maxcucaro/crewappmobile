/*
  # Fix nome colonna in refresh_commercialista_mensile
  
  La colonna corretta è dipendente_id, non crew_member_id
*/

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
