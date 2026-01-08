import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Chiavi VAPID per web push (dovrebbero essere in env vars, ma per ora hardcoded)
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = 'mailto:support@crewmanager.com';

interface PushNotificationRequest {
  userId: string;
  title: string;
  message: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Crea client Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Leggi body
    const body: PushNotificationRequest = await req.json();
    const { userId, title, message, url, icon, badge, tag, data } = body;

    if (!userId || !title || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, title, message' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Recupera tutte le subscriptions attive dell'utente
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (subError) {
      console.error('Errore recupero subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve subscriptions', details: subError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active subscriptions found for user',
          sentCount: 0 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Payload notifica
    const notificationPayload = {
      title,
      body: message,
      icon: icon || '/pwa-192x192.png',
      badge: badge || '/pwa-192x192.png',
      tag: tag || 'shift-notification',
      data: {
        url: url || '/',
        timestamp: Date.now(),
        ...data,
      },
      requireInteraction: true,
      vibrate: [200, 100, 200],
    };

    // Invia notifica a tutti i dispositivi
    let sentCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    for (const sub of subscriptions) {
      try {
        // La subscription è salvata come JSONB, quindi la usiamo direttamente
        const pushSubscription = sub.subscription;

        if (!pushSubscription || !pushSubscription.endpoint) {
          console.warn(`Subscription invalida per user ${userId}:`, sub.id);
          continue;
        }

        // Invia notifica push usando web-push protocol
        // NOTA: In produzione dovresti usare una libreria come web-push
        // Per ora simuliamo l'invio con un fetch al service worker endpoint
        
        const pushResponse = await fetch(pushSubscription.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'TTL': '86400', // 24 ore
          },
          body: JSON.stringify(notificationPayload),
        });

        if (pushResponse.ok) {
          sentCount++;
          
          // Aggiorna last_seen della subscription
          await supabase
            .from('push_subscriptions')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', sub.id);
        } else {
          failedCount++;
          const errorText = await pushResponse.text();
          errors.push({ subscriptionId: sub.id, error: errorText });
          
          // Se errore 410 (Gone), disattiva subscription
          if (pushResponse.status === 410) {
            await supabase
              .from('push_subscriptions')
              .update({ status: 'expired' })
              .eq('id', sub.id);
          }
        }
      } catch (error) {
        failedCount++;
        console.error(`Errore invio push a subscription ${sub.id}:`, error);
        errors.push({ subscriptionId: sub.id, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        failedCount,
        totalSubscriptions: subscriptions.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Errore generale:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
