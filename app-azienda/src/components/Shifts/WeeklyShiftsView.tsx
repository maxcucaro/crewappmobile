import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../utils/supabase';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToast } from '../../context/ToastContext';
import { ChevronLeft, ChevronRight, Clock, MapPin, Copy, X, Trash2 } from 'lucide-react';
import { ModaleAggiungiDipendente } from './ModaleAggiungiDipendente';

interface Shift {
  id: string;
  dipendente_id: string;
  dipendente_nome: string;
  turno_id: string;
  nome_turno: string | null;
  ora_inizio_turno: string;
  ora_fine_turno: string;
  nome_magazzino: string;
  indirizzo_magazzino: string | null;
  warehouse_id: string | null;
  data_turno: string;
  azienda_id: string;
  nome_azienda: string;
}

interface CrewMember {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

interface ShiftTemplate {
  id_template: string;
  nome_template: string;
  ora_inizio_turno: string;
  ora_fine_turno: string;
  warehouse_id: string;
  nome_magazzino: string;
  indirizzo_magazzino: string | null;
}

interface DraggedShift {
  shift: Shift;
  sourceDate: string;
}

export const WeeklyShiftsView: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const { addToast } = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [draggedShift, setDraggedShift] = useState<DraggedShift | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalDate, setAddModalDate] = useState<string>('');
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<string | null>(null);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  function getWeekDays(weekStart: Date): Date[] {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }

  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function formatDateDisplay(date: Date): string {
    return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  const weekDays = getWeekDays(currentWeekStart);

  useEffect(() => {
    if (companyProfile) {
      loadInitialData();
    }
  }, [companyProfile]);

  useEffect(() => {
    if (companyProfile && selectedTemplateId) {
      loadShifts();
    }
  }, [companyProfile, currentWeekStart, selectedTemplateId]);

  const loadInitialData = async () => {
    await Promise.all([
      loadCrewMembers(),
      loadShiftTemplates(),
    ]);
  };

  const loadCrewMembers = async () => {
    if (!companyProfile) return;

    try {
      const { data, error } = await supabase
        .from('crew_members')
        .select('id, first_name, last_name, full_name')
        .eq('company_id', companyProfile.id)
        .order('full_name');

      if (error) throw error;
      setCrewMembers(data || []);
    } catch (error: any) {
      console.error('Errore caricamento dipendenti:', error);
    }
  };

  const loadShiftTemplates = async () => {
    if (!companyProfile) return;

    try {
      const { data, error } = await supabase
        .from('crew_template_turni')
        .select('id_template, nome_template, ora_inizio_turno, ora_fine_turno, warehouse_id, nome_magazzino, indirizzo_magazzino')
        .eq('company_id', companyProfile.id)
        .order('nome_template');

      if (error) throw error;
      setShiftTemplates(data || []);

      if (data && data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id_template);
      }
    } catch (error: any) {
      console.error('Errore caricamento template:', error);
    }
  };

  const loadShifts = async () => {
    if (!companyProfile || !selectedTemplateId) return;

    setLoading(true);
    try {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);

      const { data, error } = await supabase
        .from('crew_assegnazione_turni')
        .select('*')
        .eq('azienda_id', companyProfile.id)
        .eq('turno_id', selectedTemplateId)
        .gte('data_turno', formatDate(currentWeekStart))
        .lte('data_turno', formatDate(weekEnd))
        .order('ora_inizio_turno', { ascending: true });

      if (error) throw error;
      setShifts(data || []);
    } catch (error: any) {
      addToast(error.message || 'Errore nel caricamento turni', 'error');
    } finally {
      setLoading(false);
    }
  };

  const previousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const nextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const currentWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
  };

  const getShiftsForDate = (date: Date): Shift[] => {
    const dateStr = formatDate(date);
    return shifts.filter(s => s.data_turno === dateStr);
  };

  const handleDragStart = (shift: Shift, sourceDate: string) => {
    setDraggedShift({ shift, sourceDate });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetDate: string) => {
    if (!draggedShift) return;

    if (draggedShift.sourceDate === targetDate) {
      setDraggedShift(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('crew_assegnazione_turni')
        .update({ data_turno: targetDate })
        .eq('id', draggedShift.shift.id);

      if (error) throw error;

      addToast('Turno spostato con successo', 'success');
      loadShifts();
    } catch (error: any) {
      addToast(error.message || 'Errore nello spostamento del turno', 'error');
    } finally {
      setDraggedShift(null);
    }
  };

  const handleShiftClick = (shift: Shift) => {
    if (multiSelectMode) {
      toggleShiftSelection(shift.id);
    } else {
      setEditingShift(shift);
      setShowEditModal(true);
    }
  };

  const handleShiftTouchStart = (shift: Shift) => {
    longPressTimer.current = setTimeout(() => {
      setMultiSelectMode(true);
      setSelectedShiftIds([shift.id]);
      addToast('Modalità selezione multipla attivata', 'success');
    }, 500);
  };

  const handleShiftTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const toggleShiftSelection = (shiftId: string) => {
    setSelectedShiftIds(prev =>
      prev.includes(shiftId)
        ? prev.filter(id => id !== shiftId)
        : [...prev, shiftId]
    );
  };

  const exitMultiSelectMode = () => {
    setMultiSelectMode(false);
    setSelectedShiftIds([]);
  };

  const handlePasteShifts = async (targetDate: string) => {
    if (!multiSelectMode || selectedShiftIds.length === 0 || !companyProfile) return;

    const selectedShifts = shifts.filter(s => selectedShiftIds.includes(s.id));

    try {
      const shiftsToCreate = selectedShifts.map(shift => ({
        dipendente_id: shift.dipendente_id,
        dipendente_nome: shift.dipendente_nome,
        turno_id: shift.turno_id,
        nome_turno: shift.nome_turno,
        ora_inizio_turno: shift.ora_inizio_turno,
        ora_fine_turno: shift.ora_fine_turno,
        nome_magazzino: shift.nome_magazzino,
        indirizzo_magazzino: shift.indirizzo_magazzino,
        warehouse_id: shift.warehouse_id,
        data_turno: targetDate,
        azienda_id: shift.azienda_id,
        nome_azienda: shift.nome_azienda,
      }));

      const { error } = await supabase
        .from('crew_assegnazione_turni')
        .insert(shiftsToCreate);

      if (error) throw error;

      addToast(`${shiftsToCreate.length} turni copiati con successo`, 'success');
      exitMultiSelectMode();
      loadShifts();
    } catch (error: any) {
      addToast(error.message || 'Errore nella copia dei turni', 'error');
    }
  };

  const handleDayClick = (dateStr: string) => {
    if (multiSelectMode) {
      handlePasteShifts(dateStr);
    } else {
      openAddModal(dateStr);
    }
  };

  const handleUpdateShift = async (updatedData: Partial<Shift>) => {
    if (!editingShift) return;

    try {
      const { error } = await supabase
        .from('crew_assegnazione_turni')
        .update(updatedData)
        .eq('id', editingShift.id);

      if (error) throw error;

      addToast('Turno aggiornato con successo', 'success');
      setShowEditModal(false);
      setEditingShift(null);
      loadShifts();
    } catch (error: any) {
      addToast(error.message || 'Errore nell\'aggiornamento del turno', 'error');
    }
  };

  const handleDeleteShift = (shiftId: string) => {
    setShiftToDelete(shiftId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!shiftToDelete) return;

    try {
      const { error } = await supabase
        .from('crew_assegnazione_turni')
        .delete()
        .eq('id', shiftToDelete);

      if (error) throw error;

      addToast('Turno eliminato con successo', 'success');
      setShowEditModal(false);
      setEditingShift(null);
      loadShifts();
    } catch (error: any) {
      addToast(error.message || 'Errore nell\'eliminazione del turno', 'error');
    } finally {
      setShowDeleteModal(false);
      setShiftToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setShiftToDelete(null);
  };

  const handleDeleteMultiple = () => {
    if (selectedShiftIds.length === 0) {
      addToast('Nessun turno selezionato', 'error');
      return;
    }
    setShowDeleteMultipleModal(true);
  };

  const confirmDeleteMultiple = async () => {
    if (selectedShiftIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('crew_assegnazione_turni')
        .delete()
        .in('id', selectedShiftIds);

      if (error) throw error;

      addToast(`${selectedShiftIds.length} turni eliminati con successo`, 'success');
      exitMultiSelectMode();
      loadShifts();
    } catch (error: any) {
      addToast(error.message || 'Errore nell\'eliminazione dei turni', 'error');
    } finally {
      setShowDeleteMultipleModal(false);
    }
  };

  const cancelDeleteMultiple = () => {
    setShowDeleteMultipleModal(false);
  };

  const handleAddShift = async (crewMemberId: string, customTimes?: { ora_inizio: string; ora_fine: string }) => {
    if (!companyProfile || !selectedTemplateId || !addModalDate) return;

    const selectedCrew = crewMembers.find(c => c.id === crewMemberId);
    const selectedTemplate = shiftTemplates.find(t => t.id_template === selectedTemplateId);

    if (!selectedCrew || !selectedTemplate) {
      addToast('Dipendente o turno non valido', 'error');
      return;
    }

    try {
      const shiftData = {
        dipendente_id: crewMemberId,
        dipendente_nome: selectedCrew.full_name || `${selectedCrew.first_name} ${selectedCrew.last_name}`,
        turno_id: selectedTemplateId,
        nome_turno: selectedTemplate.nome_template,
        ora_inizio_turno: customTimes?.ora_inizio || selectedTemplate.ora_inizio_turno,
        ora_fine_turno: customTimes?.ora_fine || selectedTemplate.ora_fine_turno,
        nome_magazzino: selectedTemplate.nome_magazzino,
        indirizzo_magazzino: selectedTemplate.indirizzo_magazzino,
        warehouse_id: selectedTemplate.warehouse_id,
        data_turno: addModalDate,
        azienda_id: companyProfile.id,
        nome_azienda: companyProfile.company_name || '',
      };

      const { error } = await supabase
        .from('crew_assegnazione_turni')
        .insert(shiftData);

      if (error) throw error;

      addToast('Dipendente aggiunto al turno', 'success');
      setShowAddModal(false);
      setAddModalDate('');
      loadShifts();
    } catch (error: any) {
      addToast(error.message || 'Errore nell\'aggiunta del dipendente', 'error');
    }
  };

  const openAddModal = (date: string) => {
    setAddModalDate(date);
    setShowAddModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const selectedTemplate = shiftTemplates.find(t => t.id_template === selectedTemplateId);

  return (
    <div className="space-y-4 pb-20">
      {multiSelectMode && (
        <div className="bg-green-600 rounded-xl border border-green-500 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Copy className="w-5 h-5 text-white" />
              <div>
                <div className="text-white font-semibold">
                  Modalità Selezione Attiva
                </div>
                <div className="text-green-100 text-sm">
                  {selectedShiftIds.length} turno{selectedShiftIds.length !== 1 ? 'i' : ''} selezionato{selectedShiftIds.length !== 1 ? 'i' : ''}
                </div>
              </div>
            </div>
            <button
              onClick={exitMultiSelectMode}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteMultiple}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Elimina Selezionati</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Seleziona Template Turno
        </label>
        <select
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
          className="w-full bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          disabled={multiSelectMode}
        >
          {shiftTemplates.map((template) => (
            <option key={template.id_template} value={template.id_template}>
              {template.nome_template} - {template.nome_magazzino} ({template.ora_inizio_turno.slice(0, 5)} - {template.ora_fine_turno.slice(0, 5)})
            </option>
          ))}
        </select>
      </div>

      {selectedTemplate && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-blue-400" />
            <div>
              <span className="text-white font-medium">{selectedTemplate.nome_magazzino}</span>
              {selectedTemplate.indirizzo_magazzino && (
                <span className="text-gray-400 ml-2">{selectedTemplate.indirizzo_magazzino}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm mt-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-gray-300">
              {selectedTemplate.ora_inizio_turno.slice(0, 5)} - {selectedTemplate.ora_fine_turno.slice(0, 5)}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 rounded-xl border border-gray-700">
        <button
          onClick={previousWeek}
          disabled={multiSelectMode}
          className={`p-2 rounded-lg transition-colors ${
            multiSelectMode ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'
          }`}
        >
          <ChevronLeft className="w-5 h-5 text-gray-300" />
        </button>

        <div className="text-center">
          <button
            onClick={currentWeek}
            disabled={multiSelectMode}
            className={`text-lg font-semibold text-white transition-colors ${
              multiSelectMode ? 'cursor-not-allowed' : 'hover:text-blue-400'
            }`}
          >
            {formatDateDisplay(weekDays[0])} - {formatDateDisplay(weekDays[6])}
          </button>
          <p className="text-xs text-gray-400 mt-1">
            {multiSelectMode ? 'Clicca su altri dipendenti o su un giorno' : 'Tocca per oggi'}
          </p>
        </div>

        <button
          onClick={nextWeek}
          disabled={multiSelectMode}
          className={`p-2 rounded-lg transition-colors ${
            multiSelectMode ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'
          }`}
        >
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2 md:gap-1">
        {weekDays.map((day, index) => {
          const dateStr = formatDate(day);
          const dayShifts = getShiftsForDate(day);
          const isToday = formatDate(new Date()) === dateStr;

          return (
            <div
              key={index}
              className={`min-h-[100px] md:min-h-[120px] rounded-lg border ${
                isToday
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-gray-700 bg-gray-800'
              }`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(dateStr)}
            >
              <div className={`text-center py-2 md:py-2 border-b ${
                isToday ? 'border-blue-500' : 'border-gray-700'
              }`}>
                <div className="text-sm md:text-xs text-gray-400 uppercase font-medium md:font-normal">
                  {day.toLocaleDateString('it-IT', { weekday: window.innerWidth < 768 ? 'long' : 'short' })}
                </div>
                <div className={`text-base md:text-sm font-semibold ${
                  isToday ? 'text-blue-400' : 'text-white'
                }`}>
                  {day.getDate()} {window.innerWidth < 768 && day.toLocaleDateString('it-IT', { month: 'short' })}
                </div>
              </div>

              <div className="p-2 md:p-1 space-y-1.5 md:space-y-1">
                {dayShifts.map((shift) => {
                  const isSelected = selectedShiftIds.includes(shift.id);
                  return (
                    <div
                      key={shift.id}
                      draggable={!multiSelectMode}
                      onDragStart={() => !multiSelectMode && handleDragStart(shift, dateStr)}
                      onClick={() => handleShiftClick(shift)}
                      onTouchStart={() => handleShiftTouchStart(shift)}
                      onTouchEnd={handleShiftTouchEnd}
                      onMouseDown={() => handleShiftTouchStart(shift)}
                      onMouseUp={handleShiftTouchEnd}
                      onMouseLeave={handleShiftTouchEnd}
                      className={`rounded p-2 md:p-1.5 text-white text-sm md:text-xs transition-all ${
                        isSelected
                          ? 'bg-green-600 border-2 border-green-400 shadow-lg'
                          : 'bg-blue-600 hover:bg-blue-700 border-2 border-transparent'
                      } ${multiSelectMode ? 'cursor-pointer' : 'cursor-move'}`}
                      title={`${shift.dipendente_nome}\n${shift.nome_magazzino}\n${shift.ora_inizio_turno.slice(0, 5)} - ${shift.ora_fine_turno.slice(0, 5)}`}
                    >
                      <div className="font-medium truncate">
                        {shift.dipendente_nome}
                      </div>
                      <div className="flex items-center gap-1 text-blue-200 mt-0.5">
                        <Clock className="w-3 h-3 md:w-2.5 md:h-2.5" />
                        <span className="truncate">
                          {shift.ora_inizio_turno.slice(0, 5)}-{shift.ora_fine_turno.slice(0, 5)}
                        </span>
                      </div>
                      <div className="block md:hidden text-xs text-blue-100 mt-1 truncate">
                        {shift.nome_magazzino}
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={() => handleDayClick(dateStr)}
                  className={`w-full rounded p-2 md:p-1.5 text-sm md:text-xs transition-colors flex items-center justify-center gap-1 ${
                    multiSelectMode
                      ? 'bg-green-600 hover:bg-green-700 text-white font-semibold'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
                  }`}
                >
                  {multiSelectMode ? (
                    <>
                      <Copy className="w-4 h-4 md:w-3 md:h-3" />
                      <span>Incolla qui</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl md:text-lg leading-none">+</span>
                      <span>Aggiungi</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showEditModal && editingShift && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-end sm:items-center justify-center z-50">
          <div className="bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-y-auto border border-gray-700">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4">
              <h3 className="text-xl font-bold text-white">Modifica Turno</h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-400 mb-2">Dipendente</div>
                <div className="text-white font-semibold">{editingShift.dipendente_nome}</div>
              </div>

              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-400 mb-2">Data</div>
                <input
                  type="date"
                  value={editingShift.data_turno}
                  onChange={(e) => setEditingShift({ ...editingShift, data_turno: e.target.value })}
                  className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-400 mb-2">Template Turno</div>
                <select
                  value={editingShift.turno_id}
                  onChange={(e) => {
                    const template = shiftTemplates.find(t => t.id_template === e.target.value);
                    if (template) {
                      setEditingShift({
                        ...editingShift,
                        turno_id: e.target.value,
                        nome_turno: template.nome_template,
                        ora_inizio_turno: template.ora_inizio_turno,
                        ora_fine_turno: template.ora_fine_turno,
                        nome_magazzino: template.nome_magazzino,
                        indirizzo_magazzino: template.indirizzo_magazzino,
                        warehouse_id: template.warehouse_id,
                      });
                    }
                  }}
                  className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {shiftTemplates.map((template) => (
                    <option key={template.id_template} value={template.id_template}>
                      {template.nome_template} - {template.nome_magazzino} ({template.ora_inizio_turno.slice(0, 5)} - {template.ora_fine_turno.slice(0, 5)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                  <div>
                    <div className="text-white font-medium">{editingShift.nome_magazzino}</div>
                    {editingShift.indirizzo_magazzino && (
                      <div className="text-sm text-gray-400 mt-1">{editingShift.indirizzo_magazzino}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => handleDeleteShift(editingShift.id)}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Elimina
                </button>
                <button
                  onClick={() => handleUpdateShift(editingShift)}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Salva
                </button>
              </div>

              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingShift(null);
                }}
                className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      <ModaleAggiungiDipendente
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setAddModalDate('');
        }}
        date={addModalDate}
        crewMembers={crewMembers}
        shifts={shifts}
        selectedTemplate={selectedTemplate}
        onAddShift={handleAddShift}
      />

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Elimina Turno
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Sei sicuro di voler eliminare questo turno? Questa azione non può essere annullata.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Elimina
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteMultipleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Elimina Turni Selezionati
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Sei sicuro di voler eliminare {selectedShiftIds.length} turno{selectedShiftIds.length !== 1 ? 'i' : ''}? Questa azione non può essere annullata.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={cancelDeleteMultiple}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={confirmDeleteMultiple}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Elimina Tutto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
