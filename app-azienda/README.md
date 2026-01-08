# Crew Manager - Pannello Azienda

Applicazione web separata per la gestione aziendale del personale.

## Caratteristiche

- Dashboard con statistiche in tempo reale
- Gestione dipendenti
- Approvazione richieste (ferie, permessi, note spese, straordinari)
- Gestione turni e assegnazioni
- Report presenze e timesheet
- Gestione magazzini e sedi
- Impostazioni azienda

## Struttura

```
app-azienda/
├── index.html              # Entry point HTML
├── src/
│   ├── main.tsx           # Entry point React
│   ├── App.tsx            # Componente principale
│   ├── index.css          # Stili globali
│   ├── components/        # Componenti UI
│   │   ├── Auth/         # Login azienda
│   │   ├── Dashboard/    # Dashboard principale
│   │   ├── Employees/    # Gestione dipendenti
│   │   ├── Requests/     # Approvazione richieste
│   │   ├── Shifts/       # Gestione turni
│   │   ├── Reports/      # Report e analytics
│   │   ├── Warehouses/   # Gestione magazzini
│   │   ├── Settings/     # Impostazioni
│   │   ├── Layout/       # Header e Sidebar
│   │   └── UI/           # Componenti UI riutilizzabili
│   ├── context/          # Context React
│   ├── hooks/            # Custom hooks
│   ├── utils/            # Utilità
│   └── types/            # TypeScript types
└── README.md
```

## Utilizzo del Database

L'app utilizza lo stesso database Supabase dell'app dipendenti. Le tabelle principali sono:

- `aziende` - Profili aziendali
- `crew_members` - Dipendenti
- `crew_assegnazione_turni` - Turni assegnati
- `richieste_ferie_permessi` - Richieste ferie/permessi
- `crew_spese` - Note spese
- `crew_straordinari` - Straordinari
- `timesheet_entries` - Presenze
- `magazzini` - Magazzini/Sedi

## Accesso

Solo utenti con ruolo `company` nella tabella `aziende` possono accedere.

## Sviluppo

Per avviare l'app in modalità sviluppo, sarà necessario configurare Vite per gestire l'entry point separato.

## Note

Questa app è completamente separata dall'app dipendenti e non interferisce con essa.
