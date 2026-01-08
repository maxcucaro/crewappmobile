import React, { useState, useEffect } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import EventShiftCard from './EventShiftCard';
import RectifyTimeModal from './RectifyTimeModal';
import { supabase } from '../../../lib/db';
import { useAuth } from '../../../context/AuthContext';

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

interface EventsReportProps {
  selectedMonth: number;
  selectedYear: number;
}

const EventsReport: React.FC<EventsReportProps> = ({ selectedMonth, selectedYear }) => {
  const { user } = useAuth();
  const [eventReports, setEventReports] = useState<EventReport[]>([]);
  const [filteredEventReports, setFilteredEventReports] = useState<EventReport[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedEventName, setSelectedEventName] = useState<string>('all');
  const [availableEventNames, setAvailableEventNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rectifyModalOpen, setRectifyModalOpen] = useState(false);
  const [selectedEventForRectify, setSelectedEventForRectify] = useState<EventReport | null>(null);

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
      loadEventsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedMonth, selectedYear]);

  useEffect(() => {
    let filtered = [...eventReports];

    if (selectedDate) {
      filtered = filtered.filter(report =>
        report.assignment.giorno_inizio_evento <= selectedDate &&
        report.assignment.giorno_fine_evento >= selectedDate
      );
    }

    if (selectedEventName !== 'all') {
      filtered = filtered.filter(report =>
        report.assignment.nome_evento === selectedEventName
      );
    }

    setFilteredEventReports(filtered);
  }, [eventReports, selectedDate, selectedEventName]);

  const loadEventsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const startDateObj = new Date(selectedYear, selectedMonth, 1);
      const endDateObj = new Date(selectedYear, selectedMonth + 1, 0);
      const startDate = toLocalDateStringForSQL(startDateObj);
      const endDate = toLocalDateStringForSQL(endDateObj);

      const { data: eventsData, error: eventsError } = await supabase
        .from('crew_event_assegnazione')
        .select('*')
        .eq('dipendente_freelance_id', user?.id)
        .gte('giorno_inizio_evento', startDate)
        .lte('giorno_inizio_evento', endDate)
        .order('giorno_inizio_evento', { ascending: true });

      if (eventsError) throw eventsError;

      const { data: employeeRatesData, error: employeeRatesError } = await supabase
        .from('crew_assegnazionetariffa')
        .select('tariffe_ids, tariffe_personalizzate')
        .eq('dipendente_id', user?.id)
        .eq('attivo', true);

      if (employeeRatesError) throw employeeRatesError;

      const employeeBenefits: { [id: string]: any } = {};
      const tariffePersonalizzate: { [id: string]: number } = {};

      if (employeeRatesData && employeeRatesData.length > 0) {
        const allTariffeIds: string[] = [];
        employeeRatesData.forEach(assignment => {
          if (assignment.tariffe_ids && assignment.tariffe_ids.length > 0) {
            allTariffeIds.push(...assignment.tariffe_ids);
          }
          if (assignment.tariffe_personalizzate) {
            Object.assign(tariffePersonalizzate, assignment.tariffe_personalizzate);
          }
        });

        if (allTariffeIds.length > 0) {
          const { data: tariffeData, error: tariffeError } = await supabase
            .from('crew_tariffe')
            .select('*')
            .in('id', allTariffeIds)
            .eq('attivo', true);

          if (tariffeError) throw tariffeError;

          tariffeData?.forEach(tariffa => {
            const importoPersonalizzato = tariffePersonalizzate[tariffa.id];
            employeeBenefits[tariffa.id] = {
              id: tariffa.id,
              nome_tariffa: tariffa.nome_tariffa,
              categoria: tariffa.categoria,
              tipo_calcolo: tariffa.tipo_calcolo,
              importo: importoPersonalizzato !== undefined ? importoPersonalizzato : tariffa.importo,
              attivo: tariffa.attivo
            };
          });
        }
      }

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
          benefits_breakdown,
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

      if (timesheetError) throw timesheetError;

      const timesheetByEvent: { [eventId: string]: any } = {};
      timesheetData?.forEach(entry => {
        timesheetByEvent[entry.event_id] = entry;
      });

      const reports: EventReport[] = [];

      for (const assignment of eventsData || []) {
        const timesheet = timesheetByEvent[assignment.evento_id];
        const applicableBenefits: any[] = [];
        const benefitBreakdown: any[] = [];
        let eventBenefitsAmount = 0;

        // Usa i benefit dal timesheet se esistono, altrimenti calcola dall'assegnazione
        if (timesheet && timesheet.benefits_breakdown && timesheet.benefits_breakdown.length > 0) {
          // Benefit già memorizzati nel timesheet (fonte affidabile)
          timesheet.benefits_breakdown.forEach((benefit: any) => {
            applicableBenefits.push({
              id: benefit.id,
              nome_tariffa: benefit.nome_tariffa,
              categoria: 'benefit',
              importo: benefit.importo,
              applied: true
            });
            eventBenefitsAmount += benefit.importo;

            benefitBreakdown.push({
              name: benefit.nome_tariffa,
              amount: benefit.importo,
              category: 'benefit',
              applied: true
            });
          });
        } else {
          // Fallback: calcola dai benefits_storicizzati o dall'assegnazione
          if (assignment.benefits_storicizzati && assignment.benefits_storicizzati.length > 0) {
            assignment.benefits_storicizzati.forEach((benefit: any) => {
              applicableBenefits.push({
                id: benefit.id,
                nome_tariffa: benefit.nome_tariffa,
                categoria: 'benefit',
                importo: benefit.importo,
                applied: true
              });
              eventBenefitsAmount += benefit.importo;

              benefitBreakdown.push({
                name: benefit.nome_tariffa,
                amount: benefit.importo,
                category: 'benefit',
                applied: true
              });
            });
          } else if (assignment.benefits_evento_ids && assignment.benefits_evento_ids.length > 0) {
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

                benefitBreakdown.push({
                  name: matchingBenefit.nome_tariffa,
                  amount: matchingBenefit.importo,
                  category: matchingBenefit.categoria,
                  applied: true
                });
              } else {
                benefitBreakdown.push({
                  name: `Benefit ID: ${benefitId}`,
                  amount: 0,
                  category: 'non_disponibile',
                  applied: false,
                  reason: 'Benefit non presente nel contratto del dipendente'
                });
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
          }
        }

        const baseAmount = assignment.tariffa_evento_assegnata || 0;
        const totalEventAmount = baseAmount + eventBenefitsAmount;

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
      }

      setEventReports(reports);

      const uniqueEventNames = new Set<string>();
      reports.forEach((report: EventReport) => {
        if (report.assignment.nome_evento) {
          uniqueEventNames.add(report.assignment.nome_evento);
        }
      });
      setAvailableEventNames(Array.from(uniqueEventNames).sort());
    } catch (err) {
      console.error('Errore caricamento eventi:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento eventi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="text-center py-8 text-red-400">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <p className="text-lg">Errore nel caricamento</p>
          <p className="text-sm text-gray-300 mt-2">{error}</p>
          <button
            onClick={() => loadEventsData()}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          Dettaglio Eventi ({filteredEventReports.length}{eventReports.length !== filteredEventReports.length ? ` di ${eventReports.length}` : ''})
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

          {/* Filtro per Nome Evento */}
          {availableEventNames.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2">
                Filtra per Nome Evento:
              </label>
              <select
                value={selectedEventName}
                onChange={(e) => setSelectedEventName(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">Tutti gli Eventi</option>
                {availableEventNames.map((name, idx) => (
                  <option key={idx} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Indicatore Filtri Attivi */}
          {(selectedDate || selectedEventName !== 'all') && (
            <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-2 text-xs text-blue-200">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span className="font-semibold">Filtri attivi:</span>
              </div>
              <div className="mt-1 space-y-1">
                {selectedDate && (() => {
                  const date = parseDateOnlyLocal(selectedDate);
                  return (
                    <div>
                      Data: {!isNaN(date.getTime())
                        ? date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                        : selectedDate
                      }
                    </div>
                  );
                })()}
                {selectedEventName !== 'all' && (
                  <div>Evento: {selectedEventName}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {filteredEventReports.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-600" />
            <p>Nessun evento {(selectedDate || selectedEventName !== 'all') ? 'trovato con i filtri selezionati' : 'nel periodo selezionato'}</p>
            <p className="text-sm mt-1">{(selectedDate || selectedEventName !== 'all') ? 'Prova a modificare i filtri' : 'Seleziona un mese diverso o attendi nuove assegnazioni'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEventReports.map((report) => (
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
            loadEventsData();
          }}
        />
      )}
    </>
  );
};

export default EventsReport;
