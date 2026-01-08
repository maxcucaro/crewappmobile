/*
  # Schema Database in Italiano per CrewManager

  1. Nuove Tabelle
    - `utenti`: Tabella base per tutti gli utenti
    - `aziende`: Dettagli delle aziende
    - `tecnici`: Dettagli dei tecnici (crew)
    - `eventi`: Eventi creati dalle aziende
    - `assegnazioni_tecnici`: Assegnazioni tecnici agli eventi
    - `negoziazioni_tariffe`: Negoziazioni tariffe tra aziende e tecnici
    - `proposte_tariffe`: Proposte di tariffa nelle negoziazioni
    - `presenze`: Registrazioni ore lavorate
    - `spese`: Note spese inviate dai tecnici
    - `documenti`: Documenti caricati (buste paga, contratti, ecc.)
    - `richieste_straordinari`: Richieste di straordinari
    - `checkin_magazzino`: Check-in magazzino tramite QR code
    - `corsi_formazione`: Corsi di formazione
    - `iscrizioni_corsi`: Iscrizioni ai corsi di formazione
    - `impostazioni_privacy`: Impostazioni privacy per i tecnici
    - `notifiche`: Notifiche di sistema

  2. Sicurezza
    - Enable RLS su tutte le tabelle
    - Aggiunte policy per utenti autenticati
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabella Utenti (tabella base per tutti gli utenti)
CREATE TABLE IF NOT EXISTS utenti (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  ruolo TEXT NOT NULL CHECK (ruolo IN ('amministratore', 'azienda', 'tecnico')),
  data_creazione TIMESTAMPTZ DEFAULT now(),
  data_aggiornamento TIMESTAMPTZ DEFAULT now(),
  approvato BOOLEAN DEFAULT false,
  attivo BOOLEAN DEFAULT true,
  ultimo_accesso TIMESTAMPTZ
);

-- Tabella Aziende
CREATE TABLE IF NOT EXISTS aziende (
  id UUID PRIMARY KEY REFERENCES utenti(id) ON DELETE CASCADE,
  nome_azienda TEXT NOT NULL,
  partita_iva TEXT UNIQUE,
  indirizzo TEXT,
  telefono TEXT,
  persona_contatto TEXT,
  email_contatto TEXT,
  telefono_contatto TEXT,
  sito_web TEXT,
  livello_abbonamento TEXT DEFAULT 'gratuito' CHECK (livello_abbonamento IN ('gratuito', 'base', 'premium', 'enterprise')),
  scadenza_abbonamento TIMESTAMPTZ,
  url_logo TEXT
);

-- Tabella Tecnici
CREATE TABLE IF NOT EXISTS tecnici (
  id UUID PRIMARY KEY REFERENCES utenti(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  telefono TEXT,
  indirizzo TEXT,
  tipo_profilo TEXT NOT NULL CHECK (tipo_profilo IN ('freelance', 'dipendente')),
  id_azienda UUID REFERENCES aziende(id) NULL,
  competenze TEXT[] DEFAULT '{}',
  anni_esperienza INTEGER DEFAULT 0,
  tariffa_oraria DECIMAL(10, 2),
  tariffa_giornaliera DECIMAL(10, 2),
  biografia TEXT,
  agibilita_attiva BOOLEAN DEFAULT false,
  data_scadenza_agibilita DATE,
  numero_documento_agibilita TEXT,
  disponibilita JSONB DEFAULT '{"lunedi": true, "martedi": true, "mercoledi": true, "giovedi": true, "venerdi": true, "sabato": false, "domenica": false}'::jsonb,
  valutazione DECIMAL(3, 2),
  numero_valutazioni INTEGER DEFAULT 0
);

-- Tabella Eventi
CREATE TABLE IF NOT EXISTS eventi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_azienda UUID NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
  titolo TEXT NOT NULL,
  descrizione TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('magazzino', 'evento', 'evento_trasferta')),
  data_inizio DATE NOT NULL,
  data_fine DATE NOT NULL,
  luogo TEXT,
  tecnici_richiesti INTEGER DEFAULT 1,
  stato TEXT DEFAULT 'bozza' CHECK (stato IN ('bozza', 'pubblicato', 'in_corso', 'completato')),
  data_creazione TIMESTAMPTZ DEFAULT now(),
  data_aggiornamento TIMESTAMPTZ DEFAULT now()
);

-- Tabella Assegnazioni Tecnici
CREATE TABLE IF NOT EXISTS assegnazioni_tecnici (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_evento UUID NOT NULL REFERENCES eventi(id) ON DELETE CASCADE,
  id_tecnico UUID NOT NULL REFERENCES tecnici(id) ON DELETE CASCADE,
  id_negoziazione_tariffa UUID,
  stato_pagamento TEXT DEFAULT 'in_attesa' CHECK (stato_pagamento IN ('in_attesa', 'pagato', 'confermato_da_tecnico')),
  percentuale_trattenuta_azienda DECIMAL(5, 2) DEFAULT 0,
  tariffa_oraria_finale DECIMAL(10, 2),
  tariffa_giornaliera_finale DECIMAL(10, 2),
  data_creazione TIMESTAMPTZ DEFAULT now(),
  data_aggiornamento TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_evento, id_tecnico)
);

-- Tabella Negoziazioni Tariffe
CREATE TABLE IF NOT EXISTS negoziazioni_tariffe (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_evento UUID NOT NULL REFERENCES eventi(id) ON DELETE CASCADE,
  id_tecnico UUID NOT NULL REFERENCES tecnici(id) ON DELETE CASCADE,
  id_azienda UUID NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
  stato TEXT DEFAULT 'proposta_azienda' CHECK (stato IN ('proposta_azienda', 'controproposta_tecnico', 'accettata', 'rifiutata')),
  tariffa_oraria_finale DECIMAL(10, 2),
  tariffa_giornaliera_finale DECIMAL(10, 2),
  percentuale_trattenuta_finale DECIMAL(5, 2),
  data_creazione TIMESTAMPTZ DEFAULT now(),
  data_aggiornamento TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_evento, id_tecnico)
);

-- Tabella Proposte Tariffe
CREATE TABLE IF NOT EXISTS proposte_tariffe (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_negoziazione UUID NOT NULL REFERENCES negoziazioni_tariffe(id) ON DELETE CASCADE,
  proposta_da TEXT NOT NULL CHECK (proposta_da IN ('azienda', 'tecnico')),
  tariffa_oraria DECIMAL(10, 2),
  tariffa_giornaliera DECIMAL(10, 2),
  percentuale_trattenuta DECIMAL(5, 2) NOT NULL,
  messaggio TEXT,
  data_proposta TIMESTAMPTZ DEFAULT now()
);

-- Tabella Presenze
CREATE TABLE IF NOT EXISTS presenze (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_tecnico UUID NOT NULL REFERENCES tecnici(id) ON DELETE CASCADE,
  id_evento UUID NOT NULL REFERENCES eventi(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  ora_inizio TIME,
  ora_fine TIME,
  pausa_minuti INTEGER DEFAULT 0,
  ore_totali DECIMAL(5, 2),
  giorni_totali DECIMAL(3, 1),
  tipo_tracciamento TEXT NOT NULL CHECK (tipo_tracciamento IN ('ore', 'giorni')),
  tariffa_oraria DECIMAL(10, 2),
  tariffa_giornaliera DECIMAL(10, 2),
  percentuale_trattenuta DECIMAL(5, 2) NOT NULL,
  importo_lordo DECIMAL(10, 2) NOT NULL,
  importo_netto DECIMAL(10, 2) NOT NULL,
  stato_pagamento TEXT DEFAULT 'in_attesa' CHECK (stato_pagamento IN ('in_attesa', 'pagato_da_azienda', 'ricevuto_da_tecnico', 'confermato')),
  note TEXT,
  stato TEXT DEFAULT 'bozza' CHECK (stato IN ('bozza', 'inviato', 'approvato', 'rifiutato')),
  posizione_gps JSONB,
  pasto_aziendale BOOLEAN DEFAULT false,
  buono_pasto BOOLEAN DEFAULT false,
  data_creazione TIMESTAMPTZ DEFAULT now(),
  data_aggiornamento TIMESTAMPTZ DEFAULT now()
);

-- Tabella Spese
CREATE TABLE IF NOT EXISTS spese (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_tecnico UUID NOT NULL REFERENCES tecnici(id) ON DELETE CASCADE,
  id_evento UUID NOT NULL REFERENCES eventi(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('vitto', 'alloggio', 'trasporto', 'materiali', 'comunicazioni', 'altro')),
  importo DECIMAL(10, 2) NOT NULL,
  descrizione TEXT NOT NULL,
  url_ricevuta TEXT,
  data_spesa DATE NOT NULL,
  data_invio TIMESTAMPTZ DEFAULT now(),
  stato TEXT DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'approvato', 'rifiutato')),
  approvato_da UUID REFERENCES utenti(id),
  data_approvazione TIMESTAMPTZ,
  motivo_rifiuto TEXT,
  note TEXT,
  luogo TEXT,
  entro_limite_tempo BOOLEAN DEFAULT true,
  entro_limite_budget BOOLEAN DEFAULT true
);

-- Tabella Documenti
CREATE TABLE IF NOT EXISTS documenti (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titolo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('busta_paga', 'contratto', 'modifica_contrattuale', 'certificato', 'regolamento', 'altro')),
  descrizione TEXT,
  nome_file TEXT NOT NULL,
  dimensione_file INTEGER NOT NULL,
  url_file TEXT NOT NULL,
  caricato_da UUID NOT NULL REFERENCES utenti(id),
  caricato_per UUID NOT NULL REFERENCES utenti(id),
  data_caricamento TIMESTAMPTZ DEFAULT now(),
  letto BOOLEAN DEFAULT false,
  importante BOOLEAN DEFAULT false,
  data_scadenza DATE,
  periodo_riferimento TEXT,
  tipo_contratto TEXT CHECK (tipo_contratto IN ('indeterminato', 'determinato', 'freelance')),
  data_inizio_contratto DATE,
  data_fine_contratto DATE,
  note TEXT
);

-- Tabella Richieste Straordinari
CREATE TABLE IF NOT EXISTS richieste_straordinari (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_tecnico UUID NOT NULL REFERENCES tecnici(id) ON DELETE CASCADE,
  id_magazzino UUID REFERENCES eventi(id),
  id_evento UUID REFERENCES eventi(id),
  data DATE NOT NULL,
  ora_inizio TIME NOT NULL,
  ora_fine TIME NOT NULL,
  ore DECIMAL(4, 2) NOT NULL,
  tariffa_base DECIMAL(10, 2) NOT NULL,
  tariffa_straordinario DECIMAL(10, 2) NOT NULL,
  importo_totale DECIMAL(10, 2) NOT NULL,
  stato TEXT DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'approvato', 'rifiutato')),
  note TEXT,
  approvato_da UUID REFERENCES utenti(id),
  data_approvazione TIMESTAMPTZ,
  motivo_rifiuto TEXT,
  data_invio TIMESTAMPTZ DEFAULT now(),
  stato_pagamento TEXT DEFAULT 'in_attesa' CHECK (stato_pagamento IN ('in_attesa', 'pagato', 'confermato'))
);

-- Aggiunta constraint per richieste_straordinari
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'richieste_straordinari_check_ids'
  ) THEN
    ALTER TABLE richieste_straordinari
    ADD CONSTRAINT richieste_straordinari_check_ids
    CHECK (
      (id_magazzino IS NOT NULL) OR (id_evento IS NOT NULL)
    );
  END IF;
END $$;

-- Tabella Check-in Magazzino
CREATE TABLE IF NOT EXISTS checkin_magazzino (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_magazzino UUID NOT NULL REFERENCES eventi(id) ON DELETE CASCADE,
  id_tecnico UUID NOT NULL REFERENCES tecnici(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  ora_checkin TIME NOT NULL,
  ora_checkout TIME,
  stato TEXT DEFAULT 'attivo' CHECK (stato IN ('attivo', 'completato', 'in_attesa')),
  posizione JSONB,
  note TEXT,
  data_creazione TIMESTAMPTZ DEFAULT now()
);

-- Tabella Corsi Formazione
CREATE TABLE IF NOT EXISTS corsi_formazione (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titolo TEXT NOT NULL,
  descrizione TEXT,
  id_azienda UUID NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  ora_inizio TIME NOT NULL,
  ora_fine TIME NOT NULL,
  luogo TEXT NOT NULL,
  istruttore TEXT,
  obbligatorio BOOLEAN DEFAULT false,
  categoria TEXT NOT NULL CHECK (categoria IN ('sicurezza', 'tecnico', 'soft_skills', 'certificazione', 'altro')),
  materiali TEXT[],
  data_creazione TIMESTAMPTZ DEFAULT now()
);

-- Tabella Iscrizioni Corsi
CREATE TABLE IF NOT EXISTS iscrizioni_corsi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_corso UUID NOT NULL REFERENCES corsi_formazione(id) ON DELETE CASCADE,
  id_tecnico UUID NOT NULL REFERENCES tecnici(id) ON DELETE CASCADE,
  stato TEXT DEFAULT 'invitato' CHECK (stato IN ('invitato', 'registrato', 'confermato', 'partecipato', 'non_presentato', 'annullato')),
  certificato_emesso BOOLEAN DEFAULT false,
  url_certificato TEXT,
  data_invito TIMESTAMPTZ DEFAULT now(),
  data_registrazione TIMESTAMPTZ,
  UNIQUE(id_corso, id_tecnico)
);

-- Tabella Impostazioni Privacy
CREATE TABLE IF NOT EXISTS impostazioni_privacy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_tecnico UUID NOT NULL REFERENCES tecnici(id) ON DELETE CASCADE,
  profilo_pubblico BOOLEAN DEFAULT true,
  aziende_nascoste UUID[] DEFAULT '{}',
  campi_nascosti JSONB DEFAULT '{}'::jsonb,
  data_creazione TIMESTAMPTZ DEFAULT now(),
  data_aggiornamento TIMESTAMPTZ DEFAULT now()
);

-- Tabella Sincronizzazioni Calendario
CREATE TABLE IF NOT EXISTS sincronizzazioni_calendario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_utente UUID NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
  tipo_utente TEXT NOT NULL CHECK (tipo_utente IN ('azienda', 'tecnico')),
  date_occupate JSONB DEFAULT '[]'::jsonb,
  condiviso_con UUID[] DEFAULT '{}',
  data_creazione TIMESTAMPTZ DEFAULT now(),
  data_aggiornamento TIMESTAMPTZ DEFAULT now()
);

-- Tabella Notifiche
CREATE TABLE IF NOT EXISTS notifiche (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_utente UUID NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('scadenza_agibilita', 'negoziazione_tariffa', 'aggiornamento_pagamento', 'assegnazione_evento', 'caricamento_documento', 'stato_spesa', 'stato_straordinario', 'invito_corso')),
  titolo TEXT NOT NULL,
  messaggio TEXT NOT NULL,
  letta BOOLEAN DEFAULT false,
  url_azione TEXT,
  data_creazione TIMESTAMPTZ DEFAULT now()
);

-- Tabella Limiti Spese
CREATE TABLE IF NOT EXISTS limiti_spese (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_azienda UUID NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('vitto', 'alloggio', 'trasporto', 'materiali', 'comunicazioni', 'altro')),
  limite_giornaliero DECIMAL(10, 2) NOT NULL,
  limite_evento DECIMAL(10, 2) NOT NULL,
  richiede_approvazione BOOLEAN DEFAULT false,
  note TEXT,
  data_creazione TIMESTAMPTZ DEFAULT now(),
  data_aggiornamento TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_azienda, categoria)
);

-- Tabella Impostazioni Straordinari
CREATE TABLE IF NOT EXISTS impostazioni_straordinari (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_azienda UUID NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
  abilitato BOOLEAN DEFAULT true,
  richiede_preapprovazione BOOLEAN DEFAULT true,
  moltiplicatore_orario DECIMAL(3, 2) DEFAULT 1.3,
  importo_orario DECIMAL(10, 2) DEFAULT 30,
  usa_moltiplicatore BOOLEAN DEFAULT true,
  moltiplicatore_giornaliero DECIMAL(3, 2) DEFAULT 1.2,
  importo_giornaliero DECIMAL(10, 2) DEFAULT 240,
  usa_moltiplicatore_giornaliero BOOLEAN DEFAULT true,
  ore_max_giorno INTEGER DEFAULT 4,
  ore_max_settimana INTEGER DEFAULT 12,
  notifica_manager_su_richiesta BOOLEAN DEFAULT true,
  notifica_tecnico_su_approvazione BOOLEAN DEFAULT true,
  notifica_tecnico_su_rifiuto BOOLEAN DEFAULT true,
  abilita_approvazione_automatica BOOLEAN DEFAULT false,
  ore_max_approvazione_automatica INTEGER DEFAULT 2,
  id_tecnici_fidati UUID[] DEFAULT '{}',
  data_creazione TIMESTAMPTZ DEFAULT now(),
  data_aggiornamento TIMESTAMPTZ DEFAULT now()
);

-- Tabella Magazzini
CREATE TABLE IF NOT EXISTS magazzini (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_azienda UUID NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  indirizzo TEXT NOT NULL,
  descrizione TEXT,
  valore_qrcode TEXT NOT NULL,
  data_creazione TIMESTAMPTZ DEFAULT now()
);

-- Tabella Festività Personalizzate
CREATE TABLE IF NOT EXISTS festivita_personalizzate (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_azienda UUID NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  data DATE NOT NULL,
  data_creazione TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_azienda, data)
);

-- Tabella Template Documenti
CREATE TABLE IF NOT EXISTS template_documenti (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_azienda UUID NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('busta_paga', 'contratto', 'modifica_contrattuale', 'certificato', 'regolamento', 'altro')),
  descrizione TEXT,
  ricorrente BOOLEAN DEFAULT false,
  periodo_ricorrenza TEXT CHECK (periodo_ricorrenza IN ('mensile', 'annuale')),
  attivo BOOLEAN DEFAULT true,
  data_creazione TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE utenti ENABLE ROW LEVEL SECURITY;
ALTER TABLE aziende ENABLE ROW LEVEL SECURITY;
ALTER TABLE tecnici ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventi ENABLE ROW LEVEL SECURITY;
ALTER TABLE assegnazioni_tecnici ENABLE ROW LEVEL SECURITY;
ALTER TABLE negoziazioni_tariffe ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposte_tariffe ENABLE ROW LEVEL SECURITY;
ALTER TABLE presenze ENABLE ROW LEVEL SECURITY;
ALTER TABLE spese ENABLE ROW LEVEL SECURITY;
ALTER TABLE documenti ENABLE ROW LEVEL SECURITY;
ALTER TABLE richieste_straordinari ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_magazzino ENABLE ROW LEVEL SECURITY;
ALTER TABLE corsi_formazione ENABLE ROW LEVEL SECURITY;
ALTER TABLE iscrizioni_corsi ENABLE ROW LEVEL SECURITY;
ALTER TABLE impostazioni_privacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE sincronizzazioni_calendario ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifiche ENABLE ROW LEVEL SECURITY;
ALTER TABLE limiti_spese ENABLE ROW LEVEL SECURITY;
ALTER TABLE impostazioni_straordinari ENABLE ROW LEVEL SECURITY;
ALTER TABLE magazzini ENABLE ROW LEVEL SECURITY;
ALTER TABLE festivita_personalizzate ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_documenti ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
-- Utenti possono leggere i propri dati
CREATE POLICY "Utenti possono leggere i propri dati" ON utenti
  FOR SELECT
  USING (auth.uid() = id);

-- Aziende possono leggere i propri dati
CREATE POLICY "Aziende possono leggere i propri dati" ON aziende
  FOR SELECT
  USING (auth.uid() = id);

-- Aziende possono leggere i tecnici che sono loro dipendenti o freelance visibili
CREATE POLICY "Aziende possono leggere tecnici visibili" ON tecnici
  FOR SELECT
  USING (
    auth.uid() = id_azienda OR
    (
      tipo_profilo = 'freelance' AND
      id NOT IN (
        SELECT id_tecnico FROM impostazioni_privacy
        WHERE profilo_pubblico = false OR
        auth.uid() = ANY(aziende_nascoste)
      )
    )
  );

-- Tecnici possono leggere i propri dati
CREATE POLICY "Tecnici possono leggere i propri dati" ON tecnici
  FOR SELECT
  USING (auth.uid() = id);

-- Aziende possono leggere i propri eventi
CREATE POLICY "Aziende possono leggere i propri eventi" ON eventi
  FOR SELECT
  USING (auth.uid() = id_azienda);

-- Tecnici possono leggere gli eventi a cui sono assegnati
CREATE POLICY "Tecnici possono leggere eventi assegnati" ON eventi
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assegnazioni_tecnici
      WHERE id_evento = eventi.id AND id_tecnico = auth.uid()
    )
  );

-- Aziende possono leggere le proprie assegnazioni tecnici
CREATE POLICY "Aziende possono leggere proprie assegnazioni tecnici" ON assegnazioni_tecnici
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM eventi
      WHERE eventi.id = assegnazioni_tecnici.id_evento AND eventi.id_azienda = auth.uid()
    )
  );

-- Tecnici possono leggere le proprie assegnazioni eventi
CREATE POLICY "Tecnici possono leggere proprie assegnazioni eventi" ON assegnazioni_tecnici
  FOR SELECT
  USING (id_tecnico = auth.uid());

-- Aziende possono leggere le negoziazioni tariffe per i loro eventi
CREATE POLICY "Aziende possono leggere proprie negoziazioni tariffe" ON negoziazioni_tariffe
  FOR SELECT
  USING (id_azienda = auth.uid());

-- Tecnici possono leggere le proprie negoziazioni tariffe
CREATE POLICY "Tecnici possono leggere proprie negoziazioni tariffe" ON negoziazioni_tariffe
  FOR SELECT
  USING (id_tecnico = auth.uid());

-- Aziende possono leggere le proposte tariffe per le loro negoziazioni
CREATE POLICY "Aziende possono leggere proprie proposte tariffe" ON proposte_tariffe
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM negoziazioni_tariffe
      WHERE negoziazioni_tariffe.id = proposte_tariffe.id_negoziazione AND negoziazioni_tariffe.id_azienda = auth.uid()
    )
  );

-- Tecnici possono leggere le proposte tariffe per le loro negoziazioni
CREATE POLICY "Tecnici possono leggere proprie proposte tariffe" ON proposte_tariffe
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM negoziazioni_tariffe
      WHERE negoziazioni_tariffe.id = proposte_tariffe.id_negoziazione AND negoziazioni_tariffe.id_tecnico = auth.uid()
    )
  );

-- Aziende possono leggere le presenze per i loro eventi
CREATE POLICY "Aziende possono leggere presenze per i loro eventi" ON presenze
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM eventi
      WHERE eventi.id = presenze.id_evento AND eventi.id_azienda = auth.uid()
    )
  );

-- Tecnici possono leggere le proprie presenze
CREATE POLICY "Tecnici possono leggere proprie presenze" ON presenze
  FOR SELECT
  USING (id_tecnico = auth.uid());

-- Aziende possono leggere le spese per i loro eventi
CREATE POLICY "Aziende possono leggere spese per i loro eventi" ON spese
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM eventi
      WHERE eventi.id = spese.id_evento AND eventi.id_azienda = auth.uid()
    )
  );

-- Tecnici possono leggere le proprie spese
CREATE POLICY "Tecnici possono leggere proprie spese" ON spese
  FOR SELECT
  USING (id_tecnico = auth.uid());

-- Utenti possono leggere i documenti caricati per loro
CREATE POLICY "Utenti possono leggere documenti caricati per loro" ON documenti
  FOR SELECT
  USING (caricato_per = auth.uid() OR caricato_da = auth.uid());

-- Aziende possono leggere le richieste straordinari per i loro eventi
CREATE POLICY "Aziende possono leggere richieste straordinari per i loro eventi" ON richieste_straordinari
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM eventi
      WHERE (eventi.id = richieste_straordinari.id_evento OR eventi.id = richieste_straordinari.id_magazzino) AND eventi.id_azienda = auth.uid()
    )
  );

-- Tecnici possono leggere le proprie richieste straordinari
CREATE POLICY "Tecnici possono leggere proprie richieste straordinari" ON richieste_straordinari
  FOR SELECT
  USING (id_tecnico = auth.uid());

-- Aziende possono leggere i checkin magazzino per i loro magazzini
CREATE POLICY "Aziende possono leggere checkin magazzino per i loro magazzini" ON checkin_magazzino
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM eventi
      WHERE eventi.id = checkin_magazzino.id_magazzino AND eventi.id_azienda = auth.uid()
    )
  );

-- Tecnici possono leggere i propri checkin magazzino
CREATE POLICY "Tecnici possono leggere propri checkin magazzino" ON checkin_magazzino
  FOR SELECT
  USING (id_tecnico = auth.uid());

-- Aziende possono leggere i corsi formazione che hanno creato
CREATE POLICY "Aziende possono leggere propri corsi formazione" ON corsi_formazione
  FOR SELECT
  USING (id_azienda = auth.uid());

-- Tecnici possono leggere i corsi formazione a cui sono iscritti
CREATE POLICY "Tecnici possono leggere corsi formazione iscritti" ON corsi_formazione
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM iscrizioni_corsi
      WHERE iscrizioni_corsi.id_corso = corsi_formazione.id AND iscrizioni_corsi.id_tecnico = auth.uid()
    )
  );

-- Aziende possono leggere le iscrizioni corsi per i loro corsi
CREATE POLICY "Aziende possono leggere iscrizioni corsi per i loro corsi" ON iscrizioni_corsi
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM corsi_formazione
      WHERE corsi_formazione.id = iscrizioni_corsi.id_corso AND corsi_formazione.id_azienda = auth.uid()
    )
  );

-- Tecnici possono leggere le proprie iscrizioni corsi
CREATE POLICY "Tecnici possono leggere proprie iscrizioni corsi" ON iscrizioni_corsi
  FOR SELECT
  USING (id_tecnico = auth.uid());

-- Tecnici possono leggere le proprie impostazioni privacy
CREATE POLICY "Tecnici possono leggere proprie impostazioni privacy" ON impostazioni_privacy
  FOR SELECT
  USING (id_tecnico = auth.uid());

-- Utenti possono leggere le proprie sincronizzazioni calendario
CREATE POLICY "Utenti possono leggere proprie sincronizzazioni calendario" ON sincronizzazioni_calendario
  FOR SELECT
  USING (id_utente = auth.uid());

-- Aziende possono leggere le sincronizzazioni calendario condivise con loro
CREATE POLICY "Aziende possono leggere sincronizzazioni calendario condivise" ON sincronizzazioni_calendario
  FOR SELECT
  USING (auth.uid() = ANY(condiviso_con));

-- Utenti possono leggere le proprie notifiche
CREATE POLICY "Utenti possono leggere proprie notifiche" ON notifiche
  FOR SELECT
  USING (id_utente = auth.uid());

-- Aziende possono leggere i propri limiti spese
CREATE POLICY "Aziende possono leggere propri limiti spese" ON limiti_spese
  FOR SELECT
  USING (id_azienda = auth.uid());

-- Aziende possono leggere le proprie impostazioni straordinari
CREATE POLICY "Aziende possono leggere proprie impostazioni straordinari" ON impostazioni_straordinari
  FOR SELECT
  USING (id_azienda = auth.uid());

-- Aziende possono leggere i propri magazzini
CREATE POLICY "Aziende possono leggere propri magazzini" ON magazzini
  FOR SELECT
  USING (id_azienda = auth.uid());

-- Aziende possono leggere le proprie festività personalizzate
CREATE POLICY "Aziende possono leggere proprie festività personalizzate" ON festivita_personalizzate
  FOR SELECT
  USING (id_azienda = auth.uid());

-- Aziende possono leggere i propri template documenti
CREATE POLICY "Aziende possono leggere propri template documenti" ON template_documenti
  FOR SELECT
  USING (id_azienda = auth.uid());

-- Amministratore può leggere tutti i dati
CREATE POLICY "Amministratore può leggere tutti i dati" ON utenti FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON aziende FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON tecnici FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON eventi FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON assegnazioni_tecnici FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON negoziazioni_tariffe FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON proposte_tariffe FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON presenze FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON spese FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON documenti FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON richieste_straordinari FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON checkin_magazzino FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON corsi_formazione FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON iscrizioni_corsi FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON impostazioni_privacy FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON sincronizzazioni_calendario FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON notifiche FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON limiti_spese FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON impostazioni_straordinari FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON magazzini FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON festivita_personalizzate FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');
CREATE POLICY "Amministratore può leggere tutti i dati" ON template_documenti FOR SELECT USING (auth.jwt() ->> 'ruolo' = 'amministratore');