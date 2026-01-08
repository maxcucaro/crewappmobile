import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToast } from '../../context/ToastContext';
import { Calendar, MapPin, Users, Plus, Edit2, Trash2, X, Grid3x3, List } from 'lucide-react';
import { WeeklyShiftsView } from './WeeklyShiftsView';

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

interface Warehouse {
  id: string;
  name: string;
  address: string;
}

export const ShiftsView: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState<'list' | 'weekly'>('weekly');
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showModal, setShowModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    dipendente_id: '',
    turno_id: '',
    data_turno: new Date().toISOString().split('T')[0],
    ora_inizio_turno: '',
    ora_fine_turno: '',
  });

  useEffect(() => {
    const handleOrientationChange = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  useEffect(() => {
    if (companyProfile) {
      loadInitialData();
    }
  }, [companyProfile]);

  useEffect(() => {
    if (companyProfile) {
      loadShifts();
    }
  }, [companyProfile, selectedDate]);

  useEffect(() => {
    if (formData.turno_id) {
      const selectedTemplate = shiftTemplates.find(t => t.id_template === formData.turno_id);
      if (selectedTemplate) {
        setFormData(prev => ({
          ...prev,
          ora_inizio_turno: selectedTemplate.ora_inizio_turno,
          ora_fine_turno: selectedTemplate.ora_fine_turno,
        }));
      }
    }
  }, [formData.turno_id, shiftTemplates]);

  const loadInitialData = async () => {
    await Promise.all([
      loadCrewMembers(),
      loadShiftTemplates(),
      loadWarehouses(),
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
    } catch (error: any) {
      console.error('Errore caricamento template:', error);
    }
  };

  const loadWarehouses = async () => {
    if (!companyProfile) return;

    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, address')
        .eq('company_id', companyProfile.id)
        .order('name');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error: any) {
      console.error('Errore caricamento magazzini:', error);
    }
  };

  const loadShifts = async () => {
    if (!companyProfile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crew_assegnazione_turni')
        .select('*')
        .eq('azienda_id', companyProfile.id)
        .gte('data_turno', selectedDate)
        .order('data_turno', { ascending: true })
        .order('ora_inizio_turno', { ascending: true })
        .limit(100);

      if (error) throw error;
      setShifts(data || []);
    } catch (error: any) {
      addToast(error.message || 'Errore nel caricamento turni', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingShift(null);
    setSelectedEmployees([]);
    setFormData({
      dipendente_id: '',
      turno_id: '',
      data_turno: new Date().toISOString().split('T')[0],
      ora_inizio_turno: '',
      ora_fine_turno: '',
    });
    setShowModal(true);
  };

  const openEditModal = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      dipendente_id: shift.dipendente_id,
      turno_id: shift.turno_id,
      data_turno: shift.data_turno,
      ora_inizio_turno: shift.ora_inizio_turno,
      ora_fine_turno: shift.ora_fine_turno,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingShift(null);
    setSelectedEmployees([]);
    setFormData({
      dipendente_id: '',
      turno_id: '',
      data_turno: new Date().toISOString().split('T')[0],
      ora_inizio_turno: '',
      ora_fine_turno: '',
    });
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyProfile || !formData.turno_id || !formData.data_turno) {
      addToast('Compila tutti i campi obbligatori', 'error');
      return;
    }

    if (editingShift) {
      if (!formData.dipendente_id) {
        addToast('Seleziona un dipendente', 'error');
        return;
      }

      if (!formData.ora_inizio_turno || !formData.ora_fine_turno) {
        addToast('Inserisci gli orari del turno', 'error');
        return;
      }

      try {
        const selectedCrew = crewMembers.find(c => c.id === formData.dipendente_id);
        const selectedTemplate = shiftTemplates.find(t => t.id_template === formData.turno_id);

        if (!selectedCrew || !selectedTemplate) {
          addToast('Dipendente o turno non valido', 'error');
          return;
        }

        const shiftData = {
          dipendente_id: formData.dipendente_id,
          dipendente_nome: selectedCrew.full_name || `${selectedCrew.first_name} ${selectedCrew.last_name}`,
          turno_id: formData.turno_id,
          nome_turno: selectedTemplate.nome_template,
          ora_inizio_turno: formData.ora_inizio_turno,
          ora_fine_turno: formData.ora_fine_turno,
          nome_magazzino: selectedTemplate.nome_magazzino,
          indirizzo_magazzino: selectedTemplate.indirizzo_magazzino,
          warehouse_id: selectedTemplate.warehouse_id,
          data_turno: formData.data_turno,
          azienda_id: companyProfile.id,
          nome_azienda: companyProfile.company_name || '',
        };

        const { error } = await supabase
          .from('crew_assegnazione_turni')
          .update(shiftData)
          .eq('id', editingShift.id);

        if (error) throw error;
        addToast('Turno modificato con successo', 'success');
        closeModal();
        loadShifts();
      } catch (error: any) {
        addToast(error.message || 'Errore nel salvare il turno', 'error');
      }
    } else {
      if (selectedEmployees.length === 0) {
        addToast('Seleziona almeno un dipendente', 'error');
        return;
      }

      try {
        const selectedTemplate = shiftTemplates.find(t => t.id_template === formData.turno_id);
        if (!selectedTemplate) {
          addToast('Turno non valido', 'error');
          return;
        }

        const shiftsToCreate = selectedEmployees.map(employeeId => {
          const selectedCrew = crewMembers.find(c => c.id === employeeId);
          return {
            dipendente_id: employeeId,
            dipendente_nome: selectedCrew?.full_name || `${selectedCrew?.first_name} ${selectedCrew?.last_name}`,
            turno_id: formData.turno_id,
            nome_turno: selectedTemplate.nome_template,
            ora_inizio_turno: selectedTemplate.ora_inizio_turno,
            ora_fine_turno: selectedTemplate.ora_fine_turno,
            nome_magazzino: selectedTemplate.nome_magazzino,
            indirizzo_magazzino: selectedTemplate.indirizzo_magazzino,
            warehouse_id: selectedTemplate.warehouse_id,
            data_turno: formData.data_turno,
            azienda_id: companyProfile.id,
            nome_azienda: companyProfile.company_name || '',
          };
        });

        const { error } = await supabase
          .from('crew_assegnazione_turni')
          .insert(shiftsToCreate);

        if (error) throw error;
        addToast(`${shiftsToCreate.length} turni creati con successo`, 'success');
        closeModal();
        loadShifts();
      } catch (error: any) {
        addToast(error.message || 'Errore nel salvare i turni', 'error');
      }
    }
  };

  const handleDelete = (shiftId: string) => {
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

  const groupedShifts = shifts.reduce((acc, shift) => {
    const date = shift.data_turno;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

  if (viewMode === 'weekly') {
    return (
      <div className={`space-y-4 ${isLandscape ? 'landscape-mode' : ''}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className={`font-bold text-gray-900 ${isLandscape ? 'text-xl' : 'text-2xl'}`}>
              Gestione Turni Magazzino
            </h2>
            <p className={`text-gray-600 mt-1 ${isLandscape ? 'text-sm' : ''}`}>
              Pianificazione settimanale turni
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => setViewMode('weekly')}
                className={`flex items-center gap-2 ${isLandscape ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-md transition-colors ${
                  viewMode === 'weekly'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Calendario</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 ${isLandscape ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Lista</span>
              </button>
            </div>
          </div>
        </div>
        <div className={isLandscape ? 'overflow-x-auto' : ''}>
          <WeeklyShiftsView />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isLandscape ? 'landscape-mode' : 'space-y-6'}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`font-bold text-gray-900 ${isLandscape ? 'text-xl' : 'text-2xl'}`}>
            Gestione Turni Magazzino
          </h2>
          <p className={`text-gray-600 mt-1 ${isLandscape ? 'text-sm' : ''}`}>
            Crea, modifica ed elimina turni di magazzino
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-200 rounded-lg p-1">
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-2 ${isLandscape ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-md transition-colors ${
                viewMode === 'weekly'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Calendario</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 ${isLandscape ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Lista</span>
            </button>
          </div>
          <button
            onClick={openCreateModal}
            className={`flex items-center gap-2 ${isLandscape ? 'px-3 py-1.5' : 'px-4 py-2'} bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${isLandscape ? 'text-sm' : ''}`}
          >
            <Plus className={isLandscape ? 'w-4 h-4' : 'w-5 h-5'} />
            <span className="hidden sm:inline">Nuovo Turno</span>
            <span className="sm:hidden">+</span>
          </button>
        </div>
      </div>

      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${isLandscape ? 'p-3' : 'p-4'}`}>
        <label className={`block font-medium text-gray-700 mb-2 ${isLandscape ? 'text-xs' : 'text-sm'}`}>
          Visualizza turni a partire da:
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className={`border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isLandscape ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}
        />
      </div>

      {loading ? (
        <div className={`flex items-center justify-center ${isLandscape ? 'h-48' : 'h-64'}`}>
          <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${isLandscape ? 'h-8 w-8' : 'h-12 w-12'}`}></div>
        </div>
      ) : (
        <div className={isLandscape ? 'space-y-3' : 'space-y-6'}>
          {Object.keys(groupedShifts).length === 0 ? (
            <div className={`bg-white rounded-xl shadow-sm border border-gray-200 text-center text-gray-500 ${isLandscape ? 'p-6' : 'p-8'}`}>
              Nessun turno programmato per questo periodo
            </div>
          ) : (
            Object.entries(groupedShifts).map(([date, dayShifts]) => (
              <div key={date} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className={`bg-blue-50 border-b border-blue-100 ${isLandscape ? 'px-4 py-2' : 'px-6 py-3'}`}>
                  <div className="flex items-center gap-2">
                    <Calendar className={isLandscape ? 'w-4 h-4 text-blue-600' : 'w-5 h-5 text-blue-600'} />
                    <h3 className={`font-semibold text-gray-900 ${isLandscape ? 'text-sm' : ''}`}>
                      {new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h3>
                    <span className={`ml-auto text-gray-600 ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                      {dayShifts.length} {dayShifts.length === 1 ? 'turno' : 'turni'}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {dayShifts.map((shift) => (
                    <div key={shift.id} className={`hover:bg-gray-50 ${isLandscape ? 'p-3' : 'p-6'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className={`flex items-center gap-3 ${isLandscape ? 'mb-2' : 'mb-3'}`}>
                            <div className={`bg-blue-100 rounded-lg ${isLandscape ? 'p-1.5' : 'p-2'}`}>
                              <Users className={isLandscape ? 'w-4 h-4 text-blue-600' : 'w-5 h-5 text-blue-600'} />
                            </div>
                            <div>
                              <h4 className={`font-semibold text-gray-900 ${isLandscape ? 'text-sm' : ''}`}>
                                {shift.dipendente_nome}
                              </h4>
                              <p className={`text-gray-600 ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                                {shift.ora_inizio_turno.slice(0, 5)} - {shift.ora_fine_turno.slice(0, 5)}
                              </p>
                              {shift.nome_turno && (
                                <p className={`text-gray-500 mt-1 ${isLandscape ? 'text-xs' : 'text-xs'}`}>
                                  Turno: {shift.nome_turno}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className={`flex items-start gap-2 text-gray-600 ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                            <MapPin className={`mt-0.5 flex-shrink-0 ${isLandscape ? 'w-3 h-3' : 'w-4 h-4'}`} />
                            <div>
                              <p className={`font-medium text-gray-900 ${isLandscape ? 'text-xs' : ''}`}>
                                {shift.nome_magazzino}
                              </p>
                              {shift.indirizzo_magazzino && (
                                <p className={isLandscape ? 'text-xs' : ''}>{shift.indirizzo_magazzino}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => openEditModal(shift)}
                            className={`text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ${isLandscape ? 'p-1.5' : 'p-2'}`}
                            title="Modifica turno"
                          >
                            <Edit2 className={isLandscape ? 'w-4 h-4' : 'w-5 h-5'} />
                          </button>
                          <button
                            onClick={() => handleDelete(shift.id)}
                            className={`text-red-600 hover:bg-red-50 rounded-lg transition-colors ${isLandscape ? 'p-1.5' : 'p-2'}`}
                            title="Elimina turno"
                          >
                            <Trash2 className={isLandscape ? 'w-4 h-4' : 'w-5 h-5'} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-xl shadow-xl max-w-2xl w-full flex flex-col ${isLandscape ? 'max-h-[90vh]' : 'max-h-[85vh]'}`}>
            <div className={`bg-white border-b border-gray-200 flex items-center justify-between rounded-t-xl ${isLandscape ? 'px-4 py-2' : 'px-6 py-4'}`}>
              <h3 className={`font-bold text-gray-900 ${isLandscape ? 'text-lg' : 'text-xl'}`}>
                {editingShift ? 'Modifica Turno' : 'Nuovo Turno'}
              </h3>
              <button
                onClick={closeModal}
                className={`hover:bg-gray-100 rounded-lg transition-colors ${isLandscape ? 'p-1.5' : 'p-2'}`}
              >
                <X className={isLandscape ? 'w-4 h-4' : 'w-5 h-5'} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={`flex-1 overflow-y-auto space-y-4 ${isLandscape ? 'p-4' : 'p-6'}`}>
              {!editingShift && (
                <div>
                  <label className={`block font-medium text-gray-700 mb-2 ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                    Dipendenti * ({selectedEmployees.length} selezionati)
                  </label>
                  <div className={`border border-gray-300 rounded-lg overflow-y-auto ${isLandscape ? 'max-h-32' : 'max-h-48'}`}>
                    {crewMembers.map((crew) => (
                      <label
                        key={crew.id}
                        className={`flex items-center gap-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 ${isLandscape ? 'px-3 py-2' : 'px-4 py-3'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(crew.id)}
                          onChange={() => toggleEmployeeSelection(crew.id)}
                          className={`text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 ${isLandscape ? 'w-4 h-4' : 'w-5 h-5'}`}
                        />
                        <span className={`text-gray-900 ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                          {crew.full_name || `${crew.first_name} ${crew.last_name}`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {editingShift && (
                <div>
                  <label className={`block font-medium text-gray-700 mb-2 ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                    Dipendente *
                  </label>
                  <select
                    value={formData.dipendente_id}
                    onChange={(e) => setFormData({ ...formData, dipendente_id: e.target.value })}
                    className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isLandscape ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}
                    required
                  >
                    <option value="">Seleziona dipendente</option>
                    {crewMembers.map((crew) => (
                      <option key={crew.id} value={crew.id}>
                        {crew.full_name || `${crew.first_name} ${crew.last_name}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={`block font-medium text-gray-700 mb-2 ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                  Template Turno *
                </label>
                <select
                  value={formData.turno_id}
                  onChange={(e) => setFormData({ ...formData, turno_id: e.target.value })}
                  className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isLandscape ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}
                  required
                >
                  <option value="">Seleziona turno</option>
                  {shiftTemplates.map((template) => (
                    <option key={template.id_template} value={template.id_template}>
                      {template.nome_template} - {template.nome_magazzino} ({template.ora_inizio_turno.slice(0, 5)} - {template.ora_fine_turno.slice(0, 5)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block font-medium text-gray-700 mb-2 ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                  Data Turno *
                </label>
                <input
                  type="date"
                  value={formData.data_turno}
                  onChange={(e) => setFormData({ ...formData, data_turno: e.target.value })}
                  className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isLandscape ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}
                  required
                />
              </div>

              {editingShift && (
                <>
                  <div>
                    <label className={`block font-medium text-gray-700 mb-2 ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                      Ora Inizio *
                    </label>
                    <input
                      type="time"
                      value={formData.ora_inizio_turno}
                      onChange={(e) => setFormData({ ...formData, ora_inizio_turno: e.target.value })}
                      className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isLandscape ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block font-medium text-gray-700 mb-2 ${isLandscape ? 'text-xs' : 'text-sm'}`}>
                      Ora Fine *
                    </label>
                    <input
                      type="time"
                      value={formData.ora_fine_turno}
                      onChange={(e) => setFormData({ ...formData, ora_fine_turno: e.target.value })}
                      className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isLandscape ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}
                      required
                    />
                  </div>
                </>
              )}
            </form>

            <div className={`bg-gray-50 border-t border-gray-200 flex gap-3 rounded-b-xl ${isLandscape ? 'px-4 py-3' : 'px-6 py-4'}`}>
              <button
                type="button"
                onClick={closeModal}
                className={`flex-1 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors ${isLandscape ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}
              >
                Annulla
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className={`flex-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${isLandscape ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}
              >
                {editingShift ? 'Salva Modifiche' : `Crea ${selectedEmployees.length || 0} Turno${selectedEmployees.length !== 1 ? 'i' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className={isLandscape ? 'p-4' : 'p-6'}>
              <div className={`flex items-center justify-center bg-red-100 rounded-full mx-auto ${isLandscape ? 'w-10 h-10 mb-3' : 'w-12 h-12 mb-4'}`}>
                <Trash2 className={isLandscape ? 'w-5 h-5 text-red-600' : 'w-6 h-6 text-red-600'} />
              </div>
              <h3 className={`font-bold text-gray-900 text-center ${isLandscape ? 'text-lg mb-2' : 'text-xl mb-2'}`}>
                Elimina Turno
              </h3>
              <p className={`text-gray-600 text-center ${isLandscape ? 'text-sm mb-4' : 'mb-6'}`}>
                Sei sicuro di voler eliminare questo turno? Questa azione non può essere annullata.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  className={`flex-1 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors ${isLandscape ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}
                >
                  Annulla
                </button>
                <button
                  onClick={confirmDelete}
                  className={`flex-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors ${isLandscape ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}
                >
                  Elimina
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
