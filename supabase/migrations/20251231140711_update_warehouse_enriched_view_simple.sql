/*
  # Aggiorna view warehouse_checkins_enriched con colonne effective

  1. Modifiche
    - Ricrea la view warehouse_checkins_enriched includendo tutte le colonne
    - Aggiunge il nome del magazzino dalla tabella warehouses
    - Include le colonne effective_* che sono calcolate automaticamente

  2. Risultato
    - Il frontend può leggere effective_ore_lavorate_minuti invece di rectified_total_hours
    - Le ore lavorate saranno calcolate correttamente sottraendo le pause
*/

-- Ricrea la view includendo tutte le colonne della tabella warehouse_checkins
DROP VIEW IF EXISTS warehouse_checkins_enriched CASCADE;

CREATE VIEW warehouse_checkins_enriched AS
SELECT 
  wc.*,
  w.name AS warehouse_name,
  wc.notes AS noteturno
FROM warehouse_checkins wc
LEFT JOIN warehouses w ON w.id = wc.warehouse_id;

COMMENT ON VIEW warehouse_checkins_enriched IS 'View arricchita dei check-in magazzino con nome magazzino. Include tutte le colonne della tabella warehouse_checkins, comprese le colonne effective_* calcolate che tengono conto delle pause.';
