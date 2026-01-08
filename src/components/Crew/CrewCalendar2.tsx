import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Filter, Eye, EyeOff, Users, Clock, MapPin, Building2, Plane, X, Edit, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../lib/db';

interface CalendarEvent {
  id: string;
  title: string;
  type: 'warehouse' | 'event' | 'event_travel';
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  assignedCrew: CrewAssignment[];
  requiredCrew: number;
  status: 'draft' | 'published' | 'in_progress' | 'completed';
  isWarehouseShift: boolean;
  warehouseName?: string;
  shiftType?: 'morning' | 'afternoon' | 'night' | 'full_day';
  notes?: string;
}

interface CrewAssignment {
  id: string;
  crewId: string;
  crewName: string;
  role?: 'worker' | 'supervisor' | 'driver';
  checkInTime?: string;
  checkOutTime?: string;
  status: 'assigned' | 'checked_in' | 'checked_out' | 'absent';
}

interface CrewMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileType: 'employee' | 'freelance';
  skills: string[];
  isAvailable: boolean;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  warehouseShifts: CalendarEvent[];
}

const CalendarManagement: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useToastContext();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [warehouseShifts, setWarehouseShifts] = useState<CalendarEvent[]>([]);
  const [availableCrew, setAvailableCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtri
  const [showEvents, setShowEvents] = useState(true);
  const [showWarehouseShifts, setShowWarehouseShifts] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'event' | 'event_travel' | 'warehouse'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'in_progress' | 'completed'>('all');
  
  // Modali
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedCrewId, setSelectedCrewId] = useState<string>('');

  useEffect(() => {
    if (user?.id) {
      loadCalendarData();
    }
  }, [user?.id, currentDate]);

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      
      // Carica eventi
      await loadEvents();
      
      // Carica turni magazzino
      await loadWarehouseShifts();
      
      // Carica crew disponibili
      await loadAvailableCrew();
      
    } catch (error) {
      console.error('Errore nel caricamento dati calendario:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('crew_events')
        .select(`
          *,
          event_crew_assignments(
            id,
            crew_id,
            crew_name,
            final_hourly_rate,
            final_daily_rate,
            payment_status
          )
        `)
        .eq('company_id', user?.id)
        .order('start_date', { ascending: true });
      
      if (eventsError) {
        console.error('Errore caricamento eventi:', eventsError);
        setEvents([]);
        return;
      }
      
      const mappedEvents: CalendarEvent[] = (eventsData || []).map(event => ({
        id: event.id,
        title: event.title,
        type: event.type,
        date: event.start_date,
        startTime: '09:00', // Default
        endTime: '17:00', // Default
        location: event.location || '',
        assignedCrew: (event.event_crew_assignments || []).map((assignment: any) => ({
          id: assignment.id,
          crewId: assignment.crew_id,
          crewName: assignment.crew_name || 'Crew',
          status: 'assigned'
        })),
        requiredCrew: event.required_crew || 0,
        status: event.status,
        isWarehouseShift: false
      }));
      
      setEvents(mappedEvents);
    } catch (error) {
      console.error('Errore nel caricamento eventi:', error);
      setEvents([]);
    }
  };

  const loadWarehouseShifts = async () => {
    try {
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('warehouse_shifts')
        .select(`
          *,
          warehouses!warehouse_id(name, address),
          warehouse_shift_assignments(
            id,
            employee_id,
            employee_name,
            role,
            status,
            check_in_time,
            check_out_time
          )
        `)
        .eq('company_id', user?.id)
        .order('date', { ascending: true });
      
      if (shiftsError) {
        console.error('Errore caricamento turni magazzino:', shiftsError);
        setWarehouseShifts([]);
        return;
      }
      
      const mappedShifts: CalendarEvent[] = (shiftsData || []).map(shift => ({
        id: shift.id,
        title: shift.shift_name || `Turno ${shift.shift_type}`,
        type: 'warehouse',
        date: shift.date,
        startTime: shift.start_time,
        endTime: shift.end_time,
        location: shift.warehouses?.name || 'Magazzino',
        assignedCrew: (shift.warehouse_shift_assignments || []).map((assignment: any) => ({
          id: assignment.id,
          crewId: assignment.employee_id,
          crewName: assignment.employee_name || 'Dipendente',
          role: assignment.role,
          status: assignment.status,
          checkInTime: assignment.check_in_time,
          checkOutTime: assignment.check_out_time
        })),
        requiredCrew: shift.required_crew || 0,
        status: shift.status,
        isWarehouseShift: true,
        warehouseName: shift.warehouses?.name,
        shiftType: shift.shift_type,
        notes: shift.notes
      }));
      
      setWarehouseShifts(mappedShifts);
    } catch (error) {
      console.error('Errore nel caricamento turni magazzino:', error);
      setWarehouseShifts([]);
    }
  };

  const loadAvailableCrew = async () => {
    try {
      const { data: employeesData, error: employeesError } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('parent_company_id', user?.id)
        .eq('status', 'approved');
      
      if (employeesError) {
        console.error('Errore caricamento dipendenti:', employeesError);
        setAvailableCrew([]);
        return;
      }
      
      const mappedCrew: CrewMember[] = (employeesData || []).map(emp => {
        const fullName = emp.full_name || emp.company_name || '';
        const nameParts = fullName.split(' ');
        
        return {
          id: emp.id,
          firstName: nameParts[0] || 'Nome',
          lastName: nameParts.slice(1).join(' ') || 'Cognome',
          email: emp.email,
          profileType: 'employee',
          skills: [],
          isAvailable: true
        };
      });
      
      setAvailableCrew(mappedCrew);
    } catch (error) {
      console.error('Errore nel caricamento crew:', error);
      setAvailableCrew([]);
    }
  };

  const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date: Date): CalendarDay[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const days: CalendarDay[] = [];
    
    // Giorni del mese precedente
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevDate = new Date(year, month, 1 - (firstDayOfWeek - i));
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        isToday: false,
        events: getEventsForDate(prevDate),
        warehouseShifts: getWarehouseShiftsForDate(prevDate)
      });
    }
    
    // Giorni del mese corrente
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = new Date(year, month, day);
      days.push({
        date: currentDay,
        isCurrentMonth: true,
        isToday: formatDateKey(currentDay) === formatDateKey(new Date()),
        events: getEventsForDate(currentDay),
        warehouseShifts: getWarehouseShiftsForDate(currentDay)
      });
    }
    
    // Giorni del mese successivo
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        isToday: false,
        events: getEventsForDate(nextDate),
        warehouseShifts: getWarehouseShiftsForDate(nextDate)
      });
    }
    
    return days;
  };

  const getEventsForDate = (targetDate: Date): CalendarEvent[] => {
    const targetDateString = formatDateKey(targetDate);
    
    return events.filter(event => {
      const eventStartDate = event.date;
      const isMatch = eventStartDate === targetDateString;
      
      // Applica filtri
      if (eventTypeFilter !== 'all' && event.type !== eventTypeFilter) return false;
      if (statusFilter !== 'all' && event.status !== statusFilter) return false;
      
      return isMatch;
    });
  };

  const getWarehouseShiftsForDate = (targetDate: Date): CalendarEvent[] => {
    const targetDateString = formatDateKey(targetDate);
    
    return warehouseShifts.filter(shift => {
      const shiftDate = shift.date;
      const isMatch = shiftDate === targetDateString;
      
      // Applica filtri
      if (eventTypeFilter !== 'all' && eventTypeFilter !== 'warehouse') return false;
      if (statusFilter !== 'all' && shift.status !== statusFilter) return false;
      
      return isMatch;
    });
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    const dateKey = formatDateKey(date);
    setSelectedDate(dateKey);
    setShowEventModal(true);
  };

  const handleAssignCrew = async (eventId: string, crewId: string, isWarehouseShift: boolean) => {
    try {
      const crew = availableCrew.find(c => c.id === crewId);
      if (!crew) {
        showError('Errore', 'Crew non trovato');
        return;
      }
      
      if (isWarehouseShift) {
        // Assegna a turno magazzino
        const { error } = await supabase
          .from('warehouse_shift_assignments')
          .insert({
            shift_id: eventId,
            employee_id: crewId,
            employee_name: `${crew.firstName} ${crew.lastName}`,
            role: 'worker',
            status: 'assigned'
          });
        
        if (error) throw error;
        
        showSuccess('Crew Assegnato', `${crew.firstName} ${crew.lastName} assegnato al turno magazzino`);
      } else {
        // Assegna a evento
        const { error } = await supabase
          .from('event_crew_assignments')
          .insert({
            event_id: eventId,
            crew_id: crewId,
            crew_name: `${crew.firstName} ${crew.lastName}`,
            payment_status: 'pending'
          });
        
        if (error) throw error;
        
        showSuccess('Crew Assegnato', `${crew.firstName} ${crew.lastName} assegnato all'evento`);
      }
      
      // Ricarica dati
      await loadCalendarData();
      setShowAssignmentModal(false);
      
    } catch (error) {
      console.error('Errore nell\'assegnazione crew:', error);
      showError('Errore Assegnazione', 'Errore durante l\'assegnazione del crew');
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'warehouse': return 'bg-gray-500';
      case 'event': return 'bg-blue-500';
      case 'event_travel': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'warehouse': return 'Magazzino';
      case 'event': return 'Evento';
      case 'event_travel': return 'Trasferta';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Bozza';
      case 'published': return 'Pubblicato';
      case 'in_progress': return 'In Corso';
      case 'completed': return 'Completato';
      default: return status;
    }
  };

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const days = getDaysInMonth(currentDate);
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Statistiche
  const totalEvents = events.filter(e => {
    const eventDate = new Date(e.date);
    return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
  }).length;

  const totalWarehouseShifts = warehouseShifts.filter(s => {
    const shiftDate = new Date(s.date);
    return shiftDate.getMonth() === currentMonth && shiftDate.getFullYear() === currentYear;
  }).length;

  const totalAssignedCrew = [...events, ...warehouseShifts].reduce((sum, item) => sum + item.assignedCrew.length, 0);

  if (loading) {
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
          <h1 className="text-2xl font-bold text-gray-900">📅 Calendario Aziendale</h1>
          <p className="text-gray-600">Visualizza eventi e turni magazzino in un unico calendario</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => window.location.href = '/company/events?create=true'}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Nuovo Evento</span>
          </button>
          <button
            onClick={() => window.location.href = '/company/warehouse-shifts'}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2"
          >
            <Building2 className="h-5 w-5" />
            <span>Nuovo Turno</span>
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Filter className="h-5 w-5" />
          <span>Filtri Calendario</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Toggle Visibilità */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mostra</label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showEvents}
                  onChange={(e) => setShowEvents(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">🎭 Eventi</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showWarehouseShifts}
                  onChange={(e) => setShowWarehouseShifts(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">🏭 Turni Magazzino</span>
              </label>
            </div>
          </div>

          {/* Filtro Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">🗓️ Tutti</option>
              <option value="warehouse">🏭 Solo Magazzino</option>
              <option value="event">🎭 Solo Eventi</option>
              <option value="event_travel">✈️ Solo Trasferte</option>
            </select>
          </div>

          {/* Filtro Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">Tutti</option>
              <option value="draft">Bozza</option>
              <option value="published">Pubblicato</option>
              <option value="in_progress">In Corso</option>
              <option value="completed">Completato</option>
            </select>
          </div>

          {/* Reset */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setShowEvents(true);
                setShowWarehouseShifts(true);
                setEventTypeFilter('all');
                setStatusFilter('all');
              }}
              className="w-full bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700"
            >
              Reset Filtri
            </button>
          </div>
        </div>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Eventi Questo Mese</p>
              <p className="text-2xl font-bold text-gray-900">{totalEvents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-gray-500 p-3 rounded-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Turni Magazzino</p>
              <p className="text-2xl font-bold text-gray-900">{totalWarehouseShifts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-green-500 p-3 rounded-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Crew Assegnati</p>
              <p className="text-2xl font-bold text-gray-900">{totalAssignedCrew}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-purple-500 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Totale Attività</p>
              <p className="text-2xl font-bold text-gray-900">{totalEvents + totalWarehouseShifts}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <h2 className="text-xl font-semibold text-gray-900">
            {monthNames[currentMonth]} {currentYear}
          </h2>
          
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Header giorni */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          {/* Griglia calendario */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const allItems = [
                ...(showEvents ? day.events : []),
                ...(showWarehouseShifts ? day.warehouseShifts : [])
              ];
              
              let dayClasses = 'min-h-[120px] p-2 border border-gray-100 cursor-pointer transition-colors relative ';
              
              if (!day.isCurrentMonth) {
                dayClasses += 'bg-gray-50 text-gray-400 ';
              } else {
                dayClasses += 'hover:bg-gray-50 ';
              }
              
              if (day.isToday) {
                dayClasses += 'ring-2 ring-blue-500 ';
              }

              return (
                <div
                  key={index}
                  className={dayClasses}
                  onClick={() => handleDateClick(day.date)}
                >
                  <div className="flex items-start justify-between">
                    <span className={`text-sm font-medium ${day.isToday ? 'text-blue-600' : ''}`}>
                      {day.date.getDate()}
                    </span>
                    
                    {allItems.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">
                          {allItems.length}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 space-y-1">
                    {/* Eventi */}
                    {showEvents && day.events.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs px-2 py-1 rounded text-white truncate ${getEventTypeColor(event.type)}`}
                        title={`${event.title} - ${event.location} - ${event.assignedCrew.length}/${event.requiredCrew} crew`}
                      >
                        <div className="flex items-center space-x-1">
                          {event.type === 'event_travel' && <Plane className="h-3 w-3" />}
                          <span className="truncate font-medium">{event.title}</span>
                        </div>
                      </div>
                    ))}

                    {/* Turni Magazzino */}
                    {showWarehouseShifts && day.warehouseShifts.slice(0, 2).map((shift) => (
                      <div
                        key={shift.id}
                        className="text-xs px-2 py-1 rounded text-white truncate bg-gray-600"
                        title={`${shift.title} - ${shift.warehouseName} - ${shift.startTime}-${shift.endTime} - ${shift.assignedCrew.length}/${shift.requiredCrew} crew`}
                      >
                        <div className="flex items-center space-x-1">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate font-medium">{shift.warehouseName}</span>
                        </div>
                      </div>
                    ))}

                    {allItems.length > 4 && (
                      <div className="text-xs text-gray-500 px-2">
                        +{allItems.length - 4} altri
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Legenda</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-sm text-gray-700">Eventi Standard</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-purple-500 rounded"></div>
            <span className="text-sm text-gray-700">Eventi Trasferta</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-600 rounded"></div>
            <span className="text-sm text-gray-700">Turni Magazzino</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
            <span className="text-sm text-gray-700">Oggi</span>
          </div>
        </div>
      </div>

      {/* Modal Dettagli Giorno */}
      {showEventModal && selectedDate && (
        <DayDetailsModal
          date={selectedDate}
          events={showEvents ? getEventsForDate(new Date(selectedDate + 'T12:00:00')) : []}
          warehouseShifts={showWarehouseShifts ? getWarehouseShiftsForDate(new Date(selectedDate + 'T12:00:00')) : []}
          onClose={() => setShowEventModal(false)}
          onAssignCrew={(eventId, isWarehouseShift) => {
            setSelectedEvent(
              isWarehouseShift 
                ? warehouseShifts.find(s => s.id === eventId) || null
                : events.find(e => e.id === eventId) || null
            );
            setShowAssignmentModal(true);
          }}
        />
      )}

      {/* Modal Assegnazione Crew */}
      {showAssignmentModal && selectedEvent && (
        <CrewAssignmentModal
          event={selectedEvent}
          availableCrew={availableCrew}
          selectedCrewId={selectedCrewId}
          setSelectedCrewId={setSelectedCrewId}
          onAssign={handleAssignCrew}
          onClose={() => setShowAssignmentModal(false)}
        />
      )}
    </div>
  );
};

// Modal Dettagli Giorno
interface DayDetailsModalProps {
  date: string;
  events: CalendarEvent[];
  warehouseShifts: CalendarEvent[];
  onClose: () => void;
  onAssignCrew: (eventId: string, isWarehouseShift: boolean) => void;
}

const DayDetailsModal: React.FC<DayDetailsModalProps> = ({
  date,
  events,
  warehouseShifts,
  onClose,
  onAssignCrew
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T12:00:00').toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'warehouse': return 'bg-gray-100 text-gray-800';
      case 'event': return 'bg-blue-100 text-blue-800';
      case 'event_travel': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Attività del {formatDate(date)}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Eventi */}
            {events.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <span>Eventi ({events.length})</span>
                </h4>
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h5 className="font-medium text-gray-900">{event.title}</h5>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEventTypeColor(event.type)}`}>
                              {event.type === 'event' ? 'Evento' : 'Trasferta'}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(event.status)}`}>
                              {event.status === 'published' ? 'Pubblicato' : 'Bozza'}
                            </span>
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-4 w-4" />
                              <span>{event.location}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4" />
                              <span>{event.assignedCrew.length}/{event.requiredCrew} crew</span>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => onAssignCrew(event.id, false)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Gestisci Crew
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Turni Magazzino */}
            {warehouseShifts.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-gray-600" />
                  <span>Turni Magazzino ({warehouseShifts.length})</span>
                </h4>
                <div className="space-y-3">
                  {warehouseShifts.map((shift) => (
                    <div key={shift.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h5 className="font-medium text-gray-900">{shift.warehouseName}</h5>
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              {shift.shiftType === 'morning' ? 'Mattino' :
                               shift.shiftType === 'afternoon' ? 'Pomeriggio' :
                               shift.shiftType === 'night' ? 'Notte' : 'Giornata Intera'}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(shift.status)}`}>
                              {shift.status === 'published' ? 'Pubblicato' : 'Bozza'}
                            </span>
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4" />
                              <span>{shift.startTime} - {shift.endTime}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4" />
                              <span>{shift.assignedCrew.length}/{shift.requiredCrew} dipendenti</span>
                            </div>
                          </div>
                          
                          {shift.notes && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
                              <strong>Note:</strong> {shift.notes}
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => onAssignCrew(shift.id, true)}
                          className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
                        >
                          Gestisci Dipendenti
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nessuna attività */}
            {events.length === 0 && warehouseShifts.length === 0 && (
              <div className="lg:col-span-2 text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Nessuna attività in questa data</p>
                <p className="text-sm mt-1">Clicca su "Nuovo Evento" o "Nuovo Turno" per aggiungere attività</p>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal Assegnazione Crew
interface CrewAssignmentModalProps {
  event: CalendarEvent;
  availableCrew: CrewMember[];
  selectedCrewId: string;
  setSelectedCrewId: (id: string) => void;
  onAssign: (eventId: string, crewId: string, isWarehouseShift: boolean) => void;
  onClose: () => void;
}

const CrewAssignmentModal: React.FC<CrewAssignmentModalProps> = ({
  event,
  availableCrew,
  selectedCrewId,
  setSelectedCrewId,
  onAssign,
  onClose
}) => {
  const assignedCrewIds = event.assignedCrew.map(c => c.crewId);
  const unassignedCrew = availableCrew.filter(crew => !assignedCrewIds.includes(crew.id));

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Gestisci {event.isWarehouseShift ? 'Dipendenti' : 'Crew'} - {event.title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Crew Assegnati */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                {event.isWarehouseShift ? 'Dipendenti' : 'Crew'} Assegnati ({event.assignedCrew.length}/{event.requiredCrew})
              </h4>
              {event.assignedCrew.length === 0 ? (
                <div className="text-center py-6 text-gray-500 border border-gray-200 rounded-lg">
                  <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>Nessuno assegnato</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {event.assignedCrew.map((assignment) => (
                    <div key={assignment.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{assignment.crewName}</div>
                          {assignment.role && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              {assignment.role === 'worker' ? 'Operaio' :
                               assignment.role === 'supervisor' ? 'Responsabile' : 'Autista'}
                            </span>
                          )}
                          {assignment.checkInTime && (
                            <div className="text-xs text-green-600 mt-1">
                              Check-in: {assignment.checkInTime}
                            </div>
                          )}
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          assignment.status === 'checked_in' ? 'bg-green-100 text-green-800' :
                          assignment.status === 'checked_out' ? 'bg-blue-100 text-blue-800' :
                          assignment.status === 'absent' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {assignment.status === 'checked_in' ? 'Presente' :
                           assignment.status === 'checked_out' ? 'Uscito' :
                           assignment.status === 'absent' ? 'Assente' : 'Assegnato'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Crew Non Assegnati */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                {event.isWarehouseShift ? 'Dipendenti' : 'Crew'} Disponibili ({unassignedCrew.filter(crew => event.isWarehouseShift ? crew.profileType === 'employee' : true).length})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {unassignedCrew
                  .filter(crew => event.isWarehouseShift ? crew.profileType === 'employee' : true)
                  .map(crew => (
                    <div
                      key={crew.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedCrewId === crew.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedCrewId(crew.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            {crew.firstName} {crew.lastName}
                          </div>
                          <div className="text-sm text-gray-600">{crew.email}</div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            crew.profileType === 'employee' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {crew.profileType === 'employee' ? 'Dipendente' : 'Freelance'}
                          </span>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${crew.isAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                    </div>
                  ))}
                
                {event.isWarehouseShift && unassignedCrew.filter(c => c.profileType === 'employee').length === 0 && (
                  <div className="text-center py-6 text-gray-500 border border-gray-200 rounded-lg">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>Nessun dipendente disponibile</p>
                    <p className="text-xs mt-1">I turni magazzino sono solo per dipendenti</p>
                  </div>
                )}
              </div>
              
              {selectedCrewId && (
                <button
                  onClick={() => onAssign(event.id, selectedCrewId, event.isWarehouseShift)}
                  className="w-full mt-3 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                >
                  Assegna {event.isWarehouseShift ? 'Dipendente' : 'Crew'}
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarManagement;