import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Building2, Plane, ChevronLeft, ChevronRight, AlertTriangle, FileText, Navigation } from 'lucide-react';

interface EventAssignment {
  id: string;
  evento_id: string;
  nome_evento: string;
  nome_azienda: string;
  giorno_inizio_evento: string;
  giorno_fine_evento: string;
  evento_localita: string;
  evento_indirizzo?: string;
  evento_orario_convocazione?: string;
  evento_descrizione?: string;
  tariffa_evento_assegnata?: number;
  bonus_previsti: number;
  evento_trasferta: boolean;
  bonus_trasferta: boolean;
  bonus_diaria: boolean;
  benefits_evento_ids: string[];
  benefits_evento_nomi: string[];
  benefits_disponibili: any;
  link_scheda_tecnica?: string;
  link_mappa_gps?: string;
}

interface WarehouseShift {
  id: string;
  turno_id: string;
  nome_magazzino: string;
  data_turno: string;
  ora_inizio_turno: string;
  ora_fine_turno: string;
  nome_azienda: string;
  dipendente_nome: string;
  indirizzo_magazzino?: string;
}

interface EventWithBenefits {
  assignment: EventAssignment;
  applicableBenefits: any[];
  totalBenefitsAmount: number;
  benefitDetails: {
    name: string;
    amount: number;
    category: string;
    applied: boolean;
  }[];
}

interface UpcomingEventsProps {
  eventsWithBenefits: EventWithBenefits[];
  warehouseShifts: WarehouseShift[];
}

interface UpcomingItem {
  id: string;
  type: 'event' | 'warehouse';
  title: string;
  companyName: string;
  date: string;
  startTime: string;
  endTime?: string;
  location: string;
  address?: string;
  callTime?: string;
  isTravel?: boolean;
  eventData?: EventAssignment;
  shiftData?: WarehouseShift;
}

