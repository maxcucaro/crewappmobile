import React, { useState, useEffect } from 'react';
import { MapPin, Clock, CheckCircle, AlertCircle, X, Calendar as CalendarIcon, DollarSign, Plane, Gift, RefreshCw, Navigation, Building2, FileText } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToastContext } from '../../../context/ToastContext';
import { useGPSLocation } from '../../../hooks/useGPSLocation';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import { usePersistentTimer } from '../../../hooks/usePersistentTimer';
import { supabase } from '../../../lib/db';

const MIN_DESIRED_ACCURACY = 50; // metri consigliati per considerare la posizione "buona"

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
  const [availableEvents, setAvailableEvents] = useState<EventAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [showForceCheckInModal, setShowForceCheckInModal] = useState(false);
  const [showAvailableEventsModal, setShowAvailableEventsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventAssignment | null>(null);
  const [employeeBenefits, setEmployeeBenefits] = useState<EmployeeBenefits | null>(null);
  const [eventBenefitsMap, setEventBenefitsMap] = useState<Record<string, {name: string, value: number, category: string}>>({});
  const [eventNotes, setEventNotes] = useState<Record<string, string>>({});
  const [employeeNotes, setEmployeeNotes] = useState<Record<string, string>>({});
  const [breakMinutes, setBreakMinutes] = useState<Record<string, number>>({});

  useEffect(() => {
    if (user?.id) {
      loadTodayEvents();
      loadEmployeeBenefits();
    }
  }, [user?.id]);

  // PWA: Auto-start GPS all'ingresso nella pagina Eventi e quando la tab diventa visibile
  useEffect(() => {
    let cancelled = false;

    // Avvio automatico GPS all'ingresso nella schermata Eventi Check-in
    const initGPS = async () => {
      if (cancelled) return;
      try {
        console.debug('EventCheckIn: Avvio automatico GPS...');
        await getCurrentLocation({ requiredAccuracy: MIN_DESIRED_ACCURACY, maxRetries: 3 });
        console.debug('EventCheckIn: GPS acquisito automaticamente');
      } catch (err) {
        console.warn('EventCheckIn: GPS automatico non riuscito (l\'utente può riprovare manualmente)', err);
      }
    };

    // Carica sessione attiva se disponibile
    const tryLoadSession = async () => {
      if (cancelled) return;
      try {
        if (typeof loadActiveSession === 'function') {
          await loadActiveSession();
          console.debug('EventCheckIn: loadActiveSession executed (PWA)');
        }
      } catch (err) {
        console.error('EventCheckIn: loadActiveSession failed (PWA)', err);
      }
    };

    initGPS(); // Avvio GPS in parallelo
    tryLoadSession(); // Carica sessione attiva

    // Listener per visibilitychange (PWA: quando l'utente torna alla tab)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        initGPS(); // Riprova GPS quando la tab diventa visibile
        tryLoadSession(); // Ricarica sessione
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const loadAvailableEvents = async () => {
    try {
      setLoadingAvailable(true);
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;

      console.log('🔍 Caricamento eventi disponibili per autoassegnazione:', today);

      // Carica tutti gli eventi di oggi dalla tabella eventi
      const { data: allEvents, error: eventsError } = await supabase
        .from('crew_events')
        .select('*')
        .eq('start_date', today)
        .eq('status', 'published')
        .order('call_time', { ascending: true });

      if (eventsError) {
        console.error('❌ Errore caricamento eventi disponibili:', eventsError);
        setAvailableEvents([]);
        setLoadingAvailable(false);
        return;
      }

      console.log('📋 Eventi trovati in crew_events:', allEvents?.length || 0);
      console.log('📋 Eventi raw:', JSON.stringify(allEvents, null, 2));

      // Carica eventi già assegnati all'utente
      const { data: myAssignments, error: assignmentsError } = await supabase
        .from('crew_event_assegnazione')
        .select('evento_id')
        .eq('dipendente_freelance_id', user?.id)
        .eq('giorno_inizio_evento', today);

      if (assignmentsError) {
        console.error('❌ Errore caricamento assegnazioni:', assignmentsError);
      }

      // IMPORTANTE: Carica anche eventi con check-in già effettuato (assegnati o autoassegnati)
      const { data: existingCheckins, error: checkinsError } = await supabase
        .from('timesheet_entries')
        .select('event_id')
        .eq('crew_id', user?.id)
        .eq('date', today);

      if (checkinsError) {
        console.error('❌ Errore caricamento check-in esistenti:', checkinsError);
      }

      console.log('👤 Assegnazioni utente:', myAssignments?.length || 0);
      console.log('👤 Check-in già effettuati:', existingCheckins?.length || 0);

      // Unisci gli ID degli eventi assegnati E quelli con check-in già effettuato
      const myEventIds = new Set([
        ...(myAssignments || []).map(a => a.evento_id),
        ...(existingCheckins || []).map(c => c.event_id)
      ]);

      console.log('🔒 Eventi esclusi dalla ricerca (assegnati o con check-in):', Array.from(myEventIds));

      // Filtra eventi non assegnati all'utente
      const unassignedEvents = (allEvents || []).filter(event => !myEventIds.has(event.id));
      
      console.log('🔓 Eventi NON assegnati dopo filtro:', unassignedEvents.length);
      console.log('🔓 Eventi disponibili:', unassignedEvents.map(e => ({ id: e.id, title: e.title })));

      // Converti in formato EventAssignment
      const formattedEvents: EventAssignment[] = unassignedEvents.map(event => ({
        id: event.id,
        evento_id: event.id,
        nome_evento: event.title,
        nome_azienda: '', // Non presente in crew_events, potrebbe venire da una JOIN
        giorno_inizio_evento: event.start_date,
        giorno_fine_evento: event.end_date,
        evento_localita: event.location,
        evento_indirizzo: event.address,
        evento_orario_convocazione: event.call_time,
        evento_descrizione: event.description,
        tariffa_evento_assegnata: null,
        bonus_previsti: 0,
        evento_trasferta: event.type === 'event_travel',
        bonus_trasferta: false,
        bonus_diaria: false,
        benefits_evento_ids: [],
        benefits_evento_nomi: [],
        benefits_disponibili: null,
        link_scheda_tecnica: event.link_scheda_tecnica,
        link_mappa_gps: event.link_mappa_gps
      }));

      console.log('✅ Eventi disponibili trovati:', formattedEvents.length);
      setAvailableEvents(formattedEvents);

    } catch (error) {
      console.error('❌ Errore generale caricamento eventi disponibili:', error);
      setAvailableEvents([]);
    } finally {
      setLoadingAvailable(false);
    }
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

      // Carica anche eventi AUTOASSEGNATI (che non sono in crew_event_assegnazione)
      const { data: selfAssignedTimesheets, error: selfAssignedError } = await supabase
        .from('timesheet_entries')
        .select(`
          *,
          crew_events!event_id(id, title, location, start_date, end_date, address, call_time, description, type, link_scheda_tecnica, link_mappa_gps)
        `)
        .eq('crew_id', user?.id)
        .eq('date', today)
        .eq('is_self_assigned', true);

      if (selfAssignedError) {
        console.error('❌ Errore caricamento eventi autoassegnati:', selfAssignedError);
      }

      console.log('🔍 Eventi autoassegnati trovati:', selfAssignedTimesheets?.length || 0);

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

      // Merge eventi assegnati con check-in
      const eventsWithCheckins = (eventAssignments || []).map(event => {
        const checkin = checkins?.find(c => c.event_id === event.evento_id);
        return {
          ...event,
          checkin: checkin || undefined
        };
      });

      // Converti eventi autoassegnati in formato EventAssignment
      const selfAssignedEvents: EventAssignment[] = (selfAssignedTimesheets || []).map(ts => {
        const eventData = ts.crew_events as any;
        return {
          id: ts.id, // Usa l'ID del timesheet come ID univoco
          evento_id: ts.event_id,
          nome_evento: eventData?.title || 'Evento Autoassegnato',
          nome_azienda: '',
          giorno_inizio_evento: eventData?.start_date || today,
          giorno_fine_evento: eventData?.end_date || today,
          evento_localita: eventData?.location || '',
          evento_indirizzo: eventData?.address,
          evento_orario_convocazione: eventData?.call_time,
          evento_descrizione: eventData?.description,
          tariffa_evento_assegnata: 0,
          bonus_previsti: 0,
          evento_trasferta: eventData?.type === 'event_travel',
          bonus_trasferta: false,
          bonus_diaria: false,
          benefits_evento_ids: [],
          benefits_evento_nomi: [],
          benefits_disponibili: null,
          link_scheda_tecnica: eventData?.link_scheda_tecnica,
          link_mappa_gps: eventData?.link_mappa_gps,
          checkin: {
            id: ts.id,
            start_time: ts.start_time,
            end_time: ts.end_time,
            status: ts.status
          }
        };
      });

      // Combina eventi assegnati ed eventi autoassegnati
      const allEvents = [...eventsWithCheckins, ...selfAssignedEvents];

      console.log('✅ Eventi trovati:', allEvents.length, '(di cui autoassegnati:', selfAssignedEvents.length, ')');
      setTodayEvents(allEvents);

    } catch (error) {
      console.error('❌ Errore generale caricamento eventi:', error);
      setTodayEvents([]);
    } finally {
      setLoading(false);
    }
  };


  async function handleSelfAssignAndCheckIn(availableEvent: EventAssignment, forceCheckin: boolean = false) {
    try {
      let location = currentLocation;
      let forcedCheckIn = false;
      let gpsErrorReason = null;

      if (!location && !forceCheckin) {
        setSelectedEvent(availableEvent);
        setShowForceCheckInModal(true);
        return;
      }

      if (!location && forceCheckin) {
        forcedCheckIn = true;
        gpsErrorReason = gpsError || 'GPS non disponibile - Check-in forzato dall\'utente';
        console.warn('⚠️ Check-in forzato senza GPS:', gpsErrorReason);
      }

      const now = new Date();

      // Determina il tipo di diaria attiva (per autoassegnazione non ci sono benefit)
      const diariaType = 'nessuna';
      const diariaAmount = 0;

      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayDate = `${year}-${month}-${day}`;

      const userNotes = eventNotes[availableEvent.id]?.trim() || null;
      let finalNotes = userNotes
        ? `[AUTOASSEGNAZIONE]\n${userNotes}`
        : '[AUTOASSEGNAZIONE]';
      
      if (forcedCheckIn) {
        finalNotes = finalNotes + `\n\n[Check-in forzato: ${gpsErrorReason}]`;
      }

      const checkInData = {
        crew_id: user?.id,
        event_id: availableEvent.evento_id,
        date: todayDate,
        start_time: now.toTimeString().split(' ')[0],
        tracking_type: availableEvent.evento_trasferta ? 'days' : 'hours',
        retention_percentage: 0,
        gross_amount: 0,
        net_amount: 0,
        hourly_rate: null,
        daily_rate: null,
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
        meal_voucher: false,
        status: 'submitted',
        notes: finalNotes,
        is_self_assigned: true
      };

      let newCheckInId: string | null = null;

      if (isOnline) {
        // Crea direttamente il timesheet con is_self_assigned=true
        // Non serve creare l'assegnazione formale per le autoassegnazioni
        console.log('📝 Dati check-in da inserire:', checkInData);
        
        const { data, error } = await supabase
          .from('timesheet_entries')
          .insert([checkInData])
          .select('id, start_time')
          .single();

        if (error) {
          console.error('❌ Errore autoassegnazione evento:', error);
          showError(`Errore durante l'autoassegnazione: ${error.message}`);
          return;
        }

        console.log('📊 Dati restituiti dal database:', data);

        newCheckInId = data?.id || null;
        console.log('✅ Check-in evento creato con ID:', newCheckInId);
        console.log('⏰ Start time dal DB:', data?.start_time);

        // Avvia il timer per questo evento
        if (newCheckInId && data?.start_time) {
          console.log('🚀 Tentativo avvio timer con parametri:', {
            id: newCheckInId,
            type: 'event',
            eventId: availableEvent.evento_id,
            checkInTime: data.start_time,
            scheduledEndTime: '23:59',
            shiftName: availableEvent.nome_evento
          });
          
          startSession({
            id: newCheckInId,
            type: 'event',
            eventId: availableEvent.evento_id,
            checkInTime: data.start_time,
            scheduledEndTime: '23:59',
            shiftName: availableEvent.nome_evento,
            hasCompanyMeal: false,
            hasMealVoucher: false
          });
          console.log('⏱️ Timer avviato per evento autoassegnato:', availableEvent.nome_evento);
        } else {
          console.error('❌ Timer NON avviato - Dati mancanti:', {
            newCheckInId,
            startTime: data?.start_time,
            hasId: !!newCheckInId,
            hasStartTime: !!data?.start_time
          });
          showWarning('Check-in salvato ma timer non avviato - ricarica la pagina');
        }
      } else {
        addOfflineData('event_checkin', checkInData);
        showWarning('Autoassegnazione salvata offline - verrà sincronizzata quando tornerai online');
      }

      if (forcedCheckIn) {
        showWarning('Autoassegnazione completata (senza GPS)');
      } else {
        showSuccess(`Ti sei autoassegnato a ${availableEvent.nome_evento}`);
      }

      setShowForceCheckInModal(false);
      setShowAvailableEventsModal(false);
      setSelectedEvent(null);

      // Ricarica eventi (non serve loadActiveSession perché abbiamo già avviato la sessione)
      await loadTodayEvents();

    } catch (error) {
      console.error('❌ Errore durante autoassegnazione evento:', error);
      showError('Errore imprevisto durante l\'autoassegnazione');
    }
  }

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

      let newCheckInId: string | null = null;

      if (isOnline) {
        const { data, error } = await supabase
          .from('timesheet_entries')
          .insert([checkInData])
          .select('id, start_time')
          .single();

        if (error) {
          console.error('❌ Errore check-in evento:', error);
          showError(`Errore durante il check-in: ${error.message}`);
          return;
        }

        newCheckInId = data?.id || null;
        console.log('✅ Check-in evento creato con ID:', newCheckInId);

        // Avvia il timer per questo evento
        if (newCheckInId && data?.start_time) {
          startSession({
            id: newCheckInId,
            type: 'event',
            eventId: eventAssignment.evento_id,
            checkInTime: data.start_time,
            scheduledEndTime: '23:59',
            shiftName: eventAssignment.nome_evento,
            hasCompanyMeal: false,
            hasMealVoucher: employeeBenefits?.buoni_pasto_enabled || false
          });
          console.log('⏱️ Timer avviato per evento:', eventAssignment.nome_evento);
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

      // Ricarica eventi (non serve loadActiveSession perché abbiamo già avviato la sessione)
      await loadTodayEvents();

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
      // Registra l'orario REALE del check-out (timezone italiano)
      // Supporta eventi che finiscono dopo la mezzanotte (es: 18:00 → 02:00 giorno dopo)
      const now = new Date();
      const endTime = now.toTimeString().split(' ')[0]; // Formato HH:MM:SS in orario italiano

      // Prima recupera i dati del check-in per calcolare end_date
      const { data: checkinData, error: fetchError } = await supabase
        .from('timesheet_entries')
        .select('date, start_time')
        .eq('id', eventAssignment.checkin.id)
        .single();

      if (fetchError || !checkinData) {
        console.error('❌ Errore recupero dati check-in:', fetchError);
        showError('Errore durante il recupero dei dati del check-in');
        return;
      }

      // Calcola end_date: se end_time < start_time significa che è passata la mezzanotte
      const startTime = checkinData.start_time;
      const checkInDate = new Date(checkinData.date + 'T00:00:00');
      
      // Se l'orario di checkout è minore dell'orario di check-in, aggiungi 1 giorno
      const isOvernightEvent = endTime < startTime;
      const endDate = new Date(checkInDate);
      if (isOvernightEvent) {
        endDate.setDate(endDate.getDate() + 1);
        console.log('🌙 Evento notturno rilevato:', {
          checkIn: `${checkinData.date} ${startTime}`,
          checkOut: `${endDate.toISOString().split('T')[0]} ${endTime}`
        });
      }

      const year = endDate.getFullYear();
      const month = String(endDate.getMonth() + 1).padStart(2, '0');
      const day = String(endDate.getDate()).padStart(2, '0');
      const endDateStr = `${year}-${month}-${day}`;

      const updateData = {
        end_time: endTime,
        end_date: endDateStr,
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
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border-2 border-blue-500/50 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-3">
                <div className="bg-blue-500 p-2 rounded-lg">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <span>Sessioni Attive ({activeSessions.filter(s => s.type !== 'warehouse').length})</span>
              </h3>
              <div className="space-y-5">
                {activeSessions.filter(s => s.type !== 'warehouse').map((session) => (
                  <div key={session.id} className="bg-gray-700/50 backdrop-blur-sm rounded-xl p-5 border border-gray-600/50">
                    {/* Header con Timer */}
                    <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {session.type === 'warehouse' ? (
                            <Building2 className="h-6 w-6 text-white" />
                          ) : (
                            <CalendarIcon className="h-6 w-6 text-white" />
                          )}
                          <div>
                            <p className="text-white font-bold text-lg">
                              {session.type === 'warehouse' ? 'Turno Magazzino' : session.shiftName || 'Evento'}
                            </p>
                            <p className="text-white/80 text-sm">
                              Check-in: {session.checkInTime}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-bold text-white font-mono tracking-tight">
                            {elapsedTimes[session.id] || '00:00:00'}
                          </div>
                          <p className="text-white/80 text-xs mt-1">Tempo trascorso</p>
                        </div>
                      </div>
                    </div>

                    {/* Note Dipendente */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-200 mb-2 flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>Note Dipendente</span>
                      </label>
                      <textarea
                        value={employeeNotes[session.id] || ''}
                        onChange={(e) => setEmployeeNotes(prev => ({ ...prev, [session.id]: e.target.value }))}
                        placeholder="Aggiungi note per questo turno..."
                        rows={2}
                        className="w-full bg-gray-800 text-white border-2 border-gray-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                      />
                    </div>

                    {/* Break Time Controls */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-200 mb-2 flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>Pausa Pranzo/Cena</span>
                      </label>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setBreakMinutes(prev => ({ ...prev, [session.id]: Math.max(0, (prev[session.id] || 0) - 15) }))}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-bold text-lg transition-all active:scale-95"
                        >
                          -15
                        </button>
                        <div className="flex-1 bg-gradient-to-br from-blue-600 to-blue-700 border-2 border-blue-500 rounded-lg px-6 py-4 text-center">
                          <span className="text-white font-bold text-3xl">{breakMinutes[session.id] || 0}</span>
                          <span className="text-white/90 text-sm ml-2">minuti</span>
                        </div>
                        <button
                          onClick={() => setBreakMinutes(prev => ({ ...prev, [session.id]: (prev[session.id] || 0) + 15 }))}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-bold text-lg transition-all active:scale-95"
                        >
                          +15
                        </button>
                      </div>
                      <div className="flex space-x-2 mt-3">
                        <button
                          onClick={() => setBreakMinutes(prev => ({ ...prev, [session.id]: 30 }))}
                          className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 rounded-lg transition-all"
                        >
                          30 min
                        </button>
                        <button
                          onClick={() => setBreakMinutes(prev => ({ ...prev, [session.id]: 60 }))}
                          className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 rounded-lg transition-all"
                        >
                          60 min
                        </button>
                      </div>
                    </div>

                    {/* Termina Turno Button */}
                    <button
                      onClick={async () => {
                        try {
                          const now = new Date();
                          const endTime = now.toTimeString().split(' ')[0];
                          
                          // Recupera i dati del check-in per calcolare totali
                          const { data: checkinData, error: fetchError } = await supabase
                            .from('timesheet_entries')
                            .select('date, start_time, tracking_type')
                            .eq('id', session.id)
                            .single();
                          
                          if (fetchError || !checkinData) {
                            console.error('❌ Errore recupero dati check-in:', fetchError);
                            showError('Errore durante il recupero dei dati');
                            return;
                          }
                          
                          const startTime = checkinData.start_time;
                          const checkInDate = new Date(checkinData.date + 'T00:00:00');
                          
                          // Calcola end_date: se end_time < start_time è il giorno dopo
                          const isOvernightShift = endTime < startTime;
                          const endDate = new Date(checkInDate);
                          if (isOvernightShift) {
                            endDate.setDate(endDate.getDate() + 1);
                          }
                          const year = endDate.getFullYear();
                          const month = String(endDate.getMonth() + 1).padStart(2, '0');
                          const day = String(endDate.getDate()).padStart(2, '0');
                          const endDateStr = `${year}-${month}-${day}`;
                          
                          // Calcola total_hours
                          const [startH, startM, startS] = startTime.split(':').map(Number);
                          const [endH, endM, endS] = endTime.split(':').map(Number);
                          const startMinutes = startH * 60 + startM;
                          const endMinutes = endH * 60 + endM;
                          let totalMinutes = endMinutes - startMinutes;
                          if (totalMinutes < 0) {
                            totalMinutes += 24 * 60; // Aggiungi 24 ore se è overnight
                          }
                          
                          // Sottrai break_time
                          const breakTime = breakMinutes[session.id] || 0;
                          const netMinutes = totalMinutes - breakTime;
                          const totalHours = Math.round((netMinutes / 60) * 100) / 100;
                          
                          // Calcola total_days se tracking_type = 'days'
                          let totalDays = null;
                          if (checkinData.tracking_type === 'days') {
                            // Calcola giorni: se è overnight conta come 2 giorni, altrimenti 1
                            totalDays = isOvernightShift ? 2 : 1;
                          }
                          
                          const updateData: any = {
                            end_time: endTime,
                            end_date: endDateStr,
                            total_hours: totalHours,
                            status: 'submitted'
                          };
                          
                          if (totalDays !== null) {
                            updateData.total_days = totalDays;
                          }
                          
                          if (breakTime > 0) {
                            updateData.break_time = breakTime;
                          }
                          
                          if (employeeNotes[session.id]?.trim()) {
                            updateData.notedipendente = employeeNotes[session.id].trim();
                          }
                          
                          console.log('📊 Dati checkout calcolati:', {
                            startTime,
                            endTime,
                            endDate: endDateStr,
                            totalHours,
                            totalDays,
                            breakTime,
                            isOvernightShift
                          });
                          
                          const { error } = await supabase
                            .from('timesheet_entries')
                            .update(updateData)
                            .eq('id', session.id);
                          
                          if (error) {
                            console.error('❌ Errore checkout:', error);
                            showError('Errore durante il checkout');
                            return;
                          }
                          
                          endSession(session.id);
                          showSuccess('Turno terminato con successo!');
                          await loadTodayEvents();
                          await loadActiveSession();
                        } catch (error) {
                          console.error('❌ Errore:', error);
                          showError('Errore imprevisto');
                        }
                      }}
                      className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center space-x-3 shadow-lg transition-all active:scale-95"
                    >
                      <CheckCircle className="h-6 w-6" />
                      <span className="text-lg">TERMINA TURNO</span>
                    </button>
                  </div>
                ))}
              </div>
              {activeSessions.filter(s => s.type !== 'warehouse').length > 1 && (
                <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                  <p className="text-yellow-200 text-sm flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Hai {activeSessions.filter(s => s.type !== 'warehouse').length} eventi attivi contemporaneamente</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pulsante Eventi Disponibili - nascosto se ci sono sessioni attive */}
          {activeSessions.filter(s => s.type !== 'warehouse').length === 0 && (
            <button
              onClick={() => {
                loadAvailableEvents();
                setShowAvailableEventsModal(true);
              }}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-600 text-white py-4 px-6 rounded-xl hover:from-orange-700 hover:to-amber-700 font-bold flex items-center justify-center space-x-3 shadow-lg transition-all"
            >
              <CalendarIcon className="h-6 w-6" />
              <span>CERCA EVENTI DISPONIBILI</span>
            </button>
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
                              {currentLocation ? 'CHECK-IN GPS EVENTO' : 'CHECK-IN SENZA GPS'}
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

      {/* Modal Eventi Disponibili */}
      {showAvailableEventsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-xl max-w-4xl w-full p-6 border border-orange-500 my-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-orange-900 p-3 rounded-full">
                  <CalendarIcon className="h-6 w-6 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Eventi Disponibili Oggi</h3>
              </div>
              <button
                onClick={() => setShowAvailableEventsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4 mb-4">
              <p className="text-orange-300 text-sm">
                <strong>Autoassegnazione:</strong> Puoi partecipare a questi eventi anche senza assegnazione ufficiale.
                Il check-in verrà marcato come "AUTOASSEGNAZIONE" e sarà visibile agli amministratori.
              </p>
            </div>

            {loadingAvailable ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto mb-4"></div>
                <p className="text-white">Caricamento eventi disponibili...</p>
              </div>
            ) : availableEvents.length > 0 ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {availableEvents.map((event) => {
                  const EventIcon = getEventTypeIcon(event);
                  return (
                    <div key={event.id} className="bg-gray-700 rounded-lg p-4 border-l-4 border-orange-500">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start space-x-3">
                          <EventIcon className="h-5 w-5 text-orange-400 mt-1" />
                          <div>
                            <h4 className="font-medium text-white">{event.nome_evento}</h4>
                            <p className="text-sm text-gray-300">{event.evento_localita}</p>
                            <p className="text-xs text-gray-400">{event.nome_azienda}</p>
                          </div>
                        </div>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                          Disponibile
                        </span>
                      </div>

                      {event.evento_orario_convocazione && (
                        <div className="flex items-center space-x-2 mb-3">
                          <Clock className="h-4 w-4 text-green-400" />
                          <span className="text-sm text-white">
                            Convocazione: {formatTime(event.evento_orario_convocazione)}
                          </span>
                        </div>
                      )}

                      {event.evento_indirizzo && (
                        <div className="flex items-center space-x-2 mb-3">
                          <MapPin className="h-4 w-4 text-cyan-400" />
                          <span className="text-sm text-white">{event.evento_indirizzo}</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Note (opzionale)
                        </label>
                        <textarea
                          value={eventNotes[event.id] || ''}
                          onChange={(e) => setEventNotes(prev => ({ ...prev, [event.id]: e.target.value }))}
                          placeholder="Aggiungi eventuali note..."
                          rows={2}
                          className="w-full bg-gray-600 text-white border border-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3"
                        />
                      </div>

                      <button
                        onClick={() => handleSelfAssignAndCheckIn(event)}
                        className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center space-x-2"
                      >
                        <CheckCircle className="h-5 w-5" />
                        <span>{currentLocation ? 'AUTOASSEGNATI E FAI CHECK-IN' : 'AUTOASSEGNATI (SENZA GPS)'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <h4 className="text-lg font-semibold text-white mb-2">Nessun Evento Disponibile</h4>
                <p className="text-gray-300">Non ci sono eventi disponibili per oggi a cui puoi autoassegnarti.</p>
              </div>
            )}
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
                onClick={() => {
                  if (selectedEvent) {
                    // Se l'evento ha tariffa_evento_assegnata è un evento assegnato, altrimenti è autoassegnazione
                    if (selectedEvent.tariffa_evento_assegnata !== null && selectedEvent.tariffa_evento_assegnata !== undefined) {
                      handleEventCheckIn(selectedEvent, true);
                    } else {
                      handleSelfAssignAndCheckIn(selectedEvent, true);
                    }
                  }
                }}
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