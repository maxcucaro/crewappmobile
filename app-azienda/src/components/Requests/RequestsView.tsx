import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToastContext } from '../../context/ToastContext';
import { Calendar, Heart, Check, X, AlertCircle, Clock, FileText, User, Plus, Trash2 } from 'lucide-react';

interface Employee {
  id: string;
  full_name: string;
  email: string;
}

interface Request {
  id: string;
  dipendente_id: string;
  dipendente_nome: string;
  tipo: 'ferie' | 'permessi';
  data_inizio: string;
  data_fine: string;
  giorni_richiesti?: number;
  ore_richieste?: number;
  orario_inizio?: string;
  orario_fine?: string;
  note?: string;
  stato: string;
  created_at: string;
}

interface MedicalRequest {
  id: string;
  dipendente_id: string;
  dipendente_nome: string;
  tipo: 'malattia' | 'infortunio';
  data_inizio: string;
  data_fine: string;
  giorni_totali: number;
  certificato_medico?: string;
  note?: string;
  created_at: string;
}

type TabType = 'ferie' | 'permessi' | 'malattia' | 'infortunio';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'success' | 'warning';
}

interface RejectModalProps {
  isOpen: boolean;
  dipendenteNome: string;
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
}

interface InsertFormData {
  dipendente_id: string;
  tipo: TabType;
  data_inizio: string;
  data_fine: string;
  orario_inizio: string;
  orario_fine: string;
  certificato_medico: string;
  note: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const colorClass = {
    danger: 'bg-red-600 hover:bg-red-700',
    success: 'bg-green-600 hover:bg-green-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700'
  }[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 ${colorClass} text-white rounded-lg font-medium`}
          >
            Conferma
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
};

const RejectModal: React.FC<RejectModalProps> = ({ isOpen, dipendenteNome, onConfirm, onCancel }) => {
  const [motivo, setMotivo] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Rifiuta richiesta</h3>
        <p className="text-gray-600 mb-4">Inserisci il motivo del rifiuto per {dipendenteNome}:</p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
          rows={3}
          placeholder="Motivo del rifiuto..."
        />
        <div className="flex gap-3">
          <button
            onClick={() => {
              onConfirm(motivo);
              setMotivo('');
            }}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
          >
            Rifiuta
          </button>
          <button
            onClick={() => {
              onCancel();
              setMotivo('');
            }}
            className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
};

export const RequestsView: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const { showSuccess, showError } = useToastContext();

  const [activeTab, setActiveTab] = useState<TabType>('ferie');
  const [viewMode, setViewMode] = useState<'pending' | 'approved'>('pending');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ferieRequests, setFerieRequests] = useState<Request[]>([]);
  const [permessiRequests, setPermessiRequests] = useState<Request[]>([]);
  const [malattiaRequests, setMalattiaRequests] = useState<MedicalRequest[]>([]);
  const [infortunioRequests, setInfortunioRequests] = useState<MedicalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'success' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    requestId: string;
    dipendenteNome: string;
  }>({
    isOpen: false,
    requestId: '',
    dipendenteNome: ''
  });

  const [insertForm, setInsertForm] = useState<InsertFormData>({
    dipendente_id: '',
    tipo: 'ferie',
    data_inizio: '',
    data_fine: '',
    orario_inizio: '',
    orario_fine: '',
    certificato_medico: '',
    note: ''
  });

  useEffect(() => {
    if (companyProfile?.id) {
      loadEmployees();
      loadRequests();
    }
  }, [companyProfile?.id, viewMode]);

  const loadEmployees = async () => {
    if (!companyProfile?.id) return;

    try {
      const { data, error } = await supabase
        .from('registration_requests')
        .select('id, full_name, email')
        .eq('parent_company_id', companyProfile.id)
        .eq('status', 'approved')
        .in('tipologia_registrazione', ['dipendente', 'freelance'])
        .order('full_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Errore caricamento dipendenti:', err);
    }
  };

  const loadRequests = async () => {
    if (!companyProfile?.id) return;

    setLoading(true);
    try {
      const stato = viewMode === 'pending' ? 'in_attesa' : 'approvata';

      const [ferieData, malattiaData] = await Promise.all([
        supabase
          .from('crew_richiesteferie_permessi')
          .select('*')
          .eq('azienda_id', companyProfile.id)
          .eq('stato', stato)
          .order('created_at', { ascending: false }),

        supabase
          .from('crew_malattia_infortunio')
          .select('*')
          .eq('azienda_id', companyProfile.id)
          .order('created_at', { ascending: false })
      ]);

      if (ferieData.data) {
        const ferie = ferieData.data.filter(r => r.tipo_richiesta === 'ferie').map(item => ({
          id: item.id,
          dipendente_id: item.dipendente_id,
          dipendente_nome: item.dipendente_nome || 'N/D',
          tipo: 'ferie' as const,
          data_inizio: item.data_inizio,
          data_fine: item.data_fine,
          giorni_richiesti: item.giorni_richiesti || 0,
          note: item.note,
          stato: item.stato,
          created_at: item.created_at
        }));

        const permessi = ferieData.data.filter(r => r.tipo_richiesta === 'permessi').map(item => ({
          id: item.id,
          dipendente_id: item.dipendente_id,
          dipendente_nome: item.dipendente_nome || 'N/D',
          tipo: 'permessi' as const,
          data_inizio: item.data_inizio,
          data_fine: item.data_fine,
          ore_richieste: item.ore_richieste || 0,
          orario_inizio: item.orario_inizio,
          orario_fine: item.orario_fine,
          note: item.note,
          stato: item.stato,
          created_at: item.created_at
        }));

        setFerieRequests(ferie);
        setPermessiRequests(permessi);
      }

      if (malattiaData.data) {
        const malattia = malattiaData.data.filter(r => r.tipo === 'malattia').map(item => ({
          id: item.id,
          dipendente_id: item.dipendente_id,
          dipendente_nome: item.dipendente_nome || 'N/D',
          tipo: 'malattia' as const,
          data_inizio: item.data_inizio,
          data_fine: item.data_fine,
          giorni_totali: item.giorni_totali || 0,
          certificato_medico: item.certificato_medico,
          note: item.note,
          created_at: item.created_at
        }));

        const infortunio = malattiaData.data.filter(r => r.tipo === 'infortunio').map(item => ({
          id: item.id,
          dipendente_id: item.dipendente_id,
          dipendente_nome: item.dipendente_nome || 'N/D',
          tipo: 'infortunio' as const,
          data_inizio: item.data_inizio,
          data_fine: item.data_fine,
          giorni_totali: item.giorni_totali || 0,
          certificato_medico: item.certificato_medico,
          note: item.note,
          created_at: item.created_at
        }));

        setMalattiaRequests(malattia);
        setInfortunioRequests(infortunio);
      }
    } catch (err) {
      console.error('Errore caricamento richieste:', err);
      showError('Errore', 'Impossibile caricare le richieste');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('crew_richiesteferie_permessi')
        .update({
          stato: 'approvata',
          approvato_da: companyProfile?.auth_user_id,
          approvato_il: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;
      showSuccess('Richiesta approvata con successo');
      loadRequests();
    } catch (error: any) {
      console.error('Errore approvazione:', error);
      showError('Errore', error.message || 'Errore durante l\'approvazione');
    }
  };

  const handleReject = async (requestId: string, motivo: string) => {
    try {
      const { error } = await supabase
        .from('crew_richiesteferie_permessi')
        .update({
          stato: 'rifiutata',
          approvato_da: companyProfile?.auth_user_id,
          approvato_il: new Date().toISOString(),
          motivo_rifiuto: motivo || 'Nessun motivo specificato'
        })
        .eq('id', requestId);

      if (error) throw error;
      showSuccess('Richiesta rifiutata');
      loadRequests();
    } catch (error: any) {
      console.error('Errore rifiuto:', error);
      showError('Errore', error.message || 'Errore durante il rifiuto');
    }
  };

  const handleDelete = async (requestId: string, tipo: TabType) => {
    try {
      if (tipo === 'ferie' || tipo === 'permessi') {
        const { error } = await supabase
          .from('crew_richiesteferie_permessi')
          .delete()
          .eq('id', requestId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crew_malattia_infortunio')
          .delete()
          .eq('id', requestId);
        if (error) throw error;
      }
      showSuccess('Elemento eliminato con successo');
      loadRequests();
    } catch (error: any) {
      console.error('Errore eliminazione:', error);
      showError('Errore', error.message || 'Errore durante l\'eliminazione');
    }
  };

  const handleInsert = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyProfile?.id || !insertForm.dipendente_id) {
      showError('Errore', 'Seleziona un dipendente');
      return;
    }

    if (!insertForm.data_inizio) {
      showError('Errore', 'Inserisci la data');
      return;
    }

    if (insertForm.tipo === 'permessi' && (!insertForm.orario_inizio || !insertForm.orario_fine)) {
      showError('Errore', 'Inserisci gli orari per il permesso');
      return;
    }

    if (insertForm.tipo !== 'permessi' && !insertForm.data_fine) {
      showError('Errore', 'Inserisci la data fine');
      return;
    }

    try {
      const employee = employees.find(emp => emp.id === insertForm.dipendente_id);

      if (insertForm.tipo === 'ferie' || insertForm.tipo === 'permessi') {
        let giorni = 0;
        let oreRichieste = 0;
        let dataFine = insertForm.data_fine;

        if (insertForm.tipo === 'permessi') {
          const [startH, startM] = insertForm.orario_inizio.split(':').map(Number);
          const [endH, endM] = insertForm.orario_fine.split(':').map(Number);
          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;
          oreRichieste = (endMinutes - startMinutes) / 60;
          dataFine = insertForm.data_inizio;
        } else {
          const startDate = new Date(insertForm.data_inizio);
          const endDate = new Date(insertForm.data_fine);
          const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
          giorni = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }

        const { error } = await supabase
          .from('crew_richiesteferie_permessi')
          .insert({
            azienda_id: companyProfile.id,
            dipendente_id: insertForm.dipendente_id,
            dipendente_nome: employee?.full_name || '',
            tipo_richiesta: insertForm.tipo,
            data_inizio: insertForm.data_inizio,
            data_fine: dataFine,
            giorni_richiesti: giorni,
            ore_richieste: oreRichieste,
            orario_inizio: insertForm.tipo === 'permessi' ? insertForm.orario_inizio : null,
            orario_fine: insertForm.tipo === 'permessi' ? insertForm.orario_fine : null,
            note: insertForm.note || null,
            stato: 'approvata',
            approvato_da: companyProfile.auth_user_id,
            approvato_il: new Date().toISOString()
          });

        if (error) throw error;
        showSuccess(`${insertForm.tipo === 'ferie' ? 'Ferie' : 'Permesso'} inserito con successo`);
      } else if (insertForm.tipo === 'malattia' || insertForm.tipo === 'infortunio') {
        const startDate = new Date(insertForm.data_inizio);
        const endDate = new Date(insertForm.data_fine);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const giorni = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const { error } = await supabase
          .from('crew_malattia_infortunio')
          .insert({
            azienda_id: companyProfile.id,
            dipendente_id: insertForm.dipendente_id,
            dipendente_nome: employee?.full_name || '',
            tipo: insertForm.tipo,
            data_inizio: insertForm.data_inizio,
            data_fine: insertForm.data_fine,
            giorni_totali: giorni,
            certificato_medico: insertForm.certificato_medico || null,
            note: insertForm.note || null
          });

        if (error) throw error;
        showSuccess(`${insertForm.tipo === 'malattia' ? 'Malattia' : 'Infortunio'} inserito con successo`);
      }

      setShowInsertModal(false);
      setInsertForm({
        dipendente_id: '',
        tipo: 'ferie',
        data_inizio: '',
        data_fine: '',
        orario_inizio: '',
        orario_fine: '',
        certificato_medico: '',
        note: ''
      });
      loadRequests();
    } catch (error: any) {
      console.error('Errore inserimento:', error);
      showError('Errore', error.message || 'Errore nell\'inserimento');
    }
  };

  const getActiveRequests = () => {
    switch (activeTab) {
      case 'ferie':
        return ferieRequests;
      case 'permessi':
        return permessiRequests;
      case 'malattia':
        return malattiaRequests;
      case 'infortunio':
        return infortunioRequests;
      default:
        return [];
    }
  };

  const renderRequestCard = (request: Request | MedicalRequest) => {
    const isMedical = activeTab === 'malattia' || activeTab === 'infortunio';
    const medicalRequest = request as MedicalRequest;
    const standardRequest = request as Request;
    const isPending = viewMode === 'pending' && (activeTab === 'ferie' || activeTab === 'permessi');

    return (
      <div key={request.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {isMedical ? (
              <div className="bg-red-100 p-3 rounded-lg">
                <Heart className="w-5 h-5 text-red-600" />
              </div>
            ) : (
              <div className="bg-blue-100 p-3 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                {request.dipendente_nome}
              </h3>
              <p className="text-sm text-gray-500">
                Richiesto il {new Date(request.created_at).toLocaleDateString('it-IT', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
          {isPending && (
            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">In attesa</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {activeTab === 'permessi' ? (
            <>
              <div>
                <span className="text-sm text-gray-500">Giorno</span>
                <p className="font-medium text-gray-900">
                  {new Date(standardRequest.data_inizio).toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Orario</span>
                <p className="font-medium text-gray-900">
                  {standardRequest.orario_inizio} - {standardRequest.orario_fine}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Ore richieste</span>
                <p className="font-medium text-gray-900">
                  {standardRequest.ore_richieste?.toFixed(1) || 0} ore
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-sm text-gray-500">Data Inizio</span>
                <p className="font-medium text-gray-900">
                  {new Date(request.data_inizio).toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Data Fine</span>
                <p className="font-medium text-gray-900">
                  {new Date(request.data_fine).toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Giorni Totali</span>
                <p className="font-medium text-gray-900">
                  {isMedical ? medicalRequest.giorni_totali : standardRequest.giorni_richiesti} giorni
                </p>
              </div>
            </>
          )}
        </div>

        {isMedical && medicalRequest.certificato_medico && (
          <div className="mb-4">
            <a
              href={medicalRequest.certificato_medico}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              Visualizza Certificato Medico
            </a>
          </div>
        )}

        {request.note && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Note:</span>
            <p className="text-sm text-gray-600 mt-1">{request.note}</p>
          </div>
        )}

        <div className="flex gap-3">
          {isPending ? (
            <>
              <button
                onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Approva richiesta',
                    message: `Confermi di voler approvare la richiesta di ${request.dipendente_nome}?`,
                    onConfirm: () => {
                      handleApprove(request.id);
                      setConfirmModal({ ...confirmModal, isOpen: false });
                    },
                    type: 'success'
                  });
                }}
                className="flex-1 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
              >
                <Check className="w-5 h-5" />
                Approva
              </button>
              <button
                onClick={() => {
                  setRejectModal({
                    isOpen: true,
                    requestId: request.id,
                    dipendenteNome: request.dipendente_nome
                  });
                }}
                className="flex-1 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
              >
                <X className="w-5 h-5" />
                Rifiuta
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: 'Elimina elemento',
                  message: `Confermi di voler eliminare questo elemento per ${request.dipendente_nome}?`,
                  onConfirm: () => {
                    handleDelete(request.id, activeTab);
                    setConfirmModal({ ...confirmModal, isOpen: false });
                  },
                  type: 'danger'
                });
              }}
              className="flex-1 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
            >
              <Trash2 className="w-5 h-5" />
              Elimina
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!companyProfile?.id) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-gray-600">Impossibile identificare l'azienda</p>
        </div>
      </div>
    );
  }

  const activeRequests = getActiveRequests();
  const tabs = [
    { id: 'ferie' as TabType, label: 'Ferie', count: ferieRequests.length, icon: Calendar },
    { id: 'permessi' as TabType, label: 'Permessi', count: permessiRequests.length, icon: Clock },
    { id: 'malattia' as TabType, label: 'Malattia', count: malattiaRequests.length, icon: Heart },
    { id: 'infortunio' as TabType, label: 'Infortunio', count: infortunioRequests.length, icon: Heart }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Gestione Richieste</h2>
        <p className="text-gray-600 mt-1">Gestisci ferie, permessi e assenze dei dipendenti</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex gap-3 flex-wrap mb-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === tab.id ? 'bg-white text-blue-600' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setViewMode('pending')}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
              viewMode === 'pending'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            In attesa
          </button>
          <button
            onClick={() => setViewMode('approved')}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
              viewMode === 'approved'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Approvate
          </button>
        </div>
      </div>

      <button
        onClick={() => {
          setInsertForm({ ...insertForm, tipo: activeTab });
          setShowInsertModal(true);
        }}
        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
      >
        <Plus className="w-5 h-5" />
        Inserisci {activeTab}
      </button>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : activeRequests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 text-lg">Nessun elemento trovato</p>
          <p className="text-gray-500 text-sm mt-2">
            Non ci sono {viewMode === 'pending' ? 'richieste in attesa' : 'elementi approvati'} per {activeTab}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {viewMode === 'pending' ? 'Richieste in attesa' : 'Approvate'} ({activeRequests.length})
          </h3>
          {activeRequests.map(request => renderRequestCard(request))}
        </div>
      )}

      {showInsertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full my-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Inserisci {activeTab}</h3>
            <form onSubmit={handleInsert} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dipendente <span className="text-red-500">*</span>
                </label>
                <select
                  value={insertForm.dipendente_id}
                  onChange={(e) => setInsertForm({ ...insertForm, dipendente_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleziona dipendente</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {activeTab === 'permessi' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Giorno <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={insertForm.data_inizio}
                      onChange={(e) => setInsertForm({ ...insertForm, data_inizio: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dalle <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={insertForm.orario_inizio}
                        onChange={(e) => setInsertForm({ ...insertForm, orario_inizio: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Alle <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={insertForm.orario_fine}
                        onChange={(e) => setInsertForm({ ...insertForm, orario_fine: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={insertForm.data_inizio}
                      onChange={(e) => setInsertForm({ ...insertForm, data_inizio: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Al <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={insertForm.data_fine}
                      onChange={(e) => setInsertForm({ ...insertForm, data_fine: e.target.value })}
                      min={insertForm.data_inizio}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              )}

              {(activeTab === 'malattia' || activeTab === 'infortunio') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link Certificato Medico
                  </label>
                  <input
                    type="url"
                    value={insertForm.certificato_medico}
                    onChange={(e) => setInsertForm({ ...insertForm, certificato_medico: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
                <textarea
                  value={insertForm.note}
                  onChange={(e) => setInsertForm({ ...insertForm, note: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Note aggiuntive..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                >
                  Conferma
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInsertModal(false);
                    setInsertForm({
                      dipendente_id: '',
                      tipo: 'ferie',
                      data_inizio: '',
                      data_fine: '',
                      orario_inizio: '',
                      orario_fine: '',
                      certificato_medico: '',
                      note: ''
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium"
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        type={confirmModal.type}
      />

      <RejectModal
        isOpen={rejectModal.isOpen}
        dipendenteNome={rejectModal.dipendenteNome}
        onConfirm={(motivo) => {
          handleReject(rejectModal.requestId, motivo);
          setRejectModal({ isOpen: false, requestId: '', dipendenteNome: '' });
        }}
        onCancel={() => setRejectModal({ isOpen: false, requestId: '', dipendenteNome: '' })}
      />
    </div>
  );
};
