import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Search } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface CrewMember {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

interface Shift {
  dipendente_id: string;
  data_turno: string;
}

interface ShiftTemplate {
  nome_template: string;
  ora_inizio_turno: string;
  ora_fine_turno: string;
  nome_magazzino: string;
}

interface LeaveStatus {
  isUnavailable: boolean;
  reason: string;
  tipo: 'ferie' | 'permessi' | 'malattia' | 'infortunio' | null;
  details?: string;
}

interface SelectedEmployee {
  id: string;
  ora_inizio: string;
  ora_fine: string;
}

interface ModaleAggiungiDipendenteProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  crewMembers: CrewMember[];
  shifts: Shift[];
  selectedTemplate: ShiftTemplate | undefined;
  onAddShift: (crewMemberId: string, customTimes?: { ora_inizio: string; ora_fine: string }) => void;
}

export const ModaleAggiungiDipendente: React.FC<ModaleAggiungiDipendenteProps> = ({
  isOpen,
  onClose,
  date,
  crewMembers,
  shifts,
  selectedTemplate,
  onAddShift,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<SelectedEmployee[]>([]);
  const [leaveStatuses, setLeaveStatuses] = useState<Record<string, LeaveStatus>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && date && crewMembers.length > 0) {
      checkEmployeeAvailability();
    }
  }, [isOpen, date, crewMembers]);

  const checkEmployeeAvailability = async () => {
    setLoading(true);
    const statuses: Record<string, LeaveStatus> = {};

    for (const crew of crewMembers) {
      const status = await checkSingleEmployeeAvailability(crew.id, date);
      statuses[crew.id] = status;
    }

    setLeaveStatuses(statuses);
    setLoading(false);
  };

  const checkSingleEmployeeAvailability = async (
    employeeId: string,
    checkDate: string
  ): Promise<LeaveStatus> => {
    try {
      const { data: ferie, error: ferieError } = await supabase
        .from('crew_ferie')
        .select('*')
        .eq('dipendente_id', employeeId)
        .eq('stato', 'approvata')
        .lte('data_inizio', checkDate)
        .gte('data_fine', checkDate)
        .maybeSingle();

      if (ferie && !ferieError) {
        return {
          isUnavailable: true,
          reason: 'Ferie',
          tipo: 'ferie',
          details: `Dal ${new Date(ferie.data_inizio).toLocaleDateString('it-IT')} al ${new Date(ferie.data_fine).toLocaleDateString('it-IT')}`,
        };
      }

      const { data: permessi, error: permessiError } = await supabase
        .from('crew_richieste_permessi')
        .select('*')
        .eq('dipendente_id', employeeId)
        .eq('stato', 'approvata')
        .eq('data', checkDate);

      if (permessi && permessi.length > 0 && !permessiError) {
        const permesso = permessi[0];
        return {
          isUnavailable: true,
          reason: 'Permesso',
          tipo: 'permessi',
          details: `${permesso.ora_inizio?.slice(0, 5)} - ${permesso.ora_fine?.slice(0, 5)}`,
        };
      }

      const { data: richieste, error: richiesteError } = await supabase
        .from('crew_richiesteferie_permessi')
        .select('*')
        .eq('dipendente_id', employeeId)
        .eq('stato', 'approvata')
        .lte('data_inizio', checkDate)
        .gte('data_fine', checkDate);

      if (richieste && richieste.length > 0 && !richiesteError) {
        const richiesta = richieste[0];
        let tipo: 'ferie' | 'permessi' | 'malattia' | 'infortunio' = 'ferie';
        let reason = 'Assente';

        if (richiesta.tipo_richiesta === 'ferie') {
          tipo = 'ferie';
          reason = 'Ferie';
        } else if (richiesta.tipo_richiesta === 'permesso' || richiesta.tipo_richiesta === 'permessi') {
          tipo = 'permessi';
          reason = 'Permesso';
        } else if (richiesta.tipo_richiesta === 'malattia') {
          tipo = 'malattia';
          reason = 'Malattia';
        } else if (richiesta.tipo_richiesta === 'infortunio') {
          tipo = 'infortunio';
          reason = 'Infortunio';
        }

        return {
          isUnavailable: true,
          reason,
          tipo,
          details: richiesta.data_fine
            ? `Dal ${new Date(richiesta.data_inizio).toLocaleDateString('it-IT')} al ${new Date(richiesta.data_fine).toLocaleDateString('it-IT')}`
            : new Date(richiesta.data_inizio).toLocaleDateString('it-IT'),
        };
      }

      return { isUnavailable: false, reason: '', tipo: null };
    } catch (error) {
      console.error('Errore verifica disponibilità:', error);
      return { isUnavailable: false, reason: '', tipo: null };
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedEmployees([]);
    onClose();
  };

  const toggleEmployee = (crewId: string) => {
    const alreadySelected = selectedEmployees.find((e) => e.id === crewId);
    if (alreadySelected) {
      setSelectedEmployees(selectedEmployees.filter((e) => e.id !== crewId));
    } else {
      setSelectedEmployees([
        ...selectedEmployees,
        {
          id: crewId,
          ora_inizio: selectedTemplate?.ora_inizio_turno || '09:00:00',
          ora_fine: selectedTemplate?.ora_fine_turno || '18:00:00',
        },
      ]);
    }
  };

  const updateEmployeeTime = (
    crewId: string,
    field: 'ora_inizio' | 'ora_fine',
    value: string
  ) => {
    setSelectedEmployees(
      selectedEmployees.map((e) =>
        e.id === crewId ? { ...e, [field]: value } : e
      )
    );
  };

  const handleAddShifts = () => {
    selectedEmployees.forEach((emp) => {
      onAddShift(emp.id, {
        ora_inizio: emp.ora_inizio,
        ora_fine: emp.ora_fine,
      });
    });
    handleClose();
  };

  if (!isOpen) return null;

  const filteredCrewMembers = crewMembers.filter((crew) => {
    if (!searchQuery) return true;
    const fullName = crew.full_name || `${crew.first_name} ${crew.last_name}`;
    return fullName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-end sm:items-center justify-center z-50">
      <div className="bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-xl font-bold text-white">Aggiungi Dipendenti al Turno</h3>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Data</div>
            <div className="text-white font-semibold">
              {new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>

          {selectedTemplate && (
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-2">Turno Template</div>
              <div className="text-white font-semibold">{selectedTemplate.nome_template}</div>
              <div className="text-sm text-gray-400 mt-2">
                {selectedTemplate.ora_inizio_turno.slice(0, 5)} -{' '}
                {selectedTemplate.ora_fine_turno.slice(0, 5)}
              </div>
              <div className="text-sm text-gray-400 mt-1">{selectedTemplate.nome_magazzino}</div>
            </div>
          )}

          <div className="bg-gray-900 rounded-lg border border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca dipendente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-gray-400">
                  Verifica disponibilità dipendenti...
                </div>
              ) : (
                filteredCrewMembers.map((crew) => {
                  const alreadyAssigned = shifts.some(
                    (s) => s.dipendente_id === crew.id && s.data_turno === date
                  );
                  const leaveStatus = leaveStatuses[crew.id];
                  const isSelected = selectedEmployees.some((e) => e.id === crew.id);
                  const selectedData = selectedEmployees.find((e) => e.id === crew.id);
                  const isDisabled = alreadyAssigned || leaveStatus?.isUnavailable;

                  return (
                    <div
                      key={crew.id}
                      className={`rounded-lg border transition-colors ${
                        isDisabled
                          ? 'bg-gray-800 border-gray-700 opacity-60'
                          : isSelected
                          ? 'bg-blue-900 border-blue-600'
                          : 'bg-gray-800 border-gray-600 hover:border-blue-500'
                      }`}
                    >
                      <div
                        className={`p-4 flex items-center gap-3 ${
                          isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        onClick={() => !isDisabled && toggleEmployee(crew.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => {}}
                          className="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-white">
                            {crew.full_name || `${crew.first_name} ${crew.last_name}`}
                          </div>
                          {alreadyAssigned && (
                            <div className="text-xs text-yellow-400 mt-1">
                              Già assegnato a questo turno
                            </div>
                          )}
                          {leaveStatus?.isUnavailable && (
                            <div className="flex items-center gap-1 text-xs text-red-400 mt-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>
                                {leaveStatus.reason}
                                {leaveStatus.details && ` - ${leaveStatus.details}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {isSelected && selectedData && (
                        <div className="px-4 pb-4 pt-2 border-t border-gray-700">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">
                                Ora Inizio
                              </label>
                              <input
                                type="time"
                                value={selectedData.ora_inizio.slice(0, 5)}
                                onChange={(e) =>
                                  updateEmployeeTime(
                                    crew.id,
                                    'ora_inizio',
                                    e.target.value + ':00'
                                  )
                                }
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">
                                Ora Fine
                              </label>
                              <input
                                type="time"
                                value={selectedData.ora_fine.slice(0, 5)}
                                onChange={(e) =>
                                  updateEmployeeTime(
                                    crew.id,
                                    'ora_fine',
                                    e.target.value + ':00'
                                  )
                                }
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={handleAddShifts}
              disabled={selectedEmployees.length === 0}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Aggiungi {selectedEmployees.length > 0 && `(${selectedEmployees.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
