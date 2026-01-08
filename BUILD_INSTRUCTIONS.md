# Istruzioni per Generare l'APK di Crew Manager

## Requisiti

1. **Java Development Kit (JDK) 17**
   - Download: https://adoptium.net/
   - Verifica installazione: `java -version`

2. **Android Studio**
   - Download: https://developer.android.com/studio
   - Durante l'installazione, assicurati di installare:
     - Android SDK
     - Android SDK Platform
     - Android Virtual Device (opzionale, per test)

3. **Node.js e npm** (già installati se hai fatto il setup)

## Passaggi per Generare l'APK

### 1. Build del Progetto Web

```bash
npm run build
```

Questo comando compila il progetto React in file statici nella cartella `dist/`.

### 2. Sincronizza con Android

```bash
npx cap sync android
```

Questo comando copia i file web nella cartella Android e aggiorna i plugin nativi.

### 3. Apri il Progetto in Android Studio

```bash
npx cap open android
```

Questo comando apre automaticamente Android Studio con il progetto Android.

### 4. Genera l'APK

In Android Studio:

1. Vai su: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Attendi il completamento della build
3. Clicca su "locate" nel messaggio di conferma per trovare l'APK

L'APK si troverà in:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 5. Distribuisci l'APK

- Copia il file `app-debug.apk` sul tuo server
- I dipendenti possono scaricarlo e installarlo
- **Importante**: I dipendenti devono abilitare "Installa app da origini sconosciute" nelle impostazioni Android

## Build Release (APK Firmato per Produzione)

Per creare un APK firmato pronto per la produzione:

### 1. Genera una Keystore

```bash
keytool -genkey -v -keystore crew-manager.keystore -alias crew-manager -keyalg RSA -keysize 2048 -validity 10000
```

Segui le istruzioni e **salva la password in un posto sicuro**.

### 2. Configura il Signing in Android Studio

1. Apri Android Studio
2. Vai su: **Build** → **Generate Signed Bundle / APK**
3. Seleziona **APK**
4. Seleziona la keystore creata
5. Inserisci le password
6. Scegli **release** come build variant
7. Clicca su **Finish**

L'APK firmato si troverà in:
```
android/app/release/app-release.apk
```

### 3. Ottimizza l'APK (Opzionale)

Per ridurre le dimensioni dell'APK, modifica `android/app/build.gradle`:

```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

## Aggiornamenti Futuri

Quando modifichi l'app:

1. Aggiorna il `versionCode` e `versionName` in `android/app/build.gradle`
2. Esegui `npm run build`
3. Esegui `npx cap sync android`
4. Rigenera l'APK
5. Distribuisci il nuovo APK

## Permessi Android

L'app richiede i seguenti permessi (già configurati):

- **GPS** (ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION)
- **Fotocamera** (CAMERA)
- **Storage** (READ/WRITE_EXTERNAL_STORAGE)
- **Notifiche** (POST_NOTIFICATIONS)
- **Internet** (INTERNET)
- **Vibrazione** (VIBRATE)

## Risoluzione Problemi

### L'APK non si installa
- Verifica che "Installa da origini sconosciute" sia abilitato
- Controlla la versione Android del dispositivo (minimo Android 5.0)

### GPS non funziona
- Assicurati che i permessi GPS siano stati concessi
- Controlla che il GPS sia attivo sul dispositivo

### L'app si chiude subito
- Controlla i log in Android Studio: **Logcat**
- Verifica che tutte le variabili d'ambiente in `.env` siano corrette

## Test su Dispositivo Reale

Per testare su un dispositivo Android reale:

1. Attiva "Opzioni sviluppatore" sul telefono
2. Attiva "Debug USB"
3. Collega il telefono al computer
4. In Android Studio, seleziona il dispositivo
5. Clicca su "Run" (icona play verde)

## Contatti e Supporto

Per problemi o domande, contatta l'amministratore di sistema.
