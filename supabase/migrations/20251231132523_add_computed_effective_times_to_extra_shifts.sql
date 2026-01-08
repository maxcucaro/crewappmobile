/*
  # Aggiungi colonne calcolate per orari e pause effettive

  1. Nuove Colonne Calcolate
    - `effective_pausa_pranzo_minuti` (int) - minuti pausa pranzo rettificata o originale
    - `effective_pausa_cena_minuti` (int) - minuti pausa cena rettificata o originale
    - `effective_pausa_totale_minuti` (int) - somma pause pranzo + cena effettive
    - `effective_check_in` (time) - orario check-in rettificato o originale
    - `effective_check_out` (time) - orario check-out rettificato o originale
    - `effective_ore_lavorate_minuti` (int) - minuti lavorati effettivi (check-out - check-in - pause)

  2. Logica
    - Ogni colonna "effective" legge prima il valore rettificato, se non presente usa l'originale
    - I minuti delle pause sono calcolati dalla differenza tra inizio e fine
    - Le ore lavorate sono calcolate dai check-in/out effettivi meno le pause effettive

  3. Stesso pattern per warehouse_checkins
*/

-- =====================================================
-- EXTRA SHIFTS CHECKINS - Colonne Calcolate
-- =====================================================

-- Aggiungi colonne GENERATED per calcolare i valori effettivi
ALTER TABLE extra_shifts_checkins
ADD COLUMN IF NOT EXISTS effective_check_in time
GENERATED ALWAYS AS (
  COALESCE(rectified_check_in_time, check_in_time)
) STORED,

ADD COLUMN IF NOT EXISTS effective_check_out time
GENERATED ALWAYS AS (
  COALESCE(rectified_check_out_time, check_out_time)
) STORED,

ADD COLUMN IF NOT EXISTS effective_pausa_pranzo_inizio time
GENERATED ALWAYS AS (
  COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio)
) STORED,

ADD COLUMN IF NOT EXISTS effective_pausa_pranzo_fine time
GENERATED ALWAYS AS (
  COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine)
) STORED,

ADD COLUMN IF NOT EXISTS effective_pausa_cena_inizio time
GENERATED ALWAYS AS (
  COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio)
) STORED,

ADD COLUMN IF NOT EXISTS effective_pausa_cena_fine time
GENERATED ALWAYS AS (
  COALESCE(rectified_pausa_cena_fine, pausa_cena_fine)
) STORED;

-- Calcola i minuti delle pause (differenza tra fine e inizio)
ALTER TABLE extra_shifts_checkins
ADD COLUMN IF NOT EXISTS effective_pausa_pranzo_minuti integer
GENERATED ALWAYS AS (
  CASE 
    WHEN COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio) IS NOT NULL 
     AND COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine) IS NOT NULL
    THEN EXTRACT(EPOCH FROM (
      COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine) - 
      COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio)
    ))::integer / 60
    ELSE 0
  END
) STORED,

ADD COLUMN IF NOT EXISTS effective_pausa_cena_minuti integer
GENERATED ALWAYS AS (
  CASE 
    WHEN COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio) IS NOT NULL 
     AND COALESCE(rectified_pausa_cena_fine, pausa_cena_fine) IS NOT NULL
    THEN EXTRACT(EPOCH FROM (
      COALESCE(rectified_pausa_cena_fine, pausa_cena_fine) - 
      COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio)
    ))::integer / 60
    ELSE 0
  END
) STORED,

ADD COLUMN IF NOT EXISTS effective_pausa_totale_minuti integer
GENERATED ALWAYS AS (
  COALESCE(
    (CASE 
      WHEN COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio) IS NOT NULL 
       AND COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine) IS NOT NULL
      THEN EXTRACT(EPOCH FROM (
        COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine) - 
        COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio)
      ))::integer / 60
      ELSE 0
    END), 0
  ) + 
  COALESCE(
    (CASE 
      WHEN COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio) IS NOT NULL 
       AND COALESCE(rectified_pausa_cena_fine, pausa_cena_fine) IS NOT NULL
      THEN EXTRACT(EPOCH FROM (
        COALESCE(rectified_pausa_cena_fine, pausa_cena_fine) - 
        COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio)
      ))::integer / 60
      ELSE 0
    END), 0
  )
) STORED;

