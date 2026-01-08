import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/db';
import { useAuth } from '../context/AuthContext';

type PushNotificationData = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
};

interface NotificationPermissionState {
  permission: NotificationPermission;
  isSupported: boolean;
  isServiceWorkerReady: boolean;
  subscription: PushSubscription | null;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [notificationState, setNotificationState] = useState<NotificationPermissionState>({
    permission: 'default',
    isSupported: false,
    isServiceWorkerReady: false,
    subscription: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inizializzazione: controllo supporto e subscription esistente
  useEffect(() => {
    const init = async () => {
      const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      const permission = Notification.permission;

      let isServiceWorkerReady = false;
      let subscription: PushSubscription | null = null;

      if (isSupported && 'serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          isServiceWorkerReady = !!reg;
          if (reg && reg.pushManager) {
            subscription = await reg.pushManager.getSubscription();
          }
        } catch (err) {
          console.error('Errore nel controllo service worker:', err);
        }
      }

      setNotificationState({
        permission,
        isSupported,
        isServiceWorkerReady,
        subscription
      });

      console.log('🔔 Stato notifiche iniziale:', {
        isSupported,
        permission,
        isServiceWorkerReady,
        hasSubscription: !!subscription
      });
    };

    init();
  }, []);

  // Richiesta permessi
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!notificationState.isSupported) {
      setError('Notifiche non supportate su questo dispositivo');
      return false;
    }

    if (notificationState.permission === 'granted') return true;

    setIsLoading(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      setNotificationState(prev => ({ ...prev, permission }));
      if (permission === 'granted') {
        const ok = await subscribeToPush();
        return ok;
      } else {
        setError('Permessi notifiche negati');
        return false;
      }
    } catch (err) {
      console.error('Errore richiesta permessi:', err);
      setError('Errore nella richiesta permessi notifiche');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [notificationState.isSupported, notificationState.permission]);

