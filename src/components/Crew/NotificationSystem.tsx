import React, { useState, useEffect } from 'react';
import { Bell, QrCode, MapPin, Calendar, Clock, AlertTriangle, CheckCircle, X, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/db';
import { Link } from 'react-router-dom';

interface EventNotification {
  id: string;
  type: 'warehouse_checkin' | 'event_location' | 'course_confirmation' | 'company_talk';
  title: string;
  date: string;
  time: string;
  location: string;
  isRead: boolean;
  eventId: string;
  warehouseId?: string;
  isActive: boolean;
  isCompleted: boolean;
  requiresAction: boolean;
  // optional reference to assignment row for course notifications
  assignmentId?: string;
  corsoId?: string;
  // optional fields for company talks
  isUrgent?: boolean;
  messageType?: string;
  messagePreview?: string;
}

const NotificationSystem: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<EventNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTodayAlert, setShowTodayAlert] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);

        // 1) Load persistent notifications from table `notifiche`
        const { data: notificationsData, error: notificationsError } = await supabase
          .from('notifiche')
          .select('*')
          .eq('id_utente', user.id)
          .neq('stato', 'eliminata')
          .order('created_at', { ascending: false });

        let mappedNotifications: EventNotification[] = [];

        if (notificationsError) {
          console.error('Errore nel caricamento notifiche:', notificationsError);
          mappedNotifications = [];
        } else {
          mappedNotifications = (notificationsData || []).map(notif => {
            let notificationType: EventNotification['type'] = 'event_location';
            let eventId = '';
            let warehouseId = '';

            if (notif.tipo === 'check_in_magazzino' || (notif.titolo || '').toLowerCase().includes('magazzino')) {
              notificationType = 'warehouse_checkin';
              warehouseId = notif.url_azione?.split('/').pop() || '';
            } else {
              notificationType = 'event_location';
              eventId = notif.url_azione?.split('/').pop() || '';
            }

            return {
              id: notif.id,
              type: notificationType,
              title: notif.titolo,
              date: notif.created_at ? new Date(notif.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              time: '09:00 - 17:00',
              location: (notif.messaggio || '').includes('presso')
                ? (notif.messaggio || '').split('presso')[1]?.trim() || 'Località non specificata'
                : 'Località non specificata',
              isRead: (notif.stato === 'letta' || notif.letta === true),
              eventId,
              warehouseId,
              isActive: false,
              isCompleted: false,
              requiresAction: notif.stato === 'non_letta' || notif.requires_action === true,
            } as EventNotification;
          });
        }

        // 2) Load in-memory (or DB) course assignments that require confirmation for this user
        // We'll create synthetic notifications for assignments where stato_invito = 'invitato'
        // Use id prefixed with "course-" so we can distinguish them client-side
        try {
          const { data: courseAssignments, error: courseError } = await supabase
            .from('crew_assegnazionecorsi')
            .select('*')
            .eq('persona_id', user.id)
            .eq('stato_invito', 'invitato')
            .order('data_invito', { ascending: false });

          if (courseError) {
            console.error('Errore caricamento assegnazioni corsi:', courseError);
          } else if (courseAssignments && courseAssignments.length > 0) {
            const courseNotifs = (courseAssignments || []).map((a: any) => {
              // synthetic id to avoid collision with DB notifiche ids
              const syntheticId = `course-${a.id}`;
              return {
                id: syntheticId,
                type: 'course_confirmation',
                title: a.titolo_corso || a.corso_titolo || `Corso ${a.corso_id}`,
                date: a.data_invito ? new Date(a.data_invito).toISOString().split('T')[0] : (a.data_partecipazione ? (new Date(a.data_partecipazione).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]),
                time: a.ora_inizio ? `${a.ora_inizio} - ${a.ora_fine || ''}` : '09:00 - 17:00',
                location: a.luogo || 'On Line',
                isRead: false,
                eventId: a.corso_id || '',
                assignmentId: a.id,
                corsoId: a.corso_id,
                isActive: false,
                isCompleted: false,
                requiresAction: true
              } as EventNotification;
            });

            // Prepend course notifications so they appear first
            mappedNotifications = [...courseNotifs, ...mappedNotifications];
          }
        } catch (e) {
          console.warn('Eccezione caricamento assegnazioni corsi:', e);
        }

        // 3) Load unread company_talks messages
        try {
          const { data: companyTalks, error: talksError } = await supabase
            .from('company_talks')
            .select('*')
            .eq('recipient_id', user.id)
            .eq('is_read', false)
            .order('created_at', { ascending: false });

          if (talksError) {
            console.error('Errore caricamento messaggi azienda:', talksError);
          } else if (companyTalks && companyTalks.length > 0) {
            const talkNotifs = companyTalks.map((talk: any) => {
              const syntheticId = `talk-${talk.id}`;
              let messagePreview = '';

              if (talk.message_type === 'text') {
                messagePreview = talk.message_text?.substring(0, 100) || '';
              } else if (talk.message_type === 'audio') {
                messagePreview = 'Messaggio vocale';
              } else if (talk.message_type === 'image') {
                messagePreview = 'Immagine';
              } else if (talk.message_type === 'file') {
                messagePreview = `File: ${talk.file_name || 'documento'}`;
              }

              return {
                id: syntheticId,
                type: 'company_talk',
                title: talk.sender_name || 'Messaggio Azienda',
                date: talk.created_at ? new Date(talk.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                time: talk.created_at ? new Date(talk.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '',
                location: 'Messaggi',
                isRead: false,
                eventId: talk.id,
                isActive: false,
                isCompleted: false,
                requiresAction: true,
                isUrgent: talk.is_urgent,
                messageType: talk.message_type,
                messagePreview: messagePreview
              } as EventNotification;
            });

            // Add talk notifications to the beginning
            mappedNotifications = [...talkNotifs, ...mappedNotifications];
          }
        } catch (e) {
          console.warn('Eccezione caricamento messaggi azienda:', e);
        }

        setNotifications(mappedNotifications);
      } catch (error) {
        console.error('Errore nel caricamento delle notifiche:', error);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();

    // Real-time: listen to notifiche table for INSERT (existing logic)
    if (!user?.id) return;

    const notifChannel = supabase
      .channel(`notifiche-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifiche',
          filter: `id_utente=eq.${user.id}`
        },
        (payload) => {
          const newNotif = payload.new as any;

          let notificationType: EventNotification['type'] = 'event_location';
          let eventId = '';
          let warehouseId = '';

          if (newNotif.tipo === 'check_in_magazzino' || (newNotif.titolo || '').toLowerCase().includes('magazzino')) {
            notificationType = 'warehouse_checkin';
            warehouseId = newNotif.url_azione?.split('/').pop() || '';
          } else {
            notificationType = 'event_location';
            eventId = newNotif.url_azione?.split('/').pop() || '';
          }

          const mappedNotif: EventNotification = {
            id: newNotif.id,
            type: notificationType,
            title: newNotif.titolo,
            date: newNotif.created_at ? new Date(newNotif.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            time: '09:00 - 17:00',
            location: newNotif.messaggio?.includes('presso') ?
              newNotif.messaggio.split('presso')[1]?.trim() || 'Località non specificata' :
              'Località non specificata',
            isRead: newNotif.stato === 'letta',
            eventId,
            warehouseId,
            isActive: false,
            isCompleted: false,
            requiresAction: newNotif.stato === 'non_letta'
          };

          setNotifications(prev => [mappedNotif, ...prev]);
        }
      )
      .subscribe();

    // Real-time: listen to crew_assegnazionecorsi for this user to add/remove course notifications
    const courseChannel = supabase
      .channel(`crew_assegnazionecorsi-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crew_assegnazionecorsi',
          filter: `persona_id=eq.${user.id}`
        },
        (payload) => {
          const newRow = payload.new as any;
          // if new assignment is in 'invitato' state, add synthetic course notification
          if (newRow.stato_invito === 'invitato') {
            const syntheticId = `course-${newRow.id}`;
            const mapped: EventNotification = {
              id: syntheticId,
              type: 'course_confirmation',
              title: newRow.titolo_corso || newRow.corso_titolo || `Corso ${newRow.corso_id}`,
              date: newRow.data_invito ? new Date(newRow.data_invito).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              time: newRow.ora_inizio ? `${newRow.ora_inizio} - ${newRow.ora_fine || ''}` : '09:00 - 17:00',
              location: newRow.luogo || 'On Line',
              isRead: false,
              eventId: newRow.corso_id || '',
              assignmentId: newRow.id,
              corsoId: newRow.corso_id,
              isActive: false,
              isCompleted: false,
              requiresAction: true
            };
            setNotifications(prev => [mapped, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'crew_assegnazionecorsi',
          filter: `persona_id=eq.${user.id}`
        },
        (payload) => {
          const newRow = payload.new as any;
          const syntheticId = `course-${newRow.id}`;

          // if assignment moved out of 'invitato' (e.g., confirmed), remove synthetic notification
          if (newRow.stato_invito && newRow.stato_invito !== 'invitato') {
            setNotifications(prev => prev.filter(n => n.id !== syntheticId));
          } else if (newRow.stato_invito === 'invitato') {
            // ensure it exists
            setNotifications(prev => {
              const exists = prev.find(n => n.id === syntheticId);
              if (exists) return prev;
              const mapped: EventNotification = {
                id: syntheticId,
                type: 'course_confirmation',
                title: newRow.titolo_corso || newRow.corso_titolo || `Corso ${newRow.corso_id}`,
                date: newRow.data_invito ? new Date(newRow.data_invito).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                time: newRow.ora_inizio ? `${newRow.ora_inizio} - ${newRow.ora_fine || ''}` : '09:00 - 17:00',
                location: newRow.luogo || 'On Line',
                isRead: false,
                eventId: newRow.corso_id || '',
                assignmentId: newRow.id,
                corsoId: newRow.corso_id,
                isActive: false,
                isCompleted: false,
                requiresAction: true
              };
              return [mapped, ...prev];
            });
          }
        }
      )
      .subscribe();

    // Real-time: listen to company_talks for new unread messages for this user
    const talksChannel = supabase
      .channel(`company_talks-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_talks',
          filter: `recipient_id=eq.${user.id}`
        },
        (payload) => {
          const newTalk = payload.new as any;
          const syntheticId = `talk-${newTalk.id}`;

          let messagePreview = '';
          if (newTalk.message_type === 'text') {
            messagePreview = newTalk.message_text?.substring(0, 100) || '';
          } else if (newTalk.message_type === 'audio') {
            messagePreview = 'Messaggio vocale';
          } else if (newTalk.message_type === 'image') {
            messagePreview = 'Immagine';
          } else if (newTalk.message_type === 'file') {
            messagePreview = `File: ${newTalk.file_name || 'documento'}`;
          }

          const mapped: EventNotification = {
            id: syntheticId,
            type: 'company_talk',
            title: newTalk.sender_name || 'Messaggio Azienda',
            date: newTalk.created_at ? new Date(newTalk.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            time: newTalk.created_at ? new Date(newTalk.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '',
            location: 'Messaggi',
            isRead: false,
            eventId: newTalk.id,
            isActive: false,
            isCompleted: false,
            requiresAction: true,
            isUrgent: newTalk.is_urgent,
            messageType: newTalk.message_type,
            messagePreview: messagePreview
          };

          setNotifications(prev => [mapped, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'company_talks',
          filter: `recipient_id=eq.${user.id}`
        },
        (payload) => {
          const updatedTalk = payload.new as any;
          const syntheticId = `talk-${updatedTalk.id}`;

          // If message is now read, remove from notifications
          if (updatedTalk.is_read) {
            setNotifications(prev => prev.filter(n => n.id !== syntheticId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(courseChannel);
      supabase.removeChannel(talksChannel);
    };
  }, [user?.id]);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const todayCount = notifications.filter(n => {
    const today = new Date().toISOString().split('T')[0];
    return n.date === today && n.requiresAction;
  }).length;

  const markAsRead = (notificationId: string) => {
    // if synthetic course notification (id startsWith 'course-'), just mark locally
    if (notificationId.startsWith('course-')) {
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true, requiresAction: false } : n));
      return;
    }

    // if synthetic company_talk notification (id startsWith 'talk-'), mark in company_talks table
    if (notificationId.startsWith('talk-')) {
      const talkId = notificationId.replace('talk-', '');
      const updateTalkStatus = async () => {
        try {
          const { error } = await supabase.rpc('mark_talk_as_read', {
            talk_id: talkId
          });

          if (error) {
            console.error('Errore RPC mark_talk_as_read:', error);
            const { error: updateError } = await supabase
              .from('company_talks')
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq('id', talkId)
              .eq('recipient_id', user?.id);

            if (updateError) {
              console.error('Errore update diretto:', updateError);
              throw updateError;
            }
          }

          setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (error) {
          console.error('Errore aggiornamento messaggio:', error);
        }
      };
      updateTalkStatus();
      return;
    }

    const updateNotificationStatus = async () => {
      try {
        const { error } = await supabase.rpc('mark_notification_read', {
          p_notifica_id: notificationId,
          p_user_id: user?.id
        });

        if (error) throw error;

        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, isRead: true, requiresAction: false } : n)
        );
      } catch (error) {
        console.error('Errore aggiornamento notifica:', error);
      }
    };

    updateNotificationStatus();
  };

  const dismissNotification = (notificationId: string) => {
    // synthetic course notifications: remove locally
    if (notificationId.startsWith('course-')) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      return;
    }

    // synthetic company_talk notifications: mark as read and remove
    if (notificationId.startsWith('talk-')) {
      const talkId = notificationId.replace('talk-', '');
      const dismissTalk = async () => {
        try {
          const { error } = await supabase.rpc('mark_talk_as_read', {
            talk_id: talkId
          });

          if (error) {
            console.error('Errore RPC mark_talk_as_read:', error);
            const { error: updateError } = await supabase
              .from('company_talks')
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq('id', talkId)
              .eq('recipient_id', user?.id);

            if (updateError) {
              console.error('Errore update diretto:', updateError);
            }
          }

          setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (error) {
          console.error('Errore dismissione messaggio:', error);
          // fallback: remove locally anyway
          setNotifications(prev => prev.filter(n => n.id !== notificationId));
        }
      };
      dismissTalk();
      return;
    }

    const deleteNotification = async () => {
      try {
        const { error } = await supabase.rpc('delete_notification', {
          p_notifica_id: notificationId,
          p_user_id: user?.id
        });

        if (error) throw error;

        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      } catch (error) {
        console.error('Errore eliminazione notifica:', error);
        // fallback: remove locally anyway
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    };

    deleteNotification();
  };

  const handleAction = (notification: EventNotification) => {
    // For company_talk, mark as read and close
    if (notification.type === 'company_talk') {
      markAsRead(notification.id);
      setShowNotifications(false);
      return;
    }

    // For course_confirmation we might open the course detail; for others we perform existing behavior
    if (notification.type === 'course_confirmation') {
      // open modal or route to course details - here we just mark as read and close panel
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true, requiresAction: false } : n));
      setShowNotifications(false);
      return;
    }

    // Mark as read for persistent notifications
    markAsRead(notification.id);

    // Close panel
    setShowNotifications(false);
  };

  const getTodayNotifications = () => {
    const today = new Date().toISOString().split('T')[0];
    return notifications.filter(n => n.date === today && n.requiresAction);
  };

  const getUpcomingNotifications = () => {
    const today = new Date().toISOString().split('T')[0];
    return notifications.filter(n => n.date > today);
  };

  const getPastNotifications = () => {
    const today = new Date().toISOString().split('T')[0];
    return notifications.filter(n => n.date < today || (n.date === today && !n.requiresAction));
  };

  const handleCloseAlertClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowTodayAlert(false);
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Today's Notifications Alert - Always visible if there are notifications for today */}
      {todayCount > 0 && showTodayAlert && (
        <div className="fixed bottom-4 right-4 z-40">
          <div className="bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-sm">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium">Azioni richieste oggi</h4>
                <p className="text-sm mt-1">
                  Hai {todayCount} {todayCount === 1 ? 'notifica' : 'notifiche'} che richiedono attenzione oggi.
                </p>
                <button
                  onClick={() => setShowNotifications(true)}
                  className="mt-2 px-3 py-1 bg-white text-blue-600 rounded text-sm font-medium"
                >
                  Visualizza
                </button>
              </div>
              <button
                onClick={handleCloseAlertClick}
                className="text-white hover:text-blue-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            <div className="px-4 py-2 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-900">Notifiche</h3>
              <button 
                onClick={() => setShowNotifications(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Caricamento notifiche...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>Nessuna notifica disponibile</p>
                  <p className="text-xs mt-1">Le notifiche degli eventi appariranno qui</p>
                </div>
              ) : (
                <>
                  {/* Course confirmations section (synthetic notifications) */}
                  {notifications.some(n => n.type === 'course_confirmation') && (
                    <div className="px-4 py-2 border-b border-gray-100 bg-yellow-50">
                      <h4 className="text-xs font-medium text-yellow-800 uppercase">Corsi da confermare</h4>
                    </div>
                  )}

                  {notifications.filter(n => n.type === 'course_confirmation').map(notification => (
                    <div 
                      key={notification.id} 
                      className={`px-4 py-3 border-b border-gray-100 ${!notification.isRead ? 'bg-yellow-50' : ''}`}
                    >
                      <div className="flex items-start space-x-3">
                        <Calendar className="h-5 w-5 mt-0.5 text-yellow-700" />
                        
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium text-gray-900 ${!notification.isRead ? 'font-semibold' : ''}`}>
                            {notification.title}
                          </p>
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{new Date(notification.date).toLocaleDateString('it-IT')}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500 mt-0.5">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>{notification.time}</span>
                          </div>
                          <div className="mt-2">
                            <button
                              onClick={() => handleAction(notification)}
                              className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 mr-2"
                            >
                              Conferma
                            </button>
                            <button
                              onClick={() => dismissNotification(notification.id)}
                              className="inline-flex items-center px-3 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                            >
                              Ignora
                            </button>
                          </div>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(notification.id);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Company Talks section */}
                  {notifications.some(n => n.type === 'company_talk') && (
                    <div className="px-4 py-2 border-b border-gray-100 bg-cyan-50">
                      <h4 className="text-xs font-medium text-cyan-800 uppercase">Messaggi Azienda</h4>
                    </div>
                  )}

                  {notifications.filter(n => n.type === 'company_talk').map(notification => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 border-b border-gray-100 ${notification.isUrgent ? 'bg-red-50' : 'bg-cyan-50'}`}
                    >
                      <div className="flex items-start space-x-3">
                        <MessageSquare className={`h-5 w-5 mt-0.5 ${notification.isUrgent ? 'text-red-600' : 'text-cyan-600'}`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900">
                              {notification.title}
                            </p>
                            {notification.isUrgent && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                <AlertTriangle className="h-3 w-3 mr-0.5" />
                                Urgente
                              </span>
                            )}
                          </div>

                          {notification.messagePreview && (
                            <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                              {notification.messagePreview}
                            </p>
                          )}

                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>{notification.time}</span>
                          </div>

                          <div className="mt-2">
                            <button
                              onClick={() => handleAction(notification)}
                              className="inline-flex items-center px-3 py-1 bg-cyan-600 text-white text-xs rounded hover:bg-cyan-700 mr-2"
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Leggi Messaggio
                            </button>
                            <button
                              onClick={() => dismissNotification(notification.id)}
                              className="inline-flex items-center px-3 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                            >
                              Ignora
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(notification.id);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Today's Notifications */}
                  {getTodayNotifications().length > 0 && (
                    <div className="px-4 py-2 border-b border-gray-100 bg-blue-50">
                      <h4 className="text-xs font-medium text-blue-800 uppercase">Oggi</h4>
                    </div>
                  )}
                  
                  {getTodayNotifications().map(notification => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 border-b border-gray-100 ${!notification.isRead ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-start space-x-3">
                        {notification.type === 'warehouse_checkin' ? (
                          <QrCode className="h-5 w-5 mt-0.5 text-purple-600" />
                        ) : notification.type === 'company_talk' ? (
                          <MessageSquare className="h-5 w-5 mt-0.5 text-cyan-600" />
                        ) : (
                          <MapPin className="h-5 w-5 mt-0.5 text-green-600" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium text-gray-900 ${!notification.isRead ? 'font-semibold' : ''}`}>
                            {notification.title}
                          </p>
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{new Date(notification.date).toLocaleDateString('it-IT')}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500 mt-0.5">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>{notification.time}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500 mt-0.5">
                            <MapPin className="h-3 w-3 mr-1" />
                            <span>{notification.location}</span>
                          </div>
                          
                          {notification.requiresAction && (
                            <div className="mt-2">
                              {notification.type === 'warehouse_checkin' ? (
                                <Link
                                  to="/warehouse-checkin"
                                  onClick={() => handleAction(notification)}
                                  className="inline-flex items-center px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                                >
                                  <QrCode className="h-3 w-3 mr-1" />
                                  <span>Check-in</span>
                                </Link>
                              ) : (
                                <button
                                  onClick={() => handleAction(notification)}
                                  className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                >
                                  <MapPin className="h-3 w-3 mr-1" />
                                  <span>Attiva Posizione</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(notification.id);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Upcoming Notifications */}
                  {getUpcomingNotifications().length > 0 && (
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                      <h4 className="text-xs font-medium text-gray-600 uppercase">Prossimi</h4>
                    </div>
                  )}
                  
                  {getUpcomingNotifications().map(notification => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 border-b border-gray-100 ${!notification.isRead ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-start space-x-3">
                        {notification.type === 'warehouse_checkin' ? (
                          <QrCode className="h-5 w-5 mt-0.5 text-gray-500" />
                        ) : notification.type === 'company_talk' ? (
                          <MessageSquare className="h-5 w-5 mt-0.5 text-gray-500" />
                        ) : (
                          <MapPin className="h-5 w-5 mt-0.5 text-gray-500" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium text-gray-900 ${!notification.isRead ? 'font-semibold' : ''}`}>
                            {notification.title}
                          </p>
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{new Date(notification.date).toLocaleDateString('it-IT')}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500 mt-0.5">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>{notification.time}</span>
                          </div>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {notification.isRead ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Past Notifications */}
                  {getPastNotifications().length > 0 && (
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                      <h4 className="text-xs font-medium text-gray-600 uppercase">Passati</h4>
                    </div>
                  )}
                  
                  {getPastNotifications().map(notification => (
                    <div
                      key={notification.id}
                      className="px-4 py-3 border-b border-gray-100"
                    >
                      <div className="flex items-start space-x-3">
                        {notification.type === 'warehouse_checkin' ? (
                          <QrCode className="h-5 w-5 mt-0.5 text-gray-400" />
                        ) : notification.type === 'company_talk' ? (
                          <MessageSquare className="h-5 w-5 mt-0.5 text-gray-400" />
                        ) : (
                          <MapPin className="h-5 w-5 mt-0.5 text-gray-400" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700">
                            {notification.title}
                          </p>
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{new Date(notification.date).toLocaleDateString('it-IT')}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500 mt-0.5">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>{notification.time}</span>
                          </div>
                          
                          {notification.isCompleted ? (
                            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Completato
                            </span>
                          ) : (
                            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              <X className="h-3 w-3 mr-1" />
                              Non completato
                            </span>
                          )}
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(notification.id);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-200">
                <button 
                  onClick={() => {
                    // Segna tutte come lette nel database for persistent ones and locally for course synthetic ones
                    const markAllAsRead = async () => {
                      try {
                        // mark persistent notifiche as read via RPC
                        const { error } = await supabase.rpc('mark_all_notifications_read', { p_user_id: user?.id });
                        if (error) throw error;

                        // Aggiorna lo stato locale: mark all as read
                        setNotifications(prev => prev.map(n => ({ ...n, isRead: true, requiresAction: false })));
                      } catch (error) {
                        console.error('Errore nel segnare tutte come lette:', error);
                        // fallback: mark locally
                        setNotifications(prev => prev.map(n => ({ ...n, isRead: true, requiresAction: false })));
                      }
                    };
                    
                    markAllAsRead();
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Segna tutte come lette
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationSystem;