import React, { useState, useEffect } from 'react';
import { MapPin, Clock, CheckCircle, AlertCircle, X, Calendar as CalendarIcon, DollarSign, Plane, Gift, RefreshCw, Navigation, Building2, FileText } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToastContext } from '../../../context/ToastContext';
import { useGPSLocation } from '../../../hooks/useGPSLocation';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import { usePersistentTimer } from '../../../hooks/usePersistentTimer';
import { supabase } from '../../../lib/db';

interface EventAssignment {
  id: string;
  evento_id: string;
  nome_evento: string;
  nome_azienda: string;
  giorno_inizio_evento: string;
  giorno_fine_evento: string;
  evento_localita: string;
  evento_indirizzo?: string;
  evento_orario_convocazione?: string;
  evento_descrizione?: string;
  tariffa_evento_assegnata?: number;
  bonus_previsti: number;
  evento_trasferta: boolean;
  bonus_trasferta: boolean;
  bonus_diaria: boolean;
  benefits_evento_ids: string[];
  benefits_evento_nomi: string[];
  benefits_disponibili: any;
  link_scheda_tecnica?: string;
  link_mappa_gps?: string;
  checkin?: {
    id: string;
    start_time: string;
    end_time?: string;
    status: string;
  };
}

interface EmployeeBenefits {
  buoni_pasto_enabled: boolean;
  buoni_pasto_value: number;
  diaria_eventi_enabled: boolean;
  diaria_eventi_value: number;
  diaria_trasferta_enabled: boolean;
  diaria_trasferta_value: number;
  pasto_aziendale_cost: number;
}

