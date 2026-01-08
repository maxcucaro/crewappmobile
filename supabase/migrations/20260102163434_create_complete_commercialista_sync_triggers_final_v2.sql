/*
  # Sincronizzazione completa dati commercialista con aggregazione
  
  Crea trigger per sincronizzare automaticamente:
  - warehouse_checkins → crew_commercialista_dettaglio_giorni (turni magazzino)
  - extra_shifts_checkins → crew_commercialista_dettaglio_giorni (turni extra)
  - timesheet_entries → crew_commercialista_dettaglio_giorni (eventi)
  - Refresh automatico crew_commercialista_mensile
  
  Include note dipendente da tutti i campi disponibili
*/

-- 1. TRIGGER: Sincronizza warehouse_checkins → dettaglio_giorni
CREATE OR REPLACE FUNCTION sync_warehouse_to_commercialista()
RETURNS TRIGGER AS $$
DECLARE
  v_giorno date;
  v_crew_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_giorno := OLD.date;
    v_crew_id := OLD.crew_id;
  ELSE
    v_giorno := NEW.date;
    v_crew_id := NEW.crew_id;
    IF NEW.check_out_time IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  DELETE FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = v_crew_id AND giorno = v_giorno AND tipo_giornata = 'magazzino';

  INSERT INTO crew_commercialista_dettaglio_giorni (
    crew_id, giorno, mese, anno, tipo_giornata,
    magazzino_checkin, magazzino_checkout, magazzino_ore_lavorate, magazzino_note
  )
  SELECT
    wc.crew_id, wc.date,
    EXTRACT(MONTH FROM wc.date)::integer,
    EXTRACT(YEAR FROM wc.date)::integer,
    'magazzino',
    MIN(wc.check_in_time), MAX(wc.check_out_time),
    SUM(COALESCE(wc.net_hours, wc.total_hours, 0)),
    string_agg(COALESCE(wc.notes, '') || CASE WHEN wc.notes IS NOT NULL AND m.nome IS NOT NULL THEN ' | ' ELSE '' END || COALESCE('Magazzino: ' || m.nome, ''), ' | ')
  FROM warehouse_checkins wc
  LEFT JOIN magazzini m ON wc.warehouse_id = m.id
  WHERE wc.crew_id = v_crew_id AND wc.date = v_giorno AND wc.check_out_time IS NOT NULL
  GROUP BY wc.crew_id, wc.date HAVING COUNT(*) > 0;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_warehouse_to_commercialista ON warehouse_checkins;
CREATE TRIGGER trg_sync_warehouse_to_commercialista
  AFTER INSERT OR UPDATE OF check_out_time, net_hours, total_hours, notes OR DELETE
  ON warehouse_checkins FOR EACH ROW EXECUTE FUNCTION sync_warehouse_to_commercialista();

-- 2. TRIGGER: Sincronizza extra_shifts_checkins → dettaglio_giorni
CREATE OR REPLACE FUNCTION sync_extra_shifts_to_commercialista()
RETURNS TRIGGER AS $$
DECLARE
  v_giorno date;
  v_crew_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_giorno := OLD.date;
    v_crew_id := OLD.crew_id;
  ELSE
    v_giorno := NEW.date;
    v_crew_id := NEW.crew_id;
    IF NEW.check_out_time IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  DELETE FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = v_crew_id AND giorno = v_giorno AND tipo_giornata = 'extra';

  INSERT INTO crew_commercialista_dettaglio_giorni (
    crew_id, giorno, mese, anno, tipo_giornata,
    extra_checkin, extra_checkout, extra_ore_effettive_minuti,
    extra_ha_turno_magazzino, extra_tariffa_oraria, extra_benefit, extra_note
  )
  SELECT
    esc.crew_id, esc.date,
    EXTRACT(MONTH FROM esc.date)::integer,
    EXTRACT(YEAR FROM esc.date)::integer,
    'extra',
    MIN(esc.check_in_time), MAX(esc.check_out_time),
    SUM(COALESCE(esc.effective_ore_lavorate_minuti, (esc.total_hours * 60)::integer, 0)),
    bool_or(COALESCE(esc.ha_turno_magazzino, false)),
    AVG(esc.benefit_importo_orario),
    SUM(COALESCE(esc.benefit_importo_orario, 0) * COALESCE(esc.total_hours, 0)),
    string_agg(COALESCE(esc."NoteTurno", '') || CASE WHEN esc.notes IS NOT NULL AND esc."NoteTurno" IS NOT NULL THEN ' | ' ELSE '' END || COALESCE(esc.notes, ''), ' | ')
  FROM extra_shifts_checkins esc
  WHERE esc.crew_id = v_crew_id AND esc.date = v_giorno AND esc.check_out_time IS NOT NULL
  GROUP BY esc.crew_id, esc.date HAVING COUNT(*) > 0;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_extra_shifts_to_commercialista ON extra_shifts_checkins;
