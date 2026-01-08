import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Plus,
  Search,
  Calendar,
  Clock,
  MapPin,
  Users,
  BookOpen,
  Edit,
  Trash2,
  UserPlus,
  X,
  Eye,
  Filter,
  Check
} from 'lucide-react';

interface Course {
  id: string;
  titolo: string;
  descrizione: string | null;
  data_corso: string;
  ora_inizio: string;
  ora_fine: string;
  luogo: string;
  istruttore: string | null;
  categoria: string;
  obbligatorio: boolean;
  max_partecipanti: number;
  materiali: string[];
  visibilita: string;
  stato: string;
  confermato: boolean;
  note: string | null;
  created_at: string;
  partecipanti_count?: number;
}

interface CourseAssignment {
  id: string;
  persona_id: string;
  persona_nome: string;
  persona_email: string;
  stato_invito: string;
  data_conferma: string | null;
  data_partecipazione: string | null;
  certificato_rilasciato: boolean;
}

export const CoursesView: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const { addToast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [assigningCourse, setAssigningCourse] = useState<Course | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const categories = [
    { value: 'tecnico', label: 'Tecnico' },
    { value: 'sicurezza', label: 'Sicurezza' },
    { value: 'gestionale', label: 'Gestionale' },
    { value: 'comunicazione', label: 'Comunicazione' },
    { value: 'altro', label: 'Altro' }
  ];

  const statusOptions = [
    { value: 'bozza', label: 'Bozza', color: 'gray' },
    { value: 'pubblicato', label: 'Pubblicato', color: 'blue' },
    { value: 'confermato', label: 'Confermato', color: 'green' },
    { value: 'completato', label: 'Completato', color: 'emerald' },
    { value: 'annullato', label: 'Annullato', color: 'red' }
  ];

  useEffect(() => {
    loadCourses();
  }, [companyProfile]);

  const loadCourses = async () => {
    if (!companyProfile) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('crew_corsi')
        .select(`
          *,
          partecipanti_count:crew_assegnazionecorsi(count)
        `)
        .eq('azienda_id', companyProfile.id)
        .order('data_corso', { ascending: false });

      if (error) throw error;

      const coursesWithCount = data?.map(course => ({
        ...course,
        partecipanti_count: course.partecipanti_count?.[0]?.count || 0
      })) || [];

      setCourses(coursesWithCount);
    } catch (error: any) {
      addToast(error.message || 'Errore nel caricamento corsi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch =
      course.titolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.descrizione?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.luogo.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = filterCategory === 'all' || course.categoria === filterCategory;
    const matchesStatus = filterStatus === 'all' || course.stato === filterStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleCreateCourse = () => {
    setSelectedCourse(null);
    setEditMode(false);
    setShowCreateModal(true);
  };

  const handleEditCourse = (course: Course) => {
    setSelectedCourse(course);
    setEditMode(true);
    setShowCreateModal(true);
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo corso?')) return;

    try {
      const { error } = await supabase
        .from('crew_corsi')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      addToast('Corso eliminato con successo', 'success');
      loadCourses();
    } catch (error: any) {
      addToast(error.message || 'Errore durante l\'eliminazione', 'error');
    }
  };

  const handleViewDetails = (course: Course) => {
    setSelectedCourse(course);
    setShowDetailsModal(true);
  };

  const handleAssignParticipants = async (course: Course) => {
    setAssigningCourse(course);
    setSelectedEmployees(new Set());

    try {
      const [employeesResult, assignmentsResult] = await Promise.all([
        supabase
          .from('registration_requests')
          .select('id, full_name, email, tipologia_registrazione')
          .eq('parent_company_id', companyProfile!.id)
          .eq('status', 'approved')
          .in('tipologia_registrazione', ['dipendente', 'freelance'])
          .order('full_name', { ascending: true }),

        supabase
          .from('crew_assegnazionecorsi')
          .select('persona_id')
          .eq('corso_id', course.id)
      ]);

      if (employeesResult.error) throw employeesResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;

      setEmployees(employeesResult.data || []);
      setAssignments(assignmentsResult.data || []);
    } catch (error: any) {
      addToast(error.message || 'Errore caricamento dipendenti', 'error');
    }
  };

  const handleConfirmCourse = (course: Course) => {
    setSelectedCourse(course);
    setShowConfirmModal(true);
  };

  const confirmCourse = async () => {
    if (!selectedCourse) return;

    try {
      const { error } = await supabase
        .from('crew_corsi')
        .update({
          stato: 'confermato',
          confermato: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCourse.id);

      if (error) throw error;

      addToast('Corso confermato con successo', 'success');
      setShowConfirmModal(false);
      setSelectedCourse(null);
      loadCourses();
    } catch (error: any) {
      addToast(error.message || 'Errore durante la conferma', 'error');
    }
  };

  const handleToggleEmployee = (employeeId: string) => {
    const newSet = new Set(selectedEmployees);
    if (newSet.has(employeeId)) {
      newSet.delete(employeeId);
    } else {
      const assignedIds = assignments.map((a: any) => a.persona_id);
      const remainingSlots = (assigningCourse?.max_partecipanti || 0) - assignedIds.length;

      if (newSet.size >= remainingSlots) {
        addToast(`Massimo ${assigningCourse?.max_partecipanti} partecipanti raggiunto`, 'error');
        return;
      }

      newSet.add(employeeId);
    }
    setSelectedEmployees(newSet);
  };

  const handleSaveAssignments = async () => {
    if (!assigningCourse || selectedEmployees.size === 0) {
      addToast('Seleziona almeno un dipendente', 'error');
      return;
    }

    try {
      setSaving(true);

      const assignmentsToInsert = Array.from(selectedEmployees).map(employeeId => {
        const employee = employees.find(e => e.id === employeeId);
        const now = new Date().toISOString();
        return {
          azienda_id: companyProfile!.id,
          corso_id: assigningCourse.id,
          corso_titolo: assigningCourse.titolo,
          persona_id: employeeId,
          persona_nome: employee?.full_name,
          persona_tipo: employee?.tipologia_registrazione || 'dipendente',
          persona_email: employee?.email,
          stato_invito: 'confermato',
          data_invito: now,
          data_conferma: now
        };
      });

      const { error } = await supabase
        .from('crew_assegnazionecorsi')
        .insert(assignmentsToInsert);

      if (error) throw error;

      addToast(`${selectedEmployees.size} partecipanti assegnati con successo`, 'success');
      setAssigningCourse(null);
      setSelectedEmployees(new Set());
      setEmployees([]);
      setAssignments([]);
      loadCourses();
    } catch (error: any) {
      addToast(error.message || 'Errore durante l\'assegnazione', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusOption = statusOptions.find(s => s.value === status);
    return statusOption?.color || 'gray';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (assigningCourse) {
    const assignedIds = assignments.map((a: any) => a.persona_id);
    const remainingSlots = assigningCourse.max_partecipanti - assignedIds.length;

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 space-y-4 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Assegna Partecipanti</h1>
          <button
            onClick={() => {
              setAssigningCourse(null);
              setSelectedEmployees(new Set());
              setEmployees([]);
              setAssignments([]);
            }}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold text-white mb-2">{assigningCourse.titolo}</h3>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{new Date(assigningCourse.data_corso).toLocaleDateString('it-IT')}</span>
            </div>
            {assigningCourse.luogo && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{assigningCourse.luogo}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>
                {assignedIds.length + selectedEmployees.size} / {assigningCourse.max_partecipanti} partecipanti
                {assignedIds.length > 0 && <span className="text-green-400 ml-1">({assignedIds.length} già assegnati)</span>}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-3">
            Seleziona Dipendenti ({selectedEmployees.size} / {remainingSlots} disponibili)
          </h3>

          {employees.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Nessun dipendente disponibile</p>
            </div>
          ) : (
            <div className="space-y-2">
              {employees.map(employee => {
                const isSelected = selectedEmployees.has(employee.id);
                const isAlreadyAssigned = assignedIds.includes(employee.id);

                return (
                  <button
                    key={employee.id}
                    onClick={() => !isAlreadyAssigned && handleToggleEmployee(employee.id)}
                    disabled={isAlreadyAssigned}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                      isAlreadyAssigned
                        ? 'bg-green-600/30 border-green-500 cursor-not-allowed'
                        : isSelected
                        ? 'bg-blue-500/20 border-blue-500'
                        : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isAlreadyAssigned
                          ? 'bg-green-500'
                          : isSelected
                          ? 'bg-blue-500'
                          : 'bg-gray-700'
                      }`}>
                        {isAlreadyAssigned || isSelected ? (
                          <Check className="h-6 w-6 text-white" />
                        ) : (
                          <Users className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="text-left">
                        <p className={`font-semibold ${isAlreadyAssigned ? 'text-green-300' : 'text-white'}`}>
                          {employee.full_name}
                        </p>
                        <p className={`text-sm ${isAlreadyAssigned ? 'text-green-400 font-medium' : 'text-gray-400'} capitalize`}>
                          {isAlreadyAssigned ? 'Già assegnato' : employee.tipologia_registrazione}
                        </p>
                      </div>
                    </div>
                    {isAlreadyAssigned && (
                      <span className="text-sm text-green-300 font-bold bg-green-500/20 px-3 py-1 rounded-full">
                        ASSEGNATO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedEmployees.size > 0 && (
          <button
            onClick={handleSaveAssignments}
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white py-4 rounded-lg font-medium text-lg flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Salvataggio...</span>
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                <span>Conferma Assegnazioni ({selectedEmployees.size})</span>
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Gestione Corsi</h1>
            <p className="text-gray-400 text-sm mt-1">Organizza e monitora i corsi di formazione</p>
          </div>
        </div>

        <button
          onClick={handleCreateCourse}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Nuovo Corso</span>
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca corsi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Categoria
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tutte</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Stato
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tutti</option>
              {statusOptions.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredCourses.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Nessun corso trovato</h3>
          <p className="text-gray-400 mb-6">
            {searchTerm || filterCategory !== 'all' || filterStatus !== 'all'
              ? 'Prova a modificare i filtri di ricerca'
              : 'Inizia creando il tuo primo corso di formazione'}
          </p>
          {!searchTerm && filterCategory === 'all' && filterStatus === 'all' && (
            <button
              onClick={handleCreateCourse}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Crea Primo Corso</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCourses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={handleEditCourse}
              onDelete={handleDeleteCourse}
              onViewDetails={handleViewDetails}
              onAssignParticipants={handleAssignParticipants}
              onConfirm={handleConfirmCourse}
              getStatusColor={getStatusColor}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CourseFormModal
          course={selectedCourse}
          isEdit={editMode}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedCourse(null);
            setEditMode(false);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setSelectedCourse(null);
            setEditMode(false);
            loadCourses();
          }}
          categories={categories}
          statusOptions={statusOptions}
        />
      )}

      {showDetailsModal && selectedCourse && (
        <CourseDetailsModal
          course={selectedCourse}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedCourse(null);
          }}
        />
      )}

      {showConfirmModal && selectedCourse && (
        <div className="fixed top-16 left-0 right-0 bottom-0 z-30 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-md p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-600/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Conferma Corso</h3>
                <p className="text-sm text-gray-400">Questa azione renderà il corso visibile</p>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
              <p className="text-white font-medium">{selectedCourse.titolo}</p>
              <p className="text-sm text-gray-400">
                Il corso passerà allo stato <span className="text-green-400 font-medium">"Confermato"</span> e sarà visibile a tutti i dipendenti assegnati.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedCourse(null);
                }}
                className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                Annulla
              </button>
              <button
                onClick={confirmCourse}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface CourseCardProps {
  course: Course;
  onEdit: (course: Course) => void;
  onDelete: (id: string) => void;
  onViewDetails: (course: Course) => void;
  onAssignParticipants: (course: Course) => void;
  onConfirm: (course: Course) => void;
  getStatusColor: (status: string) => string;
}

const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onEdit,
  onDelete,
  onViewDetails,
  onAssignParticipants,
  onConfirm,
  getStatusColor
}) => {
  const statusColor = getStatusColor(course.stato);
  const statusColorClasses = {
    gray: 'bg-gray-700 text-gray-300',
    blue: 'bg-blue-900/50 text-blue-300',
    yellow: 'bg-yellow-900/50 text-yellow-300',
    green: 'bg-green-900/50 text-green-300',
    red: 'bg-red-900/50 text-red-300'
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-white mb-1 truncate">{course.titolo}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${statusColorClasses[statusColor as keyof typeof statusColorClasses]}`}>
                {course.stato.replace('_', ' ').toUpperCase()}
              </span>
              {course.obbligatorio && (
                <span className="bg-red-900/50 text-red-300 text-xs px-2 py-0.5 rounded font-medium">
                  OBBLIGATORIO
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="truncate">{formatDate(course.data_corso)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span>{course.ora_inizio} - {course.ora_fine}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="truncate">{course.luogo}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span>{course.partecipanti_count || 0} / {course.max_partecipanti} partecipanti</span>
          </div>
        </div>

        {course.descrizione && (
          <p className="text-sm text-gray-400 line-clamp-2">{course.descrizione}</p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-700">
          {course.stato === 'bozza' && (
            <button
              onClick={() => onConfirm(course)}
              className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">Conferma Corso</span>
            </button>
          )}
          <button
            onClick={() => onViewDetails(course)}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">Dettagli</span>
          </button>
          <button
            onClick={() => onAssignParticipants(course)}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span className="text-sm font-medium">Assegna</span>
          </button>
          <button
            onClick={() => onEdit(course)}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span className="text-sm font-medium">Modifica</span>
          </button>
          <button
            onClick={() => onDelete(course.id)}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">Elimina</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface CourseFormModalProps {
  course: Course | null;
  isEdit: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: { value: string; label: string }[];
  statusOptions: { value: string; label: string; color: string }[];
}

const CourseFormModal: React.FC<CourseFormModalProps> = ({
  course,
  isEdit,
  onClose,
  onSuccess,
  categories,
  statusOptions
}) => {
  const { companyProfile } = useCompanyAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    titolo: course?.titolo || '',
    descrizione: course?.descrizione || '',
    data_corso: course?.data_corso || '',
    ora_inizio: course?.ora_inizio || '09:00',
    ora_fine: course?.ora_fine || '17:00',
    luogo: course?.luogo || '',
    istruttore: course?.istruttore || '',
    categoria: course?.categoria || 'tecnico',
    obbligatorio: course?.obbligatorio || false,
    max_partecipanti: course?.max_partecipanti || 20,
    visibilita: course?.visibilita || 'pubblico',
    stato: course?.stato || 'bozza',
    confermato: course?.confermato || false,
    note: course?.note || ''
  });

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!companyProfile) return;

    if (!formData.titolo || !formData.data_corso || !formData.luogo) {
      addToast('Compila tutti i campi obbligatori', 'error');
      return;
    }

    try {
      setLoading(true);

      if (isEdit && course) {
        const { error } = await supabase
          .from('crew_corsi')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', course.id);

        if (error) throw error;
        addToast('Corso aggiornato con successo', 'success');
      } else {
        const { error } = await supabase
          .from('crew_corsi')
          .insert({
            ...formData,
            azienda_id: companyProfile.id
          });

        if (error) throw error;
        addToast('Corso creato con successo', 'success');
      }

      onSuccess();
    } catch (error: any) {
      addToast(error.message || 'Errore durante il salvataggio', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-16 left-0 right-0 bottom-0 bg-black/95 z-30 flex items-center justify-center p-4">
      <div className="bg-gray-900 w-full max-w-2xl rounded-lg shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">
            {isEdit ? 'Modifica Corso' : 'Nuovo Corso'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Titolo Corso *
            </label>
            <input
              type="text"
              value={formData.titolo}
              onChange={(e) => setFormData({ ...formData, titolo: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Es: Corso Sicurezza Base"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Descrizione
            </label>
            <textarea
              value={formData.descrizione}
              onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
              placeholder="Descrizione del corso..."
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Data Corso *
              </label>
              <input
                type="date"
                value={formData.data_corso}
                onChange={(e) => setFormData({ ...formData, data_corso: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Categoria *
              </label>
              <select
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Ora Inizio *
              </label>
              <input
                type="time"
                value={formData.ora_inizio}
                onChange={(e) => setFormData({ ...formData, ora_inizio: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Ora Fine *
              </label>
              <input
                type="time"
                value={formData.ora_fine}
                onChange={(e) => setFormData({ ...formData, ora_fine: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Luogo *
            </label>
            <input
              type="text"
              value={formData.luogo}
              onChange={(e) => setFormData({ ...formData, luogo: e.target.value })}
              placeholder="Es: Sede Centrale, Aula 1"
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Istruttore
            </label>
            <input
              type="text"
              value={formData.istruttore}
              onChange={(e) => setFormData({ ...formData, istruttore: e.target.value })}
              placeholder="Nome dell'istruttore"
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Max Partecipanti
              </label>
              <input
                type="number"
                value={formData.max_partecipanti}
                onChange={(e) => setFormData({ ...formData, max_partecipanti: parseInt(e.target.value) })}
                min="1"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Stato
              </label>
              <select
                value={formData.stato}
                onChange={(e) => setFormData({ ...formData, stato: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {statusOptions.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 bg-gray-800 p-3 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors">
              <input
                type="checkbox"
                checked={formData.obbligatorio}
                onChange={(e) => setFormData({ ...formData, obbligatorio: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-200">Corso Obbligatorio</span>
            </label>

            <label className="flex items-center gap-2 bg-gray-800 p-3 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors">
              <input
                type="checkbox"
                checked={formData.confermato}
                onChange={(e) => setFormData({ ...formData, confermato: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-200">Confermato</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Note
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
              placeholder="Note aggiuntive..."
            />
          </div>
        </form>

        <div className="border-t border-gray-800 p-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-white bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors font-medium text-sm"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={loading}
            onClick={handleSubmit}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium text-sm"
          >
            {loading ? 'Salvataggio...' : isEdit ? 'Aggiorna' : 'Crea Corso'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface CourseDetailsModalProps {
  course: Course;
  onClose: () => void;
}

const CourseDetailsModal: React.FC<CourseDetailsModalProps> = ({ course, onClose }) => {
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('crew_assegnazionecorsi')
        .select('*')
        .eq('corso_id', course.id)
        .order('persona_nome');

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 w-full max-w-2xl rounded-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">{course.titolo}</h2>
            <p className="text-gray-400 text-xs mt-1">{course.categoria}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <h3 className="font-semibold text-white text-sm">Informazioni Corso</h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-300">{formatDate(course.data_corso)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-300">{course.ora_inizio} - {course.ora_fine}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-300">{course.luogo}</span>
              </div>
              {course.istruttore && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-300">Istruttore: {course.istruttore}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <h3 className="font-semibold text-white text-sm">Dettagli</h3>
            <div className="space-y-1 text-xs text-gray-300">
              <div>Stato: <span className="font-medium text-white">{course.stato}</span></div>
              <div>Max Partecipanti: <span className="font-medium text-white">{course.max_partecipanti}</span></div>
              <div>Obbligatorio: <span className="font-medium text-white">{course.obbligatorio ? 'Sì' : 'No'}</span></div>
              <div>Confermato: <span className="font-medium text-white">{course.confermato ? 'Sì' : 'No'}</span></div>
            </div>
          </div>

          {course.descrizione && (
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="font-semibold text-white text-sm mb-1.5">Descrizione</h3>
              <p className="text-xs text-gray-300">{course.descrizione}</p>
            </div>
          )}

          {course.note && (
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="font-semibold text-white text-sm mb-1.5">Note</h3>
              <p className="text-xs text-gray-300">{course.note}</p>
            </div>
          )}

          <div className="bg-gray-800 rounded-lg p-3">
            <h3 className="font-semibold text-white text-sm mb-2">
              Partecipanti ({assignments.length})
            </h3>
            {loading ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-xs">Nessun partecipante assegnato</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {assignments.map(assignment => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-2 bg-gray-700 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{assignment.persona_nome}</div>
                      <div className="text-xs text-gray-400 truncate">{assignment.persona_email}</div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded flex-shrink-0 ml-2 ${
                      assignment.stato_invito === 'confermato'
                        ? 'bg-green-900/50 text-green-300'
                        : assignment.stato_invito === 'rifiutato'
                        ? 'bg-red-900/50 text-red-300'
                        : 'bg-yellow-900/50 text-yellow-300'
                    }`}>
                      {assignment.stato_invito}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-800 p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium text-sm"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
