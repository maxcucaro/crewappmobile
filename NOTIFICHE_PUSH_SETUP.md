# 📱 Sistema Notifiche Push - Guida Setup Completa

## 🎯 Panoramica

Il sistema di notifiche push è stato completamente implementato e permette di:

- ✅ Inviare notifiche **10 minuti prima** dell'inizio turno
- ✅ Inviare notifiche **all'inizio** del turno (se non fatto check-in)
- ✅ Inviare notifiche **10 minuti dopo inizio** (se non fatto check-in)
- ✅ Inviare notifiche **10, 20, 30 minuti dopo fine turno** (se non fatto checkout)
- ✅ Funziona anche con **app chiusa** (background)
- ✅ Funziona per **eventi** e **turni magazzino**
- ✅ Blocca notifiche automaticamente dopo check-in/checkout
- ✅ Eventi multi-giorno notificati ogni giorno

---

## 📦 Componenti Implementati

### 1. **Database**
- ✅ `push_subscriptions` → Salva dispositivi e subscription
- ✅ `notification_logs` → Storico notifiche inviate
- ✅ Trigger automatici per bloccare notifiche dopo azioni

### 2. **Edge Functions**
- ✅ `send-push-notification` → Invia notifica a un utente specifico
- ✅ `check-scheduled-notifications` → Controlla ogni minuto turni imminenti

### 3. **Frontend**
- ✅ `usePushNotifications` hook → Gestisce permessi e subscription
- ✅ `NotificationSystem` → Campanella notifiche in-app
- ✅ `NotificationManager` → Pannello gestione notifiche
- ✅ Service Worker → Gestisce notifiche push in background

---

## 🚀 Come Attivare il Sistema

### **STEP 1: Generare Chiavi VAPID**

Le chiavi VAPID sono necessarie per inviare notifiche push web.

```bash
# Installa web-push (se non già installato)
npm install -g web-push

# Genera coppia di chiavi VAPID
web-push generate-vapid-keys
```

**Output:**
```
Public Key: BEl62iUYgUivxIkv69yViEuiBIa6iMjyr3PJQYjdKFOqKxsr8CxaVkMpBGFGlqOlZHgAhyNcHGpWWBJB1bFfLUo
Private Key: VCSzW8VxLDrDXKOh0VL0h4R9jT1gVQPR...
```

### **STEP 2: Configurare Chiavi in Supabase**

1. Vai su **Supabase Dashboard** → Tuo progetto
2. Vai su **Settings** → **Edge Functions** → **Secrets**
3. Aggiungi queste variabili:

```
VAPID_PUBLIC_KEY=<la_tua_public_key>
VAPID_PRIVATE_KEY=<la_tua_private_key>
```

### **STEP 3: Aggiornare VAPID Public Key nel Frontend**

Apri il file: `src/hooks/usePushNotifications.tsx`

Cerca questa riga (circa linea 115):

```typescript
const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa6iMjyr3PJQYjdKFOqKxsr8CxaVkMpBGFGlqOlZHgAhyNcHGpWWBJB1bFfLUo';
```

Sostituisci con la **TUA** public key generata.

### **STEP 4: Attivare Cron Job (Scheduled Function)**

Il sistema controlla ogni minuto chi deve ricevere notifiche.

**Opzione A: Supabase Cron (Consigliato)**

Crea un file `supabase/functions/_scheduled/check-notifications/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Chiama la edge function check-scheduled-notifications
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/check-scheduled-notifications`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json'
    }
  })

  const data = await response.json()

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

Poi configura su **Supabase Dashboard → Database → Cron Jobs**:

```sql
-- Esegui ogni minuto
SELECT cron.schedule(
  'check-push-notifications',
  '* * * * *', -- Ogni minuto
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/check-scheduled-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    )
  );
  $$
);
```

**Opzione B: Servizio Esterno (Alternativa)**

Usa un servizio come **cron-job.org** o **EasyCron** per chiamare ogni minuto:

