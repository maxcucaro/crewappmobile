import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToastContext } from '../../../context/ToastContext';
import { useGPSLocation } from '../../../hooks/useGPSLocation';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import { usePersistentTimer } from '../../../hooks/usePersistentTimer';
import { supabase } from '../../../lib/db';
import { toLocalDateString } from '../../../utils/dateUtils';

const MIN_DESIRED_ACCURACY = 50; // metri consigliati per considerare la posizione "buona"

const ExtraCheckIn: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToastContext();
  const { currentLocation, getCurrentLocation, isLoading: gpsLoading, error: gpsError } = useGPSLocation();
  const { isOnline, addOfflineData } = useOfflineSync();
  const {
    currentSession,
    elapsedTime,
    elapsedTimes,
    startSession,
    endSession,
    manualCheckOut,
    loadActiveSession
  } = usePersistentTimer();

  // Meal / benefits
  const [wantsCompanyMeal, setWantsCompanyMeal] = useState(false);
  const [wantsMealVoucher, setWantsMealVoucher] = useState(false);
  const [mealBenefits, setMealBenefits] = useState<any>(null);

  // Extra shift benefits (turno extra)
  const [extraShiftBenefit, setExtraShiftBenefit] = useState<{ tariffa_id: string; importo_orario: number } | null>(null);

  // Note turno (campo libero)
  const [noteTurno, setNoteTurno] = useState<string>('');

  // UI states
  const [showForceCheckinModal, setShowForceCheckinModal] = useState(false);
  const [showForceCheckoutModal, setShowForceCheckoutModal] = useState(false);
  const [isCheckedInLocally, setIsCheckedInLocally] = useState(false); // immediate button disable fallback

  // Pauses state (local optimistic states; final truth comes from currentSession + pending flags)
  const [isLunchOn, setIsLunchOn] = useState(false);
  const [lunchTaken, setLunchTaken] = useState(false);
  const [isDinnerOn, setIsDinnerOn] = useState(false);
  const [dinnerTaken, setDinnerTaken] = useState(false);

  const pad = (n: number) => n.toString().padStart(2, '0');

  const timeStringNow = (): string => {
    const now = new Date();
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const parseTimeToDate = (timeStr: string, referenceDate?: string): Date => {
    const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
    let base = new Date();
    if (referenceDate) {
      const parts = referenceDate.split('-').map(Number);
      if (parts.length === 3) {
        base = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      }
    }
    base.setHours(hh, mm, 0, 0);
    return base;
  };

  const minutesBetween = (start: string, end: string, referenceDate?: string): number => {
    if (!start || !end) return 0;
    const s = parseTimeToDate(start, referenceDate);
    let e = parseTimeToDate(end, referenceDate);
    if (e.getTime() < s.getTime()) {
      e = new Date(e.getTime() + 24 * 60 * 60 * 1000);
    }
    return Math.round((e.getTime() - s.getTime()) / 60000);
  };

  // helpers for pending flags in localStorage
  const pendingKey = (sessionId: string, type: 'lunch' | 'dinner') => `cs_pending_${sessionId}_${type}`;
  const setPending = (sessionId: string, type: 'lunch' | 'dinner') => {
    try { localStorage.setItem(pendingKey(sessionId, type), '1'); } catch (e) { /* ignore */ }
  };
  const clearPending = (sessionId: string, type: 'lunch' | 'dinner') => {
    try { localStorage.removeItem(pendingKey(sessionId, type)); } catch (e) { /* ignore */ }
  };
  const hasPendingForSession = (sessionId: string | undefined, type: 'lunch' | 'dinner') => {
    if (!sessionId) return false;
    try { return !!localStorage.getItem(pendingKey(sessionId, type)); } catch (e) { return false; }
  };
  const hasAnyPending = (type: 'lunch' | 'dinner') => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (k.startsWith('cs_pending_') && k.endsWith(`_${type}`)) return true;
      }
      return false;
    } catch (e) { return false; }
  };

  // LOADERS
  const loadMealBenefits = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('employee_meal_benefits')
        .select('*')
        .eq('dipendente_id', user?.id)
        .eq('attivo', true)
        .maybeSingle();

      if (!error && data) {
        setMealBenefits(data);
        setWantsMealVoucher(Boolean(data.buoni_pasto_enabled));
      } else {
        setMealBenefits({ buoni_pasto_enabled: false, buoni_pasto_value: 7.5, pasto_aziendale_cost: 12.0 });
      }
    } catch (err) {
      setMealBenefits({ buoni_pasto_enabled: false, buoni_pasto_value: 7.5, pasto_aziendale_cost: 12.0 });
    }
  }, [user?.id]);

  const loadExtraShiftBenefit = useCallback(async () => {
    if (!user?.id) return;

    try {
      const TURNO_EXTRA_TARIFFA_ID = 'e6427847-3291-424f-a092-4bec548859cf';

      // 1. Carica l'assegnazione tariffe del dipendente
      const { data: assegnazione, error: assegnazioneError } = await supabase
        .from('crew_assegnazionetariffa')
        .select('tariffe_ids, tariffe_personalizzate, tariffe_overrides')
        .eq('dipendente_id', user.id)
        .eq('attivo', true)
        .maybeSingle();

      if (assegnazioneError || !assegnazione || !assegnazione.tariffe_ids || assegnazione.tariffe_ids.length === 0) {
        setExtraShiftBenefit(null);
        return;
      }

      // 2. Verifica se il dipendente ha la tariffa turno extra specifica assegnata
      if (!assegnazione.tariffe_ids.includes(TURNO_EXTRA_TARIFFA_ID)) {
        setExtraShiftBenefit(null);
        return;
      }

      // 3. Carica i dettagli della tariffa turno extra
      const { data: tariffa, error: tariffaError } = await supabase
        .from('crew_tariffe')
        .select('id, nome_tariffa, importo')
        .eq('id', TURNO_EXTRA_TARIFFA_ID)
        .maybeSingle();

      if (tariffaError || !tariffa) {
        setExtraShiftBenefit(null);
        return;
      }

      // 4. Determina l'importo orario (priorità: personalizzato > override > standard)
      let importo_orario = parseFloat(String(tariffa.importo || 0));

      // PRIMA: Controlla personalizzato
      if (assegnazione.tariffe_personalizzate && assegnazione.tariffe_personalizzate[TURNO_EXTRA_TARIFFA_ID]) {
        importo_orario = parseFloat(String(assegnazione.tariffe_personalizzate[TURNO_EXTRA_TARIFFA_ID]));
      }
      // SECONDA: Controlla override
      else if (assegnazione.tariffe_overrides && assegnazione.tariffe_overrides[TURNO_EXTRA_TARIFFA_ID]) {
        importo_orario = parseFloat(String(assegnazione.tariffe_overrides[TURNO_EXTRA_TARIFFA_ID]));
      }

      // 5. Salva il benefit solo se importo > 0
      if (importo_orario > 0) {
        setExtraShiftBenefit({
          tariffa_id: TURNO_EXTRA_TARIFFA_ID,
          importo_orario
        });
      } else {
        setExtraShiftBenefit(null);
      }
    } catch (err) {
      console.error('Errore caricamento benefit turno extra:', err);
      setExtraShiftBenefit(null);
    }
  }, [user?.id]);

  useEffect(() => {
    loadMealBenefits();
    loadExtraShiftBenefit();
  }, [loadMealBenefits, loadExtraShiftBenefit]);

  // PWA: ensure rehydration of active session on mount and when tab becomes visible
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let attempts = 0;

    const tryLoad = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      attempts += 1;
      try {
        if (typeof loadActiveSession === 'function') {
          await loadActiveSession();
          console.debug('ExtraCheckIn: loadActiveSession executed (PWA)');
          attempts = 0;
        }
      } catch (err) {
        console.error('ExtraCheckIn: loadActiveSession failed (PWA)', err);
        if (attempts < 5 && !cancelled) {
          const delay = Math.min(30000, 500 * Math.pow(2, attempts));
          setTimeout(() => { if (!cancelled) tryLoad(); }, delay);
        }
      } finally {
        inFlight = false;
      }
    };

    tryLoad();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') tryLoad();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep local pause flags in sync with currentSession + pending flags
  useEffect(() => {
    if (currentSession) {
      const cs: any = currentSession as any;

      const lunchOnFromServer = Boolean(cs.pausa_pranzo_inizio && !cs.pausa_pranzo_fine);
      const lunchTakenFromServer = Boolean(cs.pausa_pranzo_fine);
      const dinnerOnFromServer = Boolean(cs.pausa_cena_inizio && !cs.pausa_cena_fine);
      const dinnerTakenFromServer = Boolean(cs.pausa_cena_fine);

      // if there's a pending flag for this session, treat as 'on' until server confirms
      const pendingLunch = hasPendingForSession(cs.id, 'lunch');
      const pendingDinner = hasPendingForSession(cs.id, 'dinner');

      setIsLunchOn(lunchOnFromServer || pendingLunch);
      setLunchTaken(lunchTakenFromServer);
      setIsDinnerOn(dinnerOnFromServer || pendingDinner);
      setDinnerTaken(dinnerTakenFromServer);

      // clear pending if server shows the start time present (server confirmed)
      if (cs.pausa_pranzo_inizio) clearPending(cs.id, 'lunch');
      if (cs.pausa_cena_inizio) clearPending(cs.id, 'dinner');
    } else {
      // no active session yet: use any pending flags (from previous session) to keep UI consistent until loadActiveSession populates
      const anyPendingLunch = hasAnyPending('lunch');
      const anyPendingDinner = hasAnyPending('dinner');
      setIsLunchOn(anyPendingLunch);
      setLunchTaken(false);
      setIsDinnerOn(anyPendingDinner);
      setDinnerTaken(false);
      // do not aggressively clear these: they will be reconciled when loadActiveSession runs
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id, currentSession?.type, (currentSession as any)?.pausa_pranzo_inizio, (currentSession as any)?.pausa_pranzo_fine, (currentSession as any)?.pausa_cena_inizio, (currentSession as any)?.pausa_cena_fine]);

  // Utility: get current hour/minute in Italian timezone (Europe/Rome)
  const getItalyHourMinute = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Rome',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(new Date());

      const hourPart = parts.find(p => p.type === 'hour')?.value ?? '00';
      const minutePart = parts.find(p => p.type === 'minute')?.value ?? '00';
      const hour = parseInt(hourPart, 10);
      const minute = parseInt(minutePart, 10);
      return { hour: Number.isNaN(hour) ? 0 : hour, minute: Number.isNaN(minute) ? 0 : minute };
    } catch (e) {
      // fallback to local time if Intl fails
      const d = new Date();
      return { hour: d.getHours(), minute: d.getMinutes() };
    }
  };

  // Returns allowed pauses according to the rules:
  // 08:00 — 16:00  => only lunch
  // 16:01 — 17:00  => both
  // 17:01 — 23:59  => only dinner
  // outside these ranges default to only lunch (early hours)
  const getPauseAvailability = () => {
    const { hour, minute } = getItalyHourMinute();
    const minutesOfDay = hour * 60 + minute;
    const from = (h: number, m = 0) => h * 60 + m;

    if (minutesOfDay >= from(8, 0) && minutesOfDay <= from(16, 0)) {
      return { allowLunch: true, allowDinner: false };
    }
    if (minutesOfDay >= from(16, 1) && minutesOfDay <= from(17, 0)) {
      return { allowLunch: true, allowDinner: true };
    }
    if (minutesOfDay >= from(17, 1) && minutesOfDay <= from(23, 59)) {
      return { allowLunch: false, allowDinner: true };
    }
    // default early-morning behavior: only lunch
    return { allowLunch: true, allowDinner: false };
  };

  // UI helper to show GPS summary (avoid printing huge/imprecise accuracy)
  const renderGpsStatus = () => {
    if (gpsLoading) {
      return <p className="text-xs text-yellow-300">Rilevamento GPS in corso...</p>;
    }
    if (currentLocation) {
      const rawAcc = currentLocation.accuracy ?? null;
      const acc = typeof rawAcc === 'number' ? Math.abs(Math.round(rawAcc)) : null;
      const lat = typeof currentLocation.latitude === 'number' ? currentLocation.latitude.toFixed(5) : '';
      const lon = typeof currentLocation.longitude === 'number' ? currentLocation.longitude.toFixed(5) : '';
      const isGood = typeof acc === 'number' ? acc <= MIN_DESIRED_ACCURACY : false;

      // If accuracy extremely large or not a number, treat as unavailable
      if (acc === null || acc >= 100000) {
        return <p className="text-xs text-red-300">GPS non affidabile — precisione troppo bassa</p>;
      }

      if (acc >= 1000) {
        return <p className="text-xs text-yellow-300">Precisione GPS insufficiente (≈ {acc} m). Premi "Aggiorna GPS".</p>;
      }

      return (
        <>
          <p className={`text-xs ${isGood ? 'text-green-300' : 'text-yellow-300'}`}>
            OK — { (isGood || acc < 1000) ? (currentLocation.address || `${lat}, ${lon}`) : 'Posizione disponibile' } (±{acc}m){isGood ? '' : ' — precisione migliorabile'}
          </p>
          {!isGood && <p className="text-xs text-gray-400">Consiglio: clicca "Aggiorna GPS" finché l'accuratezza è ≤ {MIN_DESIRED_ACCURACY} m.</p>}
        </>
      );
    }
    return <p className="text-xs text-red-300">{gpsError || 'GPS non disponibile'}</p>;
  };

  // CHECK-IN (returns boolean success)
  const handleExtraCheckIn = async (forceCheckin: boolean = false): Promise<boolean> => {
    // ensure latest GPS if user wants
    if (!currentLocation && !forceCheckin) {
      showWarning('GPS Richiesto', 'Sto tentando di ottenere la posizione GPS per il check-in...');
      await getCurrentLocation({ requiredAccuracy: MIN_DESIRED_ACCURACY, maxRetries: 3 });
    }

    let location = currentLocation;
    let forced = false;
    let gpsErrorReason: string | null = null;

    if (!location && !forceCheckin) {
      showWarning('Nessun GPS', 'Impossibile ottenere la posizione. Puoi forzare il check-in senza GPS.');
      return false;
    }

    if (!location && forceCheckin) {
      forced = true;
      gpsErrorReason = gpsError || 'GPS non disponibile - Check-in forzato';
    }

    const now = new Date();
    const checkInTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const today = toLocalDateString(now);

    const checkInData: any = {
      crew_id: user?.id,
      date: today,
      check_in_time: checkInTime,
      status: 'active',
      location: location ? {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        accuracy: location.accuracy,
        timestamp: location.timestamp ? location.timestamp.toISOString() : new Date().toISOString()
      } : null,
      forced_checkin: forced,
      gps_error_reason: gpsErrorReason,
      break_minutes: 60,
      company_meal: wantsCompanyMeal,
      meal_voucher: wantsMealVoucher,
      meal_cost: wantsCompanyMeal ? (mealBenefits?.pasto_aziendale_cost || 12.00) : 0.00,
      meal_notes: wantsCompanyMeal ? 'Pasto aziendale richiesto' : wantsMealVoucher ? 'Buono pasto richiesto' : null,
      notes: 'TURNO EXTRA',
      NoteTurno: noteTurno || null,
      benefit_tariffa_id: extraShiftBenefit?.tariffa_id || null,
      benefit_importo_orario: extraShiftBenefit?.importo_orario || null
    };

    try {
      if (isOnline) {
        console.log('Tentativo check-in con dati:', checkInData);
        const { data, error } = await supabase.from('extra_shifts_checkins').insert(checkInData).select().single();
        if (error) {
          console.error('Errore insert extra checkin:', error);
          console.error('Dettagli errore:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          addOfflineData('checkin', checkInData);
          showWarning('Check-in Offline', `Problema salvataggio sul server: ${error.message}. Il check-in è stato salvato offline e verrà sincronizzato.`);
          return false;
        }

        // Avvia la sessione locale
        startSession({
          id: data.id,
          type: 'extra',
          warehouseId: null,
          checkInTime,
          scheduledEndTime: null,
          shiftName: 'Turno Extra',
          shiftStartTime: null,
          shiftEndTime: null,
          hasLunchBreak: true,
          hasCompanyMeal: wantsCompanyMeal,
          hasMealVoucher: wantsMealVoucher,
          breakTime: 60,
          tableName: 'extra_shifts_checkins'
        });

        // immediate local disable to avoid double-checkin while context propagates
        setIsCheckedInLocally(true);

        showSuccess('Check-in Extra', `Check-in extra registrato alle ${checkInTime}`);

        // If forced, show the requested post-checkin warning
        if (forced) {
          showWarning(
            'Attenzione GPS',
            'Consigliamo di risolvere il problema GPS prima del check-in. Se continui, il sistema registrerà l\'assenza della posizione.',
            8000
          );
        }

        if (typeof loadActiveSession === 'function') await loadActiveSession();
        return true;
      } else {
        addOfflineData('checkin', checkInData);
        setIsCheckedInLocally(true);
        showInfo('Check-in Offline', 'Check-in extra salvato offline - verrà sincronizzato quando torni online');
        return true;
      }
    } catch (err) {
      console.error('Errore durante check-in extra:', err);
      showError('Errore', 'Si è verificato un errore durante il check-in extra. Riprova.');
      return false;
    }
  };

  // CONFIRM forced checkin flow: open modal -> if confirmed run handleExtraCheckIn(true)
  const onRequestForceCheckin = () => {
    setShowForceCheckinModal(true);
  };

  const confirmForceCheckin = async () => {
    setShowForceCheckinModal(false);
    await handleExtraCheckIn(true);
  };

  // CHECKOUT: acquisizione posizione finale e salvataggio su checkout_location
  const confirmExtraCheckOut = async (forceCheckout: boolean = false) => {
    try {
      showInfo('Check-out in corso...', 'Sto completando il turno extra', 1500);

      let finalLocation = currentLocation;

      if (!forceCheckout) {
        // richiedi aggiornamento GPS prima del checkout per acquisire posizione finale
        await getCurrentLocation({ requiredAccuracy: MIN_DESIRED_ACCURACY, maxRetries: 2 });
        finalLocation = currentLocation;
        if (!finalLocation) {
          showWarning('Nessun GPS', 'Non è stata acquisita una posizione valida. Puoi riprovare ad aggiornare GPS o forzare il checkout.');
          return;
        }
      }

      // chiama manualCheckOut passando la posizione finale (se il hook lo supporta)
      const success = await manualCheckOut(finalLocation);
      if (!success) {
        showError('Errore Check-out', 'Si è verificato un errore durante il check-out. Riprova.');
        return;
      }

      // salva NoteTurno + checkout_location (no distance calculation because no warehouse)
      try {
        if (currentSession && currentSession.id) {
          let checkout_location: any = null;

          if (finalLocation) {
            checkout_location = {
              latitude: finalLocation.latitude,
              longitude: finalLocation.longitude,
              address: finalLocation.address,
              accuracy: finalLocation.accuracy,
              timestamp: finalLocation.timestamp ? finalLocation.timestamp.toISOString() : new Date().toISOString()
            };
          }

          if (isOnline) {
            const { error } = await supabase
              .from('extra_shifts_checkins')
              .update({
                NoteTurno: noteTurno || null,
                checkout_location
              })
              .eq('id', currentSession.id);

            if (error) {
              console.error('Errore salvataggio checkout extra:', error);
              addOfflineData('checkout_notes', { id: currentSession.id, NoteTurno: noteTurno, checkout_location });
            }
          } else {
            addOfflineData('checkout_notes', { id: currentSession.id, NoteTurno: noteTurno, checkout_location });
          }
        }
      } catch (noteErr) {
        console.error('Errore salvataggio NoteTurno/checkout_location:', noteErr);
      }

      // end local session
      endSession();
      setNoteTurno('');
      setIsCheckedInLocally(false);
      setIsLunchOn(false);
      setLunchTaken(false);
      setIsDinnerOn(false);
      setDinnerTaken(false);
      showSuccess('Check-out Completato', `Turno extra terminato. Tempo totale: ${elapsedTime}`);
      if (typeof loadActiveSession === 'function') await loadActiveSession();
    } catch (err) {
      console.error('Errore conferma check-out extra:', err);
      showError('Errore Sistema', 'Errore imprevisto durante il check-out extra');
    }
  };

  // Trigger modal before checkout: if GPS absent or accuracy poor, show modal with options
  const onRequestCheckout = async () => {
    const accuracy = currentLocation?.accuracy;
    const gpsAvailable = Boolean(currentLocation);
    const gpsGood = typeof accuracy === 'number' ? accuracy <= MIN_DESIRED_ACCURACY : false;

    if (!gpsAvailable || !gpsGood) {
      setShowForceCheckoutModal(true);
      return;
    }

    await confirmExtraCheckOut(false);
  };

  const retryGpsAndCheckout = async () => {
    setShowForceCheckoutModal(false);
    await getCurrentLocation({ requiredAccuracy: MIN_DESIRED_ACCURACY, maxRetries: 3 });
    if (currentLocation) {
      await confirmExtraCheckOut(false);
    } else {
      setShowForceCheckoutModal(true);
    }
  };

  const confirmForceCheckout = async () => {
    setShowForceCheckoutModal(false);
    await confirmExtraCheckOut(true);
    showWarning(
      'Attenzione GPS',
      'Hai terminato il turno senza posizione finale. Il checkout viene registrato senza coordinate.',
      8000
    );
  };

  // PAUSES: Lunch / Dinner (pausa pranzo -> pausa cena linear flow)
  const handleStartLunch = async (forceWithoutGPS: boolean = false) => {
    if (!currentSession || currentSession.type !== 'extra') {
      showError('Errore', 'Nessuna sessione attiva per avviare la pausa');
      return;
    }

    const { allowLunch } = getPauseAvailability();
    if (!allowLunch) {
      showWarning('Pausa Pranzo', 'La pausa pranzo non è disponibile in questa fascia oraria');
      return;
    }

    if (isLunchOn || lunchTaken) {
      showWarning('Pausa', 'La pausa pranzo è già attiva o completata');
      return;
    }

    let location = currentLocation;
    if (!location && !forceWithoutGPS) {
      showWarning('GPS Non Disponibile', 'Richiesta attivazione GPS per registrare la pausa...');
      await getCurrentLocation({ requiredAccuracy: MIN_DESIRED_ACCURACY, maxRetries: 2 });
      location = currentLocation;
      if (!location) {
        showWarning('Nessun GPS', 'Impossibile ottenere la posizione. Puoi forzare la pausa senza GPS.');
        return;
      }
    }

    const startTime = timeStringNow();
    const updateData: any = {
      pausa_pranzo_inizio: startTime,
      break_start_time: startTime
    };
    if (location) {
      updateData.break_start_location = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        accuracy: location.accuracy,
        timestamp: location.timestamp ? location.timestamp.toISOString() : new Date().toISOString()
      };
    }

    const { error } = await supabase.from('extra_shifts_checkins').update(updateData).eq('id', currentSession.id);
    if (error) {
      console.error('Errore salvataggio inizio pausa pranzo:', error);
      showError('Errore', 'Impossibile salvare inizio pausa pranzo');
      return;
    }

    // optimistic: mark pending so UI stays consistent if user leaves app before rehydration
    setPending(currentSession.id, 'lunch');
    setIsLunchOn(true);
    setLunchTaken(false);
    showSuccess('Pausa Iniziata', `Pausa pranzo iniziata alle ${startTime}`);
    if (typeof loadActiveSession === 'function') await loadActiveSession();
  };

  const handleEndLunch = async (forceWithoutGPS: boolean = false) => {
    if (!currentSession || currentSession.type !== 'extra') {
      showError('Errore', 'Nessuna sessione attiva per terminare la pausa');
      return;
    }
    if (!isLunchOn) {
      showWarning('Pausa', 'La pausa pranzo non risulta avviata');
      return;
    }

    let location = currentLocation;
    if (!location && !forceWithoutGPS) {
      showWarning('GPS Non Disponibile', 'Richiesta attivazione GPS per registrare la fine pausa...');
      await getCurrentLocation({ requiredAccuracy: MIN_DESIRED_ACCURACY, maxRetries: 2 });
      location = currentLocation;
      if (!location) {
        showWarning('Nessun GPS', 'Impossibile ottenere la posizione. Puoi forzare la fine pausa senza GPS.');
        return;
      }
    }

    const endTime = timeStringNow();
    const cs: any = currentSession as any;
    const referenceDate = cs?.date || toLocalDateString(new Date());
    const lunchMinutes = minutesBetween(cs?.pausa_pranzo_inizio || cs?.break_start_time || '', endTime, referenceDate);

    const updateData: any = {
      pausa_pranzo_fine: endTime,
      pausa_pranzo_minuti: lunchMinutes,
      has_taken_break: true,
      break_end_time: endTime
    };
    if (location) {
      updateData.break_end_location = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        accuracy: location.accuracy,
        timestamp: location.timestamp ? location.timestamp.toISOString() : new Date().toISOString()
      };
    }
    const existingDinnerMinutes = (cs?.pausa_cena_minuti && Number(cs.pausa_cena_minuti)) || 0;
    updateData.pausa_totale_minuti = (lunchMinutes || 0) + existingDinnerMinutes;

    const { error } = await supabase.from('extra_shifts_checkins').update(updateData).eq('id', currentSession.id);
    if (error) {
      console.error('Errore salvataggio fine pausa pranzo:', error);
      showError('Errore', 'Impossibile salvare fine pausa pranzo');
      return;
    }

    // clear pending (server confirmed)
    clearPending(currentSession.id, 'lunch');

    setIsLunchOn(false);
    setLunchTaken(true);
    setIsDinnerOn(false);
    setDinnerTaken(false);

    showSuccess('Pausa Terminata', `Fine pausa pranzo registrata alle ${endTime} (${lunchMinutes} minuti)`);
    if (typeof loadActiveSession === 'function') await loadActiveSession();
  };

  const handleStartDinner = async (forceWithoutGPS: boolean = false) => {
    if (!currentSession || currentSession.type !== 'extra') {
      showError('Errore', 'Nessuna sessione attiva per avviare la pausa cena');
      return;
    }

    const { allowDinner } = getPauseAvailability();
    const allowDinnerEffective = allowDinner || lunchTaken; // allow dinner if time window OR if lunch already taken

    if (!allowDinnerEffective) {
      showWarning('Pausa Cena', 'La pausa cena non è disponibile in questa fascia oraria');
      return;
    }

    if (isDinnerOn || dinnerTaken) {
      showWarning('Pausa Cena', 'La pausa cena è già attiva o completata');
      return;
    }

    let location = currentLocation;
    if (!location && !forceWithoutGPS) {
      showWarning('GPS Non Disponibile', 'Richiesta attivazione GPS per registrare la pausa...');
      await getCurrentLocation({ requiredAccuracy: MIN_DESIRED_ACCURACY, maxRetries: 2 });
      location = currentLocation;
      if (!location) {
        showWarning('Nessun GPS', 'Impossibile ottenere la posizione. Puoi forzare la pausa senza GPS.');
        return;
      }
    }

    const startTime = timeStringNow();
    const updateData: any = {
      pausa_cena_inizio: startTime
    };
    if (location) {
      updateData.pausa_cena_start_location = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        accuracy: location.accuracy,
        timestamp: location.timestamp ? location.timestamp.toISOString() : new Date().toISOString()
      };
    }

    const { error } = await supabase.from('extra_shifts_checkins').update(updateData).eq('id', currentSession.id);
    if (error) {
      console.error('Errore salvataggio inizio pausa cena:', error);
      showError('Errore', 'Impossibile salvare inizio pausa cena');
      return;
    }

    // optimistic: mark pending so UI stays consistent if user leaves app before rehydration
    setPending(currentSession.id, 'dinner');
    setIsDinnerOn(true);
    setDinnerTaken(false);
    showSuccess('Pausa Cena Iniziata', `Pausa cena iniziata alle ${startTime}`);
    if (typeof loadActiveSession === 'function') await loadActiveSession();
  };

  const handleEndDinner = async (forceWithoutGPS: boolean = false) => {
    if (!currentSession || currentSession.type !== 'extra') {
      showError('Errore', 'Nessuna sessione attiva per terminare la pausa cena');
      return;
    }
    if (!isDinnerOn) {
      showWarning('Pausa Cena', 'La pausa cena non risulta avviata');
      return;
    }

    let location = currentLocation;
    if (!location && !forceWithoutGPS) {
      showWarning('GPS Non Disponibile', 'Richiesta attivazione GPS per registrare la fine pausa...');
      await getCurrentLocation({ requiredAccuracy: MIN_DESIRED_ACCURACY, maxRetries: 2 });
      location = currentLocation;
      if (!location) {
        showWarning('Nessun GPS', 'Impossibile ottenere la posizione. Puoi forzare la fine pausa senza GPS.');
        return;
      }
    }

    const endTime = timeStringNow();
    const cs: any = currentSession as any;
    const referenceDate = cs?.date || toLocalDateString(new Date());
    const dinnerMinutes = minutesBetween(cs?.pausa_cena_inizio || '', endTime, referenceDate);

    const existingLunchMinutes = (cs?.pausa_pranzo_minuti && Number(cs.pausa_pranzo_minuti)) || 0;
    const totalPause = existingLunchMinutes + (dinnerMinutes || 0);

    const updateData: any = {
      pausa_cena_fine: endTime,
      pausa_cena_minuti: dinnerMinutes,
      pausa_totale_minuti: totalPause
    };
    if (location) {
      updateData.pausa_cena_end_location = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        accuracy: location.accuracy,
        timestamp: location.timestamp ? location.timestamp.toISOString() : new Date().toISOString()
      };
    }

    const { error } = await supabase.from('extra_shifts_checkins').update(updateData).eq('id', currentSession.id);
    if (error) {
      console.error('Errore salvataggio fine pausa cena:', error);
      showError('Errore', 'Impossibile salvare fine pausa cena');
      return;
    }

    // clear pending (server confirmed)
    clearPending(currentSession.id, 'dinner');

    setIsDinnerOn(false);
    setDinnerTaken(true);
    showSuccess('Pausa Cena Terminata', `Fine pausa cena registrata alle ${endTime} (${dinnerMinutes} minuti)`);
    if (typeof loadActiveSession === 'function') await loadActiveSession();
  };

  const { allowLunch, allowDinner } = getPauseAvailability();
  const allowDinnerEffective = allowDinner || lunchTaken;

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="text-lg font-bold text-white">Turno Extra</h3>
        <p className="text-sm text-gray-300">Registra qui un turno extra non programmato. Questo flusso usa solo GPS (nessun QR). I turni extra verranno registrati senza riferimento a un magazzino.</p>

        {/* GPS status + update */}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm text-gray-200 font-medium">Stato GPS</h4>
            {renderGpsStatus()}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => getCurrentLocation({ requiredAccuracy: MIN_DESIRED_ACCURACY, maxRetries: 3 })}
              className="bg-gray-700 px-3 py-1 rounded-lg text-xs"
              disabled={gpsLoading}
            >
              Aggiorna GPS
            </button>
            <button
              onClick={() => getCurrentLocation({ requiredAccuracy: 10, maxRetries: 5 })}
              className="bg-gray-700 px-3 py-1 rounded-lg text-xs"
              title="Tentativo avanzato (maggior tempo/priorità)"
              disabled={gpsLoading}
            >
              Migliora posizione
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="block text-sm text-gray-300">Note turno (opzionali)</label>
          <textarea
            value={noteTurno}
            onChange={(e) => setNoteTurno(e.target.value)}
            placeholder="Annota eventuali note sul turno..."
            className="w-full min-h-[80px] bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400"
          />
          <p className="text-xs text-gray-400">Queste note verranno salvate nella colonna NoteTurno al check-out.</p>
        </div>

        <div className="mt-4">
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={wantsCompanyMeal} onChange={() => { setWantsCompanyMeal(!wantsCompanyMeal); if (!wantsCompanyMeal) setWantsMealVoucher(false); }} />
              <span className="text-sm text-gray-300">Pasto aziendale</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={wantsMealVoucher} onChange={() => { setWantsMealVoucher(!wantsMealVoucher); if (!wantsMealVoucher) setWantsCompanyMeal(false); }} />
              <span className="text-sm text-gray-300">Buono pasto</span>
            </label>
          </div>
        </div>

        <div className="mt-4 flex space-x-2">
          <button
            onClick={() => handleExtraCheckIn(false)}
            className={`flex-1 ${isCheckedInLocally || currentSession ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white py-2 px-3 rounded-lg`}
            disabled={Boolean(isCheckedInLocally || currentSession)}
          >
            ✅ Effettua Check-in Extra
          </button>

          <button
            onClick={onRequestForceCheckin}
            className={`flex-1 ${isCheckedInLocally || currentSession ? 'bg-gray-600 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'} text-white py-2 px-3 rounded-lg`}
            disabled={Boolean(isCheckedInLocally || currentSession)}
          >
            ⚠️ Forza Check-in (Senza GPS)
          </button>
        </div>
      </div>

      {/* Force check-in confirmation modal */}
      {showForceCheckinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-red-600">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-red-900 p-3 rounded-full">
                  <AlertCircle className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Conferma Check-in Forzato</h3>
                  <p className="text-red-200 text-xs mt-2">
                    Stai per effettuare un check-in <strong>senza posizione GPS</strong>. Questo verrà registrato come "Check-in Forzato" e sarà visibile ai supervisori. Si consiglia di  <strong>abilitare la posizione</strong> per evitare l' eventuale annullamento del turno.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowForceCheckinModal(false)} className="text-gray-400 hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => setShowForceCheckinModal(false)}
                className="flex-1 bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600"
              >
                Annulla
              </button>
              <button
                onClick={confirmForceCheckin}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
              >
                Conferma Forza Check-in
              </button>
            </div>

            <div className="mt-4 text-xs text-yellow-200">
              Consigliamo di risolvere il problema GPS prima del check-in. Se continui, il sistema registrerà l'assenza della posizione.
            </div>
          </div>
        </div>
      )}

      {/* Force checkout confirmation modal */}
      {showForceCheckoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-red-600">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-red-900 p-3 rounded-full">
                  <AlertCircle className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Conferma Terminazione Turno</h3>
                  <p className="text-red-200 text-xs mt-2">
                    Prima di terminare il turno, abilita la posizione per registrare la posizione finale.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowForceCheckoutModal(false)} className="text-gray-400 hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">
              <p className="text-red-200 text-xs">
                Stai per effettuare un check-out <strong>senza posizione GPS</strong>. Questo verrà registrato senza coordinate finali e potrebbe essere visibile ai supervisori.
              </p>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={retryGpsAndCheckout}
                className="flex-1 bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600"
              >
                Riprova GPS e termina turno
              </button>
              <button
                onClick={confirmForceCheckout}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
              >
                Conferma senza posizione
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active session area */}
      {currentSession && currentSession.type === 'extra' && (
        <div className="bg-purple-900 rounded-xl p-4 border border-purple-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-medium">Sessione Attiva — Turno Extra</h4>
            <div className="text-white font-mono">
              { (currentSession && currentSession.id) ? (elapsedTimes[currentSession.id] || elapsedTime || '00:00:00') : (elapsedTime || '00:00:00') }
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-purple-200">Gestione pause (Pranzo → Cena)</p>
              <div className="mt-2 flex space-x-2">
                {/* Lunch controls - always visible, disabled when not allowed or already completed */}
                {!isLunchOn && !lunchTaken && (
                  <button
                    onClick={() => handleStartLunch(false)}
                    className={`flex-1 ${!allowLunch ? 'bg-gray-700 text-gray-300 opacity-60 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 text-white'} py-2 rounded-lg`}
                    disabled={!allowLunch}
                    title={!allowLunch ? 'Pausa pranzo non disponibile in questa fascia oraria' : 'Inizia Pausa Pranzo'}
                  >
                    Inizia Pausa Pranzo
                  </button>
                )}
                {isLunchOn && (
                  <button onClick={() => handleEndLunch(false)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg">Termina Pausa Pranzo</button>
                )}
                {lunchTaken && (
                  <button disabled className="flex-1 bg-gray-700 text-gray-300 py-2 rounded-lg opacity-60 cursor-not-allowed">Pausa Pranzo Completata</button>
                )}

                {/* Dinner controls - always visible, disabled when not allowed or already completed */}
                {!isDinnerOn && !dinnerTaken && (
                  <button
                    onClick={() => handleStartDinner(false)}
                    className={`flex-1 ${!allowDinnerEffective ? 'bg-gray-700 text-gray-300 opacity-60 cursor-not-allowed' : 'bg-orange-700 hover:bg-orange-800 text-white'} py-2 rounded-lg`}
                    disabled={!allowDinnerEffective}
                    title={!allowDinnerEffective ? (allowDinner ? 'Pausa cena non disponibile' : 'Pausa cena disponibile solo in orari consentiti o dopo la pausa pranzo') : 'Inizia Pausa Cena'}
                  >
                    Inizia Pausa Cena
                  </button>
                )}
                {isDinnerOn && (
                  <button onClick={() => handleEndDinner(false)} className="flex-1 bg-green-700 hover:bg-green-800 text-white py-2 rounded-lg">Termina Pausa Cena</button>
                )}
                {dinnerTaken && (
                  <button disabled className="flex-1 bg-gray-700 text-gray-300 py-2 rounded-lg opacity-60 cursor-not-allowed">Pausa Cena Completata</button>
                )}
              </div>
              <div className="mt-2 text-xs text-gray-300">
                {isLunchOn && <div>Pausa pranzo iniziata</div>}
                {lunchTaken && !isDinnerOn && <div>Pausa pranzo completata</div>}
                {isDinnerOn && <div>Pausa cena iniziata</div>}
                {dinnerTaken && <div>Pausa cena completata</div>}
              </div>
            </div>

            <div>
              <p className="text-sm text-purple-200">Fine turno</p>
              <div className="mt-2 flex space-x-2">
                <button onClick={onRequestCheckout} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg">🛑 Termina Turno Extra</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* If offline show a note */}
      {!isOnline && (
        <div className="bg-orange-900 rounded-xl p-3 border border-orange-700">
          <p className="text-orange-100 text-sm">Sei offline: i check-in verranno salvati localmente e sincronizzati quando torni online.</p>
        </div>
      )}
    </div>
  );
};

export default ExtraCheckIn;