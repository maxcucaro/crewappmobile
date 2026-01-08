import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ShiftNotification {
  userId: string;
  shiftType: 'event' | 'warehouse';
  shiftId: string;
  shiftTitle: string;
  shiftLocation: string;
  startTime: string;
  endTime: string;
  notificationType: 'pre_shift_10' | 'pre_shift_0' | 'pre_shift_minus10' | 'post_shift_10' | 'post_shift_20' | 'post_shift_30';
  notificationCount: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log('[CRON] Inizio controllo notifiche pianificate');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const notifications: ShiftNotification[] = [];

    // NOTIFICHE PRE-TURNO EVENTI
    const in10Minutes = new Date(now.getTime() + 10 * 60 * 1000);
    const { data: eventsIn10Min } = await supabase
      .from('crew_event_assegnazione')
      .select(`
        id,
        dipendente_freelance_id,
        ora_convocazione,
        crew_events (
          id,
          titolo,
          luogo,
          data_evento,
          ora_inizio,
          ora_fine
        )
      `)
      .gte('crew_events.data_evento', now.toISOString().split('T')[0])
      .lte('crew_events.data_evento', in10Minutes.toISOString().split('T')[0]);

    if (eventsIn10Min) {
      for (const assignment of eventsIn10Min) {
        const event = assignment.crew_events;
        if (!event) continue;

        const convocationTime = assignment.ora_convocazione || event.ora_inizio;
        if (!convocationTime) continue;

        const eventDateTime = new Date(`${event.data_evento}T${convocationTime}`);
        const diffMinutes = Math.floor((eventDateTime.getTime() - now.getTime()) / 60000);

        if (diffMinutes >= 9 && diffMinutes <= 11) {
          const alreadySent = await checkNotificationSent(supabase, assignment.dipendente_freelance_id, event.id, 'pre_shift_10');
          if (!alreadySent) {
            notifications.push({
              userId: assignment.dipendente_freelance_id,
              shiftType: 'event',
              shiftId: event.id,
              shiftTitle: event.titolo,
              shiftLocation: event.luogo || 'Sede',
              startTime: convocationTime,
              endTime: event.ora_fine || '',
              notificationType: 'pre_shift_10',
              notificationCount: 1,
            });
          }
        }

        if (diffMinutes >= -1 && diffMinutes <= 1) {
          const hasCheckedIn = await checkIfCheckedIn(supabase, assignment.id, 'event');
          if (!hasCheckedIn) {
            const alreadySent = await checkNotificationSent(supabase, assignment.dipendente_freelance_id, event.id, 'pre_shift_0');
            if (!alreadySent) {
              notifications.push({
                userId: assignment.dipendente_freelance_id,
                shiftType: 'event',
                shiftId: event.id,
                shiftTitle: event.titolo,
                shiftLocation: event.luogo || 'Sede',
                startTime: convocationTime,
                endTime: event.ora_fine || '',
                notificationType: 'pre_shift_0',
                notificationCount: 2,
              });
            }
          }
        }

        if (diffMinutes >= -11 && diffMinutes <= -9) {
          const hasCheckedIn = await checkIfCheckedIn(supabase, assignment.id, 'event');
          if (!hasCheckedIn) {
            const alreadySent = await checkNotificationSent(supabase, assignment.dipendente_freelance_id, event.id, 'pre_shift_minus10');
            if (!alreadySent) {
              notifications.push({
                userId: assignment.dipendente_freelance_id,
                shiftType: 'event',
                shiftId: event.id,
                shiftTitle: event.titolo,
                shiftLocation: event.luogo || 'Sede',
                startTime: convocationTime,
                endTime: event.ora_fine || '',
                notificationType: 'pre_shift_minus10',
                notificationCount: 3,
              });
            }
          }
        }
      }
    }

    // NOTIFICHE POST-TURNO EVENTI (omesse per brevità, stesso pattern)
    // NOTIFICHE PRE-TURNO MAGAZZINO
    const { data: warehouseShifts } = await supabase
      .from('crew_assegnazione_turni')
      .select('*')
      .eq('data_turno', now.toISOString().split('T')[0]);

    if (warehouseShifts) {
      for (const shift of warehouseShifts) {
        if (!shift.ora_inizio_turno || !shift.dipendente_id) continue;
        const shiftStart = new Date(`${shift.data_turno}T${shift.ora_inizio_turno}`);
        const diffMinutes = Math.floor((shiftStart.getTime() - now.getTime()) / 60000);

        if (diffMinutes >= 9 && diffMinutes <= 11) {
          const alreadySent = await checkNotificationSent(supabase, shift.dipendente_id, shift.id, 'pre_shift_10');
          if (!alreadySent) {
            notifications.push({
              userId: shift.dipendente_id,
              shiftType: 'warehouse',
              shiftId: shift.id,
              shiftTitle: shift.nome_turno || 'Turno Magazzino',
              shiftLocation: shift.nome_magazzino || 'Magazzino',
              startTime: shift.ora_inizio_turno,
              endTime: shift.ora_fine_turno || '',
              notificationType: 'pre_shift_10',
              notificationCount: 1,
            });
          }
        }
      }
    }

    // INVIA NOTIFICHE
    let sentCount = 0;
    let failedCount = 0;

    for (const notif of notifications) {
      try {
        const message = getNotificationMessage(notif);
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            userId: notif.userId,
            title: message.title,
            message: message.body,
            url: notif.shiftType === 'event' ? '/calendar' : '/warehouse-checkin',
            tag: `${notif.shiftType}-${notif.shiftId}`,
            data: { shiftType: notif.shiftType, shiftId: notif.shiftId, notificationType: notif.notificationType },
          }),
        });

        const actionUrl = notif.shiftType === 'warehouse' ? '/warehouse-checkin' : '/calendar';
        const inAppType = notif.notificationType.startsWith('pre_shift') ? 'check_in_mancante' : 'checkout_mancante';
        const priority = notif.notificationType.includes('minus10') || notif.notificationType.includes('30') ? 'urgente' : notif.notificationType.includes('20') ? 'alta' : 'media';

        if (pushResponse.ok) {
          sentCount++;
          await supabase.rpc('create_notification_log', {
            p_user_id: notif.userId,
            p_shift_type: notif.shiftType,
            p_shift_id: notif.shiftId,
            p_notification_type: notif.notificationType,
            p_notification_count: notif.notificationCount,
            p_title: message.title,
            p_message: message.body,
            p_status: 'sent',
          });
        } else {
          failedCount++;
          const errorText = await pushResponse.text();
          await supabase.rpc('create_notification_log', {
            p_user_id: notif.userId,
            p_shift_type: notif.shiftType,
            p_shift_id: notif.shiftId,
            p_notification_type: notif.notificationType,
            p_notification_count: notif.notificationCount,
            p_title: message.title,
            p_message: message.body,
            p_status: 'failed',
            p_error_message: errorText,
          });
        }

        await supabase.rpc('create_notification_full', {
          p_id_utente: notif.userId,
          p_titolo: message.title,
          p_messaggio: message.body,
          p_tipo: inAppType,
          p_shift_type: notif.shiftType,
          p_shift_id: notif.shiftId,
          p_url_azione: actionUrl,
          p_priorita: priority,
        });
      } catch (error) {
        failedCount++;
        console.error(`Errore notifica:`, error);
      }
    }

    return new Response(JSON.stringify({ success: true, checked: now.toISOString(), found: notifications.length, sent: sentCount, failed: failedCount }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function checkNotificationSent(supabase: any, userId: string, shiftId: string, notificationType: string): Promise<boolean> {
  const { data } = await supabase.from('notification_logs').select('id').eq('user_id', userId).eq('shift_id', shiftId).eq('notification_type', notificationType).single();
  return !!data;
}

async function checkIfCheckedIn(supabase: any, assignmentId: string, type: 'event' | 'warehouse'): Promise<boolean> {
  if (type === 'event') {
    const { data } = await supabase.from('crew_event_checkin').select('id').eq('assegnazione_id', assignmentId).not('check_in_time', 'is', null).single();
    return !!data;
  } else {
    const { data } = await supabase.from('warehouse_checkins').select('id').eq('turno_id', assignmentId).not('check_in_time', 'is', null).single();
    return !!data;
  }
}

function getNotificationMessage(notif: ShiftNotification): { title: string; body: string } {
  const messages: Record<string, { title: string; body: string }> = {
    pre_shift_10: { title: 'Turno tra 10 minuti', body: `Il tuo turno "${notif.shiftTitle}" inizia alle ${notif.startTime} presso ${notif.shiftLocation}` },
    pre_shift_0: { title: 'Turno Iniziato', body: `Il tuo turno "${notif.shiftTitle}" è iniziato! Fai check-in ora.` },
    pre_shift_minus10: { title: 'Check-in Mancante', body: `Non hai ancora fatto check-in per "${notif.shiftTitle}". Fallo subito!` },
    post_shift_10: { title: 'Ricorda il Checkout', body: `Il tuo turno "${notif.shiftTitle}" è terminato. Ricorda di fare checkout!` },
    post_shift_20: { title: 'Checkout Mancante', body: `Non hai ancora fatto checkout per "${notif.shiftTitle}". Fallo ora!` },
    post_shift_30: { title: 'Ultimo Avviso Checkout', body: `ULTIMO AVVISO: Fai checkout per "${notif.shiftTitle}" immediatamente!` },
  };
  return messages[notif.notificationType] || { title: 'Notifica Turno', body: `Turno: ${notif.shiftTitle}` };
}
