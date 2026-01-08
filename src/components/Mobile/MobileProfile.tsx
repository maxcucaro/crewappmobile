import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Settings, LogOut, Smartphone, Wifi, Battery, Bell, Building2, Gift, Euro, Utensils, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CopyrightFooter } from '../UI/CopyrightFooter';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useToastContext } from '../../context/ToastContext';
import NotificationManager from '../UI/NotificationManager';
import { supabase } from '../../lib/db';

interface EmployeeBenefit {
  id: string;
  nome_tariffa: string;
  categoria: string;
  tipo_calcolo: string;
  importo: number;
  descrizione?: string;
  attivo: boolean;
}

const MobileProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const { permission: notificationPermission } = usePushNotifications();
  const { showSuccess, showError, showWarning } = useToastContext();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [employeeBenefits, setEmployeeBenefits] = useState<EmployeeBenefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [benefitsLoading, setBenefitsLoading] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadUserProfile();
      loadEmployeeBenefits();
    }
  }, [user?.id]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      
      const { data: userData, error: userError } = await supabase
        .from('registration_requests')
        .select(`
          *,
          regaziendasoftware!parent_company_id(
            id,
            ragione_sociale,
            email,
            telefono,
            indirizzo
          )
        `)
        .eq('auth_user_id', user?.id)
        .single();

      if (userError) {
        console.error('Errore nel caricamento profilo:', userError);
        return;
      }

      setUserProfile(userData);
      
    } catch (error) {
      console.error('Errore nel caricamento profilo utente:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeBenefits = async () => {
    try {
      setBenefitsLoading(true);

      console.log('🎁 Caricamento benefit dipendente per user:', user?.id);

      // 1. Carica le assegnazioni tariffe del dipendente
      const { data: employeeRatesData, error: ratesError } = await supabase
        .from('crew_assegnazionetariffa')
        .select('tariffe_ids, tariffe_personalizzate')
        .eq('dipendente_id', user?.id)
        .eq('attivo', true);

      if (ratesError) {
        console.error('❌ Errore caricamento assegnazioni tariffe:', ratesError);
        setEmployeeBenefits([]);
        return;
      }

      console.log('📋 Assegnazioni tariffe trovate:', employeeRatesData?.length || 0);

      // 2. Raccogli tutti gli ID delle tariffe e le tariffe personalizzate
      const allTariffeIds: string[] = [];
      let tariffePersonalizzateMap: Record<string, number> = {};

      employeeRatesData?.forEach(assignment => {
        if (assignment.tariffe_ids && assignment.tariffe_ids.length > 0) {
          allTariffeIds.push(...assignment.tariffe_ids);
        }

        // Carica le tariffe personalizzate
        if (assignment.tariffe_personalizzate) {
          tariffePersonalizzateMap = { ...tariffePersonalizzateMap, ...assignment.tariffe_personalizzate };
        }
      });

      console.log('🔍 ID tariffe da caricare:', allTariffeIds);
      console.log('💰 Tariffe personalizzate:', tariffePersonalizzateMap);

      // 3. Carica i dettagli delle tariffe
      if (allTariffeIds.length > 0) {
        const uniqueTariffeIds = [...new Set(allTariffeIds)];

        const { data: tariffeData, error: tariffeError } = await supabase
          .from('crew_tariffe')
          .select('*')
          .in('id', uniqueTariffeIds)
          .eq('attivo', true)
          .order('categoria', { ascending: true });

        if (tariffeError) {
          console.error('❌ Errore caricamento dettagli tariffe:', tariffeError);
          setEmployeeBenefits([]);
          return;
        }

        console.log('✅ Benefit caricati:', tariffeData?.length || 0);

        const mappedBenefits: EmployeeBenefit[] = (tariffeData || []).map(tariffa => {
          // Usa la tariffa personalizzata se esiste, altrimenti usa l'importo standard
          const importoPersonalizzato = tariffePersonalizzateMap[tariffa.id];
          const importoFinale = importoPersonalizzato !== undefined ? importoPersonalizzato : tariffa.importo;

          console.log(`💵 Benefit "${tariffa.nome_tariffa}": personalizzato=${importoPersonalizzato}, standard=${tariffa.importo}, finale=${importoFinale}`);

          return {
            id: tariffa.id,
            nome_tariffa: tariffa.nome_tariffa,
            categoria: tariffa.categoria,
            tipo_calcolo: tariffa.tipo_calcolo,
            importo: importoFinale,
            descrizione: tariffa.descrizione,
            attivo: tariffa.attivo
          };
        });

        setEmployeeBenefits(mappedBenefits);
      } else {
        console.log('⚠️ Nessuna tariffa assegnata al dipendente');
        setEmployeeBenefits([]);
      }
      
      // 4. Carica benefit pasti dalla tabella employee_meal_benefits
      await loadMealBenefits();
      
    } catch (error) {
      console.error('❌ Errore generale caricamento benefit:', error);
      setEmployeeBenefits([]);
    } finally {
      setBenefitsLoading(false);
    }
  };

  const [mealBenefits, setMealBenefits] = useState<any>(null);

  const loadMealBenefits = async () => {
    try {
      console.log('🍽️ Caricamento benefit pasti per dipendente:', user?.id);
      
      const { data: mealBenefitsData, error: mealError } = await supabase
        .from('employee_meal_benefits')
        .select('*')
        .eq('dipendente_id', user?.id)
        .eq('attivo', true)
        .maybeSingle();

      if (mealError) {
        console.error('❌ Errore caricamento benefit pasti:', mealError);
        setMealBenefits(null);
        return;
      }

      if (mealBenefitsData) {
        console.log('✅ Benefit pasti caricati:', mealBenefitsData);
        setMealBenefits(mealBenefitsData);
      } else {
        console.log('⚠️ Nessun benefit pasti configurato per questo dipendente');
        setMealBenefits(null);
      }
      
    } catch (error) {
      console.error('❌ Errore generale caricamento benefit pasti:', error);
      setMealBenefits(null);
    }
  };
  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      'indennita_trasferta': 'Indennità Trasferta',
      'bonus_responsabile': 'Bonus Responsabile',
      'bonus_autista': 'Bonus Autista',
      'straordinario_festivo': 'Straordinario Festivo',
      'straordinario_notturno': 'Straordinario Notturno',
      'straordinario_trasferta': 'Straordinario Trasferta',
      'rimborso_chilometrico': 'Rimborso Chilometrico',
      'stipendio_base': 'Stipendio Base',
      'bonus_guida_automezzo': 'Bonus Guida Automezzo',
      'indennita_reperibilita': 'Indennità Reperibilità',
      'altro': 'Altro'
    };
    return labels[category] || category;
  };

  const getCategoryIcon = (category: string) => {
    return '';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'indennita_trasferta': return 'from-purple-500 to-pink-500';
      case 'bonus_responsabile': return 'from-yellow-500 to-orange-500';
      case 'bonus_autista': return 'from-blue-500 to-cyan-500';
      case 'straordinario_festivo': return 'from-red-500 to-pink-500';
      case 'straordinario_notturno': return 'from-indigo-500 to-purple-500';
      case 'straordinario_trasferta': return 'from-green-500 to-emerald-500';
      case 'rimborso_chilometrico': return 'from-gray-500 to-gray-600';
      case 'stipendio_base': return 'from-emerald-500 to-green-500';
      case 'bonus_guida_automezzo': return 'from-orange-500 to-red-500';
      case 'indennita_reperibilita': return 'from-cyan-500 to-blue-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  // Verifica se ha benefit specifici per pasti
  const hasMealVoucherBenefit = mealBenefits?.buoni_pasto_enabled || false;
  const hasCompanyMealBenefit = mealBenefits?.pasto_aziendale_enabled || false;

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

  // Estrai nome e cognome
  const fullName = userProfile.full_name || userProfile.company_name || '';
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || 'Nome';
  const lastName = nameParts.slice(1).join(' ') || 'Cognome';

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="p-4 pb-20 space-y-6">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {firstName} {lastName}
              </h2>
              <p className="text-blue-100">
                {userProfile.regaziendasoftware?.ragione_sociale || 'Azienda'}
              </p>
              <p className="text-sm text-blue-200">Dipendente</p>
            </div>
          </div>
        </div>

        {/* Employee Benefits */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Gift className="h-5 w-5 text-purple-400" />
            <span>I Miei Benefit Contrattuali</span>
          </h3>
          
          {benefitsLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-2"></div>
              <p className="text-gray-300">Caricamento benefit...</p>
            </div>
          ) : employeeBenefits.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <Gift className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <p>Nessun benefit assegnato</p>
              <p className="text-sm mt-1">Contatta l'azienda per informazioni sui benefit</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Meal Benefits Highlight */}
              <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-lg p-4 mb-4">
                <h4 className="font-bold text-white mb-2 flex items-center space-x-2">
                  <Utensils className="h-5 w-5" />
                  <span>Benefit Pasti</span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg ${hasMealVoucherBenefit ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'}`}>
                    <div className="flex items-center space-x-2">
                      {hasMealVoucherBenefit ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : (
                        <X className="h-4 w-4 text-red-400" />
                      )}
                      <span className="text-white text-sm font-medium">Buoni Pasto</span>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">
                      {hasMealVoucherBenefit ? `€${mealBenefits?.buoni_pasto_value || '7.50'} per turno` : 'Non incluso'}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-blue-900 border border-blue-700">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-blue-400" />
                      <span className="text-white text-sm font-medium">Pasto Aziendale</span>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">
                      Costo: €{mealBenefits?.pasto_aziendale_cost || '12.00'}
                    </p>
                  </div>
                </div>
                
                {/* Diarie Benefits */}
                {mealBenefits && (mealBenefits.diaria_eventi_enabled || mealBenefits.diaria_trasferta_enabled) && (
                  <div className="mt-3 pt-3 border-t border-orange-500">
                    <h5 className="text-white font-medium mb-2">Diarie</h5>
                    <div className="grid grid-cols-2 gap-3">
                      {mealBenefits.diaria_eventi_enabled && (
                        <div className="p-2 rounded bg-green-900 border border-green-700">
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3 text-green-400" />
                            <span className="text-white text-xs font-medium">Diaria Eventi</span>
                          </div>
                          <p className="text-xs text-green-300">€{mealBenefits.diaria_eventi_value || '25.00'}</p>
                        </div>
                      )}
                      
                      {mealBenefits.diaria_trasferta_enabled && (
                        <div className="p-2 rounded bg-green-900 border border-green-700">
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3 text-green-400" />
                            <span className="text-white text-xs font-medium">Diaria Trasferta</span>
                          </div>
                          <p className="text-xs text-green-300">€{mealBenefits.diaria_trasferta_value || '35.00'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* All Benefits List */}
              <div className="space-y-2">
                {employeeBenefits.map((benefit) => (
                  <div key={benefit.id} className="bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h4 className="font-medium text-white">{benefit.nome_tariffa}</h4>
                          <p className="text-xs text-gray-400">{getCategoryLabel(benefit.categoria)}</p>
                          {benefit.descrizione && (
                            <p className="text-xs text-gray-300 mt-1">{benefit.descrizione}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-400">
                          {benefit.tipo_calcolo === 'percentuale' ? `${benefit.importo}%` : `€${benefit.importo}`}
                        </div>
                        <div className="text-xs text-gray-400">
                          {benefit.tipo_calcolo === 'orario' ? '/ora' :
                           benefit.tipo_calcolo === 'giornaliero' ? '/giorno' :
                           benefit.tipo_calcolo === 'fisso' ? 'fisso' :
                           benefit.tipo_calcolo === 'percentuale' ? 'percentuale' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="bg-blue-900 border border-blue-700 rounded-lg p-3 mt-4">
                <div className="flex items-center space-x-2">
                  <Gift className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-200 text-sm">
                    <strong>Totale benefit attivi:</strong> {employeeBenefits.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contact Information */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Informazioni Contatto</h3>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-white font-medium">{userProfile.email}</p>
                <p className="text-xs text-gray-400">Email aziendale</p>
              </div>
            </div>
            
            {userProfile.phone && (
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-white font-medium">{userProfile.phone}</p>
                  <p className="text-xs text-gray-400">Telefono personale</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Company Information */}
        {userProfile.regaziendasoftware && (
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">La Mia Azienda</h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Building2 className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-white font-medium">{userProfile.regaziendasoftware.ragione_sociale}</p>
                  <p className="text-xs text-gray-400">Ragione sociale</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-white font-medium">{userProfile.regaziendasoftware.email}</p>
                  <p className="text-xs text-gray-400">Email aziendale</p>
                </div>
              </div>
              
              {userProfile.regaziendasoftware.telefono && (
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-white font-medium">{userProfile.regaziendasoftware.telefono}</p>
                    <p className="text-xs text-gray-400">Telefono aziendale</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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

        {/* Notification Settings */}
        {showNotificationSettings && (
          <NotificationManager />
        )}

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
              <span className="text-purple-400 font-medium">Dipendente</span>
            </div>
          </div>
        </div>

        {/* Employment Info */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Informazioni Lavorative</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">ID Dipendente</span>
              <span className="text-white font-medium">{userProfile.id.slice(0, 8)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Data Registrazione</span>
              <span className="text-white font-medium">
                {new Date(userProfile.created_at).toLocaleDateString('it-IT')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Status</span>
              <span className={`text-sm px-2 py-1 rounded-full ${
                userProfile.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {userProfile.status === 'approved' ? 'Approvato' : 'In Attesa'}
              </span>
            </div>
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