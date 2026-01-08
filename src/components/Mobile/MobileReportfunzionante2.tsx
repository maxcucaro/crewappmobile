import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Clock, FileText, Download, Filter, Building2, Plane, Gift, Euro, CheckCircle, AlertTriangle, Star, MapPin, Receipt, Palmtree, Coffee, CreditCard as Edit, Utensils } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/db';
import { CopyrightFooter } from '../UI/CopyrightFooter';
import ShiftActions from './Report/ShiftActions';
import RectifyTimeModal from './Report/RectifyTimeModal';
import EventShiftCard from './Report/EventShiftCard';

interface CompletedShift {
  id: string;
  turno_id: string;
  warehouse_id?: string;
  giorno_turno: string;
  nome_turno: string;
  check_in_turno: string;
  check_out_turno: string;
  conteggio_ore: number;
  buoni_pasto_assegnato: boolean;
  pasto_aziendale_usufruito: boolean;
  ore_straordinario?: number;
  ore_previste?: number;
  pausa_pranzo?: boolean;
  status?: string;
  is_rectified?: boolean;
  rectification_note?: string | null;
  original_check_in?: string;
  original_check_out?: string;
  original_pausa_pranzo?: boolean;
  rectified_check_in?: string;
  rectified_check_out?: string;
  rectified_pausa_pranzo?: boolean;
  auto_checkout?: boolean;
}

