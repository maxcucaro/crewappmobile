import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Building2,
  X,
  Users,
  AlertCircle
} from 'lucide-react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToastContext } from '../../context/ToastContext';
import { CopyrightFooter } from '../UI/CopyrightFooter';
import { supabase } from '../../utils/supabase';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: 'event' | 'course';
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  location: string;
  address?: string;
  callTime?: string;
  companyName: string;
  assignedCrewCount?: number;
  requiredCrewCount?: number;
  eventGroupCode?: string;
  color: string;
  raw?: any;
}

interface AbsenceRecord {
  id: string;
  crewId: string;
  crewName: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  absences: AbsenceRecord[];
}

type ViewType = 'month' | 'agenda';

const CompanyMobileCalendar: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const { showError } = useToastContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [view, setView] = useState<ViewType>('month');

  useEffect(() => {
    if (companyProfile?.id) {
      loadAllEvents();
      loadAbsences();
    }
  }, [companyProfile?.id]);

  const getColorForEventGroup = (groupCode: string | null | undefined): string => {
    if (!groupCode) return 'bg-blue-500';

    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-orange-500',
      'bg-teal-500',
      'bg-cyan-500',
      'bg-emerald-500'
    ];

    let hash = 0;
    for (let i = 0; i < groupCode.length; i++) {
      hash = groupCode.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const loadAllEvents = async () => {
    if (!companyProfile?.id) return;

    setLoading(true);
    try {
      const allEvents: CalendarEvent[] = [];

      const { data: crewEvents, error: eventsError } = await supabase
        .from('crew_events')
        .select(`
          id,
          title,
          description,
          type,
          start_date,
          end_date,
          location,
          address,
          call_time,
          required_crew,
          event_group_code
        `)
        .eq('company_id', companyProfile.id)
        .order('start_date', { ascending: true });

      if (eventsError) {
        console.error('Errore caricamento eventi:', eventsError);
      }

      let eventAssignmentsMap: Record<string, number> = {};
      if (crewEvents && crewEvents.length > 0) {
        const eventIds = crewEvents.map(e => e.id);
        const { data: allAssignments } = await supabase
          .from('crew_event_assegnazione')
          .select('evento_id')
          .in('evento_id', eventIds);

        if (allAssignments) {
          allAssignments.forEach(assignment => {
            eventAssignmentsMap[assignment.evento_id] = (eventAssignmentsMap[assignment.evento_id] || 0) + 1;
          });
        }
      }

      if (crewEvents) {
        for (const event of crewEvents) {
          const assignedCount = eventAssignmentsMap[event.id] || 0;
          const color = getColorForEventGroup(event.event_group_code);

          allEvents.push({
            id: event.id,
            title: event.title,
            description: event.description || undefined,
            type: 'event',
            date: event.start_date,
            endDate: event.end_date || event.start_date,
            startTime: event.call_time ? event.call_time.substring(0, 5) : '09:00',
            endTime: '18:00',
            location: event.location || 'Non specificato',
            address: event.address || undefined,
            callTime: event.call_time ? event.call_time.substring(0, 5) : undefined,
            companyName: companyProfile?.ragione_sociale || '',
            assignedCrewCount: assignedCount,
            requiredCrewCount: event.required_crew || 0,
            eventGroupCode: event.event_group_code || undefined,
            color: color,
            raw: event
          });
        }
      }

      const { data: courses, error: coursesError } = await supabase
        .from('crew_corsi')
        .select(`
          id,
          titolo,
          descrizione,
          data_corso,
          ora_inizio,
          ora_fine,
          luogo,
          istruttore,
          categoria,
          obbligatorio,
          max_partecipanti
        `)
        .eq('azienda_id', companyProfile.id)
        .order('data_corso', { ascending: true });

      if (coursesError) {
        console.error('Errore caricamento corsi:', coursesError);
      }

      let courseParticipantsMap: Record<string, number> = {};
      if (courses && courses.length > 0) {
        const courseIds = courses.map(c => c.id);
        const { data: allParticipants } = await supabase
          .from('crew_assegnazionecorsi')
          .select('corso_id')
          .in('corso_id', courseIds);

        if (allParticipants) {
          allParticipants.forEach(participant => {
            courseParticipantsMap[participant.corso_id] = (courseParticipantsMap[participant.corso_id] || 0) + 1;
          });
        }
      }

      if (courses) {
        for (const course of courses) {
          const participantCount = courseParticipantsMap[course.id] || 0;

          allEvents.push({
            id: course.id,
            title: course.titolo,
            description: course.descrizione || undefined,
            type: 'course',
            date: course.data_corso,
            endDate: course.data_corso,
            startTime: course.ora_inizio ? course.ora_inizio.substring(0, 5) : '09:00',
            endTime: course.ora_fine ? course.ora_fine.substring(0, 5) : '17:00',
            location: course.luogo,
            address: undefined,
            callTime: undefined,
            companyName: companyProfile?.ragione_sociale || '',
            assignedCrewCount: participantCount,
            requiredCrewCount: course.max_partecipanti || 0,
            eventGroupCode: undefined,
            color: 'bg-yellow-500',
            raw: course
          });
        }
      }

      setEvents(allEvents);
      console.log('📅 Eventi totali caricati:', allEvents.length, { eventi: crewEvents?.length || 0, corsi: courses?.length || 0 });
    } catch (error) {
      console.error('Errore nel caricamento eventi:', error);
      showError('Errore', 'Impossibile caricare gli eventi');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAbsences = async () => {
    if (!companyProfile?.id) return;

    try {
      const { data: requests, error } = await supabase
        .from('vacation_leave_requests')
        .select(`
          id,
          crew_id,
          request_type,
          start_date,
          end_date,
          reason,
          crew_members!inner(nome, cognome, company_id)
        `)
        .eq('status', 'approved')
        .eq('crew_members.company_id', companyProfile.id);

      if (error) throw error;

      const absenceRecords: AbsenceRecord[] = (requests || []).map(req => ({
        id: req.id,
        crewId: req.crew_id,
        crewName: `${req.crew_members.nome} ${req.crew_members.cognome}`,
        type: req.request_type,
        startDate: req.start_date,
        endDate: req.end_date,
        reason: req.reason
      }));

      setAbsences(absenceRecords);
      console.log('📅 Assenze caricate:', absenceRecords.length);
    } catch (error) {
      console.error('Errore nel caricamento assenze:', error);
    }
  };

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handlePrev = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNext = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  const getAbsencesForDate = (targetDate: Date): AbsenceRecord[] => {
    const targetDateString = formatDateKey(targetDate);
    return absences.filter(absence => {
      return targetDateString >= absence.startDate && targetDateString <= absence.endDate;
    });
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
        absences: getAbsencesForDate(prevDate)
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = new Date(year, month, day);
      const dayEvents = getEventsForDate(currentDay);
      const dayAbsences = getAbsencesForDate(currentDay);
      days.push({
        date: currentDay,
        isCurrentMonth: true,
        isToday: formatDateKey(currentDay) === formatDateKey(new Date()),
        events: dayEvents,
        absences: dayAbsences
      });
    }

    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        isToday: false,
        events: getEventsForDate(nextDate),
        absences: getAbsencesForDate(nextDate)
      });
    }

    return days;
  };

  const getEventsForDate = (targetDate: Date): CalendarEvent[] => {
    const targetDateString = formatDateKey(targetDate);
    return events.filter(event => {
      const eventStartDate = event.date;
      const eventEndDate = event.endDate || event.date;
      return targetDateString >= eventStartDate && targetDateString <= eventEndDate;
    }).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
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

    const monthEvents = events
      .filter(ev => ev.date <= endKey && (ev.endDate || ev.date) >= startKey)
      .sort((a, b) => {
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
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
                      onClick={() => openModalForDate(dateKey)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`inline-block px-3 py-1 text-xs font-semibold text-white rounded-full ${event.color}`}>
                              {event.type === 'course' ? 'Corso' : 'Evento'}
                            </span>
                            {event.assignedCrewCount !== undefined && event.requiredCrewCount !== undefined && (
                              <span className="inline-flex items-center text-xs text-gray-300 font-medium">
                                <Users className="h-3.5 w-3.5 mr-1" />
                                {event.assignedCrewCount}/{event.requiredCrewCount}
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

                        {event.description && (
                          <div className="mt-2 p-2 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">
                            {event.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const eventsThisMonth = events.filter(ev => {
    const d = new Date(ev.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear && ev.type === 'event';
  }).length;

  const coursesThisMonth = events.filter(ev => {
    const d = new Date(ev.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear && ev.type === 'course';
  }).length;

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startKey = formatDateKey(firstDay);
  const endKey = formatDateKey(lastDay);

  const absencesThisMonth = absences.filter(absence => {
    return absence.startDate <= endKey && absence.endDate >= startKey;
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

  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="p-4 pb-20 space-y-4">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Calendario Aziendale</h1>
              <p className="text-gray-300">{companyProfile?.nome_azienda || 'Azienda'}</p>
            </div>

            <div className="flex items-center space-x-2">
              <button onClick={handlePrev} className="p-2 hover:bg-gray-800 rounded">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={handleToday} className="px-3 py-1 bg-gray-800 rounded text-sm">
                Oggi
              </button>
              <button onClick={handleNext} className="p-2 hover:bg-gray-800 rounded">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex justify-center px-2">
            <div className="inline-flex items-center gap-1.5">
              <button
                onClick={() => setView('month')}
                className={`px-2.5 py-2 rounded-lg font-medium text-sm transition-colors ${
                  view === 'month' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Mensile
              </button>
              <button
                onClick={() => setView('agenda')}
                className={`px-2.5 py-2 rounded-lg font-medium text-sm transition-colors ${
                  view === 'agenda' ? 'bg-green-600 text-white' : 'bg-green-700 text-white hover:bg-green-600'
                }`}
              >
                Agenda
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <Calendar className="h-6 w-6 mx-auto mb-2 text-blue-400" />
            <div className="text-xl font-bold text-white">{eventsThisMonth}</div>
            <div className="text-xs text-gray-400">Eventi</div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <Building2 className="h-6 w-6 mx-auto mb-2 text-yellow-400" />
            <div className="text-xl font-bold text-white">{coursesThisMonth}</div>
            <div className="text-xs text-gray-400">Corsi</div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-400" />
            <div className="text-xl font-bold text-white">{absencesThisMonth}</div>
            <div className="text-xs text-gray-400">Assenze</div>
          </div>
        </div>

        {view === 'month' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <div className="text-xs text-gray-400">Vista Mensile</div>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                  <div key={day} className="p-2 text-center text-sm font-semibold text-gray-300">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {getDaysInMonth(currentDate).map((day, index) => {
                  let dayClasses = 'min-h-[85px] p-1.5 rounded-lg border border-gray-700 cursor-pointer transition-colors relative ';
                  if (!day.isCurrentMonth) dayClasses += 'bg-gray-800 text-gray-500 ';
                  else if (day.isToday) dayClasses += 'bg-blue-600 text-white shadow-lg ';
                  else dayClasses += 'bg-gray-750 hover:bg-gray-700 ';

                  return (
                    <div
                      key={index}
                      className={dayClasses}
                      onClick={() => openModalForDate(formatDateKey(day.date))}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-sm font-semibold">{day.date.getDate()}</div>
                        {day.absences.length > 0 && (
                          <div className="h-2 w-2 rounded-full bg-red-500" title={`${day.absences.length} assenze`}></div>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {day.events.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={`text-[10px] leading-tight px-1 py-0.5 rounded text-white truncate font-medium ${event.color}`}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        ))}
                        {day.events.length > 2 && (
                          <div className="text-[10px] text-gray-300 px-1 font-medium">
                            +{day.events.length - 2}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === 'agenda' && renderAgendaView()}

        <CopyrightFooter />
      </div>

      {showEventModal && selectedDate && (
        <EventDetailsModal
          date={selectedDate}
          events={getEventsForDate(new Date(selectedDate + 'T12:00:00'))}
          absences={getAbsencesForDate(new Date(selectedDate + 'T12:00:00'))}
          onClose={() => setShowEventModal(false)}
        />
      )}
    </div>
  );
};

interface EventDetailsModalProps {
  date: string;
  events: CalendarEvent[];
  absences: AbsenceRecord[];
  onClose: () => void;
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ date, events, absences, onClose }) => {
  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

  const getAbsenceTypeLabel = (type: string) => {
    switch (type) {
      case 'vacation': return 'Ferie';
      case 'sick_leave': return 'Malattia';
      case 'injury': return 'Infortunio';
      case 'permission': return 'Permesso';
      default: return type;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-[9999] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 space-y-6 bg-gray-800 rounded-xl border border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Eventi del {formatDate(date)}</h2>
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 p-2.5 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          {absences.length > 0 && (
            <div className="bg-red-900/20 border border-red-700 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-3">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <h3 className="text-base font-bold text-red-300">Dipendenti Assenti ({absences.length})</h3>
              </div>
              <div className="space-y-2">
                {absences.map(absence => (
                  <div key={absence.id} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-white">{absence.crewName}</div>
                      <div className="text-xs px-2 py-1 rounded bg-red-600 text-white font-medium">
                        {getAbsenceTypeLabel(absence.type)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      Dal {new Date(absence.startDate + 'T12:00:00').toLocaleDateString('it-IT')} al{' '}
                      {new Date(absence.endDate + 'T12:00:00').toLocaleDateString('it-IT')}
                    </div>
                    {absence.reason && (
                      <div className="text-sm text-gray-300 mt-2">{absence.reason}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && absences.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-600" />
              <p className="text-base">Nessun evento o assenza in questa data</p>
            </div>
          )}

          {events.map(ev => (
            <div key={ev.id} className="bg-gray-900 rounded-xl p-5 border border-gray-700">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="text-lg font-bold text-white">{ev.title}</h4>
                    <span className={`inline-flex px-2.5 py-1 text-sm font-semibold rounded-full ${ev.color} text-white`}>
                      {ev.type === 'course' ? 'Corso' : 'Evento'}
                    </span>
                  </div>

                  <div className="text-sm text-gray-300 space-y-2">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span>{ev.location}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 flex-shrink-0" />
                      <span>
                        {ev.startTime} - {ev.endTime}
                        {ev.callTime && ` (Convocazione: ${ev.callTime})`}
                      </span>
                    </div>
                    {ev.address && <div className="text-sm text-gray-400 break-words mt-2">{ev.address}</div>}
                    {ev.description && <div className="text-sm text-gray-400 break-words mt-2">{ev.description}</div>}
                  </div>

                  {ev.assignedCrewCount !== undefined && ev.requiredCrewCount !== undefined && (
                    <div className="mt-3 flex items-center space-x-2 text-sm">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-300">
                        Assegnati: {ev.assignedCrewCount} / {ev.requiredCrewCount}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompanyMobileCalendar;
