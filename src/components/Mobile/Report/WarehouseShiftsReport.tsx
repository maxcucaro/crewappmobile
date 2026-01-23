import React, { useState, useEffect } from 'react';
import { Building2, Clock, Coffee, Utensils, Gift, FileText, AlertTriangle, CheckCircle, Filter, AlertCircle } from 'lucide-react';
import ShiftActions from './ShiftActions';
import { toItalianTime } from '../../../utils/dateUtils';
import { supabase } from '../../../lib/db';
import { useAuth } from '../../../context/AuthContext';

interface CompletedShift {
  id: string;
  turno_id: string;
  warehouse_id?: string;
  warehouse_name?: string;
  notes?: string;
  noteturno?: string;
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
  pausa_cena?: boolean;
  pausa_pranzo_inizio?: string;
  pausa_pranzo_fine?: string;
  pausa_pranzo_minuti?: number;
  pausa_cena_inizio?: string;
  pausa_cena_fine?: string;
  pausa_cena_minuti?: number;
  pausa_totale_minuti?: number;
  status?: string;
  is_rectified?: boolean;
  rectification_note?: string | null;
  original_check_in?: string;
  original_check_out?: string;
  original_pausa_pranzo?: boolean;
  rectified_check_in?: string;
  rectified_check_out?: string;
  rectified_pausa_pranzo?: boolean;
  rectified_pausa_pranzo_inizio?: string;
  rectified_pausa_pranzo_fine?: string;
  rectified_pausa_cena_inizio?: string;
  rectified_pausa_cena_fine?: string;
  rectified_pausa_pranzo_minuti?: number;
  rectified_pausa_cena_minuti?: number;
  rectified_pausa_totale_minuti?: number;
  effective_check_in?: string;
  effective_check_out?: string;
  effective_pausa_pranzo_inizio?: string;
  effective_pausa_pranzo_fine?: string;
  effective_pausa_pranzo_minuti?: number;
  effective_pausa_cena_inizio?: string;
  effective_pausa_cena_fine?: string;
  effective_pausa_cena_minuti?: number;
  effective_pausa_totale_minuti?: number;
  effective_ore_lavorate_minuti?: number;
  auto_checkout?: boolean;
  [key: string]: any;
}

interface WarehouseShiftsReportProps {
  selectedMonth: number;
  selectedYear: number;
}

