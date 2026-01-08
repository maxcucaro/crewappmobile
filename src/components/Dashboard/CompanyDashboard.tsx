import React, { useState } from 'react';
import { Calendar, Users, DollarSign, FileText, TrendingUp, Clock, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

const CompanyDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToastContext();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCrewAssigned, setTotalCrewAssigned] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [showEventModal, setShowEventModal] = useState(false);
  
  // Carica dati reali dal database
  React.useEffect(() => {
    if (user?.id) {
      loadDashboardData();
    }
  }, [user?.id]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Caricamento dati dashboard per azienda:', user?.id);
      
      // Carica eventi dell'azienda
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('company_id', user?.id)
        .order('start_date', { ascending: true });
      
      if (eventsError) {
        console.error('Errore nel caricamento eventi:', eventsError);
        setEvents([]);
      } else {
        console.log('✅ Eventi caricati:', eventsData?.length || 0);
        setEvents(eventsData || []);
      }
      
      // Carica crew assegnati
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('event_crew_assignments')
        .select('*');
      
      if (!assignmentsError && assignmentsData) {
        // Filtra solo le assegnazioni per eventi di questa azienda
        const companyAssignments = [];
        for (const assignment of assignmentsData) {
          const { data: eventData } = await supabase
            .from('events')
            .select('company_id')
            .eq('id', assignment.event_id)
            .eq('company_id', user?.id)
            .maybeSingle();
          
          if (eventData) {
            companyAssignments.push(assignment);
          }
        }
        
        console.log('✅ Crew assegnati:', companyAssignments.length);
        setTotalCrewAssigned(companyAssignments.length);
      } else {
        console.error('Errore caricamento assegnazioni:', assignmentsError);
        setTotalCrewAssigned(0);
      }
      
      // Carica note spese pending
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('status', 'pending');
      
      if (!expensesError && expensesData) {
        // Filtra solo le spese per eventi di questa azienda
        const companyExpenses = [];
        for (const expense of expensesData) {
          const { data: eventData } = await supabase
            .from('events')
            .select('company_id')
            .eq('id', expense.event_id)
            .eq('company_id', user?.id)
            .maybeSingle();
          
          if (eventData) {
            companyExpenses.push(expense);
          }
        }
        
        console.log('✅ Note spese pending:', companyExpenses.length);
        setTotalExpenses(companyExpenses.length);
      } else {
        console.error('Errore caricamento spese:', expensesError);
        setTotalExpenses(0);
      }
      
    } catch (error) {
      console.error('Errore nel caricamento dati dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcola statistiche dai dati reali
  const today = new Date();
  const todayString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  const activeEvents = events.filter(e => 
    e.status === 'published' || e.status === 'in_progress'
  ).length;
  
  const monthlyEvents = events.filter(e => {
    const eventDate = new Date(e.start_date);
    return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
  }).length;
  
  const upcomingEvents = events.filter(e => {
    // Include eventi che sono ancora in corso o iniziano in futuro
    // Un evento è "upcoming" se:
    // 1. Inizia oggi o in futuro, OPPURE
    // 2. È ancora in corso (data fine >= oggi)
    // 3. È confermato (is_confirmed = true)
    const eventStartDate = e.start_date;
    const eventEndDate = e.end_date;
    const isOngoing = eventEndDate >= todayString; // Evento ancora in corso
    const isUpcoming = eventStartDate >= todayString; // Evento futuro
    const isActiveStatus = e.status === 'published' || e.status === 'in_progress';
    const isConfirmed = e.is_confirmed; // Solo eventi confermati
    
    return (isOngoing || isUpcoming) && isActiveStatus && isConfirmed;
  }).slice(0, 5); // Mostra solo i prossimi 5
  
  const stats = [
    {
      title: 'Eventi Attivi',
      value: activeEvents.toString(),
      change: activeEvents > 0 ? `${monthlyEvents} questo mese` : 'Nessun evento attivo',
      icon: Calendar,
      color: 'bg-blue-500'
    },
    {
      title: 'Crew Assegnati',
      value: totalCrewAssigned.toString(),
      change: totalCrewAssigned > 0 ? `${totalCrewAssigned} assegnazioni attive` : 'Nessun crew assegnato',
      icon: Users,
      color: 'bg-green-500'
    },
    {
      title: 'Eventi Questo Mese',
      value: monthlyEvents.toString(),
      change: monthlyEvents > 0 ? `${monthlyEvents} eventi in programma` : 'Nessun evento questo mese',
      icon: DollarSign,
      color: 'bg-purple-500'
    },
    {
      title: 'Note Spese Pending',
      value: totalExpenses.toString(),
      change: totalExpenses > 0 ? `${totalExpenses} da approvare` : 'Nessuna nota spesa',
      icon: FileText,
      color: 'bg-orange-500'
    }
  ];

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'warehouse': return 'Turno Magazzino';
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

  const handleCreateEvent = () => {
    setShowEventModal(true);
  };

  const handleSaveEvent = async (eventData: any) => {
    try {
      const newEventData = {
        id: uuidv4(),
        company_id: user?.id,
        title: eventData.title,
        description: eventData.description || '',
        type: eventData.type,
        start_date: eventData.startDate,
        end_date: eventData.endDate,
        location: eventData.location,
        required_crew: eventData.requiredCrew,
        status: 'draft',
        visibility: eventData.visibility || 'public',
        is_confirmed: false
      };
      
      const { data, error } = await supabase
        .from('crew_events')
        .insert(newEventData)
        .select()
        .single();
      
      if (error) throw error;
      
      // Ricarica i dati della dashboard
      await loadDashboardData();
      setShowEventModal(false);
      showSuccess('Evento Creato', 'Il nuovo evento è stato creato con successo');
      
    } catch (error) {
      console.error('Errore nel salvataggio evento:', error);
      showError('Errore Creazione', 'Si è verificato un errore durante la creazione dell\'evento');
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Azienda</h1>
          <p className="text-gray-600">Panoramica dei tuoi eventi e crew</p>
        </div>
        <button
          onClick={handleCreateEvent}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Calendar className="h-5 w-5" />
          <span>Nuovo Evento</span>
        </button>
      </div>

      {/* Stats Grid */}
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

      {/* Upcoming Events */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Prossimi Eventi</h3>
        {upcomingEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Nessun evento in programma</p>
            <p className="text-sm mt-1">Crea il tuo primo evento per iniziare</p>
            <button
              onClick={handleCreateEvent}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Crea Primo Evento
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingEvents.map((event, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{event.title}</h4>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm text-gray-500 flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(event.start_date).toLocaleDateString('it-IT')}
                        {event.start_date !== event.end_date && 
                          ` - ${new Date(event.end_date).toLocaleDateString('it-IT')}`}
                      </p>
                      <p className="text-sm text-gray-500">{event.location || 'Località da definire'}</p>
                      <p className="text-sm text-gray-500 flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        {event.required_crew || 0} crew richiesti
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEventTypeColor(event.type)}`}>
                    {getEventTypeLabel(event.type)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {upcomingEvents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 text-center">
            <Link
              to="/company/events"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Visualizza tutti gli eventi →
            </Link>
          </div>
        )}
      </div>

      {/* Event Creation Modal */}
      {showEventModal && (
        <EventModal
          onSave={handleSaveEvent}
          onClose={() => setShowEventModal(false)}
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

// Event Modal Component
interface EventModalProps {
  onSave: (eventData: any) => void;
  onClose: () => void;
}

const EventModal: React.FC<EventModalProps> = ({ onSave, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'event',
    startDate: '',
    endDate: '',
    location: '',
    requiredCrew: 1,
    visibility: 'public'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Nuovo Evento</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Titolo</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="es. Fiera del Mobile Milano"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Descrizione</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder="Descrizione dell'evento..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo Evento</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="warehouse">Magazzino</option>
                  <option value="event">Evento</option>
                  <option value="event_travel">Evento con Trasferta</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Visibilità</label>
                <select
                  value={formData.visibility}
                  onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="public">🌍 Pubblico - Visibile a tutti i freelance</option>
                  <option value="private">🏢 Privato - Solo i miei dipendenti</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Crew Richiesti</label>
                <input
                  type="number"
                  value={formData.requiredCrew}
                  onChange={(e) => setFormData({ ...formData, requiredCrew: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  min="1"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Data Inizio</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Data Fine</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Località</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="es. Milano, Fiera Rho"
                  required
                />
              </div>
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
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Crea Evento
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
export default CompanyDashboard;