# Setup Auto-Eliminazione Messaggi Company Talks (24 ore)

## Cosa è stato fatto

✅ **Scadenza ridotta a 24 ore**: Tutti i messaggi talk ora scadono automaticamente dopo 24 ore dalla creazione

✅ **Edge Function creata**: La funzione `cleanup-expired-talks` è stata deployata e può essere chiamata per eliminare automaticamente i messaggi scaduti

✅ **Eliminazione file storage**: La funzione elimina anche i file multimediali allegati dallo storage Supabase

## Come funziona

La Edge Function `cleanup-expired-talks` esegue questi passaggi:

1. 🔍 **Trova messaggi scaduti**: Cerca tutti i messaggi con `expires_at` < ora corrente
2. 🗑️ **Elimina file storage**: Rimuove audio, immagini e documenti allegati dal bucket `company-talks`
3. ❌ **Elimina record database**: Chiama la funzione SQL `delete_expired_talks()` per rimuovere i record
4. 📊 **Log risultati**: Restituisce statistiche su quanti messaggi e file sono stati eliminati

## URL della Edge Function

```
https://[TUO-PROJECT-ID].supabase.co/functions/v1/cleanup-expired-talks
```

Sostituisci `[TUO-PROJECT-ID]` con l'ID del tuo progetto Supabase.

## Schedulazione Automatica

Per far eseguire la pulizia automaticamente ogni ora, hai **3 opzioni**:

---

### Opzione 1: cron-job.org (CONSIGLIATO - Gratuito)

1. Vai su https://cron-job.org/en/ e crea un account gratuito
2. Clicca su "Create Cronjob"
3. Configura:
   - **Title**: "Cleanup Expired Talks"
   - **URL**: `https://[TUO-PROJECT-ID].supabase.co/functions/v1/cleanup-expired-talks`
   - **Schedule**: Seleziona "Every hour" (ogni ora) oppure "Every 6 hours" per esecuzioni meno frequenti
   - **Request Method**: GET
   - **Enable Job**: ✅ Attiva

4. Salva e il job partirà automaticamente

**Vantaggi**: Gratuito, affidabile, non richiede configurazioni nel codice

---

### Opzione 2: GitHub Actions (se hai un repository)

Se il progetto è su GitHub, puoi usare GitHub Actions:

1. Crea il file `.github/workflows/cleanup-talks.yml`:

```yaml
name: Cleanup Expired Talks
on:
  schedule:
    - cron: '0 * * * *' # Ogni ora
  workflow_dispatch: # Permette esecuzione manuale

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Call cleanup function
        run: |
          curl -X GET "https://[TUO-PROJECT-ID].supabase.co/functions/v1/cleanup-expired-talks"
```

2. Sostituisci `[TUO-PROJECT-ID]` con il tuo ID Supabase
3. Commit e push del file

**Vantaggi**: Integrato con il repository, esecuzione gratuita

---

### Opzione 3: EasyCron (Alternativa gratuita)

1. Vai su https://www.easycron.com/ e registrati
2. Crea un nuovo cron job:
   - **URL**: `https://[TUO-PROJECT-ID].supabase.co/functions/v1/cleanup-expired-talks`
   - **Cron Expression**: `0 * * * *` (ogni ora)
   - **Method**: GET

3. Attiva il job

---

## Esecuzione Manuale

Puoi testare la funzione manualmente:

### Da Browser o Postman

```
GET https://[TUO-PROJECT-ID].supabase.co/functions/v1/cleanup-expired-talks
```

### Da Terminale (curl)

```bash
curl https://[TUO-PROJECT-ID].supabase.co/functions/v1/cleanup-expired-talks
```

### Risposta Attesa

```json
{
  "success": true,
  "deleted_records": 15,
  "deleted_files": 8,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Monitoraggio

### Visualizzare i log della funzione

1. Vai su Supabase Dashboard
2. Seleziona **Edge Functions** nel menu laterale
3. Clicca su `cleanup-expired-talks`
4. Vai alla tab **Logs**

Qui vedrai tutti i log di esecuzione con dettagli su:
- Numero di messaggi eliminati
- Numero di file eliminati
- Eventuali errori

### Statistiche utilizzo spazio

Puoi verificare quanto spazio occupano i messaggi attualmente nel database:

```sql
SELECT * FROM get_talks_stats();
```

Questo restituisce:
- Numero totale messaggi
- Spazio totale occupato (MB)
- Breakdown per tipo di messaggio (text, audio, image, file)

---

## Frequenza Consigliata

- **Ogni ora**: Ideale per garantire pulizia costante (consigliato)
- **Ogni 6 ore**: Va bene se non invii molti messaggi
- **Mai meno di 24 ore**: Altrimenti i messaggi non verranno mai eliminati

---

## Troubleshooting

### La funzione non elimina nulla

Verifica che ci siano messaggi scaduti:

```sql
SELECT COUNT(*)
FROM company_talks
WHERE expires_at < now();
```

### Errori nei log

Controlla i log della Edge Function nel Supabase Dashboard per vedere eventuali errori di permessi storage o database.

### Test rapido

Per testare immediatamente (senza aspettare 24 ore), puoi temporaneamente creare un messaggio con scadenza breve:

```sql
INSERT INTO company_talks (
  sender_company_id,
  recipient_id,
  message_type,
  message_text,
  expires_at
) VALUES (
  '[ID-TUA-AZIENDA]',
  '[ID-DESTINATARIO]',
  'text',
  'Messaggio di test',
  now() - interval '1 hour' -- Scaduto 1 ora fa
);
```

Poi chiama manualmente la funzione cleanup e verifica che il messaggio venga eliminato.

---

## Sicurezza

- ✅ La funzione è pubblica (verify_jwt = false) ma è sicura perché usa solo operazioni di lettura/eliminazione autorizzate
- ✅ Non accetta parametri pericolosi dall'esterno
- ✅ Usa il Service Role Key per autorizzazione massima sulle eliminazioni
- ✅ Tutti i log sono tracciati nel Supabase Dashboard

---

## Riepilogo

🎯 **Cosa fare adesso**:
1. Scegli uno dei servizi di scheduling (cron-job.org consigliato)
2. Configura l'esecuzione automatica ogni ora
3. Testa manualmente la prima volta per verificare che funzioni
4. Monitora i log per le prime 24 ore

💾 **Risparmio spazio**: Con messaggi che scadono dopo 24 ore invece di 30 giorni, risparmi **circa il 96% dello spazio** su database e storage!