const UpcomingEvents: React.FC<UpcomingEventsProps> = ({ eventsWithBenefits, warehouseShifts }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'all' | 'events' | 'warehouse'>('all');

  const formatTime = (timeString: string | null): string => {
    if (!timeString) return 'Non specificato';
    
    if (/^\d{2}:\d{2}$/.test(timeString)) {
      return timeString;
    }
    
    if (/^\d{2}:\d{2}:\d{2}$/.test(timeString)) {
      return timeString.substring(0, 5);
    }
    
    return timeString;
  };

  const getUpcomingItems = (): UpcomingItem[] => {
    const today = new Date();
    const todayString = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().split('T')[0];
    const items: UpcomingItem[] = [];

    // Aggiungi eventi dal mese selezionato
    eventsWithBenefits.forEach(eventWithBenefit => {
      const assignment = eventWithBenefit.assignment;
      const eventDate = new Date(assignment.giorno_inizio_evento);
      
      // Eventi del mese selezionato incluso oggi
      if (eventDate.getMonth() === selectedMonth && 
          eventDate.getFullYear() === selectedYear &&
          assignment.giorno_inizio_evento >= todayString) {
        
        items.push({
          id: assignment.id,
          type: 'event',
          title: assignment.nome_evento,
          companyName: assignment.nome_azienda,
          date: assignment.giorno_inizio_evento,
          startTime: '09:00', // Default per eventi
          endTime: '17:00',
          location: assignment.evento_localita,
          address: assignment.evento_indirizzo,
          callTime: assignment.evento_orario_convocazione,
          isTravel: assignment.evento_trasferta,
          eventData: assignment
        });
      }
    });

    // Aggiungi turni magazzino dal mese selezionato
    warehouseShifts.forEach(shift => {
      const shiftDate = new Date(shift.data_turno);
      
      // Turni del mese selezionato incluso oggi
      if (shiftDate.getMonth() === selectedMonth && 
          shiftDate.getFullYear() === selectedYear &&
          shift.data_turno >= todayString) {
        
        items.push({
          id: shift.id,
          type: 'warehouse',
          title: `Turno ${shift.nome_magazzino}`,
          companyName: shift.nome_azienda,
          date: shift.data_turno,
          startTime: formatTime(shift.ora_inizio_turno),
          endTime: formatTime(shift.ora_fine_turno),
          location: shift.nome_magazzino,
          address: shift.indirizzo_magazzino || 'Indirizzo non disponibile',
          callTime: formatTime(shift.ora_inizio_turno), // Per turni magazzino, orario convocazione = orario inizio
          shiftData: shift
        });
      }
    });

    // Ordina per data cronologica
    return items.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const allItems = getUpcomingItems();

  // Conta elementi per tipo per i badge
  const eventCount = allItems.filter(item => item.type === 'event').length;
  const warehouseCount = allItems.filter(item => item.type === 'warehouse').length;

  // Filtra in base al tab attivo
  const upcomingItems = activeTab === 'all'
    ? allItems
    : activeTab === 'events'
    ? allItems.filter(item => item.type === 'event')
    : allItems.filter(item => item.type === 'warehouse');

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const isCurrentMonth = selectedMonth === currentMonth && selectedYear === currentYear;

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      {/* Header con navigazione mese */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-gray-400" />
        </button>
        
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white">
            I Miei Prossimi Eventi
          </h3>
          <p className="text-sm text-gray-400">
            {monthNames[selectedMonth]} {selectedYear} ({upcomingItems.length})
          </p>
        </div>
        
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {/* Indicatore mese corrente */}
      {isCurrentMonth && (
        <div className="bg-blue-900 border border-blue-700 rounded-lg p-2 mb-4">
          <div className="flex items-center justify-center space-x-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            <span className="text-blue-200 text-sm font-medium">Mese Corrente</span>
          </div>
        </div>
      )}

      {/* Tab Selector */}
      <div className="bg-gray-700 rounded-lg border border-gray-600 overflow-hidden mb-4">
        <div className="grid grid-cols-3">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center justify-center space-x-1 py-3 px-2 transition-all text-sm ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span className="font-semibold">Tutti</span>
            {allItems.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === 'all' ? 'bg-blue-500' : 'bg-gray-600'
              }`}>
                {allItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center justify-center space-x-1 py-3 px-2 transition-all text-sm ${
              activeTab === 'events'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span className="font-semibold">Eventi</span>
            {eventCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === 'events' ? 'bg-blue-500' : 'bg-gray-600'
              }`}>
                {eventCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('warehouse')}
            className={`flex items-center justify-center space-x-1 py-3 px-2 transition-all text-sm ${
              activeTab === 'warehouse'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span className="font-semibold">Turni</span>
            {warehouseCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === 'warehouse' ? 'bg-blue-500' : 'bg-gray-600'
              }`}>
                {warehouseCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Lista eventi e turni */}
      {upcomingItems.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          {activeTab === 'warehouse' ? (
            <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-600" />
          ) : (
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-600" />
          )}
          <p>
            {activeTab === 'all' && 'Nessun evento in programma'}
            {activeTab === 'events' && 'Nessun evento in programma'}
            {activeTab === 'warehouse' && 'Nessun turno magazzino in programma'}
          </p>
          <p className="text-sm mt-1">
            {isCurrentMonth
              ? 'Controlla il calendario per nuove assegnazioni'
              : `Nessun ${activeTab === 'warehouse' ? 'turno' : 'evento'} per ${monthNames[selectedMonth]} ${selectedYear}`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingItems.map((item) => (
            <div key={item.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              {/* Header con tipo e data */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {item.type === 'warehouse' ? (
                    <Building2 className="h-5 w-5 text-purple-400" />
                  ) : item.isTravel ? (
                    <Plane className="h-5 w-5 text-green-400" />
                  ) : (
                    <Calendar className="h-5 w-5 text-blue-400" />
                  )}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.type === 'warehouse' ? 'bg-purple-100 text-purple-800' :
                    item.isTravel ? 'bg-green-100 text-green-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {item.type === 'warehouse' ? 'Turno Magazzino' :
                     item.isTravel ? 'Evento Trasferta' : 'Evento'}
                  </span>
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-bold text-white">
                    {new Date(item.date).toLocaleDateString('it-IT', { 
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}
                  </div>
                </div>
              </div>

              {/* Titolo e azienda */}
              <div className="mb-3">
                <h4 className="font-bold text-white text-lg">{item.title}</h4>
                {item.shiftData && (
                  <p className="text-xs text-purple-300 font-medium">
                    {item.shiftData.nome_turno || 'Turno Standard'}
                  </p>
                )}
              </div>

              {/* Orario principale (convocazione o turno) */}
              <div className="bg-gray-800 rounded-lg p-3 mb-3">
                <div className="flex items-center space-x-2 mb-1">
                  <Clock className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">
                    {item.type === 'warehouse' ? 'Orario Turno' : 'Orario Convocazione'}
                  </span>
                </div>
                <div className="text-white">
                  {item.callTime ? (
                    <p className="text-xl font-bold text-green-200">{item.callTime}</p>
                  ) : (
                    <p className="text-sm text-orange-300">
                      ⚠️ Orario non disponibile - Contatta l'azienda
                    </p>
                  )}
                  
                  {item.type === 'warehouse' && item.endTime && (
                    <p className="text-sm text-gray-300 mt-1">
                      Turno: {item.startTime} - {item.endTime}
                    </p>
                  )}
                </div>
              </div>

              {/* Località */}
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-medium text-cyan-400">Località</span>
                </div>
                <div className="text-white">
                  {item.type === 'warehouse' ? (
                    // Per turni magazzino mostra nome magazzino e indirizzo
                    <>
                      <p className="text-sm font-medium">{item.location}</p>
                      <p className="text-xs text-gray-300 mt-1">
                        {item.address || 'Indirizzo non disponibile'}
                      </p>
                    </>
                  ) : (
                    // Per eventi mostra la località
                    <>
                      {item.location ? (
                        <p className="text-sm font-medium">{item.location}</p>
                      ) : (
                        <p className="text-sm text-gray-400">Località non specificata</p>
                      )}
                      {item.address && (
                        <p className="text-xs text-gray-300 mt-1">{item.address}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Pulsanti Scheda Tecnica e Mappa GPS - Solo per Eventi */}
              {item.type === 'event' && item.eventData && (item.eventData.link_scheda_tecnica || item.eventData.link_mappa_gps) && (
                <div className="mt-3 flex gap-3">
                  {item.eventData.link_scheda_tecnica && (
                    <a
                      href={item.eventData.link_scheda_tecnica}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <FileText className="h-5 w-5" />
                      <span>SCHEDA LAVORO</span>
                    </a>
                  )}
                  {item.eventData.link_mappa_gps && (
                    <a
                      href={item.eventData.link_mappa_gps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Navigation className="h-5 w-5" />
                      <span>MAPPA</span>
                    </a>
                  )}
                </div>
              )}

              {/* Indicatore giorni rimanenti */}
              <div className="mt-3 text-center">
                {(() => {
                  const eventDate = new Date(item.date + 'T00:00:00');
                  const now = new Date();
                  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const diffTime = eventDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  if (diffDays === 0) {
                    return (
                      <span className="inline-flex px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800">
                        OGGI
                      </span>
                    );
                  } else if (diffDays === 1) {
                    return (
                      <span className="inline-flex px-3 py-1 rounded-full text-sm font-bold bg-orange-100 text-orange-800">
                        DOMANI
                      </span>
                    );
                  } else if (diffDays <= 7) {
                    return (
                      <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        Tra {diffDays} giorni
                      </span>
                    );
                  } else {
                    return (
                      <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        {diffDays} giorni
                      </span>
                    );
                  }
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info navigazione */}
      <div className="mt-4 pt-3 border-t border-gray-600">
        <div className="flex items-center justify-center space-x-4 text-xs text-gray-400">
          <div className="flex items-center space-x-1">
            <Building2 className="h-3 w-3" />
            <span>Turni</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>Eventi Standard</span>
          </div>
          <div className="flex items-center space-x-1">
            <Plane className="h-3 w-3" />
            <span>Eventi Trasferta</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpcomingEvents;