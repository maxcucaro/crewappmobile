/*
  # Fix refresh trigger to use fixed salary of 1400
  
  1. Changes
    - Use fixed stipendio_base = 1400 instead of cm.base_salary
    - Remove totale_compenso calculation (it's a generated column)
    
  2. Why
    - crew_members table doesn't have base_salary column
    - Use fixed value for now (can be made dynamic later)
    - totale_compenso is auto-calculated
*/

CREATE OR REPLACE FUNCTION refresh_commercialista_mensile_on_change()
RETURNS TRIGGER AS $$
DECLARE
  v_anno integer;
  v_mese integer;
  v_crew_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_anno := OLD.anno;
    v_mese := OLD.mese;
    v_crew_id := OLD.crew_id;
  ELSE
    v_anno := NEW.anno;
    v_mese := NEW.mese;
    v_crew_id := NEW.crew_id;
  END IF;

  DELETE FROM crew_commercialista_mensile
  WHERE crew_id = v_crew_id AND anno = v_anno AND mese = v_mese;

  INSERT INTO crew_commercialista_mensile (
    crew_id, nome_dipendente, anno, mese,
    stipendio_base,
    giorni_magazzino, ore_magazzino, benefit_magazzino,
    numero_eventi, benefit_eventi,
    numero_turni_extra, ore_extra_pagate, benefit_extra,
    giorni_ferie, ore_ferie,
    giorni_permessi, ore_permessi,
    giorni_malattia
  )
  SELECT
    d.crew_id,
    MAX(cm.first_name || ' ' || cm.last_name),
    v_anno, v_mese,
    -- Stipendio base fisso
    1400.00,
    -- Magazzino (€0 benefit, già incluso nello stipendio)
    COUNT(*) FILTER (WHERE d.tipo_giornata = 'magazzino'),
    SUM(d.magazzino_ore_lavorate) FILTER (WHERE d.tipo_giornata = 'magazzino'),
    0, -- benefit_magazzino sempre 0
    -- Eventi
    COUNT(*) FILTER (WHERE d.tipo_giornata = 'evento'),
    COALESCE(SUM(d.evento_total_benefits) FILTER (WHERE d.tipo_giornata = 'evento'), 0),
    -- Extra (benefit già calcolato correttamente nel dettaglio)
    COUNT(*) FILTER (WHERE d.tipo_giornata = 'extra'),
    SUM(d.extra_ore_effettive_minuti) FILTER (WHERE d.tipo_giornata = 'extra') / 60.0,
    COALESCE(SUM(d.extra_benefit) FILTER (WHERE d.tipo_giornata = 'extra'), 0),
    -- Ferie
    COUNT(*) FILTER (WHERE d.tipo_giornata IN ('ferie_giornata_intera', 'ferie_ore')),
    SUM(d.assenza_ore_richieste) FILTER (WHERE d.tipo_giornata IN ('ferie_giornata_intera', 'ferie_ore')),
    -- Permessi
    COUNT(*) FILTER (WHERE d.tipo_giornata IN ('permesso_giornata_intera', 'permesso_ore')),
    SUM(d.assenza_ore_richieste) FILTER (WHERE d.tipo_giornata IN ('permesso_giornata_intera', 'permesso_ore')),
    -- Malattia
    COUNT(*) FILTER (WHERE d.tipo_giornata = 'malattia')
  FROM crew_commercialista_dettaglio_giorni d
  LEFT JOIN crew_members cm ON d.crew_id = cm.id
  WHERE d.crew_id = v_crew_id AND d.anno = v_anno AND d.mese = v_mese
  GROUP BY d.crew_id HAVING COUNT(*) > 0;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