const EventCheckIn: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useToastContext();
  const { currentLocation, getCurrentLocation, isLoading: gpsLoading, error: gpsError } = useGPSLocation();
  const { isOnline, addOfflineData } = useOfflineSync();
  const { currentSession, activeSessions, elapsedTime, elapsedTimes, startSession, endSession, manualCheckOut, loadActiveSession } = usePersistentTimer();

  // Stati principali
  const [todayEvents, setTodayEvents] = useState<EventAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForceCheckInModal, setShowForceCheckInModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventAssignment | null>(null);
  const [employeeBenefits, setEmployeeBenefits] = useState<EmployeeBenefits | null>(null);
  const [eventBenefitsMap, setEventBenefitsMap] = useState<Record<string, {name: string, value: number, category: string}>>({});
  const [eventNotes, setEventNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user?.id) {
      loadTodayEvents();
      loadEmployeeBenefits();
    }
  }, [user?.id]);

  const loadEmployeeBenefits = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_meal_benefits')
        .select('*')
        .eq('dipendente_id', user?.id)
        .eq('attivo', true)
        .maybeSingle();

      if (error) {
        console.error('❌ Errore caricamento benefit dipendente:', error);
      } else if (data) {
        setEmployeeBenefits(data);
      }
    } catch (error) {
      console.error('❌ Errore generale caricamento benefit:', error);
    }
  };

  const getEventActiveBenefits = (eventAssignment: EventAssignment): Array<{name: string, value: number}> => {
    if (!employeeBenefits) return [];

    const benefits: Array<{name: string, value: number}> = [];

    // Diaria eventi (se attiva nell'evento)
    if (eventAssignment.bonus_diaria && employeeBenefits.diaria_eventi_enabled && employeeBenefits.diaria_eventi_value > 0) {
      benefits.push({
        name: 'Diaria Eventi',
        value: employeeBenefits.diaria_eventi_value
      });
    }

    // Diaria trasferta (se attiva nell'evento)
    if (eventAssignment.bonus_trasferta && employeeBenefits.diaria_trasferta_enabled && employeeBenefits.diaria_trasferta_value > 0) {
      benefits.push({
        name: 'Diaria Trasferta',
        value: employeeBenefits.diaria_trasferta_value
      });
    }

    // Aggiungi i benefit personalizzati dell'evento
    if (eventAssignment.benefits_evento_ids && eventAssignment.benefits_evento_ids.length > 0) {
      eventAssignment.benefits_evento_ids.forEach(benefitId => {
        const benefit = eventBenefitsMap[benefitId];
        if (benefit) {
          benefits.push({
            name: benefit.name,
            value: benefit.value
          });
        }
      });
    }

    return benefits;
  };

  const loadTodayEvents = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;

      console.log('📅 Caricamento eventi di oggi e futuri:', today);

      // Carica eventi assegnati con i benefit personalizzati
      const { data: eventAssignments, error: eventError } = await supabase
        .from('crew_event_assegnazione')
        .select(`
          *,
          event_benefits:benefits_evento_ids
        `)
        .eq('dipendente_freelance_id', user?.id)
        .gte('giorno_inizio_evento', today)
        .order('giorno_inizio_evento', { ascending: true })
        .order('evento_orario_convocazione', { ascending: true });

      if (eventError) {
        console.error('❌ Errore caricamento eventi:', eventError);
        setTodayEvents([]);
        setLoading(false);
        return;
      }

      // Carica check-in già effettuati di oggi
      const { data: checkins, error: checkinError } = await supabase
        .from('timesheet_entries')
        .select('id, event_id, start_time, end_time, status')
        .eq('crew_id', user?.id)
        .eq('date', today);

      if (checkinError) {
        console.error('❌ Errore caricamento check-in:', checkinError);
      }

      // Raccogli tutti gli ID dei benefit da caricare
      const allBenefitIds = (eventAssignments || [])
        .flatMap(event => event.benefits_evento_ids || [])
        .filter((id, index, self) => id && self.indexOf(id) === index); // rimuovi duplicati

      // Carica i benefit dalla tabella crew_tariffe
      let benefitsData: Record<string, {name: string, value: number, category: string}> = {};
      if (allBenefitIds.length > 0) {
        const { data: benefitsFromDB, error: benefitsError } = await supabase
          .from('crew_tariffe')
          .select('id, nome_tariffa, importo, categoria')
          .in('id', allBenefitIds);

        if (!benefitsError && benefitsFromDB) {
          benefitsData = benefitsFromDB.reduce((acc, benefit) => {
            acc[benefit.id] = {
              name: benefit.nome_tariffa,
              value: parseFloat(benefit.importo),
              category: benefit.categoria
            };
            return acc;
          }, {} as Record<string, {name: string, value: number, category: string}>);

          setEventBenefitsMap(benefitsData);
          console.log('✅ Benefit caricati:', Object.keys(benefitsData).length);
        }
      }

      // Merge eventi con check-in
      const eventsWithCheckins = (eventAssignments || []).map(event => {
        const checkin = checkins?.find(c => c.event_id === event.evento_id);
        return {
          ...event,
          checkin: checkin || undefined
        };
      });

      console.log('✅ Eventi trovati:', eventsWithCheckins.length);
      setTodayEvents(eventsWithCheckins);

    } catch (error) {
      console.error('❌ Errore generale caricamento eventi:', error);
      setTodayEvents([]);
    } finally {
      setLoading(false);
    }
  };


  async function handleEventCheckIn(eventAssignment: EventAssignment, forceCheckin: boolean = false) {
    try {
      let location = currentLocation;
      let forcedCheckIn = false;
      let gpsErrorReason = null;

      if (!location && !forceCheckin) {
        setSelectedEvent(eventAssignment);
        setShowForceCheckInModal(true);
        return;
      }

      if (!location && forceCheckin) {
        forcedCheckIn = true;
        gpsErrorReason = gpsError || 'GPS non disponibile - Check-in forzato dall\'utente';
        console.warn('⚠️ Check-in forzato senza GPS:', gpsErrorReason);
      }

      const now = new Date();

      // Determina il tipo di diaria attiva
      let diariaType = 'nessuna';
      let diariaAmount = 0;

      if (employeeBenefits) {
        if (eventAssignment.bonus_trasferta && employeeBenefits.diaria_trasferta_enabled) {
          diariaType = 'trasferta';
          diariaAmount = employeeBenefits.diaria_trasferta_value;
        } else if (eventAssignment.bonus_diaria && employeeBenefits.diaria_eventi_enabled) {
          diariaType = 'evento';
          diariaAmount = employeeBenefits.diaria_eventi_value;
        }
      }

      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayDate = `${year}-${month}-${day}`;

      const userNotes = eventNotes[eventAssignment.id]?.trim() || null;
      let finalNotes = userNotes;
      if (forcedCheckIn) {
        finalNotes = userNotes
          ? `${userNotes}\n\n[Check-in forzato: ${gpsErrorReason}]`
          : `Check-in forzato: ${gpsErrorReason}`;
      }

      const checkInData = {
        crew_id: user?.id,
        event_id: eventAssignment.evento_id,
        date: todayDate,
        start_time: now.toTimeString().split(' ')[0],
        tracking_type: eventAssignment.evento_trasferta ? 'days' : 'hours',
        retention_percentage: 0,
        gross_amount: eventAssignment.tariffa_evento_assegnata || 0,
        net_amount: eventAssignment.tariffa_evento_assegnata || 0,
        hourly_rate: eventAssignment.evento_trasferta ? null : eventAssignment.tariffa_evento_assegnata,
        daily_rate: eventAssignment.evento_trasferta ? eventAssignment.tariffa_evento_assegnata : null,
        gps_location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          address: location.address,
          timestamp: location.timestamp,
          forced: forcedCheckIn,
          error_reason: gpsErrorReason
        } : null,
        diaria_type: diariaType,
        diaria_amount: diariaAmount,
        meal_voucher: employeeBenefits?.buoni_pasto_enabled || false,
        status: 'submitted',
        notes: finalNotes
      };

      if (isOnline) {
        const { error } = await supabase.from('timesheet_entries').insert([checkInData]);

        if (error) {
          console.error('❌ Errore check-in evento:', error);
          showError(`Errore durante il check-in: ${error.message}`);
          return;
        }
      } else {
        addOfflineData('event_checkin', checkInData);
        showWarning('Check-in salvato offline - verrà sincronizzato quando tornerai online');
      }

      if (forcedCheckIn) {
        showWarning('Check-in forzato completato (senza GPS)');
      } else {
        showSuccess(`Check-in completato per ${eventAssignment.nome_evento}`);
      }

      setShowForceCheckInModal(false);
      setSelectedEvent(null);

      // Ricarica eventi e sessioni attive per mostrare il timer immediatamente
      await loadTodayEvents();
      await loadActiveSession();

    } catch (error) {
      console.error('❌ Errore durante check-in evento:', error);
      showError('Errore imprevisto durante il check-in');
    }
  }

  async function handleEventCheckOut(eventAssignment: EventAssignment) {
    if (!eventAssignment.checkin) {
      showError('Nessun check-in trovato per questo evento');
      return;
    }

    try {
      // Per gli eventi, il check-out è solo una registrazione di presenza
      // Impostiamo sempre l'orario di fine a 23:59 (ora italiana)
      const endTime = '23:59:00';

      const updateData = {
        end_time: endTime,
        status: 'submitted'
      };

      if (isOnline) {
        const { error } = await supabase
          .from('timesheet_entries')
          .update(updateData)
          .eq('id', eventAssignment.checkin.id);

        if (error) {
          console.error('❌ Errore check-out evento:', error);
          showError(`Errore durante il check-out: ${error.message}`);
          return;
        }
      } else {
        addOfflineData('event_checkout', {
          id: eventAssignment.checkin.id,
          ...updateData
        });
        showWarning('Check-out salvato offline - verrà sincronizzato quando tornerai online');
      }

      // Termina la sessione del timer se esiste
      const activeEventSession = activeSessions.find(s => s.id === eventAssignment.checkin?.id);
      if (activeEventSession) {
        endSession(activeEventSession.id);
      }

      showSuccess(`Presenza confermata per ${eventAssignment.nome_evento}`);

      // Ricarica eventi per aggiornare la lista
      await loadTodayEvents();

    } catch (error) {
      console.error('❌ Errore durante check-out evento:', error);
      showError('Errore imprevisto durante il check-out');
    }
  }

  const formatTime = (timeString: string | null): string => {
    if (!timeString) return '09:00';
    
    if (/^\d{2}:\d{2}$/.test(timeString)) {
      return timeString;
    }
    
    if (/^\d{2}:\d{2}:\d{2}$/.test(timeString)) {
      return timeString.substring(0, 5);
    }
    
    return '09:00';
  };

  const getEventTypeIcon = (assignment: EventAssignment) => {
    if (assignment.nome_evento.toLowerCase().includes('magazzino')) {
      return Building2;
    }
    if (assignment.evento_trasferta) {
      return Plane;
    }
    return CalendarIcon;
  };

  const getEventTypeColor = (assignment: EventAssignment) => {
    if (assignment.nome_evento.toLowerCase().includes('magazzino')) {
      return 'from-gray-500 to-gray-600';
    }
    if (assignment.evento_trasferta) {
      return 'from-purple-500 to-pink-500';
    }
    return 'from-blue-500 to-cyan-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Caricamento check-in eventi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Event Check-in */}
      {(
        <div className="space-y-6">
          {/* GPS Status */}
          <div className={`rounded-xl p-4 border ${
            currentLocation 
              ? 'bg-green-900 border-green-700' 
              : 'bg-red-900 border-red-700'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Navigation className={`h-6 w-6 ${
                  currentLocation ? 'text-green-400' : 'text-red-400'
                }`} />
                <div>
                  <h4 className="font-medium text-white">
                    {currentLocation ? 'GPS Attivo' : 'GPS Richiesto'}
                  </h4>
                  <p className="text-sm opacity-75">
                    {currentLocation 
                      ? `${currentLocation.address} (±${currentLocation.accuracy}m)`
                      : gpsError || 'Attivazione GPS necessaria per check-in eventi'
                    }
                  </p>
                </div>
              </div>
              
              {!currentLocation && (
                <button
                  onClick={() => getCurrentLocation({ requiredAccuracy: 20, maxRetries: 3 })}
                  disabled={gpsLoading}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-600 flex items-center space-x-2"
                >
                  {gpsLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  <span>{gpsLoading ? 'Rilevamento...' : 'Attiva GPS'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Sessions Display */}
          {activeSessions.filter(s => s.type !== 'warehouse').length > 0 && (
            <div className="bg-gradient-to-br from-orange-600 to-red-600 rounded-xl p-4 border border-orange-500">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Sessioni Attive ({activeSessions.filter(s => s.type !== 'warehouse').length})</span>
              </h3>
              <div className="space-y-2">
                {activeSessions.filter(s => s.type !== 'warehouse').map((session) => (
                  <div key={session.id} className="bg-black/20 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {session.type === 'warehouse' ? (
                          <Building2 className="h-5 w-5 text-white" />
                        ) : (
                          <CalendarIcon className="h-5 w-5 text-white" />
                        )}
                        <div>
                          <p className="text-white font-medium">
                            {session.type === 'warehouse' ? 'Turno Magazzino' : session.shiftName || 'Evento'}
                          </p>
                          <p className="text-white/70 text-sm">
                            Check-in: {session.checkInTime}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white font-mono">
                          {elapsedTimes[session.id] || '00:00:00'}
                        </div>
                        <p className="text-white/70 text-xs">Tempo trascorso</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {activeSessions.filter(s => s.type !== 'warehouse').length > 1 && (
                <div className="mt-3 p-2 bg-yellow-500/20 rounded-lg">
                  <p className="text-white text-sm flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>Hai {activeSessions.filter(s => s.type !== 'warehouse').length} eventi attivi contemporaneamente</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Event Check-in */}
          {todayEvents.length > 0 ? (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <MapPin className="h-6 w-6 text-blue-400" />
                <span>I Tuoi Eventi ({todayEvents.length})</span>
              </h3>

              <div className="space-y-4">
                {todayEvents.map((eventAssignment) => {
                  const EventIcon = getEventTypeIcon(eventAssignment);
                  const eventDateStr = eventAssignment.giorno_inizio_evento;
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = String(now.getMonth() + 1).padStart(2, '0');
                  const day = String(now.getDate()).padStart(2, '0');
                  const todayStr = `${year}-${month}-${day}`;
                  const tomorrowDate = new Date(now);
                  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
                  const tomorrowYear = tomorrowDate.getFullYear();
                  const tomorrowMonth = String(tomorrowDate.getMonth() + 1).padStart(2, '0');
                  const tomorrowDay = String(tomorrowDate.getDate()).padStart(2, '0');
                  const tomorrowStr = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;

                  const isToday = eventDateStr === todayStr;
                  const isTomorrow = eventDateStr === tomorrowStr;
                  const eventDate = new Date(eventDateStr + 'T00:00:00');

                  let dateLabel = '';
                  let dateBgColor = '';

                  if (isToday) {
                    dateLabel = 'OGGI';
                    dateBgColor = 'bg-green-600';
                  } else if (isTomorrow) {
                    dateLabel = 'DOMANI';
                    dateBgColor = 'bg-blue-600';
                  } else {
                    dateLabel = eventDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
                    dateBgColor = 'bg-gray-600';
                  }

                  return (
                    <div key={eventAssignment.id} className="bg-gray-700 rounded-lg p-4 border-l-4 border-blue-500">
                      {/* Date Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`${dateBgColor} text-white px-3 py-1 rounded-full text-xs font-bold`}>
                          {dateLabel}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getEventTypeColor(eventAssignment)} text-white`}>
                          {eventAssignment.evento_trasferta ? 'Trasferta' : 'Evento'}
                        </span>
                      </div>

                      {/* Event Header */}
                      <div className="flex items-start mb-3">
                        <EventIcon className="h-5 w-5 text-blue-400 mt-1 mr-2" />
                        <div>
                          <h4 className="font-medium text-white">{eventAssignment.nome_evento}</h4>
                          <p className="text-sm text-gray-300">{eventAssignment.evento_localita}</p>
                          <p className="text-xs text-gray-400">{eventAssignment.nome_azienda}</p>
                        </div>
                      </div>

                      {/* Event Details */}
                      <div className="grid grid-cols-1 gap-2 mb-3">
                        {eventAssignment.evento_orario_convocazione && (
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-green-400" />
                            <span className="text-sm text-white">
                              Convocazione: {formatTime(eventAssignment.evento_orario_convocazione)}
                            </span>
                          </div>
                        )}
                        
                        {eventAssignment.evento_indirizzo && (
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-cyan-400" />
                            <span className="text-sm text-white">{eventAssignment.evento_indirizzo}</span>
                          </div>
                        )}
                        
                        {eventAssignment.tariffa_evento_assegnata && (
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-yellow-400" />
                            <span className="text-sm text-white">
                              Tariffa: €{eventAssignment.tariffa_evento_assegnata}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Pulsanti Scheda Tecnica e Mappa GPS */}
                      {(eventAssignment.link_scheda_tecnica || eventAssignment.link_mappa_gps) && (
                        <div className="flex gap-2 mb-3">
                          {eventAssignment.link_scheda_tecnica && (
                            <a
                              href={eventAssignment.link_scheda_tecnica}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition-colors text-sm"
                            >
                              <FileText className="h-4 w-4" />
                              <span>SCHEDA LAVORO</span>
                            </a>
                          )}
                          {eventAssignment.link_mappa_gps && (
                            <a
                              href={eventAssignment.link_mappa_gps}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition-colors text-sm"
                            >
                              <Navigation className="h-4 w-4" />
                              <span>MAPPA</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Active Benefits from Contract */}
                      {(() => {
                        const activeBenefits = getEventActiveBenefits(eventAssignment);
                        return activeBenefits.length > 0 && (
                          <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 mb-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <Gift className="h-4 w-4 text-green-400" />
                              <span className="text-sm font-medium text-green-400">Benefit Attivi per questo Evento</span>
                            </div>
                            <div className="space-y-1">
                              {activeBenefits.map((benefit, index) => (
                                <div key={index} className="flex items-center justify-between bg-green-800/30 px-2 py-1 rounded">
                                  <span className="text-xs text-green-300">{benefit.name}</span>
                                  <span className="text-xs font-bold text-green-200">€{benefit.value.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {isToday ? (
                        eventAssignment.checkin ? (
                          <div className="space-y-3">
                            {/* Check-in effettuato */}
                            <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <CheckCircle className="h-5 w-5 text-green-400" />
                                  <span className="text-green-400 font-medium">Check-in Effettuato</span>
                                </div>
                                <span className="text-green-300 text-sm font-bold">
                                  {formatTime(eventAssignment.checkin.start_time)}
                                </span>
                              </div>
                              {eventAssignment.checkin.end_time && (
                                <div className="flex items-center justify-between text-sm text-green-300">
                                  <span>Check-out:</span>
                                  <span className="font-bold">{formatTime(eventAssignment.checkin.end_time)}</span>
                                </div>
                              )}
                            </div>

                            {/* Bottone checkout se non ancora fatto */}
                            {!eventAssignment.checkin.end_time && (
                              <button
                                onClick={() => handleEventCheckOut(eventAssignment)}
                                className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 font-medium flex items-center justify-center space-x-2"
                              >
                                <CheckCircle className="h-5 w-5" />
                                <span>CHECK-OUT EVENTO</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Note (opzionale)
                              </label>
                              <textarea
                                value={eventNotes[eventAssignment.id] || ''}
                                onChange={(e) => setEventNotes(prev => ({ ...prev, [eventAssignment.id]: e.target.value }))}
                                placeholder="Aggiungi eventuali note per il check-in..."
                                rows={3}
                                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <button
                              onClick={() => handleEventCheckIn(eventAssignment)}
                              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium"
                            >
                              {currentLocation ? '📍 CHECK-IN GPS EVENTO' : '⚠️ CHECK-IN SENZA GPS'}
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="w-full bg-gray-600 text-gray-300 py-3 px-4 rounded-lg font-medium text-center cursor-not-allowed">
                          Check-in disponibile il giorno dell'evento
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-semibold text-white mb-2">Nessun Evento Oggi</h3>
              <p className="text-gray-300">
                Non hai eventi assegnati per oggi.
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Controlla il calendario per le prossime attività.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Connection Status */}
      {!isOnline && (
        <div className="bg-orange-900 rounded-xl p-4 border border-orange-700">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-orange-400" />
            <div>
              <h4 className="font-medium text-orange-100">Modalità Offline</h4>
              <p className="text-sm text-orange-200">
                I check-in eventi verranno salvati localmente e sincronizzati quando torni online
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Check-in Forzato */}
      {showForceCheckInModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-red-500">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-900 p-3 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Check-in Forzato</h3>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                <p className="text-red-300 text-sm mb-2">
                  <strong>Attenzione:</strong> Il GPS non è disponibile o non funziona correttamente.
                </p>
                <p className="text-red-200 text-xs">
                  Stai per effettuare un check-in <strong>senza posizione GPS</strong>. Questo verrà registrato come "Check-in Forzato" e sarà visibile ai supervisori. Si consiglia di  <strong>abilitare la posizione</strong> per evitare l' eventuale annullamento del turno.
                </p>
              </div>

              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-white font-medium mb-2">Evento:</h4>
                <p className="text-gray-300 text-sm">{selectedEvent.nome_evento}</p>
                <p className="text-gray-400 text-xs mt-1">{selectedEvent.evento_localita}</p>
              </div>

              {gpsError && (
                <div className="bg-gray-700 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">
                    <strong>Motivo:</strong> {gpsError}
                  </p>
                </div>
              )}

              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                <p className="text-yellow-300 text-xs">
                  ℹ️ Consigliamo di risolvere il problema GPS prima del check-in. Se continui, il sistema registrerà l'assenza della posizione.
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowForceCheckInModal(false);
                  setSelectedEvent(null);
                }}
                className="flex-1 bg-gray-700 text-white py-3 px-4 rounded-lg hover:bg-gray-600 font-medium"
              >
                Annulla
              </button>
              <button
                onClick={() => selectedEvent && handleEventCheckIn(selectedEvent, true)}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 font-medium"
              >
                Conferma Check-in Forzato
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventCheckIn;