import React, { useState, useEffect, useRef } from 'react';
import { QrCode, MapPin, Clock, CheckCircle, AlertCircle, Camera, X, Check, Calendar as CalendarIcon, DollarSign, Plus, FileText, Upload, Utensils, Car, Home, Wrench, Phone } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/db';

interface WarehouseCheckIn {
  id: string;
  warehouseId: string;
  warehouseName: string;
  crewId: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
  status: 'active' | 'completed' | 'pending';
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    accuracy?: number;
  };
  notes?: string;
  overtimeHours?: number;
  overtimeRate?: number;
  totalOvertimeAmount?: number;
}

interface EventCheckIn {
  id: string;
  eventId: string;
  eventTitle: string;
  crewId: string;
  date: string;
  checkInTime: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  dailyRate: number;
  overtimeHours?: number;
  overtimeRate?: number;
  status: 'active' | 'completed';
}

interface ExpenseSubmission {
  id?: string;
  eventId?: string;
  warehouseId?: string;
  category: 'materials' | 'transport' | 'food' | 'accommodation' | 'communication' | 'other';
  amount: number;
  description: string;
  receipt: File | string;
  expenseDate: string;
  location?: string;
  notes?: string;
}

const WarehouseCheckIn: React.FC = () => {
  const { user } = useAuth();
  
  // Stati principali
  const [activeCheckIn, setActiveCheckIn] = useState<WarehouseCheckIn | null>(null);
  const [activeEventCheckIn, setActiveEventCheckIn] = useState<EventCheckIn | null>(null);
  const [checkIns, setCheckIns] = useState<WarehouseCheckIn[]>([]);
  const [eventCheckIns, setEventCheckIns] = useState<EventCheckIn[]>([]);
  
  // Stati UI
  const [currentView, setCurrentView] = useState<'main' | 'scanner' | 'expenses' | 'overtime'>('main');
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [overtimeHours, setOvertimeHours] = useState<number>(0);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  
  // Stati tecnici
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
    accuracy?: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Refs e timer
  const scannerRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Dati
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; address: string }[]>([]);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<ExpenseSubmission[]>([]);

  // Carica dati iniziali
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        
        // Carica check-in esistenti
        await loadCheckIns();
        
        // Carica magazzini disponibili
        await loadWarehouses();
        
        // Carica eventi di oggi
        await loadTodayEvents();
        
        // Carica spese pending
        await loadExpenses();
        
        // Ottieni posizione
        getCurrentLocation();
        
      } catch (error) {
        console.error('Errore nel caricamento dati:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [user?.id]);

  const loadCheckIns = async () => {
    const { data, error } = await supabase
      .from('warehouse_checkins')
      .select('*')
      .eq('crew_id', user?.id)
      .order('date', { ascending: false });
    
    if (!error && data) {
      const mappedCheckIns: WarehouseCheckIn[] = data.map(checkIn => ({
        id: checkIn.id,
        warehouseId: checkIn.warehouse_id,
        warehouseName: 'Magazzino', // Da migliorare con JOIN
        crewId: checkIn.crew_id,
        date: checkIn.date,
        checkInTime: checkIn.check_in_time,
        checkOutTime: checkIn.check_out_time,
        status: checkIn.status,
        location: checkIn.location
      }));
      
      setCheckIns(mappedCheckIns);
      
      // Trova check-in attivo
      const active = mappedCheckIns.find(c => c.status === 'active');
      if (active) {
        setActiveCheckIn(active);
        startTimer(active.checkInTime);
      }
    }
  };

  const loadWarehouses = async () => {
    const { data, error } = await supabase
      .from('warehouses')
      .select('id, name, address')
      .order('name');
    
    if (!error && data) {
      setWarehouses(data);
    }
  };

  const loadTodayEvents = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('event_crew_assignments')
      .select(`
        *,
        events!event_id(
          id,
          title,
          type,
          start_date,
          location
        )
      `)
      .eq('crew_id', user?.id)
      .eq('events.start_date', today);
    
    if (!error && data) {
      setTodayEvents(data.filter(a => a.events?.type === 'event_travel'));
    }
  };

  const loadExpenses = async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('crew_id', user?.id)
      .eq('status', 'pending')
      .order('expense_date', { ascending: false });
    
    if (!error && data) {
      const mappedExpenses: ExpenseSubmission[] = data.map(expense => ({
        id: expense.id,
        eventId: expense.event_id,
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        receipt: expense.receipt_url || '',
        expenseDate: expense.expense_date,
        location: expense.location,
        notes: expense.notes
      }));
      
      setExpenses(mappedExpenses);
    }
  };

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          let address;
          try {
            address = await simulateReverseGeocoding(latitude, longitude);
          } catch (error) {
            address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          }
          
          setCurrentLocation({
            latitude,
            longitude,
            address,
            accuracy: Math.round(accuracy)
          });
        },
        (error) => {
          setLocationError(getLocationErrorMessage(error.code));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }
  };

  const simulateReverseGeocoding = async (latitude: number, longitude: number): Promise<string> => {
    try {
      // Usa OpenStreetMap Nominatim per reverse geocoding (gratuito)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CrewManager-App/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Errore nel servizio di geolocalizzazione');
      }
      
      const data = await response.json();
      
      if (data && data.display_name) {
        return data.display_name;
      } else {
        // Fallback se non trova l'indirizzo
        return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }
    } catch (error) {
      console.error('Errore reverse geocoding:', error);
      // Fallback con coordinate
      return `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
    }
  };

  const getLocationErrorMessage = (code: number): string => {
    switch (code) {
      case 1: return 'Permesso di geolocalizzazione negato';
      case 2: return 'Posizione non disponibile';
      case 3: return 'Timeout nella richiesta di posizione';
      default: return 'Errore sconosciuto nella geolocalizzazione';
    }
  };

  const startTimer = (checkInTime: string) => {
    const startTime = new Date();
    startTime.setHours(parseInt(checkInTime.split(':')[0], 10));
    startTime.setMinutes(parseInt(checkInTime.split(':')[1], 10));
    startTime.setSeconds(0);

    timerRef.current = setInterval(() => {
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
      
      // Calcola straordinari (oltre 8 ore)
      const totalHours = hours + (minutes / 60);
      const standardHours = 8; // 8 ore standard + 1 ora pausa = 9 ore totali
      if (totalHours > 9) {
        setOvertimeHours(totalHours - 9);
      }
    }, 1000);
  };

  const initScanner = () => {
    setCurrentView('scanner');
    
    setTimeout(() => {
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      };
      
      const html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader",
        config,
        false
      );
      
      html5QrcodeScanner.render(onScanSuccess, onScanError);
      scannerRef.current = html5QrcodeScanner;
    }, 100);
  };

  const onScanSuccess = (decodedText: string) => {
    setScanResult(decodedText);
    setCurrentView('main');
    
    try {
      const parts = decodedText.split(':');
      if (parts[0] === 'warehouse' && parts.length >= 3) {
        const warehouseId = parts[1];
        handleWarehouseCheckIn(warehouseId);
      } else {
        alert('QR code non valido');
      }
    } catch (error) {
      alert('Errore nella lettura del QR code');
    }
    
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
  };

  const onScanError = (error: any) => {
    console.error('QR scan error:', error);
  };

  const handleWarehouseCheckIn = async (warehouseId: string) => {
    if (!currentLocation) {
      alert('Posizione GPS richiesta per il check-in');
      return;
    }
    
    const warehouse = warehouses.find(w => w.id === warehouseId);
    if (!warehouse) {
      alert('Magazzino non trovato');
      return;
    }
    
    const now = new Date();
    const checkInTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];
    
    try {
      const { data, error } = await supabase
        .from('warehouse_checkins')
        .insert({
          warehouse_id: warehouseId,
          crew_id: user?.id,
          date: today,
          check_in_time: checkInTime,
          status: 'active',
          location: currentLocation
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newCheckIn: WarehouseCheckIn = {
        id: data.id,
        warehouseId,
        warehouseName: warehouse.name,
        crewId: user?.id || '',
        date: today,
        checkInTime,
        status: 'active',
        location: currentLocation
      };
      
      setActiveCheckIn(newCheckIn);
      setCheckIns([newCheckIn, ...checkIns]);
      startTimer(checkInTime);
      
    } catch (error) {
      console.error('Errore nel check-in:', error);
      alert('Errore durante il check-in');
    }
  };

  const handleEventCheckIn = async (eventId: string) => {
    if (!currentLocation) {
      alert('Posizione GPS richiesta per il check-in evento');
      return;
    }
    
    const event = todayEvents.find(e => e.events?.id === eventId);
    if (!event) {
      alert('Evento non trovato');
      return;
    }
    
    const now = new Date();
    const checkInTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const newEventCheckIn: EventCheckIn = {
      id: Date.now().toString(),
      eventId,
      eventTitle: event.events.title,
      crewId: user?.id || '',
      date: new Date().toISOString().split('T')[0],
      checkInTime,
      location: currentLocation,
      dailyRate: 200, // Default - dovrebbe venire dalle tariffe
      status: 'active'
    };
    
    setActiveEventCheckIn(newEventCheckIn);
    setEventCheckIns([newEventCheckIn, ...eventCheckIns]);
    startTimer(checkInTime);
  };

  const handleCheckOut = async () => {
    if (!activeCheckIn && !activeEventCheckIn) return;
    
    const now = new Date();
    const checkOutTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    try {
      if (activeCheckIn) {
        // Check-out magazzino
        const { error } = await supabase
          .from('warehouse_checkins')
          .update({
            check_out_time: checkOutTime,
            status: 'completed',
            overtime_hours: overtimeHours > 0 ? overtimeHours : null
          })
          .eq('id', activeCheckIn.id);
        
        if (error) throw error;
        
        setActiveCheckIn(null);
      }
      
      if (activeEventCheckIn) {
        // Check-out evento (registra giornata completa)
        setActiveEventCheckIn(null);
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Se ci sono straordinari, mostra modal
      if (overtimeHours > 0) {
        setShowOvertimeModal(true);
      }
      
    } catch (error) {
      console.error('Errore nel check-out:', error);
      alert('Errore durante il check-out');
    }
  };

  const handleSubmitExpense = async (expenseData: ExpenseSubmission) => {
    try {
      // In un'app reale, qui caricheresti il file su Supabase Storage
      const fileUrl = expenseData.receipt instanceof File ? 
        `/expenses/${expenseData.receipt.name}` : 
        expenseData.receipt;
      
      const { error } = await supabase
        .from('expenses')
        .insert({
          crew_id: user?.id,
          event_id: expenseData.eventId,
          category: expenseData.category,
          amount: expenseData.amount,
          description: expenseData.description,
          receipt_url: fileUrl,
          expense_date: expenseData.expenseDate,
          location: expenseData.location,
          notes: expenseData.notes,
          status: 'pending'
        });
      
      if (error) throw error;
      
      await loadExpenses();
      setShowExpenseModal(false);
      alert('Nota spesa inviata con successo!');
      
    } catch (error) {
      console.error('Errore nell\'invio nota spesa:', error);
      alert('Errore durante l\'invio della nota spesa');
    }
  };

  const isWorkingHours = () => {
    const now = new Date();
    const hours = now.getHours();
    return hours >= 6 && hours <= 22; // 6:00 - 22:00
  };

  const getWorkStatus = () => {
    if (activeCheckIn) return 'warehouse';
    if (activeEventCheckIn) return 'event';
    return 'idle';
  };

  const workStatus = getWorkStatus();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Caricamento CrewCheck...</p>
        </div>
      </div>
    );
  }

  // MOBILE-FIRST DESIGN
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header Mobile */}
      <div className="bg-gray-800 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">
              CM <span className="text-blue-400 italic font-extrabold tracking-wider transform -skew-x-12 inline-block">Staff</span>
            </h1>
            <p className="text-sm text-gray-300">{user?.displayName || user?.email}</p>
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
      </div>

      {/* Status Bar */}
      <div className={`p-4 ${
        workStatus === 'warehouse' ? 'bg-green-600' :
        workStatus === 'event' ? 'bg-blue-600' :
        'bg-gray-700'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {workStatus === 'warehouse' && (
              <>
                <div className="w-3 h-3 bg-green-300 rounded-full animate-pulse"></div>
                <span className="font-medium">MAGAZZINO ATTIVO</span>
              </>
            )}
            {workStatus === 'event' && (
              <>
                <div className="w-3 h-3 bg-blue-300 rounded-full animate-pulse"></div>
                <span className="font-medium">EVENTO ATTIVO</span>
              </>
            )}
            {workStatus === 'idle' && (
              <>
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span className="font-medium">NON IN SERVIZIO</span>
              </>
            )}
          </div>
          
          {(activeCheckIn || activeEventCheckIn) && (
            <div className="text-right">
              <div className="text-2xl font-mono font-bold">{elapsedTime}</div>
              {overtimeHours > 0 && (
                <div className="text-xs text-yellow-300">
                  +{overtimeHours.toFixed(1)}h straordinari
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {currentView === 'main' && (
          <>
            {/* Active Session Card */}
            {(activeCheckIn || activeEventCheckIn) ? (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {activeCheckIn ? activeCheckIn.warehouseName : activeEventCheckIn?.eventTitle}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    activeCheckIn ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {activeCheckIn ? 'Magazzino' : 'Evento Trasferta'}
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <span>Inizio: {activeCheckIn?.checkInTime || activeEventCheckIn?.checkInTime}</span>
                  </div>
                  
                  {currentLocation && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      <span className="text-sm">{currentLocation.address}</span>
                    </div>
                  )}
                  
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-center">
                      <div className="text-3xl font-mono font-bold mb-2">{elapsedTime}</div>
                      <div className="text-sm text-gray-300">
                        {activeCheckIn ? 'Ore Magazzino' : 'Giornata Evento'}
                        {overtimeHours > 0 && (
                          <span className="block text-yellow-400 mt-1">
                            +{overtimeHours.toFixed(1)}h straordinari
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleCheckOut}
                  className="w-full mt-4 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 font-medium"
                >
                  TERMINA TURNO
                </button>
              </div>
            ) : (
              /* Check-in Options */
              <div className="space-y-4">
                {/* Warehouse Check-in */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                    <QrCode className="h-6 w-6 text-purple-400" />
                    <span>Check-in Magazzino</span>
                  </h3>
                  
                  <p className="text-gray-300 mb-4">
                    Scansiona il QR code del magazzino per iniziare il turno di 8 ore
                  </p>
                  
                  <button
                    onClick={initScanner}
                    disabled={!currentLocation}
                    className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-medium"
                  >
                    SCANSIONA QR MAGAZZINO
                  </button>
                </div>

                {/* Event Check-in */}
                {todayEvents.length > 0 && (
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                      <MapPin className="h-6 w-6 text-blue-400" />
                      <span>Check-in Eventi Oggi</span>
                    </h3>
                    
                    <div className="space-y-3">
                      {todayEvents.map((assignment) => (
                        <div key={assignment.id} className="bg-gray-700 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{assignment.events.title}</h4>
                              <p className="text-sm text-gray-300">{assignment.events.location}</p>
                            </div>
                            <button
                              onClick={() => handleEventCheckIn(assignment.events.id)}
                              disabled={!currentLocation}
                              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-600"
                            >
                              Check-in
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setCurrentView('expenses')}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:bg-gray-700 transition-colors"
              >
                <div className="text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-orange-400" />
                  <span className="block font-medium">Note Spese</span>
                  {expenses.length > 0 && (
                    <span className="text-xs text-orange-400">{expenses.length} pending</span>
                  )}
                </div>
              </button>
              
              <button
                onClick={() => setCurrentView('overtime')}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:bg-gray-700 transition-colors"
              >
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-yellow-400" />
                  <span className="block font-medium">Straordinari</span>
                  {overtimeHours > 0 && (
                    <span className="text-xs text-yellow-400">+{overtimeHours.toFixed(1)}h</span>
                  )}
                </div>
              </button>
            </div>

            {/* GPS Status */}
            <div className={`rounded-lg p-4 border ${
              currentLocation ? 'bg-green-900 border-green-700' : 'bg-red-900 border-red-700'
            }`}>
              <div className="flex items-center space-x-3">
                <MapPin className={`h-5 w-5 ${currentLocation ? 'text-green-400' : 'text-red-400'}`} />
                <div>
                  <h4 className="font-medium">
                    {currentLocation ? 'GPS Attivo' : 'GPS Non Disponibile'}
                  </h4>
                  <p className="text-sm opacity-75">
                    {currentLocation ? currentLocation.address : locationError || 'Attivazione GPS richiesta'}
                  </p>
                </div>
              </div>
              
              {!currentLocation && (
                <button
                  onClick={getCurrentLocation}
                  className="w-full mt-3 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
                >
                  Attiva GPS
                </button>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Attività Recenti</h3>
              
              {checkIns.length === 0 && eventCheckIns.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                  <p>Nessuna attività registrata</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...checkIns, ...eventCheckIns]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 5)
                    .map((activity) => (
                      <div key={activity.id} className="bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">
                              {'warehouseName' in activity ? activity.warehouseName : activity.eventTitle}
                            </h4>
                            <p className="text-sm text-gray-300">
                              {new Date(activity.date).toLocaleDateString('it-IT')} • {activity.checkInTime}
                              {activity.checkOutTime && ` - ${activity.checkOutTime}`}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                            activity.status === 'active' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {activity.status === 'completed' ? 'Completato' :
                             activity.status === 'active' ? 'Attivo' : 'In Attesa'}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Scanner View */}
        {currentView === 'scanner' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Scansiona QR Code</h2>
              <button
                onClick={() => setCurrentView('main')}
                className="bg-gray-700 p-2 rounded-lg"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div id="qr-reader" className="w-full"></div>
            </div>
            
            <div className="text-center text-gray-300">
              <p className="text-sm">Inquadra il QR code del magazzino</p>
            </div>
          </div>
        )}

        {/* Expenses View */}
        {currentView === 'expenses' && (
          <ExpensesView
            expenses={expenses}
            onBack={() => setCurrentView('main')}
            onAddExpense={() => setShowExpenseModal(true)}
            currentLocation={currentLocation}
          />
        )}

        {/* Overtime View */}
        {currentView === 'overtime' && (
          <OvertimeView
            overtimeHours={overtimeHours}
            onBack={() => setCurrentView('main')}
            activeSession={activeCheckIn || activeEventCheckIn}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4">
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => setCurrentView('main')}
            className={`p-3 rounded-lg text-center ${
              currentView === 'main' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <QrCode className="h-6 w-6 mx-auto mb-1" />
            <span className="text-xs">Check-in</span>
          </button>
          
          <button
            onClick={() => setCurrentView('expenses')}
            className={`p-3 rounded-lg text-center ${
              currentView === 'expenses' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <FileText className="h-6 w-6 mx-auto mb-1" />
            <span className="text-xs">Spese</span>
            {expenses.length > 0 && (
              <div className="w-2 h-2 bg-orange-400 rounded-full mx-auto mt-1"></div>
            )}
          </button>
          
          <button
            onClick={() => setCurrentView('overtime')}
            className={`p-3 rounded-lg text-center ${
              currentView === 'overtime' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <Clock className="h-6 w-6 mx-auto mb-1" />
            <span className="text-xs">Extra</span>
            {overtimeHours > 0 && (
              <div className="w-2 h-2 bg-yellow-400 rounded-full mx-auto mt-1"></div>
            )}
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="p-3 rounded-lg text-center bg-gray-700 hover:bg-gray-600"
          >
            <Home className="h-6 w-6 mx-auto mb-1" />
            <span className="text-xs">Desktop</span>
          </button>
        </div>
      </div>

      {/* Expense Modal */}
      {showExpenseModal && (
        <ExpenseModal
          onSave={handleSubmitExpense}
          onClose={() => setShowExpenseModal(false)}
          currentLocation={currentLocation}
          activeSession={activeCheckIn || activeEventCheckIn}
        />
      )}

      {/* Overtime Modal */}
      {showOvertimeModal && (
        <OvertimeModal
          overtimeHours={overtimeHours}
          baseRate={25} // Default
          onClose={() => setShowOvertimeModal(false)}
          activeSession={activeCheckIn || activeEventCheckIn}
        />
      )}
    </div>
  );
};

// Expenses View Component
interface ExpensesViewProps {
  expenses: ExpenseSubmission[];
  onBack: () => void;
  onAddExpense: () => void;
  currentLocation: any;
}

const ExpensesView: React.FC<ExpensesViewProps> = ({ expenses, onBack, onAddExpense, currentLocation }) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'materials': return <Wrench className="h-5 w-5" />;
      case 'transport': return <Car className="h-5 w-5" />;
      case 'food': return <Utensils className="h-5 w-5" />;
      case 'accommodation': return <Home className="h-5 w-5" />;
      case 'communication': return <Phone className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      materials: 'Materiali',
      transport: 'Trasporto',
      food: 'Vitto',
      accommodation: 'Alloggio',
      communication: 'Comunicazioni',
      other: 'Altro'
    };
    return labels[category as keyof typeof labels] || category;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Note Spese</h2>
        <button
          onClick={onBack}
          className="bg-gray-700 p-2 rounded-lg"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Add Expense Button */}
      <button
        onClick={onAddExpense}
        disabled={!currentLocation}
        className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 disabled:bg-gray-600 font-medium flex items-center justify-center space-x-2"
      >
        <Plus className="h-5 w-5" />
        <span>NUOVA NOTA SPESA</span>
      </button>

      {/* Expenses List */}
      <div className="space-y-3">
        {expenses.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-600" />
            <p>Nessuna nota spesa pending</p>
          </div>
        ) : (
          expenses.map((expense) => (
            <div key={expense.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start space-x-3">
                <div className="text-orange-400">
                  {getCategoryIcon(expense.category)}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{getCategoryLabel(expense.category)}</h4>
                  <p className="text-sm text-gray-300">{expense.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-orange-400">€{expense.amount.toFixed(2)}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(expense.expenseDate).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Overtime View Component
interface OvertimeViewProps {
  overtimeHours: number;
  onBack: () => void;
  activeSession: any;
}

const OvertimeView: React.FC<OvertimeViewProps> = ({ overtimeHours, onBack, activeSession }) => {
  const baseRate = 25; // Default
  const overtimeRate = baseRate * 1.3; // 30% extra
  const overtimeAmount = overtimeHours * overtimeRate;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Straordinari</h2>
        <button
          onClick={onBack}
          className="bg-gray-700 p-2 rounded-lg"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Current Overtime */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Straordinari Attuali</h3>
        
        <div className="text-center">
          <div className="text-4xl font-mono font-bold text-yellow-400 mb-2">
            +{overtimeHours.toFixed(1)}h
          </div>
          <div className="text-sm text-gray-300 mb-4">
            Ore oltre le 8 standard + 1h pausa
          </div>
          
          {overtimeHours > 0 && (
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Tariffa base:</span>
                  <span>€{baseRate}/h</span>
                </div>
                <div className="flex justify-between">
                  <span>Tariffa straordinari:</span>
                  <span className="text-yellow-400">€{overtimeRate}/h</span>
                </div>
                <div className="flex justify-between border-t border-gray-600 pt-2">
                  <span className="font-medium">Importo extra:</span>
                  <span className="font-bold text-yellow-400">€{overtimeAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-900 rounded-lg p-4 border border-blue-700">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-100">Regole Straordinari</h4>
            <ul className="text-sm text-blue-200 mt-2 space-y-1">
              <li>• Giornata standard: 8 ore + 1 ora pausa</li>
              <li>• Straordinari: tutto oltre le 9 ore totali</li>
              <li>• Tariffa maggiorata: +30% sulla base</li>
              <li>• Approvazione automatica fino a 2 ore</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Expense Modal Component
interface ExpenseModalProps {
  onSave: (expense: ExpenseSubmission) => void;
  onClose: () => void;
  currentLocation: any;
  activeSession: any;
}

const ExpenseModal: React.FC<ExpenseModalProps> = ({ onSave, onClose, currentLocation, activeSession }) => {
  const [formData, setFormData] = useState<ExpenseSubmission>({
    category: 'food',
    amount: 0,
    description: '',
    receipt: '',
    expenseDate: new Date().toISOString().split('T')[0],
    location: currentLocation?.address || ''
  });
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setFormData({ ...formData, receipt: file });
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.receipt) {
      alert('Scontrino obbligatorio');
      return;
    }
    
    onSave({
      ...formData,
      eventId: activeSession?.eventId,
      warehouseId: activeSession?.warehouseId
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'materials': return <Wrench className="h-5 w-5" />;
      case 'transport': return <Car className="h-5 w-5" />;
      case 'food': return <Utensils className="h-5 w-5" />;
      case 'accommodation': return <Home className="h-5 w-5" />;
      case 'communication': return <Phone className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Nuova Nota Spesa</h2>
          <button
            onClick={onClose}
            className="bg-gray-700 p-2 rounded-lg"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Categoria</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'materials', label: 'Materiali', icon: 'wrench' },
                { value: 'transport', label: 'Trasporto', icon: 'car' },
                { value: 'food', label: 'Vitto', icon: 'utensils' },
                { value: 'accommodation', label: 'Alloggio', icon: 'home' },
                { value: 'communication', label: 'Comunicazioni', icon: 'phone' },
                { value: 'other', label: 'Altro', icon: 'file-text' }
              ].map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.value as any })}
                  className={`p-3 rounded-lg border text-center ${
                    formData.category === cat.value
                      ? 'border-orange-500 bg-orange-600'
                      : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    {getCategoryIcon(cat.value)}
                    <span className="text-xs">{cat.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-2">Importo (€)</label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-lg"
              min="0"
              step="0.01"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Descrizione</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white"
              rows={3}
              placeholder="Descrivi la spesa..."
              required
            />
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Scontrino</label>
            
            {!previewImage ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
                >
                  <Camera className="h-5 w-5" />
                  <span>SCATTA FOTO</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-gray-700 text-white py-3 px-4 rounded-lg hover:bg-gray-600 flex items-center justify-center space-x-2"
                >
                  <Upload className="h-5 w-5" />
                  <span>CARICA FILE</span>
                </button>
                
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <img
                  src={previewImage}
                  alt="Anteprima scontrino"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPreviewImage(null);
                    setFormData({ ...formData, receipt: '' });
                  }}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
                >
                  Rimuovi Foto
                </button>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-4 space-y-3">
            <button
              type="submit"
              className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 font-medium"
            >
              INVIA NOTA SPESA
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Overtime Modal Component
interface OvertimeModalProps {
  overtimeHours: number;
  baseRate: number;
  onClose: () => void;
  activeSession: any;
}

const OvertimeModal: React.FC<OvertimeModalProps> = ({ overtimeHours, baseRate, onClose, activeSession }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        <div className="text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-yellow-400" />
          <h3 className="text-xl font-bold mb-2">Straordinari Registrati</h3>
          
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <div className="text-3xl font-mono font-bold text-yellow-400 mb-2">
              +{overtimeHours.toFixed(1)}h
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Ore registrate:</span>
                <span className="text-yellow-400">{overtimeHours.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between border-t border-gray-600 pt-2">
                <span className="font-medium">Calcolo compenso:</span>
                <span className="font-bold text-blue-400">Commercialista</span>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-gray-300 mb-6">
            I tuoi straordinari sono stati registrati e saranno inclusi nel prossimo pagamento.
          </div>
          
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium"
          >
            CHIUDI
          </button>
        </div>
      </div>
    </div>
  );
};

export default WarehouseCheckIn;