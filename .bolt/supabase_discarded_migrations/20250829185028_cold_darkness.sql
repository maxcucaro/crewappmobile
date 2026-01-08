/*
  # Aggiungi versione Crew App Mobile alla tabella software_versions

  1. Nuova Versione Software
    - Inserisce "Crew App Mobile" v1.1.0 nella tabella software_versions
    - Configura come versione attiva
    - Include release notes e features complete

  2. Configurazione
    - software_code: 'crew_mobile'
    - current_version: '1.1.0'
    - is_active: true
    - Features e release notes dalla versione corrente
*/

-- Inserisci la versione corrente di Crew App Mobile
INSERT INTO public.software_versions (
  software_code,
  current_version,
  release_date,
  release_notes,
  features,
  is_active,
  description
) VALUES (
  'crew_mobile',
  '1.1.0',
  '2025-01-30T23:45:00.000Z',
  'Versione 1.1.0 - MAJOR FIX CHECK-IN: Risolto problema caricamento magazzini che impediva il check-in QR. Ora confronta correttamente con backup_code. Sostituiti tutti gli alert browser con toast eleganti interni all''app. Aggiunto debug avanzato per troubleshooting.',
  '[
    "Check-in QR Code e GPS",
    "Timesheet automatico", 
    "Note spese con foto",
    "Modalità offline",
    "Sincronizzazione automatica",
    "Permessi nativi del browser",
    "Installazione PWA ottimizzata",
    "Notifiche push native",
    "Sistema semplificato senza controlli artificiali",
    "PWA completa con service worker",
    "Funzionamento offline garantito",
    "Installazione guidata multi-piattaforma",
    "Fix logica GPS nel scanner QR code",
    "Correzione formattazione orari",
    "Miglioramento nomi aziende",
    "Fix caricamento magazzini per check-in",
    "Sostituiti alert browser con toast eleganti",
    "Correzione confronto backup_code magazzini",
    "Debug avanzato per troubleshooting QR"
  ]'::jsonb,
  true,
  'App Mobile per Dipendenti - Check-in QR Code, GPS, Timesheet e Note Spese'
) ON CONFLICT DO NOTHING;

-- Assicurati che solo questa versione sia attiva per crew_mobile
UPDATE public.software_versions 
SET is_active = false 
WHERE software_code = 'crew_mobile' 
  AND current_version != '1.1.0';