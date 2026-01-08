import React, { useState, useEffect } from 'react';
import { Bell, QrCode, MapPin, Calendar, Clock, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/db';
import { Link } from 'react-router-dom';

interface EventNotification {
  id: string;
  type: 'warehouse_checkin' | 'event_location';
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

        // Carica le notifiche dalla tabella notifiche filtrata per id_utente
        const { data: notificationsData, error: notificationsError } = await supabase
          .from('notifiche')
          .select('*')
          .eq('id_utente', user.id)
          .neq('stato', 'eliminata')
          .order('created_at', { ascending: false });

        if (notificationsError) {
          console.error('Errore nel caricamento notifiche:', notificationsError);
          setNotifications([]);
        } else {
          // Mappa i dati dal database al formato dell'interfaccia
          const mappedNotifications: EventNotification[] = (notificationsData || []).map(notif => {
            // Determina il tipo di notifica basato sul campo 'tipo'
            let notificationType: 'warehouse_checkin' | 'event_location' = 'event_location';
            let eventId = '';
            let warehouseId = '';

            if (notif.tipo === 'check_in_magazzino' || notif.titolo.toLowerCase().includes('magazzino')) {
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
              location: notif.messaggio.includes('presso') ?
                notif.messaggio.split('presso')[1]?.trim() || 'Località non specificata' :
                'Località non specificata',
              isRead: notif.stato === 'letta',
              eventId: eventId,
              warehouseId: warehouseId,
              isActive: false,
              isCompleted: false,
              requiresAction: notif.stato === 'non_letta'
            };
          });

          setNotifications(mappedNotifications);
        }
      } catch (error) {
        console.error('Errore nel caricamento delle notifiche:', error);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();

    // Real-time: ascolta nuove notifiche
    if (!user?.id) return;

    const channel = supabase
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
          console.log('Nuova notifica ricevuta:', payload);
          const newNotif = payload.new as any;

          let notificationType: 'warehouse_checkin' | 'event_location' = 'event_location';
          let eventId = '';
          let warehouseId = '';

          if (newNotif.tipo === 'check_in_magazzino' || newNotif.titolo.toLowerCase().includes('magazzino')) {
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
            location: newNotif.messaggio.includes('presso') ?
              newNotif.messaggio.split('presso')[1]?.trim() || 'Località non specificata' :
              'Località non specificata',
            isRead: newNotif.stato === 'letta',
            eventId: eventId,
            warehouseId: warehouseId,
            isActive: false,
            isCompleted: false,
            requiresAction: newNotif.stato === 'non_letta'
          };

          setNotifications(prev => [mappedNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const todayCount = notifications.filter(n => {
    const today = new Date().toISOString().split('T')[0];
    return n.date === today && n.requiresAction;
  }).length;

  const markAsRead = (notificationId: string) => {
    const updateNotificationStatus = async () => {
      try {
        // Usa la funzione del database per segnare come letta
        const { error } = await supabase.rpc('mark_notification_read', {
          p_notifica_id: notificationId,
          p_user_id: user?.id
        });

        if (error) throw error;

        // Aggiorna lo stato locale
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
    const deleteNotification = async () => {
      try {
        // Usa la funzione del database per eliminare (nascondere)
        const { error } = await supabase.rpc('delete_notification', {
          p_notifica_id: notificationId,
          p_user_id: user?.id
        });

        if (error) throw error;

        // Rimuovi dallo stato locale
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      } catch (error) {
        console.error('Errore eliminazione notifica:', error);
        // Anche se errore, rimuovi localmente
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    };

    deleteNotification();
  };

  const handleAction = (notification: EventNotification) => {
    // Mark as read
    markAsRead(notification.id);

    // Close notification panel
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
                  Hai {todayCount} {todayCount === 1 ? 'evento' : 'eventi'} che richiedono check-in oggi.
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
                    // Segna tutte come lette nel database
                    const markAllAsRead = async () => {
                      try {
                        const { error } = await supabase
                          .from('notifiche')
                          .update({ letta: true })
                          .eq('id_utente', user?.id)
                          .eq('letta', false);
                        
                        if (error) throw error;
                        
                        // Aggiorna lo stato locale
                        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                      } catch (error) {
                        console.error('Errore nel segnare tutte come lette:', error);
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