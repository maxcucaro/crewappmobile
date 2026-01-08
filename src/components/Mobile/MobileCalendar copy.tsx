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
  List,
  Bell,
  AlignJustify
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToastContext } from '../../context/ToastContext';
import { CopyrightFooter } from '../UI/CopyrightFooter';
import { supabase } from '../../lib/db';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: 'warehouse' | 'event' | 'event_travel' | 'course';
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

type ViewType = 'month' | 'week' | 'day' | 'agenda';

const MobileCalendar: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToastContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [view, setView] = useState<ViewType>('month'); // month/week/day

  // Raw assignment rows that belong to the user
  const [userEventAssignments, setUserEventAssignments] = useState<any[]>([]);
  const [userWarehouseShifts, setUserWarehouseShifts] = useState<any[]>([]);
  const [userCourseAssignments, setUserCourseAssignments] = useState<any[]>([]);

  // loading flags for confirming/cancelling course participation (keyed by assignment id)
  const [confirmLoading, setConfirmLoading] = useState<Record<string, boolean>>({});

  // UI: course notification popup
  const [showCoursePopup, setShowCoursePopup] = useState(false);

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
      console.log('📅 Caricamento eventi, turni magazzino e corsi per:', personId || user?.id);

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
        else warehouseShifts = ws;
      } catch (err) {
        console.error('Eccezione crew_assegnazione_turni:', err);
      }

      // crew_assegnazionecorsi (course assignments for this user)
      let courseAssignments: any[] | null = null;
      try {
        const { data: ca, error: courseError } = await supabase
          .from('crew_assegnazionecorsi')
          .select('*')
          .eq('persona_id', personId || user?.id)
          .order('data_invito', { ascending: true });
        if (courseError) console.error('Errore crew_assegnazionecorsi:', courseError);
        else courseAssignments = ca;
      } catch (err) {
        console.error('Eccezione crew_assegnazionecorsi:', err);
      }

      // store raw per-user assignment rows in dedicated states
      setUserEventAssignments(eventAssignments || []);
      setUserWarehouseShifts(warehouseShifts || []);
      setUserCourseAssignments(courseAssignments || []);

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

      // Map course assignments by fetching course details in batch
      if (courseAssignments && courseAssignments.length > 0) {
        const corsoIds = Array.from(new Set(courseAssignments.map((c: any) => c.corso_id).filter(Boolean)));
        let coursesMap: Record<string, any> = {};
        try {
          if (corsoIds.length > 0) {
            const { data: courses, error: coursesError } = await supabase
              .from('crew_corsi')
              .select('*')
              .in('id', corsoIds);
            if (coursesError) {
              console.error('Errore caricamento crew_corsi:', coursesError);
            } else {
              coursesMap = (courses || []).reduce((acc: Record<string, any>, cur: any) => {
                acc[cur.id] = cur;
                return acc;
              }, {});
            }
          }
        } catch (err) {
          console.error('Eccezione caricamento crew_corsi:', err);
        }

        courseAssignments.forEach((assignment) => {
          const corso = coursesMap[assignment.corso_id];
          const courseDate = corso?.data_corso ? (typeof corso.data_corso === 'string' ? corso.data_corso : new Date(corso.data_corso).toISOString().slice(0,10)) : (assignment.data_partecipazione ? (typeof assignment.data_partecipazione === 'string' ? assignment.data_partecipazione : new Date(assignment.data_partecipazione).toISOString().slice(0,10)) : null);
          if (!courseDate) return; // skip if no date info
          // Note: id is assignment.id to keep it unique per user's assignment entry.
          // raw contains both assignment and corso so lookups can extract corso.id
          mappedEvents.push({
            id: assignment.id,
            title: corso?.titolo || `Corso ${assignment.corso_id}`,
            description: corso?.descrizione || undefined,
            type: 'course',
            date: courseDate,
            endDate: courseDate,
            startTime: corso?.ora_inizio ? (corso.ora_inizio.substring ? corso.ora_inizio.substring(0,5) : corso.ora_inizio) : '09:00',
            endTime: corso?.ora_fine ? (corso.ora_fine.substring ? corso.ora_fine.substring(0,5) : corso.ora_fine) : '17:00',
            location: corso?.luogo || 'Luogo non specificato',
            address: corso?.luogo || undefined,
            callTime: corso?.ora_inizio ? (corso.ora_inizio.substring ? corso.ora_inizio.substring(0,5) : corso.ora_inizio) : undefined,
            companyName: userProfile?.regaziendasoftware?.ragione_sociale || '',
            isAssigned: true,
            status: assignment.stato_invito || 'invitato',
            assignedCrewNames: assignment.persona_nome || undefined,
            isTravel: false,
            assignedRate: undefined,
            bonusTravel: false,
            bonusDiaria: false,
            raw: { assignment, corso }
          });
        });
      }

      setEvents(mappedEvents);

      console.log('📊 CALENDARIO COMPLETO CARICATO:', {
        eventiTotali: mappedEvents.length,
        eventi: eventAssignments?.length || 0,
        turniMagazzino: warehouseShifts?.length || 0,
        corsi: courseAssignments?.length || 0,
        eventiTrasferta: mappedEvents.filter(e => e.isTravel).length
      });
    } catch (error) {
      console.error('Errore nel caricamento eventi:', error);
      setEvents([]);
      setUserEventAssignments([]);
      setUserWarehouseShifts([]);
      setUserCourseAssignments([]);
    }
  };

  // -------------------------
  // Confirm / Cancel participation for a course assignment
  // -------------------------
  const handleConfirmCourse = async (assignmentId: string) => {
    setConfirmLoading(prev => ({ ...prev, [assignmentId]: true }));
    try {
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from('crew_assegnazionecorsi')
        .update({ stato_invito: 'confermato', data_conferma: nowIso })
        .eq('id', assignmentId);

      if (error) {
        console.error('Errore conferma partecipazione corso:', error);
        showError('Errore', 'Errore durante la conferma partecipazione.');
        return false;
      }

      // Update local userCourseAssignments state
      setUserCourseAssignments(prev => prev.map(a => {
        if (String(a.id) === String(assignmentId)) {
          return { ...a, stato_invito: 'confermato', data_conferma: nowIso };
        }
        return a;
      }));

      // Update events list (mapped events)
      setEvents(prev => prev.map(ev => {
        if (String(ev.id) === String(assignmentId) && ev.type === 'course') {
          const newRaw = { ...(ev.raw || {}) };
          if (newRaw.assignment) {
            newRaw.assignment = { ...newRaw.assignment, stato_invito: 'confermato', data_conferma: nowIso };
          }
          return { ...ev, status: 'confermato', raw: newRaw };
        }
        return ev;
      }));

      showSuccess('Partecipazione confermata');
      return true;
    } catch (err) {
      console.error('Eccezione handleConfirmCourse:', err);
      showError('Errore', 'Errore durante la conferma partecipazione.');
      return false;
    } finally {
      setConfirmLoading(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  const handleCancelCourse = async (assignmentId: string) => {
    setConfirmLoading(prev => ({ ...prev, [assignmentId]: true }));
    try {
      // set back to 'invitato' for compatibility with your flow (company expects invitato)
      const { error } = await supabase
        .from('crew_assegnazionecorsi')
        .update({ stato_invito: 'invitato', data_conferma: null })
        .eq('id', assignmentId);

      if (error) {
        console.error('Errore annullo partecipazione corso:', error);
        showError('Errore', 'Errore durante l\'annullamento partecipazione.');
        return false;
      }

      // Update local userCourseAssignments state
      setUserCourseAssignments(prev => prev.map(a => {
        if (String(a.id) === String(assignmentId)) {
          return { ...a, stato_invito: 'invitato', data_conferma: null };
        }
        return a;
      }));

      // Update events list (mapped events)
      setEvents(prev => prev.map(ev => {
        if (String(ev.id) === String(assignmentId) && ev.type === 'course') {
          const newRaw = { ...(ev.raw || {}) };
          if (newRaw.assignment) {
            newRaw.assignment = { ...newRaw.assignment, stato_invito: 'invitato', data_conferma: null };
          }
          return { ...ev, status: 'invitato', raw: newRaw };
        }
        return ev;
      }));

      showSuccess('Partecipazione annullata');
      return true;
    } catch (err) {
      console.error('Eccezione handleCancelCourse:', err);
      showError('Errore', 'Errore durante l\'annullamento partecipazione.');
      return false;
    } finally {
      setConfirmLoading(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  // Expose handlers so modal (which is in same file) can call them via window if needed.
  (window as any).__confirmCourseHandler = handleConfirmCourse;
  (window as any).__cancelCourseHandler = handleCancelCourse;

  // -------------------------
  // RPC colleagues lookup
  // -------------------------
  const loadColleaguesForEvent = async (evt: CalendarEvent) => {
    try {
      console.log('🔎 loadColleaguesForEvent (RPC): evt.id=', evt.id, 'raw=', evt.raw);

      // --- Warehouse (shifts) use RPC get_shift_colleagues (existing working flow) ---
      if (evt.type === 'warehouse' && evt.raw) {
        const turnoId = evt.raw.turno_id || evt.raw.turno || evt.raw.turnoId;
        const date = evt.date;
        if (turnoId) {
          const { data, error } = await supabase.rpc('get_shift_colleagues', { p_turno: turnoId, p_data: date });
          if (error) { console.warn('RPC get_shift_colleagues error', error); }
          else if (data && data.length > 0) { return (data || []).map((r: any) => ({ id: r.dipendente_id, name: r.dipendente_nome })); }
        }
      }

      // --- Generic event RPC (try for events) ---
      const eventoId = evt.raw?.evento_id || evt.raw?.event_id || evt.id;
      const companyId = evt.raw?.azienda_id || null;
      if (eventoId) {
        const { data, error } = await supabase.rpc('get_event_colleagues', { p_evento: eventoId, p_company: companyId });
        if (error) { console.warn('RPC get_event_colleagues error', error); }
        else if (data && data.length > 0) { return (data || []).map((r: any) => ({ id: r.dipendente_id, name: r.dipendente_nome })); }
      }

      // fallback for events (crew_event_assegnazione)
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

      // For courses we intentionally do NOT fetch participants here (we show confirm/cancel button only)
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
    if (view === 'month' || view === 'agenda') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    else if (view === 'week') setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const handleNext = () => {
    if (view === 'month' || view === 'agenda') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
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

  // compute pending courses count
  const pendingCourses = userCourseAssignments.filter(a => a.stato_invito === 'invitato');

  // -------------------------
  // UI helpers for week/day
  // -------------------------
  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const startKey = formatDateKey(weekDays[0]);
    const endKey = formatDateKey(weekDays[6]);
    const weekEvents = eventsInRange(startKey, endKey);
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-gray-200">Settimana: {new Date(startKey).toLocaleDateString('it-IT')} — {new Date(endKey).toLocaleDateString('it-IT')}</div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayKey = formatDateKey(day);
            const dayEvents = weekEvents.filter(ev => ev.date <= dayKey && (ev.endDate || ev.date) >= dayKey);
            return (
              <div key={dayKey} className="bg-gray-900 rounded-lg p-2 min-h-[140px]">
                <div className={`text-sm font-semibold mb-2 ${formatDateKey(day) === formatDateKey(new Date()) ? 'text-blue-300' : 'text-gray-300'}`}>{day.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}</div>
                <div className="space-y-1">
                  {dayEvents.slice(0,4).map(ev => (
                    <div
                      key={ev.id}
                      className={`text-[11px] leading-tight px-1.5 py-1 rounded text-white truncate font-medium cursor-pointer hover:opacity-90 ${
                        ev.type === 'warehouse'
                          ? (ev.isAssigned ? 'bg-purple-500' : 'bg-purple-600 opacity-80')
                          : ev.type === 'event'
                          ? (ev.isAssigned ? 'bg-blue-500' : 'bg-blue-600 opacity-80')
                          : ev.type === 'event_travel'
                          ? (ev.isAssigned ? 'bg-green-500' : 'bg-green-600 opacity-80')
                          : /* course */ (ev.isAssigned ? 'bg-yellow-500' : 'bg-yellow-600 opacity-80')
                      }`}
                      title={ev.title}
                      onClick={() => openModalForDate(dayKey)}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 4 && <div className="text-xs text-gray-400 font-medium">+{dayEvents.length - 4}</div>}
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
          // Skip loading colleagues for courses (user requested to not show participants for courses)
          if (ev.type === 'course') {
            setLoadingMap(prev => ({ ...prev, [ev.id]: false }));
            setColleaguesMap(prev => ({ ...prev, [ev.id]: [] }));
            continue;
          }
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
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-base font-medium text-gray-200">Giorno: {day.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
        </div>

        {dayEvents.length === 0 ? (
          <div className="text-center text-gray-400 py-10 text-base">Nessun evento in questa data</div>
        ) : (
          <div className="space-y-4">
            {dayEvents.map(ev => (
              <div key={ev.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-white mb-1">{ev.title}</h4>
                    <div className="text-sm text-gray-300">{ev.location}</div>
                    {ev.callTime && <div className="text-sm text-gray-400 mt-2">Convocazione: {ev.callTime}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-300">{ev.startTime} - {ev.endTime}</div>
                    <div className="text-sm mt-2">
                      {ev.isAssigned
                        ? <span className="text-green-300 font-medium">✅ Assegnato</span>
                        : <span className="text-yellow-300 font-medium">Non assegnato</span>
                      }
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-700">
                  {loadingMap[ev.id] ? (
                    <div className="text-sm text-gray-400">Caricamento colleghi...</div>
                  ) : (ev.type !== 'course' && colleaguesMap[ev.id] && colleaguesMap[ev.id].length > 0) ? (
                    <div className="p-3 bg-gray-800 rounded text-sm text-gray-200">
                      <strong className="text-base">Con te lavoreranno:</strong>
                      <ul className="mt-2 space-y-1 text-sm">
                        {colleaguesMap[ev.id].map(c => (
                          <li key={c.id} className="text-gray-300">• {c.name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    ev.type === 'course'
                      ? null
                      : <div className="text-sm text-gray-400">Nessun altro membro assegnato trovato.</div>
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

  const renderAgendaView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startKey = formatDateKey(firstDay);
    const endKey = formatDateKey(lastDay);

    const monthEvents = eventsInRange(startKey, endKey).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    const eventsByDate = monthEvents.reduce((acc, event) => {
      const dateKey = event.date;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(event);
      return acc;
    }, {} as Record<string, CalendarEvent[]>);

    const sortedDates = Object.keys(eventsByDate).sort();

    return (
      <div className="space-y-4">
        {sortedDates.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-600" />
            <p className="text-base text-gray-400">Nessun evento in questo mese</p>
          </div>
        ) : (
          sortedDates.map((dateKey) => {
            const date = new Date(dateKey + 'T12:00:00');
            const isToday = formatDateKey(date) === formatDateKey(new Date());
            const dayEvents = eventsByDate[dateKey];

            return (
              <div key={dateKey} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className={`p-4 border-b border-gray-700 ${isToday ? 'bg-blue-600' : 'bg-gray-750'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold text-white">
                        {date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </div>
                      {isToday && <div className="text-sm text-blue-100 mt-1">Oggi</div>}
                    </div>
                    <div className="text-sm text-gray-300 font-medium">
                      {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventi'}
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {dayEvents.map((event) => {
                    const getEventTypeLabel = () => {
                      if (event.type === 'warehouse') return 'Magazzino';
                      if (event.type === 'event') return 'Evento';
                      if (event.type === 'event_travel') return 'Trasferta';
                      return 'Corso';
                    };

                    const getEventColor = () => {
                      if (event.type === 'warehouse') return 'bg-purple-500';
                      if (event.type === 'event') return 'bg-blue-500';
                      if (event.type === 'event_travel') return 'bg-green-500';
                      return 'bg-yellow-500';
                    };

                    return (
                      <div
                        key={event.id}
                        className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
                        onClick={() => openModalForDate(dateKey)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className={`inline-block px-3 py-1 text-xs font-semibold text-white rounded-full ${getEventColor()}`}>
                                {getEventTypeLabel()}
                              </span>
                              {event.isAssigned && (
                                <span className="inline-flex items-center text-xs text-green-300 font-medium">
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  Assegnato
                                </span>
                              )}
                            </div>
                            <h4 className="text-base font-bold text-white mb-1">{event.title}</h4>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-300">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 flex-shrink-0 text-gray-400" />
                            <span>
                              {event.startTime} - {event.endTime}
                              {event.callTime && <span className="text-gray-400 ml-2">(Convocazione: {event.callTime})</span>}
                            </span>
                          </div>

                          <div className="flex items-start space-x-2">
                            <MapPin className="h-4 w-4 flex-shrink-0 text-gray-400 mt-0.5" />
                            <div>
                              <div className="font-medium">{event.location}</div>
                              {event.address && <div className="text-xs text-gray-400 mt-1">{event.address}</div>}
                            </div>
                          </div>

                          {event.companyName && (
                            <div className="flex items-center space-x-2">
                              <Building2 className="h-4 w-4 flex-shrink-0 text-gray-400" />
                              <span>{event.companyName}</span>
                            </div>
                          )}

                          {event.description && (
                            <div className="mt-2 p-2 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">
                              {event.description}
                            </div>
                          )}

                          {(event.bonusTravel || event.bonusDiaria || event.assignedRate) && (
                            <div className="mt-2 pt-2 border-t border-gray-700 flex flex-wrap gap-2">
                              {event.bonusTravel && (
                                <span className="inline-flex px-2 py-1 text-xs bg-green-900 text-green-200 rounded">
                                  Bonus Trasferta
                                </span>
                              )}
                              {event.bonusDiaria && (
                                <span className="inline-flex px-2 py-1 text-xs bg-blue-900 text-blue-200 rounded">
                                  Bonus Diaria
                                </span>
                              )}
                              {event.assignedRate && (
                                <span className="inline-flex px-2 py-1 text-xs bg-gray-700 text-gray-200 rounded">
                                  Tariffa: {event.assignedRate} EUR
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
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

  // Note: not changing summary cards to include courses to keep change minimal (courses still appear in calendar)
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
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Il Mio Calendario</h1>
              <p className="text-gray-300">{userProfile?.regaziendasoftware?.ragione_sociale || 'La Mia Azienda'}</p>
            </div>

            <div className="flex items-center space-x-2">
              <button onClick={handlePrev} className="p-2 hover:bg-gray-800 rounded"><ChevronLeft className="h-5 w-5" /></button>
              <button onClick={handleToday} className="px-3 py-1 bg-gray-800 rounded text-sm">Oggi</button>
              <button onClick={handleNext} className="p-2 hover:bg-gray-800 rounded"><ChevronRight className="h-5 w-5" /></button>

              <div className="relative">
                <button
                  className="p-2 hover:bg-gray-800 rounded relative"
                  onClick={() => setShowCoursePopup(prev => !prev)}
                  aria-haspopup="true"
                  aria-expanded={showCoursePopup}
                  title="Corsi da confermare"
                >
                  <Bell className="h-5 w-5" />
                  {pendingCourses.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xxs rounded-full px-1.5 py-0.5 text-[10px]">{pendingCourses.length}</span>
                  )}
                </button>

                {showCoursePopup && (
                  <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-base font-semibold text-white">Corsi da confermare</div>
                      <button onClick={() => setShowCoursePopup(false)} className="text-gray-400 hover:text-gray-200"><X className="h-5 w-5" /></button>
                    </div>

                    {pendingCourses.length === 0 ? (
                      <div className="text-sm text-gray-400">Nessun corso da confermare</div>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto hide-scrollbar">
                        {pendingCourses.map((a: any) => {
                          const courseDateRaw = a.data_partecipazione || a.data_invito || (a.corso_meta && (a.corso_meta.data_corso || a.corso_meta.data)) || null;
                          const humanDay = courseDateRaw ? (new Date(String(courseDateRaw)).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : '—';

                          return (
                            <div key={a.id} className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                              <div className="text-sm font-semibold text-white mb-1">Giorno: {humanDay}</div>
                              <div className="text-sm text-gray-400 mt-1">
                                Clicca sul calendario per i dettagli, oppure conferma la partecipazione direttamente da qui.
                              </div>

                              <div className="mt-3 flex items-center space-x-2">
                                <button
                                  className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded disabled:opacity-60 font-medium"
                                  onClick={async () => {
                                    await handleConfirmCourse(a.id);
                                    const stillPending = userCourseAssignments.filter(u => u.stato_invito === 'invitato' && String(u.id) !== String(a.id));
                                    if (stillPending.length === 0) setShowCoursePopup(false);
                                  }}
                                  disabled={Boolean(confirmLoading[a.id])}
                                >
                                  {confirmLoading[a.id] ? 'Confermo...' : 'Conferma'}
                                </button>

                                <button
                                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1.5 rounded disabled:opacity-60 font-medium"
                                  onClick={async () => {
                                    await handleCancelCourse(a.id);
                                    const stillPending = userCourseAssignments.filter(u => u.stato_invito === 'invitato' && String(u.id) !== String(a.id));
                                    if (stillPending.length === 0) setShowCoursePopup(false);
                                  }}
                                  disabled={Boolean(confirmLoading[a.id])}
                                >
                                  {confirmLoading[a.id] ? 'Annullo...' : 'Annulla'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center px-2">
            <div className="inline-flex items-center gap-1.5">
              <button
                onClick={() => setView('month')}
                className={`px-2.5 py-2 rounded-lg font-medium text-sm transition-colors ${view === 'month' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                Mensile
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-2.5 py-2 rounded-lg font-medium text-sm transition-colors ${view === 'week' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                Settimanale
              </button>
              <button
                onClick={() => setView('day')}
                className={`px-2.5 py-2 rounded-lg font-medium text-sm transition-colors ${view === 'day' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                Giornaliera
              </button>
              <button
                onClick={() => setView('agenda')}
                className={`px-2.5 py-2 rounded-lg font-medium text-sm transition-colors ${view === 'agenda' ? 'bg-green-600 text-white' : 'bg-green-700 text-white hover:bg-green-600'}`}
              >
                Agenda
              </button>
            </div>
          </div>
        </div>

        {/* Summary cards use per-user counts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <Calendar className="h-7 w-7 mx-auto mb-2 text-blue-400" />
            <div className="text-2xl font-bold text-white">{assignedEventsThisMonth}</div>
            <div className="text-sm text-gray-400">Eventi Assegnati</div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <Building2 className="h-7 w-7 mx-auto mb-2 text-purple-400" />
            <div className="text-2xl font-bold text-white">{assignedWarehouseShiftsThisMonth}</div>
            <div className="text-sm text-gray-400">Turni Assegnati</div>
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
              <div className="p-3">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(day => <div key={day} className="p-2 text-center text-sm font-semibold text-gray-300">{day}</div>)}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {getDaysInMonth(currentDate).map((day, index) => {
                    let dayClasses = 'min-h-[85px] p-1.5 rounded-lg border border-gray-700 cursor-pointer transition-colors relative ';
                    if (!day.isCurrentMonth) dayClasses += 'bg-gray-800 text-gray-500 ';
                    else if (day.isToday) dayClasses += 'bg-blue-600 text-white shadow-lg ';
                    else dayClasses += 'bg-gray-750 hover:bg-gray-700 ';
                    return (
                      <div key={index} className={dayClasses} onClick={() => openModalForDate(formatDateKey(day.date))}>
                        <div className="text-sm font-semibold mb-1.5">{day.date.getDate()}</div>
                        <div className="space-y-0.5">
                          {day.events.slice(0,2).map((event) => (
                            <div
                              key={event.id}
                              className={`text-[10px] leading-tight px-1 py-0.5 rounded text-white truncate font-medium ${
                                event.type === 'warehouse'
                                  ? (event.isAssigned ? 'bg-purple-500' : 'bg-purple-600 opacity-80')
                                  : event.type === 'event'
                                  ? (event.isAssigned ? 'bg-blue-500' : 'bg-blue-600 opacity-80')
                                  : event.type === 'event_travel'
                                  ? (event.isAssigned ? 'bg-green-500' : 'bg-green-600 opacity-80')
                                  : /* course */ (event.isAssigned ? 'bg-yellow-500' : 'bg-yellow-600 opacity-80')
                              }`}
                              title={`${event.title} - ${event.isAssigned ? 'Assegnato' : 'Non Assegnato'}`}
                            >
                              {event.title}
                            </div>
                          ))}
                          {day.events.length > 2 && <div className="text-[10px] text-gray-300 px-1 font-medium">+{day.events.length - 2}</div>}
                        </div>
                        <div className="absolute top-1 right-1">
                          {day.isAvailable ? <CheckCircle className="h-3.5 w-3.5 text-green-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {view === 'agenda' && (
          <>
            {renderAgendaView()}
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
// Event details modal (courses: participants hidden per request)
// + confirm/annulla participation using parent's handlers exposed on window
// modal centered and uses a high z-index so it stays above menus
// -------------------------
interface EventDetailsModalProps {
  date: string;
  crewEvents: CalendarEvent[];
  onClose: () => void;
  loadColleaguesForEvent: (evt: CalendarEvent) => Promise<{id:string,name:string}[]>;
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ date, crewEvents, onClose, loadColleaguesForEvent }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToastContext();
  const [colleaguesMap, setColleaguesMap] = useState<Record<string, {id:string,name:string}[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [localLoading, setLocalLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      const map: Record<string, {id:string,name:string}[]> = {};
      const loadingState: Record<string, boolean> = {};
      await Promise.all(crewEvents.map(async (ev) => {
        // Skip loading participants for courses (user requested to not show participants for courses)
        if (ev.type === 'course') {
          loadingState[ev.id] = false;
          map[ev.id] = [];
          if (mounted) setLoadingMap({ ...loadingState });
          return;
        }

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

  // call parent's handlers exposed on window; they return Promise<boolean>
  const callGlobalConfirm = async (assignmentId: string) => {
    try {
      setLocalLoading(prev => ({ ...prev, [assignmentId]: true }));
      const handler = (window as any).__confirmCourseHandler;
      if (typeof handler === 'function') {
        await handler(assignmentId);
        // parent shows toast, no duplicate here
      } else {
        showError('Errore', 'Azione non disponibile');
      }
    } catch (e) {
      console.error('Errore callGlobalConfirm', e);
      showError('Errore', 'Errore durante la conferma');
    } finally {
      setLocalLoading(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  const callGlobalCancel = async (assignmentId: string) => {
    try {
      setLocalLoading(prev => ({ ...prev, [assignmentId]: true }));
      const handler = (window as any).__cancelCourseHandler;
      if (typeof handler === 'function') {
        await handler(assignmentId);
        // parent shows toast, no duplicate here
      } else {
        showError('Errore', 'Azione non disponibile');
      }
    } catch (e) {
      console.error('Errore callGlobalCancel', e);
      showError('Errore', 'Errore durante l\'annullamento');
    } finally {
      setLocalLoading(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-[9999] flex items-center justify-center p-4">
      <style>{`
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 space-y-6 hide-scrollbar bg-gray-800 rounded-xl border border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Eventi del {formatDate(date)}</h2>
          <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 p-2.5 rounded-lg transition-colors"><X className="h-6 w-6" /></button>
        </div>

        <div className="space-y-4">
          {crewEvents.length === 0 && (<div className="text-center py-10 text-gray-400"><Calendar className="h-12 w-12 mx-auto mb-3 text-gray-600" /><p className="text-base">Nessun evento in questa data</p></div>)}

          {crewEvents.map(ev => {
            // For courses, raw was stored as { assignment, corso }
            const corso = ev.type === 'course' ? (ev.raw?.corso || ev.raw?.assignment?.corso || ev.raw?.corso) : null;
            const assignment = ev.type === 'course' ? (ev.raw?.assignment || null) : null;

            // Normalize materiali (could be text[] or string)
            const materiali = corso?.materiali || (Array.isArray(assignment?.materiali) ? assignment.materiali : undefined);

            return (
              <div key={ev.id} className="bg-gray-900 rounded-xl p-5 border border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-3">
                      <h4 className="text-lg font-bold text-white">{ev.title}</h4>
                      <span className={`inline-flex px-2.5 py-1 text-sm font-semibold rounded-full ${
                        ev.type === 'warehouse' ? 'bg-purple-100 text-purple-800'
                        : ev.type === 'event' ? 'bg-blue-100 text-blue-800'
                        : ev.type === 'event_travel' ? 'bg-green-100 text-green-800'
                        : /* course */ 'bg-yellow-100 text-yellow-800'
                      }`}>{ev.type === 'warehouse' ? 'Magazzino' : ev.type === 'event' ? 'Evento' : ev.type === 'event_travel' ? 'Trasferta' : 'Corso'}</span>
                    </div>

                    <div className="text-sm text-gray-300 space-y-2">
                      <div className="flex items-center space-x-2"><MapPin className="h-4 w-4 flex-shrink-0" /><span>{ev.location}</span></div>
                      <div className="flex items-center space-x-2"><Clock className="h-4 w-4 flex-shrink-0" /><span>{new Date(ev.date).toLocaleDateString('it-IT')}{ev.endDate && ev.endDate !== ev.date ? ` - ${new Date(ev.endDate).toLocaleDateString('it-IT')}` : ''}</span></div>
                      {ev.callTime && <div className="flex items-center space-x-2"><Clock className="h-4 w-4 flex-shrink-0" /><span>Convocazione: {ev.callTime}</span></div>}
                      {ev.address && <div className="text-sm text-gray-400 break-words mt-2">{ev.address}</div>}
                      {ev.description && <div className="text-sm text-gray-400 break-words mt-2">{ev.description}</div>}
                    </div>

                    {/* Course specific details */}
                    {ev.type === 'course' && (
                      <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                        <div className="mb-3">
                          <div className="text-sm text-gray-400 mb-1">Titolo</div>
                          <div className="text-base text-white font-semibold">{corso?.titolo || ev.title}</div>
                        </div>

                        {corso?.descrizione && (
                          <div className="mb-3">
                            <div className="text-sm text-gray-400 mb-1">Descrizione</div>
                            <div className="text-sm text-gray-200">{corso.descrizione}</div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <div className="text-sm text-gray-400 mb-1">Inizio</div>
                            <div className="text-sm text-white font-medium">{corso?.ora_inizio ? (corso.ora_inizio.substring ? corso.ora_inizio.substring(0,5) : corso.ora_inizio) : ev.startTime}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-400 mb-1">Fine</div>
                            <div className="text-sm text-white font-medium">{corso?.ora_fine ? (corso.ora_fine.substring ? corso.ora_fine.substring(0,5) : corso.ora_fine) : ev.endTime}</div>
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="text-sm text-gray-400 mb-1">Luogo</div>
                          <div className="text-sm text-white font-medium">{corso?.luogo || ev.location}</div>
                        </div>

                        {corso?.istruttore && (
                          <div className="mb-3">
                            <div className="text-sm text-gray-400 mb-1">Istruttore</div>
                            <div className="text-sm text-white font-medium">{corso.istruttore}</div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 items-center">
                          <div>
                            <div className="text-sm text-gray-400 mb-1">Categoria</div>
                            <div className="text-sm text-white font-medium">{corso?.categoria || '—'}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-400 mb-1">Obbligatorio</div>
                            <div className="text-sm text-white font-medium">{corso?.obbligatorio ? 'Sì' : 'No'}</div>
                          </div>
                        </div>

                        {materiali && (Array.isArray(materiali) ? materiali.length > 0 : Boolean(materiali)) && (
                          <div className="mt-3">
                            <div className="text-xs text-gray-400">Richieste / Materiali</div>
                            {Array.isArray(materiali) ? (
                              <ul className="mt-2 list-disc pl-5 text-sm text-gray-200">
                                {materiali.map((m: any, idx: number) => <li key={idx} className="break-words">{String(m)}</li>)}
                              </ul>
                            ) : (
                              <div className="text-sm text-gray-200 mt-2">{String(materiali)}</div>
                            )}
                          </div>
                        )}

                        {corso?.note && (
                          <div className="mt-3">
                            <div className="text-xs text-gray-400">Note del corso</div>
                            <div className="text-sm text-gray-200 mt-1">{corso.note}</div>
                          </div>
                        )}

                        {/* Confirm / Cancel participation button logic */}
                        {assignment && (
                          <div className="mt-4 flex items-center space-x-3">
                            {assignment.stato_invito === 'invitato' && (
                              <button
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded disabled:opacity-60"
                                onClick={() => callGlobalConfirm(assignment.id)}
                                disabled={Boolean(localLoading[assignment.id])}
                              >
                                {localLoading[assignment.id] ? 'Confermo...' : 'Conferma partecipazione'}
                              </button>
                            )}

                            {assignment.stato_invito === 'confermato' && (
                              <>
                                <div className="text-sm text-green-300">Partecipazione confermata</div>
                                <button
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded disabled:opacity-60"
                                  onClick={() => callGlobalCancel(assignment.id)}
                                  disabled={Boolean(localLoading[assignment.id])}
                                >
                                  {localLoading[assignment.id] ? 'Annullo...' : 'Annulla Partecipazione'}
                                </button>
                              </>
                            )}

                            {assignment.stato_invito === 'rifiutato' && (
                              <div className="text-sm text-yellow-300">Hai rifiutato la partecipazione</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Participants block: shown only for non-course events.
                    For courses we intentionally do NOT show participants per your request. */}
                <div className="mt-4">
                  {ev.type !== 'course' ? (
                    loadingMap[ev.id] ? (<div className="text-sm text-gray-400">Caricamento partecipanti...</div>) :
                      (colleaguesMap[ev.id] && colleaguesMap[ev.id].length > 0) ? (
                        <div className="mt-2 p-3 bg-gray-800 rounded-lg text-sm text-gray-200 max-h-48 overflow-y-auto hide-scrollbar">
                          <strong className="text-base">Partecipanti confermati:</strong>
                          <ul className="mt-2 space-y-1 list-disc pl-5 text-sm">
                            {colleaguesMap[ev.id].map(c => <li key={c.id} className="break-words">{c.name}</li>)}
                          </ul>
                        </div>
                      ) : (<div className="mt-2 text-sm text-gray-400">Nessun altro membro assegnato trovato.</div>)
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MobileCalendar; 