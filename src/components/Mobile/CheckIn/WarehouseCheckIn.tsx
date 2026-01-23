import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, MapPin, Clock, CheckCircle, AlertCircle, Camera, X, Building2, RefreshCw, Navigation, Utensils, Gift, Coffee } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../../../context/AuthContext';
import { useToastContext } from '../../../context/ToastContext';
import { useGPSLocation } from '../../../hooks/useGPSLocation';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import { usePersistentTimer } from '../../../hooks/usePersistentTimer';
import { supabase } from '../../../lib/db';
import { getTodayString, getTomorrowString, toLocalDateString } from '../../../utils/dateUtils';

interface WarehouseShift {
  id: string;
  turno_id: string;
  nome_magazzino: string;
  data_turno: string;
  ora_inizio_turno: string;
  ora_fine_turno: string;
  nome_azienda: string;
  crew_template_turni?:  {
    pausa_pranzo?:  boolean;
    ora_inizio_turno:  string;
    ora_fine_turno: string;
  };
}

interface WarehouseInfo {
  id: string;
  name: string;
  address: string;
  qr_code_value: string;
  company_id: string;
  backup_code:  string;
}

interface MealBenefits {
  buoni_pasto_enabled: boolean;
  buoni_pasto_value: number;
  pasto_aziendale_cost: number;
}

