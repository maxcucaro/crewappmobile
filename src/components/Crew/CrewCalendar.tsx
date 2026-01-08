import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Eye, EyeOff, Plus, Settings, MapPin, Clock, Building2, Users, AlertTriangle, CheckCircle, X } from 'lucide-react';
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

const MobileCalendar: React.FC = () => {
  const { user } = useAuth();
  const { getCrewBusyDates, syncCrewCalendar } = usePrivacy();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [eventFilter, setEventFilter] = useState<'all' | 'assigned' | 'warehouse'>('all');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [crewEvents, setCrewEvents] = useState<CrewEvent[]>([]);
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadUserProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Carica profilo: registration_requests oppure crew_members
  // IMPORTANT: userData.id (registration_requests.id) o crewData.id/crew_id sono i personId da usare nelle query alle tabelle di assegnazione
  const loadUserProfile = async () => {
    try {
      console.log('📅 Caricamento eventi e turni magazzino per user auth id:', user?.id);

      const { data: userData, error: userError } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle();

      if (userError) {
        console.warn('registration_requests query errore:', userError);
        await loadFreelanceProfile();
        return;
      }

      if (!userData) {
        console.log('registration_requests: utente non trovato, provo crew_members');
        await loadFreelanceProfile();
        return;
      }

      console.log('✅ Profilo caricato (registration_requests):', userData.full_name || userData);
      setUserProfile(userData);

      const personId = userData.id; // registration_requests.id

      if (userData.parent_company_id) {
        await loadCompanyEvents(userData.parent_company_id);
        await loadCrewAssignments(personId, userData.parent_company_id);
      } else {
        await loadFreelanceEvents();
        await loadCrewAssignments(personId);
      }
    } catch (error) {
      console.error('Errore loadUserProfile:', error);
    }
  };

  const loadFreelanceProfile = async () => {
    try {
      const { data: crewData, error: crewError } = await supabase
        .from('crew_members')
        .select('*')
        .eq('auth_user_id', user?.id)
        .maybeSingle();

      if (crewError) {
        console.error('Errore caricamento crew_members:', crewError);
        return;
      }

      if (!crewData) {
        console.log('crew_members: nessun profilo trovato');
        return;
      }

      console.log('✅ Profilo caricato (crew_members):', crewData.first_name || crewData);
      setUserProfile({ ...crewData, parent_company_id: crewData.company_id });

      const personId = crewData.id || crewData.crew_id || crewData.auth_user_id || user?.id;

      if (crewData.company_id) {
        await loadCompanyEvents(crewData.company_id);
      } else {
        await loadFreelanceEvents();
      }

      await loadCrewAssignments(personId, crewData.company_id);
    } catch (error) {
      console.error('Errore loadFreelanceProfile:', error);
    }
  };

  const loadCompanyEvents = async (companyId: string) => {
    try {
      console.log('📅 Caricamento eventi aziendali per companyId:', companyId);

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
        console.error('Errore loadCompanyEvents:', eventsError);
        setCrewEvents([]);
        return;
      }

      const mapped: CrewEvent[] = (eventsData || []).map((ev: any) => {
        const crewAssignments = (ev.event_crew_assignments || []).map((a: any) => ({
          ...a,
          isCurrentUser: a.crew_id === (userProfile?.id || user?.id) || a.auth_user_id === user?.id
        }));
        const isAssigned = crewAssignments.some((a: any) => a.isCurrentUser);
        return {
          id: ev.id,
          title: ev.title,
          companyId: ev.company_id,
          companyName: ev.regaziendasoftware?.ragione_sociale || 'Azienda',
          date: ev.start_date,
          endDate: ev.end_date,
          startTime: ev.start_time || '09:00',
          endTime: ev.end_time || '17:00',
          location: ev.location || 'Sede',
          type: ev.type || 'event',
          status: ev.status === 'published' || ev.status === 'confirmed' ? 'confirmed' : 'pending',
          rate: undefined,
          rateType: 'hourly',
          isVisible: true,
          paymentStatus: 'pending',
          isCompanyEvent: true,
          isAssigned: isAssigned,
          assignedCrewNames: crewAssignments.map((c: any) => c.crew_name).filter(Boolean).join(', '),
          assignedCrewCount: crewAssignments.length,
          notes: isAssigned ? '✅ Sei assegnato a questo evento' : undefined
        } as CrewEvent;
      });

      setCrewEvents(mapped);
      console.log('✅ Eventi aziendali caricati:', mapped.length);
    } catch (error) {
      console.error('Errore loadCompanyEvents:', error);
      setCrewEvents([]);
    }
  };

  const loadFreelanceEvents = async () => {
    try {
      console.log('👤 Caricamento eventi da event_crew_assignments per auth uid:', user?.id);

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('event_crew_assignments')
        .select(`
          *,
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
        console.error('Errore loadFreelanceEvents:', assignmentsError);
        setCrewEvents([]);
        return;
      }

      const mapped: CrewEvent[] = (assignmentsData || []).map((a: any) => {
        const ev = a.events;
        return {
          id: ev.id,
          title: ev.title,
          companyId: ev.company_id,
          companyName: ev.regaziendasoftware?.ragione_sociale || 'Azienda',
          date: ev.start_date,
          endDate: ev.end_date,
          startTime: ev.start_time || '09:00',
          endTime: ev.end_time || '17:00',
          location: ev.location || 'Da definire',
          type: ev.type || 'event',
          status: ev.status === 'published' || ev.status === 'confirmed' ? 'confirmed' : 'pending',
          rate: a.final_hourly_rate || a.final_daily_rate,
          rateType: a.final_hourly_rate ? 'hourly' : 'daily',
          isVisible: true,
          paymentStatus: a.payment_status || 'pending',
          isCompanyEvent: false,
          isAssigned: true,
          notes: 'Evento assegnato'
        } as CrewEvent;
      });

      setCrewEvents(mapped);
      console.log('✅ Eventi freelance (event_crew_assignments) caricati:', mapped.length);
    } catch (error) {
      console.error('Errore loadFreelanceEvents:', error);
      setCrewEvents([]);
    }
  };

  /**
   * loadCrewAssignments:
   * - legge crew_event_assegnazione e crew_assegnazione_turni
   * - usa .or(...) per cercare sia dipendente_freelance_id sia dipendente_id
   * - SELECT '*' senza join problematici
   */
  const loadCrewAssignments = async (personId?: string | null, companyId?: string | null) => {
    if (!personId) {
      console.warn('loadCrewAssignments: personId mancante', { userAuthId: user?.id, userProfile });
      return;
    }

    try {
      console.log('📥 Carico assegnazioni per personId:', personId);

      // 1) crew_event_assegnazione (nessun join con crew_events che chieda benefits_config)
      const { data: eventAssignments, error: eventAssignError } = await supabase
        .from('crew_event_assegnazione')
        .select('*')
        .or(`dipendente_freelance_id.eq.${personId},dipendente_id.eq.${personId}`)
        .order('giorno_inizio_evento', { ascending: true });

      if (eventAssignError) {
        console.error('Errore crew_event_assegnazione:', eventAssignError);
      } else {
        console.log('✅ crew_event_assegnazione righe trovate:', eventAssignments?.length || 0);
        if (eventAssignments && eventAssignments.length > 0) console.log('Esempio crew_event_assegnazione[0]:', eventAssignments[0]);
      }

      // 2) crew_assegnazione_turni (turni magazzino)
      const { data: warehouseAssignments, error: warehouseError } = await supabase
        .from('crew_assegnazione_turni')
        .select('*')
        .eq('dipendente_id', personId)
        .order('data_turno', { ascending: true });

      if (warehouseError) {
        console.error('Errore crew_assegnazione_turni:', warehouseError);
      } else {
        console.log('✅ crew_assegnazione_turni righe trovate:', warehouseAssignments?.length || 0);
        if (warehouseAssignments && warehouseAssignments.length > 0) console.log('Esempio crew_assegnazione_turni[0]:', warehouseAssignments[0]);
      }

      // map event assignments -> CrewEvent
      const mappedFromEventAssign: CrewEvent[] = (eventAssignments || []).map((a: any) => {
        const startDate = a.data_inizio_assegnazione || a.giorno_inizio_evento;
        const endDate = a.data_fine_assegnazione || a.giorno_fine_evento || startDate;
        const startTime = a.evento_orario_convocazione ? String(a.evento_orario_convocazione).slice(0,5) : undefined;
        const type: 'event' | 'event_travel' = a.evento_trasferta ? 'event_travel' : 'event';

        return {
          id: `asseg-event-${a.id}`,
          title: a.nome_evento || a.nome_azienda || 'Evento Assegnato',
          companyId: a.azienda_id || companyId || '',
          companyName: a.nome_azienda || 'Azienda',
          date: typeof startDate === 'string' ? startDate : new Date(startDate).toISOString().slice(0,10),
          endDate: typeof endDate === 'string' ? endDate : new Date(endDate).toISOString().slice(0,10),
          startTime,
          endTime: undefined,
          location: a.evento_indirizzo || a.evento_localita || 'Luogo evento',
          type,
          status: 'confirmed',
          rate: a.tariffa_evento_assegnata ? Number(a.tariffa_evento_assegnata) : undefined,
          rateType: a.tariffa_evento_assegnata ? 'daily' : 'hourly',
          isVisible: true,
          paymentStatus: 'pending',
          isCompanyEvent: true,
          isAssigned: true,
          assignedCrewNames: a.nome_dipendente_freelance || undefined,
          assignedCrewCount: undefined,
          notes: a.note_assegnazione || a.evento_descrizione || undefined
        } as CrewEvent;
      });

      // map warehouse shifts -> CrewEvent
      const mappedWarehouse: CrewEvent[] = (warehouseAssignments || []).map((w: any) => {
        const start = w.ora_inizio_turno ? String(w.ora_inizio_turno).slice(0,5) : undefined;
        const end = w.ora_fine_turno ? String(w.ora_fine_turno).slice(0,5) : undefined;
        const dateStr = w.data_turno ? (typeof w.data_turno === 'string' ? w.data_turno : new Date(w.data_turno).toISOString().slice(0,10)) : (new Date().toISOString().slice(0,10));

        return {
          id: `turno-${w.id}`,
          title: w.nome_turno || w.nome_magazzino || 'Turno Magazzino',
          companyId: w.azienda_id || companyId || '',
          companyName: w.nome_azienda || 'Azienda',
          date: dateStr,
          endDate: undefined,
          startTime: start,
          endTime: end,
          location: w.indirizzo_magazzino || w.nome_magazzino || 'Magazzino',
          type: 'warehouse',
          status: 'confirmed',
          rate: undefined,
          rateType: 'daily',
          isVisible: true,
          paymentStatus: 'pending',
          isCompanyEvent: false,
          isAssigned: true,
          assignedCrewNames: w.dipendente_nome,
          assignedCrewCount: undefined,
          notes: undefined
        } as CrewEvent;
      });

      // Unione: manteniamo eventi già caricati e aggiungiamo assegnazioni e turni (senza duplicati per id)
      setCrewEvents(prev => {
        const map = new Map<string, CrewEvent>();
        prev.forEach(p => { if (p?.id) map.set(p.id, p); });
        mappedFromEventAssign.forEach(m => { if (m?.id) map.set(m.id, m); });
        mappedWarehouse.forEach(m => { if (m?.id) map.set(m.id, m); });
        const result = Array.from(map.values());
        console.log('📊 CALENDARIO CARICATO (unione):', {
          totale: result.length,
          eventiAssegnati: mappedFromEventAssign.length,
          turniMagazzino: mappedWarehouse.length
        });
        return result;
      });

    } catch (error) {
      console.error('Errore in loadCrewAssignments:', error);
    }
  };

  const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getEventsForDate = (targetDate: Date): CrewEvent[] => {
    const key = formatDateKey(targetDate);
    const filtered = crewEvents.filter(event => {
      const start = event.date;
      const end = event.endDate || event.date;
      return start && end && key >= start && key <= end;
    });

    switch (eventFilter) {
      case 'assigned':
        return filtered.filter(e => e.isAssigned);
      case 'warehouse':
        return filtered.filter(e => e.type === 'warehouse');
      default:
        return filtered;
    }
  };

  const getPersonalEventsForDate = (targetDate: Date): PersonalEvent[] => {
    const key = formatDateKey(targetDate);
    return personalEvents.filter(e => e.date === key);
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

    for (let d = 1; d <= daysInMonth; d++) {
      const current = new Date(year, month, d);
      const evs = getEventsForDate(current);
      const pers = getPersonalEventsForDate(current);
      days.push({
        date: current,
        isCurrentMonth: true,
        isToday: formatDateKey(current) === formatDateKey(new Date()),
        events: evs,
        personalEvents: pers,
        isAvailable: evs.length === 0 && pers.length === 0
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
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

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleDateClick = (date: Date) => {
    const evs = getEventsForDate(date);
    const pers = getPersonalEventsForDate(date);
    if (evs.length > 0 || pers.length > 0) {
      setSelectedDate(formatDateKey(date));
      setShowEventModal(true);
    } else {
      console.log('Nessun evento in questa data');
    }
  };

  const toggleEventVisibility = (eventId: string) => {
    setCrewEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, isVisible: !ev.isVisible } : ev));
  };

  const togglePersonalEventVisibility = (eventId: string) => {
    setPersonalEvents(prev => prev.map(pe => pe.id === eventId ? { ...pe, isVisible: !pe.isVisible } : pe));
  };

  const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const dayNames = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  const days = getDaysInMonth(currentDate);
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const currentMonthEvents = crewEvents.filter(event => {
    const ed = new Date(event.date + 'T12:00:00');
    return ed.getMonth() === currentMonth && ed.getFullYear() === currentYear
      && (eventFilter === 'all' || (eventFilter === 'assigned' ? event.isAssigned : event.type === 'warehouse'));
  });

  const confirmedEvents = currentMonthEvents.filter(e => e.status === 'confirmed').length;
  const pendingEvents = currentMonthEvents.filter(e => e.status === 'pending').length;
  const assignedEvents = currentMonthEvents.filter(e => e.isAssigned).length;
  const totalEvents = currentMonthEvents.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Il Mio Calendario</h1>
          <p className="text-gray-600">{userProfile?.parent_company_id ? '🏢 Calendario aziendale' : '👤 I tuoi eventi'}</p>
        </div>

        <div className="flex space-x-3">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Mostra:</label>
            <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value as any)} className="border px-3 py-2 rounded">
              <option value="all">Tutti gli Eventi</option>
              <option value="assigned">Solo Assegnati a Me</option>
              <option value="warehouse">Solo Turni Magazzino</option>
            </select>
          </div>

          <button onClick={() => setShowPersonalModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded">Aggiungi Personale</button>
          <button className="bg-gray-600 text-white px-4 py-2 rounded">Impostazioni</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-white rounded shadow">
          <p className="text-sm">Eventi Confermati</p>
          <p className="text-2xl font-bold">{confirmedEvents}</p>
        </div>
        <div className="p-6 bg-white rounded shadow">
          <p className="text-sm">In Attesa</p>
          <p className="text-2xl font-bold">{pendingEvents}</p>
        </div>
        <div className="p-6 bg-white rounded shadow">
          <p className="text-sm">Eventi Assegnati</p>
          <p className="text-2xl font-bold">{assignedEvents}</p>
        </div>
        <div className="p-6 bg-white rounded shadow">
          <p className="text-sm">Totale</p>
          <p className="text-2xl font-bold">{totalEvents}</p>
        </div>
      </div>

      <div className="bg-white rounded shadow">
        <div className="flex items-center justify-between p-6 border-b">
          <button onClick={handlePrevMonth}><ChevronLeft /></button>
          <h2 className="text-xl">{monthNames[currentMonth]} {currentYear}</h2>
          <button onClick={handleNextMonth}><ChevronRight /></button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(d => <div key={d} className="text-center text-sm font-medium">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const hasEvents = day.events.length > 0 || day.personalEvents.length > 0;
              let classes = 'min-h-[120px] p-2 border cursor-pointer relative ';
              if (!day.isCurrentMonth) classes += 'bg-gray-50 text-gray-400 ';
              else if (!day.isAvailable) classes += 'bg-red-50 ';
              else classes += 'hover:bg-gray-50 ';
              if (day.isToday) classes += 'ring-2 ring-blue-500 ';
              return (
                <div key={idx} className={classes} onClick={() => handleDateClick(day.date)}>
                  <div className="flex justify-between items-start">
                    <span className={`text-sm font-medium ${day.isToday ? 'text-blue-600' : ''}`}>{day.date.getDate()}</span>
                    <div>{day.isAvailable ? <CheckCircle className="h-3 w-3 text-green-500" /> : <AlertTriangle className="h-3 w-3 text-red-500" />}</div>
                  </div>

                  <div className="mt-2 space-y-1">
                    {day.events.slice(0,3).map(ev => (
                      <div key={ev.id} className={`text-xs px-2 py-1 rounded text-white truncate ${ev.isAssigned ? 'bg-green-500' : 'bg-yellow-500'}`} title={`${ev.title} - ${ev.companyName}`}>
                        <span className="font-medium truncate">{ev.title}</span>
                      </div>
                    ))}

                    {day.personalEvents.slice(0,1).map(pe => (
                      <div key={pe.id} className={`text-xs px-2 py-1 rounded text-white truncate bg-orange-500`} title={pe.title}>
                        <span className="font-medium truncate">{pe.title}</span>
                      </div>
                    ))}

                    {(day.events.length + day.personalEvents.length) > 4 && (
                      <div className="text-xs text-gray-500">+{(day.events.length + day.personalEvents.length) - 4} altri</div>
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
          onSave={(ev) => {
            setPersonalEvents(prev => [...prev, { ...ev, id: Date.now().toString() }]);
            setShowPersonalModal(false);
          }}
        />
      )}

      <div className="text-center text-xs text-gray-500 py-4">
        <p>© 2025 ControlStage - Crew App Mobile</p>
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

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ date, crewEvents, personalEvents, onClose, onToggleEventVisibility, onTogglePersonalEventVisibility }) => {
  const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 overflow-y-auto">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Eventi del {formatDate(date)}</h3>
          <button onClick={onClose}><X /></button>
        </div>

        <div className="space-y-6">
          {crewEvents.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2"><Building2 className="h-5 w-5 text-blue-600" /> <span>Eventi/Turni ({crewEvents.length})</span></h4>
              <div className="space-y-3">
                {crewEvents.map(ev => (
                  <div key={ev.id} className="border rounded p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h5 className="font-medium">{ev.title}</h5>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${ev.type === 'warehouse' ? 'bg-gray-100 text-gray-800' : ev.type === 'event' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{ev.type === 'warehouse' ? 'Magazzino' : ev.type === 'event' ? 'Evento' : 'Evento Trasferta'}</span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${ev.status === 'confirmed' ? 'bg-green-100 text-green-800' : ev.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{ev.status === 'confirmed' ? 'Confermato' : ev.status === 'pending' ? 'In Attesa' : 'Completato'}</span>
                          {ev.isAssigned && <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">✅ Sei assegnato</span>}
                        </div>

                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center space-x-2"><Building2 className="h-4 w-4" /><span>{ev.companyName}</span></div>
                          <div className="flex items-center space-x-2"><MapPin className="h-4 w-4" /><span>{ev.location}</span></div>
                          <div className="flex items-center space-x-2"><Calendar className="h-4 w-4" /><span>{new Date(ev.date).toLocaleDateString('it-IT')}{ev.endDate && ev.endDate !== ev.date ? ` - ${new Date(ev.endDate).toLocaleDateString('it-IT')}` : ''}</span></div>
                          {ev.startTime && ev.endTime && (<div className="flex items-center space-x-2"><Clock className="h-4 w-4" /><span>{ev.startTime} - {ev.endTime}</span></div>)}
                        </div>

                        {ev.assignedCrewNames && <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700"><strong>Team:</strong> {ev.assignedCrewNames}</div>}
                        {ev.notes && <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-700"><strong>Note:</strong> {ev.notes}</div>}
                      </div>

                      <div className="ml-4">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-700"><Building2 className="h-4 w-4" /></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {personalEvents.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2"><Users className="h-5 w-5 text-orange-600" /><span>Eventi Personali ({personalEvents.length})</span></h4>
              <div className="space-y-3">
                {personalEvents.map(pe => (
                  <div key={pe.id} className="border rounded p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2"><h5 className="font-medium">{pe.title}</h5><span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">{pe.type === 'personal' ? 'Personale' : pe.type === 'vacation' ? 'Vacanza' : 'Non Disponibile'}</span></div>
                        {pe.notes && <div className="mt-2 p-2 bg-gray-50 rounded text-sm">{pe.notes}</div>}
                      </div>
                      <div className="ml-4">
                        <button onClick={() => onTogglePersonalEventVisibility(pe.id)} className={`p-2 rounded ${pe.isVisible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{pe.isVisible ? <Eye /> : <EyeOff />}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {crewEvents.length === 0 && personalEvents.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Nessun evento in questa data</p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">Chiudi</button>
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
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 overflow-y-auto">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Aggiungi Evento Personale</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Titolo</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium">Data</label>
              <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium">Tipo</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })} className="mt-1 block w-full border rounded px-3 py-2">
                <option value="personal">Personale</option>
                <option value="vacation">Vacanza</option>
                <option value="unavailable">Non Disponibile</option>
              </select>
            </div>
            <div>
              <label className="flex items-center space-x-2"><input type="checkbox" checked={formData.isVisible} onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })} /> <span>Mostra come "non disponibile"</span></label>
            </div>
            <div>
              <label className="block text-sm font-medium">Note</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2" rows={3} />
            </div>

            <div className="flex justify-end space-x-2">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">Annulla</button>
              <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded">Salva</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MobileCalendar;