-- Calcola i minuti lavorati effettivi
ALTER TABLE extra_shifts_checkins
ADD COLUMN IF NOT EXISTS effective_ore_lavorate_minuti integer
GENERATED ALWAYS AS (
  CASE 
    WHEN COALESCE(rectified_check_in_time, check_in_time) IS NOT NULL 
     AND COALESCE(rectified_check_out_time, check_out_time) IS NOT NULL
    THEN (
      EXTRACT(EPOCH FROM (
        COALESCE(rectified_check_out_time, check_out_time) - 
        COALESCE(rectified_check_in_time, check_in_time)
      ))::integer / 60
    ) - (
      COALESCE(
        (CASE 
          WHEN COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio) IS NOT NULL 
           AND COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine) IS NOT NULL
          THEN EXTRACT(EPOCH FROM (
            COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine) - 
            COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio)
          ))::integer / 60
          ELSE 0
        END), 0
      ) + 
      COALESCE(
        (CASE 
          WHEN COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio) IS NOT NULL 
           AND COALESCE(rectified_pausa_cena_fine, pausa_cena_fine) IS NOT NULL
          THEN EXTRACT(EPOCH FROM (
            COALESCE(rectified_pausa_cena_fine, pausa_cena_fine) - 
            COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio)
          ))::integer / 60
          ELSE 0
        END), 0
      )
    )
    ELSE 0
  END
) STORED;

-- =====================================================
-- WAREHOUSE CHECKINS - Stesso pattern
-- =====================================================

ALTER TABLE warehouse_checkins
ADD COLUMN IF NOT EXISTS effective_check_in time
GENERATED ALWAYS AS (
  COALESCE(rectified_check_in_time, check_in_time)
) STORED,

ADD COLUMN IF NOT EXISTS effective_check_out time
GENERATED ALWAYS AS (
  COALESCE(rectified_check_out_time, check_out_time)
) STORED,

ADD COLUMN IF NOT EXISTS effective_pausa_pranzo_inizio time
GENERATED ALWAYS AS (
  COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio)
) STORED,

ADD COLUMN IF NOT EXISTS effective_pausa_pranzo_fine time
GENERATED ALWAYS AS (
  COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine)
) STORED,

ADD COLUMN IF NOT EXISTS effective_pausa_cena_inizio time
GENERATED ALWAYS AS (
  COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio)
) STORED,

ADD COLUMN IF NOT EXISTS effective_pausa_cena_fine time
GENERATED ALWAYS AS (
  COALESCE(rectified_pausa_cena_fine, pausa_cena_fine)
) STORED;

ALTER TABLE warehouse_checkins
ADD COLUMN IF NOT EXISTS effective_pausa_pranzo_minuti integer
GENERATED ALWAYS AS (
  CASE 
    WHEN COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio) IS NOT NULL 
     AND COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine) IS NOT NULL
    THEN EXTRACT(EPOCH FROM (
      COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine) - 
      COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio)
    ))::integer / 60
    ELSE 0
  END
) STORED,

ADD COLUMN IF NOT EXISTS effective_pausa_cena_minuti integer
GENERATED ALWAYS AS (
  CASE 
    WHEN COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio) IS NOT NULL 
     AND COALESCE(rectified_pausa_cena_fine, pausa_cena_fine) IS NOT NULL
    THEN EXTRACT(EPOCH FROM (
      COALESCE(rectified_pausa_cena_fine, pausa_cena_fine) - 
      COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio)
    ))::integer / 60
    ELSE 0
  END
) STORED,