const WarehouseCheckIn: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToastContext();
  const { currentLocation, getCurrentLocation, isLoading:  gpsLoading, error: gpsError } = useGPSLocation();
  const { isOnline, addOfflineData } = useOfflineSync();
  const { currentSession, activeSessions, elapsedTime, elapsedTimes, startSession, endSession, manualCheckOut } = usePersistentTimer();
  
  // Stati principali
  const [currentView, setCurrentView] = useState<'main' | 'scanner' | 'meal_selection'>('main');
  const [todayWarehouseShifts, setTodayWarehouseShifts] = useState<WarehouseShift[]>([]);
  const [availableWarehouses, setAvailableWarehouses] = useState<WarehouseInfo[]>([]);
  const [mealBenefits, setMealBenefits] = useState<MealBenefits | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<WarehouseShift | null>(null);
  const [existingCheckIn, setExistingCheckIn] = useState<any>(null);
  const [todayCheckIns, setTodayCheckIns] = useState<any[]>([]);
  const [manualQrCode, setManualQrCode] = useState('');
  const [shiftValidation, setShiftValidation] = useState<{
    isValid: boolean;
    reason?:  string;
    canCheckIn: boolean;
    canCheckOut: boolean;
    isExpired: boolean;
    hoursLate?:  number;
  } | null>(null);
  
  // Stati meal selection
  const [wantsCompanyMeal, setWantsCompanyMeal] = useState(false);
  const [wantsMealVoucher, setWantsMealVoucher] = useState(false);
  
  // Stati scanner
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  // Usa ref invece di state per controllo sincrono immediato
  const isProcessingScanRef = useRef(false);
  const lastScanTimestampRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  // Stati check-in forzato
  const [showForceCheckInModal, setShowForceCheckInModal] = useState(false);
  const [forceCheckInWarehouse, setForceCheckInWarehouse] = useState<WarehouseInfo | null>(null);

  // Stati pausa pranzo
  const [breakInProgress, setBreakInProgress] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState<string | null>(null);
  const [breakEndTime, setBreakEndTime] = useState<string | null>(null);

  // Stati modal inserimento tardivo pausa
  const [showLateBreakModal, setShowLateBreakModal] = useState(false);
  const [lateBreakCheckIn, setLateBreakCheckIn] = useState<any>(null);
  const [lateBreakStart, setLateBreakStart] = useState('');
  const [lateBreakEnd, setLateBreakEnd] = useState('');

  // Stati modal conferma check-out
  const [showCheckOutConfirmModal, setShowCheckOutConfirmModal] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [noteTurno, setNoteTurno] = useState('');
  const [noteTurnoExpanded, setNoteTurnoExpanded] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Stati modal forzatura pausa senza GPS
  const [showForceBreakModal, setShowForceBreakModal] = useState(false);
  const [forceBreakType, setForceBreakType] = useState<'start' | 'end' | null>(null);

  // Funzioni per il drag del modale
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - modalPosition.x, y: clientY - modalPosition.y });
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setModalPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const performAutoCheckout = useCallback(async (checkIn: any, originalEndTime:  string, hoursLate:  number) => {
    try {
      const updateData: any = {
        check_out_time: originalEndTime,
        status: 'completed',
        auto_checkout: true,
        notes: `Auto-checkout effettuato alle ${originalEndTime}. Sessione chiusa automaticamente dopo ${hoursLate.toFixed(1)} ore di ritardo.`
      };

      // Se il turno aveva pausa pranzo e non è stata registrata, applicala automaticamente
      if (checkIn.break_minutes > 0 && !checkIn.has_taken_break && !checkIn.pausa_pranzo_inizio) {
        updateData.has_taken_break = true;
        updateData.break_auto_applied = true;
        updateData.pausa_pranzo_inizio = '13:00';
        updateData.pausa_pranzo_fine = '14:00';
        console.log('⏰ Pausa pranzo applicata automaticamente all\'auto-checkout');
      }

      const { error:  updateError } = await supabase
        .from('warehouse_checkins')
        .update(updateData)
        .eq('id', checkIn.id)
        .select()
        .single();

      if (updateError) {
        return;
      }

      if (currentSession && currentSession.id === checkIn.id) {
        endSession();
      }

      showInfo(
        'Turno Auto-Completato',
        `Il tuo turno è stato completato automaticamente alle ${originalEndTime}. ${checkIn.break_minutes > 0 && !checkIn.has_taken_break ? 'Pausa pranzo registrata automaticamente.' : ''}`,
        8000
      );

    } catch (error) {
      // Silenzioso
    }
  }, [currentSession, endSession, showInfo]);

  const checkAndCleanupExpiredSessions = useCallback(async () => {
    // Solo se c'è una sessione attiva warehouse
    if (!currentSession || currentSession.type !== 'warehouse') {
      return;
    }

    try {
      // Usa ora locale italiana per confronti
      const now = new Date();
      const italianTime = now.toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Rome'
      });
      const currentTime = italianTime. replace(':', ': '); // Formato HH:mm

      // IMPORTANTE: Trova SOLO il check-in della sessione corrente
      // NON auto-completare altri turni per cui l'utente non ha mai fatto check-in
      const { data:  currentCheckIn, error: checkError } = await supabase
        .from('warehouse_checkins')
        .select('*')
        .eq('id', currentSession.id)
        .eq('status', 'active')
        .is('check_out_time', null)
        .maybeSingle();

      if (checkError || ! currentCheckIn) {
        return;
      }

      // Usa ora_fine_turno già salvato in warehouse_checkins (proviene da crew_assegnazione_turni)
      const shiftEndTime = currentCheckIn.ora_fine_turno || '17:00';
      const endTime = formatTime(shiftEndTime);

      // Controlla se è passata 1 ORA dalla fine del turno
      const minutesLate = calculateMinutesDifference(currentTime, endTime);
      
      // Auto-checkout SOLO se è passata almeno 1 ora (60 minuti) dalla fine turno
      if (minutesLate >= 60) {
        const hoursLate = minutesLate / 60;
        console.log(`⏰ Auto-checkout attivato: ${minutesLate} minuti dopo la fine turno (${endTime})`);
        await performAutoCheckout(currentCheckIn, endTime, hoursLate);
      }

    } catch (error) {
      // Silenzioso
    }
  }, [currentSession, user?. id, performAutoCheckout]);

  useEffect(() => {
    if (user?.id) {
      loadTodayWarehouseShifts();
      loadMealBenefits();
      checkExistingCheckIn();
      loadWarehouses();
      loadBreakStatus();
      
      // 📍 GPS AUTOMATICO: Attiva GPS all'apertura pagina se ci sono turni magazzino disponibili
      // Questo evita all'utente di dover cliccare manualmente "Attiva GPS"
      // È conforme iOS perché l'utente ha aperto volontariamente la pagina Check-in
      if (!currentLocation && !gpsLoading) {
        console.log('📍 Attivazione GPS automatica all\'apertura pagina Check-in...');
        getCurrentLocation({ requiredAccuracy: 50, maxRetries: 2 });
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current. clear();
      }
    };
  }, [user?.id]);

  // ✅ CORREZIONE: Carica stato pausa da pausa_pranzo_*
  const loadBreakStatus = async () => {
    if (!currentSession || currentSession.type !== 'warehouse') {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('warehouse_checkins')
        .select('pausa_pranzo_inizio, pausa_pranzo_fine, break_start_location, has_taken_break')
        .eq('id', currentSession.id)
        .maybeSingle();

      if (error || !data) return;

      if (data.pausa_pranzo_inizio && !data.pausa_pranzo_fine) {
        setBreakInProgress(true);
        setBreakStartTime(data.pausa_pranzo_inizio);
        setBreakEndTime(null);
      } else if (data.pausa_pranzo_inizio && data.pausa_pranzo_fine) {
        setBreakInProgress(false);
        setBreakStartTime(data.pausa_pranzo_inizio);
        setBreakEndTime(data.pausa_pranzo_fine);
      }
    } catch (error) {
      console.error('Errore caricamento stato pausa:', error);
    }
  };

  // Carica stato pausa quando cambia la sessione
  useEffect(() => {
    if (currentSession?. type === 'warehouse') {
      loadBreakStatus();
    }
  }, [currentSession?.id]);

  // Polling GPS continuo durante il turno (ogni 30 secondi)
  useEffect(() => {
    if (!currentSession || currentSession.type !== 'warehouse') {
      return;
    }

    // Richiedi GPS iniziale
    getCurrentLocation({ requiredAccuracy: 50, maxRetries: 2 });

    // Polling GPS ogni 30 secondi
    const gpsIntervalId = setInterval(() => {
      getCurrentLocation({ requiredAccuracy: 50, maxRetries: 1 });
    }, 30000); // 30 secondi

    return () => {
      clearInterval(gpsIntervalId);
    };
  }, [currentSession?.id, getCurrentLocation]);

  // Polling per auto-checkout ogni 60 secondi
  useEffect(() => {
    if (!user?. id || !currentSession || currentSession.type !== 'warehouse') {
      return;
    }

    // Controllo iniziale
    checkAndCleanupExpiredSessions();

    // Polling ogni 60 secondi
    const intervalId = setInterval(() => {
      checkAndCleanupExpiredSessions();
    }, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user?.id, currentSession?.id, currentSession?.type, checkAndCleanupExpiredSessions]);

  const validateShiftTiming = (shift: WarehouseShift) => {
    const now = new Date();

    // Usa ora locale italiana
    const italianTime = now. toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute:  '2-digit',
      hour12: false,
      timeZone: 'Europe/Rome'
    });
    const currentTime = italianTime.replace(':', ':');
    const currentDate = toLocalDateString(now);
    
    const shiftDate = shift.data_turno;
    const shiftStartTime = formatTime(shift.ora_inizio_turno);
    const shiftEndTime = formatTime(shift.ora_fine_turno);
    
    // Controlla se è il giorno giusto
    if (currentDate !== shiftDate) {
      if (currentDate > shiftDate) {
        return {
          isValid: false,
          reason: `Turno del ${new Date(shiftDate).toLocaleDateString('it-IT')} già passato`,
          canCheckIn: false,
          canCheckOut: false,
          isExpired: true
        };
      } else {
        return {
          isValid: false,
          reason: `Turno programmato per ${new Date(shiftDate).toLocaleDateString('it-IT')}`,
          canCheckIn: false,
          canCheckOut: false,
          isExpired: false
        };
      }
    }
    
    // Controlla orario
    const isBeforeStart = isTimeBefore(currentTime, shiftStartTime);
    const isAfterEnd = isTimeAfter(currentTime, shiftEndTime);
    
    // Gestione turni notturni: se l'ora corrente è molto prima dell'ora di inizio (es. 00:26 vs 23:30)
    // potrebbe essere che siamo dopo la mezzanotte e il turno è iniziato ieri
    const currentMinutes = parseInt(currentTime.split(':')[0]) * 60 + parseInt(currentTime.split(':')[1]);
    const startMinutes = parseInt(shiftStartTime.split(':')[0]) * 60 + parseInt(shiftStartTime.split(':')[1]);
    const endMinutes = parseInt(shiftEndTime.split(':')[0]) * 60 + parseInt(shiftEndTime.split(':')[1]);
    
    // Se siamo in orari notturni (00:00 - 05:00) e il turno inizia in orari serali (>= 20:00)
    // siamo probabilmente PRIMA del turno che inizierà stasera
    const isNightHour = currentMinutes < 300; // Prima delle 05:00
    const isEveningStart = startMinutes >= 1200; // Dopo le 20:00
    
    if (isNightHour && isEveningStart) {
      // Siamo nelle ore notturne (es. 00:26) e il turno inizia stasera (es. 23:30)
      // Calcola quanto manca: startMinutes - currentMinutes
      const minutesEarly = startMinutes - currentMinutes;
      const ALLOWED_EARLY_MINUTES = 4 * 60; // 240 minuti (4 ore)

      console.log('🌙 Turno notturno - Check anticipo:', {
        currentTime,
        currentMinutes,
        shiftStartTime,
        startMinutes,
        minutesEarly,
        allowedMinutes: ALLOWED_EARLY_MINUTES,
        isAllowed: minutesEarly <= ALLOWED_EARLY_MINUTES
      });

      if (minutesEarly <= ALLOWED_EARLY_MINUTES) {
        return {
          isValid: true,
          reason: `Check-in anticipato consentito (turno inizia alle ${shiftStartTime})`,
          canCheckIn: true,
          canCheckOut: false,
          isExpired: false
        };
      }

      return {
        isValid: false,
        reason: `Turno inizia alle ${shiftStartTime} (tra ${Math.floor(minutesEarly / 60)} ore e ${minutesEarly % 60} minuti). Check-in disponibile dalle ${calculateEarlyCheckInTime(shiftStartTime)}.`,
        canCheckIn: false,
        canCheckOut: false,
        isExpired: false
      };
    }
    
    if (isBeforeStart) {
      const minutesEarly = calculateMinutesDifference(shiftStartTime, currentTime);
      const ALLOWED_EARLY_MINUTES = 4 * 60; // 240 minuti (4 ore)

      console.log('⏰ Check anticipo:', {
        currentTime,
        shiftStartTime,
        minutesEarly,
        allowedMinutes: ALLOWED_EARLY_MINUTES,
        isAllowed: minutesEarly <= ALLOWED_EARLY_MINUTES
      });

      // Permetti check-in se siamo entro le 4 ore prima dell'inizio
      if (minutesEarly <= ALLOWED_EARLY_MINUTES) {
        return {
          isValid: true,
          reason: `Check-in anticipato consentito (turno inizia alle ${shiftStartTime})`,
          canCheckIn: true,
          canCheckOut: false,
          isExpired: false
        };
      }

      // Troppo in anticipo (più di 4 ore prima)
      return {
        isValid: false,
        reason: `Turno inizia alle ${shiftStartTime} (tra ${Math.floor(minutesEarly / 60)} ore e ${minutesEarly % 60} minuti). Check-in disponibile dalle ${calculateEarlyCheckInTime(shiftStartTime)}.`,
        canCheckIn: false,
        canCheckOut: false,
        isExpired: false
      };
    }
    
    if (isAfterEnd) {
      const hoursLate = calculateHoursLate(shiftEndTime, currentTime);
      return {
        isValid: false,
        reason: `Turno terminato alle ${shiftEndTime} (${hoursLate. toFixed(1)} ore fa)`,
        canCheckIn: false,
        canCheckOut: false,
        isExpired: true,
        hoursLate
      };
    }
    
    return {
      isValid: true,
      reason:  `Turno attivo:  ${shiftStartTime} - ${shiftEndTime}`,
      canCheckIn: true,
      canCheckOut: true,
      isExpired: false
    };
  };

  const isTimeBefore = (time1: string, time2: string): boolean => {
    const [h1, m1] = time1.split(': ').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    return (h1 * 60 + m1) < (h2 * 60 + m2);
  };

  const isTimeAfter = (time1: string, time2: string): boolean => {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    return (h1 * 60 + m1) > (h2 * 60 + m2);
  };

  const calculateMinutesDifference = (futureTime: string, currentTime:  string): number => {
    const [h1, m1] = futureTime.split(':').map(Number);
    const [h2, m2] = currentTime.split(':').map(Number);
    return (h1 * 60 + m1) - (h2 * 60 + m2);
  };

  const calculateHoursLate = (endTime: string, currentTime: string): number => {
    const [h1, m1] = endTime.split(':').map(Number);
    const [h2, m2] = currentTime.split(':').map(Number);
    const diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    return diffMinutes / 60;
  };

  const calculateEarlyCheckInTime = (shiftStartTime: string): string => {
    const [hours, minutes] = shiftStartTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes - 240; // 4 ore prima
    
    if (totalMinutes < 0) {
      // Se va nel giorno precedente
      const adjustedMinutes = totalMinutes + 24 * 60;
      const h = Math.floor(adjustedMinutes / 60);
      const m = adjustedMinutes % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} (giorno prima)`;
    }
    
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const loadMealBenefits = async () => {
    try {
      
      const { data: mealData, error:  mealError } = await supabase
        .from('employee_meal_benefits')
        .select('*')
        .eq('dipendente_id', user?.id)
        .eq('attivo', true)
        .maybeSingle();

      if (mealError) {
        // Valori di default se non configurati
        setMealBenefits({
          buoni_pasto_enabled: false,
          buoni_pasto_value: 7.50,
          pasto_aziendale_cost: 12.00
        });
        return;
      }

      if (mealData) {
        setMealBenefits({
          buoni_pasto_enabled: mealData.buoni_pasto_enabled,
          buoni_pasto_value: mealData.buoni_pasto_value || 7.50,
          pasto_aziendale_cost:  mealData.pasto_aziendale_cost || 12.00
        });
      } else {
        // Valori di default
        setMealBenefits({
          buoni_pasto_enabled: false,
          buoni_pasto_value: 7.50,
          pasto_aziendale_cost: 12.00
        });
      }
      
    } catch (error) {
      setMealBenefits({
        buoni_pasto_enabled: false,
        buoni_pasto_value: 7.50,
        pasto_aziendale_cost: 12.00
      });
    }
  };

  const checkExistingCheckIn = async () => {
    try {
      const today = getTodayString();

      // Carica TUTTI i check-in di oggi (possono essere multipli)
      const { data:  existingData, error: existingError } = await supabase
        .from('warehouse_checkins')
        .select('*')
        .eq('crew_id', user?.id)
        .eq('date', today);

      if (! existingError && existingData) {
        console.log('📋 Check-in trovati oggi:', existingData.length);
        setTodayCheckIns(existingData);

        // Se c'è almeno un check-in attivo, salvalo
        const activeCheckIn = existingData.find(ci => ci.status === 'active');
        setExistingCheckIn(activeCheckIn || null);

        // Se c'è un check-in attivo ma la sessione locale non è sincronizzata, ripristinala
        if (activeCheckIn && (! currentSession || currentSession.id !== activeCheckIn.id)) {
          console.log('🔄 Ripristino sessione da check-in attivo nel DB');

          // Usa gli orari già presenti in warehouse_checkins
          let shiftStartTime = activeCheckIn.ora_inizio_turno;
          let shiftEndTime = activeCheckIn.ora_fine_turno;
          
          // ⚠️ FALLBACK: Se gli orari non sono nel check-in (vecchi check-in), recuperali dall'assegnazione turni
          if (!shiftStartTime || !shiftEndTime) {
            console.log('⚠️ Orari mancanti nel check-in, recupero da crew_assegnazione_turni...');
            const { data: shiftData } = await supabase
              .from('crew_assegnazione_turni')
              .select('ora_inizio_turno, ora_fine_turno')
              .eq('turno_id', activeCheckIn.shift_id)
              .maybeSingle();
            
            if (shiftData) {
              shiftStartTime = shiftData.ora_inizio_turno || '09:00';
              shiftEndTime = shiftData.ora_fine_turno || '17:00';
              console.log('✅ Orari recuperati:', { shiftStartTime, shiftEndTime });
            } else {
              // Ultimo fallback
              shiftStartTime = '09:00';
              shiftEndTime = '17:00';
            }
          }
          
          const hasLunchBreak = activeCheckIn.break_minutes > 0;

          startSession({
            id: activeCheckIn.id,
            type: 'warehouse',
            warehouseId: activeCheckIn. warehouse_id,
            checkInTime: activeCheckIn.check_in_time,
            scheduledEndTime: formatTime(shiftEndTime),
            shiftName: 'Turno Magazzino',
            shiftStartTime:  formatTime(shiftStartTime),
            shiftEndTime: formatTime(shiftEndTime),
            hasLunchBreak: hasLunchBreak,
            hasCompanyMeal: activeCheckIn.company_meal || false,
            hasMealVoucher: activeCheckIn.meal_voucher || false,
            breakTime: activeCheckIn.break_minutes || 0
          });

          // ✅ GPS AUTOMATICO: Attiva GPS immediatamente quando ripristini un turno attivo
          // Questo evita di dover cliccare manualmente sul pulsante GPS
          console.log('📍 Attivazione GPS automatica per turno in corso...');
          getCurrentLocation({ requiredAccuracy: 50, maxRetries: 2 });
        }

        // Controlla se ci sono check-in completati che necessitano inserimento pausa
        checkForMissingBreaks(existingData);
      }

    } catch (error) {
      // Silenzioso
    }
  };

  const checkForMissingBreaks = async (checkIns: any[]) => {
    try {
      const now = new Date();

      for (const checkIn of checkIns) {
        // Controlla solo check-in completati
        // Recupera info turno per verificare se aveva pausa pranzo
        const { data: shiftData } = await supabase
          .from('crew_assegnazione_turni')
          .select('*, crew_template_turni!turno_id(pausa_pranzo)')
          .eq('id', checkIn.shift_id)
          .maybeSingle();

        if (checkIn.status !== 'completed' || !shiftData?. crew_template_turni?.pausa_pranzo) {
          continue;
        }

        // Se ha già registrato la pausa, salta
        if (checkIn.has_taken_break || checkIn.break_auto_applied) {
          continue;
        }

        // Calcola ore passate dal check-out
        const checkOutDateTime = new Date(`${checkIn.date}T${checkIn.check_out_time}`);
        const hoursElapsed = (now. getTime() - checkOutDateTime.getTime()) / (1000 * 60 * 60);

        // Se sono passate meno di 8 ore, mostra il modal
        if (hoursElapsed < 8) {
          setLateBreakCheckIn(checkIn);
          setShowLateBreakModal(true);
          break; // Mostra solo un modal alla volta
        }
      }
    } catch (error) {
      console.error('Errore controllo pause mancanti:', error);
    }
  };

  const loadTodayWarehouseShifts = async () => {
    try {
      setLoading(true);
      const today = getTodayString();
      console.log('📅 Caricamento turni da data:', today);

      const { data: warehouseShifts, error: warehouseError } = await supabase
        .from('crew_assegnazione_turni')
        .select(`
          *,
          crew_template_turni!turno_id(
            id_template,
            nome_template,
            ora_inizio_turno,
            ora_fine_turno,
            pausa_pranzo,
            warehouse_id,
            nome_magazzino,
            warehouses! warehouse_id(
              name,
              address
            )
          )
        `)
        .eq('dipendente_id', user?.id)
        .gte('data_turno', today)
        .order('data_turno', { ascending: true })
        .order('ora_inizio_turno', { ascending: true });

      if (warehouseError) {
        setTodayWarehouseShifts([]);
      } else {

        // Mappa i dati: ORARI da ASSEGNAZIONE (modificabili), pausa pranzo da TEMPLATE
        const mappedShifts = (warehouseShifts || []).map(shift => ({
          ...shift,
          // PRIORITÀ: crew_assegnazione_turni (orari modificabili per singolo giorno)
          // Il template è solo fallback se assegnazione non ha orari
          ora_inizio_turno: shift.ora_inizio_turno || shift.crew_template_turni?.ora_inizio_turno,
          ora_fine_turno: shift.ora_fine_turno || shift.crew_template_turni?.ora_fine_turno,
          nome_magazzino: shift.crew_template_turni?.nome_magazzino || shift.nome_magazzino,
          warehouse_address: shift.crew_template_turni?.warehouses?.address || 'Indirizzo non disponibile'
        }));

        console.log('✅ Turni magazzino caricati:', mappedShifts.length, mappedShifts.map(s => ({
          nome: s.nome_turno,
          data: s.data_turno,
          orario_assegnazione: `${s.ora_inizio_turno}-${s.ora_fine_turno}`,
          orario_template: `${s.crew_template_turni?.ora_inizio_turno}-${s.crew_template_turni?.ora_fine_turno}`
        })));

        setTodayWarehouseShifts(mappedShifts);
      }
      
    } catch (error) {
      setTodayWarehouseShifts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouses = async () => {
    try {
      
      const { data: warehousesData, error: warehousesError } = await supabase
        .from('warehouses')
        .select('*')
        .order('name');

      if (warehousesError) {
        setAvailableWarehouses([]);
        return;
      }

      setAvailableWarehouses(warehousesData || []);
      
    } catch (error) {
      setAvailableWarehouses([]);
    }
  };
  const startCheckInProcess = (shift: WarehouseShift) => {
    // Prima valida il turno
    const validation = validateShiftTiming(shift);
    setShiftValidation(validation);
    
    if (! validation.isValid || !validation.canCheckIn) {
      if (validation.isExpired) {
        showError(
          'Turno Scaduto', 
          `Non puoi fare check-in:  ${validation.reason}`
        );
      } else {
        showWarning(
          'Turno Non Disponibile', 
          `Check-in non disponibile:  ${validation.reason}`
        );
      }
      return;
    }
    
    setSelectedShift(shift);
    
    // Step 1: Verifica GPS
    if (!currentLocation) {
      showWarning('GPS Richiesto', 'Attivazione GPS in corso per il check-in magazzino.. .');
      getCurrentLocation({ requiredAccuracy: 20, maxRetries: 3 }).then(() => {
        // Dopo GPS, vai alla selezione pasti
        proceedToMealSelection(shift);
      });
    } else {
      // GPS già attivo, vai alla selezione pasti
      proceedToMealSelection(shift);
    }
  };

  const proceedToMealSelection = (shift: WarehouseShift) => {
    // Step 2: Se il turno prevede pausa pranzo, chiedi per il pasto
    // Imposta automaticamente buono pasto se il dipendente ha il benefit
    setWantsMealVoucher(mealBenefits?. buoni_pasto_enabled || false);
    
    if (shift.crew_template_turni?.pausa_pranzo !== false) { // Default true se non specificato
      setCurrentView('meal_selection');
    } else {
      // Nessuna pausa pranzo, vai diretto al scanner
      setWantsCompanyMeal(false);
      // Mantieni buono pasto se benefit attivo anche senza pausa pranzo
      proceedToScanner();
    }
  };

  const proceedToScanner = () => {
    setCurrentView('scanner');
    initScanner();
  };

  const initScanner = () => {
    setShowScanner(true);
    setScannerError(null);
    // Reset dei ref quando si apre lo scanner
    isProcessingScanRef.current = false;
    lastScanTimestampRef.current = 0;
    lastScannedCodeRef.current = '';
    
    setTimeout(() => {
      const scannerElement = document.getElementById("qr-reader");
      if (!scannerElement) {
        setScannerError('Elemento scanner non trovato nel DOM');
        return;
      }
      
      try {
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
          supportedScanTypes: [0],
          aspectRatio: 1.0,
          formatsToSupport: [0],
          defaultZoomValueIfSupported: 2,
          videoConstraints: {
            facingMode: "environment"
          },
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        };

        const html5QrcodeScanner = new Html5QrcodeScanner(
          "qr-reader",
          config,
          false
        );

        html5QrcodeScanner.render(onScanSuccess, onScanError);
        scannerRef.current = html5QrcodeScanner;

      } catch (error) {
        console.error('Errore inizializzazione scanner:', error);
        setScannerError('Errore nell\'inizializzazione del scanner QR');
      }
    }, 300);
  };

  const onScanSuccess = (decodedText: string) => {
    const now = Date.now();
    const timeSinceLastScan = now - lastScanTimestampRef.current;
    
    // ✅ TRIPLO CONTROLLO per prevenire scannerizzazioni multiple:
    // 1. Verifica se già in elaborazione (ref sincrono)
    if (isProcessingScanRef.current) {
      console.log('⚠️ Scansione già in corso, IGNORATO');
      return;
    }
    
    // 2. Verifica se è lo stesso codice scansionato di recente (debounce 2 secondi)
    if (decodedText === lastScannedCodeRef.current && timeSinceLastScan < 2000) {
      console.log('⚠️ Codice duplicato entro 2 secondi, IGNORATO');
      return;
    }
    
    // 3. Verifica se è una scansione troppo veloce (< 500ms dalla precedente)
    if (timeSinceLastScan < 500) {
      console.log('⚠️ Scansione troppo veloce (<500ms), IGNORATO');
      return;
    }
    
    console.log('✅ QR Code rilevato e ACCETTATO:', decodedText);
    
    // Imposta i flag IMMEDIATAMENTE (sincrono)
    isProcessingScanRef.current = true;
    lastScanTimestampRef.current = now;
    lastScannedCodeRef.current = decodedText;
    
    setManualQrCode('');
    
    // ✅ FERMA LO SCANNER IMMEDIATAMENTE dopo la prima scansione valida
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
        console.log('🛑 Scanner fermato dopo scansione');
      } catch (error) {
        console.error('Errore durante la chiusura dello scanner:', error);
      }
    }
    
    // Procedi con la validazione del QR code
    processQrCodeCheckIn(decodedText);
  };

  const onScanError = (error: any) => {
    if (! error.includes('NotFoundException')) {
      console.error('QR scan error:', error);
    }
  };

  const closeScanner = () => {
    // Chiude scanner e torna alla vista principale
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    setShowScanner(false);
    setCurrentView('main');
    // Reset del ref quando si chiude lo scanner
    isProcessingScanRef.current = false;
    lastScanTimestampRef.current = 0;
    lastScannedCodeRef.current = '';
  };

  const processQrCodeCheckIn = (qrCode: string) => {
    const warehouse = availableWarehouses.find(w => w.backup_code === qrCode);

    if (! warehouse) {
      
      if (availableWarehouses.length === 0) {
        showError('Errore Database', 'Nessun magazzino caricato dal database!  Verifica connessione e permessi.');
      } else {
        showError('Codice Backup Non Riconosciuto', `Il codice backup "${qrCode}" non corrisponde a nessun magazzino registrato.  Verifica di aver inserito il codice corretto.`);
      }
      // Reset del ref per permettere una nuova scansione
      isProcessingScanRef.current = false;
      return;
    }

    handleWarehouseCheckIn(warehouse);
  };

  const handleWarehouseCheckIn = async (warehouse: WarehouseInfo, forceCheckin: boolean = false) => {
    let location = currentLocation;
    let forcedCheckIn = false;
    let gpsErrorReason = null;

    // Se non c'è GPS e non è forzato, mostra il modal
    if (!location && !forceCheckin) {
      setForceCheckInWarehouse(warehouse);
      setShowForceCheckInModal(true);
      // NON resettare isProcessingScanRef qui - rimane true per bloccare altre scansioni
      // Il ref verrà resettato solo quando l'utente annulla o completa il check-in
      return;
    }

    // Se non c'è GPS ma è forzato, registra il motivo
    if (!location && forceCheckin) {
      forcedCheckIn = true;
      gpsErrorReason = gpsError || 'GPS non disponibile - Check-in forzato dall\'utente';
      console.warn('⚠️ Check-in magazzino forzato senza GPS:', gpsErrorReason);
    }

    if (!selectedShift) {
      showError('Errore Check-in', 'Turno non selezionato');
      isProcessingScanRef.current = false;
      return;
    }

    // Rivalidazione finale prima del check-in
    const validation = validateShiftTiming(selectedShift);
    if (!validation.isValid || !validation.canCheckIn) {
      showError('Check-in Non Valido', `Impossibile procedere:  ${validation.reason}`);
      isProcessingScanRef.current = false;
      return;
    }

    const now = new Date();
    const checkInTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const today = toLocalDateString(now);

    // Controlla se esiste già un check-in per questo turno oggi
    const existingShiftCheckIn = todayCheckIns.find((ci: any) => {
      const ciDate = ci.date;
      const shiftDate = selectedShift.data_turno.split('T')[0];
      // Controlla anche che il turno sia attivo (non completato)
      return ci.shift_id === selectedShift.turno_id && 
             ciDate === shiftDate && 
             ci.status === 'active';
    });

    if (existingShiftCheckIn) {
      showError('Check-in Duplicato', 'Hai già effettuato il check-in per questo turno oggi. Verifica lo storico dei tuoi check-in.');
      isProcessingScanRef.current = false;
      return;
    }

    // ✅ DOPPIO CONTROLLO: Verifica sul database in tempo reale prima di inserire
    const shiftDate = selectedShift.data_turno.split('T')[0];
    const { data: dbCheck, error: dbCheckError } = await supabase
      .from('warehouse_checkins')
      .select('id, status')
      .eq('crew_id', user?.id)
      .eq('shift_id', selectedShift.turno_id)
      .eq('date', shiftDate)
      .eq('status', 'active')
      .maybeSingle();

    if (!dbCheckError && dbCheck) {
      console.warn('⚠️ Check-in duplicato rilevato nel database:', dbCheck);
      showError('Check-in Duplicato', 'Esiste già un check-in attivo per questo turno. Ricaricamento...');
      // Ricarica i dati per sincronizzare
      await checkExistingCheckIn();
      isProcessingScanRef.current = false;
      return;
    }

    try {
      // Calcola pausa pranzo
      const breakMinutes = selectedShift.crew_template_turni?.pausa_pranzo !== false ? 60 : 0; // Default 60 min se pausa pranzo

      // Validazione posizione rispetto al magazzino
      let locationAlert = false;
      let distanceFromWarehouse:  number | null = null;

      if (location && ! forcedCheckIn) {
        const validation = await validateLocationProximity(
          location.latitude,
          location.longitude,
          warehouse.id,
          500 // 500 metri di tolleranza
        );

        distanceFromWarehouse = validation.distance;
        locationAlert = validation. alert;

        if (locationAlert) {
          console.warn('🚨 ALERT: Check-in effettuato lontano dal magazzino! ', {
            distance: Math.round(validation.distance! ),
            warehouse: warehouse.name
          });
        }
      }

      const checkInData = {
        warehouse_id: warehouse.id,
        crew_id: user?.id,
        date: today,
        check_in_time: checkInTime,
        status: 'active',
        location: location ?  {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          accuracy: location.accuracy,
          timestamp: location.timestamp. toISOString()
        } : null,
        forced_checkin: forcedCheckIn,
        gps_error_reason: gpsErrorReason,
        location_alert: locationAlert,
        distance_from_warehouse: distanceFromWarehouse,
        shift_id: selectedShift.turno_id,
        ora_inizio_turno: selectedShift.ora_inizio_turno,
        ora_fine_turno: selectedShift.ora_fine_turno,
        break_minutes: breakMinutes,
        company_meal: wantsCompanyMeal,
        meal_voucher: wantsMealVoucher,
        meal_cost: wantsCompanyMeal ? (mealBenefits?.pasto_aziendale_cost || 12.00) : 0.00,
        meal_notes: wantsCompanyMeal ? 'Pasto aziendale richiesto' : wantsMealVoucher ? 'Buono pasto richiesto' : null
      };


      if (isOnline) {
        const { data, error } = await supabase
          .from('warehouse_checkins')
          .insert(checkInData)
          .select()
          .single();

        if (error) {
          console. error('❌ ERRORE CHECK-IN WAREHOUSE:', error);
          console.error('   - Code:', error.code);
          console.error('   - Message:', error.message);
          console.error('   - Details:', error.details);
          console.error('   - Hint:', error.hint);

          addOfflineData('checkin', checkInData);
          showWarning('Check-in Offline', `Errore database: ${error.message} - Salvato offline e sarà sincronizzato`);
        } else {
          
          // Calcola orario fine turno corretto
          const shiftEndTime = formatTime(selectedShift.ora_fine_turno);
          
          console.log('✅ CHECK-IN WAREHOUSE SALVATO NEL DB: ');
          console.log('   - ID check-in:', data.id);
          console.log('   - Crew ID:', data.crew_id);
          console.log('   - Warehouse ID:', data.warehouse_id);
          console.log('   - Check-in time:', data.check_in_time);
          console.log('   - Status:', data.status);

          startSession({
            id: data.id,
            type: 'warehouse',
            warehouseId: warehouse.id,
            checkInTime,
            scheduledEndTime: shiftEndTime,
            shiftName: `Turno ${selectedShift.nome_magazzino}`, // Nome turno completo
            shiftStartTime:  selectedShift.ora_inizio_turno,
            shiftEndTime: selectedShift.ora_fine_turno,
            hasLunchBreak: selectedShift.crew_template_turni?.pausa_pranzo !== false,
            hasCompanyMeal: wantsCompanyMeal,
            hasMealVoucher:  wantsMealVoucher,
            breakTime: breakMinutes
          });

          console.log('✅ SESSIONE LOCALE AVVIATA con ID:', data.id);
          
          // Messaggio di conferma pulito
          let confirmMessage = forcedCheckIn
            ? `CHECK-IN FORZATO COMPLETATO!\n\n`
            : `CHECK-IN COMPLETATO!\n\n`;
          confirmMessage += `Magazzino: ${selectedShift.nome_magazzino}\n`;
          confirmMessage += `Inizio: ${checkInTime}\n`;
          confirmMessage += `Fine prevista: ${shiftEndTime}\n`;
          confirmMessage += forcedCheckIn
            ? `Check-in senza GPS (forzato)\n`
            : `Posizione GPS verificata\n`;

          if (selectedShift.crew_template_turni?.pausa_pranzo !== false) {
            confirmMessage += `Include 1 ora di pausa pranzo\n`;
          }

          if (wantsCompanyMeal) {
            confirmMessage += `Pasto aziendale: €${mealBenefits?.pasto_aziendale_cost || 12.00}\n`;
          }

          if (wantsMealVoucher) {
            confirmMessage += `Buono pasto: €${mealBenefits?. buoni_pasto_value || 7.50}\n`;
          }

          if (forcedCheckIn) {
            showWarning('Check-in Forzato Completato', confirmMessage);
          } else {
            showSuccess('Check-in Completato', confirmMessage);
          }
          
          // ✅ Chiude lo scanner SOLO dopo check-in completato con successo
          closeScanner();
          
          // Reset del ref di elaborazione
          isProcessingScanRef.current = false;
          
          // Ricarica i check-in per aggiornare lo stato
          await checkExistingCheckIn();
        }
      } else {
        addOfflineData('checkin', checkInData);
        showInfo('Check-in Offline', 'Check-in salvato offline - Verrà sincronizzato quando torni online');
        
        // ✅ Chiude lo scanner anche per check-in offline (salvato correttamente)
        closeScanner();
        
        // Reset del ref di elaborazione
        isProcessingScanRef.current = false;
      }

      // Reset stati
      setSelectedShift(null);
      setWantsCompanyMeal(false);
      setWantsMealVoucher(false);
      
    } catch (error) {
      showError('Errore Check-in', 'Si è verificato un errore durante il check-in.  Riprova.');
      // Reset del ref anche in caso di errore
      isProcessingScanRef.current = false;
    }
  };

  const handleManualCheckOut = async () => {
    if (!currentSession || currentSession.type !== 'warehouse') {
      showWarning('Nessuna Sessione', 'Non c\'è una sessione magazzino attiva da terminare');
      return;
    }

    // Mostra modal di conferma
    setShowCheckOutConfirmModal(true);
  };

  const confirmCheckOut = async () => {
    setShowCheckOutConfirmModal(false);

    console.log('🔴 INIZIO PROCESSO CHECK-OUT MANUALE');
    console.log('📋 Sessione corrente:', currentSession);
    console.log('⏱️ Tempo trascorso:', elapsedTime);
    console.log('📝 Note checkout:', checkoutNotes);

    try {
      showInfo('Check-out in corso... ', 'Sto completando il turno magazzino', 2000);

      console.log('📞 Chiamata a manualCheckOut().. .');
      console.log('📍 Passaggio location al checkout:', currentLocation);
      const success = await manualCheckOut(currentLocation, checkoutNotes);
      console.log('✅ Risultato manualCheckOut():', success);

      if (success) {
        console.log('✅ Check-out salvato nel database, ora termino la sessione locale');

        // Termina la sessione locale DOPO che il DB è aggiornato
        endSession();
        console.log('✅ Sessione locale terminata');

        // Reset stati pausa e note
        setBreakInProgress(false);
        setBreakStartTime(null);
        setBreakEndTime(null);
        setCheckoutNotes('');

        showSuccess(
          'Check-out Completato',
          `Turno magazzino terminato con successo!  Tempo totale: ${elapsedTime}`
        );

        // Ricarica i dati dal database per aggiornare lo stato
        console.log('🔄 Ricaricamento dati dal database...');
        await checkExistingCheckIn();
        await loadTodayWarehouseShifts();
        console.log('✅ Dati ricaricati');

        // Pulisci la cache per forzare il refresh dei dati
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          for (const cacheName of cacheNames) {
            if (cacheName.includes('supabase') || cacheName.includes('warehouse')) {
              await caches.delete(cacheName);
            }
          }
          console.log('🗑️ Cache pulita');
        }




         // FORCE RELOAD della pagina dopo 1 secondo
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        console.error('❌ Check-out FALLITO - success = false');
        showError('Errore Check-out', 'Si è verificato un errore durante il check-out. Riprova.');
      }
    } catch (error) {
      console.error('❌ ERRORE CATCH nel check-out:', error);
      showError('Errore Sistema', 'Errore imprevisto durante il check-out magazzino');
    }
  };

  const handleStartBreak = async (forceWithoutGPS: boolean = false) => {
    console.log('🍽️ === INIZIO PAUSA - DEBUG ===');
    console.log('Current Session:', currentSession);
    console.log('Session ID:', currentSession?.id);
    console.log('Current Location:', currentLocation);
    console.log('Force without GPS:', forceWithoutGPS);

    if (!currentSession || currentSession.type !== 'warehouse') {
      console.error('❌ Nessuna sessione warehouse attiva');
      showError('Errore', 'Nessuna sessione warehouse attiva');
      return;
    }

    if (breakInProgress) {
      console.warn('⚠️ Pausa già in corso');
      showWarning('Pausa già iniziata', 'Hai già iniziato una pausa. Termina prima questa pausa.');
      return;
    }

    if (breakStartTime && breakEndTime) {
      console.warn('⚠️ Pausa già completata');
      showWarning('Pausa già effettuata', 'Hai già effettuato la pausa pranzo per questo turno.');
      return;
    }

    let location = currentLocation;
    let forcedBreak = false;
    let gpsErrorReason = null;

    // Se non c'è GPS e non è forzato, mostra modal
    if (!location && !forceWithoutGPS) {
      console.warn('⚠️ GPS non disponibile, tentativo riattivazione...');
      showWarning('GPS Non Disponibile', 'Richiesta attivazione GPS...');
      await getCurrentLocation({ requiredAccuracy: 20, maxRetries: 2 });
      location = currentLocation; // Riprova dopo tentativo

      if (!location) {
        console.warn('⚠️ GPS ancora non disponibile dopo tentativi, mostro modal forzatura');
        // Ancora nessun GPS, chiedi se forzare
        setForceBreakType('start');
        setShowForceBreakModal(true);
        return;
      }
    }

    // Se è forzato senza GPS
    if (!location && forceWithoutGPS) {
      forcedBreak = true;
      gpsErrorReason = gpsError || 'GPS non disponibile - Pausa forzata dall\'utente';
      console.warn('⚠️ Inizio pausa forzato senza GPS:', gpsErrorReason);
    }

    const now = new Date();
    const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    console.log('⏰ Orario inizio pausa:', startTime);
    console.log('📍 Location da salvare:', location);
    console.log('🔒 Forced break:', forcedBreak);

    try {
      const updateData: any = {
        pausa_pranzo_inizio: startTime,
        break_start_forced: forcedBreak
      };

      if (location) {
        updateData.break_start_location = {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          accuracy: location.accuracy,
          timestamp: location.timestamp.toISOString(),
          forced: forcedBreak
        };
      }

      if (forcedBreak && gpsErrorReason) {
        updateData.break_start_gps_error = gpsErrorReason;
      }

      console.log('💾 Dati da salvare:', updateData);
      console.log('🎯 Update su ID:', currentSession.id);

      const { data, error } = await supabase
        .from('warehouse_checkins')
        .update(updateData)
        .eq('id', currentSession.id)
        .select();

      console.log('📤 Risposta Supabase:', { data, error });

      if (error) {
        console.error('❌ Errore salvataggio pausa:', error);
        console.error('Dettagli errore:', JSON.stringify(error, null, 2));
        showError('Errore', `Impossibile salvare inizio pausa: ${error.message}`);
        return;
      }

      setBreakInProgress(true);
      setBreakStartTime(startTime);

      if (forcedBreak) {
        showWarning('Pausa Iniziata (Forzata)', `Inizio pausa registrato alle ${startTime} SENZA GPS`);
      } else {
        showSuccess('Pausa Iniziata', `Inizio pausa registrato alle ${startTime} con GPS verificato`);
      }
    } catch (error) {
      console.error('Errore sistema pausa:', error);
      showError('Errore Sistema', 'Errore durante il salvataggio della pausa');
    }
  };

  const handleEndBreak = async (forceWithoutGPS: boolean = false) => {
    if (!currentSession || currentSession.type !== 'warehouse') {
      showError('Errore', 'Nessuna sessione warehouse attiva');
      return;
    }

    if (!breakInProgress) {
      showWarning('Nessuna pausa attiva', 'Devi prima iniziare una pausa');
      return;
    }

    let location = currentLocation;
    let forcedBreak = false;
    let gpsErrorReason = null;

    // Se non c'è GPS e non è forzato, mostra modal
    if (!location && !forceWithoutGPS) {
      showWarning('GPS Non Disponibile', 'Richiesta attivazione GPS...');
      await getCurrentLocation({ requiredAccuracy: 20, maxRetries: 2 });
      location = currentLocation;

      if (!location) {
        // Ancora nessun GPS, chiedi se forzare
        setForceBreakType('end');
        setShowForceBreakModal(true);
        return;
      }
    }

    // Se è forzato senza GPS
    if (!location && forceWithoutGPS) {
      forcedBreak = true;
      gpsErrorReason = gpsError || 'GPS non disponibile - Pausa forzata dall\'utente';
      console.warn('⚠️ Fine pausa forzata senza GPS:', gpsErrorReason);
    }

    const now = new Date();
    const endTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    try {
      const updateData: any = {
        pausa_pranzo_fine: endTime,
        has_taken_break: true,
        break_registered_late: false,
        break_end_forced: forcedBreak
      };

      if (location) {
        updateData.break_end_location = {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          accuracy: location.accuracy,
          timestamp: location.timestamp.toISOString(),
          forced: forcedBreak
        };
      }

      if (forcedBreak && gpsErrorReason) {
        updateData.break_end_gps_error = gpsErrorReason;
      }

      console.log('💾 Dati fine pausa da salvare:', JSON.stringify(updateData, null, 2));
      console.log('🎯 Update su ID:', currentSession.id);

      const { error } = await supabase
        .from('warehouse_checkins')
        .update(updateData)
        .eq('id', currentSession.id);

      if (error) {
        console.error('Errore salvataggio fine pausa:', error);
        showError('Errore', 'Impossibile salvare fine pausa');
        return;
      }

      const breakDuration = calculateBreakDuration(breakStartTime!, endTime);

      // Ricarica lo stato per aggiornare la visualizzazione
      await loadBreakStatus();

      if (forcedBreak) {
        showWarning('Pausa Terminata (Forzata)', `Fine pausa registrata alle ${endTime} SENZA GPS. Durata: ${breakDuration} minuti`);
      } else {
        showSuccess('Pausa Terminata', `Fine pausa registrata alle ${endTime}. Durata: ${breakDuration} minuti`);
      }
    } catch (error) {
      console.error('Errore sistema fine pausa:', error);
      showError('Errore Sistema', 'Errore durante il salvataggio della pausa');
    }
  };

  const calculateBreakDuration = (startTime: string, endTime: string): number => {
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
  };

  // Salva note turno durante il turno attivo
  const saveNoteTurno = async () => {
    if (!currentSession || currentSession.type !== 'warehouse') return;

    try {
      const { error } = await supabase
        .from('warehouse_checkins')
        .update({ NoteTurno: noteTurno || null })
        .eq('id', currentSession.id);

      if (error) {
        console.error('Errore salvataggio note:', error);
        showError('Errore', 'Impossibile salvare le note');
        return;
      }

      showSuccess('Note Salvate', 'Le tue note sono state salvate con successo', 2000);
    } catch (error) {
      console.error('Errore sistema salvataggio note:', error);
      showError('Errore Sistema', 'Errore durante il salvataggio delle note');
    }
  };

  // Carica note turno quando si carica la sessione
  const loadNoteTurno = async () => {
    if (!currentSession || currentSession.type !== 'warehouse') return;

    try {
      const { data, error } = await supabase
        .from('warehouse_checkins')
        .select('NoteTurno')
        .eq('id', currentSession.id)
        .maybeSingle();

      if (error || !data) return;

      setNoteTurno(data.NoteTurno || '');
    } catch (error) {
      console.error('Errore caricamento note:', error);
    }
  };

  // Carica note quando cambia la sessione
  useEffect(() => {
    if (currentSession?.type === 'warehouse') {
      loadNoteTurno();
    } else {
      setNoteTurno('');
    }
  }, [currentSession?.id]);

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

  // Geocodifica inversa: ottieni coordinate da indirizzo magazzino
  const getWarehouseCoordinates = async (warehouseId: string): Promise<{lat: number, lon: number} | null> => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('latitude, longitude, address')
        .eq('id', warehouseId)
        .maybeSingle();

      if (error || !data) {
        console.warn('Coordinate magazzino non trovate:', error);
        return null;
      }

      // Se il magazzino ha già le coordinate salvate
      if (data.latitude && data.longitude) {
        return { lat: data.latitude, lon: data.longitude };
      }

      // Altrimenti usa l'indirizzo per geocodificare (fallback)
      console.warn('⚠️ Magazzino senza coordinate GPS. Impossibile validare posizione.');
      return null;
    } catch (error) {
      console.error('Errore recupero coordinate magazzino:', error);
      return null;
    }
  };

  // Valida se il check-in/out è vicino al magazzino
  const validateLocationProximity = async (
    userLat: number,
    userLon: number,
    warehouseId: string,
    maxDistanceMeters: number = 500 // Default 500 metri
  ): Promise<{ isValid: boolean; distance: number | null; alert: boolean }> => {
    const warehouseCoords = await getWarehouseCoordinates(warehouseId);

    if (!warehouseCoords) {
      // Non possiamo validare senza coordinate magazzino
      return { isValid: true, distance: null, alert: false };
    }

    const distance = calculateDistance(userLat, userLon, warehouseCoords.lat, warehouseCoords.lon);

    // Alert se la distanza supera 1km (comportamento sospetto)
    const alert = distance > 1000;
    const isValid = distance <= maxDistanceMeters;

    console.log(`📍 Validazione posizione:
      - Distanza dal magazzino: ${Math.round(distance)}m
      - Limite permesso: ${maxDistanceMeters}m
      - Validazione: ${isValid ? '✅ OK' : '❌ FUORI RANGE'}
      - Alert: ${alert ? '🚨 SOSPETTO' : '✅ Normale'}`);

    return { isValid, distance, alert };
  };

  const handleSaveLateBreak = async () => {
    if (!lateBreakCheckIn || !lateBreakStart || !lateBreakEnd) {
      showError('Campi Mancanti', 'Inserisci sia l\'orario di inizio che di fine pausa');
      return;
    }

    // Valida che l'orario fine sia dopo l'inizio
    if (lateBreakEnd <= lateBreakStart) {
      showError('Orario Non Valido', 'L\'orario di fine pausa deve essere dopo l\'inizio');
      return;
    }

    try {
      const { error } = await supabase
        .from('warehouse_checkins')
        .update({
          break_start_time: lateBreakStart,
          break_end_time: lateBreakEnd,
          has_taken_break: true,
          break_registered_late: true,
          break_modified_at: new Date().toISOString()
        })
        .eq('id', lateBreakCheckIn.id);

      if (error) {
        showError('Errore', 'Impossibile salvare la pausa');
        return;
      }

      const duration = calculateBreakDuration(lateBreakStart, lateBreakEnd);
      showSuccess(
        'Pausa Registrata',
        `Pausa pranzo registrata: ${lateBreakStart} - ${lateBreakEnd} (${duration} minuti)\n\nNota: Inserita dopo il check-out`
      );

      setShowLateBreakModal(false);
      setLateBreakCheckIn(null);
      setLateBreakStart('');
      setLateBreakEnd('');

      // Ricarica i dati
      await checkExistingCheckIn();
    } catch (error) {
      showError('Errore Sistema', 'Errore durante il salvataggio della pausa');
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Caricamento check-in magazzino...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Check-in Warning - SOLO se c'è un check-in nel DB ma NON c'è una sessione locale attiva */}
      {existingCheckIn && existingCheckIn.status === 'active' && !currentSession && (
        <div className="bg-orange-900 rounded-xl p-4 border border-orange-700">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-orange-400" />
            <div>
              <h4 className="font-medium text-orange-100">Turno in Corso</h4>
              <p className="text-sm text-orange-200">
                Check-in attivo dalle {existingCheckIn.check_in_time} - {existingCheckIn.nome_turno || 'Turno Magazzino'}
              </p>
              <p className="text-xs text-orange-300 mt-1">
                Caricamento sessione in corso...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Sessions Display - Multiple Sessions Support */}
      {(currentSession?.type === 'warehouse' || activeSessions.filter(s => s.type === 'warehouse').length > 0) && (
        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">
              {activeSessions.filter(s => s.type === 'warehouse').length === 1 ? 'Sessione Attiva' : `Sessioni Attive (${activeSessions.filter(s => s.type === 'warehouse').length})`}
            </h3>
            <div className="w-3 h-3 bg-purple-300 rounded-full animate-pulse"></div>
          </div>

          <div className="space-y-4">
            {activeSessions.filter(s => s.type === 'warehouse').map((session, index) => (
              <div key={session.id} className={`${index > 0 ? 'pt-4 border-t border-white/20' : ''}`}>
                <div className="flex items-center space-x-3 mb-3">
                  {session.type === 'warehouse' ? (
                    <Building2 className="h-6 w-6 text-white" />
                  ) : (
                    <Clock className="h-6 w-6 text-white" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-white">
                        {session.type === 'warehouse' ? 'Turno Magazzino' : session.shiftName || 'Evento'}
                      </h4>
                      {activeSessions.length > 1 && (
                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full text-white">
                          {session.type === 'warehouse' ? 'Magazzino' : 'Evento'}
                        </span>
                      )}
                    </div>
                    {session.type === 'warehouse' && session.hasLunchBreak && (
                      <p className="text-xs text-purple-200">☕ Include 1 ora di pausa pranzo</p>
                    )}
                  </div>
                </div>

                <div className="bg-white bg-opacity-20 rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-3xl font-mono font-bold text-white mb-2">
                      {elapsedTimes[session.id] || '00:00:00'}
                    </div>
                    <div className="text-sm text-purple-100">
                      {session.type === 'warehouse' ? 'Tempo di lavoro (pausa inclusa)' : 'Tempo trascorso'}
                    </div>
                  </div>
                </div>

                {/* Meal Info - solo per warehouse */}
                {session.type === 'warehouse' && (session.hasCompanyMeal || session.hasMealVoucher) && (
                  <div className="bg-white bg-opacity-10 rounded-lg p-3 mt-3">
                    <h5 className="text-white font-medium mb-2 flex items-center space-x-2">
                      <Utensils className="h-4 w-4" />
                      <span>Pasti Selezionati</span>
                    </h5>
                    <div className="space-y-1">
                      {session.hasCompanyMeal && (
                        <div className="flex justify-between text-sm">
                          <span className="text-purple-200">Pasto Aziendale:</span>
                          <span className="text-orange-300 font-medium">-€{mealBenefits?.pasto_aziendale_cost || 12.00}</span>
                        </div>
                      )}
                      {session.hasMealVoucher && (
                        <div className="flex justify-between text-sm">
                          <span className="text-purple-200">🎫 Buono Pasto:</span>
                          <span className="text-green-300 font-medium">+€{mealBenefits?.buoni_pasto_value || 7.50}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {activeSessions.filter(s => s.type === 'warehouse').length > 1 && (
              <div className="mt-4 p-3 bg-yellow-500/20 rounded-lg">
                <p className="text-white text-sm flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Stai lavorando su {activeSessions.filter(s => s.type === 'warehouse').length} turni magazzino contemporaneamente</span>
                </p>
              </div>
            )}
          </div>

          {/* Note Turno - Sempre modificabili durante il turno */}
          {currentSession && currentSession.type === 'warehouse' && (
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl p-4 border border-blue-700 shadow-lg mt-4">
              <div className="flex items-center space-x-2 mb-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h5 className="text-white font-bold text-lg">📝 Note Turno</h5>
              </div>
              <textarea
                value={noteTurno}
                onChange={(e) => setNoteTurno(e.target.value)}
                placeholder="Scrivi qui eventuali note, osservazioni o segnalazioni durante il turno..."
                className="w-full bg-gray-800 bg-opacity-50 text-white border-2 border-blue-600 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400 min-h-[100px] placeholder-gray-400 transition-all"
                maxLength={500}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-blue-200 text-xs">
                  {noteTurno.length}/500 caratteri
                </p>
                <button
                  onClick={saveNoteTurno}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 shadow-md"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Salva Note</span>
                </button>
              </div>
            </div>
          )}

          {/* Mantieni la gestione pausa solo se c'è una sessione warehouse attiva */}
          {currentSession && currentSession.type === 'warehouse' && currentSession.hasLunchBreak && (
            <div className="space-y-4 mt-4">
              {/* Break Management */}
              <div className="bg-gradient-to-br from-orange-900/40 to-amber-900/40 backdrop-blur-sm rounded-xl p-5 shadow-2xl border border-orange-700/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-2.5 rounded-xl shadow-lg">
                      <Coffee className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h5 className="text-white font-bold text-lg">Pausa Pranzo</h5>
                      <p className="text-orange-200 text-xs">Gestisci la tua pausa</p>
                    </div>
                  </div>
                  <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-md ${
                    gpsLoading ? 'bg-yellow-500' : currentLocation ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {gpsLoading ? (
                      <>
                        <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full"></div>
                        <span className="text-white">Rilevamento...</span>
                      </>
                    ) : currentLocation ? (
                      <>
                        <MapPin className="h-3.5 w-3.5 text-white animate-pulse" />
                        <span className="text-white">GPS Attivo</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="h-3.5 w-3.5 text-white" />
                        <span className="text-white">GPS Off</span>
                      </>
                    )}
                  </div>
                </div>

                {!breakInProgress && !breakStartTime ? (
                  <>
                    <button
                      onClick={() => handleStartBreak(false)}
                      disabled={gpsLoading}
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 px-5 rounded-xl font-bold text-base flex items-center justify-center space-x-2.5 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                    >
                      <Coffee className="h-6 w-6" />
                      <span>
                        {gpsLoading ? 'Verifica GPS in corso...' : currentLocation ? '☕ INIZIA PAUSA PRANZO' : '☕ INIZIA PAUSA (Richiedi GPS)'}
                      </span>
                    </button>
                    {!currentLocation && !gpsLoading && (
                      <div className="mt-3 bg-gradient-to-r from-yellow-900/50 to-amber-900/50 border-2 border-yellow-500/50 rounded-xl p-4 backdrop-blur-sm">
                        <p className="text-yellow-100 text-sm text-center flex items-center justify-center space-x-2">
                          <AlertCircle className="h-5 w-5 text-yellow-300 flex-shrink-0" />
                          <span>GPS non disponibile. Verrà richiesta l'attivazione o la pausa forzata.</span>
                        </p>
                      </div>
                    )}
                  </>
                ) : breakInProgress ? (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-orange-500/30 to-amber-500/30 border-2 border-orange-400 rounded-xl p-4 shadow-lg backdrop-blur-sm">
                      <div className="flex items-center justify-center space-x-2.5 mb-3">
                        <div className="relative">
                          <div className="w-4 h-4 bg-orange-400 rounded-full animate-pulse"></div>
                          <div className="absolute inset-0 w-4 h-4 bg-orange-400 rounded-full animate-ping"></div>
                        </div>
                        <span className="text-white font-bold text-lg">🍽️ PAUSA IN CORSO</span>
                      </div>
                      <p className="text-center text-sm text-orange-100 font-medium">
                        ⏰ Iniziata alle <span className="text-white font-bold">{breakStartTime}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleEndBreak(false)}
                      disabled={gpsLoading}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 px-5 rounded-xl font-bold text-base flex items-center justify-center space-x-2.5 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                    >
                      <CheckCircle className="h-6 w-6" />
                      <span>
                        {gpsLoading ? 'Verifica GPS in corso...' : currentLocation ? '✅ TERMINA PAUSA PRANZO' : '✅ TERMINA PAUSA (Richiedi GPS)'}
                      </span>
                    </button>
                    {!currentLocation && !gpsLoading && (
                      <div className="bg-gradient-to-r from-yellow-900/50 to-amber-900/50 border-2 border-yellow-500/50 rounded-xl p-4 backdrop-blur-sm">
                        <p className="text-yellow-100 text-sm text-center flex items-center justify-center space-x-2">
                          <AlertCircle className="h-5 w-5 text-yellow-300 flex-shrink-0" />
                          <span>GPS non disponibile. Verrà richiesta l'attivazione o la pausa forzata.</span>
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-400 rounded-xl p-4 shadow-lg backdrop-blur-sm">
                    <div className="flex items-center justify-center space-x-2.5 mb-2">
                      <CheckCircle className="h-6 w-6 text-green-300 animate-bounce" />
                      <span className="text-white font-bold text-lg">✅ Pausa Completata</span>
                    </div>
                    {breakStartTime && breakEndTime && (
                      <p className="text-center text-sm text-green-100 font-medium">
                        🕐 Dalle <span className="text-white font-bold">{breakStartTime}</span> alle <span className="text-white font-bold">{breakEndTime}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleManualCheckOut}
            className="w-full mt-4 bg-red-600 text-white py-3 px-4 rounded-xl hover:bg-red-700 font-bold text-lg shadow-lg"
          >
            {currentSession?.type === 'warehouse' ? '🛑 TERMINA TURNO MAGAZZINO' : '🛑 TERMINA EVENTO'}
          </button>
        </div>
      )}

      {/* Main Check-in Options */}
      {currentView === 'main' && (!currentSession || currentSession.type !== 'warehouse') && (
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
                      : gpsError || 'Attivazione GPS necessaria per check-in'
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

          {/* Warehouse Check-in */}
          {todayWarehouseShifts.length > 0 ? (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <QrCode className="h-6 w-6 text-purple-400" />
                <span>Tuoi Turni Magazzino ({todayWarehouseShifts.length})</span>
              </h3>

              <div className="space-y-3 mb-4">
                {todayWarehouseShifts.map((shift) => {
                  // Confronto date usando utility per orario locale italiano
                  const shiftDateStr = shift.data_turno.split('T')[0];
                  const isToday = shiftDateStr === getTodayString();
                  const isTomorrow = shiftDateStr === getTomorrowString();

                  const shiftDate = new Date(shift.data_turno);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  shiftDate.setHours(0, 0, 0, 0);

                  // Calcola giorni mancanti
                  const diffTime = shiftDate.getTime() - today.getTime();
                  const daysUntilShift = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  let dateLabel = '';
                  let dateBgColor = '';

                  if (isToday) {
                    dateLabel = 'OGGI';
                    dateBgColor = 'bg-green-600';
                  } else if (isTomorrow) {
                    dateLabel = 'DOMANI';
                    dateBgColor = 'bg-blue-600';
                  } else {
                    dateLabel = shiftDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
                    dateBgColor = 'bg-gray-600';
                  }

                  // Verifica se questo turno ha già un check-in (controlla sia shift_id che data)
                  const shiftCheckIn = todayCheckIns.find((ci: any) => {
                    const ciDate = ci.date; // "2025-10-08"
                    const shiftDate = shift.data_turno.split('T')[0]; // "2025-10-08"
                    return ci.shift_id === shift.turno_id && ciDate === shiftDate;
                  });
                  const hasCheckIn = !!shiftCheckIn;
                  const isActive = shiftCheckIn?.status === 'active';
                  const validation = validateShiftTiming(shift);

                  return (
                    <div key={shift.id} className={`bg-gray-700 rounded-lg p-4 border-l-4 ${hasCheckIn ? 'border-green-500' : 'border-purple-500'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`${dateBgColor} text-white px-3 py-1 rounded-full text-xs font-bold`}>{dateLabel}</span>
                        {hasCheckIn && (
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isActive ? 'bg-orange-600 text-white' : 'bg-green-600 text-white'}`}>
                            {isActive ? '🔥 IN CORSO' : '✅ COMPLETATO'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 mb-2">
                        <Building2 className="h-5 w-5 text-purple-400" />
                        <div className="flex-1">
                          <h4 className="font-medium text-white">Turno {shift.nome_magazzino}</h4>
                          <p className="text-xs text-purple-300 font-medium">📍 {shift.nome_magazzino}</p>
                          <p className="text-sm text-gray-300">{formatTime(shift.ora_inizio_turno)} - {formatTime(shift.ora_fine_turno)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                          {shift.crew_template_turni?.pausa_pranzo !== false ? '🍽️ Con pausa pranzo' : '⚡ Senza pausa pranzo'}
                        </span>
                        {!validation.isValid && (
                          <span className={`text-xs px-2 py-1 rounded-full ${validation.isExpired ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {validation.isExpired ? '⏰ Turno scaduto' : '⏳ Non ancora iniziato'}
                          </span>
                        )}
                        {validation.isValid && (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">Turno attivo</span>
                        )}
                      </div>

                      {!hasCheckIn ? (
                        <button
                          onClick={() => startCheckInProcess(shift)}
                          disabled={!isToday || !currentLocation || !validation.canCheckIn || (existingCheckIn && existingCheckIn.status === 'active')}
                          className={`w-full px-4 py-2 rounded-lg font-medium ${
                            isToday && validation.canCheckIn && currentLocation && (!existingCheckIn || existingCheckIn.status !== 'active')
                              ? 'bg-purple-600 text-white hover:bg-purple-700'
                              : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          {!isToday ? (daysUntilShift > 0 ? `Inizia tra ${daysUntilShift} ${daysUntilShift === 1 ? 'giorno' : 'giorni'}` : 'Turno passato') :
                           (existingCheckIn && existingCheckIn.status === 'active') ? 'Completa turno attivo' :
                           !currentLocation ? 'GPS Richiesto' :
                           validation.isExpired ? 'Turno Scaduto' :
                           !validation.canCheckIn ? 'Non Disponibile' :
                           'Inizia Check-in'}
                        </button>
                      ) : (
                        <div className="w-full px-4 py-2 rounded-lg font-medium bg-green-600 text-white text-center">
                          {isActive ? 'Turno in Corso' : 'Turno Completato'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="bg-blue-900 border border-blue-700 rounded-lg p-3">
                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-100">Processo Check-in Magazzino</h4>
                    <ol className="text-sm text-blue-200 mt-2 space-y-1 list-decimal list-inside">
                      <li>Verifica orario turno (deve essere attivo)</li>
                      <li>Verifica attivazione GPS</li>
                      <li>Selezione opzioni pasto (se turno con pausa)</li>
                      <li>Scansione QR code magazzino</li>
                      <li>Check-in con timer e auto-checkout programmato</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-semibold text-white mb-2">Nessun Turno Magazzino Oggi</h3>
              <p className="text-gray-300">
                Non hai turni di magazzino assegnati per oggi.
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Controlla il calendario per i prossimi turni.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Meal Selection View */}
      {currentView === 'meal_selection' && selectedShift && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Opzioni Pasto</h2>
            <button
              onClick={() => {
                setCurrentView('main');
                setSelectedShift(null);
              }}
              className="bg-gray-700 p-3 rounded-lg hover:bg-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-center mb-6">
              <Utensils className="h-12 w-12 mx-auto mb-2 text-orange-400" />
              <h3 className="text-xl font-bold text-white">Selezione Pasto</h3>
              <p className="text-gray-300 mt-1">
                Il turno "{selectedShift.nome_magazzino}" include pausa pranzo
              </p>
            </div>
            
            <div className="space-y-4">
              {/* Pasto Aziendale - Sempre disponibile */}
              <div className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                wantsCompanyMeal 
                  ? 'border-orange-500 bg-orange-600' 
                  : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
              }`} onClick={() => {
                setWantsCompanyMeal(!wantsCompanyMeal);
                if (!wantsCompanyMeal) setWantsMealVoucher(false); // Esclusivi
              }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      wantsCompanyMeal ? 'bg-white bg-opacity-20' : 'bg-orange-600'
                    }`}>
                      <Utensils className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">Pasto Aziendale</h4>
                      <p className="text-sm text-gray-300">
                        L'azienda anticipa il costo, verrà detratto dallo stipendio
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-orange-300">
                      €{mealBenefits?.pasto_aziendale_cost || 12.00}
                    </div>
                    <div className="text-xs text-gray-400">Costo</div>
                  </div>
                </div>
              </div>

              {/* Info Buono Pasto - Automatico se benefit attivo */}
              <div className={`border-2 rounded-xl p-4 ${
                mealBenefits?.buoni_pasto_enabled 
                  ? 'border-green-500 bg-green-600' 
                  : 'border-gray-600 bg-gray-700'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      mealBenefits?.buoni_pasto_enabled ? 'bg-white bg-opacity-20' : 'bg-gray-600'
                    }`}>
                      <Gift className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">Buono Pasto</h4>
                      <p className="text-sm text-gray-300">
                        {mealBenefits?.buoni_pasto_enabled 
                          ? '✅ Incluso automaticamente nel tuo contratto'
                          : '❌ Non incluso nel tuo contratto'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      mealBenefits?.buoni_pasto_enabled ? 'text-green-300' : 'text-gray-500'
                    }`}>
                      {mealBenefits?.buoni_pasto_enabled 
                        ? `€${mealBenefits?.buoni_pasto_value || 7.50}`
                        : 'Non disponibile'
                      }
                    </div>
                    <div className="text-xs text-gray-400">
                      {mealBenefits?.buoni_pasto_enabled ? 'Valore' : 'Benefit'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={proceedToScanner}
              className="w-full mt-6 bg-blue-600 text-white py-4 px-4 rounded-xl hover:bg-blue-700 font-bold text-lg shadow-lg"
            >
              ➡️ CONTINUA CON QR CODE
            </button>
          </div>
        </div>
      )}

      {/* Scanner View */}
      {currentView === 'scanner' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Scanner QR Magazzino</h2>
            <button
              onClick={() => {
                if (scannerRef.current) {
                  scannerRef.current.clear();
                }
                setShowScanner(false);
                setCurrentView('main');
                setSelectedShift(null);
              }}
              className="bg-gray-700 p-3 rounded-lg hover:bg-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-center mb-4">
              <QrCode className="h-12 w-12 mx-auto mb-2 text-purple-400" />
              <p className="text-white font-medium">Inquadra il QR Code del Magazzino</p>
              <p className="text-sm text-gray-400 mt-1">
                Posiziona il QR code al centro del riquadro
              </p>
            </div>
            
            {showScanner && (
              <div id="qr-reader" className="w-full max-w-sm mx-auto"></div>
            )}
            
            {scannerError && (
              <div className="mt-4 bg-red-900 border border-red-700 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <span className="text-red-200 text-sm">{scannerError}</span>
                </div>
              </div>
            )}
            
            {/* Manual QR Code Input */}
            <div className="mt-6 pt-6 border-t border-gray-600">
              <div className="text-center mb-4">
                <h4 className="text-white font-medium mb-2">Non riesci a scansionare?</h4>
                <p className="text-sm text-gray-400">Inserisci manualmente il codice backup del magazzino</p>
              </div>
              
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Inserisci codice backup o QR code..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400"
                  value={manualQrCode}
                  onChange={(e) => setManualQrCode(e.target.value.toUpperCase())}
                />
                
                
                <button
                  onClick={() => {
                    if (manualQrCode.trim()) {
                      processQrCodeCheckIn(manualQrCode.trim());
                    } else {
                      showWarning('Codice Richiesto', 'Inserisci un codice backup valido prima di procedere');
                    }
                  }}
                  disabled={!manualQrCode.trim()}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium"
                >
                  ✅ CONFERMA CODICE
                </button>
              </div>
            </div>
          </div>
          
          {/* Riepilogo selezioni */}
          {selectedShift && (
            <div className="bg-blue-900 rounded-xl p-4 border border-blue-700">
              <h4 className="font-medium text-blue-100 mb-3">Riepilogo Check-in</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-200">Turno:</span>
                  <span className="text-white font-medium">Turno {selectedShift.nome_magazzino}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-200">Orario:</span>
                  <span className="text-white font-medium">
                    {formatTime(selectedShift.ora_inizio_turno)} - {formatTime(selectedShift.ora_fine_turno)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-200">Pausa pranzo:</span>
                  <span className="text-white font-medium">
                    {selectedShift.crew_template_turni?.pausa_pranzo !== false ? '1 ora inclusa' : 'Nessuna pausa'}
                  </span>
                </div>
                {wantsCompanyMeal && (
                  <div className="flex justify-between">
                    <span className="text-blue-200">Pasto aziendale:</span>
                    <span className="text-orange-300 font-medium">€{mealBenefits?.pasto_aziendale_cost || 12.00}</span>
                  </div>
                )}
                {wantsMealVoucher && (
                  <div className="flex justify-between">
                    <span className="text-blue-200">Buono pasto:</span>
                    <span className="text-yellow-300 font-medium">€{mealBenefits?.buoni_pasto_value || 7.50}</span>
                  </div>
                )}
                
                {/* Validazione finale */}
                {shiftValidation && (
                  <div className="border-t border-blue-600 pt-2 mt-2">
                    <div className="flex items-center space-x-2">
                      {shiftValidation.isValid ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      )}
                      <span className={`text-sm ${
                        shiftValidation.isValid ? 'text-green-200' : 'text-red-200'
                      }`}>
                        {shiftValidation.reason}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="bg-purple-900 rounded-xl p-4 border border-purple-700">
            <div className="flex items-start space-x-3">
              <Camera className="h-5 w-5 text-purple-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-purple-100">Scanner QR Magazzino</h4>
                <ul className="text-sm text-purple-200 mt-2 space-y-1">
                  <li>• Punta la fotocamera verso il QR code del magazzino</li>
                  <li>• Mantieni il telefono fermo e stabile</li>
                  <li>• Assicurati che ci sia buona illuminazione</li>
                  <li>• Il QR code deve essere completamente visibile</li>
                  <li>• La posizione GPS verrà verificata automaticamente</li>
                </ul>
              </div>
            </div>
          </div>
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
                I check-in magazzino verranno salvati localmente e sincronizzati quando torni online
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Check-in Forzato */}
      {showForceCheckInModal && forceCheckInWarehouse && (
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
                  Stai per effettuare un check-in <strong>senza posizione GPS</strong>. Questo verrà registrato come "Check-in Forzato" e sarà visibile ai supervisori.
                </p>
              </div>

              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-white font-medium mb-2">Magazzino:</h4>
                <p className="text-gray-300 text-sm">{forceCheckInWarehouse.name}</p>
                <p className="text-gray-400 text-xs mt-1">{forceCheckInWarehouse.address}</p>
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
                  setForceCheckInWarehouse(null);
                  isProcessingScanRef.current = false; // Reset del ref quando si annulla
                }}
                className="flex-1 bg-gray-700 text-white py-3 px-4 rounded-lg hover:bg-gray-600 font-medium"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  if (forceCheckInWarehouse) {
                    // Il flag isProcessingScan viene gestito dentro handleWarehouseCheckIn
                    handleWarehouseCheckIn(forceCheckInWarehouse, true);
                    setShowForceCheckInModal(false);
                    setForceCheckInWarehouse(null);
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

      {/* Modal Inserimento Tardivo Pausa */}
      {showLateBreakModal && lateBreakCheckIn && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-orange-500">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-orange-900 p-3 rounded-full">
                <Coffee className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Inserisci Pausa Pranzo</h3>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4">
                <p className="text-orange-300 text-sm mb-2">
                  <strong>Pausa Non Registrata</strong>
                </p>
                <p className="text-orange-200 text-xs">
                  Non hai registrato la pausa pranzo durante il turno. Puoi ancora inserire manualmente gli orari entro 8 ore dal check-out.
                </p>
              </div>

              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-white font-medium mb-2">Turno:</h4>
                <p className="text-gray-300 text-sm">{lateBreakCheckIn.nome_turno}</p>
                <p className="text-gray-400 text-xs mt-1">
                  {new Date(lateBreakCheckIn.date).toLocaleDateString('it-IT')} • {lateBreakCheckIn.check_in_time} - {lateBreakCheckIn.check_out_time}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-white font-medium mb-2">Orario Inizio Pausa</label>
                  <input
                    type="time"
                    value={lateBreakStart}
                    onChange={(e) => setLateBreakStart(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">Orario Fine Pausa</label>
                  <input
                    type="time"
                    value={lateBreakEnd}
                    onChange={(e) => setLateBreakEnd(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
                  />
                </div>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                <p className="text-yellow-300 text-xs">
                  ⚠️ La posizione GPS non verrà registrata per questa pausa. Inserendo gli orari manualmente, la pausa verrà marcata come "inserita in ritardo".
                </p>
              </div>

              {lateBreakStart && lateBreakEnd && lateBreakEnd > lateBreakStart && (
                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                  <p className="text-blue-300 text-sm text-center">
                    Durata pausa: <strong>{calculateBreakDuration(lateBreakStart, lateBreakEnd)} minuti</strong>
                  </p>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowLateBreakModal(false);
                  setLateBreakCheckIn(null);
                  setLateBreakStart('');
                  setLateBreakEnd('');
                }}
                className="flex-1 bg-gray-700 text-white py-3 px-4 rounded-lg hover:bg-gray-600 font-medium"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveLateBreak}
                disabled={!lateBreakStart || !lateBreakEnd}
                className="flex-1 bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium"
              >
                Salva Pausa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Forzatura Pausa Senza GPS */}
      {showForceBreakModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-yellow-500">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-yellow-900 p-3 rounded-full">
                <AlertCircle className="h-6 w-6 text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold text-white">GPS Non Disponibile</h3>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                <p className="text-yellow-200 text-sm mb-2">
                  Il sistema GPS non è disponibile o non funziona correttamente.
                </p>
                <p className="text-yellow-300 text-xs">
                  {forceBreakType === 'start'
                    ? 'Non è possibile registrare la posizione di inizio pausa.'
                    : 'Non è possibile registrare la posizione di fine pausa.'}
                </p>
              </div>

              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                <p className="text-red-300 text-sm font-medium mb-2">
                  ⚠️ Opzione Forzatura
                </p>
                <p className="text-red-200 text-xs mb-3">
                  Puoi procedere senza GPS, ma questa azione verrà registrata come <strong>FORZATA</strong> nel sistema e l'azienda verrà notificata.
                </p>
                <p className="text-red-300 text-xs">
                  Consigliamo di:
                </p>
                <ul className="text-red-200 text-xs list-disc list-inside mt-2 space-y-1">
                  <li>Verificare che il GPS sia attivato nelle impostazioni</li>
                  <li>Controllare i permessi dell'app</li>
                  <li>Spostarsi in un'area con migliore copertura</li>
                </ul>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowForceBreakModal(false);
                  setForceBreakType(null);
                }}
                className="flex-1 bg-gray-700 text-white py-3 px-4 rounded-lg hover:bg-gray-600 font-medium"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  setShowForceBreakModal(false);
                  if (forceBreakType === 'start') {
                    handleStartBreak(true);
                  } else {
                    handleEndBreak(true);
                  }
                  setForceBreakType(null);
                }}
                className="flex-1 bg-yellow-600 text-white py-3 px-4 rounded-lg hover:bg-yellow-700 font-medium"
              >
                Forza Senza GPS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Conferma Check-out */}
      {showCheckOutConfirmModal && currentSession && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 p-4"
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
        >
          <div 
            className="bg-gray-800 rounded-xl max-w-md w-full p-4 border border-red-500 max-h-[85vh] overflow-y-auto absolute"
            style={{
              left: modalPosition.x ? `${modalPosition.x}px` : '50%',
              top: modalPosition.y ? `${modalPosition.y}px` : '50%',
              transform: modalPosition.x ? 'none' : 'translate(-50%, -50%)',
              cursor: isDragging ? 'grabbing' : 'default'
            }}
          >
            <div 
              className="flex items-center space-x-2 mb-3 cursor-grab active:cursor-grabbing select-none"
              onTouchStart={handleDragStart}
              onMouseDown={handleDragStart}
            >
              <div className="bg-red-900 p-2 rounded-full">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white flex-1">Conferma Check-out</h3>
              <div className="text-gray-400 text-xs flex items-center space-x-1">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                </svg>
                <span>Trascina</span>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-gray-400">Turno:</span>
                    <span className="text-white font-medium text-xs text-right ml-2">{currentSession.shiftName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Check-in:</span>
                    <span className="text-white">{formatTime(currentSession.checkInTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tempo:</span>
                    <span className="text-white font-medium">{elapsedTime}</span>
                  </div>
                  {currentSession.hasLunchBreak && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Pausa:</span>
                      <span className="text-white text-xs">
                        {breakInProgress ? '⏸️ In corso' : breakStartTime ? '✅ Fatta' : '⚠️ Non fatta'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Note Turno inserite DURANTE il turno (readonly) */}
              {noteTurno && (
                <div className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 rounded-lg p-3 border border-blue-600">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-blue-200 font-medium text-sm flex items-center space-x-2">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>📝 Note scritte durante il turno:</span>
                    </label>
                    <button
                      onClick={() => setNoteTurnoExpanded(!noteTurnoExpanded)}
                      className="text-blue-300 text-xs px-2 py-1 bg-blue-800/50 rounded hover:bg-blue-700/50 transition-colors flex items-center space-x-1"
                    >
                      <span>{noteTurnoExpanded ? 'Comprimi' : 'Espandi'}</span>
                      <svg className={`h-3 w-3 transition-transform ${noteTurnoExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <div className={`bg-gray-800/70 text-blue-100 border border-blue-700 rounded-lg p-2.5 text-sm italic whitespace-pre-wrap transition-all overflow-hidden ${
                    noteTurnoExpanded ? 'max-h-[400px] overflow-y-auto' : 'max-h-[80px]'
                  }`}>
                    {noteTurno}
                  </div>
                  {!noteTurnoExpanded && noteTurno.length > 100 && (
                    <div className="text-blue-400 text-xs mt-1 italic">... clicca "Espandi" per vedere tutto</div>
                  )}
                  <p className="text-blue-300 text-xs mt-1.5 italic">
                    ✓ Queste note sono state salvate in NoteTurno
                  </p>
                </div>
              )}

              {/* Note Checkout - Nuove note di fine turno */}
              <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg p-3 border border-gray-600">
                <label className="block text-white font-medium mb-1.5 text-sm flex items-center space-x-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>🏁 Vuoi aggiungere note di fine turno?</span>
                </label>
                <p className="text-gray-400 text-xs mb-2">
                  {noteTurno 
                    ? 'Puoi aggiungere ulteriori osservazioni finali, problemi o consegne' 
                    : 'Aggiungi eventuali osservazioni, problemi riscontrati o consegne da fare'}
                </p>
                <textarea
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder={noteTurno 
                    ? "Note aggiuntive di fine turno (opzionali)..." 
                    : "Note di fine turno (opzionali)..."}
                  className="w-full bg-gray-900 text-white border-2 border-gray-600 rounded-lg p-2.5 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500 min-h-[80px] placeholder-gray-500 transition-all"
                  maxLength={500}
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-gray-400 text-xs italic">
                    {checkoutNotes.length > 0 ? '✓ Salvate in "notes" al checkout' : 'Facoltative'}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {checkoutNotes.length}/500
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowCheckOutConfirmModal(false);
                  setCheckoutNotes('');
                }}
                className="flex-1 bg-gray-700 text-white py-2.5 px-3 rounded-lg hover:bg-gray-600 font-medium text-sm"
              >
                Annulla
              </button>
              <button
                onClick={confirmCheckOut}
                className="flex-1 bg-red-600 text-white py-2.5 px-3 rounded-lg hover:bg-red-700 font-medium text-sm"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseCheckIn;