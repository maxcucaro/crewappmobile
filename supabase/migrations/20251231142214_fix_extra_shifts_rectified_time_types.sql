/*
  # Fix Tipo Dati Rettifiche Turni Extra
  
  ## Problema
  I campi `rectified_check_in_time` e `rectified_check_out_time` nella tabella 
  `extra_shifts_checkins` erano di tipo `timestamptz` invece di `time`, causando:
  - Incompatibilità con i campi originali (`check_in_time`, `check_out_time`)
  - Errori nelle colonne GENERATED `effective_check_in` e `effective_check_out`
  - Rettifiche che non si salvano correttamente
  
  ## Modifiche
  1. Rimuove le colonne GENERATED problematiche (effective_*)
  2. Converte `rectified_check_in_time` e `rectified_check_out_time` da `timestamptz` a `time`
  3. Riaggiunge le colonne GENERATED con i tipi corretti
  
  ## Sicurezza
  - Mantiene tutti i dati esistenti (conversione automatica timestamptz -> time)
  - Non modifica le policy RLS
*/

-- =====================================================
-- STEP 1: Rimuovi colonne GENERATED problematiche
-- =====================================================

-- Rimuovi colonne GENERATED da extra_shifts_checkins
ALTER TABLE extra_shifts_checkins
DROP COLUMN IF EXISTS effective_check_in CASCADE,
DROP COLUMN IF EXISTS effective_check_out CASCADE,
DROP COLUMN IF EXISTS effective_pausa_pranzo_inizio CASCADE,
DROP COLUMN IF EXISTS effective_pausa_pranzo_fine CASCADE,
DROP COLUMN IF EXISTS effective_pausa_cena_inizio CASCADE,
DROP COLUMN IF EXISTS effective_pausa_cena_fine CASCADE,
DROP COLUMN IF EXISTS effective_pausa_pranzo_minuti CASCADE,
DROP COLUMN IF EXISTS effective_pausa_cena_minuti CASCADE,
DROP COLUMN IF EXISTS effective_pausa_totale_minuti CASCADE,
DROP COLUMN IF EXISTS effective_ore_lavorate_minuti CASCADE;

-- =====================================================
-- STEP 2: Converti rectified_check_in/out_time da timestamptz a time
-- =====================================================

-- Converti rectified_check_in_time da timestamptz a time
DO $$
BEGIN
  -- Controlla se la colonna esiste ed è di tipo timestamptz
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'extra_shifts_checkins' 
    AND column_name = 'rectified_check_in_time'
    AND data_type = 'timestamp with time zone'
  ) THEN
    -- Converte il tipo, mantenendo solo la parte time
    ALTER TABLE extra_shifts_checkins 
    ALTER COLUMN rectified_check_in_time TYPE time USING rectified_check_in_time::time;
  END IF;
END $$;

DO $$
BEGIN
  -- Controlla se la colonna esiste ed è di tipo timestamptz
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'extra_shifts_checkins' 
    AND column_name = 'rectified_check_out_time'
    AND data_type = 'timestamp with time zone'
  ) THEN
    -- Converte il tipo, mantenendo solo la parte time
    ALTER TABLE extra_shifts_checkins 
    ALTER COLUMN rectified_check_out_time TYPE time USING rectified_check_out_time::time;
  END IF;
END $$;

-- =====================================================
-- STEP 3: Riaggiunge colonne GENERATED con tipi corretti
-- =====================================================

-- Aggiungi colonne GENERATED per calcolare i valori effettivi (time type)
ALTER TABLE extra_shifts_checkins
ADD COLUMN effective_check_in time
GENERATED ALWAYS AS (
  COALESCE(rectified_check_in_time, check_in_time)
) STORED,

ADD COLUMN effective_check_out time
GENERATED ALWAYS AS (
  COALESCE(rectified_check_out_time, check_out_time)
) STORED,

ADD COLUMN effective_pausa_pranzo_inizio time
GENERATED ALWAYS AS (
  COALESCE(rectified_pausa_pranzo_inizio, pausa_pranzo_inizio)
) STORED,

ADD COLUMN effective_pausa_pranzo_fine time
GENERATED ALWAYS AS (
  COALESCE(rectified_pausa_pranzo_fine, pausa_pranzo_fine)
) STORED,

ADD COLUMN effective_pausa_cena_inizio time
GENERATED ALWAYS AS (
  COALESCE(rectified_pausa_cena_inizio, pausa_cena_inizio)
) STORED,

ADD COLUMN effective_pausa_cena_fine time
GENERATED ALWAYS AS (
  COALESCE(rectified_pausa_cena_fine, pausa_cena_fine)
) STORED;

-- Calcola i minuti delle pause (differenza tra fine e inizio)
ALTER TABLE extra_shifts_checkins
ADD COLUMN effective_pausa_pranzo_minuti integer
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

ADD COLUMN effective_pausa_cena_minuti integer
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

ADD COLUMN effective_pausa_totale_minuti integer
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
ADD COLUMN effective_ore_lavorate_minuti integer
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
COMMENT ON COLUMN extra_shifts_checkins.rectified_check_in_time IS 'Orario check-in rettificato (time, non timestamptz!)';
COMMENT ON COLUMN extra_shifts_checkins.rectified_check_out_time IS 'Orario check-out rettificato (time, non timestamptz!)';
COMMENT ON COLUMN extra_shifts_checkins.effective_check_in IS 'Orario check-in effettivo (rettificato se presente, altrimenti originale)';
COMMENT ON COLUMN extra_shifts_checkins.effective_check_out IS 'Orario check-out effettivo (rettificato se presente, altrimenti originale)';
COMMENT ON COLUMN extra_shifts_checkins.effective_pausa_pranzo_minuti IS 'Minuti pausa pranzo effettivi (da orari rettificati o originali)';
COMMENT ON COLUMN extra_shifts_checkins.effective_pausa_cena_minuti IS 'Minuti pausa cena effettivi (da orari rettificati o originali)';
COMMENT ON COLUMN extra_shifts_checkins.effective_pausa_totale_minuti IS 'Totale minuti di pause effettive (pranzo + cena)';
COMMENT ON COLUMN extra_shifts_checkins.effective_ore_lavorate_minuti IS 'Minuti lavorati effettivi (check-out - check-in - pause totali)';
