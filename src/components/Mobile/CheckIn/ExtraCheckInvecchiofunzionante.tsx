import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Utensils, Gift, Coffee, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToastContext } from '../../../context/ToastContext';
import { useGPSLocation } from '../../../hooks/useGPSLocation';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import { usePersistentTimer } from '../../../hooks/usePersistentTimer';
import { supabase } from '../../../lib/db';
import { toLocalDateString } from '../../../utils/dateUtils';

interface WarehouseInfo {
  id: string;
  name: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  company_id?: string | null;
}

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

  const [availableWarehouses, setAvailableWarehouses] = useState<WarehouseInfo[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  // Meal / benefits
  const [wantsCompanyMeal, setWantsCompanyMeal] = useState(false);
  const [wantsMealVoucher, setWantsMealVoucher] = useState(false);
  const [mealBenefits, setMealBenefits] = useState<any>(null);

  // Note turno (campo libero)
  const [noteTurno, setNoteTurno] = useState<string>('');

  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  // UI states
  const [showForceCheckinModal, setShowForceCheckinModal] = useState(false);
  const [showForceCheckoutModal, setShowForceCheckoutModal] = useState(false);
  const [isCheckedInLocally, setIsCheckedInLocally] = useState(false); // immediate button disable fallback
  const [isOnBreak, setIsOnBreak] = useState(false); // track break state to show/disable buttons

  // Helper: distanza tra due coppie lat/lon in metri
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // LOADERS
  const loadWarehouses = useCallback(async () => {
    try {
      setLoadingWarehouses(true);

      let companyId: string | null = (user as any)?.company_id || null;

      if (!companyId && user?.id) {
        const { data: regData, error: regErr } = await supabase
          .from('registration_requests')
          .select('company_id')
          .eq('id', user.id)
          .maybeSingle();

        if (!regErr && regData?.company_id) {
          companyId = regData.company_id;
        }
      }

      if (!companyId) {
        setAvailableWarehouses([]);
        setLoadingWarehouses(false);
        return;
      }

      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, address, latitude, longitude, company_id')
        .eq('company_id', companyId)
        .order('name');

      if (error) {
        console.warn('Errore caricamento magazzini:', error);
        setAvailableWarehouses([]);
        return;
      }
      setAvailableWarehouses(data || []);
    } catch (err) {
      console.error('loadWarehouses error', err);
      setAvailableWarehouses([]);
    } finally {
      setLoadingWarehouses(false);
    }
  }, [user?.id, user?.company_id]);

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

  useEffect(() => {
    loadWarehouses();
    loadMealBenefits();
  }, [loadWarehouses, loadMealBenefits]);

  useEffect(() => {
    // Keep local disable flag in sync with global currentSession (if context updates slower)
    if (currentSession && currentSession.type === 'warehouse') {
      setIsCheckedInLocally(true);
    } else {
      setIsCheckedInLocally(false);
    }

    // Sync break state from currentSession if the object has break times
    // many session objects include break_start_time / break_end_time; adapt if shape differs
    if (currentSession) {
      const hasBreakStarted = Boolean((currentSession as any).break_start_time && !(currentSession as any).break_end_time);
      setIsOnBreak(hasBreakStarted);
    } else {
      setIsOnBreak(false);
    }
  }, [currentSession?.id, currentSession?.type, (currentSession as any)?.break_start_time, (currentSession as any)?.break_end_time]);

  const getSelectedWarehouse = (): WarehouseInfo | null => {
    if (!selectedWarehouseId) return null;
    return availableWarehouses.find(w => w.id === selectedWarehouseId) || null;
  };

  // UI helper to show GPS summary
  const renderGpsStatus = () => {
    if (gpsLoading) {
      return <p className="text-xs text-yellow-300">Rilevamento GPS in corso...</p>;
    }
    if (currentLocation) {
      const acc = currentLocation.accuracy ?? 'n.d.';
      const lat = typeof currentLocation.latitude === 'number' ? currentLocation.latitude.toFixed(5) : '';
      const lon = typeof currentLocation.longitude === 'number' ? currentLocation.longitude.toFixed(5) : '';
      const isGood = typeof currentLocation.accuracy === 'number' ? currentLocation.accuracy <= MIN_DESIRED_ACCURACY : false;
      return (
        <>
          <p className={`text-xs ${isGood ? 'text-green-300' : 'text-yellow-300'}`}>
            OK — {currentLocation.address || `${lat}, ${lon}`} (±{acc}m){isGood ? '' : ' — precisione migliorabile'}
          </p>
          {!isGood && <p className="text-xs text-gray-400">Consiglio: clicca "Aggiorna GPS" finché l'accuratezza è ≤ {MIN_DESIRED_ACCURACY} m.</p>}
        </>
      );
    }
    return <p className="text-xs text-red-300">{gpsError || 'GPS non disponibile'}</p>;
  };

  // CHECK-IN (returns boolean success)
  const handleExtraCheckIn = async (forceCheckin: boolean = false): Promise<boolean> => {
    const warehouse = getSelectedWarehouse();

    // Allow check-in even if "Nessun magazzino" selected (warehouse === null)
    if (!warehouse) {
      // Inform user that check-in will be recorded without a warehouse reference
      showInfo('Nessun magazzino selezionato', 'Il check-in verrà registrato senza riferimento a un magazzino.');
    }

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
      warehouse_id: warehouse ? warehouse.id : null,
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
      shift_id: null,
      break_minutes: 60,
      company_meal: wantsCompanyMeal,
      meal_voucher: wantsMealVoucher,
      meal_cost: wantsCompanyMeal ? (mealBenefits?.pasto_aziendale_cost || 12.00) : 0.00,
      meal_notes: wantsCompanyMeal ? 'Pasto aziendale richiesto' : wantsMealVoucher ? 'Buono pasto richiesto' : null,
      notes: 'TURNO EXTRA',
      NoteTurno: noteTurno || null
    };

    try {
      if (isOnline) {
        const { data, error } = await supabase.from('warehouse_checkins').insert(checkInData).select().single();
        if (error) {
          console.error('Errore insert extra checkin:', error);
          addOfflineData('checkin', checkInData);
          showWarning('Check-in Offline', 'Problema salvataggio sul server. Il check-in è stato salvato offline e verrà sincronizzato.');
          return false;
        }

        // Avvia la sessione locale
        startSession({
          id: data.id,
          type: 'warehouse',
          warehouseId: warehouse ? warehouse.id : null,
          checkInTime,
          scheduledEndTime: null,
          shiftName: 'Turno Extra',
          shiftStartTime: null,
          shiftEndTime: null,
          hasLunchBreak: true,
          hasCompanyMeal: wantsCompanyMeal,
          hasMealVoucher: wantsMealVoucher,
          breakTime: 60
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
  // forceCheckout: if true, skip getCurrentLocation and proceed without final location
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

      // salva NoteTurno + checkout_location + distanza/alert rispetto al magazzino
      try {
        if (currentSession && currentSession.id) {
          const warehouse = getSelectedWarehouse();
          let checkout_location: any = null;
          let checkout_distance_from_warehouse: number | null = null;
          let checkout_location_alert = false;

          if (finalLocation) {
            checkout_location = {
              latitude: finalLocation.latitude,
              longitude: finalLocation.longitude,
              address: finalLocation.address,
              accuracy: finalLocation.accuracy,
              timestamp: finalLocation.timestamp ? finalLocation.timestamp.toISOString() : new Date().toISOString()
            };

            if (warehouse && typeof warehouse.latitude === 'number' && typeof warehouse.longitude === 'number') {
              checkout_distance_from_warehouse = Math.round(
                calculateDistance(finalLocation.latitude, finalLocation.longitude, warehouse.latitude!, warehouse.longitude!)
              );
              checkout_location_alert = checkout_distance_from_warehouse > 1000;
            }
          }

          if (isOnline) {
            const { error } = await supabase
              .from('warehouse_checkins')
              .update({
                NoteTurno: noteTurno || null,
                checkout_location,
                checkout_distance_from_warehouse,
                checkout_location_alert
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
      setIsOnBreak(false);
      showSuccess('Check-out Completato', `Turno extra terminato. Tempo totale: ${elapsedTime}`);
      if (typeof loadActiveSession === 'function') await loadActiveSession();
    } catch (err) {
      console.error('Errore conferma check-out extra:', err);
      showError('Errore Sistema', 'Errore imprevisto durante il check-out extra');
    }
  };

  // Trigger modal before checkout: if GPS absent or accuracy poor, show modal with options
  const onRequestCheckout = async () => {
    // If GPS is available and accuracy is acceptable, proceed directly
    const accuracy = currentLocation?.accuracy;
    const gpsAvailable = Boolean(currentLocation);
    const gpsGood = typeof accuracy === 'number' ? accuracy <= MIN_DESIRED_ACCURACY : false;

    if (!gpsAvailable || !gpsGood) {
      // show modal to ask user to re-enable GPS or confirm checkout without position
      setShowForceCheckoutModal(true);
      return;
    }

    // GPS ok -> proceed
    await confirmExtraCheckOut(false);
  };

  // CONFIRMATION actions for checkout modal
  const retryGpsAndCheckout = async () => {
    // attempt to refresh GPS, then if available proceed
    setShowForceCheckoutModal(false);
    await getCurrentLocation({ requiredAccuracy: MIN_DESIRED_ACCURACY, maxRetries: 3 });
    // if location available now, proceed normally
    if (currentLocation) {
      await confirmExtraCheckOut(false);
    } else {
      // if still not available, re-open modal so user can confirm forced checkout or retry again
      setShowForceCheckoutModal(true);
    }
  };

  const confirmForceCheckout = async () => {
    setShowForceCheckoutModal(false);
    // proceed without final location
    await confirmExtraCheckOut(true);
    // after forced checkout, show informational warning
    showWarning(
      'Attenzione GPS',
      'Hai terminato il turno senza posizione finale. Il checkout viene registrato senza coordinate.',
      8000
    );
  };

  // BREAKS (start / end) - salvano anche posizione se presente
  const handleStartBreak = async (forceWithoutGPS: boolean = false) => {
    if (!currentSession || currentSession.type !== 'warehouse') {
      showError('Errore', 'Nessuna sessione attiva per avviare la pausa');
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

    const now = new Date();
    const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const updateData: any = { break_start_time: startTime };
    if (location) {
      updateData.break_start_location = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        accuracy: location.accuracy,
        timestamp: location.timestamp ? location.timestamp.toISOString() : new Date().toISOString()
      };
    }

    const { error } = await supabase.from('warehouse_checkins').update(updateData).eq('id', currentSession.id);
    if (error) {
      showError('Errore', 'Impossibile salvare inizio pausa');
      return;
    }

    // succeeded: set local break state so UI updates immediately
    setIsOnBreak(true);

    showSuccess('Pausa Iniziata', `Pausa iniziata alle ${startTime}`);
  };

  const handleEndBreak = async (forceWithoutGPS: boolean = false) => {
    if (!currentSession || currentSession.type !== 'warehouse') {
      showError('Errore', 'Nessuna sessione attiva per terminare la pausa');
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

    const now = new Date();
    const endTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const updateData: any = {
      break_end_time: endTime,
      has_taken_break: true,
      pausa_pranzo: true
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

    const { error } = await supabase.from('warehouse_checkins').update(updateData).eq('id', currentSession.id);
    if (error) {
      showError('Errore', 'Impossibile salvare fine pausa');
      return;
    }

    // succeeded: clear local break state so UI updates immediately
    setIsOnBreak(false);

    showSuccess('Pausa Terminata', `Fine pausa registrata alle ${endTime}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="text-lg font-bold text-white">Turno Extra</h3>
        <p className="text-sm text-gray-300">Registra qui un turno extra non programmato. Questo flusso usa solo GPS (nessun QR).</p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm text-gray-300">Scegli il magazzino</label>
          {loadingWarehouses ? (
            <div className="text-sm text-gray-400">Caricamento magazzini...</div>
          ) : (
            <>
              <select
                value={selectedWarehouseId || ''}
                onChange={(e) => setSelectedWarehouseId(e.target.value || null)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                {/* Always offer an explicit "Nessun magazzino" option */}
                <option value="">Nessun magazzino</option>
                {availableWarehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} {w.address ? `— ${w.address}` : ''}</option>
                ))}
              </select>
              {availableWarehouses.length === 0 && (
                <div className="text-sm text-yellow-300 mt-2">Nessun magazzino disponibile per la tua azienda.</div>
              )}
            </>
          )}
        </div>

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
            className={`flex-1 ${isCheckedInLocally || (currentSession && currentSession.type === 'warehouse') ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white py-2 px-3 rounded-lg`}
            disabled={Boolean(isCheckedInLocally || (currentSession && currentSession.type === 'warehouse'))}
          >
            ✅ Effettua Check-in Extra
          </button>

          <button
            onClick={onRequestForceCheckin}
            className={`flex-1 ${isCheckedInLocally || (currentSession && currentSession.type === 'warehouse') ? 'bg-gray-600 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'} text-white py-2 px-3 rounded-lg`}
            disabled={Boolean(isCheckedInLocally || (currentSession && currentSession.type === 'warehouse'))}
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
      {currentSession && currentSession.type === 'warehouse' && (
        <div className="bg-purple-900 rounded-xl p-4 border border-purple-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-medium">Sessione Attiva — Turno Extra</h4>
            <div className="text-white font-mono">
              { (currentSession && currentSession.id) ? (elapsedTimes[currentSession.id] || elapsedTime || '00:00:00') : (elapsedTime || '00:00:00') }
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-purple-200">Gestione pausa pranzo</p>
              <div className="mt-2 flex space-x-2">
                {/* Show only the relevant button: if on break show only 'Termina Pausa', otherwise show only 'Inizia Pausa' */}
                {!isOnBreak ? (
                  <button onClick={() => handleStartBreak(false)} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg">Inizia Pausa</button>
                ) : (
                  <button onClick={() => handleEndBreak(false)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg">Termina Pausa</button>
                )}
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