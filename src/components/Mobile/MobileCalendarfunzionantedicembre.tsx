import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Building2,
  CheckCircle,
  AlertTriangle,
  X,
  Grid,
  List
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CopyrightFooter } from '../UI/CopyrightFooter';
import { supabase } from '../../lib/db';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: 'warehouse' | 'event' | 'event_travel';
  date: string; // start date YYYY-MM-DD
  endDate?: string;
  startTime: string;
  endTime: string;
  location: string;
  address?: string;
  callTime?: string;
  companyName: string;
  isAssigned: boolean;
  status: string;
  assignedCrewNames?: string;
  isTravel?: boolean;
  assignedRate?: number;
  bonusTravel?: boolean;
  bonusDiaria?: boolean;
  benefitsEventoIds?: string[];
  benefitsEventoNomi?: string[];
  benefitsDisponibili?: any;
  raw?: any;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  isAvailable: boolean;
}

type ViewType = 'month' | 'week' | 'day';

const MobileCalendar: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [view, setView] = useState<ViewType>('month'); // month/week/day

  // New states: keep the raw assignment rows that belong to the user
  const [userEventAssignments, setUserEventAssignments] = useState<any[]>([]);
  const [userWarehouseShifts, setUserWarehouseShifts] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) loadUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // -------------------------
  // Profile + events loading
  // -------------------------
  const loadUserProfile = async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('registration_requests')
        .select(`
          *,
          regaziendasoftware!parent_company_id(ragione_sociale)
        `)
        .eq('auth_user_id', user?.id)
        .single();

      if (userError) {
        console.error('Errore caricamento profilo:', userError);
        setLoading(false);
        return;
      }

      setUserProfile(userData);
      const personId = userData?.id;
      if (userData?.parent_company_id) {
        await loadCompanyEvents(userData.parent_company_id, personId);
      } else {
        await loadCompanyEvents(undefined, personId);
      }
    } catch (err) {
      console.error('Errore loadUserProfile:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyEvents = async (companyId?: string, personId?: string | null) => {
    try {
      console.log('📅 Caricamento eventi e turni magazzino per:', personId || user?.id);

      const formatTime = (timeString: string | null | undefined): string => {
        if (!timeString) return '09:00';
        if (/^\d{2}:\d{2}$/.test(timeString)) return timeString;
        if (/^\d{2}:\d{2}:\d{2}$/.test(timeString)) return timeString.substring(0,5);
        return '09:00';
      };

      // crew_event_assegnazione (event assignments for this user)
      let eventAssignments: any[] | null = null;
      try {
        if (personId) {
          const { data, error } = await supabase
            .from('crew_event_assegnazione')
            .select('*')
            .eq('dipendente_freelance_id', personId)
            .order('giorno_inizio_evento', { ascending: true });
          if (error) console.error('Errore crew_event_assegnazione (personId):', error);
          else eventAssignments = data;
        } else {
          const { data, error } = await supabase
            .from('crew_event_assegnazione')
            .select('*')
            .eq('dipendente_freelance_id', user?.id)
            .order('giorno_inizio_evento', { ascending: true });
          if (error) console.error('Errore crew_event_assegnazione (fallback):', error);
          else eventAssignments = data;
        }
        console.log('✅ Eventi assegnati caricati (crew_event_assegnazione):', eventAssignments?.length || 0);
        if (eventAssignments && eventAssignments.length > 0) console.log('Esempio eventAssignments[0]:', eventAssignments[0]);
      } catch (err) {
        console.error('Eccezione crew_event_assegnazione:', err);
      }

      // crew_assegnazione_turni (warehouse shifts for this user)
      let warehouseShifts: any[] | null = null;
      try {
        const { data: ws, error: warehouseError } = await supabase
          .from('crew_assegnazione_turni')
          .select('*')
          .eq('dipendente_id', personId || user?.id)
          .order('data_turno', { ascending: true });
        if (warehouseError) console.error('Errore crew_assegnazione_turni:', warehouseError);
        else {
          warehouseShifts = ws;
          console.log('✅ Turni magazzino trovati:', warehouseShifts?.length || 0);
          if (warehouseShifts && warehouseShifts.length > 0) console.log('Esempio warehouseShifts[0]:', warehouseShifts[0]);
        }
      } catch (err) {
        console.error('Eccezione crew_assegnazione_turni:', err);
      }

      // store raw per-user assignment rows in dedicated states
      setUserEventAssignments(eventAssignments || []);
      setUserWarehouseShifts(warehouseShifts || []);

      // map to unified events (used for month/week/day view UI)
      const mappedEvents: CalendarEvent[] = [];

      if (eventAssignments && eventAssignments.length > 0) {
        eventAssignments.forEach((assignment) => {
          const startDate = assignment.data_inizio_assegnazione || assignment.giorno_inizio_evento;
          const endDate = assignment.data_fine_assegnazione || assignment.giorno_fine_evento || startDate;
          const callTime = assignment.evento_orario_convocazione || undefined;
          const lowerNome = (assignment.nome_evento || '').toString().toLowerCase();
          let eventType: 'warehouse' | 'event' | 'event_travel' = 'event';
          if (lowerNome.includes('magazzino') || lowerNome.includes('turno')) eventType = 'warehouse';
          else if (assignment.evento_trasferta) eventType = 'event_travel';

          mappedEvents.push({
            id: assignment.id || assignment.evento_id || String(Math.random()),
            title: assignment.nome_evento || assignment.nome_azienda || 'Evento Assegnato',
            description: assignment.evento_descrizione || undefined,
            type: eventType,
            date: typeof startDate === 'string' ? startDate : new Date(startDate).toISOString().slice(0,10),
            endDate: typeof endDate === 'string' ? endDate : new Date(endDate).toISOString().slice(0,10),
            startTime: '09:00',
            endTime: '17:00',
            location: assignment.evento_localita || assignment.nome_azienda || 'Località non specificata',
            address: assignment.evento_indirizzo || undefined,
            callTime,
            companyName: assignment.nome_azienda || (companyId ? '' : ''),
            isAssigned: true,
            status: 'assigned',
            assignedCrewNames: assignment.nome_dipendente_freelance || undefined,
            isTravel: !!assignment.evento_trasferta,
            assignedRate: assignment.tariffa_evento_assegnata ? Number(assignment.tariffa_evento_assegnata) : undefined,
            bonusTravel: !!assignment.bonus_trasferta,
            bonusDiaria: !!assignment.bonus_diaria,
            benefitsEventoIds: assignment.benefits_evento_ids || [],
            benefitsEventoNomi: assignment.benefits_evento_nomi || [],
            benefitsDisponibili: assignment.benefits_disponibili || {},
            raw: assignment
          });
        });
      }

      if (warehouseShifts && warehouseShifts.length > 0) {
        warehouseShifts.forEach((shift) => {
          const dateStr = shift.data_turno ? (typeof shift.data_turno === 'string' ? shift.data_turno : new Date(shift.data_turno).toISOString().slice(0,10)) : formatDateKey(new Date());
          mappedEvents.push({
            id: shift.id,
            title: shift.nome_turno || 'Turno Magazzino',
            description: `Turno di magazzino presso ${shift.nome_magazzino || 'Magazzino'}`,
            type: 'warehouse',
            date: dateStr,
            endDate: dateStr,
            startTime: shift.ora_inizio_turno ? shift.ora_inizio_turno.substring(0,5) : '09:00',
            endTime: shift.ora_fine_turno ? shift.ora_fine_turno.substring(0,5) : '17:00',
            location: shift.nome_magazzino || 'Magazzino',
            address: shift.indirizzo_magazzino || undefined,
            callTime: shift.ora_inizio_turno ? shift.ora_inizio_turno.substring(0,5) : undefined,
            companyName: shift.nome_azienda || userProfile?.regaziendasoftware?.ragione_sociale || 'La Mia Azienda',
            isAssigned: true,
            status: 'assigned',
            assignedCrewNames: shift.dipendente_nome || undefined,
            isTravel: false,
            assignedRate: undefined,
            bonusTravel: false,
            bonusDiaria: false,
            raw: shift
          });
        });
      }

      setEvents(mappedEvents);

      console.log('📊 CALENDARIO COMPLETO CARICATO:', {
        eventiTotali: mappedEvents.length,
        eventi: eventAssignments?.length || 0,
        turniMagazzino: warehouseShifts?.length || 0,
        eventiTrasferta: mappedEvents.filter(e => e.isTravel).length
      });
    } catch (error) {
      console.error('Errore nel caricamento eventi:', error);
      setEvents([]);
      setUserEventAssignments([]);
      setUserWarehouseShifts([]);
    }
  };

  // -------------------------
  // RPC colleagues lookup
  // -------------------------
  const loadColleaguesForEvent = async (evt: CalendarEvent) => {
    try {
      console.log('🔎 loadColleaguesForEvent (RPC): evt.id=', evt.id, 'raw=', evt.raw);
      if (evt.type === 'warehouse' && evt.raw) {
        const turnoId = evt.raw.turno_id || evt.raw.turno || evt.raw.turnoId;
        const date = evt.date;
        if (turnoId) {
          const { data, error } = await supabase.rpc('get_shift_colleagues', { p_turno: turnoId, p_data: date });
          if (error) { console.warn('RPC get_shift_colleagues error', error); }
          else if (data && data.length > 0) { return (data || []).map((r: any) => ({ id: r.dipendente_id, name: r.dipendente_nome })); }
        }
      }

      const eventoId = evt.raw?.evento_id || evt.raw?.event_id || evt.id;
      const companyId = evt.raw?.azienda_id || null;
      if (eventoId) {
        const { data, error } = await supabase.rpc('get_event_colleagues', { p_evento: eventoId, p_company: companyId });
        if (error) { console.warn('RPC get_event_colleagues error', error); }
        else if (data && data.length > 0) { return (data || []).map((r: any) => ({ id: r.dipendente_id, name: r.dipendente_nome })); }
      }

      // fallback (may be limited by RLS)
      if (eventoId) {
        try {
          const { data, error } = await supabase
            .from('crew_event_assegnazione')
            .select('dipendente_freelance_id, nome_dipendente_freelance')
            .eq('evento_id', eventoId);
          if (!error && data && data.length > 0) return (data || []).map((r: any) => ({ id: r.dipendente_freelance_id, name: r.nome_dipendente_freelance }));
        } catch (e) {
          console.warn('fallback crew_event_assegnazione exception', e);
        }
      }

      return [];
    } catch (err) {
      console.error('Eccezione loadColleaguesForEvent:', err);
      return [];
    }
  };

  // -------------------------
  // Utility: date helpers
  // -------------------------
  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startOfWeek = (d: Date, weekStartsOn: number = 1) => {
    const date = new Date(d);
    const day = (date.getDay() + 7) % 7;
    const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
    date.setDate(date.getDate() - diff);
    date.setHours(0,0,0,0);
    return date;
  };

  const addDays = (d: Date, days: number) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + days);
    return nd;
  };

  const getWeekDays = (ref: Date) => {
    const start = startOfWeek(ref, 1); // Monday
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  };

  const eventsInRange = (start: string, end: string) => {
    return events.filter(ev => {
      const s = ev.date;
      const e = ev.endDate || ev.date;
      return s <= end && e >= start;
    });
  };

  // -------------------------
  // Views navigation
  // -------------------------
  const handlePrev = () => {
    if (view === 'month') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    else if (view === 'week') setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const handleNext = () => {
    if (view === 'month') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    else if (view === 'week') setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  // -------------------------
  // Month view functions
  // -------------------------
  const getDaysInMonth = (date: Date): CalendarDay[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const days: CalendarDay[] = [];
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday=0
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevDate = new Date(year, month, 1 - (firstDayOfWeek - i));
      days.push({ date: prevDate, isCurrentMonth: false, isToday: false, events: getEventsForDate(prevDate), isAvailable: true });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = new Date(year, month, day);
      const dayEvents = getEventsForDate(currentDay);
      days.push({ date: currentDay, isCurrentMonth: true, isToday: formatDateKey(currentDay) === formatDateKey(new Date()), events: dayEvents, isAvailable: dayEvents.length === 0 });
    }
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({ date: nextDate, isCurrentMonth: false, isToday: false, events: getEventsForDate(nextDate), isAvailable: true });
    }
    return days;
  };

  const getEventsForDate = (targetDate: Date): CalendarEvent[] => {
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const targetDateString = `${year}-${month}-${day}`;
    return events.filter(event => {
      const eventStartDate = event.date;
      const eventEndDate = event.endDate || event.date;
      return targetDateString >= eventStartDate && targetDateString <= eventEndDate;
    }).sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));
  };

  // -------------------------
  // UI helpers for week/day
  // -------------------------
  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const startKey = formatDateKey(weekDays[0]);
    const endKey = formatDateKey(weekDays[6]);
    const weekEvents = eventsInRange(startKey, endKey);
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-300">Settimana: {new Date(startKey).toLocaleDateString('it-IT')} — {new Date(endKey).toLocaleDateString('it-IT')}</div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayKey = formatDateKey(day);
            const dayEvents = weekEvents.filter(ev => ev.date <= dayKey && (ev.endDate || ev.date) >= dayKey);
            return (
              <div key={dayKey} className="bg-gray-900 rounded p-2 min-h-[120px]">
                <div className={`text-xs font-medium ${formatDateKey(day) === formatDateKey(new Date()) ? 'text-blue-300' : 'text-gray-400'}`}>{day.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}</div>
                <div className="mt-2 space-y-1">
                  {dayEvents.slice(0,4).map(ev => (
                    <div key={ev.id} className={`text-xs px-1 py-0.5 rounded text-white truncate ${ev.isAssigned ? 'bg-green-500' : 'bg-yellow-500'}`} title={ev.title} onClick={() => openModalForDate(dayKey)}>
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 4 && <div className="text-xxs text-gray-400">+{dayEvents.length - 4} altri</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const day = new Date(currentDate);
    const dayKey = formatDateKey(day);
    const dayEvents = events.filter(ev => ev.date <= dayKey && (ev.endDate || ev.date) >= dayKey).sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));

    return <DayViewContent dayEvents={dayEvents} day={day} loadColleaguesForEvent={loadColleaguesForEvent} userId={user?.id} />;
  };

  const DayViewContent: React.FC<{
    dayEvents: CalendarEvent[],
    day: Date,
    loadColleaguesForEvent: (evt: CalendarEvent) => Promise<{id:string,name:string}[]>,
    userId?: string
  }> = ({dayEvents, day, loadColleaguesForEvent, userId}) => {
    const [colleaguesMap, setColleaguesMap] = useState<Record<string, {id:string,name:string}[]>>({});
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

    useEffect(() => {
      let mounted = true;
      const loadAll = async () => {
        for (const ev of dayEvents) {
          if (!mounted) return;
          setLoadingMap(prev => ({...prev, [ev.id]: true}));
          const colleagues = await loadColleaguesForEvent(ev);
          if (!mounted) return;
          const filtered = colleagues.filter(c => c.id !== userId);
          setColleaguesMap(prev => ({...prev, [ev.id]: filtered}));
          setLoadingMap(prev => ({...prev, [ev.id]: false}));
        }
      };
      loadAll();
      return () => { mounted = false; };
    }, [dayEvents.map(e=>e.id).join(',')]);

    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-gray-300">Giorno: {day.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
        </div>

        {dayEvents.length === 0 ? (
          <div className="text-center text-gray-400 py-8">Nessun evento in questa data</div>
        ) : (
          <div className="space-y-3">
            {dayEvents.map(ev => (
              <div key={ev.id} className="bg-gray-900 rounded p-3 border border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-white">{ev.title}</h4>
                    <div className="text-xs text-gray-300">{ev.location}</div>
                    <div className="text-xs text-gray-400 mt-2">{ev.callTime ? `Convocazione: ${ev.callTime}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-300">{ev.startTime} - {ev.endTime}</div>
                    <div className="text-xs mt-2">{ev.isAssigned ? <span className="text-green-300">✅ Assegnato</span> : <span className="text-yellow-300">Non assegnato</span>}</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-700">
                  {loadingMap[ev.id] ? (
                    <div className="text-xs text-gray-400">Caricamento colleghi...</div>
                  ) : (colleaguesMap[ev.id] && colleaguesMap[ev.id].length > 0) ? (
                    <div className="p-2 bg-gray-800 rounded text-xs text-gray-200">
                      <strong>Con te lavoreranno:</strong>
                      <ul className="mt-2 space-y-1 text-xs">
                        {colleaguesMap[ev.id].map(c => (
                          <li key={c.id} className="text-gray-300">• {c.name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">Nessun altro membro assegnato trovato.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const openModalForDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setShowEventModal(true);
  };

  // -------------------------
  // Counts for the summary cards (use per-user raw states)
  // -------------------------
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const assignedEventsThisMonth = userEventAssignments.filter(a => {
    const dateStr = a.data_inizio_assegnazione || a.giorno_inizio_evento || a.start_date || a.date;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const assignedWarehouseShiftsThisMonth = userWarehouseShifts.filter(s => {
    const dateStr = s.data_turno || s.date || s.start_date;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Caricamento calendario...</p>
        </div>
      </div>
    );
  }

  // small CSS for hidden scrollbars (keeps scrolling)
  const hideScrollbarStyle = (
    <style>{`
      .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      .hide-scrollbar::-webkit-scrollbar { display: none; }
    `}</style>
  );

  const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {hideScrollbarStyle}

      <div className="p-4 pb-20 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Il Mio Calendario</h1>
            <p className="text-gray-300">{userProfile?.regaziendasoftware?.ragione_sociale || 'La Mia Azienda'}</p>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={handlePrev} className="p-2 hover:bg-gray-800 rounded"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={handleToday} className="px-3 py-1 bg-gray-800 rounded text-sm">Oggi</button>
            <button onClick={handleNext} className="p-2 hover:bg-gray-800 rounded"><ChevronRight className="h-5 w-5" /></button>

            <div className="ml-2 inline-flex items-center space-x-1 bg-gray-800 rounded">
              <button onClick={() => setView('month')} className={`p-2 ${view === 'month' ? 'bg-gray-700' : ''} rounded-l`} title="Mese"><Calendar className="h-4 w-4" /></button>
              <button onClick={() => setView('week')} className={`p-2 ${view === 'week' ? 'bg-gray-700' : ''}`} title="Settimana"><Grid className="h-4 w-4" /></button>
              <button onClick={() => setView('day')} className={`p-2 ${view === 'day' ? 'bg-gray-700' : ''} rounded-r`} title="Giorno"><List className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {/* Summary cards use per-user counts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <Calendar className="h-6 w-6 mx-auto mb-2 text-blue-400" />
            <div className="text-2xl font-bold text-white">{assignedEventsThisMonth}</div>
            <div className="text-xs text-gray-400">Eventi Assegnati</div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <Building2 className="h-6 w-6 mx-auto mb-2 text-purple-400" />
            <div className="text-2xl font-bold text-white">{assignedWarehouseShiftsThisMonth}</div>
            <div className="text-xs text-gray-400">Turni Assegnati</div>
          </div>
        </div>

        {/* Main view */}
        {view === 'month' && (
          <>
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-white">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                <div className="text-xs text-gray-400">Vista Mensile</div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(day => <div key={day} className="p-2 text-center text-xs font-medium text-gray-400">{day}</div>)}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonth(currentDate).map((day, index) => {
                    let dayClasses = 'min-h-[60px] p-1 border border-gray-700 cursor-pointer transition-colors relative ';
                    if (!day.isCurrentMonth) dayClasses += 'bg-gray-800 text-gray-500 ';
                    else if (day.isToday) dayClasses += 'bg-blue-600 text-white ';
                    else dayClasses += 'hover:bg-gray-700 ';
                    return (
                      <div key={index} className={dayClasses} onClick={() => openModalForDate(formatDateKey(day.date))}>
                        <div className="text-xs font-medium mb-1">{day.date.getDate()}</div>
                        <div className="space-y-1">
                          {day.events.slice(0,2).map((event) => (
                            <div key={event.id} className={`text-xs px-1 py-0.5 rounded text-white truncate ${event.isAssigned ? 'bg-green-500' : 'bg-yellow-500'}`} title={`${event.title} - ${event.isAssigned ? 'Assegnato' : 'Non Assegnato'}`}>
                              {event.title}
                            </div>
                          ))}
                          {day.events.length > 2 && <div className="text-xs text-gray-400 px-1">+{day.events.length - 2} altri</div>}
                        </div>
                        <div className="absolute top-1 right-1">
                          {day.isAvailable ? <CheckCircle className="h-3 w-3 text-green-400" /> : <AlertTriangle className="h-3 w-3 text-red-400" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {view === 'week' && (
          <>
            {renderWeekView()}
          </>
        )}

        {view === 'day' && (
          <>
            {renderDayView()}
          </>
        )}

        <CopyrightFooter />
      </div>

      {showEventModal && selectedDate && (
        <EventDetailsModal
          date={selectedDate}
          crewEvents={getEventsForDate(new Date(selectedDate + 'T12:00:00'))}
          onClose={() => setShowEventModal(false)}
          loadColleaguesForEvent={loadColleaguesForEvent}
        />
      )}
    </div>
  );
};

// -------------------------
// Event details modal (same as before, scrollbars hidden)
// -------------------------
interface EventDetailsModalProps {
  date: string;
  crewEvents: CalendarEvent[];
  onClose: () => void;
  loadColleaguesForEvent: (evt: CalendarEvent) => Promise<{id:string,name:string}[]>;
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ date, crewEvents, onClose, loadColleaguesForEvent }) => {
  const { user } = useAuth();
  const [colleaguesMap, setColleaguesMap] = useState<Record<string, {id:string,name:string}[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      const map: Record<string, {id:string,name:string}[]> = {};
      const loadingState: Record<string, boolean> = {};
      await Promise.all(crewEvents.map(async (ev) => {
        loadingState[ev.id] = true;
        if (mounted) setLoadingMap({ ...loadingState });
        try {
          const cols = await loadColleaguesForEvent(ev);
          const uidCandidates = [user?.id, (user as any)?.sub, (user as any)?.uid].filter(Boolean);
          const filtered = cols.filter(c => !uidCandidates.includes(c.id));
          map[ev.id] = filtered;
        } catch (err) {
          console.error('Errore caricamento colleghi per evento:', err);
          map[ev.id] = [];
        } finally {
          loadingState[ev.id] = false;
          if (mounted) setLoadingMap({ ...loadingState });
        }
      }));
      if (mounted) setColleaguesMap(map);
    };
    loadAll();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, crewEvents]);

  const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 overflow-y-auto flex items-center justify-center">
      <style>{`
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-4 space-y-6 hide-scrollbar">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Eventi del {formatDate(date)}</h2>
          <button onClick={onClose} className="bg-gray-700 p-2 rounded-lg"><X className="h-6 w-6" /></button>
        </div>

        <div className="space-y-4">
          {crewEvents.length === 0 && (<div className="text-center py-8 text-gray-400"><Calendar className="h-10 w-10 mx-auto mb-2 text-gray-600" /><p>Nessun evento in questa data</p></div>)}

          {crewEvents.map(ev => (
            <div key={ev.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="text-lg font-bold text-white">{ev.title}</h4>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${ev.type === 'warehouse' ? 'bg-purple-100 text-purple-800' : ev.type === 'event' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{ev.type === 'warehouse' ? 'Magazzino' : ev.type === 'event' ? 'Evento' : 'Trasferta'}</span>
                  </div>

                  <div className="text-sm text-gray-300 space-y-1">
                    <div className="flex items-center space-x-2"><MapPin className="h-4 w-4" /><span>{ev.location}</span></div>
                    <div className="flex items-center space-x-2"><Clock className="h-4 w-4" /><span>{new Date(ev.date).toLocaleDateString('it-IT')}{ev.endDate && ev.endDate !== ev.date ? ` - ${new Date(ev.endDate).toLocaleDateString('it-IT')}` : ''}</span></div>
                    {ev.callTime && <div className="flex items-center space-x-2"><Clock className="h-4 w-4" /><span>Convocazione: {ev.callTime}</span></div>}
                    {ev.address && <div className="text-xs text-gray-400 break-words">{ev.address}</div>}
                    {ev.description && <div className="text-xs text-gray-400 break-words">{ev.description}</div>}
                  </div>

                  <div className="mt-3">
                    {loadingMap[ev.id] ? (<div className="text-sm text-gray-400">Caricamento colleghi...</div>) : (colleaguesMap[ev.id] && colleaguesMap[ev.id].length > 0) ? (
                      <div className="mt-2 p-2 bg-gray-900 rounded text-sm text-gray-200 max-h-44 overflow-y-auto hide-scrollbar">
                        <strong>Con te lavoreranno:</strong>
                        <ul className="mt-2 list-disc pl-5 text-sm">
                          {colleaguesMap[ev.id].map(c => <li key={c.id} className="break-words">{c.name}</li>)}
                        </ul>
                      </div>
                    ) : (<div className="mt-2 text-sm text-gray-400">Nessun altro membro assegnato trovato.</div>)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileCalendar;