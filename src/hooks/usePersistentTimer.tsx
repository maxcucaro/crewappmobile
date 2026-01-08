import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/db';
import { useAuth } from '../context/AuthContext';

interface CheckInSession {
  id: string;
  type: 'warehouse' | 'event' | 'extra';
  warehouseId?: string;
  eventId?: string;
  checkInTime: string;
  scheduledEndTime: string;
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  hasLunchBreak?: boolean;
  hasCompanyMeal: boolean;
  hasMealVoucher: boolean;
  breakTime?: number;
  isActive: boolean;
  elapsedTime?: string;
  tableName?: 'warehouse_checkins' | 'extra_shifts_checkins';
}

export const usePersistentTimer = () => {
  const { user } = useAuth();
  const [currentSession, setCurrentSession] = useState<CheckInSession | null>(null);
  const [activeSessions, setActiveSessions] = useState<CheckInSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, string>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const multiTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Avvia il timer quando c'è una sessione attiva
  useEffect(() => {
    if (currentSession && currentSession.isActive) {
      startTimer(currentSession.checkInTime);
    } else {
      stopTimer();
    }

    return () => {
      stopTimer();
    };
  }, [currentSession?.id, currentSession?.isActive]);

  // Avvia timer multipli per tutte le sessioni attive
  useEffect(() => {
    if (activeSessions.length > 0) {
      startMultipleTimers(activeSessions);
    } else {
      stopMultipleTimers();
    }

    return () => {
      stopMultipleTimers();
    };
  }, [activeSessions.length]);

  const startTimer = (checkInTime: string) => {
    // Pulisci timer esistente
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Calcola ora di inizio
    const today = new Date();
    const [hours, minutes] = checkInTime.split(':').map(Number);
    const startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, 0);

    const updateTimer = () => {
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      
      if (diffMs < 0) {
        setElapsedTime('00:00:00');
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      setElapsedTime(formattedTime);
    };

    // Aggiorna immediatamente
    updateTimer();
    
    // Poi ogni secondo
    timerRef.current = setInterval(updateTimer, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedTime('00:00:00');
  };

  const startMultipleTimers = (sessions: CheckInSession[]) => {
    if (multiTimerRef.current) {
      clearInterval(multiTimerRef.current);
    }

    const updateAllTimers = () => {
      const now = new Date();
      const today = new Date();
      const newElapsedTimes: Record<string, string> = {};

      sessions.forEach(session => {
        const [hours, minutes] = session.checkInTime.split(':').map(Number);
        const startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, 0);
        const diffMs = now.getTime() - startTime.getTime();

        if (diffMs < 0) {
          newElapsedTimes[session.id] = '00:00:00';
          return;
        }

        const totalSeconds = Math.floor(diffMs / 1000);
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        newElapsedTimes[session.id] = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      });

      setElapsedTimes(newElapsedTimes);
    };

    updateAllTimers();
    multiTimerRef.current = setInterval(updateAllTimers, 1000);
  };

  const stopMultipleTimers = () => {
    if (multiTimerRef.current) {
      clearInterval(multiTimerRef.current);
      multiTimerRef.current = null;
    }
    setElapsedTimes({});
  };

  // Carica sessione attiva dal database all'avvio
  useEffect(() => {
    if (user?.id) {
      loadActiveSession();
    }
  }, [user?.id]);

  const loadActiveSession = async () => {
    try {
      setIsLoading(true);

      if (!supabase) {
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const allSessions: CheckInSession[] = [];

      // Cerca check-in magazzino attivo (checked_in ma non checked_out)
      const { data: warehouseCheckIn, error: warehouseError } = await supabase
        .from('warehouse_checkins')
        .select('*')
        .eq('crew_id', user?.id)
        .eq('date', today)
        .in('status', ['active', 'checked_in'])
        .is('check_out_time', null)
        .maybeSingle();

      if (!warehouseError && warehouseCheckIn) {
        const session: CheckInSession = {
          id: warehouseCheckIn.id,
          type: 'warehouse',
          warehouseId: warehouseCheckIn.warehouse_id,
          checkInTime: warehouseCheckIn.check_in_time,
          scheduledEndTime: '17:00',
          shiftName: 'Turno Magazzino',
          hasCompanyMeal: warehouseCheckIn.company_meal || false,
          hasMealVoucher: warehouseCheckIn.meal_voucher || false,
          breakTime: warehouseCheckIn.break_minutes || 0,
          isActive: true,
          tableName: 'warehouse_checkins'
        };

        allSessions.push(session);
        setCurrentSession(session);
      }

      // Cerca anche turni extra attivi (dalla nuova tabella extra_shifts_checkins)
      const { data: extraCheckIn, error: extraError } = await supabase
        .from('extra_shifts_checkins')
        .select('*')
        .eq('crew_id', user?.id)
        .eq('date', today)
        .in('status', ['active', 'checked_in'])
        .is('check_out_time', null)
        .maybeSingle();

      if (!extraError && extraCheckIn) {
        const session: CheckInSession = {
          id: extraCheckIn.id,
          type: 'extra',
          warehouseId: null,
          checkInTime: extraCheckIn.check_in_time,
          scheduledEndTime: '17:00',
          shiftName: 'Turno Extra',
          hasCompanyMeal: extraCheckIn.company_meal || false,
          hasMealVoucher: extraCheckIn.meal_voucher || false,
          breakTime: extraCheckIn.break_minutes || 0,
          isActive: true,
          tableName: 'extra_shifts_checkins'
        };

        allSessions.push(session);

        // Se non c'è già un check-in magazzino, imposta questo come current
        if (!warehouseCheckIn) {
          setCurrentSession(session);
        }
      }

      // Cerca timesheet evento attivo
      const { data: eventTimesheet, error: eventError } = await supabase
        .from('timesheet_entries')
        .select(`
          *,
          crew_events!event_id(title, end_date, location)
        `)
        .eq('crew_id', user?.id)
        .eq('date', today)
        .eq('status', 'draft')
        .is('end_time', null)
        .maybeSingle();

      if (!eventError && eventTimesheet) {
        const eventData = eventTimesheet.crew_events as any;
        const session: CheckInSession = {
          id: eventTimesheet.id,
          type: 'event',
          eventId: eventTimesheet.event_id,
          checkInTime: eventTimesheet.start_time,
          scheduledEndTime: '17:00',
          shiftName: eventData?.title || 'Evento',
          hasCompanyMeal: eventTimesheet.company_meal || false,
          hasMealVoucher: eventTimesheet.meal_voucher || false,
          isActive: true
        };

        allSessions.push(session);

        if (!warehouseCheckIn) {
          setCurrentSession(session);
        }
      }

      setActiveSessions(allSessions);

    } catch (error) {
      console.error('Errore caricamento sessioni:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startSession = useCallback((sessionData: Omit<CheckInSession, 'isActive'>) => {
    const session = { ...sessionData, isActive: true };
    setCurrentSession(session);
    
    // Il timer si avvierà automaticamente tramite useEffect
  }, []);

  const endSession = useCallback((sessionId?: string) => {
    if (sessionId) {
      // Rimuovi la sessione specifica dall'array
      setActiveSessions(prev => prev.filter(s => s.id !== sessionId));

      // Se la sessione terminata è la currentSession, azzerala
      if (currentSession?.id === sessionId) {
        stopTimer();
        setCurrentSession(null);
      }
    } else {
      // Comportamento legacy: termina currentSession
      stopTimer();
      setCurrentSession(null);
    }
  }, [currentSession]);

  const manualCheckOut = async (checkoutLocation?: any, notes?: string) => {
    if (!currentSession) {
      console.error('❌ Nessuna sessione attiva per check-out');
      return false;
    }

    try {
      if (!user?.id) {
        console.error('❌ User ID non valido per check-out');
        return false;
      }

      const now = new Date();
      const checkOutTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      console.log(`🔄 Tentativo check-out manuale alle ${checkOutTime} per sessione ${currentSession.id}`);
      console.log(`📋 Tipo sessione: ${currentSession.type}`);
      console.log('📍 Checkout location:', checkoutLocation);
      console.log('📝 Note checkout:', notes);

      if (currentSession.type === 'warehouse') {
        // Determina quale tabella usare (default warehouse_checkins per compatibilità)
        const targetTable = currentSession.tableName || 'warehouse_checkins';
        console.log(`💾 Aggiornamento ${targetTable} id=${currentSession.id}`);

        // Prima verifica che il record esista per recuperare i dati
        const { data: existingRecord, error: checkError } = await supabase
          .from(targetTable)
          .select('check_in_time, pausa_pranzo_minuti, break_minutes, warehouse_id')
          .eq('id', currentSession.id)
          .maybeSingle();

        if (checkError) {
          console.error('❌ ERRORE nella verifica del record:', checkError);
        }

        if (!existingRecord) {
          console.error(`❌ Record NON TROVATO in ${targetTable} con id:`, currentSession.id);
          return false;
        }

        // Valida location checkout se disponibile
        let checkoutLocationAlert = false;
        let checkoutDistanceFromWarehouse: number | null = null;

        if (checkoutLocation && existingRecord.warehouse_id) {
          const { data: warehouseData } = await supabase
            .from('warehouses')
            .select('latitude, longitude')
            .eq('id', existingRecord.warehouse_id)
            .maybeSingle();

          if (warehouseData?.latitude && warehouseData?.longitude) {
            const distance = calculateDistance(
              checkoutLocation.latitude,
              checkoutLocation.longitude,
              warehouseData.latitude,
              warehouseData.longitude
            );
            checkoutDistanceFromWarehouse = Math.round(distance);
            checkoutLocationAlert = distance > 1000;

            if (checkoutLocationAlert) {
              console.warn('🚨 ALERT: Check-out effettuato lontano dal magazzino!', {
                distance: checkoutDistanceFromWarehouse
              });
            }
          }
        }

        // Calcola ore lavorate
        const checkInTime = existingRecord.check_in_time;
        const [inH, inM] = checkInTime.split(':').map(Number);
        const [outH, outM] = checkOutTime.split(':').map(Number);

        const checkInMinutes = inH * 60 + inM;
        const checkOutMinutes = outH * 60 + outM;
        let totalMinutes = checkOutMinutes - checkInMinutes;

        if (totalMinutes < 0) {
          totalMinutes += 24 * 60;
        }

        const totalHours = totalMinutes / 60;
        const pausaMinuti = existingRecord.pausa_pranzo_minuti || existingRecord.break_minutes || 0;
        const netHours = (totalMinutes - pausaMinuti) / 60;

        const updateData: any = {
          check_out_time: checkOutTime,
          status: 'completed',
          total_hours: Math.round(totalHours * 100) / 100,
          net_hours: Math.round(netHours * 100) / 100
        };

        // Aggiungi note se fornite
        if (notes && notes.trim()) {
          updateData.notes = notes.trim();
        }

        // Aggiungi la location del checkout se disponibile
        if (checkoutLocation) {
          updateData.checkout_location = {
            latitude: checkoutLocation.latitude,
            longitude: checkoutLocation.longitude,
            address: checkoutLocation.address,
            accuracy: checkoutLocation.accuracy,
            timestamp: checkoutLocation.timestamp.toISOString()
          };
          updateData.checkout_location_alert = checkoutLocationAlert;
          updateData.checkout_distance_from_warehouse = checkoutDistanceFromWarehouse;
        }

        console.log('📝 Dati da aggiornare:', updateData);
        console.log('🔍 Condizione WHERE: id =', currentSession.id);
        console.log('⏱️ Ore calcolate - Totali:', updateData.total_hours, 'Nette:', updateData.net_hours);

        const { data, error } = await supabase
          .from(targetTable)
          .update(updateData)
          .eq('id', currentSession.id)
          .select()
          .maybeSingle();

        if (error) {
          console.error('❌ ERRORE UPDATE WAREHOUSE CHECK-OUT:', error);
          console.error('❌ Dettagli errore:', JSON.stringify(error, null, 2));
          console.error('❌ Codice errore:', error.code);
          console.error('❌ Messaggio errore:', error.message);
          return false;
        }

        if (!data) {
          console.error('❌ Nessun dato restituito dall\'update (possibile record non trovato dopo update)');
          return false;
        }

        console.log('✅ Check-out magazzino salvato nel DB:', data);
        console.log('✅ Verifica campi aggiornati:');
        console.log('   - check_out_time:', data.check_out_time);
        console.log('   - status:', data.status);
      } else if (currentSession.type === 'extra') {
        // Gestione turni extra
        const targetTable = 'extra_shifts_checkins';
        console.log(`💾 Aggiornamento ${targetTable} id=${currentSession.id}`);

        // Recupera i dati del check-in
        const { data: existingRecord, error: checkError } = await supabase
          .from(targetTable)
          .select('check_in_time, break_minutes')
          .eq('id', currentSession.id)
          .maybeSingle();

        if (checkError) {
          console.error('❌ ERRORE nella verifica del record:', checkError);
        }

        if (!existingRecord) {
          console.error(`❌ Record NON TROVATO in ${targetTable} con id:`, currentSession.id);
          return false;
        }

        // Calcola ore lavorate
        const checkInTime = existingRecord.check_in_time;
        const [inH, inM] = checkInTime.split(':').map(Number);
        const [outH, outM] = checkOutTime.split(':').map(Number);

        const checkInMinutes = inH * 60 + inM;
        const checkOutMinutes = outH * 60 + outM;
        let totalMinutes = checkOutMinutes - checkInMinutes;

        if (totalMinutes < 0) {
          totalMinutes += 24 * 60;
        }

        const totalHours = totalMinutes / 60;
        const breakMinutes = existingRecord.break_minutes || 0;
        const netHours = (totalMinutes - breakMinutes) / 60;

        const updateData: any = {
          check_out_time: checkOutTime,
          status: 'completed',
          total_hours: Math.round(totalHours * 100) / 100,
          net_hours: Math.round(netHours * 100) / 100
        };

        console.log('📝 Dati da aggiornare:', updateData);
        console.log('⏱️ Ore calcolate - Totali:', updateData.total_hours, 'Nette:', updateData.net_hours);

        const { data, error } = await supabase
          .from(targetTable)
          .update(updateData)
          .eq('id', currentSession.id)
          .select()
          .maybeSingle();

        if (error) {
          console.error('❌ ERRORE UPDATE EXTRA CHECK-OUT:', error);
          console.error('❌ Dettagli errore:', JSON.stringify(error, null, 2));
          return false;
        }

        if (!data) {
          console.error('❌ Nessun dato restituito dall\'update');
          return false;
        }

        console.log('✅ Check-out turno extra salvato nel DB:', data);
      } else {
        console.log(`💾 Aggiornamento timesheet_entries id=${currentSession.id}`);

        const { data, error } = await supabase
          .from('timesheet_entries')
          .update({
            end_time: checkOutTime,
            status: 'submitted'
          })
          .eq('id', currentSession.id)
          .select()
          .single();

        if (error) {
          console.error('❌ ERRORE UPDATE TIMESHEET CHECK-OUT:', error);
          console.error('❌ Dettagli errore:', JSON.stringify(error, null, 2));
          return false;
        }

        console.log('✅ Check-out evento salvato nel DB:', data);
      }

      console.log('✅ Check-out completato con successo nel database');
      return true;

    } catch (error) {
      console.error('❌ Errore nel check-out manuale:', error);
      return false;
    }
  };

  // Calcola distanza tra due coordinate GPS (formula Haversine)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Raggio della Terra in metri
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distanza in metri
  };

  return {
    currentSession,
    activeSessions,
    elapsedTime,
    elapsedTimes,
    isLoading,
    startSession,
    endSession,
    manualCheckOut,
    loadActiveSession,
  };
};