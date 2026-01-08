import React, { useState, useEffect, useRef } from 'react';
import { Clock, Calendar, DollarSign, Plus, Edit, Trash2, Save, X, CheckCircle, AlertCircle, MapPin, Navigation, Utensils, Ticket } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';
import TimesheetModal from './TimesheetModal';

interface TimeEntry {
  id: string;
  eventTitle: string;
  eventId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakTime: number;
  totalHours: number;
  totalDays?: number;
  trackingType: 'hours' | 'days';
  hourlyRate?: number;
  dailyRate?: number;
  retentionPercentage: number;
  grossAmount: number;
  netAmount: number;
  paymentStatus: 'pending' | 'paid_by_company' | 'received_by_crew' | 'confirmed';
  notes?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  gpsLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: Date;
  };
  companyMeal?: boolean;
  mealVoucher?: boolean;
}

interface GPSLocation {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
  timestamp: Date;
}

const TimesheetManagement: React.FC = () => {
  const { user } = useAuth();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<GPSLocation | null>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [hasMealOptions, setHasMealOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCheckIn, setActiveCheckIn] = useState<TimeEntry | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Carica i timesheet reali dal database
  useEffect(() => {
    const loadTimeEntries = async () => {
      if (!user) return;
      
      try {
        // Carica i timesheet reali dal database per questo utente
        const { data: timesheetData, error: timesheetError } = await supabase
          .from('timesheet_entries')
          .select('*')
          .eq('crew_id', user?.id)
          .order('date', { ascending: false });
        
        if (timesheetError) {
          console.error('Errore nel caricamento timesheet:', timesheetError);
          // Se non ci sono timesheet, inizializza con array vuoto
          setTimeEntries([]);
        } else {
          // Mappa i dati dal database al formato dell'interfaccia
          const mappedEntries: TimeEntry[] = (timesheetData || []).map(entry => ({
            id: entry.id,
            eventTitle: entry.event_id || 'Evento Sconosciuto', // Dovremmo fare un join con events
            eventId: entry.event_id,
            date: entry.date,
            startTime: entry.start_time || '09:00',
            endTime: entry.end_time || '17:00',
            breakTime: entry.break_time || 0,
            totalHours: entry.total_hours || 0,
            totalDays: entry.total_days,
            trackingType: entry.tracking_type as 'hours' | 'days',
            hourlyRate: entry.hourly_rate,
            dailyRate: entry.daily_rate,
            retentionPercentage: entry.retention_percentage || 0,
            grossAmount: entry.gross_amount || 0,
            netAmount: entry.net_amount || 0,
            paymentStatus: entry.payment_status as any || 'pending',
            notes: entry.notes,
            status: entry.status as any || 'draft',
            gpsLocation: entry.gps_location ? {
              latitude: entry.gps_location.latitude,
              longitude: entry.gps_location.longitude,
              address: entry.gps_location.address,
              timestamp: new Date(entry.gps_location.timestamp)
            } : undefined,
            companyMeal: entry.company_meal || false,
            mealVoucher: entry.meal_voucher || false
          }));
          
          setTimeEntries(mappedEntries);
        }
        
        // Verifica se c'è un check-in attivo (timesheet in bozza senza ora fine)
        const active = timesheetData?.find(entry => entry.status === 'draft' && !entry.end_time);
        if (active) {
          const mappedActive: TimeEntry = {
            id: active.id,
            eventTitle: active.event_id || 'Evento Attivo',
            eventId: active.event_id,
            date: active.date,
            startTime: active.start_time || '09:00',
            endTime: active.end_time || '',
            breakTime: active.break_time || 0,
            totalHours: active.total_hours || 0,
            totalDays: active.total_days,
            trackingType: active.tracking_type as 'hours' | 'days',
            hourlyRate: active.hourly_rate,
            dailyRate: active.daily_rate,
            retentionPercentage: active.retention_percentage || 0,
            grossAmount: active.gross_amount || 0,
            netAmount: active.net_amount || 0,
            paymentStatus: active.payment_status as any || 'pending',
            notes: active.notes,
            status: active.status as any || 'draft',
            companyMeal: active.company_meal || false,
            mealVoucher: active.meal_voucher || false
          };
          setActiveCheckIn(mappedActive);
          startTimer(active.start_time || '09:00');
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Errore nel caricamento dei timesheet:', error);
        setIsLoading(false);
      }
    };
    
    loadTimeEntries();
    checkLocationPermission();
    
    // Verifica se l'utente ha opzioni pasto (sempre true per dipendenti)
    const checkMealOptions = async () => {
      setHasMealOptions(true);
    };
    
    checkMealOptions();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [user]);

  // Start timer for active check-in
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
    }, 1000);
  };

  // Check location permission
  const checkLocationPermission = async () => {
    if ('permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        setLocationPermission(permission.state as 'granted' | 'denied' | 'prompt');
        
        if (permission.state === 'granted') {
          getCurrentLocation();
        }
      } catch (error) {
        console.log('Permission API not supported, trying geolocation directly');
        getCurrentLocation();
      }
    } else {
      getCurrentLocation();
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          // Try to get address using reverse geocoding
          let address;
          try {
            // In a real app, you would use a geocoding service like Google Maps, Mapbox, etc.
            // For this demo, we'll simulate it
            address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          } catch (error) {
            console.error('Error getting address:', error);
            address = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
          }
          
          setCurrentLocation({
            latitude,
            longitude,
            address,
            accuracy: Math.round(accuracy),
            timestamp: new Date()
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Approvato';
      case 'submitted': return 'Inviato';
      case 'rejected': return 'Rifiutato';
      case 'draft': return 'Bozza';
      default: return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'paid_by_company': return 'bg-blue-100 text-blue-800';
      case 'received_by_crew': return 'bg-purple-100 text-purple-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confermato';
      case 'paid_by_company': return 'Pagato da Azienda';
      case 'received_by_crew': return 'Ricevuto';
      case 'pending': return 'In Attesa';
      default: return status;
    }
  };

  const handleCreateEntry = () => {
    setSelectedEntry(null);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleEditEntry = (entry: TimeEntry) => {
    setSelectedEntry(entry);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (confirm('Sei sicuro di voler eliminare questa voce timesheet?')) {
      try {
        // Elimina dal database
        const { error: deleteError } = await supabase
          .from('timesheet_entries')
          .delete()
          .eq('id', entryId);

        if (deleteError) throw deleteError;
        
        // Rimuovi dallo stato locale
        setTimeEntries(timeEntries.filter(e => e.id !== entryId));
      } catch (error) {
        console.error('Errore nell\'eliminazione del timesheet:', error);
        alert('Si è verificato un errore durante l\'eliminazione del timesheet');
      }
    }
  };

  const handleSubmitEntry = async (entryId: string) => {
    try {
      // Aggiorna lo status nel database
      const { error: updateError } = await supabase
        .from('timesheet_entries')
        .update({ 
          status: 'submitted',
          updated_at: new Date().toISOString()
        })
        .eq('id', entryId);

      if (updateError) throw updateError;
      
      // Aggiorna lo stato locale
      setTimeEntries(timeEntries.map(e => 
        e.id === entryId ? { ...e, status: 'submitted' } : e
      ));
    } catch (error) {
      console.error('Errore nell\'invio del timesheet:', error);
      alert('Si è verificato un errore durante l\'invio del timesheet');
    }
  };

  const handleUpdatePaymentStatus = async (entryId: string, newStatus: string) => {
    try {
      // Aggiorna lo status di pagamento nel database
      const { error: updateError } = await supabase
        .from('timesheet_entries')
        .update({ 
          payment_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', entryId);

      if (updateError) throw updateError;
      
      // Aggiorna lo stato locale
      setTimeEntries(timeEntries.map(e => 
        e.id === entryId ? { ...e, paymentStatus: newStatus as any } : e
      ));
    } catch (error) {
      console.error('Errore nell\'aggiornamento dello stato di pagamento:', error);
      alert('Si è verificato un errore durante l\'aggiornamento dello stato di pagamento');
    }
  };

  const handleSaveEntry = async (entryData: Partial<TimeEntry>) => {
    try {
      if (selectedEntry) {
        // Modifica entry esistente nel database
        const { error: updateError } = await supabase
          .from('timesheet_entries')
          .update({
            event_id: entryData.eventId,
            date: entryData.date,
            start_time: entryData.startTime,
            end_time: entryData.endTime,
            break_time: entryData.breakTime,
            total_hours: entryData.totalHours,
            total_days: entryData.totalDays,
            tracking_type: entryData.trackingType,
            hourly_rate: entryData.hourlyRate,
            daily_rate: entryData.dailyRate,
            retention_percentage: entryData.retentionPercentage,
            gross_amount: entryData.grossAmount,
            net_amount: entryData.netAmount,
            notes: entryData.notes,
            company_meal: entryData.companyMeal,
            meal_voucher: entryData.mealVoucher,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedEntry.id);

        if (updateError) throw updateError;
        
        // Aggiorna lo stato locale
        setTimeEntries(timeEntries.map(e => 
          e.id === selectedEntry.id ? { ...e, ...entryData } : e
        ));
      } else {
        // Crea nuovo entry nel database
        const newEntry = {
          id: uuidv4(),
          crew_id: user?.id,
          event_id: entryData.eventId || 'manual-entry',
          date: entryData.date,
          start_time: entryData.startTime,
          end_time: entryData.endTime,
          break_time: entryData.breakTime || 0,
          total_hours: entryData.totalHours,
          total_days: entryData.totalDays,
          tracking_type: entryData.trackingType || 'hours',
          hourly_rate: entryData.hourlyRate,
          daily_rate: entryData.dailyRate,
          retention_percentage: entryData.retentionPercentage || 0,
          gross_amount: entryData.grossAmount || 0,
          net_amount: entryData.netAmount || 0,
          payment_status: 'pending',
          notes: entryData.notes,
          status: 'draft',
          gps_location: currentLocation ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            address: currentLocation.address,
            timestamp: currentLocation.timestamp.toISOString()
          } : null,
          company_meal: entryData.companyMeal || false,
          meal_voucher: entryData.mealVoucher || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('timesheet_entries')
          .insert(newEntry);

        if (insertError) throw insertError;
        
        // Aggiungi allo stato locale
        const newTimeEntry: TimeEntry = {
          id: newEntry.id,
          eventTitle: entryData.eventTitle || '',
          eventId: entryData.eventId || '',
          date: entryData.date || '',
          startTime: entryData.startTime || '',
          endTime: entryData.endTime || '',
          breakTime: entryData.breakTime || 0,
          totalHours: entryData.totalHours || 0,
          totalDays: entryData.totalDays,
          trackingType: entryData.trackingType || 'hours',
          hourlyRate: entryData.hourlyRate,
          dailyRate: entryData.dailyRate,
          retentionPercentage: entryData.retentionPercentage || 0,
          grossAmount: entryData.grossAmount || 0,
          netAmount: entryData.netAmount || 0,
          paymentStatus: 'pending',
          notes: entryData.notes,
          status: 'draft',
          gpsLocation: currentLocation ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            address: currentLocation.address,
            timestamp: currentLocation.timestamp
          } : undefined,
          companyMeal: entryData.companyMeal || false,
          mealVoucher: entryData.mealVoucher || false
        };
        
        setTimeEntries([...timeEntries, newTimeEntry]);
      }
      
      setShowModal(false);
    } catch (error) {
      console.error('Errore nel salvataggio del timesheet:', error);
      alert('Si è verificato un errore durante il salvataggio del timesheet');
    }
  };

  const totalHoursThisMonth = timeEntries
    .filter(e => new Date(e.date).getMonth() === new Date().getMonth())
    .reduce((sum, e) => sum + (e.totalHours || 0), 0);

  const totalDaysThisMonth = timeEntries
    .filter(e => new Date(e.date).getMonth() === new Date().getMonth() && e.trackingType === 'days')
    .reduce((sum, e) => sum + (e.totalDays || 0), 0);

  const totalGrossEarningsThisMonth = timeEntries
    .filter(e => new Date(e.date).getMonth() === new Date().getMonth())
    .reduce((sum, e) => sum + e.grossAmount, 0);

  const totalNetEarningsThisMonth = timeEntries
    .filter(e => new Date(e.date).getMonth() === new Date().getMonth())
    .reduce((sum, e) => sum + e.netAmount, 0);

  const confirmedEarnings = timeEntries
    .filter(e => e.paymentStatus === 'confirmed')
    .reduce((sum, e) => sum + e.netAmount, 0);

  const totalCompanyMeals = timeEntries
    .filter(e => e.companyMeal)
    .length;

  const totalMealVouchers = timeEntries
    .filter(e => e.mealVoucher)
    .length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timesheet</h1>
          <p className="text-gray-600">Gestisci le tue ore di lavoro e pagamenti</p>
        </div>
        <button
          onClick={handleCreateEntry}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nuova Voce</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ore Questo Mese</p>
              <p className="text-2xl font-bold text-gray-900">{totalHoursThisMonth}h</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-indigo-500 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Giorni Lavorati</p>
              <p className="text-2xl font-bold text-gray-900">{totalDaysThisMonth}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-purple-500 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Lordo Mensile</p>
              <p className="text-2xl font-bold text-gray-900">€{totalGrossEarningsThisMonth}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-green-500 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Netto Mensile</p>
              <p className="text-2xl font-bold text-gray-900">€{totalNetEarningsThisMonth}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-orange-500 p-3 rounded-lg">
              <Utensils className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pasti Aziendali</p>
              <p className="text-2xl font-bold text-gray-900">{totalCompanyMeals}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-yellow-500 p-3 rounded-lg">
              <Ticket className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Buoni Pasto</p>
              <p className="text-2xl font-bold text-gray-900">{totalMealVouchers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Timesheet Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Le Tue Ore</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Evento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tempo/Giorni
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tariffa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pasti
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pagamento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {timeEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{entry.eventTitle}</div>
                      {entry.notes && (
                        <div className="text-sm text-gray-500">{entry.notes}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(entry.date).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div>{entry.startTime} - {entry.endTime}</div>
                      {entry.breakTime > 0 && (
                        <div className="text-xs text-gray-500">Pausa: {entry.breakTime}min</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center space-x-2">
                      {entry.trackingType === 'hours' ? (
                        <>
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span>{entry.totalHours}h</span>
                        </>
                      ) : (
                        <>
                          <Calendar className="h-4 w-4 text-green-500" />
                          <span>{entry.totalDays} giorni</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      {entry.trackingType === 'hours' ? (
                        <div>€{entry.hourlyRate}/h</div>
                      ) : (
                        <div>€{entry.dailyRate}/giorno</div>
                      )}
                      <div className="text-xs text-red-600">-{entry.retentionPercentage}%</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="text-gray-600">Lordo: €{entry.grossAmount}</div>
                      <div className="font-medium text-green-600">Netto: €{entry.netAmount}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex flex-col space-y-1">
                      {entry.companyMeal && (
                        <span className="inline-flex items-center text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                          <Utensils className="h-3 w-3 mr-1" />
                          Pasto
                        </span>
                      )}
                      {entry.mealVoucher && (
                        <span className="inline-flex items-center text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                          <Ticket className="h-3 w-3 mr-1" />
                          Buono
                        </span>
                      )}
                      {!entry.companyMeal && !entry.mealVoucher && (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(entry.paymentStatus)}`}>
                        {getPaymentStatusLabel(entry.paymentStatus)}
                      </span>
                      {entry.paymentStatus === 'paid_by_company' && (
                        <button
                          onClick={() => handleUpdatePaymentStatus(entry.id, 'received_by_crew')}
                          className="block text-xs text-blue-600 hover:text-blue-800"
                        >
                          Conferma Ricevuto
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(entry.status)}`}>
                      {getStatusLabel(entry.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {entry.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleEditEntry(entry)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleSubmitEntry(entry.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timesheet Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedEntry ? 'Modifica Timesheet' : 'Nuovo Timesheet'}
              </h3>
              
              <TimesheetModal
                entry={selectedEntry}
                isEditing={isEditing}
                currentLocation={currentLocation}
                hasMealOptions={hasMealOptions}
                onSave={handleSaveEntry}
                onClose={() => setShowModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Copyright */}
      <div className="text-center text-gray-500 text-xs py-4">
        <p>© 2025 ControlStage - Crew App Mobile V. 1.0.0</p>
        <p>Tutti i diritti riservati - Software realizzato da ControlStage</p>
      </div>
    </div>
  );
};

export default TimesheetManagement;