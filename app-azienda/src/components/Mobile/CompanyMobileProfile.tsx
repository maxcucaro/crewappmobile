import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, LogOut, Wifi, Building2 } from 'lucide-react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { CopyrightFooter } from '../UI/CopyrightFooter';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../utils/supabase';

const MobileProfile: React.FC = () => {
  const { user, signOut: logout } = useCompanyAuth();
  const notificationPermission = 'default';
  const { showSuccess, showError, showWarning } = useToastContext();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadUserProfile();
    }
  }, [user?.id]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);

      const { data: companyData, error: companyError } = await supabase
        .from('regaziendasoftware')
        .select('*')
        .eq('auth_user_id', user?.id)
        .single();

      if (companyError) {
        console.error('Errore nel caricamento profilo aziendale:', companyError);
        return;
      }

      setUserProfile(companyData);

    } catch (error) {
      console.error('Errore nel caricamento profilo aziendale:', error);
    } finally {
      setLoading(false);
    }
  };

  const appSettings = [
    {
      id: 'notifications',
      label: 'Notifiche Push',
      description: 'Ricevi notifiche per turni e aggiornamenti',
      value: notifications,
      onChange: setNotifications
    },
    {
      id: 'autoSync',
      label: 'Sincronizzazione Automatica',
      description: 'Sincronizza dati quando connesso',
      value: autoSync,
      onChange: setAutoSync
    },
    {
      id: 'offlineMode',
      label: 'Modalità Offline',
      description: 'Salva dati localmente quando offline',
      value: offlineMode,
      onChange: setOfflineMode
    }
  ];

  const handleLogout = async () => {
    try {
      showWarning('Logout in corso...');
      await logout();
      showSuccess('Logout effettuato con successo!');
      window.location.href = '/';
    } catch (error) {
      console.error('Errore durante il logout:', error);
      showSuccess('Sessione terminata localmente');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Caricamento profilo...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-lg">Errore nel caricamento del profilo</p>
          <button
            onClick={() => loadUserProfile()}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  const companyName = userProfile.ragione_sociale || 'Azienda';

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="p-4 pb-20 space-y-6">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {companyName}
              </h2>
              <p className="text-blue-100">
                {userProfile.citta || 'Italia'}
              </p>
              <p className="text-sm text-blue-200">
                {userProfile.partita_iva ? `P.IVA: ${userProfile.partita_iva}` : 'Azienda'}
              </p>
            </div>
          </div>
        </div>

        {/* Company Information */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Informazioni Aziendali</h3>

          <div className="space-y-4">
            {userProfile.email && (
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-white font-medium">{userProfile.email}</p>
                  <p className="text-xs text-gray-400">Email aziendale</p>
                </div>
              </div>
            )}

            {userProfile.telefono && (
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-white font-medium">{userProfile.telefono}</p>
                  <p className="text-xs text-gray-400">Telefono aziendale</p>
                </div>
              </div>
            )}

            {userProfile.partita_iva && (
              <div className="flex items-center space-x-3">
                <Building2 className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-white font-medium">{userProfile.partita_iva}</p>
                  <p className="text-xs text-gray-400">Partita IVA</p>
                </div>
              </div>
            )}

            {userProfile.codice_fiscale && (
              <div className="flex items-center space-x-3">
                <Building2 className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-white font-medium">{userProfile.codice_fiscale}</p>
                  <p className="text-xs text-gray-400">Codice Fiscale</p>
                </div>
              </div>
            )}

            {userProfile.indirizzo && (
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-white font-medium">
                    {userProfile.indirizzo}
                    {userProfile.cap && `, ${userProfile.cap}`}
                    {userProfile.citta && ` - ${userProfile.citta}`}
                    {userProfile.provincia && ` (${userProfile.provincia})`}
                  </p>
                  <p className="text-xs text-gray-400">Indirizzo completo</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* App Settings */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Impostazioni App</h3>
          
          <div className="space-y-4">
            {/* Notification Settings Button */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-white font-medium">Notifiche Push</p>
                  <p className="text-sm text-gray-400">
                    {notificationPermission === 'granted' ? 'Abilitate' :
                     notificationPermission === 'denied' ? 'Bloccate' : 'Non configurate'}
                  </p>
                </div>
                <button
                  onClick={() => setShowNotificationSettings(!showNotificationSettings)}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm"
                >
                  Gestisci
                </button>
              </div>

              {/* Warning se bloccate */}
              {notificationPermission === 'denied' && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
                  <p className="text-red-400 text-sm font-medium mb-2">Notifiche Bloccate dal Browser</p>
                  <p className="text-red-300 text-xs mb-3">
                    Le notifiche sono state bloccate. Per ricevere aggiornamenti importanti su turni, note spese e straordinari, devi sbloccarle manualmente.
                  </p>
                  <div className="bg-red-950/50 rounded p-2 text-xs text-red-200 space-y-1">
                    <p className="font-medium">Come sbloccare:</p>
                    <p>1. Tocca l'icona del lucchetto nella barra del browser</p>
                    <p>2. Trova "Notifiche" nelle impostazioni</p>
                    <p>3. Cambia da "Bloccato" a "Consenti"</p>
                    <p>4. Ricarica la pagina</p>
                  </div>
                </div>
              )}

              {/* Info se abilitate */}
              {notificationPermission === 'granted' && (
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                  <p className="text-green-400 text-sm font-medium mb-2">Notifiche Attive</p>
                  <p className="text-green-300 text-xs">
                    Riceverai notifiche per:
                  </p>
                  <ul className="text-green-200 text-xs mt-2 space-y-1 ml-4">
                    <li>• Nuovi turni assegnati</li>
                    <li>• Modifiche ai turni</li>
                    <li>• Approvazione note spese</li>
                    <li>• Richieste straordinari</li>
                    <li>• Messaggi importanti</li>
                  </ul>
                </div>
              )}

              {/* Guida se non configurate */}
              {notificationPermission === 'default' && (
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                  <p className="text-yellow-400 text-sm font-medium mb-2">Configura le Notifiche</p>
                  <p className="text-yellow-300 text-xs mb-2">
                    Clicca su "Gestisci" per attivare le notifiche e rimanere aggiornato su turni e approvazioni.
                  </p>
                </div>
              )}
            </div>

            {appSettings.map((setting) => (
              <div key={setting.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-white font-medium">{setting.label}</p>
                  <p className="text-sm text-gray-400">{setting.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setting.value}
                    onChange={(e) => setting.onChange(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Notification Settings - Disabled for company app */}

        {/* App Info */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Informazioni App</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Versione</span>
              <span className="text-white font-medium">1.0.8</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Ultimo Aggiornamento</span>
              <span className="text-white font-medium">Gennaio 2025</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Modalità</span>
              <span className="text-blue-400 font-medium">Mobile</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Connessione</span>
              <div className="flex items-center space-x-1">
                <Wifi className="h-4 w-4 text-green-400" />
                <span className="text-green-400 font-medium">Online</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Tipo Utente</span>
              <span className="text-blue-400 font-medium">Azienda</span>
            </div>
          </div>
        </div>

        {/* Account Status */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Stato Account</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Stato</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                userProfile.attivo ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
              }`}>
                {userProfile.attivo ? 'Attivo' : 'Disattivato'}
              </span>
            </div>
            {userProfile.created_at && (
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Registrazione</span>
                <span className="text-white font-medium">
                  {new Date(userProfile.created_at).toLocaleDateString('it-IT')}
                </span>
              </div>
            )}
            {userProfile.ultimo_accesso && (
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Ultimo Accesso</span>
                <span className="text-white font-medium">
                  {new Date(userProfile.ultimo_accesso).toLocaleDateString('it-IT')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Logout Button */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 text-white py-4 px-4 rounded-xl hover:bg-red-700 font-bold text-lg shadow-lg flex items-center justify-center space-x-3"
          >
            <LogOut className="h-6 w-6" />
            <span>ESCI DALL'APP</span>
          </button>
        </div>

        {/* Copyright */}
        <CopyrightFooter />
      </div>
    </div>
  );
};

export default MobileProfile;