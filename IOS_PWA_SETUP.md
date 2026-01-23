# 📱 Guida Installazione PWA su iOS

## ✅ Configurazione Completata

La PWA è ora completamente configurata per iOS con:

### 🎨 Icone e Grafica
- ✅ Apple Touch Icons (180x180, 192x192, 512x512)
- ✅ Splash Screen ottimizzato
- ✅ Status Bar configurazione (black-translucent)
- ✅ Icone PNG ottimizzate per iOS

### ⚙️ Configurazione Tecnica
- ✅ Manifest.json con icone PNG (iOS preferisce PNG a SVG)
- ✅ Meta tag iOS completi nell'index.html
- ✅ Capacitor configurato per iOS
- ✅ Service Worker con cache strategies
- ✅ Viewport ottimizzato per iPhone (viewport-fit=cover)

### 📋 Meta Tags iOS Implementati
```html
<!-- Abilita modalità standalone -->
<meta name="apple-mobile-web-app-capable" content="yes" />

<!-- Status bar nero traslucido -->
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

<!-- Nome app su home screen -->
<meta name="apple-mobile-web-app-title" content="CrewApp" />

<!-- Disabilita rilevamento automatico numeri telefono -->
<meta name="format-detection" content="telephone=no" />

<!-- Icone per home screen -->
<link rel="apple-touch-icon" sizes="192x192" href="/pwa-192x192.png" />
<link rel="apple-touch-icon" sizes="512x512" href="/pwa-512x512.png" />

<!-- Splash screen -->
<link rel="apple-touch-startup-image" href="/pwa-512x512.png" />
```

## 📲 Istruzioni per l'Utente iOS

### Come Installare l'App su iPhone/iPad

1. **Apri Safari** (deve essere Safari, non Chrome/Firefox)
   - Vai su: `https://tuodominio.com`

2. **Tocca il pulsante Condividi** (⎙)
   - Si trova in basso al centro (iPhone) o in alto a destra (iPad)

3. **Scorri e seleziona "Aggiungi a Home"**
   - Icona: un quadrato con un +

4. **Personalizza il nome** (opzionale)
   - Di default: "CrewApp"
   - Tocca "Aggiungi" in alto a destra

5. **L'app è installata! 🎉**
   - Trovala nella Home Screen
   - Si apre come un'app nativa
   - Nessun browser visibile

## 🎯 Funzionalità PWA iOS

### ✅ Cosa Funziona
- 📍 **GPS sempre attivo** durante il turno
- 🔔 **Notifiche push** (tramite Capacitor)
- 📱 **Modalità offline** con cache
- 🔄 **Sincronizzazione automatica** dati
- 📸 **Fotocamera** per QR code
- 🗺️ **Geolocalizzazione** con alta precisione
- 💾 **Storage locale** persistente

### ⚠️ Limitazioni iOS Safari
- Notifiche push limitate (iOS 16.4+ supporta PWA notifications)
- Service Worker funziona ma con limitazioni
- Background sync limitato

## 🔧 Configurazione Avanzata

### Capacitor iOS Config
```typescript
ios: {
  contentInset: 'automatic',
  backgroundColor: '#1a1a1a',
  scrollEnabled: true,
  allowsLinkPreview: false,
  preferredContentMode: 'mobile',
  allowsBackForwardNavigationGestures: true
}
```

### Manifest.json Ottimizzato
```json
{
  "display": "standalone",
  "display_override": ["standalone", "fullscreen"],
  "orientation": "portrait",
  "background_color": "#1f2937",
  "theme_color": "#3b82f6"
}
```

## 🚀 Deploy e Test

### Build per iOS
```bash
# Build PWA
npm run build

# Sync con Capacitor
npx cap sync ios

# Apri Xcode
npx cap open ios
```

### Test PWA su Safari iOS
1. Apri Safari Developer Tools
2. Inspect su dispositivo iOS reale
3. Verifica Console per errori SW
4. Testa installazione e funzionalità offline

## 📊 Checklist Verifica iOS PWA

- [x] ✅ Icone Apple Touch configurate
- [x] ✅ Status bar style impostato
- [x] ✅ Viewport ottimizzato per notch
- [x] ✅ Manifest.json con icone PNG
- [x] ✅ Service Worker registrato
- [x] ✅ Meta tag iOS completi
- [x] ✅ Capacitor config iOS ottimizzata
- [x] ✅ Splash screen configurato
- [x] ✅ GPS polling implementato
- [x] ✅ Modalità offline funzionante

## 🐛 Troubleshooting iOS

### L'app non si installa
- ✅ Verifica di usare **Safari** (non Chrome)
- ✅ Controlla che il sito sia **HTTPS**
- ✅ Verifica che manifest.json sia accessibile
- ✅ Pulisci cache Safari

### GPS non funziona
- ✅ Vai in Impostazioni > Privacy > Localizzazione
- ✅ Trova "Safari" o "CrewApp"
- ✅ Imposta su "Sempre" o "Mentre usi l'app"

### Notifiche non arrivano
- ✅ iOS 16.4+ richiesto per PWA notifications
- ✅ Verifica permessi in Impostazioni > Notifiche
- ✅ Considera uso di Capacitor native notifications

### Service Worker non si aggiorna
```javascript
// Forza aggiornamento SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.update());
  });
}
```

## 📚 Risorse Utili

- [Apple PWA Documentation](https://developer.apple.com/documentation/webkit/progressive_web_apps)
- [iOS Safari Web App Meta Tags](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [PWA iOS Support](https://caniuse.com/web-app-manifest)

## 🎉 Risultato Finale

L'app CrewMobile è ora una **Progressive Web App** completa e ottimizzata per iOS, con:
- 📱 Installazione nativa su Home Screen
- 🎨 Icone e splash screen personalizzati
- 📍 GPS automatico durante i turni
- 💾 Funzionamento offline
- 🔔 Notifiche push (iOS 16.4+)
- ⚡ Performance native-like
