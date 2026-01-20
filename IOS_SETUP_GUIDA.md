# 🍎 Guida Setup iOS - Crew Manager

## ✅ Installazione Completata

La piattaforma iOS è stata aggiunta con successo al progetto Crew Manager!

## 📁 Struttura Creata

```
/ios
  /App
    /App
      - Info.plist (configurazione app e permessi)
      - capacitor.config.json
      /public (asset web)
    App.xcodeproj (progetto Xcode)
    App.xcworkspace (workspace Xcode con CocoaPods)
    Podfile (dipendenze iOS)
```

## 🔧 Setup Iniziale sul Mac

### 1. Prerequisiti

✅ **Xcode** (gratuito dall'App Store)
- Versione minima: Xcode 14.0+
- Include simulatore iOS
- Include strumenti di sviluppo

✅ **CocoaPods** (gestore dipendenze iOS)
```bash
sudo gem install cocoapods
```

✅ **Apple Developer Account**
- Gratuito per testare su simulatore
- $99/anno per testare su dispositivo reale e pubblicare su App Store

### 2. Installazione Dipendenze iOS

Sul tuo Mac, nella cartella del progetto:

```bash
# Entra nella cartella iOS
cd ios/App

# Installa le dipendenze iOS (Pods)
pod install

# Torna alla root del progetto
cd ../..
```

## 🚀 Build e Test

### Metodo 1: Via NPM Scripts (Consigliato)

```bash
# Build + sincronizza con iOS
npm run ios:sync

# Apri Xcode
npm run ios:open

# Build + sync + esegui su simulatore
npm run ios:run
```

### Metodo 2: Manuale

```bash
# 1. Build del progetto web
npm run build

# 2. Sincronizza con iOS
npx cap sync ios

# 3. Apri Xcode
npx cap open ios
```

### In Xcode:

1. **Seleziona Target**:
   - In alto a sinistra: `App` > Seleziona simulatore (es. "iPhone 15 Pro")

2. **Configura Team di Sviluppo**:
   - Seleziona progetto "App" nel navigatore
   - Tab "Signing & Capabilities"
   - Team: Seleziona il tuo Apple ID
   - Bundle Identifier: `com.crewmanager.app`

3. **Run**:
   - Clicca ▶️ (Play) o `Cmd + R`
   - L'app si aprirà nel simulatore

## 📋 Permessi iOS Configurati

I permessi sono già configurati in `ios/App/App/Info.plist`:

### GPS / Location
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Crew Manager richiede la tua posizione per verificare il check-in al magazzino e garantire la sicurezza sul lavoro.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Crew Manager utilizza la tua posizione per il tracciamento delle presenze in magazzino.</string>
```

### Fotocamera
```xml
<key>NSCameraUsageDescription</key>
<string>Crew Manager richiede l'accesso alla fotocamera per scansionare i codici QR dei magazzini durante il check-in.</string>
```

### Notifiche Push
- Configurate automaticamente da Capacitor
- Richiedono configurazione Apple Push Notification Service (APNS)

## 🔒 Code Signing (Firma del Codice)

### Per Simulatore (Sviluppo)
- ✅ Nessuna configurazione speciale necessaria
- Usa Apple ID gratuito in Xcode

### Per Dispositivo Reale (Testing)
1. **Collega iPhone al Mac via USB**
2. **Abilita Developer Mode** su iPhone:
   - Impostazioni > Privacy e Sicurezza > Developer Mode > ON
3. **Trust del Mac** su iPhone (popup automatico)
4. In Xcode:
   - Seleziona il tuo iPhone invece del simulatore
   - Clicca ▶️ Run

### Per App Store (Produzione)
1. **Apple Developer Program** ($99/anno)
2. **Certificati di Distribuzione**:
   - Vai su developer.apple.com
   - Certificates, Identifiers & Profiles
   - Crea App ID: `com.crewmanager.app`
   - Crea Distribution Certificate
   - Crea Provisioning Profile
3. **In Xcode**:
   - Product > Archive
   - Distribute App > App Store Connect

## 📱 TestFlight (Beta Testing)

Prima di pubblicare su App Store, testa con utenti reali:

1. **Archive in Xcode**: Product > Archive
2. **Upload to App Store Connect**
3. **Invita Beta Tester**: max 10,000 utenti
4. **Ricevi Feedback**: crash reports, recensioni

## 🎨 Icone e Splash Screen iOS

### Icone App (AppIcon)
File: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

Dimensioni richieste:
- 1024x1024 (App Store)
- 180x180 (iPhone)
- 167x167 (iPad Pro)
- 152x152 (iPad)
- 120x120 (iPhone)
- 87x87 (iPhone notifiche)
- 80x80 (iPad)
- 76x76 (iPad)
- 58x58 (iPhone/iPad)
- 40x40 (iPad)
- 29x29 (iPhone/iPad)
- 20x20 (iPhone/iPad)

### Splash Screen
- Configurato in `capacitor.config.ts`
- Personalizza in Xcode: Assets.xcassets/LaunchImage

## 🔧 Configurazioni Avanzate

### Orientamento Schermo
In `Info.plist`:
```xml
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
  <!-- Rimuovi per bloccare in verticale -->
</array>
```

### Versione e Build Number
In Xcode:
- General > Identity
- Version: 1.8.4 (uguale a package.json)
- Build: Incrementa ad ogni upload (1, 2, 3...)

### Background Modes (se servono)
In Xcode:
- Signing & Capabilities
- + Capability > Background Modes
- Seleziona: Location updates, Push notifications, etc.

## 🐛 Troubleshooting Comuni

### "CocoaPods not installed"
```bash
sudo gem install cocoapods
cd ios/App && pod install
```

### "No provisioning profiles found"
- Xcode > Preferences > Accounts
- Aggiungi Apple ID
- Download Manual Profiles

### "App crashes on device"
- Controlla Console in Xcode (Cmd + Shift + 2)
- Verifica permessi in Info.plist
- Controlla log crash in Xcode > Window > Devices and Simulators

### "Build failed"
```bash
# Pulisci cache
cd ios/App
pod deintegrate
pod install
# In Xcode: Product > Clean Build Folder (Cmd + Shift + K)
```

## 📊 Differenze iOS vs Android

| Feature | iOS | Android |
|---------|-----|---------|
| **GPS** | Richiede descrizione chiara in Info.plist | Permessi in AndroidManifest |
| **Fotocamera** | Permesso richiesto ogni volta | Permesso una volta |
| **Notifiche** | APNS (server Apple) | FCM (Firebase) |
| **Background** | Limitato, serve Background Modes | Più permissivo |
| **Installazione** | Solo App Store o TestFlight | APK diretta + Play Store |
| **Pubblicazione** | Review 1-3 giorni | Review ~2 ore |
| **Costo** | $99/anno Developer Program | $25 una tantum |

## 🚀 Prossimi Passi

1. ✅ **Test su Simulatore**
   ```bash
   npm run ios:open
   # In Xcode: seleziona simulatore e clicca Run
   ```

2. ✅ **Test su iPhone Reale**
   - Collega iPhone al Mac
   - Trust del dispositivo
   - Xcode > Run su device reale

3. ✅ **Configura Icone App**
   - Genera icone alle dimensioni corrette
   - Importa in AppIcon.appiconset

4. ✅ **Configura Push Notifications APNS**
   - Crea certificato APNS su developer.apple.com
   - Configura in Supabase/backend

5. ✅ **TestFlight Beta**
   - Archive in Xcode
   - Upload to App Store Connect
   - Invita tester

6. ✅ **App Store Release**
   - Screenshot (varie dimensioni iPhone)
   - Descrizione app
   - Privacy policy
   - Submit for review

## 📚 Risorse Utili

- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [Apple Developer Portal](https://developer.apple.com)
- [App Store Connect](https://appstoreconnect.apple.com)
- [TestFlight Guide](https://developer.apple.com/testflight/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

---

## ✅ Checklist Finale

Quando sei pronto per la produzione:

- [ ] Test completi su simulatore
- [ ] Test su iPhone reale
- [ ] Icone app configurate
- [ ] Splash screen personalizzato
- [ ] Permessi Info.plist con descrizioni chiare
- [ ] Versione aggiornata in Xcode
- [ ] Push notifications APNS configurate
- [ ] Screenshots per App Store
- [ ] Privacy Policy pubblicata
- [ ] TestFlight con beta tester
- [ ] Review finale su device reali
- [ ] Submit to App Store ✨

**Buona fortuna con la tua app iOS! 🚀**
