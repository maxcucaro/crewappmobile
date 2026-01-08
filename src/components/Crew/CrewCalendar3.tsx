import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Eye, EyeOff, Plus, Settings, MapPin, Clock, Building2, Users, AlertTriangle, CheckCircle, X, Edit } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { supabase } from '../../lib/db';

interface CrewEvent {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location: string;
  type: 'warehouse' | 'event' | 'event_travel';
  status: 'confirmed' | 'pending' | 'completed';
  rate?: number;
  rateType: 'hourly' | 'daily';
  isVisible: boolean;
  notes?: string;
  paymentStatus: 'pending' | 'paid' | 'confirmed';
  isCompanyEvent?: boolean;
  isAssigned?: boolean;
  assignedCrewNames?: string;
  assignedCrewCount?: number;
}

interface PersonalEvent {
  id: string;
  title: string;
  date: string;
  type: 'personal' | 'vacation' | 'unavailable';
  isVisible: boolean;
  notes?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CrewEvent[];
  personalEvents: PersonalEvent[];
  isAvailable: boolean;
}

const CrewCalendar: React.FC = () => {
  const { user } = useAuth();
  const { getCrewBusyDates, syncCrewCalendar } = usePrivacy();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showCompanyEvents, setShowCompanyEvents] = useState(true);
  const [companyEvents, setCompanyEvents] = useState<CrewEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<'all' | 'assigned' | 'warehouse'>('all');

  const [crewEvents, setCrewEvents] = useState<CrewEvent[]>([
    {
      id: 'event-1',
      title: 'Fiera del Mobile Milano',
      companyId: 'company-1',
      companyName: 'EventPro SRL',
      date: '2025-03-15',
      endDate: '2025-03-18',
      startTime: '08:00',
      endTime: '18:00',
      location: 'Milano Rho',
      type: 'event_travel',
      status: 'confirmed',
      rate: 25,
      rateType: 'hourly',
      isVisible: true,
      paymentStatus: 'confirmed',
      isAssigned: true
    },
    {
      id: 'event-2',
      title: 'Inventario Magazzino',
      companyId: 'company-1',
      companyName: 'EventPro SRL',
      date: '2025-03-20',
      endDate: '2025-03-20',
      startTime: '09:00',
      endTime: '17:00',
      location: 'Roma',
      type: 'warehouse',
      status: 'confirmed',
      rate: 200,
      rateType: 'daily',
      isVisible: true,
      paymentStatus: 'pending',
      isAssigned: true
    },
    {
      id: 'event-3',
      title: 'Setup Stand Fiera',
      companyId: 'company-2',
      companyName: 'TechEvents',
      date: '2025-03-25',
      endDate: '2025-03-27',
      startTime: '14:00',
      endTime: '22:00',
      location: 'Torino',
      type: 'event',
      status: 'pending',
      rate: 28,
      rateType: 'hourly',
      isVisible: false,
      notes: 'Evento privato - non visibile ad altre aziende',
      paymentStatus: 'pending',
      isAssigned: false
    },
    {
      id: 'event-4',
      title: 'Conferenza Aziendale',
      companyId: 'company-1',
      companyName: 'EventPro SRL',
      date: '2025-03-28',
      endDate: '2025-03-30',
      startTime: '09:00',
      endTime: '18:00',
      location: 'Milano',
      type: 'event',
      status: 'confirmed',
      rate: 220,
      rateType: 'daily',
      isVisible: true,
      paymentStatus: 'pending',
      isAssigned: true
    },
    {
      id: 'sfilata-moda',
      title: 'sfilata di moda',
      companyId: 'company-1',
      companyName: 'Massimiliano Cucaro',
      date: '2025-08-07',
      endDate: '2025-08-09',
      startTime: '09:00',
      endTime: '17:00',
      location: 'roma',
      type: 'event',
      status: 'confirmed',
      rate: 220,
      rateType: 'daily',
      isVisible: true,
      paymentStatus: 'pending',
      isAssigned: true,
      assignedCrewNames: 'ttt, carlo'
    },
    {
      id: 'evento-latina',
      title: 'Evento',
      companyId: 'company-1',
      companyName: 'Massimiliano Cucaro',
      date: '2025-08-06',
      endDate: '2025-08-08',
      startTime: '09:00',
      endTime: '17:00',
      location: 'LATINA',
      type: 'event',
      status: 'confirmed',
      rate: 220,
      rateType: 'daily',
      isVisible: true,
      paymentStatus: 'pending',
      isAssigned: true,
      assignedCrewNames: 'max max, ttt, carlo'
    }
  ]);

  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([
    {
      id: 'personal-1',
      title: 'Appuntamento Medico',
      date: '2025-03-18',
      type: 'personal',
      isVisible: false,
      notes: 'Visita medica privata'
    },
    {
      id: 'personal-2',
      title: 'Vacanza',
      date: '2025-03-22',
      type: 'vacation',
      isVisible: true,
      notes: 'Vacanza programmata'
    },
    {
      id: 'personal-3',
      title: 'Non Disponibile',
      date: '2025-03-30',
      type: 'unavailable',
      isVisible: true,
      notes: 'Impegno personale'
    }
  ]);

  React.useEffect(() => {
    if (user?.id) {
      loadUserProfile();
    }
  }, [user?.id]);

  const loadUserProfile = async () => {
    try {
      console.log('🔍 Caricamento profilo per user ID:', user?.id);
      
      const { data: userData, error: userError } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle();

      if (userError) {
        console.error('Errore nel caricamento profilo:', userError);
        await loadFreelanceProfile();
        return;
      }

      if (!userData) {
        console.log('⚠️ Utente non trovato in registration_requests, provo come freelance');
        await loadFreelanceProfile();
        return;
      }
      
      console.log('✅ Profilo caricato:', userData);
      setUserProfile(userData);

      if (userData.parent_company_id) {
        console.log('👥 È un dipendente, carico eventi azienda:', userData.parent_company_id);
        await loadCompanyEvents(userData.parent_company_id);
      } else {
        console.log('👤 È un freelance, carico solo eventi assegnati');
        await loadFreelanceEvents();
      }
    } catch (error) {
      console.error('Errore nel caricamento dati utente:', error);
    }
  };

  const loadFreelanceProfile = async () => {
    try {
      const { data: crewData, error: crewError } = await supabase
        .from('crew_members')
        .select('*')
        .eq('auth_user_id', user?.id)
        .maybeSingle();
      
      if (crewData) {
        console.log('✅ Profilo freelance caricato:', crewData);
        setUserProfile({ 
          ...crewData, 
          parent_company_id: crewData.company_id 
        });
        
        if (crewData.company_id) {
          await loadCompanyEvents(crewData.company_id);
        } else {
          await loadFreelanceEvents();
        }
      } else {
        console.log('❌ Profilo non trovato né in registration_requests né in crew_members');
      }
    } catch (error) {
      console.error('Errore nel caricamento profilo freelance:', error);
    }
  };

  const loadCompanyEvents = async (companyId: string) => {
    try {
      console.log('📅 Caricamento eventi azienda per dipendente:', companyId);
      console.log('👤 User ID corrente:', user?.id);
      
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          regaziendasoftware!company_id(ragione_sociale),
          event_crew_assignments(
            crew_id,
            crew_name,
            final_hourly_rate,
            final_daily_rate,
            payment_status,
            auth_user_id
          )
        `)
        .eq('company_id', companyId)
        .order('start_date', { ascending: true });

      if (eventsError) {
        console.error('Errore nel caricamento eventi azienda:', eventsError);
        setCrewEvents([]);
        return;
      }

      console.log('✅ Eventi azienda caricati RAW:', eventsData);
      console.log('📊 Numero eventi trovati:', eventsData?.length || 0);
      
      eventsData?.forEach(event => {
        console.log(`🎭 Evento "${event.title}":`, {
          eventId: event.id,
          assignments: event.event_crew_assignments?.map((a: any) => ({
            crew_id: a.crew_id,
            isCurrentUser: a.crew_id === user?.id
          }))
        });
      });
      
      const eventsWithCrewNames = (eventsData || []).map(event => {
        const crewAssignments = (event.event_crew_assignments || []).map((assignment: any) => ({
          ...assignment,
          crewName: assignment.crew_name || 'Nome non trovato',
          isCurrentUser: assignment.crew_id === user?.id || assignment.auth_user_id === user?.id
        }));
        
        return {
          ...event,
          crewAssignments
        };
      });
      
      const mappedCompanyEvents: CrewEvent[] = eventsWithCrewNames.map(event => {
        const isAssigned = event.crewAssignments?.some((assignment: any) => 
          assignment.isCurrentUser === true
        ) || false;
        
        const assignedCrew = event.crewAssignments || [];
        
        console.log(`🎭 Evento "${event.title}":`, {
          eventId: event.id,
          isAssigned,
          userID: user?.id,
          crewAssignments: assignedCrew.map((c: any) => ({
            crew_id: c.crew_id,
            crewName: c.crewName,
            isCurrentUser: c.isCurrentUser
          }))
        });
        
        return {
          id: event.id,
          title: event.title,
          companyId: event.company_id,
          companyName: event.regaziendasoftware?.ragione_sociale || 'La Mia Azienda',
          date: event.start_date, 
          endDate: event.end_date,
          startTime: '09:00',
          endTime: '17:00',
          location: event.location || 'Sede aziendale',
          type: event.type,
          status: event.status === 'published' || event.status === 'confirmed' ? 'confirmed' : 'pending',
          rate: undefined,
          rateType: 'hourly',
          isVisible: true,
          paymentStatus: 'pending',
          isCompanyEvent: true,
          isAssigned: isAssigned,
          assignedCrewNames: assignedCrew.map((c: any) => c.crew_name || c.crewName).filter(name => name && name !== 'Nome non trovato').join(', '),
          assignedCrewCount: assignedCrew.length,
          notes: isAssigned ? '✅ Sei assegnato a questo evento' : undefined
        };
      });

      console.log('📊 Eventi mappati:', {
        totale: mappedCompanyEvents.length,
        assegnati: mappedCompanyEvents.filter(e => e.isAssigned).length,
        perData: mappedCompanyEvents.reduce((acc, e) => {
          const month = new Date(e.date).getMonth();
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        }, {} as Record<number, number>),
        eventiPerTitolo: mappedCompanyEvents.map(e => ({ title: e.title, date: e.date, assigned: e.isAssigned }))
      });
      
      setCrewEvents(mappedCompanyEvents);

    } catch (error) {
      console.error('Errore nel caricamento eventi azienda:', error);
      setCrewEvents([]);
    }
  };
  
  const loadFreelanceEvents = async () => {
    try {
      console.log('👤 Caricamento eventi freelance per:', user?.id);
      
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('event_crew_assignments')
        .select(`
          *,
          registration_requests!crew_id(full_name, company_name, auth_user_id),
          crew_members!crew_id(first_name, last_name),
          events!event_id(
            id,
            title,
            start_date,
            end_date,
            location,
            type,
            status,
            company_id,
            regaziendasoftware!company_id(ragione_sociale)
          )
        `)
        .eq('crew_id', user?.id);
      
      if (assignmentsError) {
        console.error('Errore nel caricamento eventi freelance:', assignmentsError);
        setCrewEvents([]);
        return;
      }
      
      const freelanceEvents: CrewEvent[] = (assignmentsData || []).map(assignment => {
        const event = assignment.events;
        return {
          id: event.id,
          title: event.title,
          companyId: event.company_id,
          companyName: event.regaziendasoftware?.ragione_sociale || 'Azienda',
          date: event.start_date,
          endDate: event.end_date,
          startTime: '09:00',
          endTime: '17:00',
          location: event.location || 'Da definire',
          type: event.type,
          status: 'confirmed',
          rate: assignment.final_hourly_rate || assignment.final_daily_rate,
          rateType: assignment.final_hourly_rate ? 'hourly' : 'daily',
          isVisible: true,
          paymentStatus: assignment.payment_status || 'pending',
          isCompanyEvent: false,
          isAssigned: true,
          notes: 'Evento assegnato come freelance'
        };
      });
      
      setCrewEvents(freelanceEvents);
      
    } catch (error) {
      console.error('Errore nel caricamento eventi freelance:', error);
      setCrewEvents([]);
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
    
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevDate = new Date(year, month, 1 - (firstDayOfWeek - i));
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        isToday: false,
        events: getEventsForDate(prevDate),
        personalEvents: getPersonalEventsForDate(prevDate),
        isAvailable: true
      });
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = new Date(year, month, day);
      const dayEvents = getEventsForDate(currentDay);
      const dayPersonalEvents = getPersonalEventsForDate(currentDay);
      
      days.push({
        date: currentDay,
        isCurrentMonth: true,
        isToday: formatDateKey(currentDay) === formatDateKey(new Date()),
        events: dayEvents,
        personalEvents: dayPersonalEvents,
        isAvailable: dayEvents.length === 0 && dayPersonalEvents.length === 0
      });
    }
    
    console.log(`📊 Giorni generati per ${monthNames[month]} ${year}:`, {
      totaleGiorni: days.filter(d => d.isCurrentMonth).length,
      giorniConEventi: days.filter(d => d.isCurrentMonth && d.events.length > 0).length,
      eventiTotali: days.reduce((sum, d) => sum + d.events.length, 0)
    });
    
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        isToday: false,
        events: getEventsForDate(nextDate),
        personalEvents: getPersonalEventsForDate(nextDate),
        isAvailable: true
      });
    }
    
    return days;
  };

  const getEventsForDate = (targetDate: Date): CrewEvent[] => {
    // Usa direttamente il formato YYYY-MM-DD senza conversioni timezone
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const targetDateString = `${year}-${month}-${day}`;
    
    console.log(`🔍 Cercando eventi per data: ${targetDateString}`);
    
    let filteredEvents = crewEvents.filter(event => {
      const eventStartDate = event.date;
      const eventEndDate = event.endDate || event.date;
      
      // Le date nel database sono già in formato YYYY-MM-DD, usale direttamente
      const normalizedStartDate = eventStartDate;
      const normalizedEndDate = eventEndDate;
      
      const isInRange = targetDateString >= normalizedStartDate && targetDateString <= normalizedEndDate;
      
      console.log(`📅 Evento "${event.title}":`, {
        targetDate: targetDateString,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        isInRange: isInRange,
        comparison: `${targetDateString} >= ${normalizedStartDate} && ${targetDateString} <= ${normalizedEndDate}`
      });
      
      return isInRange;
    });
    
    // Applica filtro eventi
    switch (eventFilter) {
      case 'assigned':
        return filteredEvents.filter(event => event.isAssigned);
      case 'warehouse':
        return filteredEvents.filter(event => event.type === 'warehouse');
      default:
        return filteredEvents;
    }
  };

  const getPersonalEventsForDate = (targetDate: Date): PersonalEvent[] => {
    // Usa direttamente il formato YYYY-MM-DD senza conversioni timezone
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const targetDateString = `${year}-${month}-${day}`;
    
    console.log(`🔍 Cercando eventi personali per data: ${targetDateString}`);
    return personalEvents.filter(e => {
      // Le date sono già in formato YYYY-MM-DD, confronta direttamente
      return e.date === targetDateString;
    });
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    if (!date) return;
    
    const dayEvents = getEventsForDate(date);
    const dayPersonalEvents = getPersonalEventsForDate(date);
    
    if (dayEvents.length > 0 || dayPersonalEvents.length > 0) {
      const dateKey = formatDateKey(date);
      setSelectedDate(dateKey);
      setShowEventModal(true);
    } else {
      console.log('Nessun evento in questa data');
    }
  };

  const handleAddPersonalEvent = () => {
    setShowPersonalModal(true);
  };

  const toggleEventVisibility = (eventId: string) => {
    setCrewEvents(crewEvents.map(event => 
      event.id === eventId 
        ? { ...event, isVisible: !event.isVisible }
        : event
    ));
  };

  const togglePersonalEventVisibility = (eventId: string) => {
    setPersonalEvents(personalEvents.map(event => 
      event.id === eventId 
        ? { ...event, isVisible: !event.isVisible }
        : event
    ));
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
      case 'warehouse': return 'Turno Magazzino';
      case 'event': return 'Evento';
      case 'event_travel': return 'Evento Trasferta';
      default: return type;
    }
  };

  const getPersonalEventColor = (type: string) => {
    switch (type) {
      case 'personal': return 'bg-orange-500';
      case 'vacation': return 'bg-green-500';
      case 'unavailable': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPersonalEventLabel = (type: string) => {
    switch (type) {
      case 'personal': return 'Personale';
      case 'vacation': return 'Vacanza';
      case 'unavailable': return 'Non Disponibile';
      default: return type;
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

  const filteredCrewEvents = crewEvents.filter(event => {
    const eventDate = new Date(event.date + 'T12:00:00');
    const monthMatch = eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
    
    if (!monthMatch) return false;
    
    // Applica filtro eventi
    switch (eventFilter) {
      case 'assigned':
        return event.isAssigned;
      case 'warehouse':
        return event.type === 'warehouse';
      default:
        return true;
    }
  });

  const currentMonthEvents = crewEvents.filter(event => {
    const eventDate = new Date(event.date + 'T12:00:00');
    const monthMatch = eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
    
    if (!monthMatch) return false;
    
    // Applica filtro eventi per le statistiche
    switch (eventFilter) {
      case 'assigned':
        return event.isAssigned;
      case 'warehouse':
        return event.type === 'warehouse';
      default:
        return true;
    }
  });

  const confirmedEvents = currentMonthEvents.filter(e => e.status === 'confirmed').length;
  const pendingEvents = currentMonthEvents.filter(e => e.status === 'pending').length;
  
  const totalEarnings = userProfile?.parent_company_id ? 0 : currentMonthEvents
    .filter(e => e.status === 'confirmed' && e.rate)
    .reduce((sum, e) => {
      if (e.rateType === 'hourly' && e.startTime && e.endTime) {
        const start = new Date(`2000-01-01T${e.startTime}`);
        const end = new Date(`2000-01-01T${e.endTime}`);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return sum + (hours * (e.rate || 0));
      } else {
        return sum + (e.rate || 0);
      }
    }, 0);

  const assignedEvents = currentMonthEvents.filter(e => e.isAssigned).length;
  const totalEvents = currentMonthEvents.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Il Mio Calendario</h1>
          <p className="text-gray-600">
            {userProfile?.parent_company_id 
              ? '🏢 Calendario aziendale - Visualizzi tutti gli eventi della tua azienda'
              : '👤 I tuoi eventi come freelance'
            }
          </p>
        </div>
        <div className="flex space-x-3">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Mostra:</label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value as 'all' | 'assigned' | 'warehouse')}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">🗓️ Tutti gli Eventi</option>
              <option value="assigned">✅ Solo Assegnati a Me</option>
              <option value="warehouse">🏭 Solo Turni Magazzino</option>
            </select>
          </div>
          <button
            onClick={handleAddPersonalEvent}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Evento Personale</span>
          </button>
          <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Impostazioni</span>
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Eye className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">
              {userProfile?.parent_company_id ? 'Calendario Aziendale' : 'Controllo Visibilità Eventi'} 
              {eventFilter === 'assigned' && ' - Solo Eventi Assegnati'}
              {eventFilter === 'warehouse' && ' - Solo Turni Magazzino'}
            </h4>
            <p className="text-sm text-blue-800">
              {userProfile?.parent_company_id && (
                <>
                  <strong>Come dipendente</strong>, vedi tutti gli eventi della tua azienda. 
                  Gli eventi a cui sei assegnato sono evidenziati con ✅.
                  {eventFilter === 'assigned' && ' Stai visualizzando solo gli eventi a cui sei assegnato.'}
                  {eventFilter === 'warehouse' && ' Stai visualizzando solo i turni di magazzino.'}
                  Puoi aggiungere eventi personali che saranno visibili solo a te.
                </>
              )}
              {!userProfile?.parent_company_id && (
                <>
                  Puoi controllare quali eventi sono visibili alle aziende. Gli eventi nascosti non saranno visibili 
                  ad altre aziende quando cercano crew disponibili. I tuoi eventi personali possono essere resi 
                  visibili come "non disponibile" senza mostrare i dettagli.
                  {eventFilter === 'assigned' && ' Stai visualizzando solo gli eventi a cui sei assegnato.'}
                  {eventFilter === 'warehouse' && ' Stai visualizzando solo i turni di magazzino.'}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Eventi Confermati</p>
              <p className="text-2xl font-bold text-gray-900">{confirmedEvents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-yellow-500 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Attesa</p>
              <p className="text-2xl font-bold text-gray-900">{pendingEvents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-green-500 p-3 rounded-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Guadagno Stimato</p>
              <p className="text-2xl font-bold text-gray-900">€{totalEarnings.toFixed(0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-purple-500 p-3 rounded-lg">
              <Eye className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {userProfile?.parent_company_id ? 'Eventi Assegnati' : 'Eventi Visibili'}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {userProfile?.parent_company_id ? `${assignedEvents}/${totalEvents}` : `${assignedEvents}/${totalEvents}`}
              </p>
            </div>
          </div>
        </div>
      </div>

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
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const hasEvents = day.events.length > 0 || day.personalEvents.length > 0;
              
              let dayClasses = 'min-h-[120px] p-2 border border-gray-100 cursor-pointer transition-colors relative ';
              
              if (!day.isCurrentMonth) {
                dayClasses += 'bg-gray-50 text-gray-400 ';
              } else if (!day.isAvailable) {
                dayClasses += 'bg-red-50 hover:bg-red-100 ';
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
                    
                    <div className="flex items-center space-x-1">
                      {day.isAvailable ? (
                        <CheckCircle className="h-3 w-3 text-green-500" title="Disponibile" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-red-500" title="Occupato" />
                      )}
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    {day.events.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs px-2 py-1 rounded text-white truncate cursor-pointer hover:opacity-80 ${
                          event.isAssigned ? 'bg-green-500' : 'bg-yellow-500'
                        }`}
                        title={`${event.title} - ${event.companyName} - ${event.isAssigned ? 'Assegnato' : 'Non Assegnato'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const dateKey = formatDateKey(day.date);
                          setSelectedDate(dateKey);
                          setShowEventModal(true);
                        }}
                      >
                        <span className="truncate font-medium">
                          {event.title}
                        </span>
                      </div>
                    ))}

                    {day.personalEvents.slice(0, 1).map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs px-2 py-1 rounded text-white truncate ${getPersonalEventColor(event.type)}`}
                        title={`${event.title} (${getPersonalEventLabel(event.type)})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const dateKey = formatDateKey(day.date);
                          setSelectedDate(dateKey);
                          setShowEventModal(true);
                        }}
                      >
                        <span className="truncate font-medium">{event.title}</span>
                      </div>
                    ))}

                    {(day.events.length + day.personalEvents.length) > 4 && (
                      <div className="text-xs text-gray-500 px-2">
                        +{(day.events.length + day.personalEvents.length) - 4} altri
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showEventModal && selectedDate && (
        <EventDetailsModal
          date={selectedDate}
          crewEvents={getEventsForDate(new Date(selectedDate + 'T12:00:00'))}
          personalEvents={getPersonalEventsForDate(new Date(selectedDate + 'T12:00:00'))}
          onClose={() => setShowEventModal(false)}
          onToggleEventVisibility={toggleEventVisibility}
          onTogglePersonalEventVisibility={togglePersonalEventVisibility}
        />
      )}

      {showPersonalModal && (
        <PersonalEventModal
          onClose={() => setShowPersonalModal(false)}
          onSave={(event) => {
            setPersonalEvents([...personalEvents, { ...event, id: Date.now().toString() }]);
            setShowPersonalModal(false);
          }}
        />
      )}

      {/* Copyright */}
      <div className="text-center text-gray-500 text-xs py-4">
        <p>© 2025 ControlStage - Crew App Mobile V. 1.0.0</p>
        <p>Tutti i diritti riservati - Software realizzato da ControlStage</p>
      </div>
    </div>
  );
};

interface EventDetailsModalProps {
  date: string;
  crewEvents: CrewEvent[];
  personalEvents: PersonalEvent[];
  onClose: () => void;
  onToggleEventVisibility: (eventId: string) => void;
  onTogglePersonalEventVisibility: (eventId: string) => void;
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  date,
  crewEvents,
  personalEvents,
  onClose,
  onToggleEventVisibility,
  onTogglePersonalEventVisibility
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

  const getPersonalEventColor = (type: string) => {
    switch (type) {
      case 'personal': return 'bg-orange-100 text-orange-800';
      case 'vacation': return 'bg-green-100 text-green-800';
      case 'unavailable': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Eventi del {formatDate(date)}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            <>
            {crewEvents.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <span>Eventi Aziendali ({crewEvents.length})</span>
                </h4>
                <div className="space-y-3">
                  {crewEvents.map((event) => (
                    <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h5 className="font-medium text-gray-900">{event.title}</h5>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEventTypeColor(event.type)}`}>
                              {event.type === 'warehouse' ? 'Magazzino' : 
                               event.type === 'event' ? 'Evento' : 'Evento Trasferta'}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              event.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                              event.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {event.status === 'confirmed' ? 'Confermato' :
                               event.status === 'pending' ? 'In Attesa' : 'Completato'}
                            </span>
                            {event.isAssigned && (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                ✅ Sei assegnato
                              </span>
                            )}
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <Building2 className="h-4 w-4" />
                              <span>{event.companyName}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-4 w-4" />
                              <span>{event.location}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {new Date(event.date).toLocaleDateString('it-IT')} 
                                {event.endDate && event.endDate !== event.date && (
                                  <> - {new Date(event.endDate).toLocaleDateString('it-IT')}</>
                                )}
                              </span>
                            </div>
                            {event.startTime && event.endTime && (
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4" />
                                <span>{event.startTime} - {event.endTime}</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                            <span>
                              {event.isAssigned ? (
                                <>✅ <strong>Sei assegnato a questo evento</strong></>
                              ) : (
                                <>📋 <strong>Non sei assegnato a questo evento</strong></>
                              )}
                            </span>
                          </div>
                          
                          {event.assignedCrewNames && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                              <strong>Team assegnato:</strong> {event.assignedCrewNames}
                            </div>
                          )}
                          
                          {event.notes && (
                            <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-700">
                              <strong>Note:</strong> {event.notes}
                            </div>
                          )}
                        </div>

                        <div className="ml-4">
                          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                            <Building2 className="h-4 w-4" title="Evento aziendale" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {personalEvents.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <Users className="h-5 w-5 text-orange-600" />
                  <span>Eventi Personali ({personalEvents.length})</span>
                </h4>
                <div className="space-y-3">
                  {personalEvents.map((event) => (
                    <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h5 className="font-medium text-gray-900">{event.title}</h5>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPersonalEventColor(event.type)}`}>
                              {event.type === 'personal' ? 'Personale' :
                               event.type === 'vacation' ? 'Vacanza' : 'Non Disponibile'}
                            </span>
                          </div>

                          {event.notes && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                              {event.notes}
                            </div>
                          )}

                          <div className="mt-2 text-xs text-gray-500">
                            {event.isVisible 
                              ? 'Le aziende vedranno che sei "non disponibile" senza dettagli'
                              : 'Completamente privato - non visibile alle aziende'
                            }
                          </div>
                        </div>

                        <div className="ml-4">
                          <button
                            onClick={() => onTogglePersonalEventVisibility(event.id)}
                            className={`p-2 rounded-lg ${
                              event.isVisible 
                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                            title={event.isVisible ? 'Visibile come "occupato"' : 'Completamente privato'}
                          >
                            {event.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </>

            {crewEvents.length === 0 && personalEvents.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Nessun evento in questa data</p>
                <p className="text-sm mt-1">Sei disponibile per nuovi lavori</p>
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

interface PersonalEventModalProps {
  onClose: () => void;
  onSave: (event: Omit<PersonalEvent, 'id'>) => void;
}

const PersonalEventModal: React.FC<PersonalEventModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    type: 'personal' as 'personal' | 'vacation' | 'unavailable',
    isVisible: false,
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Aggiungi Evento Personale</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Titolo</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="es. Appuntamento medico"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Data</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Tipo</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="personal">Personale</option>
                <option value="vacation">Vacanza</option>
                <option value="unavailable">Non Disponibile</option>
              </select>
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isVisible}
                  onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  Mostra alle aziende come "non disponibile"
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Se attivo, le aziende vedranno che sei occupato senza vedere i dettagli
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Note</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
                placeholder="Note aggiuntive (opzionale)"
              />
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                Salva Evento
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CrewCalendar;