import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Users, CheckCircle, AlertCircle, XCircle, User, Calendar, RefreshCw } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useCompanyAuth } from '../../context/CompanyAuthContext';

interface WarehouseShift {
  type: 'warehouse';
  id: string;
  employee_id: string;
  employee_name: string;
  warehouse_name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  checkin_time?: string;
  checkout_time?: string;
  status: 'not_started' | 'checked_in' | 'checked_out' | 'late' | 'absent';
  location?: any;
}

interface EventShift {
  type: 'event';
  id: string;
  employee_id: string;
  employee_name: string;
  event_name: string;
  event_location: string;
  shift_date: string;
  convocation_time?: string;
  checkin_time?: string;
  checkout_time?: string;
  status: 'not_started' | 'checked_in' | 'checked_out' | 'late' | 'absent';
}

interface ExtraShift {
  type: 'extra';
  id: string;
  employee_id: string;
  employee_name?: string;
  shift_date: string;
  checkin_time: string;
  checkout_time?: string;
  status: 'checked_in' | 'checked_out';
  warehouse_name?: string;
}

type Shift = WarehouseShift | EventShift | ExtraShift;

const CompanyCheckInMonitor: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const getItalianDate = () => {
    const now = new Date();
    const italianTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
    return italianTime.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(getItalianDate());
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadShiftsData = async () => {
    if (!companyProfile?.id) return;

    try {
      setLoading(true);
      console.log('[CompanyCheckInMonitor] Caricamento turni per data:', selectedDate);
      console.log('[CompanyCheckInMonitor] Data italiana corrente:', getItalianDate());

      const warehouseShifts: WarehouseShift[] = [];
      const eventShifts: EventShift[] = [];
      const extraShifts: ExtraShift[] = [];

      const { data: warehouseAssignments, error: waError } = await supabase
        .from('crew_assegnazione_turni')
        .select('*')
        .eq('azienda_id', companyProfile.id)
        .eq('data_turno', selectedDate);

      if (!waError && warehouseAssignments) {
        const warehouseShiftIds = warehouseAssignments.map(a => a.turno_id);

        const { data: checkins } = await supabase
          .from('warehouse_checkins')
          .select('*')
          .eq('date', selectedDate)
          .in('crew_id', warehouseAssignments.map(a => a.dipendente_id));

        const checkinMap = new Map();
        checkins?.forEach(c => {
          checkinMap.set(c.crew_id, c);
        });

        warehouseAssignments.forEach(assignment => {
          const checkin = checkinMap.get(assignment.dipendente_id);

          const now = new Date();
          const shiftStart = new Date(`${selectedDate}T${assignment.ora_inizio_turno}`);
          const isLate = now > shiftStart && !checkin;

          let status: WarehouseShift['status'] = 'not_started';
          if (checkin?.check_out_time) {
            status = 'checked_out';
          } else if (checkin?.check_in_time) {
            status = 'checked_in';
          } else if (isLate) {
            status = 'late';
          }

          warehouseShifts.push({
            type: 'warehouse',
            id: assignment.id,
            employee_id: assignment.dipendente_id,
            employee_name: assignment.dipendente_nome,
            warehouse_name: assignment.nome_magazzino,
            shift_date: assignment.data_turno,
            start_time: assignment.ora_inizio_turno,
            end_time: assignment.ora_fine_turno,
            checkin_time: checkin?.check_in_time,
            checkout_time: checkin?.check_out_time,
            status,
            location: checkin?.location
          });
        });
      }

      const { data: eventAssignments, error: evError } = await supabase
        .from('crew_event_assegnazione')
        .select('*')
        .eq('azienda_id', companyProfile.id)
        .lte('giorno_inizio_evento', selectedDate)
        .gte('giorno_fine_evento', selectedDate);

      if (!evError && eventAssignments) {
        const { data: timesheets } = await supabase
          .from('timesheet_entries')
          .select('*')
          .eq('date', selectedDate)
          .in('crew_id', eventAssignments.map(a => a.dipendente_freelance_id));

        const timesheetMap = new Map();
        timesheets?.forEach(t => {
          if (!timesheetMap.has(t.crew_id)) {
            timesheetMap.set(t.crew_id, []);
          }
          timesheetMap.get(t.crew_id).push(t);
        });

        eventAssignments.forEach(assignment => {
          const employeeTimesheets = timesheetMap.get(assignment.dipendente_freelance_id) || [];
          const todayTimesheet = employeeTimesheets.find(t => t.date === selectedDate);

          let status: EventShift['status'] = 'not_started';
          if (todayTimesheet) {
            if (todayTimesheet.end_time) {
              status = 'checked_out';
            } else if (todayTimesheet.start_time) {
              status = 'checked_in';
            }
          }

          eventShifts.push({
            type: 'event',
            id: assignment.id,
            employee_id: assignment.dipendente_freelance_id,
            employee_name: assignment.nome_dipendente_freelance,
            event_name: assignment.nome_evento,
            event_location: assignment.evento_localita || 'Non specificato',
            shift_date: selectedDate,
            convocation_time: assignment.orario_convocazione || assignment.evento_orario_convocazione,
            checkin_time: todayTimesheet?.start_time,
            checkout_time: todayTimesheet?.end_time,
            status
          });
        });
      }

      const { data: extraCheckins, error: exError } = await supabase
        .from('extra_shifts_checkins')
        .select(`
          *,
          crew_members (
            full_name,
            first_name,
            last_name,
            company_name
          )
        `)
        .eq('date', selectedDate);

      if (!exError && extraCheckins) {
        console.log('[CompanyCheckInMonitor] Extra checkins trovati:', extraCheckins.length);
        console.log('[CompanyCheckInMonitor] Ragione sociale azienda:', companyProfile.ragione_sociale);

        extraCheckins.forEach((checkin: any) => {
          console.log('[CompanyCheckInMonitor] Checkin:', {
            id: checkin.id,
            crew_id: checkin.crew_id,
            company_name: checkin.crew_members?.company_name,
            matches: checkin.crew_members?.company_name === companyProfile.ragione_sociale
          });

          if (checkin.crew_members?.company_name !== companyProfile.ragione_sociale) {
            return;
          }

          const employeeName = checkin.crew_members?.full_name ||
            `${checkin.crew_members?.first_name || ''} ${checkin.crew_members?.last_name || ''}`.trim() ||
            'Nome non disponibile';

          extraShifts.push({
            type: 'extra',
            id: checkin.id,
            employee_id: checkin.crew_id,
            employee_name: employeeName,
            shift_date: checkin.date,
            checkin_time: checkin.check_in_time,
            checkout_time: checkin.check_out_time,
            status: checkin.check_out_time ? 'checked_out' : 'checked_in',
            warehouse_name: 'Turno Extra'
          });
        });

        console.log('[CompanyCheckInMonitor] Extra shifts aggiunti:', extraShifts.length);
      }

      setShifts([...warehouseShifts, ...eventShifts, ...extraShifts]);
    } catch (error) {
      console.error('Errore caricamento turni:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShiftsData();

    const warehouseChannel = supabase
      .channel('warehouse_checkins_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'warehouse_checkins'
        },
        () => {
          loadShiftsData();
        }
      )
      .subscribe();

    const timesheetChannel = supabase
      .channel('timesheet_entries_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timesheet_entries'
        },
        () => {
          loadShiftsData();
        }
      )
      .subscribe();

    const extraChannel = supabase
      .channel('extra_shifts_checkins_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'extra_shifts_checkins'
        },
        () => {
          loadShiftsData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(warehouseChannel);
      supabase.removeChannel(timesheetChannel);
      supabase.removeChannel(extraChannel);
    };
  }, [companyProfile?.id, selectedDate]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'checked_in':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-900/30 text-green-400 rounded-lg text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Presente
          </span>
        );
      case 'checked_out':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-400 rounded-lg text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Concluso
          </span>
        );
      case 'late':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-orange-900/30 text-orange-400 rounded-lg text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            In Ritardo
          </span>
        );
      case 'not_started':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-400 rounded-lg text-xs font-medium">
            <Clock className="w-3 h-3" />
            Non Iniziato
          </span>
        );
      case 'absent':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-900/30 text-red-400 rounded-lg text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Assente
          </span>
        );
      default:
        return null;
    }
  };

  const filteredShifts = shifts.filter(shift => {
    if (filterStatus === 'all') return true;
    return shift.status === filterStatus;
  });

  const stats = {
    total: shifts.length,
    checked_in: shifts.filter(s => s.status === 'checked_in').length,
    checked_out: shifts.filter(s => s.status === 'checked_out').length,
    late: shifts.filter(s => s.status === 'late').length,
    not_started: shifts.filter(s => s.status === 'not_started').length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      <div className="bg-gradient-to-br from-blue-900 to-gray-900 p-6 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Check-In Monitor</h1>
            <p className="text-gray-300 text-sm mt-1">Monitoraggio presenze in tempo reale</p>
          </div>
          <button
            onClick={loadShiftsData}
            className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            title="Aggiorna"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-gray-400 mt-1">Totale</div>
          </div>
          <div className="bg-green-900/30 rounded-lg p-3 text-center border border-green-700/30">
            <div className="text-2xl font-bold text-green-400">{stats.checked_in}</div>
            <div className="text-xs text-green-300 mt-1">Presenti</div>
          </div>
          <div className="bg-blue-900/30 rounded-lg p-3 text-center border border-blue-700/30">
            <div className="text-2xl font-bold text-blue-400">{stats.checked_out}</div>
            <div className="text-xs text-blue-300 mt-1">Conclusi</div>
          </div>
          <div className="bg-orange-900/30 rounded-lg p-3 text-center border border-orange-700/30">
            <div className="text-2xl font-bold text-orange-400">{stats.late}</div>
            <div className="text-xs text-orange-300 mt-1">Ritardo</div>
          </div>
        </div>

        <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'Tutti' },
            { id: 'checked_in', label: 'Presenti' },
            { id: 'checked_out', label: 'Conclusi' },
            { id: 'late', label: 'Ritardo' },
            { id: 'not_started', label: 'Non iniziati' }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setFilterStatus(filter.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === filter.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {filteredShifts.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Nessun turno trovato per questa data</p>
          </div>
        ) : (
          filteredShifts.map(shift => (
            <div
              key={`${shift.type}-${shift.id}`}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      {shift.type === 'extra' ? (shift as ExtraShift).employee_name : shift.employee_name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {shift.type === 'warehouse' && (shift as WarehouseShift).warehouse_name}
                      {shift.type === 'event' && (shift as EventShift).event_name}
                      {shift.type === 'extra' && (shift as ExtraShift).warehouse_name}
                    </p>
                  </div>
                </div>
                {getStatusBadge(shift.status)}
              </div>

              <div className="space-y-2">
                {shift.type === 'warehouse' && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-300">
                        Orario: {(shift as WarehouseShift).start_time} - {(shift as WarehouseShift).end_time}
                      </span>
                    </div>
                    {shift.checkin_time && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-gray-300">Check-in: {shift.checkin_time}</span>
                      </div>
                    )}
                    {shift.checkout_time && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-blue-400" />
                        <span className="text-gray-300">Check-out: {shift.checkout_time}</span>
                      </div>
                    )}
                  </>
                )}

                {shift.type === 'event' && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-300">{(shift as EventShift).event_location}</span>
                    </div>
                    {(shift as EventShift).convocation_time && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300">
                          Convocazione: {(shift as EventShift).convocation_time}
                        </span>
                      </div>
                    )}
                    {shift.checkin_time && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-gray-300">Inizio: {shift.checkin_time}</span>
                      </div>
                    )}
                    {shift.checkout_time && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-blue-400" />
                        <span className="text-gray-300">Fine: {shift.checkout_time}</span>
                      </div>
                    )}
                  </>
                )}

                {shift.type === 'extra' && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-300 font-medium">Turno straordinario</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-gray-300">Check-in: {(shift as ExtraShift).checkin_time}</span>
                    </div>
                    {(shift as ExtraShift).checkout_time && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-blue-400" />
                        <span className="text-gray-300">
                          Check-out: {(shift as ExtraShift).checkout_time}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CompanyCheckInMonitor;