ADD COLUMN IF NOT EXISTS effective_pausa_totale_minuti integer
GENERATED ALWAYS AS (
  COALESCE(
    (CASE 
      WHEN COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio) IS NOT NULL 
       AND COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine) IS NOT NULL
      THEN EXTRACT(EPOCH FROM (
        COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine) - 
        COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio)
      ))::integer / 60
      ELSE 0
    END), 0
  ) + 
  COALESCE(
    (CASE 
      WHEN COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio) IS NOT NULL 
       AND COALESCE(rectified_pausa_cena_fine, pausa_cena_fine) IS NOT NULL
      THEN EXTRACT(EPOCH FROM (
        COALESCE(rectified_pausa_cena_fine, pausa_cena_fine) - 
        COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio)
      ))::integer / 60
      ELSE 0
    END), 0
  )
) STORED;

ALTER TABLE warehouse_checkins
ADD COLUMN IF NOT EXISTS effective_ore_lavorate_minuti integer
GENERATED ALWAYS AS (
  CASE 
    WHEN COALESCE(rectified_check_in_time, check_in_time) IS NOT NULL 
     AND COALESCE(rectified_check_out_time, check_out_time) IS NOT NULL
    THEN (
      EXTRACT(EPOCH FROM (
        COALESCE(rectified_check_out_time, check_out_time) - 
        COALESCE(rectified_check_in_time, check_in_time)
      ))::integer / 60
    ) - (
      COALESCE(
        (CASE 
          WHEN COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio) IS NOT NULL 
           AND COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine) IS NOT NULL
          THEN EXTRACT(EPOCH FROM (
            COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine) - 
            COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio)
          ))::integer / 60
          ELSE 0
        END), 0
      ) + 
      COALESCE(
        (CASE 
          WHEN COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio) IS NOT NULL 
           AND COALESCE(rectified_pausa_cena_fine, pausa_cena_fine) IS NOT NULL
          THEN EXTRACT(EPOCH FROM (
            COALESCE(rectified_pausa_cena_fine, pausa_cena_fine) - 
            COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio)
          ))::integer / 60
          ELSE 0
        END), 0
      )
    )
    ELSE 0
  END
) STORED;

-- Commenti
COMMENT ON COLUMN extra_shifts_checkins.effective_check_in IS 'Orario check-in effettivo (rettificato se presente, altrimenti originale)';
COMMENT ON COLUMN extra_shifts_checkins.effective_check_out IS 'Orario check-out effettivo (rettificato se presente, altrimenti originale)';
COMMENT ON COLUMN extra_shifts_checkins.effective_pausa_pranzo_minuti IS 'Minuti pausa pranzo effettivi (da orari rettificati o originali)';
COMMENT ON COLUMN extra_shifts_checkins.effective_pausa_cena_minuti IS 'Minuti pausa cena effettivi (da orari rettificati o originali)';
COMMENT ON COLUMN extra_shifts_checkins.effective_pausa_totale_minuti IS 'Totale minuti di pause effettive (pranzo + cena)';
COMMENT ON COLUMN extra_shifts_checkins.effective_ore_lavorate_minuti IS 'Minuti lavorati effettivi (check-out - check-in - pause totali)';

COMMENT ON COLUMN warehouse_checkins.effective_check_in IS 'Orario check-in effettivo (rettificato se presente, altrimenti originale)';
COMMENT ON COLUMN warehouse_checkins.effective_check_out IS 'Orario check-out effettivo (rettificato se presente, altrimenti originale)';
COMMENT ON COLUMN warehouse_checkins.effective_pausa_pranzo_minuti IS 'Minuti pausa pranzo effettivi (da orari rettificati o originali)';
COMMENT ON COLUMN warehouse_checkins.effective_pausa_cena_minuti IS 'Minuti pausa cena effettivi (da orari rettificati o originali)';
COMMENT ON COLUMN warehouse_checkins.effective_pausa_totale_minuti IS 'Totale minuti di pause effettive (pranzo + cena)';
COMMENT ON COLUMN warehouse_checkins.effective_ore_lavorate_minuti IS 'Minuti lavorati effettivi (check-out - check-in - pause totali)';