```
URL: https://YOUR_PROJECT.supabase.co/functions/v1/check-scheduled-notifications
Method: POST
Headers:
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
Frequenza: Ogni 1 minuto
```

---

## 🧪 Come Testare

### **Test 1: Abilitare Notifiche**

1. Apri app come dipendente
2. Vai su **Profilo** → **Notifiche**
3. Clicca **"ABILITA NOTIFICHE"**
4. Accetta permessi browser
5. Clicca **"ATTIVA PUSH"** per creare subscription
6. Verifica che appaia "Sottoscrizione: Attiva"

### **Test 2: Test Notifica Locale**

Nel pannello notifiche, clicca:
- **"Test Base"** → Notifica semplice
- **"Demo"** → Notifica turno demo
- **"Test SW"** → Notifica via Service Worker

Se appare la notifica → **Service Worker funziona** ✅

### **Test 3: Creare Turno Test**

**Come Admin:**

1. Vai su **Gestione Turni**
2. Crea un turno magazzino con:
   - Data: **Oggi**
   - Ora inizio: **Tra 12 minuti** (es. se sono le 10:48, metti 11:00)
   - Ora fine: 1 ora dopo
   - Assegna a un dipendente test

**Come Dipendente:**

1. Aspetta 2 minuti (fino a 10 min prima)
2. Dovresti ricevere notifica: **"⏰ Turno tra 10 minuti"**
3. Aspetta altri 10 minuti (all'inizio turno)
4. Ricevi notifica: **"🚨 Turno Iniziato! Fai check-in"**
5. Fai check-in → Notifiche successive bloccate ✅

### **Test 4: Notifiche Checkout**

1. Attendi la fine turno
2. Aspetta 10 minuti
3. Ricevi notifica: **"📤 Ricorda il Checkout"**
4. Aspetta altri 10 minuti (20 min totali)
5. Ricevi notifica: **"⚠️ Checkout Mancante"**
6. Fai checkout → Notifiche bloccate ✅

---

## 🔧 Risoluzione Problemi

### **Problema: "Notifiche non supportate"**

**Soluzione:**
- Usa Chrome, Firefox o Edge aggiornati
- Safari iOS richiede iOS 16.4+
- Verifica che il sito sia HTTPS (non http)

### **Problema: "Service Worker non attivo"**

**Soluzione:**
```bash
# Ricostruisci PWA
npm run build

# Verifica in DevTools → Application → Service Workers
# Deve essere "activated and running"
```

### **Problema: "Subscription non si salva"**

**Soluzione:**
1. Controlla console browser (F12)
2. Verifica tabella `push_subscriptions`:

```sql
SELECT * FROM push_subscriptions WHERE user_id = 'TUO_USER_ID';
```

3. Se errore RLS, verifica policy:

```sql
-- Deve esistere policy per INSERT
SELECT * FROM pg_policies WHERE tablename = 'push_subscriptions';
```

### **Problema: "Notifiche non arrivano in background"**

**Possibili cause:**
1. **Cron job non attivo** → Verifica configurazione Step 4
2. **VAPID keys sbagliate** → Ricontrolla Step 1-3
3. **Subscription scaduta** → Ri-attiva push nel profilo
4. **Browser chiuso completamente** → Solo Android/installato come PWA funziona con browser chiuso

### **Problema: "Notifiche arrivano ma non si aprono"**

**Soluzione:**
- Verifica Service Worker file `/public/sw.js`
- Click notifica deve aprire app:

```javascript
// Controlla event listener 'notificationclick'
self.addEventListener('notificationclick', (event) => {
  // Codice apertura app
});
```

---

## 📊 Monitoraggio Sistema

### **Query Utili**

**1. Vedere tutte le subscription attive:**
```sql
SELECT
  u.email,
  ps.platform,
  ps.status,
  ps.last_seen,
  ps.created_at
FROM push_subscriptions ps
JOIN auth.users u ON u.id = ps.user_id
WHERE ps.status = 'active'
ORDER BY ps.last_seen DESC;
```

**2. Vedere notifiche inviate oggi:**
```sql
SELECT
  u.email,
  nl.notification_type,
  nl.title,
  nl.sent_at,
  nl.action_taken
FROM notification_logs nl
JOIN auth.users u ON u.id = nl.user_id
WHERE nl.sent_at::date = CURRENT_DATE
ORDER BY nl.sent_at DESC;
```

**3. Dipendenti senza check-in oggi:**
```sql
SELECT
  u.email,
  cat.nome_turno,
  cat.ora_inizio_turno,
  wc.check_in_time
FROM crew_assegnazione_turni cat
JOIN auth.users u ON u.id = cat.dipendente_id
LEFT JOIN warehouse_checkins wc ON wc.turno_id = cat.id
WHERE cat.data_turno = CURRENT_DATE
  AND wc.check_in_time IS NULL
  AND cat.ora_inizio_turno < CURRENT_TIME;
```

**4. Statistiche notifiche per utente:**
```sql
SELECT
  u.email,
  COUNT(*) as totale_notifiche,
  SUM(CASE WHEN nl.action_taken THEN 1 ELSE 0 END) as completate,
  SUM(CASE WHEN nl.status = 'sent' THEN 1 ELSE 0 END) as inviate,
  SUM(CASE WHEN nl.status = 'failed' THEN 1 ELSE 0 END) as fallite
FROM notification_logs nl
JOIN auth.users u ON u.id = nl.user_id
WHERE nl.sent_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY u.email
ORDER BY totale_notifiche DESC;
```

---

## 📱 Note Tecniche

### **Come Funzionano le Notifiche Push**

```
┌─────────────────────────────────────────────────────────┐
│                      FLUSSO NOTIFICHE                    │
└─────────────────────────────────────────────────────────┘

1. CRON JOB (ogni minuto)
   ↓
2. Edge Function: check-scheduled-notifications
   - Controlla turni che iniziano tra 10 min
   - Controlla turni iniziati senza check-in
   - Controlla turni finiti senza checkout
   ↓
3. Edge Function: send-push-notification
   - Recupera subscription dal database
   - Invia notifica push al dispositivo
   ↓
4. SERVICE WORKER (dispositivo)
   - Riceve notifica
   - Mostra notifica anche con app chiusa
   ↓
5. UTENTE CLICCA NOTIFICA
   - Service Worker apre app
   - App naviga a pagina check-in/checkout
   ↓
6. UTENTE FA CHECK-IN/CHECKOUT
   - Trigger database segna notifiche come completate
   - Notifiche successive bloccate
```

### **Limitazioni Conosciute**

- **iOS Safari**: Notifiche push web disponibili solo da iOS 16.4+
- **App Chiusa**: Su desktop, browser deve essere aperto (anche in background)
- **Installazione PWA**: Per notifiche con app chiusa, deve essere installata come PWA
- **Frequenza Cron**: Precisione ±1 minuto (normale per cron jobs)

---

## ✅ Checklist Setup Completo

- [ ] Chiavi VAPID generate
- [ ] Chiavi configurate in Supabase (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
- [ ] Public Key aggiornata in `usePushNotifications.tsx`
- [ ] Cron job configurato (Supabase o esterno)
- [ ] Edge Functions deployate
- [ ] Tabelle database create (push_subscriptions, notification_logs)
- [ ] Trigger database attivi
- [ ] Service Worker funzionante
- [ ] Test notifica locale OK
- [ ] Test notifica programmata OK

---

## 🆘 Supporto

Per problemi o domande:

1. Controlla log Edge Functions su Supabase Dashboard
2. Controlla console browser (F12)
3. Verifica tabella `notification_logs` per errori
4. Testa con un turno tra 12 minuti

**Logs Supabase:**
- Dashboard → Edge Functions → `check-scheduled-notifications` → Logs

**Logs Browser:**
- F12 → Console
- F12 → Application → Service Workers

---

✅ **Sistema Pronto!** Le notifiche push sono completamente operative.