CREATE TRIGGER trg_sync_extra_shifts_to_commercialista
  AFTER INSERT OR UPDATE OF check_out_time, total_hours, notes, "NoteTurno", benefit_importo_orario OR DELETE
  ON extra_shifts_checkins FOR EACH ROW EXECUTE FUNCTION sync_extra_shifts_to_commercialista();

-- 3. TRIGGER: Sincronizza timesheet_entries (eventi) → dettaglio_giorni
CREATE OR REPLACE FUNCTION sync_events_to_commercialista()
RETURNS TRIGGER AS $$
DECLARE
  v_giorno date;
  v_crew_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_giorno := OLD.date;
    v_crew_id := OLD.crew_id;
  ELSE
    v_giorno := NEW.date;
    v_crew_id := NEW.crew_id;
  END IF;

  DELETE FROM crew_commercialista_dettaglio_giorni
  WHERE crew_id = v_crew_id AND giorno = v_giorno AND tipo_giornata = 'evento';

  INSERT INTO crew_commercialista_dettaglio_giorni (
    crew_id, giorno, mese, anno, tipo_giornata,
    evento_nome, evento_checkin, evento_checkout, evento_total_benefits
  )
  SELECT
    te.crew_id, te.date,
    EXTRACT(MONTH FROM te.date)::integer,
    EXTRACT(YEAR FROM te.date)::integer,
    'evento',
    string_agg(
      COALESCE(e.title, 'N/D') || 
      CASE WHEN te.notedipendente IS NOT NULL OR te.note IS NOT NULL OR te.notes IS NOT NULL
           THEN ' | ' || COALESCE(te.notedipendente, '') || 
                CASE WHEN te.note IS NOT NULL AND te.notedipendente IS NOT NULL THEN ' | ' ELSE '' END || 
                COALESCE(te.note, '') ||
                CASE WHEN te.notes IS NOT NULL THEN ' | ' || te.notes ELSE '' END
           ELSE '' 
      END,
      ' | '
    ),
    MIN(te.start_time), MAX(te.end_time),
    SUM(COALESCE(te.total_benefits, 0))
  FROM timesheet_entries te
  LEFT JOIN crew_events e ON te.event_id = e.id
  WHERE te.crew_id = v_crew_id AND te.date = v_giorno
  GROUP BY te.crew_id, te.date HAVING COUNT(*) > 0;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_events_to_commercialista ON timesheet_entries;
CREATE TRIGGER trg_sync_events_to_commercialista
  AFTER INSERT OR UPDATE OF net_amount, total_hours, note, notes, notedipendente, total_benefits OR DELETE
  ON timesheet_entries FOR EACH ROW EXECUTE FUNCTION sync_events_to_commercialista();

-- 4. TRIGGER: Aggiorna automaticamente tabella mensile
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
    giorni_magazzino, ore_magazzino, benefit_magazzino,
    numero_eventi, benefit_eventi,
    numero_turni_extra, benefit_extra,
    giorni_ferie, giorni_permessi, giorni_malattia
  )
  SELECT
    d.crew_id,
    MAX(cm.first_name || ' ' || cm.last_name),
    v_anno, v_mese,
    COUNT(*) FILTER (WHERE d.tipo_giornata = 'magazzino'),
    SUM(d.magazzino_ore_lavorate) FILTER (WHERE d.tipo_giornata = 'magazzino'),
    SUM(d.magazzino_ore_lavorate * 10) FILTER (WHERE d.tipo_giornata = 'magazzino'),
    COUNT(*) FILTER (WHERE d.tipo_giornata = 'evento'),
    SUM(d.evento_total_benefits) FILTER (WHERE d.tipo_giornata = 'evento'),
    COUNT(*) FILTER (WHERE d.tipo_giornata = 'extra'),
    SUM(d.extra_benefit) FILTER (WHERE d.tipo_giornata = 'extra'),
    COUNT(*) FILTER (WHERE d.assenza_tipo IN ('ferie_giornata_intera', 'ferie_ore')),
    COUNT(*) FILTER (WHERE d.assenza_tipo IN ('permesso_giornata_intera', 'permesso_ore')),
    COUNT(*) FILTER (WHERE d.assenza_tipo = 'malattia')
  FROM crew_commercialista_dettaglio_giorni d
  LEFT JOIN crew_members cm ON d.crew_id = cm.id
  WHERE d.crew_id = v_crew_id AND d.anno = v_anno AND d.mese = v_mese
  GROUP BY d.crew_id HAVING COUNT(*) > 0;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_refresh_commercialista_mensile ON crew_commercialista_dettaglio_giorni;
