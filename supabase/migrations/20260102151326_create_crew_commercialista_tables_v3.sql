/*
  # Tabelle Report Commercialista - Dettaglio Corretto

  1. Tabella `crew_commercialista_dettaglio_giorni`
    - Dettaglio giornaliero per ogni dipendente
    - Mostra cosa ha fatto ogni giorno (magazzino, evento, extra, ferie, permessi)
    - Calcola benefit corretti per ogni tipologia
    
  2. Tabella `crew_commercialista_mensile`
    - Riepilogo mensile per dipendente
    - Stipendio base + benefit eventi + benefit extra
    - Non calcola compensi per turni magazzino (già inclusi)
    
  ## Logica di Calcolo:
  - Stipendio Base: importo fisso mensile dal contratto
  - Turni Magazzino: €0 (già inclusi nello stipendio)
  - Eventi: benefit da timesheet_entries.total_benefits
  - Extra: (ore_effettive - 8h_se_ha_magazzino) * tariffa_oraria
  - Ferie/Permessi: solo conteggio giorni
*/

-- =====================================================
-- TABELLA DETTAGLIO GIORNALIERO
-- =====================================================

DROP TABLE IF EXISTS crew_commercialista_dettaglio_giorni CASCADE;

CREATE TABLE crew_commercialista_dettaglio_giorni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  giorno date NOT NULL,
  mese int NOT NULL,
  anno int NOT NULL,
  
  -- Tipo attività giornaliera
  tipo_giornata text NOT NULL CHECK (tipo_giornata IN (
    'magazzino', 
    'evento', 
    'extra', 
    'ferie_giornata_intera',
    'ferie_ore',
    'permesso_giornata_intera', 
    'permesso_ore',
    'malattia',
    'riposo'
  )),
  
  -- Dettagli turno magazzino (€0 benefit)
  magazzino_checkin time,
  magazzino_checkout time,
  magazzino_ore_lavorate numeric(5,2),
  magazzino_note text,
  
  -- Dettagli evento (benefit da timesheet_entries)
  evento_nome text,
  evento_checkin time,
  evento_checkout time,
  evento_benefits_breakdown jsonb DEFAULT '[]'::jsonb,
  evento_total_benefits numeric(10,2) DEFAULT 0,
  
  -- Dettagli turno extra (benefit calcolato)
  extra_checkin time,
  extra_checkout time,
  extra_ore_effettive_minuti int,
  extra_ha_turno_magazzino boolean DEFAULT false,
  extra_ore_magazzino_previste int DEFAULT 0,
  extra_minuti_da_pagare int,
  extra_tariffa_oraria numeric(10,2),
  extra_benefit numeric(10,2) DEFAULT 0,
  extra_note text,
  
  -- Dettagli ferie/permessi
  assenza_tipo text,
  assenza_ore_richieste numeric(5,2),
  assenza_note text,
  
  -- Totale benefit giornaliero
  benefit_giornaliero numeric(10,2) DEFAULT 0,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indici per performance
CREATE INDEX idx_dettaglio_crew_giorno ON crew_commercialista_dettaglio_giorni(crew_id, giorno);
CREATE INDEX idx_dettaglio_mese_anno ON crew_commercialista_dettaglio_giorni(crew_id, anno, mese);

-- RLS
ALTER TABLE crew_commercialista_dettaglio_giorni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew can view own accounting details"
  ON crew_commercialista_dettaglio_giorni FOR SELECT
  TO authenticated
  USING (crew_id = auth.uid());

-- =====================================================
-- TABELLA RIEPILOGO MENSILE
-- =====================================================

DROP TABLE IF EXISTS crew_commercialista_mensile CASCADE;

CREATE TABLE crew_commercialista_mensile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  mese int NOT NULL CHECK (mese >= 1 AND mese <= 12),
  anno int NOT NULL CHECK (anno >= 2020),
  
  -- Stipendio base (dal contratto)
  stipendio_base numeric(10,2) NOT NULL DEFAULT 0,
  
  -- Conteggio giorni magazzino (nessun benefit aggiuntivo)
  giorni_magazzino int DEFAULT 0,
  ore_magazzino numeric(10,2) DEFAULT 0,
  benefit_magazzino numeric(10,2) DEFAULT 0,
  
  -- Totale benefit eventi
  numero_eventi int DEFAULT 0,
  benefit_eventi numeric(10,2) DEFAULT 0,
  
  -- Totale benefit turni extra
  numero_turni_extra int DEFAULT 0,
  ore_extra_pagate numeric(10,2) DEFAULT 0,
  benefit_extra numeric(10,2) DEFAULT 0,
  
  -- Ferie e permessi (solo conteggio)
  giorni_ferie int DEFAULT 0,
  ore_ferie numeric(10,2) DEFAULT 0,
  giorni_permessi int DEFAULT 0,
  ore_permessi numeric(10,2) DEFAULT 0,
  giorni_malattia int DEFAULT 0,
  
  -- TOTALE COMPENSO MENSILE
  totale_compenso numeric(10,2) GENERATED ALWAYS AS (
    stipendio_base + benefit_eventi + benefit_extra
  ) STORED,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(crew_id, anno, mese)
);

-- Indici
CREATE INDEX idx_mensile_crew ON crew_commercialista_mensile(crew_id);
CREATE INDEX idx_mensile_periodo ON crew_commercialista_mensile(anno, mese);

-- RLS
ALTER TABLE crew_commercialista_mensile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew can view own monthly accounting"
  ON crew_commercialista_mensile FOR SELECT
  TO authenticated
  USING (crew_id = auth.uid());
