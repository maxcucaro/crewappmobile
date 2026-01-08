# Guida Utilizzo - App Azienda Crew Manager

## Descrizione

Ho creato un'applicazione web completa e separata per la gestione aziendale del personale. L'app è stata creata in una cartella dedicata `app-azienda` senza modificare alcun file dell'app esistente.

## Struttura Creata

```
app-azienda/
├── index.html                    # Entry point HTML dell'app azienda
├── README.md                     # Documentazione generale
├── GUIDA_UTILIZZO.md            # Questa guida
└── src/
    ├── main.tsx                 # Entry point React
    ├── App.tsx                  # Componente principale con routing
    ├── index.css                # Import degli stili dall'app principale
    ├── vite-env.d.ts           # TypeScript definitions
    │
    ├── utils/
    │   └── supabase.ts         # Client Supabase configurato
    │
    ├── context/
    │   ├── CompanyAuthContext.tsx   # Gestione autenticazione azienda
    │   └── ToastContext.tsx         # Sistema notifiche
    │
    └── components/
        ├── Auth/
        │   └── CompanyLogin.tsx        # Login dedicato per aziende
        │
        ├── Layout/
        │   ├── CompanyHeader.tsx       # Header con nome azienda e logout
        │   └── CompanySidebar.tsx      # Menu navigazione laterale
        │
        ├── Dashboard/
        │   └── CompanyDashboardView.tsx  # Dashboard con statistiche
        │
        ├── Employees/
        │   └── EmployeesView.tsx         # Elenco e ricerca dipendenti
        │
        ├── Requests/
        │   └── RequestsView.tsx          # Approvazione richieste (ferie/spese/straordinari)
        │
        ├── Shifts/
        │   └── ShiftsView.tsx            # Visualizzazione turni assegnati
        │
        ├── Reports/
        │   └── ReportsView.tsx           # Report presenze e timesheet
        │
        ├── Warehouses/
        │   └── WarehousesView.tsx        # Gestione magazzini/sedi
        │
        ├── Settings/
        │   └── SettingsView.tsx          # Impostazioni azienda
        │
        └── UI/
            └── ToastContainer.tsx        # Sistema notifiche toast
```

## Funzionalità Implementate

### 1. Sistema di Autenticazione
- Login dedicato solo per aziende
- Verifica del ruolo 'company' nella tabella `aziende`
- Gestione sessione e logout

### 2. Dashboard
- Statistiche in tempo reale:
  - Totale dipendenti
  - Turni attivi
  - Richieste in attesa
  - Spese mensili
  - Presenti oggi
  - Assenti oggi

### 3. Gestione Dipendenti
- Elenco completo dipendenti
- Ricerca per nome, cognome o email
- Visualizzazione dettagli (email, telefono, ruolo, data assunzione)

### 4. Approvazione Richieste
- **Ferie e Permessi**:
  - Visualizzazione richieste in attesa
  - Approvazione o rifiuto
  - Dettagli: date, ore richieste, motivo

- **Note Spese**:
  - Visualizzazione spese in attesa
  - Approvazione o rifiuto
  - Dettagli: importo, categoria, data, descrizione

- **Straordinari**:
  - Visualizzazione straordinari in attesa
  - Approvazione o rifiuto
  - Dettagli: ore, data, motivo

### 5. Gestione Turni
- Visualizzazione turni programmati
- Filtro per data
- Raggruppamento per giorno
- Dettagli: dipendente, orari, magazzino, note

### 6. Report Presenze
- Report timesheet per periodo
- Statistiche: totale registrazioni, ore totali, straordinari
- Filtro per intervallo date
- Dettagli per dipendente

### 7. Magazzini e Sedi
- Elenco magazzini configurati
- Visualizzazione dettagli: indirizzo, città, telefono

### 8. Impostazioni
- Visualizzazione info aziendali
- Dati azienda: nome, P.IVA, email, telefono, indirizzo

## Database Utilizzato

L'app utilizza lo stesso database Supabase dell'app dipendenti. Le tabelle principali:

- `aziende` - Profili aziendali con ruolo 'company'
- `crew_members` - Elenco dipendenti
- `crew_assegnazione_turni` - Turni assegnati
- `richieste_ferie_permessi` - Richieste ferie/permessi
- `crew_spese` - Note spese
- `crew_straordinari` - Ore straordinarie
- `timesheet_entries` - Presenze registrate
- `magazzini` - Magazzini/Sedi operative
- `warehouse_checkins` - Check-in magazzino

## Come Avviare l'App Azienda

Per configurare Vite e avviare l'app azienda, sarà necessario:

1. **Modificare vite.config.ts** per aggiungere un secondo entry point:
   ```typescript
   build: {
     rollupOptions: {
       input: {
         main: resolve(__dirname, 'index.html'),
         azienda: resolve(__dirname, 'app-azienda/index.html')
       }
     }
   }
   ```

2. **Aggiungere uno script in package.json**:
   ```json
   "dev:azienda": "vite --config vite.config.azienda.ts"
   ```

3. **Oppure** deployare l'app azienda come applicazione separata su un altro dominio/subdomain.

## Requisiti di Accesso

- Solo utenti registrati nella tabella `aziende` con `ruolo = 'company'`
- Account email e password validi
- Accesso al database Supabase

## Sicurezza

- Autenticazione obbligatoria
- Verifica del ruolo azienda ad ogni accesso
- Le aziende vedono solo i propri dipendenti e dati
- RLS (Row Level Security) implementato su tutte le tabelle

## Note Importanti

1. **Separazione Totale**: L'app azienda è completamente separata dall'app dipendenti
2. **Nessuna Modifica**: Nessun file dell'app esistente è stato modificato
3. **Database Condiviso**: Entrambe le app usano lo stesso database Supabase
4. **Stesso Design**: Usa gli stessi stili Tailwind CSS dell'app principale

## Prossimi Passi Suggeriti

1. Configurare Vite per gestire l'entry point separato
2. Testare l'accesso con un account azienda
3. Verificare le funzionalità di approvazione richieste
4. Personalizzare il design se necessario
5. Aggiungere funzionalità aggiuntive (es: creazione turni, invio notifiche)

## Supporto

Per domande o problemi, riferirsi alla documentazione Supabase e React.
