import React, { useState, useEffect } from 'react';
import { Calendar, Clock, DollarSign, MapPin, CheckCircle, AlertTriangle, Navigation, Building2, Users, Briefcase, Plane } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/db';
import TimesheetModal from '../Crew/TimesheetModal';

interface CompanyEvent {
  id: string;
  title: string;
  description: string;
  type: 'warehouse' | 'event' | 'event_travel';
  startDate: string;
  endDate: string;
  location: string;
  companyName: string;
  requiredCrew: number;
  isAssigned: boolean;
  status: 'draft' | 'published' | 'in_progress' | 'completed';
  isConfirmed: boolean;
  assignedCrewCount: number;
  assignedCrewNames: string;
}

interface MonthlyStats {
  totalEvents: number;
  assignedEvents: number;
  warehouseEvents: number;
  regularEvents: number;
  travelEvents: number;
  upcomingEvents: number;
  thisMonthEvents: number;
}

const CrewDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showTimesheetModal, setShowTimesheetModal] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    totalEvents: 0,
    assignedEvents: 0,
    warehouseEvents: 0,
    regularEvents: 0,
    travelEvents: 0,
    upcomingEvents: 0,
    thisMonthEvents: 0
  });

  useEffect(() => {
    if (user?.id) {
      loadEmployeeDashboardData();
    }
  }, [user?.id]);

  const loadEmployeeDashboardData = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Caricamento dashboard dipendente per user ID:', user?.id);
      
      // 1. Carica il profilo del dipendente
      const { data: userData, error: userError } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle();

      if (userError) {
        console.error('❌ Errore caricamento profilo dipendente:', userError);
        return;
      }

      if (!userData) {
        console.log('⚠️ Dipendente non trovato, potrebbe essere un freelance');
        await loadFreelanceDashboard();
        return;
      }

      console.log('✅ Profilo dipendente caricato:', userData);
      setUserProfile(userData);

      if (!userData.parent_company_id) {
        console.log('⚠️ Non è un dipendente (no parent_company_id)');
        await loadFreelanceDashboard();
        return;
      }

      // 2. Carica TUTTI gli eventi dell'azienda
      console.log('📅 Caricamento eventi azienda:', userData.parent_company_id);
      
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          regaziendasoftware!company_id(ragione_sociale),
          event_crew_assignments!event_id(
            crew_id,
            auth_user_id,
            crew_name,
            final_hourly_rate,
            final_daily_rate,
            payment_status
          )
        `)
        .eq('company_id', userData.parent_company_id)
        .order('start_date', { ascending: true });

      if (eventsError) {
        console.error('❌ Errore caricamento eventi azienda:', eventsError);
        setEvents([]);
        return;
      }

      console.log('✅ Eventi azienda caricati:', eventsData?.length || 0);

      // 3. Mappa gli eventi con informazioni di assegnazione
      const mappedEvents: CompanyEvent[] = (eventsData || []).map(event => {
        const assignments = event.event_crew_assignments || [];
        
        // Controlla se il dipendente è assegnato
        const isAssigned = assignments.some((assignment: any) => 
          assignment.crew_id === user?.id || assignment.auth_user_id === user?.id
        );
        
        // Ottieni nomi crew assegnati
        const assignedCrewNames = assignments
          .map((a: any) => a.crew_name)
          .filter((name: string) => name && name !== 'Nome non trovato')
          .join(', ');

        console.log(`🎭 Evento "${event.title}":`, {
          id: event.id,
          startDate: event.start_date,
          endDate: event.end_date,
          type: event.type,
          isAssigned,
          assignmentsCount: assignments.length,
          status: event.status
        });

        return {
          id: event.id,
          title: event.title,
          description: event.description || '',
          type: event.type,
          startDate: event.start_date,
          endDate: event.end_date,
          location: event.location || 'Sede aziendale',
          companyName: event.regaziendasoftware?.ragione_sociale || 'La Mia Azienda',
          requiredCrew: event.required_crew || 0,
          isAssigned,
          status: event.status,
          isConfirmed: event.is_confirmed || false,
          assignedCrewCount: assignments.length,
          assignedCrewNames
        };
      });

      setEvents(mappedEvents);

      // 4. Calcola statistiche
      calculateMonthlyStats(mappedEvents);

    } catch (error) {
      console.error('❌ Errore generale caricamento dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFreelanceDashboard = async () => {
    try {
      console.log('👤 Caricamento dashboard freelance');
      
      // Carica solo eventi assegnati al freelance
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('event_crew_assignments')
        .select(`
          *,
          events!event_id(
            id,
            title,
            description,
            type,
            start_date,
            end_date,
            location,
            status,
            is_confirmed,
            company_id,
            regaziendasoftware!company_id(ragione_sociale)
          )
        `)
        .eq('crew_id', user?.id);

      if (assignmentsError) {
        console.error('❌ Errore caricamento eventi freelance:', assignmentsError);
        setEvents([]);
        return;
      }

      const freelanceEvents: CompanyEvent[] = (assignmentsData || []).map(assignment => {
        const event = assignment.crew_events;
        return {
          id: event.id,
          title: event.title,
          description: event.description || '',
          type: event.type,
          startDate: event.start_date,
          endDate: event.end_date,
          location: event.location || 'Da definire',
          companyName: event.regaziendasoftware?.ragione_sociale || 'Azienda Cliente',
          requiredCrew: 1,
          isAssigned: true, // Sempre true per freelance
          status: event.status,
          isConfirmed: event.is_confirmed || false,
          assignedCrewCount: 1,
          assignedCrewNames: 'Tu'
        };
      });

      setEvents(freelanceEvents);
      calculateMonthlyStats(freelanceEvents);

    } catch (error) {
      console.error('❌ Errore caricamento dashboard freelance:', error);
    }
  };

  const calculateMonthlyStats = (eventsList: CompanyEvent[]) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const todayString = today.toISOString().split('T')[0];

    // Eventi del mese corrente
    const thisMonthEvents = eventsList.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
    });

    // Eventi futuri (da oggi in poi)
    const upcomingEvents = eventsList.filter(event => event.startDate >= todayString);

    // Eventi assegnati del mese corrente
    const assignedThisMonth = thisMonthEvents.filter(e => e.isAssigned);

    // Statistiche per tipo (solo eventi assegnati del mese corrente)
    const warehouseEvents = assignedThisMonth.filter(e => e.type === 'warehouse').length;
    const regularEvents = assignedThisMonth.filter(e => e.type === 'event').length;
    const travelEvents = assignedThisMonth.filter(e => e.type === 'event_travel').length;

    const stats: MonthlyStats = {
      totalEvents: thisMonthEvents.length,
      assignedEvents: assignedThisMonth.length,
      warehouseEvents,
      regularEvents,
      travelEvents,
      upcomingEvents: upcomingEvents.filter(e => e.isAssigned).length,
      thisMonthEvents: thisMonthEvents.length
    };

    console.log('📊 Statistiche calcolate:', stats);
    setMonthlyStats(stats);
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'warehouse': return 'Magazzino';
      case 'event': return 'Evento';
      case 'event_travel': return 'Evento Trasferta';
      default: return type;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'warehouse': return 'bg-gray-100 text-gray-800';
      case 'event': return 'bg-blue-100 text-blue-800';
      case 'event_travel': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'warehouse': return Building2;
      case 'event': return Calendar;
      case 'event_travel': return Plane;
      default: return Calendar;
    }
  };

  // Filtra eventi futuri assegnati per la sezione "Prossimi Eventi"
  const todayString = new Date().toISOString().split('T')[0];
  const upcomingAssignedEvents = events
    .filter(event => event.startDate >= todayString && event.isAssigned)
    .slice(0, 5);

  const handleAddTimesheet = () => {
    setShowTimesheetModal(true);
  };

  const handleSaveTimesheet = (entryData: any) => {
    console.log('Saving timesheet entry:', entryData);
    setShowTimesheetModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const stats = [
    {
      title: 'Eventi Questo Mese',
      value: monthlyStats.thisMonthEvents.toString(),
      change: `${monthlyStats.assignedEvents} assegnati a te`,
      icon: Calendar,
      color: 'bg-blue-500'
    },
    {
      title: 'Turni Magazzino',
      value: monthlyStats.warehouseEvents.toString(),
      change: `${monthlyStats.warehouseEvents} turni assegnati`,
      icon: Building2,
      color: 'bg-gray-500'
    },
    {
      title: 'Eventi Standard',
      value: monthlyStats.regularEvents.toString(),
      change: `${monthlyStats.regularEvents} eventi assegnati`,
      icon: Calendar,
      color: 'bg-green-500'
    },
    {
      title: 'Eventi Trasferta',
      value: monthlyStats.travelEvents.toString(),
      change: `${monthlyStats.travelEvents} trasferte assegnate`,
      icon: Plane,
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Crew</h1>
          <p className="text-gray-600">
            Panoramica dei tuoi eventi e turni di lavoro
            {userProfile?.parent_company_id && (
              <span className="block text-sm text-blue-600 mt-1 font-medium">
                🏢 {userProfile?.company_name || 'La Mia Azienda'} - Visualizzi il calendario aziendale
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Info Banner per Dipendenti */}
      {userProfile?.parent_company_id && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Building2 className="h-5 w-5 text-blue-600" />
            <div>
              <h4 className="font-medium text-blue-900">Dashboard Crew Member</h4>
              <p className="text-sm text-blue-800">
                Come crew member, vedi tutti gli eventi della tua azienda. Gli eventi evidenziati in verde sono quelli a cui sei assegnato.
                Registra le tue ore di lavoro per ogni evento assegnato.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid - Presenze per Tipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500">{stat.change}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prossimi Eventi Assegnati */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">I Miei Prossimi Eventi ({upcomingAssignedEvents.length})</h3>
          {upcomingAssignedEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Nessun evento assegnato in programma</p>
              <p className="text-sm mt-1">
                {userProfile?.parent_company_id 
                  ? 'Attendi che la tua azienda ti assegni a nuovi eventi' 
                  : 'Attendi che un\'azienda ti assegni a un evento'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingAssignedEvents.map((event) => {
                const EventIcon = getEventTypeIcon(event.type);
                return (
                  <div key={event.id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <EventIcon className="h-5 w-5 text-green-600" />
                          <h4 className="font-medium text-gray-900">{event.title}</h4>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEventTypeColor(event.type)}`}>
                            {getEventTypeLabel(event.type)}
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            ✅ Assegnato
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{event.companyName}</p>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-500 flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {new Date(event.startDate).toLocaleDateString('it-IT')}
                            {event.startDate !== event.endDate && (
                              <> - {new Date(event.endDate).toLocaleDateString('it-IT')}</>
                            )}
                          </p>
                          <p className="text-sm text-gray-500 flex items-center">
                            <MapPin className="h-4 w-4 mr-1" />
                            {event.location}
                          </p>
                          {event.assignedCrewNames && (
                            <p className="text-sm text-gray-500 flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              Team: {event.assignedCrewNames}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {upcomingAssignedEvents.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 text-center">
              <button
                onClick={() => navigate('/crew/calendar')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Visualizza calendario completo →
              </button>
            </div>
          )}
        </div>

        {/* Tutti gli Eventi Aziendali */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Tutti gli Eventi Aziendali ({events.length})
          </h3>
          {events.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Nessun evento aziendale</p>
              <p className="text-sm mt-1">La tua azienda non ha eventi in programma</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {events.slice(0, 10).map((event) => {
                const EventIcon = getEventTypeIcon(event.type);
                const isUpcoming = event.startDate >= todayString;
                
                return (
                  <div 
                    key={event.id} 
                    className={`border rounded-lg p-3 ${
                      event.isAssigned 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <EventIcon className={`h-4 w-4 ${event.isAssigned ? 'text-green-600' : 'text-gray-400'}`} />
                          <h5 className="font-medium text-gray-900 text-sm">{event.title}</h5>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEventTypeColor(event.type)}`}>
                            {getEventTypeLabel(event.type)}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(event.startDate).toLocaleDateString('it-IT')}
                            {event.startDate !== event.endDate && (
                              <> - {new Date(event.endDate).toLocaleDateString('it-IT')}</>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {event.location}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center">
                            <Users className="h-3 w-3 mr-1" />
                            {event.assignedCrewCount}/{event.requiredCrew} crew
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-1">
                        {event.isAssigned ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            ✅ Assegnato
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            📋 Non Assegnato
                          </span>
                        )}
                        
                        {!isUpcoming && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            📅 Passato
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {events.length > 10 && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => navigate('/crew/calendar')}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Visualizza tutti i {events.length} eventi →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Riepilogo Mensile */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Riepilogo {new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-600" />
            <div className="text-2xl font-bold text-gray-900">{monthlyStats.warehouseEvents}</div>
            <div className="text-sm text-gray-600">Turni Magazzino</div>
            <div className="text-xs text-gray-500 mt-1">Lavoro interno in sede</div>
          </div>
          
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold text-blue-900">{monthlyStats.regularEvents}</div>
            <div className="text-sm text-blue-700">Eventi Standard</div>
            <div className="text-xs text-blue-600 mt-1">Lavoro esterno</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <Plane className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold text-purple-900">{monthlyStats.travelEvents}</div>
            <div className="text-sm text-purple-700">Eventi Trasferta</div>
            <div className="text-xs text-purple-600 mt-1">Fuori sede con pernottamento</div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">
                <strong>Totale eventi assegnati questo mese:</strong> {monthlyStats.assignedEvents} su {monthlyStats.totalEvents}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Prossimi eventi assegnati:</strong> {monthlyStats.upcomingEvents}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Timesheet Modal */}
      {showTimesheetModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Nuovo Timesheet
              </h3>
              
              <TimesheetModal 
                entry={null}
                isEditing={true}
                currentLocation={null}
                hasMealOptions={true}
                onSave={handleSaveTimesheet}
                onClose={() => setShowTimesheetModal(false)}
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

export default CrewDashboard;