interface EventReport {
  assignment: {
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
  };
  timesheet?: {
    id: string;
    start_time: string;
    end_time?: string;
    status: string;
    total_hours?: number;
    meal_voucher?: boolean;
    meal_voucher_amount?: number;
    company_meal?: boolean;
    company_meal_cost?: number;
    diaria_type?: string;
    diaria_amount?: number;
    other_benefits_amount?: number;
    total_benefits?: number;
    is_rectified?: boolean;
    rectification_notes?: string;
    original_start_time?: string;
    original_end_time?: string;
    rectified_start_time?: string;
    rectified_end_time?: string;
    convocation_start_time?: string;
    convocation_end_time?: string;
  };
  applicableBenefits: {
    id: string;
    nome_tariffa: string;
    categoria: string;
    importo: number;
    applied: boolean;
  }[];
  totalBenefitsAmount: number;
  totalEventAmount: number;
  benefitBreakdown: {
    name: string;
    amount: number;
    category: string;
    applied: boolean;
    reason?: string;
  }[];
}

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
  const [eventReports, setEventReports] = useState<EventReport[]>([]);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedShifts, setCompletedShifts] = useState<CompletedShift[]>([]);
  const [filteredShifts, setFilteredShifts] = useState<CompletedShift[]>([]);
  const [rectifyModalOpen, setRectifyModalOpen] = useState(false);
  const [selectedEventForRectify, setSelectedEventForRectify] = useState<EventReport | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'warehouse'>('events');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);

  // --- Helpers to avoid timezone shifts
  const pad2 = (n: number) => String(n).padStart(2, '0');

  // format local Date to 'YYYY-MM-DD' (local timezone)
  const toLocalDateStringForSQL = (d: Date) => {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  // parse 'YYYY-MM-DD' into a Date in local timezone (avoid Date('YYYY-MM-DD') which is parsed as UTC)
  const parseDateOnlyLocal = (isoDate: string): Date => {
    if (!isoDate) return new Date(NaN);
    const parts = isoDate.split('-').map(p => parseInt(p, 10));
    if (parts.length !== 3) return new Date(isoDate); // fallback
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };

  useEffect(() => {
    if (user?.id) {
      loadReportData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedMonth, selectedYear]);

  // Carica lista magazzini
  useEffect(() => {
    const loadWarehouses = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('warehouse_checkins')
          .select('warehouse_id')
          .eq('crew_id', user.id)
          .not('warehouse_id', 'is', null);

        if (error) throw error;

        const uniqueWarehouseIds = Array.from(new Set(data?.map(item => item.warehouse_id)));
        const uniqueWarehouses = uniqueWarehouseIds.map((id, index) => ({
          id,
          name: `Magazzino ${index + 1}`
        }));

        setWarehouses(uniqueWarehouses);
      } catch (err) {
        console.error('Errore caricamento magazzini:', err);
      }
    };

    loadWarehouses();
  }, [user?.id]);

  // Filtra turni in base a data e magazzino selezionati
  useEffect(() => {
    let filtered = [...completedShifts];

    if (selectedDate) {
      filtered = filtered.filter(shift => shift.giorno_turno === selectedDate);
    }

    if (selectedWarehouse !== 'all') {
      filtered = filtered.filter(shift => shift.warehouse_id === selectedWarehouse);
    }

    setFilteredShifts(filtered);
  }, [completedShifts, selectedDate, selectedWarehouse]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 Caricamento report per user:', user?.id);
      console.log('📅 Periodo:', { month: selectedMonth + 1, year: selectedYear });

      // 1. Carica profilo dipendente
      const { data: userData, error: userError } = await supabase
        .from('registration_requests')
        .select(`
          *,
          regaziendasoftware!parent_company_id(ragione_sociale)
        `)
        .eq('auth_user_id', user?.id)
        .single();

      if (userError || !userData) {
        console.error('❌ Errore caricamento profilo:', userError);
        setError('Errore nel caricamento del profilo utente');
        return;
      }

      setUserProfile(userData);
      console.log('✅ Profilo caricato:', userData.full_name);

      // 2. Calcolo start/end date usando data locale (evita toISOString che sposta l'ora a UTC)
      const startDateObj = new Date(selectedYear, selectedMonth, 1); // local midnight
      const endDateObj = new Date(selectedYear, selectedMonth + 1, 0); // last day local
      const startDate = toLocalDateStringForSQL(startDateObj);
      const endDate = toLocalDateStringForSQL(endDateObj);

      console.log('⏱ Intervallo locale usato per query:', { startDate, endDate });

      // 3. Carica eventi del mese selezionato
      const { data: eventsData, error: eventsError } = await supabase
        .from('crew_event_assegnazione')
        .select('*')
        .eq('dipendente_freelance_id', user?.id)
        .gte('giorno_inizio_evento', startDate)
        .lte('giorno_inizio_evento', endDate)
        .order('giorno_inizio_evento', { ascending: true });

      if (eventsError) {
        console.error('❌ Errore caricamento eventi mese:', eventsError);
        setError('Errore nel caricamento degli eventi del mese');
        return;
      }

      console.log('📅 Eventi del mese trovati:', eventsData?.length || 0);

      // 4. Carica tariffe del dipendente
      const { data: employeeRatesData, error: employeeRatesError } = await supabase
        .from('crew_assegnazionetariffa')
        .select('tariffe_ids')
        .eq('dipendente_id', user?.id)
        .eq('attivo', true);

      if (employeeRatesError) {
        console.error('❌ Errore caricamento tariffe dipendente:', employeeRatesError);
        setError('Errore nel caricamento delle tariffe del dipendente');
        return;
      }

      console.log('💰 Assegnazioni tariffe trovate:', employeeRatesData?.length || 0);

      const employeeBenefits: { [id: string]: any } = {};
      if (employeeRatesData && employeeRatesData.length > 0) {
        const allTariffeIds: string[] = [];
        employeeRatesData.forEach(assignment => {
          if (assignment.tariffe_ids && assignment.tariffe_ids.length > 0) {
            allTariffeIds.push(...assignment.tariffe_ids);
          }
        });

        console.log('🔍 ID tariffe da caricare:', allTariffeIds);

        if (allTariffeIds.length > 0) {
          const { data: tariffeData, error: tariffeError } = await supabase
            .from('crew_tariffe')
            .select('*')
            .in('id', allTariffeIds)
            .eq('attivo', true);

          if (tariffeError) {
            console.error('❌ Errore caricamento dettagli tariffe:', tariffeError);
            setError('Errore nel caricamento dei dettagli delle tariffe');
            return;
          }

          console.log('✅ Tariffe caricate:', tariffeData?.length || 0);
          tariffeData?.forEach(tariffa => {
            employeeBenefits[tariffa.id] = {
              id: tariffa.id,
              nome_tariffa: tariffa.nome_tariffa,
              categoria: tariffa.categoria,
              tipo_calcolo: tariffa.tipo_calcolo,
              importo: tariffa.importo,
              attivo: tariffa.attivo
            };
          });
        }
      }

      console.log('💰 Benefit dipendente disponibili:', Object.keys(employeeBenefits).length);

      // 5. Carica timesheet entries del mese con i benefit e campi rettifica
      const { data: timesheetData, error: timesheetError } = await supabase
        .from('timesheet_entries')
        .select(`
          id,
          crew_id,
          event_id,
          date,
          start_time,
          end_time,
          total_hours,
          status,
          meal_voucher,
          meal_voucher_amount,
          company_meal,
          company_meal_cost,
          diaria_type,
          diaria_amount,
          other_benefits_amount,
          total_benefits,
          is_rectified,
          rectification_notes,
          rectified_by,
          rectified_at,
          original_start_time,
          original_end_time,
          rectified_start_time,
          rectified_end_time,
          convocation_start_time,
          convocation_end_time
        `)
        .eq('crew_id', user?.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (timesheetError) {
        console.error('❌ Errore caricamento timesheet:', timesheetError);
      }

      console.log('📋 Timesheet entries trovati:', timesheetData?.length || 0);

      const timesheetByEvent: { [eventId: string]: any } = {};
      timesheetData?.forEach(entry => {
        timesheetByEvent[entry.event_id] = entry;
      });

      // 6. Inizializza array turni completati
      let shiftsWithScheduledHours: CompletedShift[] = [];

      // 7. Calcola report per ogni evento
      const reports: EventReport[] = [];
      let totalBaseAmount = 0;
      let totalBenefitsAmount = 0;
      let totalOvertimeHours = 0;
      const eventsByType = { warehouse: 0, event: 0, event_travel: 0 };
      const benefitsByCategory: { [category: string]: { count: number; amount: number } } = {};
      const allCompletedDates: string[] = []; // Array per tracciare tutte le date di eventi/turni completati

      for (const assignment of eventsData || []) {
        console.log(`\n🎭 CALCOLO REPORT EVENTO: "${assignment.nome_evento}"`);

        const applicableBenefits: any[] = [];
        const benefitBreakdown: any[] = [];
        let eventBenefitsAmount = 0;

        if (assignment.benefits_evento_ids && assignment.benefits_evento_ids.length > 0) {
          assignment.benefits_evento_ids.forEach((benefitId: string) => {
            const matchingBenefit = employeeBenefits[benefitId];

            if (matchingBenefit) {
              applicableBenefits.push({
                id: matchingBenefit.id,
                nome_tariffa: matchingBenefit.nome_tariffa,
                categoria: matchingBenefit.categoria,
                importo: matchingBenefit.importo,
                applied: true
              });
              eventBenefitsAmount += matchingBenefit.importo;

              if (!benefitsByCategory[matchingBenefit.categoria]) {
                benefitsByCategory[matchingBenefit.categoria] = { count: 0, amount: 0 };
              }
              benefitsByCategory[matchingBenefit.categoria].count++;
              benefitsByCategory[matchingBenefit.categoria].amount += matchingBenefit.importo;

              benefitBreakdown.push({
                name: matchingBenefit.nome_tariffa,
                amount: matchingBenefit.importo,
                category: matchingBenefit.categoria,
                applied: true
              });

              console.log(`✅ BENEFIT APPLICATO: ${matchingBenefit.nome_tariffa} = €${matchingBenefit.importo}`);
            } else {
              benefitBreakdown.push({
                name: `Benefit ID: ${benefitId}`,
                amount: 0,
                category: 'non_disponibile',
                applied: false,
                reason: 'Benefit non presente nel contratto del dipendente'
              });
              console.log(`❌ BENEFIT NON APPLICABILE: ID ${benefitId}`);
            }
          });
        }

        if (assignment.bonus_trasferta && assignment.evento_trasferta) {
          const trasfertaBenefit = Object.values(employeeBenefits).find((b: any) => 
            b.categoria === 'indennita_trasferta' || 
            b.nome_tariffa.toLowerCase().includes('trasferta')
          );
          
          if (trasfertaBenefit && !applicableBenefits.find(b => b.id === trasfertaBenefit.id)) {
            applicableBenefits.push({
              id: trasfertaBenefit.id,
              nome_tariffa: trasfertaBenefit.nome_tariffa,
              categoria: trasfertaBenefit.categoria,
              importo: trasfertaBenefit.importo,
              applied: true
            });
            eventBenefitsAmount += trasfertaBenefit.importo;
            
            if (!benefitsByCategory[trasfertaBenefit.categoria]) {
              benefitsByCategory[trasfertaBenefit.categoria] = { count: 0, amount: 0 };
            }
            benefitsByCategory[trasfertaBenefit.categoria].count++;
            benefitsByCategory[trasfertaBenefit.categoria].amount += trasfertaBenefit.importo;
            
            console.log(`✅ BONUS TRASFERTA: ${trasfertaBenefit.nome_tariffa} = €${trasfertaBenefit.importo}`);
          }
        }

        if (assignment.bonus_previsti && assignment.bonus_previsti > 0) {
          eventBenefitsAmount += assignment.bonus_previsti;
          benefitBreakdown.push({
            name: 'Bonus Evento Fisso',
            amount: assignment.bonus_previsti,
            category: 'bonus_evento',
            applied: true
          });
          console.log(`✅ BONUS FISSO EVENTO: €${assignment.bonus_previsti}`);
        }

        const baseAmount = assignment.tariffa_evento_assegnata || 0;
        const totalEventAmount = baseAmount + eventBenefitsAmount;
        
        totalBaseAmount += baseAmount;
        totalBenefitsAmount += eventBenefitsAmount;

        const timesheet = timesheetByEvent[assignment.evento_id];

        const hasCheckedIn = timesheet && timesheet.start_time;
        const isEventActive = hasCheckedIn && (timesheet.status === 'active' || timesheet.status === 'completed' || timesheet.status === 'submitted');

        if (isEventActive) {
          if (assignment.nome_evento.toLowerCase().includes('magazzino')) {
            eventsByType.warehouse++;
          } else if (assignment.evento_trasferta) {
            console.log('✈️ EVENTO TRASFERTA TROVATO:', {
              nome: assignment.nome_evento,
              evento_trasferta: assignment.evento_trasferta,
              hasCheckedIn: hasCheckedIn,
              status: timesheet?.status,
              id: assignment.id
            });
            eventsByType.event_travel++;
          } else {
            eventsByType.event++;
          }

          // Use local parsing for date-only strings and push 'YYYY-MM-DD' local form
          const startDateLocal = parseDateOnlyLocal(assignment.giorno_inizio_evento);
          const endDateLocal = parseDateOnlyLocal(assignment.giorno_fine_evento);
          const currentDate = new Date(startDateLocal);
          while (currentDate <= endDateLocal) {
            allCompletedDates.push(toLocalDateStringForSQL(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }

        reports.push({
          assignment,
          timesheet: timesheet ? {
            id: timesheet.id,
            start_time: timesheet.start_time,
            end_time: timesheet.end_time,
            status: timesheet.status,
            total_hours: timesheet.total_hours,
            meal_voucher: timesheet.meal_voucher,
            meal_voucher_amount: timesheet.meal_voucher_amount,
            company_meal: timesheet.company_meal,
            company_meal_cost: timesheet.company_meal_cost,
            diaria_type: timesheet.diaria_type,
            diaria_amount: timesheet.diaria_amount,
            other_benefits_amount: timesheet.other_benefits_amount,
            total_benefits: timesheet.total_benefits,
            is_rectified: timesheet.is_rectified,
            rectification_notes: timesheet.rectification_notes,
            original_start_time: timesheet.original_start_time,
            original_end_time: timesheet.original_end_time,
            rectified_start_time: timesheet.rectified_start_time,
            rectified_end_time: timesheet.rectified_end_time,
            convocation_start_time: timesheet.convocation_start_time,
            convocation_end_time: timesheet.convocation_end_time
          } : undefined,
          applicableBenefits,
          totalBenefitsAmount: eventBenefitsAmount,
          totalEventAmount,
          benefitBreakdown
        });

        console.log(`💰 TOTALE EVENTO "${assignment.nome_evento}": €${totalEventAmount} (base: €${baseAmount} + benefit: €${eventBenefitsAmount})`);
      }

      setEventReports(reports);

      // 7. Carica turni (completati + in corso)
      const { data: allShiftsData, error: shiftsError } = await supabase
        .from('warehouse_checkins')
        .select('*')
        .eq('crew_id', user?.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (shiftsError) {
        console.error('❌ Errore caricamento turni:', shiftsError);
      } else {
        console.log('✅ Turni trovati:', allShiftsData?.length || 0);

        const allShifts = allShiftsData?.map(shift => {
          const checkInTime = shift.rectified_check_in_time || shift.check_in_time;
          const checkOutTime = shift.rectified_check_out_time || shift.check_out_time;
          const totalHours = shift.rectified_total_hours || parseFloat(shift.total_hours) || 0;
          const pausaPranzo = shift.rectified_pausa_pranzo !== null ? shift.rectified_pausa_pranzo : (shift.pausa_pranzo || false);

          return {
            id: shift.id,
            turno_id: shift.shift_id || '',
            warehouse_id: shift.warehouse_id || '',
            giorno_turno: shift.date,
            nome_turno: shift.warehouse_name || 'Turno Magazzino',
            check_in_turno: checkInTime,
            check_out_turno: checkOutTime,
            conteggio_ore: totalHours,
            buoni_pasto_assegnato: shift.meal_voucher || false,
            pasto_aziendale_usufruito: shift.company_meal || false,
            ore_straordinario: parseFloat(shift.overtime_hours) || 0,
            ore_previste: 8,
            pausa_pranzo: pausaPranzo,
            status: shift.status,
            is_rectified: shift.rectified_at ? true : false,
            rectification_note: shift.rectification_note || null,
            original_check_in: shift.check_in_time,
            original_check_out: shift.check_out_time,
            original_pausa_pranzo: shift.pausa_pranzo || false,
            rectified_check_in: shift.rectified_check_in_time,
            rectified_check_out: shift.rectified_check_out_time,
            rectified_pausa_pranzo: shift.rectified_pausa_pranzo,
            auto_checkout: shift.auto_checkout || false
          };
        }) || [];

        setCompletedShifts(allShifts);

        shiftsWithScheduledHours = allShifts.filter(shift =>
          shift.status === 'completed' && shift.check_out_turno
        );

        console.log('📋 Turni totali:', allShifts.length);
        console.log('📋 Turni completati:', shiftsWithScheduledHours.length);

        const warehouseShiftsCount = shiftsWithScheduledHours.length;
        eventsByType.warehouse += warehouseShiftsCount;

        shiftsWithScheduledHours.forEach(shift => {
          totalOvertimeHours += shift.ore_straordinario || 0;
          // push using local date formatting to avoid timezone shifts
          allCompletedDates.push(shift.giorno_turno);
        });

        console.log(`📅 Turni magazzino completati: ${shiftsWithScheduledHours.length}`);
      }

      // 8. Carica note spese del mese
      let expensesCount = 0;
      try {
        const { data: expenses, error: expensesError } = await supabase
          .from('expenses')
          .select('id')
          .eq('crew_id', user?.id)
          .gte('expense_date', startDate)
          .lte('expense_date', endDate);

        if (expensesError) throw expensesError;
        expensesCount = expenses?.length || 0;
      } catch (err) {
        console.error('❌ Errore caricamento note spese:', err);
      }

      // 9. Carica ferie e permessi del profilo utente
      let vacationRequested = 0;
      let vacationRemaining = 0;
      let leaveRequested = 0;
      let leaveRemaining = 0;

      if (userProfile) {
        vacationRequested = userProfile.vacation_days_used || 0;
        vacationRemaining = (userProfile.vacation_days_total || 0) - vacationRequested;
        leaveRequested = userProfile.leave_days_used || 0;
        leaveRemaining = (userProfile.leave_days_total || 0) - leaveRequested;
      }

      // 9.5 Calcola giorni unici totali (eventi + turni magazzino)
      const uniqueDates = new Set(allCompletedDates);
      const totalDays = uniqueDates.size;
      console.log(`📅 Giorni lavorati unici totali: ${totalDays} (da ${allCompletedDates.length} date totali)`);

      // 10. Crea report mensile (DOPO aver caricato tutti i dati)
      const monthlyReportData: MonthlyReport = {
        month: new Date(selectedYear, selectedMonth).toLocaleDateString('it-IT', { month: 'long' }),
        year: selectedYear,
        totalEvents: reports.length + shiftsWithScheduledHours.length,
        totalDays,
        totalShifts: shiftsWithScheduledHours.length,
        eventsByType,
        expensesCount,
        overtimeHours: totalOvertimeHours,
        vacationRequested,
        vacationRemaining,
        leaveRequested,
        leaveRemaining
      };

      setMonthlyReport(monthlyReportData);

      console.log('📊 REPORT MENSILE COMPLETO:', monthlyReportData);
      console.log('📦 Turni magazzino conteggiati:', eventsByType.warehouse);
      console.log('✈️ EVENTI TRASFERTA CONTEGGIATI:', eventsByType.event_travel);
      console.log('📅 EVENTI STANDARD CONTEGGIATI:', eventsByType.event);

    } catch (error) {
      console.error('❌ Errore generale caricamento report:', error);
      setError(`Errore nel caricamento del report: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string | null): string => {
    if (!timeString) return 'Non specificato';

    if (/^\d{2}:\d{2}$/.test(timeString)) {
      return timeString;
    }

    if (/^\d{2}:\d{2}:\d{2}$/.test(timeString)) {
      return timeString.substring(0, 5);
    }

    try {
      const date = new Date(timeString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (e) {
      console.error('Errore parsing timestamp:', e);
    }

    return timeString;
  };

  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      'indennita_trasferta': 'Indennità Trasferta',
      'bonus_responsabile': 'Bonus Responsabile',
      'bonus_autista': 'Bonus Autista',
      'straordinario_festivo': 'Straordinario Festivo',
      'straordinario_notturno': 'Straordinario Notturno',
      'rimborso_chilometrico': 'Rimborso Chilometrico',
      'altro': 'Altro',
      'bonus_evento': 'Bonus Evento',
      'non_disponibile': 'Non Disponibile'
    };
    return labels[category] || category;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'indennita_trasferta': return Plane;
      case 'bonus_responsabile': return Star;
      case 'bonus_autista': return Building2;
      case 'straordinario_festivo': return Clock;
      case 'straordinario_notturno': return Clock;
      case 'rimborso_chilometrico': return Building2;
      case 'bonus_evento': return Gift;
      default: return DollarSign;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'indennita_trasferta': return 'from-purple-500 to-pink-500';
      case 'bonus_responsabile': return 'from-yellow-500 to-orange-500';
      case 'bonus_autista': return 'from-blue-500 to-cyan-500';
      case 'straordinario_festivo': return 'from-red-500 to-pink-500';
      case 'straordinario_notturno': return 'from-indigo-500 to-purple-500';
      case 'bonus_evento': return 'from-green-500 to-emerald-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const handleDownloadReport = () => {
    if (!monthlyReport) return;
    
    const reportData = {
      dipendente: userProfile?.full_name || 'Dipendente',
      azienda: userProfile?.regaziendasoftware?.ragione_sociale || 'Azienda',
      periodo: `${monthlyReport.month} ${monthlyReport.year}`,
      eventi: eventReports.length,
      importoTotale: (monthlyReport as any).totalAmount,
      benefitTotali: (monthlyReport as any).benefitsAmount
    };
    
    console.log('📄 Download report:', reportData);
    alert(`📄 Report ${monthlyReport.month} ${monthlyReport.year} generato!`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Generazione report...</p>
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
            onClick={() => loadReportData()}
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
        {/* Header */}
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

        {/* Month/Year Selector */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center space-x-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(2024, i).toLocaleDateString('it-IT', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
            >
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
            </select>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="grid grid-cols-2">
            <button
              onClick={() => setActiveTab('events')}
              className={`flex items-center justify-center space-x-2 py-4 px-4 transition-all ${
                activeTab === 'events'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Calendar className="h-5 w-5" />
              <span className="font-semibold">Eventi</span>
              {eventReports.length > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === 'events' ? 'bg-blue-500' : 'bg-gray-600'
                }`}>
                  {eventReports.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('warehouse')}
              className={`flex items-center justify-center space-x-2 py-4 px-4 transition-all ${
                activeTab === 'warehouse'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Building2 className="h-5 w-5" />
              <span className="font-semibold">Turni</span>
              {completedShifts.length > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === 'warehouse' ? 'bg-blue-500' : 'bg-gray-600'
                }`}>
                  {completedShifts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Monthly Summary */}
        {monthlyReport && (
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Riepilogo {monthlyReport.month} {monthlyReport.year}
            </h3>
            
            {/* ROW 1: Turni Magazzino / Eventi / Trasferte */}
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

            {/* ROW 2: Giorni / Note Spese / Straordinari */}
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


        {/* Events Detail */}
        {activeTab === 'events' && (
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Dettaglio Eventi ({eventReports.length})
            </h3>

            {eventReports.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <p>Nessun evento nel periodo selezionato</p>
              <p className="text-sm mt-1">Seleziona un mese diverso o attendi nuove assegnazioni</p>
            </div>
          ) : (
            <div className="space-y-4">
              {eventReports.map((report) => (
                <EventShiftCard
                  key={report.assignment.id}
                  report={{
                    ...report,
                    benefitBreakdown: report.benefitBreakdown
                  }}
                  onRectify={() => {
                    setSelectedEventForRectify(report);
                    setRectifyModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
          </div>
        )}

        {/* Completed Shifts Section */}
        {activeTab === 'warehouse' && (
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Turni Magazzino ({filteredShifts.length}{completedShifts.length !== filteredShifts.length ? ` di ${completedShifts.length}` : ''})
            </h3>

            {/* Filtri */}
            <div className="mb-4 space-y-3">
              {/* Filtro Data */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">
                  Filtra per Giorno Specifico:
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Seleziona un giorno..."
                />
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate('')}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                  >
                    Rimuovi filtro data
                  </button>
                )}
              </div>

              {/* Filtro Magazzino */}
              {warehouses.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-2">
                    Filtra per Magazzino:
                  </label>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="all">Tutti i Magazzini</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Indicatore Filtri Attivi */}
              {(selectedDate || selectedWarehouse !== 'all') && (
                <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-2 text-xs text-blue-200">
                  <div className="flex items-center space-x-1">
                    <Filter className="h-3 w-3" />
                    <span className="font-semibold">Filtri attivi:</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {selectedDate && (
                      <div>Data: {parseDateOnlyLocal(selectedDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    )}
                    {selectedWarehouse !== 'all' && (
                      <div>Magazzino: {warehouses.find(w => w.id === selectedWarehouse)?.name}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

          {filteredShifts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <p>Nessun turno {(selectedDate || selectedWarehouse !== 'all') ? 'trovato con i filtri selezionati' : 'nel periodo selezionato'}</p>
              <p className="text-sm mt-1">{(selectedDate || selectedWarehouse !== 'all') ? 'Prova a modificare i filtri' : 'I turni appariranno qui'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredShifts.map((shift) => {
                const hasCheckout = shift.check_out_turno || shift.rectified_check_out;
                const isInProgress = shift.status !== 'completed' || !hasCheckout;

                return (
                  <div
                    key={shift.id}
                    className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-white">{shift.nome_turno || 'Turno Magazzino'}</h4>
                          {shift.is_rectified && (
                            <span className="bg-orange-600 text-white text-xs px-2 py-0.5 rounded font-semibold">
                              Rettificato
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          {parseDateOnlyLocal(shift.giorno_turno).toLocaleDateString('it-IT', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long'
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        {isInProgress ? (
                          <div className="text-sm text-orange-400 font-semibold">In corso</div>
                        ) : (
                          <>
                            <div className="text-lg font-bold text-blue-400">{shift.conteggio_ore}h</div>
                            <div className="text-xs text-gray-400">Ore Lavorate</div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Orari Check-in/out */}
                    <div className="bg-gray-800 rounded-lg p-3 mb-3">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="flex items-center space-x-1 mb-1">
                            <Clock className="h-3 w-3 text-green-400" />
                            <span className="text-gray-400 font-medium">Check-in:</span>
                          </div>
                          <div className="text-white font-semibold">
                            {formatTime(shift.check_in_turno) || '--:--'}
                          </div>
                          {shift.is_rectified && shift.original_check_in && (
                            <div className="text-gray-500 line-through text-xs mt-1">
                              Era: {formatTime(shift.original_check_in)}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1 mb-1">
                            <Clock className="h-3 w-3 text-red-400" />
                            <span className="text-gray-400 font-medium">Check-out:</span>
                          </div>
                          {isInProgress ? (
                            <div className="flex flex-col">
                              <div className="text-orange-400 font-semibold">In corso</div>
                              {shift.is_rectified && shift.rectified_check_out && (
                                <div className="text-green-400 text-xs mt-1 flex items-center space-x-1">
                                  <CheckCircle className="h-3 w-3" />
                                  <span>Chiuso via rettifica: {formatTime(shift.rectified_check_out)}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <div className="text-white font-semibold flex items-center space-x-1 flex-wrap">
                                <span>{formatTime(shift.check_out_turno) || '--:--'}</span>
                                {shift.auto_checkout && (
                                  <span className="text-xs bg-purple-900 text-purple-200 px-1 py-0.5 rounded" title="Checkout automatico">
                                    AUTO
                                  </span>
                                )}
                                {shift.is_rectified && shift.rectified_check_out && !shift.original_check_out && (
                                  <span className="text-xs bg-green-900 text-green-200 px-1 py-0.5 rounded" title="Chiuso via rettifica">
                                    RETTIFICA
                                  </span>
                                )}
                              </div>
                              {shift.is_rectified && shift.original_check_out && shift.rectified_check_out && (
                                <div className="text-gray-500 line-through text-xs mt-1">
                                  Era: {formatTime(shift.original_check_out)}
                                  {shift.auto_checkout && <span className="ml-1">(AUTO)</span>}
                                </div>
                              )}
                              {shift.is_rectified && !shift.original_check_out && shift.rectified_check_out && (
                                <div className="text-gray-500 text-xs mt-1 italic">
                                  (Non era stato effettuato)
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pausa Pranzo */}
                    <div className="bg-gray-800 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Coffee className="h-4 w-4 text-cyan-400" />
                          <span className="text-sm text-gray-300">Pausa Pranzo:</span>
                        </div>
                        <div className="text-right">
                          {shift.pausa_pranzo ? (
                            <span className="text-green-400 font-semibold">Sì</span>
                          ) : (
                            <span className="text-gray-500">No</span>
                          )}
                          {shift.is_rectified && shift.original_pausa_pranzo !== shift.pausa_pranzo && (
                            <div className="text-xs text-gray-500 line-through mt-1">
                              Era: {shift.original_pausa_pranzo ? 'Sì' : 'No'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Benefit */}
                    <div className="flex flex-wrap gap-2 text-xs mb-2">
                      {shift.buoni_pasto_assegnato && (
                        <span className="bg-yellow-900 text-yellow-200 px-2 py-1 rounded flex items-center space-x-1">
                          <Gift className="h-3 w-3" />
                          <span>Buono Pasto</span>
                        </span>
                      )}
                      {shift.pasto_aziendale_usufruito && (
                        <span className="bg-orange-900 text-orange-200 px-2 py-1 rounded flex items-center space-x-1">
                          <Utensils className="h-3 w-3" />
                          <span>Pasto Aziendale</span>
                        </span>
                      )}
                    </div>

                  {shift.is_rectified && shift.rectification_note && (
                    <div className="bg-orange-900 bg-opacity-30 border border-orange-700 rounded-lg p-3 mb-3">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold text-orange-200 mb-1">Nota di Rettifica:</div>
                          <div className="text-xs text-orange-300">{shift.rectification_note}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <ShiftActions shift={shift} onUpdate={loadReportData} />
                </div>
                );
              })}
            </div>
          )}
          </div>
        )}

        {/* No Data Message */}
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

        {/* Copyright */}
        <CopyrightFooter />
      </div>

      {/* Rectify Time Modal */}
      {rectifyModalOpen && selectedEventForRectify && (
        <RectifyTimeModal
          event={{
            id: selectedEventForRectify.assignment.id,
            evento_id: selectedEventForRectify.assignment.evento_id,
            nome_evento: selectedEventForRectify.assignment.nome_evento,
            giorno_inizio_evento: selectedEventForRectify.assignment.giorno_inizio_evento,
            giorno_fine_evento: selectedEventForRectify.assignment.giorno_fine_evento
          }}
          existingTimesheet={selectedEventForRectify.timesheet}
          onClose={() => {
            setRectifyModalOpen(false);
            setSelectedEventForRectify(null);
          }}
          onSuccess={() => {
            loadReportData();
          }}
        />
      )}
    </div>
  );
};

export default MobileReport;