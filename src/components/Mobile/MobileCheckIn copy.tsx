import React, { useState, useEffect, useRef } from 'react';
import { QrCode, MapPin, Clock, CheckCircle, AlertCircle, Camera, X, Check, Calendar as CalendarIcon, DollarSign, Plus, FileText, Upload, Utensils, Car, Home, Wrench, Phone, RefreshCw, Navigation, Timer, Building2 } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../../context/AuthContext';
import { useGPSLocation } from '../../hooks/useGPSLocation';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { usePersistentTimer } from '../../hooks/usePersistentTimer';
import { supabase } from '../../lib/db';

interface WarehouseInfo {
  id: string;
  name: string;
  address: string;
  qr_code_value: string;
  company_id: string;
  companyName?: string;
}

interface EventInfo {
  id: string;
  title: string;
  location: string;
  start_date: string;
  type: string;
  company_id: string;
  companyName?: string;
}

const MobileCheckIn: React.FC = () => {
  const { user } = useAuth();
  const { currentLocation, getCurrentLocation, isLoading: gpsLoading, error: gpsError } = useGPSLocation();
  const { isOnline, addOfflineData } = useOfflineSync();
  const { currentSession, startSession, endSession, manualCheckOut } = usePersistentTimer();
  
  // Stati principali
  const [currentView, setCurrentView] = useState<'main' | 'scanner' | 'gps_checkin'>('main');
  const [availableWarehouses, setAvailableWarehouses] = useState<WarehouseInfo[]>([]);
  const [todayEvents, setTodayEvents] = useState<EventInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventInfo | null>(null);
  const [assignedWarehouseShifts, setAssignedWarehouseShifts] = useState<any[]>([]);
  const [showAllShifts, setShowAllShifts] = useState(false);
  
  // Stati scanner
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (user?.id) {
      loadCheckInData();
    }
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [user?.id]);

  const loadCheckInData = async () => {
    try {
      setLoading(true);
      
      // Carica turni magazzino assegnati al dipendente
      await loadAssignedWarehouseShifts();
      
      // Carica eventi di oggi
      await loadTodayEvents();
      
    } catch (error) {
      console.error('Errore nel caricamento dati check-in:', error);
    } finally {
      setLoading(false);
    }
  };


  const loadAssignedWarehouseShifts = async () => {
    try {
      // Carica i turni magazzino dalla tabella corretta crew_assegnazione_turni
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('crew_assegnazione_turni')
        .select('*')
        .eq('dipendente_id', user?.id)
        .order('data_turno', { ascending: false });

      if (shiftsError) {
        console.error('Errore nel caricamento turni assegnati:', shiftsError);
        setAssignedWarehouseShifts([]);
        return;
      }

      const mappedShifts = (shiftsData || []).map(shift => {
        return {
          id: shift.id,
          warehouseId: shift.turno_id,
          warehouseName: shift.nome_magazzino || 'Magazzino',
          warehouseAddress: 'Indirizzo non disponibile',
          date: shift.data_turno,
          startTime: formatTime(shift.ora_inizio_turno),
          endTime: formatTime(shift.ora_fine_turno),
          status: 'assigned',
          role: 'worker',
          checkInTime: null,
          checkOutTime: null
        };
      });

      setAssignedWarehouseShifts(mappedShifts);
      console.log('✅ Turni magazzino assegnati caricati:', mappedShifts.length);
      
    } catch (error) {
      console.error('Errore nel caricamento turni assegnati:', error);
      setAssignedWarehouseShifts([]);
    }
  };

  const loadTodayEvents = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      console.log('📅 Caricamento TUTTO quello che devo fare oggi:', today);
      
      // 1. Carica eventi di oggi assegnati al dipendente
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('crew_event_assegnazione')
        .select(`
          *,
          crew_events!evento_id(
            id,
            title,
            start_date,
            location,
            type,
            company_id,
            regaziendasoftware!company_id(ragione_sociale)
          )
        `)
        .eq('dipendente_freelance_id', user?.id);

      if (assignmentsError) {
        console.error('Errore nel caricamento eventi oggi:', assignmentsError);
      }

      // 2. Carica turni magazzino di oggi
      const { data: warehouseShiftsData, error: warehouseError } = await supabase
        .from('crew_assegnazione_turni')
        .select('*')
        .eq('dipendente_id', user?.id)
        .eq('data_turno', today);

      if (warehouseError) {
        console.error('Errore nel caricamento turni magazzino oggi:', warehouseError);
      }

      // 3. Combina eventi e turni magazzino di oggi
      const todayItems = [];
      
      // A. Aggiungi eventi di oggi
      const todayEventsFiltered = (assignmentsData || [])
        .filter(assignment => {
          return assignment.giorno_inizio_evento === today;
        })
        .map(assignment => {
          return {
            id: assignment.evento_id,
            title: assignment.nome_evento,
            location: assignment.evento_localita || 'Sede',
            start_date: assignment.giorno_inizio_evento,
            type: assignment.evento_trasferta ? 'event_travel' : 'event',
            company_id: assignment.azienda_id,
            companyName: assignment.nome_azienda,
            isEvent: true,
            callTime: assignment.evento_orario_convocazione,
            address: assignment.evento_indirizzo
          };
        });

      todayItems.push(...todayEventsFiltered);
      
      // B. Aggiungi turni magazzino di oggi
      const todayWarehouseShifts = (warehouseShiftsData || []).map(shift => {
        return {
          id: shift.id,
          title: 'Turno Magazzino',
          location: shift.nome_magazzino || 'Magazzino',
          start_date: shift.data_turno,
          type: 'warehouse',
          company_id: shift.azienda_id,
          companyName: shift.nome_azienda,
          isEvent: false,
          startTime: shift.ora_inizio_turno,
          endTime: shift.ora_fine_turno,
          warehouseAddress: 'Indirizzo magazzino non disponibile'
        };
      });
      
      todayItems.push(...todayWarehouseShifts);
      
      setTodayEvents(todayItems);
      console.log('✅ TUTTO quello che devo fare oggi caricato:', {
        totale: todayItems.length,
        eventi: todayEventsFiltered.length,
        turniMagazzino: todayWarehouseShifts.length
      });
      
    } catch (error) {
      console.error('Errore nel caricamento eventi oggi:', error);
      setTodayEvents([]);
    }
  };

  const initScanner = () => {
    setCurrentView('scanner');
    setShowScanner(true);
    setScannerError(null);
    
    setTimeout(() => {
      try {
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
          supportedScanTypes: [0] // Solo QR codes
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
    }, 100);
  };

  const onScanSuccess = (decodedText: string) => {
    console.log('🔍 QR Code scansionato:', decodedText);
    setScanResult(decodedText);
    
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    
    setShowScanner(false);
    setCurrentView('main');
    
    try {
      // Verifica se è un QR code di magazzino valido
      const warehouse = availableWarehouses.find(w => w.qr_code_value === decodedText);
      
      if (warehouse) {
        console.log('✅ Magazzino trovato:', warehouse.name);
        handleWarehouseCheckIn(warehouse);
      } else {
        console.error('❌ QR code non valido:', decodedText);
        alert('QR code non riconosciuto. Assicurati di scansionare un QR code di magazzino valido.');
      }
    } catch (error) {
      console.error('Errore nella lettura del QR code:', error);
      alert('Errore nella lettura del QR code');
    }
  };

  const onScanError = (error: any) => {
    // Non loggare errori di scan continui per evitare spam
    if (!error.includes('NotFoundException')) {
      console.error('QR scan error:', error);
    }
  };

  const handleWarehouseCheckIn = async (warehouse: WarehouseInfo) => {
    if (!currentLocation) {
      alert('Posizione GPS richiesta per il check-in. Attiva il GPS e riprova.');
      return;
    }
    
    const now = new Date();
    const checkInTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];
    
    try {
      const checkInData = {
        warehouse_id: warehouse.id,
        crew_id: user?.id,
        date: today,
        check_in_time: checkInTime,
        status: 'checked_in',
        location: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          address: currentLocation.address,
          accuracy: currentLocation.accuracy,
          timestamp: currentLocation.timestamp.toISOString()
        }
      };

      if (isOnline) {
        const { data, error } = await supabase
          .from('warehouse_checkins')
          .insert(checkInData)
          .select()
          .single();
        
        if (error) {
          console.error('Errore nel check-in online:', error);
          // Salva offline se errore online
          addOfflineData('checkin', checkInData);
          alert('Errore nel check-in online - Salvato offline');
        } else {
          console.log('✅ Check-in magazzino completato:', data);
          
          // Avvia sessione timer
          startSession({
            id: data.id,
            type: 'warehouse',
            warehouseId: warehouse.id,
            checkInTime,
            scheduledEndTime: '17:00',
            hasCompanyMeal: false,
            hasMealVoucher: false
          });
          
          alert(`✅ Check-in completato!\nMagazzino: ${warehouse.name}\nOrario: ${checkInTime}\nPosizione verificata con GPS`);
        }
      } else {
        // Modalità offline
        addOfflineData('checkin', checkInData);
        alert('Check-in salvato offline - Verrà sincronizzato quando torni online');
      }
      
    } catch (error) {
      console.error('Errore nel check-in:', error);
      alert('Errore durante il check-in');
    }
  };

  const handleEventCheckIn = async (event: EventInfo) => {
    if (!currentLocation) {
      alert('Posizione GPS richiesta per il check-in evento');
      return;
    }
    
    const now = new Date();
    const checkInTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    try {
      const timesheetData = {
        crew_id: user?.id,
        event_id: event.id,
        date: new Date().toISOString().split('T')[0],
        start_time: checkInTime,
        tracking_type: 'hours',
        hourly_rate: 25, // Default
        retention_percentage: 15,
        status: 'draft',
        gps_location: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          address: currentLocation.address,
          accuracy: currentLocation.accuracy,
          timestamp: currentLocation.timestamp.toISOString()
        }
      };

      if (isOnline) {
        const { data, error } = await supabase
          .from('timesheet_entries')
          .insert(timesheetData)
          .select()
          .single();
        
        if (error) {
          console.error('Errore nel check-in evento online:', error);
          addOfflineData('timesheet', timesheetData);
          alert('Errore nel check-in online - Salvato offline');
        } else {
          console.log('✅ Check-in evento completato:', data);
          
          startSession({
            id: data.id,
            type: 'event',
            eventId: event.id,
            checkInTime,
            scheduledEndTime: '17:00',
            hasCompanyMeal: false,
            hasMealVoucher: false
          });
          
          alert(`✅ Check-in evento completato!\nEvento: ${event.title}\nOrario: ${checkInTime}`);
        }
      } else {
        addOfflineData('timesheet', timesheetData);
        alert('Check-in evento salvato offline');
      }
      
    } catch (error) {
      console.error('Errore nel check-in evento:', error);
      alert('Errore durante il check-in evento');
    }
  };

  const handleManualCheckOut = async () => {
    if (!currentSession) {
      alert('Nessuna sessione attiva da terminare');
      return;
    }

    const success = await manualCheckOut();
    
    if (success) {
      alert('✅ Check-out completato con successo!');
      endSession();
    } else {
      alert('❌ Errore durante il check-out');
    }
  };

  const formatTime = (timeString: string | null): string => {
    if (!timeString) return '09:00';
    
    // Se è già in formato HH:MM, ritorna così com'è
    if (/^\d{2}:\d{2}$/.test(timeString)) {
      return timeString;
    }
    
    // Se è in formato HH:MM:SS, rimuovi i secondi
    if (/^\d{2}:\d{2}:\d{2}$/.test(timeString)) {
      return timeString.substring(0, 5);
    }
    
    // Se è un formato strano, ritorna default
    return '09:00';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Caricamento sistema check-in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="p-4 pb-20 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Check-in Mobile</h1>
            <p className="text-gray-300">QR Code Magazzino • GPS Eventi</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-300">
              {new Date().toLocaleDateString('it-IT')}
            </div>
            <div className="text-xs text-gray-400">
              {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Current Session */}
        {currentSession && (
          <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Sessione Attiva</h3>
              <div className="w-3 h-3 bg-green-300 rounded-full animate-pulse"></div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                {currentSession.type === 'warehouse' ? (
                  <Building2 className="h-6 w-6 text-white" />
                ) : (
                  <CalendarIcon className="h-6 w-6 text-white" />
                )}
                <div>
                  <h4 className="font-medium text-white">
                    {currentSession.type === 'warehouse' ? 'Turno Magazzino' : 'Evento'}
                  </h4>
                  <p className="text-sm text-green-100">
                    Inizio: {formatTime(currentSession.checkInTime)}
                  </p>
                </div>
              </div>
              
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-3xl font-mono font-bold text-white mb-2">
                    {currentSession.elapsedTime || '00:00:00'}
                  </div>
                  <div className="text-sm text-green-100">
                    Tempo trascorso
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleManualCheckOut}
              className="w-full mt-4 bg-red-600 text-white py-3 px-4 rounded-xl hover:bg-red-700 font-bold text-lg shadow-lg"
            >
              🛑 TERMINA SESSIONE
            </button>
          </div>
        )}

        {/* Main Check-in Options */}
        {currentView === 'main' && !currentSession && (
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
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <QrCode className="h-6 w-6 text-purple-400" />
                <span>Check-in Magazzino</span>
              </h3>
              
              <p className="text-gray-300 mb-4">
                Scansiona il QR code del magazzino per iniziare il turno
              </p>
              
              <button
                onClick={initScanner}
                disabled={!currentLocation}
                className="w-full bg-purple-600 text-white py-4 px-4 rounded-xl hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-bold text-lg shadow-lg flex items-center justify-center space-x-3"
              >
                <QrCode className="h-6 w-6" />
                <span>📱 SCANSIONA QR MAGAZZINO</span>
              </button>
              
              {!currentLocation && (
                <p className="text-yellow-400 text-sm mt-2 text-center">
                  ⚠️ GPS richiesto per verificare la posizione
                </p>
              )}
            </div>

            {/* Event Check-in */}
            {todayEvents.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                  <MapPin className="h-6 w-6 text-blue-400" />
                  <span>Eventi di Oggi ({todayEvents.length})</span>
                </h3>
                
                <div className="space-y-3">
                  {todayEvents.map((event) => (
                    <div key={event.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-white">{event.title}</h4>
                          <p className="text-sm text-gray-300">{event.location}</p>
                          <p className="text-xs text-gray-400">{event.companyName}</p>
                        </div>
                        <button
                          onClick={() => handleEventCheckIn(event)}
                          disabled={!currentLocation}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                          Check-in GPS
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Warehouses Info */}
            {assignedWarehouseShifts.length > 0 ? (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">
                  I Miei Turni Magazzino ({assignedWarehouseShifts.length})
                </h3>
                
                <div className="space-y-3">
                  {assignedWarehouseShifts.slice(0, showAllShifts ? assignedWarehouseShifts.length : 3).map((shift) => (
                    <div key={shift.id} className="bg-gray-700 rounded-lg p-3">
                      <div className="flex items-center space-x-3">
                        <Building2 className="h-5 w-5 text-purple-400" />
                        <div>
                          <h4 className="font-medium text-white">{shift.warehouseName}</h4>
                          <p className="text-sm text-gray-300">{shift.date} • {shift.startTime} - {shift.endTime}</p>
                          <p className="text-xs text-gray-400">
                            {shift.status === 'assigned' ? '📋 Da iniziare' :
                             shift.status === 'checked_in' ? '✅ In corso' :
                             shift.status === 'completed' ? '🏁 Completato' : shift.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {assignedWarehouseShifts.length > 3 && (
                    <div className="text-center">
                      <button
                        onClick={() => setShowAllShifts(!showAllShifts)}
                        className="text-sm text-blue-400 hover:text-blue-300 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors"
                      >
                        {showAllShifts ? 
                          `📋 Nascondi ${assignedWarehouseShifts.length - 3} turni` : 
                          `📋 Mostra altri ${assignedWarehouseShifts.length - 3} turni`
                        }
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <h3 className="text-lg font-semibold text-white mb-2">Nessun Turno Magazzino</h3>
                <p className="text-gray-300">
                  Non hai turni di magazzino assegnati al momento.
                </p>
              </div>
            )}

            {todayEvents.length === 0 && (
              /* Nessuna Attività Oggi */
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <h3 className="text-lg font-semibold text-white mb-2">Nessuna Attività Oggi</h3>
                <p className="text-gray-300">
                  Non hai eventi o turni magazzino assegnati per oggi. 
                  Controlla il calendario per le prossime attività.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Scanner View */}
        {currentView === 'scanner' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Scanner QR Code</h2>
              <button
                onClick={() => {
                  if (scannerRef.current) {
                    scannerRef.current.clear();
                  }
                  setShowScanner(false);
                  setCurrentView('main');
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
            </div>
            
            <div className="bg-blue-900 rounded-xl p-4 border border-blue-700">
              <div className="flex items-start space-x-3">
                <Camera className="h-5 w-5 text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-100">Come Usare lo Scanner</h4>
                  <ul className="text-sm text-blue-200 mt-2 space-y-1">
                    <li>• Punta la fotocamera verso il QR code</li>
                    <li>• Mantieni il telefono fermo</li>
                    <li>• Assicurati che ci sia buona illuminazione</li>
                    <li>• Il QR code deve essere completamente visibile</li>
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
                  I check-in verranno salvati localmente e sincronizzati quando torni online
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Copyright */}
        <div className="text-center text-gray-500 text-xs">
          <p>© 2025 ControlStage - Crew App Mobile V. 1.0.8</p>
          <p>Tutti i diritti riservati - Software realizzato da ControlStage</p>
        </div>
      </div>
    </div>
  );
};

export default MobileCheckIn;