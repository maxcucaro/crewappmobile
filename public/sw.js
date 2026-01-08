// Service Worker per CrewManager Staff PWA
const CACHE_NAME = 'crew-staff-v1.1.0';
const STATIC_CACHE = 'crew-static-v1.1.0';
const DYNAMIC_CACHE = 'crew-dynamic-v1.1.0';

// File da memorizzare immediatamente
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/version.json'
];

// File da memorizzare dinamicamente
const CACHE_STRATEGIES = {
  // Cache First - Per risorse statiche
  cacheFirst: [
    /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
    /\.(?:css|js)$/,
    /\/pwa-.*\.png$/
  ],
  
  // Network First - Per dati dinamici
  networkFirst: [
    /\/api\//,
    /supabase\.co/,
    /version\.json/
  ]
};

// 🚀 INSTALLAZIONE SERVICE WORKER
self.addEventListener('install', (event) => {
  console.log('📱 SW: Installazione in corso...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📱 SW: Cache statica aperta, memorizzazione assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ SW: Assets statici memorizzati');
        return self.skipWaiting(); // Forza attivazione immediata
      })
      .catch((error) => {
        console.error('❌ SW: Errore installazione:', error);
      })
  );
});

// 🔄 ATTIVAZIONE SERVICE WORKER
self.addEventListener('activate', (event) => {
  console.log('📱 SW: Attivazione in corso...');
  
  event.waitUntil(
    Promise.all([
      // Pulisci cache vecchie
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== CACHE_NAME) {
              console.log('🗑️ SW: Eliminazione cache vecchia:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Prendi controllo di tutte le pagine
      self.clients.claim()
    ])
    .then(() => {
      console.log('✅ SW: Attivazione completata');
    })
    .catch((error) => {
      console.error('❌ SW: Errore attivazione:', error);
    })
  );
});

// 🌐 INTERCETTAZIONE RICHIESTE - Strategia Cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignora richieste non HTTP
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Strategia Cache First per assets statici
  if (CACHE_STRATEGIES.cacheFirst.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Strategia Network First per dati dinamici
  if (CACHE_STRATEGIES.networkFirst.some(pattern => pattern.test(url.href))) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Default: Cache First per tutto il resto
  event.respondWith(cacheFirst(request));
});

// 📦 STRATEGIA CACHE FIRST
async function cacheFirst(request) {
  try {
    // Cerca prima nella cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 SW: Servito dalla cache:', request.url);
      return cachedResponse;
    }
    
    // Se non in cache, fetch dalla rete
    const networkResponse = await fetch(request);
    
    // Memorizza nella cache dinamica
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      console.log('💾 SW: Memorizzato in cache:', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('❌ SW: Errore cache first:', error);
    
    // Fallback per pagine HTML
    if (request.destination === 'document') {
      const cache = await caches.open(STATIC_CACHE);
      return cache.match('/index.html');
    }
    
    // Fallback generico
    return new Response('Offline - Contenuto non disponibile', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// 🌐 STRATEGIA NETWORK FIRST
async function networkFirst(request) {
  try {
    // Prova prima la rete
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Aggiorna cache con nuovi dati
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      console.log('🔄 SW: Cache aggiornata:', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('📡 SW: Rete non disponibile, uso cache:', request.url);
    
    // Se rete non disponibile, usa cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Nessuna cache disponibile
    return new Response('Offline - Dati non disponibili', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// 🔔 GESTIONE NOTIFICHE PUSH
self.addEventListener('push', (event) => {
  console.log('📱 SW: Notifica push ricevuta');
  
  let notificationData = {
    title: 'CrewManager Staff',
    body: 'Nuova notifica disponibile',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'crew-notification',
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };
  
  // Parse dati notifica se presenti
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
    } catch (error) {
      console.error('❌ SW: Errore parsing notifica:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
      .then(() => {
        console.log('✅ SW: Notifica mostrata');
      })
      .catch((error) => {
        console.error('❌ SW: Errore notifica:', error);
      })
  );
});

// 👆 GESTIONE CLICK NOTIFICHE
self.addEventListener('notificationclick', (event) => {
  console.log('📱 SW: Click su notifica');

  event.notification.close();

  // Determina URL in base al tipo di notifica
  const notifData = event.notification.data || {};
  let urlToOpen = notifData.url || '/';

  // Se è una notifica di shift, determina dove andare
  if (notifData.shiftType) {
    const isPreShift = notifData.notificationType?.startsWith('pre_shift');
    const isPostShift = notifData.notificationType?.startsWith('post_shift');

    if (notifData.shiftType === 'warehouse') {
      // Turni magazzino: vai sempre a warehouse check-in
      urlToOpen = '/warehouse-checkin';
    } else if (notifData.shiftType === 'event') {
      // Eventi: vai al calendario o check-in eventi
      urlToOpen = isPreShift || isPostShift ? '/calendar' : '/calendar';
    }
  }

  console.log('📱 SW: Apertura URL:', urlToOpen);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Se l'app è già aperta, naviga e porta in primo piano
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            // Naviga alla pagina giusta
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              url: urlToOpen,
              data: notifData
            });
            return client;
          }
        }

        // Altrimenti apri nuova finestra
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
      .catch((error) => {
        console.error('❌ SW: Errore apertura finestra:', error);
      })
  );
});

// 📨 GESTIONE MESSAGGI DAL CLIENT
self.addEventListener('message', (event) => {
  console.log('📱 SW: Messaggio ricevuto:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME,
      timestamp: Date.now()
    });
  }
});

// 🔄 GESTIONE AGGIORNAMENTI IN BACKGROUND
self.addEventListener('sync', (event) => {
  console.log('📱 SW: Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Qui potresti sincronizzare dati offline
      Promise.resolve()
    );
  }
});

console.log('📱 Service Worker CrewManager Staff caricato - Versione:', CACHE_NAME);