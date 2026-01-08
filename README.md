# Crew App Mobile V1.1.0 - App Mobile Dipendenti

Crew App Mobile è l'applicazione mobile dedicata ai dipendenti per gestire check-in/out, timesheet, note spese e presenze con QR code e GPS.

## 📱 Come Installare l'App sul Telefono

### **Metodo 1: Installazione PWA (Consigliato)**
1. **Apri il link** nel browser del telefono (Chrome, Safari, Firefox)
2. **Cerca il pulsante "Installa App"** nella pagina di benvenuto
3. **Tocca "Installa"** quando appare il popup del browser
4. **L'app verrà aggiunta** alla home screen del telefono
5. **Funziona offline** e riceve notifiche push

### **Metodo 2: Aggiungi a Home Screen**

**Su Android (Chrome):**
1. Apri il link nel browser Chrome
2. Tocca i **3 puntini** in alto a destra
3. Seleziona **"Aggiungi alla schermata Home"**
4. Conferma il nome dell'app
5. L'icona apparirà sulla home screen

**Su iPhone (Safari):**
1. Apri il link in Safari
2. Tocca il pulsante **"Condividi"** (quadrato con freccia)
3. Scorri e tocca **"Aggiungi alla schermata Home"**
4. Conferma il nome dell'app
5. L'icona apparirà sulla home screen

### **Vantaggi App Installata:**
✅ **Icona sulla home screen** come app nativa
✅ **Funziona offline** - salva dati localmente
✅ **Notifiche push** per turni e aggiornamenti
✅ **Accesso rapido** senza aprire browser
✅ **Schermo intero** senza barre del browser
✅ **Sincronizzazione automatica** quando torna online

### **Requisiti Minimi:**
- **Android**: Chrome 67+ o Firefox 68+
- **iOS**: Safari 11.3+ (iOS 11.3+)
- **Connessione internet** per prima installazione
- **Permessi**: Fotocamera (QR code) + GPS (posizione)

## Funzionalità Principali

- **Check-in QR Code**: Scansione QR code per turni magazzino con verifica GPS
- **Check-in GPS**: Tracciamento posizione per eventi e trasferte
- **Timesheet Mobile**: Registrazione ore con timer automatico e straordinari
- **Note Spese**: Invio spese con foto scontrino direttamente dal telefono
- **Gestione Pasti**: Selezione pasto aziendale e buoni pasto
- **Modalità Offline**: Funzionamento anche senza connessione internet
- **Notifiche Push**: Avvisi automatici per turni e aggiornamenti importanti
- **Richiesta Permessi**: Richiesta automatica permessi fotocamera, GPS e notifiche
- **GPS Tracking**: Verifica presenza fisica sul luogo di lavoro

## Tecnologie Utilizzate

- React
- TypeScript
- Tailwind CSS
- Supabase (Database e Autenticazione)
- Vite
- PWA (Progressive Web App)
- HTML5 QR Code Scanner
- Geolocation API
- Camera API
- Service Workers per modalità offline

## Configurazione dell'Ambiente

1. Clona il repository
2. Installa le dipendenze con `npm install`
3. Configura Supabase (vedi sezione sotto)
4. Avvia il server di sviluppo con `npm run dev`

## Configurazione Supabase

### Passo 1: Configura il progetto
1. Assicurati che le variabili d'ambiente siano configurate correttamente
2. Le migrazioni del database sono già state applicate

### Passo 2: Crea utenti demo
Per testare l'applicazione, devi creare manualmente gli utenti nel dashboard Supabase:

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **Authentication** → **Users**
4. Clicca **"Add user"** e crea questi utenti:

**Amministratore:**
- Email: `admin@controlstage.com`
- Password: `admin123456`

**Azienda Demo:**
- Email: `azienda@controlstage.com`
- Password: `azienda123456`

**Crew Demo (App Mobile):**
- Email: `mario.rossi@example.com`
- Password: `password123`
- Email: `giulia.bianchi@example.com`
- Password: `password123`

### Passo 3: Verifica accesso
Dopo aver creato gli utenti, puoi accedere all'applicazione con le credenziali sopra indicate.

## Struttura del Progetto

- `src/components`: Componenti React
  - `Admin`: Componenti per l'amministratore
  - `Auth`: Componenti per l'autenticazione
  - `Company`: Componenti per le aziende
  - `Crew`: Componenti per i crew
  - `Dashboard`: Dashboard per i diversi ruoli
  - `Layout`: Componenti di layout (Header, Sidebar)
- `src/context`: Context API per la gestione dello stato
- `src/lib`: Librerie e utility
- `src/types`: Definizioni TypeScript
- `supabase/migrations`: Migrazioni del database

## Ruoli Utente

- **Dipendenti**: Check-in/out, timesheet, note spese, visualizzazione turni
- **Modalità Offline**: Salvataggio locale dati quando non connesso
- **Sincronizzazione**: Upload automatico dati quando torna la connessione

## Deployment

L'app mobile può essere deployata come PWA su Netlify o Vercel. Supporta installazione su home screen e funzionamento offline.

## Funzionalità Mobile Specifiche

### Check-in Magazzino
1. Dipendente apre app e verifica turno magazzino nel calendario
2. Scansiona QR code dinamico presente in magazzino
3. Sistema verifica posizione GPS per confermare presenza fisica
4. Registra orario inizio turno automaticamente
5. Include 1 ora di pausa se prevista dal contratto
6. Opzione per selezionare pasto aziendale
7. A fine turno registra eventuali ore straordinario

### Check-in Eventi/Trasferte
1. Dipendente apre app e verifica evento nel calendario
2. Attiva GPS per verificare posizione sul luogo evento
3. Avvia giornata lavorativa con tracciamento posizione
4. Registra ore lavorate e straordinari
5. Possibilità di aggiungere note spese durante l'evento

### Note Spese Mobile
1. Scatta foto scontrino direttamente con fotocamera
2. Compila categoria, importo e descrizione
3. GPS automatico per località spesa
4. Invio immediato all'azienda per approvazione

## Licenza

Tutti i diritti riservati © 2025 ControlStage - Software V. 1.0.4