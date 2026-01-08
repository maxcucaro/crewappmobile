# Guida alla Gestione Eventi - App Azienda

## Componente Creato

**File**: `/app-azienda/src/components/Mobile/CompanyEventsManagement.tsx`

Questo componente implementa il flusso completo di gestione eventi come da specifica:

## Funzionalità Implementate

### 1. CREAZIONE EVENTI (Bozze)
- Crea eventi in `crew_events_temp` con stato "draft"
- Configurazione completa per ogni giorno tramite `giorni_config` (JSONB)
- Supporto eventi singoli e multi-giorno
- Configurazione tariffe/benefits per ogni giorno
- Link scheda tecnica e mappa GPS

### 2. CONFERMA EVENTI
- Trasferisce bozze da `crew_events_temp` a `crew_events`
- Divide eventi multi-giorno in record separati
- Collega tutti i giorni con `event_group_code`
- Mantiene configurazione benefits per ogni giorno

### 3. ASSEGNAZIONE CREW
- Seleziona membri da `registration_requests`
- Verifica benefits disponibili dal contratto
- Assegna crew con storicizzazione benefits
- Salva in `crew_event_assegnazione`

### 4. GESTIONE BENEFITS
- Carica tariffe da `crew_assegnazionetariffa`
- Carica meal benefits da `employee_meal_benefits`
- Supporto diaria eventi e trasferta
- Benefits configurabili per ogni giorno

## Integrazione nell'App

**✅ GIÀ INTEGRATO!**

Il componente è già attivo nel menu "Eventi" dell'app azienda:
- File modificato: `/app-azienda/src/App.tsx`
- Menu: Clicca su "Eventi" nella navigation bar in basso
- Funzionalità: Crea, gestisci e assegna eventi alla crew

## Flusso di Utilizzo

### STEP 1: Creare una Bozza
1. Clicca su "Nuovo Evento"
2. Compila i dati base (titolo, date, località)
3. Il sistema genera automaticamente la configurazione giorni
4. Per ogni giorno puoi:
   - Modificare nome e orario convocazione
   - Selezionare tariffe abilitate
   - Aggiungere diaria eventi/trasferta
   - Impostare bonus previsti
5. Clicca "Salva Bozza"

### STEP 2: Confermare l'Evento
1. Nella lista, trova la bozza (contrassegnata GIALLO)
2. Clicca "Conferma"
3. Il sistema:
   - Crea N eventi in `crew_events` (uno per giorno)
   - Collega tutto con `event_group_code`
   - Elimina la bozza da `crew_events_temp`

### STEP 3: Assegnare la Crew
1. Trova l'evento confermato nella lista
2. Se multi-giorno, seleziona il giorno specifico
3. Seleziona i membri della crew
4. Per ogni membro configura:
   - Tariffa oraria
   - Bonus previsti
   - Pausa pranzo
   - Note
5. Clicca "Conferma Assegnazioni"

## Struttura Dati

### crew_events_temp (Bozze)
```json
{
  "id_gruppo_evento": "evt-123",
  "company_id": "uuid",
  "title": "Festival Rock",
  "start_date": "2025-01-15",
  "end_date": "2025-01-17",
  "giorni_config": [
    {
      "giorno": 1,
      "nome": "Setup",
      "data": "2025-01-15",
      "orario_convocazione": "08:00",
      "tariffe_abilitate": ["uuid-1", "diaria_eventi"],
      "bonus_previsti": 0
    }
  ]
}
```

### crew_events (Confermati)
Dopo conferma, crea un record per ogni giorno:
```json
{
  "id": "uuid-aaa",
  "event_group_code": "evt-123",
  "title": "Festival Rock - Setup",
  "start_date": "2025-01-15",
  "end_date": "2025-01-15",
  "day_number": 1,
  "benefits_evento_ids": ["uuid-1"],
  "diaria_abilitata": true,
  "diaria_tipo": "evento"
}
```

### crew_event_assegnazione
```json
{
  "azienda_id": "uuid",
  "dipendente_freelance_id": "uuid",
  "evento_id": "uuid-aaa",
  "tariffa_evento_assegnata": 15.50,
  "bonus_previsti": 25.00,
  "benefits_evento_ids": ["uuid-1"],
  "benefits_storicizzati": [
    {
      "id": "uuid-1",
      "nome": "Straordinario",
      "importo": 18.00,
      "categoria": "straordinari"
    }
  ]
}
```

## Caratteristiche Speciali

### Event Group Code
Tutti i giorni dello stesso evento hanno lo stesso `event_group_code`, permettendo di:
- Visualizzare eventi raggruppati
- Identificare quale giorno appartiene a quale evento
- Gestire modifiche su tutto il gruppo

