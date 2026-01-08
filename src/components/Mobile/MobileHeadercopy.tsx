import React from 'react';
import { Smartphone, LogOut, Upload, RefreshCw, Download, Bell, X, Clock, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useToastContext } from '../../context/ToastContext';
import VersionIndicator from '../UI/VersionIndicator';
import { supabase } from '../../lib/db';

interface NotificationsDropdownProps {
  userId: string;
  onClose: () => void;
}

const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ userId, onClose }) => {
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadNotifications = async () => {
      const { data, error } = await supabase
        .from('notifiche')
        .select('*')
        .eq('id_utente', userId)
        .neq('stato', 'eliminata')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setNotifications(data);
      }
      setLoading(false);
    };

    loadNotifications();
  }, [userId]);

  const markAsRead = async (notifId: string) => {
    await supabase.rpc('mark_notification_read', {
      p_notifica_id: notifId,
      p_user_id: userId
    });
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, stato: 'letta' } : n));
  };

  const deleteNotification = async (notifId: string) => {
    await supabase.rpc('delete_notification', {
      p_notifica_id: notifId,
      p_user_id: userId
    });
    setNotifications(prev => prev.filter(n => n.id !== notifId));
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ora';
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours}h fa`;
    if (diffDays < 7) return `${diffDays}g fa`;
    return date.toLocaleDateString('it-IT');
  };

  return (
    <div className="absolute top-full right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-gray-800 rounded-lg shadow-2xl border border-gray-700 z-50">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Notifiche</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            Caricamento...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Nessuna notifica
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`p-4 hover:bg-gray-750 transition-colors ${
                  notif.stato === 'non_letta' ? 'bg-gray-750' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className={`font-semibold ${
                      notif.stato === 'non_letta' ? 'text-cyan-400' : 'text-white'
                    }`}>
                      {notif.titolo}
                    </h4>
                    <p className="text-sm text-gray-300 mt-1">{notif.messaggio}</p>
                    <div className="flex items-center space-x-2 mt-2 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(notif.created_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteNotification(notif.id)}
                    className="text-gray-500 hover:text-red-400 ml-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {notif.stato === 'non_letta' && (
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Segna come letta
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface MobileHeaderProps {
  currentVersion: string | null;
  hasUpdate: boolean;
  isVersionLoading: boolean;
  isUpdating: boolean;
  onCheckUpdate: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentVersion,
  hasUpdate,
  isVersionLoading,
  isUpdating,
  onCheckUpdate
}) => {
  const { user, logout } = useAuth();
  const { isOnline, pendingSync, isSyncing, syncPendingData } = useOfflineSync();
  const { showSuccess, showError, showWarning } = useToastContext();
  const [isOnlineState, setIsOnlineState] = React.useState(navigator.onLine);
  const [batteryLevel, setBatteryLevel] = React.useState<number | null>(null);
  const [showInstallButton, setShowInstallButton] = React.useState(false);
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const [showNotifications, setShowNotifications] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => setIsOnlineState(true);
    const handleOffline = () => setIsOnlineState(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Controlla se il prompt di installazione è disponibile
    const checkInstallPrompt = () => {
      const prompt = (window as any).deferredPrompt;
      if (prompt) {
        setShowInstallButton(true);
      }
    };

    checkInstallPrompt();
    const interval = setInterval(checkInstallPrompt, 2000);

    const handlePromptAvailable = () => {
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handlePromptAvailable);

    // Battery API (se supportata)
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handlePromptAvailable);
      clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (!user?.id) return;

    const loadUnreadCount = async () => {
      const { count, error } = await supabase
        .from('notifiche')
        .select('*', { count: 'exact', head: true })
        .eq('id_utente', user.id)
        .eq('stato', 'non_letta');

      if (!error && count !== null) {
        setUnreadNotifications(count);
      }
    };

    loadUnreadCount();

    const channel = supabase
      .channel(`notifiche-count-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifiche',
          filter: `id_utente=eq.${user.id}`
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleInstallApp = async () => {
    const prompt = (window as any).deferredPrompt;
    if (!prompt) {
      console.log('❌ Prompt installazione non disponibile');
      return;
    }

    console.log('📱 Avvio installazione...');
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installata con successo');
      setShowInstallButton(false);
    }
    
    (window as any).deferredPrompt = null;
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700 p-4 shadow-lg">
      <div className="flex items-center justify-between">
        {/* App Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              CREW MOBILE <span className="text-cyan-400 italic font-extrabold tracking-wider transform -skew-x-12 inline-block text-base">APP</span>
            </h1>
            <p className="text-xs text-gray-300">{user?.displayName || user?.email}</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center space-x-3">
            {/* Version Indicator */}
            <VersionIndicator
              currentVersion={currentVersion}
              hasUpdate={hasUpdate}
              isLoading={isVersionLoading}
              isUpdating={isUpdating}
              onCheckUpdate={onCheckUpdate}
            />

          {/* Sync Status */}
          {pendingSync > 0 && (
            <button
              onClick={syncPendingData}
              disabled={!isOnline || isSyncing}
              className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs ${
                isSyncing 
                  ? 'bg-blue-600 text-white' 
                  : isOnline 
                    ? 'bg-orange-600 text-white hover:bg-orange-700' 
                    : 'bg-gray-600 text-gray-300'
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              <span>{pendingSync}</span>
            </button>
          )}

          {/* Install App Button */}
          {showInstallButton && (
            <button
              onClick={handleInstallApp}
              className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 flex items-center space-x-1"
              title="Installa App"
            >
              <Download className="h-4 w-4" />
            </button>
          )}

          {/* Notifications Bell */}
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-3 text-gray-400 hover:text-cyan-400 hover:bg-gray-700 rounded-lg transition-colors active:scale-95 touch-manipulation"
            title="Notifiche"
            type="button"
          >
            <Bell className="h-6 w-6" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                showWarning('Logout in corso...');
                await logout();
                showSuccess('Logout effettuato con successo!');
                window.location.href = '/';
              } catch (error) {
                console.error('Errore durante il logout:', error);
                showError('Errore durante il logout. Riprova.');
              }
            }}
            className="p-3 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors active:scale-95 touch-manipulation"
            title="Logout"
            type="button"
          >
            <LogOut className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Connection Status Bar */}
      {!isOnline && (
        <div className="mt-2 bg-red-600 text-white text-center py-2 rounded-lg">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-sm font-medium">
              Modalità Offline - Dati salvati localmente
              {pendingSync > 0 && ` (${pendingSync} in attesa)`}
            </span>
          </div>
        </div>
      )}

      {/* Notifications Dropdown */}
      {showNotifications && (
        <NotificationsDropdown
          userId={user?.id || ''}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </header>
  );
};

export default MobileHeader;