CREATE TRIGGER trg_refresh_commercialista_mensile
  AFTER INSERT OR UPDATE OR DELETE ON crew_commercialista_dettaglio_giorni
  FOR EACH ROW EXECUTE FUNCTION refresh_commercialista_mensile_on_change();

-- 5. Popola dati storici (da novembre 2025)
INSERT INTO crew_commercialista_dettaglio_giorni (
  crew_id, giorno, mese, anno, tipo_giornata,
  magazzino_checkin, magazzino_checkout, magazzino_ore_lavorate, magazzino_note
)
SELECT wc.crew_id, wc.date, EXTRACT(MONTH FROM wc.date)::integer, EXTRACT(YEAR FROM wc.date)::integer, 'magazzino',
  MIN(wc.check_in_time), MAX(wc.check_out_time), SUM(COALESCE(wc.net_hours, wc.total_hours, 0)),
  string_agg(COALESCE(wc.notes, '') || CASE WHEN wc.notes IS NOT NULL AND m.nome IS NOT NULL THEN ' | ' ELSE '' END || COALESCE('Magazzino: ' || m.nome, ''), ' | ')
FROM warehouse_checkins wc LEFT JOIN magazzini m ON wc.warehouse_id = m.id
WHERE wc.check_out_time IS NOT NULL AND wc.date >= '2025-11-01'
GROUP BY wc.crew_id, wc.date ON CONFLICT (crew_id, giorno, tipo_giornata) DO NOTHING;

INSERT INTO crew_commercialista_dettaglio_giorni (
  crew_id, giorno, mese, anno, tipo_giornata,
  extra_checkin, extra_checkout, extra_ore_effettive_minuti, extra_ha_turno_magazzino, extra_tariffa_oraria, extra_benefit, extra_note
)
SELECT esc.crew_id, esc.date, EXTRACT(MONTH FROM esc.date)::integer, EXTRACT(YEAR FROM esc.date)::integer, 'extra',
  MIN(esc.check_in_time), MAX(esc.check_out_time), SUM(COALESCE(esc.effective_ore_lavorate_minuti, (esc.total_hours * 60)::integer, 0)),
  bool_or(COALESCE(esc.ha_turno_magazzino, false)), AVG(esc.benefit_importo_orario), SUM(COALESCE(esc.benefit_importo_orario, 0) * COALESCE(esc.total_hours, 0)),
  string_agg(COALESCE(esc."NoteTurno", '') || CASE WHEN esc.notes IS NOT NULL AND esc."NoteTurno" IS NOT NULL THEN ' | ' ELSE '' END || COALESCE(esc.notes, ''), ' | ')
FROM extra_shifts_checkins esc
WHERE esc.check_out_time IS NOT NULL AND esc.date >= '2025-11-01'
GROUP BY esc.crew_id, esc.date ON CONFLICT (crew_id, giorno, tipo_giornata) DO NOTHING;

INSERT INTO crew_commercialista_dettaglio_giorni (
  crew_id, giorno, mese, anno, tipo_giornata, evento_nome, evento_checkin, evento_checkout, evento_total_benefits
)
SELECT te.crew_id, te.date, EXTRACT(MONTH FROM te.date)::integer, EXTRACT(YEAR FROM te.date)::integer, 'evento',
  string_agg(
    COALESCE(e.title, 'N/D') || 
    CASE WHEN te.notedipendente IS NOT NULL OR te.note IS NOT NULL OR te.notes IS NOT NULL
         THEN ' | ' || COALESCE(te.notedipendente, '') || 
              CASE WHEN te.note IS NOT NULL AND te.notedipendente IS NOT NULL THEN ' | ' ELSE '' END || 
              COALESCE(te.note, '') ||
              CASE WHEN te.notes IS NOT NULL THEN ' | ' || te.notes ELSE '' END
         ELSE '' 
    END, ' | '
  ),
  MIN(te.start_time), MAX(te.end_time), SUM(COALESCE(te.total_benefits, 0))
FROM timesheet_entries te LEFT JOIN crew_events e ON te.event_id = e.id
WHERE te.date >= '2025-11-01'
GROUP BY te.crew_id, te.date ON CONFLICT (crew_id, giorno, tipo_giornata) DO NOTHING;
