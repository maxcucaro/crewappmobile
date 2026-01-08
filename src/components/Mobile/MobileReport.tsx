import React, { useState, useEffect } from 'react';
import { Calendar, Download, Filter, Building2, Plane, Receipt, Clock, FileText, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/db';
import { CopyrightFooter } from '../UI/CopyrightFooter';
import EventsReport from './Report/EventsReport';
import WarehouseShiftsReport from './Report/WarehouseShiftsReport';
import ExtraShiftsReport from './Report/ExtraShiftsReport';

interface MonthlyReport {
  month: string;
  year: number;
  totalEvents: number;
  totalDays: number;
  totalShifts: number;
  eventsByType: {
    warehouse: number;
    event: number;
    event_travel: number;
  };
  expensesCount: number;
  overtimeHours: number;
  vacationRequested: number;
  vacationRemaining: number;
  leaveRequested: number;
  leaveRemaining: number;
}

const MobileReport: React.FC = () => {
  const { user } = useAuth();
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'warehouse' | 'extra'>('events');

  const pad2 = (n: number) => String(n).padStart(2, '0');

  const toLocalDateStringForSQL = (d: Date) => {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const parseDateOnlyLocal = (isoDate: string): Date => {
    if (!isoDate) return new Date(NaN);
    const parts = isoDate.split('-').map(p => parseInt(p, 10));
    if (parts.length !== 3) return new Date(isoDate);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };

  useEffect(() => {
    if (user?.id) {
      loadMonthlySummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedMonth, selectedYear]);

  const loadMonthlySummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: userData, error: userError } = await supabase
        .from('registration_requests')
        .select(`
          *,
          regaziendasoftware!parent_company_id(ragione_sociale)
        `)
        .eq('auth_user_id', user?.id)
        .single();

      if (userError || !userData) {
        console.error('Errore caricamento profilo:', userError);
        setError('Errore nel caricamento del profilo utente');
        return;
      }

      setUserProfile(userData);

      const startDateObj = new Date(selectedYear, selectedMonth, 1);
      const endDateObj = new Date(selectedYear, selectedMonth + 1, 0);
      const startDate = toLocalDateStringForSQL(startDateObj);
      const endDate = toLocalDateStringForSQL(endDateObj);

      const { data: eventsData } = await supabase
        .from('crew_event_assegnazione')
        .select('evento_id, evento_trasferta, nome_evento, giorno_inizio_evento, giorno_fine_evento')
        .eq('dipendente_freelance_id', user?.id)
        .gte('giorno_inizio_evento', startDate)
        .lte('giorno_inizio_evento', endDate);

      const { data: timesheetData } = await supabase
        .from('timesheet_entries')
        .select('event_id, status, start_time')
        .eq('crew_id', user?.id)
        .gte('date', startDate)
        .lte('date', endDate);

      const activeTimesheets = new Set((timesheetData || [])
        .filter(t => t.start_time && (t.status === 'active' || t.status === 'completed' || t.status === 'submitted'))
        .map(t => t.event_id));

      const eventsByType = { warehouse: 0, event: 0, event_travel: 0 };
      const allCompletedDates: string[] = [];

      (eventsData || []).forEach((event: any) => {
        if (activeTimesheets.has(event.evento_id)) {
          if (event.nome_evento?.toLowerCase().includes('magazzino')) {
            eventsByType.warehouse++;
          } else if (event.evento_trasferta) {
            eventsByType.event_travel++;
          } else {
            eventsByType.event++;
          }

          const startDateLocal = parseDateOnlyLocal(event.giorno_inizio_evento);
          const endDateLocal = parseDateOnlyLocal(event.giorno_fine_evento);
          const currentDate = new Date(startDateLocal);
          while (currentDate <= endDateLocal) {
            allCompletedDates.push(toLocalDateStringForSQL(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      });

      const { data: warehouseShiftsData } = await supabase
        .from('warehouse_checkins')
        .select('id, date, status, check_out_time, overtime_hours')
        .eq('crew_id', user?.id)
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: extraShiftsData } = await supabase
        .from('extra_shifts_checkins')
        .select('id, date, status, check_out_time, overtime_hours')
        .eq('crew_id', user?.id)
        .gte('date', startDate)
        .lte('date', endDate);

      const completedWarehouseShifts = (warehouseShiftsData || []).filter(
        (shift: any) => shift.status === 'completed' && shift.check_out_time
      );

      const completedExtraShifts = (extraShiftsData || []).filter(
        (shift: any) => shift.status === 'completed' && shift.check_out_time
      );

      eventsByType.warehouse += completedWarehouseShifts.length;

      let totalOvertimeHours = 0;
      [...completedWarehouseShifts, ...completedExtraShifts].forEach((shift: any) => {
        totalOvertimeHours += parseFloat(shift.overtime_hours) || 0;
        allCompletedDates.push(shift.date);
      });

      const { data: expenses } = await supabase
        .from('expenses')
        .select('id')
        .eq('crew_id', user?.id)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      const uniqueDates = new Set(allCompletedDates);

      const monthlyReportData: MonthlyReport = {
        month: new Date(selectedYear, selectedMonth).toLocaleDateString('it-IT', { month: 'long' }),
        year: selectedYear,
        totalEvents: (eventsData?.length || 0) + completedWarehouseShifts.length + completedExtraShifts.length,
        totalDays: uniqueDates.size,
        totalShifts: completedWarehouseShifts.length + completedExtraShifts.length,
        eventsByType,
        expensesCount: expenses?.length || 0,
        overtimeHours: totalOvertimeHours,
        vacationRequested: userData.vacation_days_used || 0,
        vacationRemaining: (userData.vacation_days_total || 0) - (userData.vacation_days_used || 0),
        leaveRequested: userData.leave_days_used || 0,
        leaveRemaining: (userData.leave_days_total || 0) - (userData.leave_days_used || 0)
      };

      setMonthlyReport(monthlyReportData);
    } catch (error) {
      console.error('Errore caricamento riepilogo mensile:', error);
      setError(`Errore nel caricamento del riepilogo: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!monthlyReport) return;

    const reportData = {
      dipendente: userProfile?.full_name || 'Dipendente',
      azienda: userProfile?.regaziendasoftware?.ragione_sociale || 'Azienda',
      periodo: `${monthlyReport.month} ${monthlyReport.year}`,
      eventi: monthlyReport.totalEvents
    };

    console.log('Download report:', reportData);
    alert(`Report ${monthlyReport.month} ${monthlyReport.year} generato!`);
  };

  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Caricamento riepilogo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <p className="text-lg text-red-400">Errore nel caricamento</p>
          <p className="text-sm text-gray-300 mt-2">{error}</p>
          <button
            onClick={() => loadMonthlySummary()}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="p-4 pb-20 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Report Mensile</h1>
            <p className="text-gray-300">
              {userProfile?.full_name || 'Dipendente'}
            </p>
            <p className="text-sm text-blue-400">
              {userProfile?.regaziendasoftware?.ragione_sociale || 'La Mia Azienda'}
            </p>
          </div>
          <button
            onClick={handleDownloadReport}
            disabled={!monthlyReport}
            className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-600"
          >
            <Download className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPreviousMonth}
              className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
              <span>Precedente</span>
            </button>

            <div className="text-center">
              <div className="text-lg font-bold text-white capitalize">
                {new Date(selectedYear, selectedMonth).toLocaleDateString('it-IT', { month: 'long' })}
              </div>
              <div className="text-sm text-gray-400">
                {selectedYear}
              </div>
            </div>

            <button
              onClick={goToNextMonth}
              className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <span>Successivo</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="grid grid-cols-3">
            <button
              onClick={() => setActiveTab('events')}
              className={`flex items-center justify-center space-x-2 py-4 px-2 transition-all ${
                activeTab === 'events'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Calendar className="h-5 w-5" />
              <span className="font-semibold text-sm">Eventi</span>
            </button>
            <button
              onClick={() => setActiveTab('warehouse')}
              className={`flex items-center justify-center space-x-2 py-4 px-2 transition-all ${
                activeTab === 'warehouse'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Building2 className="h-5 w-5" />
              <span className="font-semibold text-sm">Turni</span>
            </button>
            <button
              onClick={() => setActiveTab('extra')}
              className={`flex items-center justify-center space-x-2 py-4 px-2 transition-all ${
                activeTab === 'extra'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Plane className="h-5 w-5" />
              <span className="font-semibold text-sm">Extra</span>
            </button>
          </div>
        </div>

        {monthlyReport && (
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Riepilogo {monthlyReport.month} {monthlyReport.year}
            </h3>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-gray-700 rounded-lg">
                <Building2 className="h-5 w-5 mx-auto mb-1 text-gray-400" />
                <div className="text-lg font-bold text-white">{monthlyReport.eventsByType.warehouse}</div>
                <div className="text-xs text-gray-400">Turni Magazzino</div>
              </div>

              <div className="text-center p-3 bg-gray-700 rounded-lg">
                <Calendar className="h-5 w-5 mx-auto mb-1 text-blue-400" />
                <div className="text-lg font-bold text-white">{monthlyReport.eventsByType.event}</div>
                <div className="text-xs text-gray-400">Eventi</div>
              </div>

              <div className="text-center p-3 bg-gray-700 rounded-lg">
                <Plane className="h-5 w-5 mx-auto mb-1 text-orange-400" />
                <div className="text-lg font-bold text-white">{monthlyReport.eventsByType.event_travel}</div>
                <div className="text-xs text-gray-400">Trasferte</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-gray-700 rounded-lg">
                <Calendar className="h-5 w-5 mx-auto mb-1 text-blue-400" />
                <div className="text-lg font-bold text-white">{monthlyReport.totalDays}</div>
                <div className="text-xs text-gray-400">Giorni</div>
              </div>

              <div className="text-center p-3 bg-gray-700 rounded-lg">
                <Receipt className="h-5 w-5 mx-auto mb-1 text-yellow-400" />
                <div className="text-lg font-bold text-white">{monthlyReport.expensesCount}</div>
                <div className="text-xs text-gray-400">Note Spese</div>
              </div>

              <div className="text-center p-3 bg-gray-700 rounded-lg">
                <Clock className="h-5 w-5 mx-auto mb-1 text-green-400" />
                <div className="text-lg font-bold text-white">{monthlyReport.overtimeHours.toFixed(1)}h</div>
                <div className="text-xs text-gray-400">Straordinari</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <EventsReport
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        )}

        {activeTab === 'warehouse' && (
          <WarehouseShiftsReport
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        )}

        {activeTab === 'extra' && (
          <ExtraShiftsReport
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        )}

        {!monthlyReport && !loading && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-semibold text-white mb-2">Nessun Dato Disponibile</h3>
            <p className="text-gray-300">
              Non ci sono eventi per il periodo selezionato.
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Prova a selezionare un mese diverso o attendi nuove assegnazioni.
            </p>
          </div>
        )}

        <CopyrightFooter />
      </div>
    </div>
  );
};

export default MobileReport;
