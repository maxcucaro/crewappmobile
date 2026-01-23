import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crewmanager.app',
  appName: 'Crew Manager',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: true
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#1a1a1a',
    // Limita l'app a iPhone (no iPad)
    limitsNavigationsToAppBoundDomains: false,
    // PWA ottimizzata per iOS
    scrollEnabled: true,
    allowsLinkPreview: false,
    // Gestione orientamento
    preferredContentMode: 'mobile',
    // Permessi location sempre attivi
    allowsBackForwardNavigationGestures: true
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#1a1a1a'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
      androidScaleType: 'CENTER_CROP',
      iosContentMode: 'scaleAspectFill',
      showSpinner: true,
      spinnerColor: '#3b82f6'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