const WarehouseShiftsReport: React.FC<WarehouseShiftsReportProps> = ({ selectedMonth, selectedYear }) => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<CompletedShift[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [filteredShifts, setFilteredShifts] = useState<CompletedShift[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overtimeRequests, setOvertimeRequests] = useState<Record<string, any>>({});

  const pad2 = (n: number) => String(n).padStart(2, '0');

  const toLocalDateStringForSQL = (d: Date) => {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const formatMinutesToHoursMinutes = (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0 && minutes === 0) return '0min';
    if (hours === 0) return `${minutes}min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}min`;
  };

  const parseDateOnlyLocal = (isoDate: string): Date => {
    if (!isoDate) return new Date(NaN);
    const parts = isoDate.split('-').map(p => parseInt(p, 10));
    if (parts.length !== 3) return new Date(isoDate);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };

  const loadOvertimeRequests = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('richieste_straordinari_v2')
        .select('*')
        .eq('crewid', user.id);

      if (error) throw error;

      if (data) {
        const requestsMap: Record<string, any> = {};
        data.forEach(req => {
          if (req.warehouse_checkin_id) {
            requestsMap[req.warehouse_checkin_id] = req;
          }
        });
        setOvertimeRequests(requestsMap);
      }
    } catch (err) {
      console.error('Errore caricamento richieste straordinari:', err);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadWarehouseData();
      loadOvertimeRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedMonth, selectedYear]);

  useEffect(() => {
    let filtered = [...shifts];

    if (selectedDate) {
      filtered = filtered.filter(shift => shift.giorno_turno === selectedDate);
    }

    if (selectedWarehouse !== 'all') {
      filtered = filtered.filter(shift => shift.warehouse_id === selectedWarehouse);
    }

    setFilteredShifts(filtered);
  }, [shifts, selectedDate, selectedWarehouse]);

  const loadWarehouseData = async () => {
    try {
      setLoading(true);
      setError(null);

      const startDateObj = new Date(selectedYear, selectedMonth, 1);
      const endDateObj = new Date(selectedYear, selectedMonth + 1, 0);
      const startDate = toLocalDateStringForSQL(startDateObj);
      const endDate = toLocalDateStringForSQL(endDateObj);

      const { data: allShiftsData, error: shiftsError } = await supabase
        .from('warehouse_checkins')
        .select('*')
        .eq('crew_id', user?.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (shiftsError) throw shiftsError;

      const mappedWarehouseShifts = (allShiftsData || []).map((shift: any) => {
        const checkInTime = shift.rectified_check_in_time || shift.check_in_time;
        const checkOutTime = shift.rectified_check_out_time || shift.check_out_time;
        const totalHours = shift.effective_ore_lavorate_minuti
          ? shift.effective_ore_lavorate_minuti / 60
          : (shift.rectified_total_hours || parseFloat(shift.total_hours) || 0);
        const pausaPranzo = shift.rectified_pausa_pranzo !== null ? shift.rectified_pausa_pranzo : (shift.pausa_pranzo || false);

        return {
          id: shift.id,
          turno_id: shift.turno_id || '',
          warehouse_id: shift.warehouse_id || '',
          warehouse_name: 'Turno Magazzino',
          notes: shift.notes || '',
          noteturno: shift.NoteTurno || '',
          giorno_turno: shift.date,
          nome_turno: 'Turno Magazzino',
          check_in_turno: checkInTime,
          check_out_turno: checkOutTime,
          conteggio_ore: totalHours,
          buoni_pasto_assegnato: shift.meal_voucher || false,
          pasto_aziendale_usufruito: shift.company_meal || false,
          ore_straordinario: parseFloat(shift.overtime_hours) || 0,
          ore_previste: 8,
          pausa_pranzo: pausaPranzo,
          pausa_cena: shift.pausa_cena_inizio && shift.pausa_cena_fine ? true : false,
          pausa_pranzo_inizio: shift.pausa_pranzo_inizio || shift.break_start_time,
          pausa_pranzo_fine: shift.pausa_pranzo_fine || shift.break_end_time,
          pausa_pranzo_minuti: shift.pausa_pranzo_minuti || shift.break_minutes,
          pausa_cena_inizio: shift.pausa_cena_inizio,
          pausa_cena_fine: shift.pausa_cena_fine,
          pausa_cena_minuti: shift.pausa_cena_minuti,
          pausa_totale_minuti: shift.pausa_totale_minuti || shift.break_minutes,
          status: shift.status,
          is_rectified: shift.rectified_at ? true : false,
          rectification_note: shift.rectification_note || null,
          original_check_in: shift.check_in_time,
          original_check_out: shift.check_out_time,
          original_pausa_pranzo: shift.pausa_pranzo || false,
          rectified_check_in: shift.rectified_check_in_time,
          rectified_check_out: shift.rectified_check_out_time,
          rectified_pausa_pranzo: shift.rectified_pausa_pranzo,
          rectified_pausa_pranzo_inizio: shift.rectified_pausa_pranzo_inizio,
          rectified_pausa_pranzo_fine: shift.rectified_pausa_pranzo_fine,
          rectified_pausa_cena_inizio: shift.rectified_pausa_cena_inizio,
          rectified_pausa_cena_fine: shift.rectified_pausa_cena_fine,
          effective_pausa_pranzo_inizio: shift.effective_pausa_pranzo_inizio,
          effective_pausa_pranzo_fine: shift.effective_pausa_pranzo_fine,
          effective_pausa_pranzo_minuti: shift.effective_pausa_pranzo_minuti,
          effective_pausa_cena_inizio: shift.effective_pausa_cena_inizio,
          effective_pausa_cena_fine: shift.effective_pausa_cena_fine,
          effective_pausa_cena_minuti: shift.effective_pausa_cena_minuti,
          effective_pausa_totale_minuti: shift.effective_pausa_totale_minuti,
          effective_ore_lavorate_minuti: shift.effective_ore_lavorate_minuti,
          auto_checkout: shift.auto_checkout || false
        } as CompletedShift;
      });

      setShifts(mappedWarehouseShifts);

      const { data: warehousesData, error: warehousesError } = await supabase
        .from('warehouse_checkins_enriched')
        .select('warehouse_id, warehouse_name')
        .eq('crew_id', user?.id)
        .not('warehouse_id', 'is', null);

      if (!warehousesError && warehousesData) {
        const uniqueMap = new Map<string, string>();
        warehousesData.forEach((row: any, idx: number) => {
          const id = row.warehouse_id;
          const name = row.warehouse_name || `Magazzino ${idx + 1}`;
          if (id && !uniqueMap.has(id)) uniqueMap.set(id, name);
        });

        const uniqueWarehouses = Array.from(uniqueMap.entries()).map(([id, name]) => ({ id, name }));
        setWarehouses(uniqueWarehouses);
      }
    } catch (err) {
      console.error('Errore caricamento turni magazzino:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string | null): string => {
    if (!timeString) return 'Non specificato';
    const result = toItalianTime(timeString);
    return result || 'Non specificato';
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento turni magazzino...</p>
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
            onClick={() => loadWarehouseData()}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">
        Turni Magazzino ({filteredShifts.length}{shifts.length !== filteredShifts.length ? ` di ${shifts.length}` : ''})
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
          <p>Nessun turno magazzino {(selectedDate || selectedWarehouse !== 'all') ? 'trovato con i filtri selezionati' : 'nel periodo selezionato'}</p>
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
                        <div className="text-lg font-bold text-blue-400">
                          {shift.effective_ore_lavorate_minuti
                            ? Math.floor(shift.effective_ore_lavorate_minuti / 60)
                            : shift.conteggio_ore}h
                        </div>
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

                {/* Pause */}
                <div className="bg-gray-800 rounded-lg p-3 mb-3 space-y-2">
                  {/* Pausa Pranzo */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Coffee className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm text-gray-300">Pausa Pranzo:</span>
                    </div>
                    <div className="text-right">
                      {shift.pausa_pranzo ? (
                        <div>
                          <span className="text-green-400 font-semibold">Sì</span>
                          {(() => {
                            const inizio = shift.effective_pausa_pranzo_inizio || shift.rectified_pausa_pranzo_inizio || shift.pausa_pranzo_inizio;
                            const fine = shift.effective_pausa_pranzo_fine || shift.rectified_pausa_pranzo_fine || shift.pausa_pranzo_fine;
                            const minuti = shift.effective_pausa_pranzo_minuti;

                            if (inizio && fine && minuti) {
                              return (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {inizio.substring(0, 5)} - {fine.substring(0, 5)} ({minuti} min)
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
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

                  {/* Pausa Cena */}
                  {(shift.pausa_cena || shift.rectified_pausa_cena_inizio || shift.pausa_cena_inizio) && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                      <div className="flex items-center space-x-2">
                        <Utensils className="h-4 w-4 text-purple-400" />
                        <span className="text-sm text-gray-300">Pausa Cena:</span>
                      </div>
                      <div className="text-right">
                        {(shift.pausa_cena || shift.rectified_pausa_cena_inizio || shift.pausa_cena_inizio) ? (
                          <div>
                            <span className="text-green-400 font-semibold">Sì</span>
                            {(() => {
                              const inizio = shift.effective_pausa_cena_inizio || shift.rectified_pausa_cena_inizio || shift.pausa_cena_inizio;
                              const fine = shift.effective_pausa_cena_fine || shift.rectified_pausa_cena_fine || shift.pausa_cena_fine;
                              const minuti = shift.effective_pausa_cena_minuti;

                              if (inizio && fine && minuti) {
                                return (
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    {inizio.substring(0, 5)} - {fine.substring(0, 5)} ({minuti} min)
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        ) : (
                          <span className="text-gray-500">No</span>
                        )}
                        {shift.is_rectified && shift.rectified_pausa_cena_inizio && !shift.pausa_cena_inizio && (
                          <div className="text-xs text-gray-500 line-through mt-1">
                            Era: No
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Pausa Totale */}
                  {shift.effective_pausa_totale_minuti > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                      <span className="text-xs text-gray-400">Totale Pause:</span>
                      <span className="text-xs text-gray-300 font-semibold">{shift.effective_pausa_totale_minuti} minuti</span>
                    </div>
                  )}

                  {/* Ore Effettive */}
                  {shift.effective_ore_lavorate_minuti > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                      <span className="text-xs text-gray-400">Ore Effettive:</span>
                      <span className="text-xs text-green-400 font-semibold">
                        {Math.floor(shift.effective_ore_lavorate_minuti / 60)}h {shift.effective_ore_lavorate_minuti % 60}min
                      </span>
                    </div>
                  )}
                </div>

                {/* Note Turno - Mostra entrambe le note se presenti */}
                {(shift.noteturno || shift.notes) && (
                  <div className="space-y-2 mb-3">
                    {/* Note scritte durante il turno (NoteTurno) */}
                    {shift.noteturno && (
                      <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-700 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                          <svg className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-blue-200 mb-1">📝 Note durante il turno:</div>
                            <div className="text-xs text-blue-100 whitespace-pre-wrap">{shift.noteturno}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Note di fine turno (notes) */}
                    {shift.notes && (
                      <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-600 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                          <FileText className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-gray-300 mb-1">🏁 Note fine turno:</div>
                            <div className="text-xs text-gray-200 whitespace-pre-wrap">{shift.notes}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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

                {/* Badge Straordinari Richiesti */}
                {overtimeRequests[shift.id] && (
                  <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3 mb-3">
                    <div className="flex items-start space-x-2">
                      <Clock className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-yellow-400 mb-2">
                          Straordinari Richiesti
                        </div>
                        <div className="text-xs text-gray-300 space-y-1">
                          <div>
                            <span className="font-semibold">Ore richieste:</span> {formatMinutesToHoursMinutes(overtimeRequests[shift.id].overtime_minutes)}
                          </div>
                          <div>
                            <span className="font-semibold">Stato:</span>{' '}
                            <span className={`font-semibold ${
                              overtimeRequests[shift.id].status === 'in_attesa' ? 'text-yellow-300' :
                              overtimeRequests[shift.id].status === 'approved' ? 'text-green-300' :
                              'text-red-300'
                            }`}>
                              {overtimeRequests[shift.id].status === 'in_attesa' ? 'In Attesa' :
                               overtimeRequests[shift.id].status === 'approved' ? 'Approvata' :
                               'Rifiutata'}
                            </span>
                          </div>
                          <div>
                            <span className="font-semibold">Importo:</span> €{overtimeRequests[shift.id].total_amount}
                          </div>
                          {overtimeRequests[shift.id].note && (
                            <div className="mt-2 pt-2 border-t border-yellow-700/30">
                              <div className="font-semibold mb-1">Note:</div>
                              <div className="text-gray-400 italic">"{overtimeRequests[shift.id].note}"</div>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-yellow-500 mt-2 flex items-center space-x-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>Clicca su "Rettifica Orari Turno" per modificare la richiesta</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <ShiftActions shift={shift} onUpdate={() => { loadWarehouseData(); loadOvertimeRequests(); }} tableName="warehouse_checkins" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WarehouseShiftsReport;
