/*
  # Fix popola_dettaglio_giorno_semplice to use timesheet_entries
  
  1. Changes
    - Replace crew_event_assegnazione with timesheet_entries for event data
    - Use actual check-in/check-out times from timesheet
    - Use actual benefits from timesheet (not storicized benefits)
    
  2. Why
    - crew_event_assegnazione contains theoretical assignments
    - timesheet_entries contains real check-in/check-out data
    - Only events with actual work should be counted
*/

CREATE OR REPLACE FUNCTION popola_dettaglio_giorno_semplice(
  p_crew_id uuid, 
  p_company_id uuid, 
  p_data_giorno date, 
  p_mese integer, 
  p_anno integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
v_tipo_giornata text := 'riposo';
v_mag_checkin time;
v_mag_checkout time;
v_mag_ore numeric := 0;
v_mag_note text;
v_evento_nome text;
v_evento_checkin time;
v_evento_checkout time;
v_evento_benefits jsonb;
v_evento_total numeric := 0;
v_extra_checkin time;
v_extra_checkout time;
v_extra_minuti integer;
v_extra_tariffa numeric;
v_extra_benefit numeric;
v_extra_note text;
v_assenza_tipo text;
v_assenza_ore numeric;
v_assenza_note text;
v_benefit_giornaliero numeric := 0;
BEGIN
-- Check ferie/permessi
SELECT tipo_richiesta, COALESCE(note, motivo)
INTO v_assenza_tipo, v_assenza_note
FROM crew_richiesteferie_permessi
WHERE dipendente_id = p_crew_id
AND azienda_id = p_company_id
AND stato = 'approvata'
AND p_data_giorno BETWEEN data_inizio AND data_fine
LIMIT 1;

IF v_assenza_tipo IS NOT NULL THEN
v_tipo_giornata := v_assenza_tipo;
END IF;

-- Check malattia/infortunio
IF v_assenza_tipo IS NULL THEN
SELECT tipo, note
INTO v_assenza_tipo, v_assenza_note
FROM crew_malattia_infortunio
WHERE dipendente_id = p_crew_id
AND azienda_id = p_company_id
AND p_data_giorno BETWEEN data_inizio AND data_fine
LIMIT 1;

IF v_assenza_tipo IS NOT NULL THEN
v_tipo_giornata := v_assenza_tipo;
END IF;
END IF;

-- Turni magazzino
SELECT
wc.check_in_time::time,
wc.check_out_time::time,
wc.net_hours,
wc.notes
INTO v_mag_checkin, v_mag_checkout, v_mag_ore, v_mag_note
FROM warehouse_checkins wc
WHERE wc.crew_id = p_crew_id
AND wc.date = p_data_giorno
AND wc.check_out_time IS NOT NULL
LIMIT 1;

IF v_mag_checkin IS NOT NULL THEN
v_tipo_giornata := 'lavorativo';
END IF;

-- Eventi - USA TIMESHEET_ENTRIES INVECE DI CREW_EVENT_ASSEGNAZIONE
SELECT
e.title,
te.start_time::time,
te.end_time::time,
te.benefits_breakdown,
te.total_benefits
INTO v_evento_nome, v_evento_checkin, v_evento_checkout, v_evento_benefits, v_evento_total
FROM timesheet_entries te
LEFT JOIN crew_events e ON te.event_id = e.id
WHERE te.crew_id = p_crew_id
AND te.date = p_data_giorno
AND te.end_time IS NOT NULL
LIMIT 1;

IF v_evento_nome IS NOT NULL THEN
v_tipo_giornata := 'lavorativo';
v_benefit_giornaliero := v_benefit_giornaliero + COALESCE(v_evento_total, 0);
END IF;

-- Turni extra
SELECT
esc.check_in_time::time,
esc.check_out_time::time,
COALESCE(esc.rectified_total_minutes, esc.net_minutes),
esc.benefit_importo_orario,
ROUND((COALESCE(esc.rectified_total_minutes, esc.net_minutes) / 60.0) * COALESCE(esc.benefit_importo_orario, 0), 2),
esc.notes
INTO v_extra_checkin, v_extra_checkout, v_extra_minuti, v_extra_tariffa, v_extra_benefit, v_extra_note
FROM extra_shifts_checkins esc
WHERE esc.crew_id = p_crew_id
AND esc.date = p_data_giorno
AND esc.check_out_time IS NOT NULL
LIMIT 1;

IF v_extra_checkin IS NOT NULL THEN
v_tipo_giornata := 'lavorativo';
v_benefit_giornaliero := v_benefit_giornaliero + COALESCE(v_extra_benefit, 0);
END IF;

-- Inserisci o aggiorna il record
INSERT INTO crew_commercialista_dettaglio_giorni (
crew_id, giorno, mese, anno, tipo_giornata,
magazzino_checkin, magazzino_checkout, magazzino_ore_lavorate, magazzino_note,
evento_nome, evento_checkin, evento_checkout, evento_benefits_breakdown, evento_total_benefits,
extra_checkin, extra_checkout, extra_ore_effettive_minuti, extra_tariffa_oraria, extra_benefit, extra_note,
assenza_tipo, assenza_ore_richieste, assenza_note,
benefit_giornaliero,
created_at, updated_at
) VALUES (
p_crew_id, p_data_giorno, p_mese, p_anno, v_tipo_giornata,
v_mag_checkin, v_mag_checkout, v_mag_ore, v_mag_note,
v_evento_nome, v_evento_checkin, v_evento_checkout, v_evento_benefits, v_evento_total,
v_extra_checkin, v_extra_checkout, v_extra_minuti, v_extra_tariffa, v_extra_benefit, v_extra_note,
v_assenza_tipo, v_assenza_ore, v_assenza_note,
v_benefit_giornaliero,
now(), now()
)
ON CONFLICT (crew_id, giorno)
DO UPDATE SET
tipo_giornata = EXCLUDED.tipo_giornata,
magazzino_checkin = EXCLUDED.magazzino_checkin,
magazzino_checkout = EXCLUDED.magazzino_checkout,
magazzino_ore_lavorate = EXCLUDED.magazzino_ore_lavorate,
magazzino_note = EXCLUDED.magazzino_note,
evento_nome = EXCLUDED.evento_nome,
evento_checkin = EXCLUDED.evento_checkin,
evento_checkout = EXCLUDED.evento_checkout,
evento_benefits_breakdown = EXCLUDED.evento_benefits_breakdown,
evento_total_benefits = EXCLUDED.evento_total_benefits,
extra_checkin = EXCLUDED.extra_checkin,
extra_checkout = EXCLUDED.extra_checkout,
extra_ore_effettive_minuti = EXCLUDED.extra_ore_effettive_minuti,
extra_tariffa_oraria = EXCLUDED.extra_tariffa_oraria,
extra_benefit = EXCLUDED.extra_benefit,
extra_note = EXCLUDED.extra_note,
assenza_tipo = EXCLUDED.assenza_tipo,
assenza_ore_richieste = EXCLUDED.assenza_ore_richieste,
assenza_note = EXCLUDED.assenza_note,
benefit_giornaliero = EXCLUDED.benefit_giornaliero,
updated_at = now();
END;
$$;