  // Sottoscrizione push lato client
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!notificationState.isServiceWorkerReady) {
      setError('Service Worker non pronto');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Sostituisci con la tua VAPID PUBLIC KEY (base64 urlsafe)
      const vapidPublicKey =
        'BEl62iUYgUivxIkv69yViEuiBIa6iMjyr3PJQYjdKFOqKxsr8CxaVkMpBGFGlqOlZHgAhyNcHGpWWBJB1bFfLUo';

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      setNotificationState(prev => ({ ...prev, subscription }));

      // Salva la subscription su Supabase (se l'utente è loggato)
      try {
        await savePushSubscription(subscription);
      } catch (err) {
        console.warn('Impossibile salvare la subscription sul server:', err);
      }

      console.log('✅ Sottoscrizione push creata:', subscription);
      return true;
    } catch (err) {
      console.error('Errore sottoscrizione push:', err);
      setError('Errore nella sottoscrizione alle notifiche');
      return false;
    }
  }, [notificationState.isServiceWorkerReady, user?.id]);

  // Funzione per salvare/aggiornare la subscription in Supabase
  const savePushSubscription = async (subscription: PushSubscription) => {
    try {
      // Ottieni JSON della subscription
      const subJson: any = subscription && typeof (subscription as any).toJSON === 'function'
        ? (subscription as any).toJSON()
        : subscription;

      const endpoint: string = subJson?.endpoint;
      const keys = subJson?.keys || (subJson && subJson.getKey ? {
        p256dh: subJson.getKey('p256dh') ? btoa(String.fromCharCode(...new Uint8Array(subJson.getKey('p256dh')))) : null,
        auth: subJson.getKey('auth') ? btoa(String.fromCharCode(...new Uint8Array(subJson.getKey('auth')))) : null
      } : null);

      if (!endpoint) {
        console.warn('savePushSubscription: endpoint mancante nella subscription');
        return false;
      }

      const payload = {
        user_id: user?.id || null,
        endpoint,
        keys,
        subscription: subJson,
        platform: navigator.userAgent.includes('Android') ? 'android' : 'web',
        user_agent: navigator.userAgent,
        is_pwa: (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || false,
        status: 'active',
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      // Verifica se esiste già una subscription con stesso endpoint per lo stesso user
      const { data: existing, error: selectError } = await supabase
        .from('push_subscriptions')
        .select('id')
        .match({ endpoint: endpoint, user_id: user?.id })
        .limit(1);

      if (selectError) {
        console.warn('Attenzione: errore durante la ricerca subscription esistente:', selectError);
        // Procediamo comunque con insert per non perdere la subscription
      }

      if (existing && existing.length > 0) {
        // Aggiorna la riga esistente (aggiorna last_seen e subscription)
        const existingId = existing[0].id;
        const { error: updateError } = await supabase
          .from('push_subscriptions')
          .update({
            subscription: payload.subscription,
            keys: payload.keys,
            user_agent: payload.user_agent,
            is_pwa: payload.is_pwa,
            status: 'active',
            last_seen: payload.last_seen
          })
          .eq('id', existingId);

        if (updateError) {
          console.error('Errore aggiornamento subscription su DB:', updateError);
          return false;
        } else {
          console.log('💾 Subscription aggiornata su DB (id):', existingId);
          return true;
        }
      } else {
        // Inserisci nuova riga
        const { data: insertData, error: insertError } = await supabase
          .from('push_subscriptions')
          .insert([payload]);

        if (insertError) {
          console.error('Errore inserimento subscription su DB:', insertError);
          return false;
        } else {
          console.log('💾 Subscription inserita su DB:', insertData);
          return true;
        }
      }
    } catch (err) {
      console.error('Errore savePushSubscription:', err);
      return false;
    }
  };

  // Mostra notifica: prova prima showNotification via SW, fallback Notification API
  const sendLocalNotification = useCallback(
    (data: PushNotificationData) => {
      if (notificationState.permission !== 'granted') {
        console.warn('Permessi notifiche non concessi');
        return;
      }

      const options: NotificationOptions = {
        body: data.body,
        icon: data.icon || '/pwa-192x192.png',
        badge: data.badge || '/pwa-192x192.png',
        tag: data.tag || 'crew-notification',
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        vibrate: data.vibrate || [200, 100, 200],
        data: {
          url: data.url || '/',
          timestamp: Date.now()
        }
      };

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then(reg => {
            if (reg && typeof reg.showNotification === 'function') {
              return reg.showNotification(data.title, options);
            }
            throw new Error('registration.showNotification non disponibile');
          })
          .catch(err => {
            console.warn('showNotification via SW fallita, uso Notification API come fallback', err);
            try {
              const n = new Notification(data.title, options);
              (n as any).onclick = () => {
                window.focus();
                if (data.url) window.location.href = data.url;
                n.close();
              };
              setTimeout(() => n.close(), 10000);
            } catch (e) {
              console.error('Errore fallback Notification API:', e);
            }
          });
        return;
      }

      // Fallback if service worker not supported
      try {
        const n = new Notification(data.title, options);
        (n as any).onclick = () => {
          window.focus();
          if (data.url) window.location.href = data.url;
          n.close();
        };
        setTimeout(() => n.close(), 10000);
      } catch (err) {
        console.error('Errore nel mostrare la notifica localmente:', err);
      }
    },
    [notificationState.permission]
  );

  // Subscribe to DB realtime notifications (example with Supabase)
  const subscribeToNotifications = useCallback(() => {
    if (!user?.id) return;

    console.log('👂 Sottoscrizione notifiche database per user:', user.id);

    const channel = supabase
      .channel('user-notifications-' + user.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifiche',
          filter: `id_utente=eq.${user.id}`
        },
        payload => {
          console.log('📬 Nuova notifica ricevuta:', payload);
          const notifica = (payload as any).new;
          sendLocalNotification({
            title: notifica.titolo || 'Notifica',
            body: notifica.messaggio || '',
            tag: `notifica-${notifica.id}`,
            url: notifica.url_azione || '/',
            requireInteraction: notifica.tipo === 'urgente',
            vibrate: [200, 100, 200]
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, sendLocalNotification]);

  // Test and helper notifications
  const sendTestNotification = useCallback(() => {
    sendLocalNotification({
      title: '🧪 Test Notifica',
      body: 'Questa è una notifica di test',
      tag: 'test-notification',
      requireInteraction: false,
      vibrate: [200, 100, 200]
    });
  }, [sendLocalNotification]);

  const sendShiftReminder = useCallback(
    (shiftTitle: string, startTime: string) => {
      sendLocalNotification({
        title: '⏰ Promemoria Turno',
        body: `Il tuo turno "${shiftTitle}" inizia alle ${startTime}`,
        tag: 'shift-reminder',
        url: '/checkin',
        requireInteraction: true,
        vibrate: [300, 100, 300]
      });
    },
    [sendLocalNotification]
  );

  const sendCheckInReminder = useCallback(
    (location: string) => {
      sendLocalNotification({
        title: '📍 Check-in Richiesto',
        body: `Non dimenticare di fare check-in presso ${location}`,
        tag: 'checkin-reminder',
        url: '/checkin',
        requireInteraction: true,
        vibrate: [200, 100, 200]
      });
    },
    [sendLocalNotification]
  );

  const sendOvertimeAlert = useCallback(
    (hours: number) => {
      sendLocalNotification({
        title: '⏱️ Straordinari Rilevati',
        body: `Hai lavorato ${hours.toFixed(1)} ore di straordinario oggi`,
        tag: 'overtime-alert',
        url: '/timesheet',
        requireInteraction: false,
        vibrate: [100, 50, 100]
      });
    },
    [sendLocalNotification]
  );

  // Auto-subscribe to DB notifications when user logged and permission granted
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (user?.id && notificationState.permission === 'granted') {
      unsubscribe = subscribeToNotifications();
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, notificationState.permission, subscribeToNotifications]);

  return {
    permission: notificationState.permission,
    isSupported: notificationState.isSupported,
    isServiceWorkerReady: notificationState.isServiceWorkerReady,
    subscription: notificationState.subscription,
    isLoading,
    error,
    requestPermission,
    subscribeToPush,
    sendLocalNotification,
    sendTestNotification,
    sendShiftReminder,
    sendCheckInReminder,
    sendOvertimeAlert,
    subscribeToNotifications
  };
};

// helper per convertire la VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}