### Benefits Storicizzati
Quando assegni un dipendente, il sistema fa uno "snapshot" dei benefits:
- Valori attuali delle tariffe
- Importi diaria
- Buoni pasto
- Anche se cambi dopo, l'assegnazione mantiene i valori originali

### Tariffe Speciali
Due tariffe speciali sono gestite separatamente:
- `diaria_eventi`: non è un UUID, ma una stringa speciale
- `diaria_trasferta`: non è un UUID, ma una stringa speciale

Vengono convertite in:
- `diaria_abilitata = true`
- `diaria_tipo = 'evento'` o `'trasferta'`

### Links Propagati
I link alla scheda tecnica e mappa GPS vengono propagati:
1. Dalla bozza (`crew_events_temp`)
2. All'evento confermato (`crew_events`)
3. All'assegnazione crew (`crew_event_assegnazione`)

## Queries di Debug

### Verificare Bozze
```sql
SELECT * FROM crew_events_temp
WHERE company_id = 'your-company-id'
ORDER BY created_at DESC;
```

### Verificare Eventi Multi-Giorno
```sql
SELECT
  event_group_code,
  COUNT(*) as giorni,
  MIN(start_date) as inizio,
  MAX(end_date) as fine
FROM crew_events
WHERE company_id = 'your-company-id'
AND event_group_code IS NOT NULL
GROUP BY event_group_code;
```

### Verificare Assegnazioni
```sql
SELECT
  e.title,
  e.start_date,
  a.nome_dipendente_freelance,
  a.tariffa_evento_assegnata,
  a.bonus_previsti,
  a.benefits_storicizzati
FROM crew_event_assegnazione a
JOIN crew_events e ON e.id = a.evento_id
WHERE a.azienda_id = 'your-company-id'
ORDER BY e.start_date DESC, a.nome_dipendente_freelance;
```

## Tabelle Database Utilizzate

### Principali
- **crew_events_temp**: Bozze eventi (con `giorni_config` JSONB)
- **crew_events**: Eventi confermati (un record per giorno)
- **crew_event_assegnazione**: Assegnazioni crew agli eventi
- **registration_requests**: Elenco dipendenti/freelance

### Tariffe e Benefits
- **crewtariffe**: Tariffe base (oraria/giornaliera) per dipendente
- **employee_meal_benefits**: Diaria eventi, diaria trasferta, buoni pasto
- **crew_tariffa_personalizzata**: Tariffe custom per dipendente

### Struttura Benefits
Il sistema carica:
1. Tariffe da `crewtariffe` (filtrate per azienda)
2. Meal benefits da `employee_meal_benefits` (per dipendente)
3. Al momento dell'assegnazione, fa uno snapshot in `benefits_storicizzati`

## Note Importanti

1. **RLS**: Assicurati che le policy RLS siano configurate correttamente per tutte le tabelle

2. **Benefits**: Il sistema carica automaticamente i benefits dal contratto del dipendente, ma puoi modificarli nell'assegnazione

3. **Multi-Giorno**: Eventi multi-giorno vengono sempre divisi in record separati, ma collegati tramite `event_group_code`

4. **Modifiche**: Puoi modificare le assegnazioni individuali senza toccare l'evento padre

5. **Eliminazione**: Eliminando una bozza NON vengono eliminati gli eventi confermati già creati

6. **Tariffe**: Il componente usa `crewtariffe` per caricare le tariffe disponibili, non `crew_benefitstariffa`

## Come Usare il Sistema

### Accesso
1. Apri l'app azienda
2. Clicca su "Eventi" nella barra di navigazione in basso
3. Vedrai 3 sezioni:
   - **Bozze**: Eventi in preparazione (giallo)
   - **Eventi Confermati**: Eventi pubblicati (verde)
   - **Pulsante "Nuovo"**: Per creare nuovi eventi

### Workflow Completo

**FASE 1: Creazione**
- Clicca "Nuovo Evento"
- Compila titolo, date, località
- Il sistema genera automaticamente i giorni
- Configura orari e tariffe per ogni giorno
- Salva come bozza

**FASE 2: Conferma**
- Trova la bozza nella lista
- Clicca "Conferma"
- L'evento viene pubblicato e diviso in giorni separati

**FASE 3: Assegnazione**
- Trova l'evento confermato
- Seleziona il giorno (se multi-giorno)
- Seleziona i membri della crew
- Configura tariffe e benefit per ogni membro
- Conferma le assegnazioni

**FASE 4: Verifica**
- I dati sono salvati in `crew_event_assegnazione`
- I dipendenti vedranno l'evento nella loro app
- Puoi vedere le assegnazioni nella sezione Report

## Supporto

Se riscontri problemi:
- Verifica la console browser per errori
- Controlla i permessi RLS nel database
- Verifica che le tabelle esistano e siano accessibili
- Controlla che i benefits siano configurati per i dipendenti
