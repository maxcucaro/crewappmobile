import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Send, Eye, CheckCircle, XCircle, AlertTriangle, Plus, X, Building2, User, MessageSquare, Plane, Home, Heart, Stethoscope } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../lib/db';

interface VacationRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  companyId: string;
  companyName: string;
  type: 'vacation' | 'sick_leave' | 'personal_leave' | 'maternity_leave' | 'other';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  isUrgent: boolean;
  attachments?: string[];
}

interface VacationBalance {
  totalVacationDays: number;
  usedVacationDays: number;
  remainingVacationDays: number;
  totalSickDays: number;
  usedSickDays: number;
  remainingSickDays: number;
  year: number;
}

const VacationRequests: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToastContext();
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [balance, setBalance] = useState<VacationBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  const [newRequest, setNewRequest] = useState({
    type: 'vacation' as 'vacation' | 'sick_leave' | 'personal_leave' | 'maternity_leave' | 'other',
    startDate: '',
    endDate: '',
    reason: '',
    notes: '',
    isUrgent: false
  });

  const [leaveRequests, setLeaveRequests] = useState<Array<{
    date: string;
    startTime: string;
    endTime: string;
  }>>([{ date: '', startTime: '', endTime: '' }]);

  useEffect(() => {
    if (user?.id) {
      loadUserProfile();
      loadVacationRequests();
      loadVacationBalance();
    }
  }, [user?.id]);

  const loadUserProfile = async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('registration_requests')
        .select(`
          *,
          regaziendasoftware!parent_company_id(
            id,
            ragione_sociale,
            email,
            telefono
          )
        `)
        .eq('id', user?.id)
        .single();

      if (userError) {
        console.error('Errore nel caricamento profilo:', userError);
        return;
      }

      setUserProfile(userData);
    } catch (error) {
      console.error('Errore nel caricamento profilo utente:', error);
    }
  };

  const loadVacationRequests = async () => {
    try {
      const { data: ferie, error: ferieError } = await supabase
        .from('crew_ferie')
        .select('*')
        .eq('dipendente_id', user?.id)
        .order('created_at', { ascending: false });

      const { data: permessi, error: permessiError } = await supabase
        .from('crew_richieste_permessi')
        .select('*')
        .eq('dipendente_id', user?.id)
        .order('created_at', { ascending: false });

      if (ferieError) throw ferieError;
      if (permessiError) throw permessiError;

      const allRequests: VacationRequest[] = [
        ...(ferie || []).map(f => ({
          id: f.id,
          employeeId: f.dipendente_id,
          employeeName: userProfile?.full_name || 'Dipendente',
          companyId: f.azienda_id,
          companyName: userProfile?.regaziendasoftware?.ragione_sociale || 'Azienda',
          type: 'vacation' as const,
          startDate: f.data_inizio,
          endDate: f.data_fine,
          totalDays: f.giorni_richiesti,
          reason: f.motivo || '',
          notes: f.note || '',
          status: f.stato === 'in_attesa' ? 'pending' as const : f.stato === 'approvata' ? 'approved' as const : 'rejected' as const,
          submittedAt: new Date(f.created_at),
          reviewedAt: f.approvato_il ? new Date(f.approvato_il) : undefined,
          reviewedBy: f.approvato_da,
          rejectionReason: f.motivo_rifiuto,
          isUrgent: false
        })),
        ...(permessi || []).map(p => ({
          id: p.id,
          employeeId: p.dipendente_id,
          employeeName: userProfile?.full_name || 'Dipendente',
          companyId: p.azienda_id,
          companyName: userProfile?.regaziendasoftware?.ragione_sociale || 'Azienda',
          type: 'personal_leave' as const,
          startDate: p.data,
          endDate: p.data,
          totalDays: Math.ceil(p.ore_richieste / 8),
          reason: p.motivo || '',
          notes: `${p.ora_inizio} - ${p.ora_fine} (${p.ore_richieste}h)${p.note ? ' | ' + p.note : ''}`,
          status: p.stato === 'in_attesa' ? 'pending' as const : p.stato === 'approvata' ? 'approved' as const : 'rejected' as const,
          submittedAt: new Date(p.created_at),
          reviewedAt: p.approvato_il ? new Date(p.approvato_il) : undefined,
          reviewedBy: p.approvato_da,
          rejectionReason: p.motivo_rifiuto,
          isUrgent: false
        }))
      ];

      setRequests(allRequests);
    } catch (error) {
      console.error('Errore nel caricamento richieste ferie:', error);
      setRequests([]);
    }
  };

  const loadVacationBalance = async () => {
    try {
      const currentYear = new Date().getFullYear();

      const { data: saldi, error: saldiError } = await supabase
        .from('crew_saldi_ferie_permessi')
        .select('*')
        .eq('dipendente_id', user?.id)
        .eq('anno', currentYear)
        .maybeSingle();

      if (saldiError) throw saldiError;

      if (saldi) {
        const vacationBalance: VacationBalance = {
          totalVacationDays: Number(saldi.ferie_totali) || 0,
          usedVacationDays: Number(saldi.ferie_godute) || 0,
          remainingVacationDays: Number(saldi.ferie_residue) || 0,
          totalSickDays: Number(saldi.permessi_totali) || 0,
          usedSickDays: Number(saldi.permessi_goduti) || 0,
          remainingSickDays: Number(saldi.permessi_residui) || 0,
          year: saldi.anno
        };
        setBalance(vacationBalance);
      } else {
        const defaultBalance: VacationBalance = {
          totalVacationDays: 0,
          usedVacationDays: 0,
          remainingVacationDays: 0,
          totalSickDays: 0,
          usedSickDays: 0,
          remainingSickDays: 0,
          year: currentYear
        };
        setBalance(defaultBalance);
      }
    } catch (error) {
      console.error('Errore nel caricamento saldo ferie:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRequestTypeLabel = (type: string) => {
    const labels = {
      vacation: 'Ferie',
      sick_leave: 'Malattia',
      personal_leave: 'Permesso Personale',
      maternity_leave: 'Congedo Maternità',
      other: 'Altro'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getRequestTypeIcon = (type: string) => {
    switch (type) {
      case 'vacation': return Plane;
      case 'sick_leave': return Stethoscope;
      case 'personal_leave': return User;
      case 'maternity_leave': return Heart;
      case 'other': return MessageSquare;
      default: return Calendar;
    }
  };

  const getRequestTypeColor = (type: string) => {
    switch (type) {
      case 'vacation': return 'bg-blue-100 text-blue-800';
      case 'sick_leave': return 'bg-red-100 text-red-800';
      case 'personal_leave': return 'bg-yellow-100 text-yellow-800';
      case 'maternity_leave': return 'bg-purple-100 text-purple-800';
      case 'other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Approvata';
      case 'rejected': return 'Rifiutata';
      case 'pending': return 'In Attesa';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return CheckCircle;
      case 'rejected': return XCircle;
      case 'pending': return Clock;
      default: return AlertTriangle;
    }
  };

  const calculateDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmitRequest = async () => {
    if (!newRequest.reason.trim()) {
      showError('Campi Obbligatori', 'Inserisci il motivo della richiesta');
      return;
    }

    try {
      if (newRequest.type === 'vacation') {
        if (!newRequest.startDate || !newRequest.endDate) {
          showError('Campi Obbligatori', 'Seleziona le date di inizio e fine');
          return;
        }

        const totalDays = calculateDays(newRequest.startDate, newRequest.endDate);

        if (balance && totalDays > balance.remainingVacationDays) {
          if (!confirm(`Stai richiedendo ${totalDays} giorni ma hai solo ${balance.remainingVacationDays} giorni di ferie rimanenti. Vuoi procedere comunque?`)) {
            return;
          }
        }

        const { error } = await supabase
          .from('crew_ferie')
          .insert({
            azienda_id: userProfile?.parent_company_id,
            dipendente_id: user?.id,
            data_inizio: newRequest.startDate,
            data_fine: newRequest.endDate,
            giorni_richiesti: totalDays,
            motivo: newRequest.reason,
            note: newRequest.notes,
            stato: 'in_attesa'
          });

        if (error) throw error;
      } else if (newRequest.type === 'personal_leave') {
        const validRequests = leaveRequests.filter(lr =>
          lr.date && lr.startTime && lr.endTime
        );

        if (validRequests.length === 0) {
          showError('Campi Obbligatori', 'Inserisci almeno una richiesta di permesso con data e orari');
          return;
        }

        const insertPromises = validRequests.map(lr =>
          supabase.from('crew_richieste_permessi').insert({
            azienda_id: userProfile?.parent_company_id,
            dipendente_id: user?.id,
            data: lr.date,
            ora_inizio: lr.startTime,
            ora_fine: lr.endTime,
            ore_richieste: 0,
            motivo: newRequest.reason,
            note: newRequest.notes,
            stato: 'in_attesa'
          })
        );

        const results = await Promise.all(insertPromises);
        const errors = results.filter(r => r.error);

        if (errors.length > 0) {
          throw new Error('Errore nell\'invio di alcune richieste');
        }
      }

      await loadVacationRequests();

      setNewRequest({
        type: 'vacation',
        startDate: '',
        endDate: '',
        reason: '',
        notes: '',
        isUrgent: false
      });

      setLeaveRequests([{ date: '', startTime: '', endTime: '' }]);

      setShowModal(false);
      showSuccess('Richiesta Inviata', 'La richiesta è stata inviata con successo alla tua azienda');
    } catch (error) {
      console.error('Errore invio richiesta:', error);
      showError('Errore', 'Impossibile inviare la richiesta');
    }
  };

  const handleViewDetails = (request: VacationRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const addLeaveRequest = () => {
    setLeaveRequests([...leaveRequests, { date: '', startTime: '', endTime: '' }]);
  };

  const removeLeaveRequest = (index: number) => {
    if (leaveRequests.length > 1) {
      setLeaveRequests(leaveRequests.filter((_, i) => i !== index));
    }
  };

  const updateLeaveRequest = (index: number, field: 'date' | 'startTime' | 'endTime', value: string) => {
    const updated = [...leaveRequests];
    updated[index][field] = value;
    setLeaveRequests(updated);
  };

  const pendingRequests = requests.filter(r => r.status === 'pending').length;
  const approvedRequests = requests.filter(r => r.status === 'approved').length;
  const rejectedRequests = requests.filter(r => r.status === 'rejected').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ferie e Permessi</h1>
          <p className="text-gray-600">Gestisci le tue richieste di ferie, malattie e permessi</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nuova Richiesta</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Gestione Ferie e Permessi</h4>
            <p className="text-sm text-blue-800">
              Come crew member, puoi richiedere ferie, permessi e comunicare malattie direttamente alla tua azienda. 
              Tutte le richieste verranno inviate al tuo responsabile per l'approvazione.
            </p>
          </div>
        </div>
      </div>

      {/* Balance Overview */}
      {balance && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="bg-blue-500 p-3 rounded-lg">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ferie Rimanenti</p>
                <p className="text-2xl font-bold text-gray-900">{balance.remainingVacationDays}</p>
                <p className="text-xs text-gray-500">su {balance.totalVacationDays} annuali</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="bg-green-500 p-3 rounded-lg">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Richieste Approvate</p>
                <p className="text-2xl font-bold text-gray-900">{approvedRequests}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="bg-yellow-500 p-3 rounded-lg">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Attesa</p>
                <p className="text-2xl font-bold text-gray-900">{pendingRequests}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="bg-red-500 p-3 rounded-lg">
                <XCircle className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Malattia Usata</p>
                <p className="text-2xl font-bold text-gray-900">{balance.usedSickDays}</p>
                <p className="text-xs text-gray-500">giorni quest'anno</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vacation Balance Details */}
      {balance && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Saldo Ferie e Permessi {balance.year}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vacation Days */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                <Plane className="h-4 w-4 mr-2" />
                Giorni di Ferie
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-blue-800">Totale annuale:</span>
                  <span className="text-sm font-medium text-blue-900">{balance.totalVacationDays} giorni</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-blue-800">Utilizzati:</span>
                  <span className="text-sm font-medium text-blue-900">{balance.usedVacationDays} giorni</span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-2">
                  <span className="text-sm font-medium text-blue-800">Rimanenti:</span>
                  <span className="text-lg font-bold text-blue-900">{balance.remainingVacationDays} giorni</span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-3">
                <div className="bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${(balance.usedVacationDays / balance.totalVacationDays) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  {((balance.usedVacationDays / balance.totalVacationDays) * 100).toFixed(1)}% utilizzato
                </p>
              </div>
            </div>

            {/* Sick Days */}
            <div className="bg-red-50 rounded-lg p-4">
              <h4 className="font-medium text-red-900 mb-3 flex items-center">
                <Stethoscope className="h-4 w-4 mr-2" />
                Giorni di Malattia
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-red-800">Utilizzati quest'anno:</span>
                  <span className="text-sm font-medium text-red-900">{balance.usedSickDays} giorni</span>
                </div>
                <div className="text-xs text-red-700 mt-2">
                  I giorni di malattia non hanno limite annuale ma richiedono certificato medico per periodi superiori a 3 giorni consecutivi.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Le Mie Richieste ({requests.length})
          </h3>
        </div>
        
        {requests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Nessuna richiesta inviata</p>
            <p className="text-sm mt-1">Clicca su "Nuova Richiesta" per iniziare</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {requests.map((request) => {
              const StatusIcon = getStatusIcon(request.status);
              const TypeIcon = getRequestTypeIcon(request.type);
              return (
                <div key={request.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <TypeIcon className="h-5 w-5 text-gray-600" />
                        <h4 className="font-medium text-gray-900">{request.reason}</h4>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRequestTypeColor(request.type)}`}>
                          {getRequestTypeLabel(request.type)}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                          {getStatusLabel(request.status)}
                        </span>
                        {request.isUrgent && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                            Urgente
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(request.startDate).toLocaleDateString('it-IT')}
                            {request.startDate !== request.endDate && (
                              <> - {new Date(request.endDate).toLocaleDateString('it-IT')}</>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <span>{request.totalDays} {request.totalDays === 1 ? 'giorno' : 'giorni'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4" />
                          <span>{request.companyName}</span>
                        </div>
                      </div>
                      
                      {request.notes && (
                        <p className="text-sm text-gray-600 mt-2">{request.notes}</p>
                      )}
                      
                      {request.status === 'rejected' && request.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-50 rounded-lg">
                          <p className="text-sm text-red-700">
                            <span className="font-medium">Motivo rifiuto:</span> {request.rejectionReason}
                          </p>
                        </div>
                      )}
                      
                      <div className="mt-2 text-xs text-gray-500">
                        Inviata il {request.submittedAt.toLocaleDateString('it-IT')} alle {request.submittedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        {request.reviewedAt && (
                          <span> • Revisionata il {request.reviewedAt.toLocaleDateString('it-IT')}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <StatusIcon className={`h-5 w-5 ${
                        request.status === 'approved' ? 'text-green-500' :
                        request.status === 'rejected' ? 'text-red-500' :
                        'text-yellow-500'
                      }`} />
                      <button
                        onClick={() => handleViewDetails(request)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Dettagli</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Nuova Richiesta Ferie/Permessi</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo Richiesta</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { value: 'vacation', label: 'Ferie', icon: Plane, color: 'blue' },
                      { value: 'sick_leave', label: 'Malattia', icon: Stethoscope, color: 'red' },
                      { value: 'personal_leave', label: 'Permesso Personale', icon: User, color: 'yellow' },
                      { value: 'maternity_leave', label: 'Congedo Maternità', icon: Heart, color: 'purple' },
                      { value: 'other', label: 'Altro', icon: MessageSquare, color: 'gray' }
                    ].map((type) => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setNewRequest({ ...newRequest, type: type.value as any })}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            newRequest.type === type.value
                              ? `border-${type.color}-500 bg-${type.color}-50`
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <Icon className={`h-5 w-5 ${
                              newRequest.type === type.value ? `text-${type.color}-600` : 'text-gray-400'
                            }`} />
                            <span className="font-medium">{type.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {newRequest.type === 'vacation' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data Inizio</label>
                      <input
                        type="date"
                        value={newRequest.startDate}
                        onChange={(e) => setNewRequest({ ...newRequest, startDate: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data Fine</label>
                      <input
                        type="date"
                        value={newRequest.endDate}
                        onChange={(e) => setNewRequest({ ...newRequest, endDate: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        required
                      />
                    </div>
                  </div>
                ) : newRequest.type === 'personal_leave' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Richieste Permessi Orari</label>
                      <button
                        type="button"
                        onClick={addLeaveRequest}
                        className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 text-sm"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Aggiungi Richiesta</span>
                      </button>
                    </div>
                    {leaveRequests.map((lr, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg relative">
                        {leaveRequests.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLeaveRequest(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                          <input
                            type="date"
                            value={lr.date}
                            onChange={(e) => updateLeaveRequest(index, 'date', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Dalle ore</label>
                          <input
                            type="time"
                            value={lr.startTime}
                            onChange={(e) => updateLeaveRequest(index, 'startTime', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Alle ore</label>
                          <input
                            type="time"
                            value={lr.endTime}
                            onChange={(e) => updateLeaveRequest(index, 'endTime', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                            required
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data Inizio</label>
                      <input
                        type="date"
                        value={newRequest.startDate}
                        onChange={(e) => setNewRequest({ ...newRequest, startDate: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data Fine</label>
                      <input
                        type="date"
                        value={newRequest.endDate}
                        onChange={(e) => setNewRequest({ ...newRequest, endDate: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        required
                      />
                    </div>
                  </div>
                )}

                {newRequest.startDate && newRequest.endDate && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Giorni richiesti:</span>
                      <span className="text-lg font-bold text-gray-900">
                        {calculateDays(newRequest.startDate, newRequest.endDate)}
                      </span>
                    </div>
                    
                    {newRequest.type === 'vacation' && balance && (
                      <div className="mt-2 text-sm">
                        {calculateDays(newRequest.startDate, newRequest.endDate) > balance.remainingVacationDays ? (
                          <div className="text-red-600 flex items-center space-x-1">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Superi i giorni di ferie disponibili ({balance.remainingVacationDays})</span>
                          </div>
                        ) : (
                          <div className="text-green-600 flex items-center space-x-1">
                            <CheckCircle className="h-4 w-4" />
                            <span>Giorni disponibili sufficienti</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Motivo della Richiesta</label>
                  <textarea
                    value={newRequest.reason}
                    onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={3}
                    placeholder="Spiega il motivo della richiesta..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Note Aggiuntive (opzionale)</label>
                  <textarea
                    value={newRequest.notes}
                    onChange={(e) => setNewRequest({ ...newRequest, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={2}
                    placeholder="Informazioni aggiuntive per il responsabile..."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newRequest.isUrgent}
                    onChange={(e) => setNewRequest({ ...newRequest, isUrgent: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <label className="text-sm text-gray-700">
                    Richiesta urgente (richiede approvazione immediata)
                  </label>
                </div>

                {newRequest.type === 'sick_leave' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <div>
                        <h4 className="font-medium text-yellow-900">Comunicazione Malattia</h4>
                        <p className="text-sm text-yellow-800">
                          Per malattie superiori a 3 giorni consecutivi è richiesto certificato medico. 
                          Comunica la malattia il prima possibile all'azienda.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSubmitRequest}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Send className="h-4 w-4" />
                  <span>Invia Richiesta</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Dettagli Richiesta
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tipo Richiesta</label>
                      <div className="flex items-center space-x-2 mt-1">
                        {React.createElement(getRequestTypeIcon(selectedRequest.type), { className: "h-5 w-5 text-gray-600" })}
                        <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${getRequestTypeColor(selectedRequest.type)}`}>
                          {getRequestTypeLabel(selectedRequest.type)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Periodo</label>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <p className="text-sm text-gray-900">
                          {new Date(selectedRequest.startDate).toLocaleDateString('it-IT')}
                          {selectedRequest.startDate !== selectedRequest.endDate && (
                            <> - {new Date(selectedRequest.endDate).toLocaleDateString('it-IT')}</>
                          )}
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedRequest.totalDays} {selectedRequest.totalDays === 1 ? 'giorno' : 'giorni'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Motivo</label>
                      <p className="text-sm text-gray-900">{selectedRequest.reason}</p>
                    </div>

                    {selectedRequest.notes && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Note</label>
                        <p className="text-sm text-gray-900">{selectedRequest.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Stato</label>
                      <div className="flex items-center space-x-2">
                        {React.createElement(getStatusIcon(selectedRequest.status), { 
                          className: `h-5 w-5 ${
                            selectedRequest.status === 'approved' ? 'text-green-500' :
                            selectedRequest.status === 'rejected' ? 'text-red-500' :
                            'text-yellow-500'
                          }`
                        })}
                        <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedRequest.status)}`}>
                          {getStatusLabel(selectedRequest.status)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Data Invio</label>
                      <p className="text-sm text-gray-900">
                        {selectedRequest.submittedAt.toLocaleDateString('it-IT')} alle {selectedRequest.submittedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {selectedRequest.reviewedAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Data Revisione</label>
                        <p className="text-sm text-gray-900">
                          {selectedRequest.reviewedAt.toLocaleDateString('it-IT')} alle {selectedRequest.reviewedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    )}

                    {selectedRequest.status === 'rejected' && selectedRequest.rejectionReason && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Motivo Rifiuto</label>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm text-red-700">{selectedRequest.rejectionReason}</p>
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-gray-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{selectedRequest.companyName}</p>
                          <p className="text-xs text-gray-500">Azienda di appartenenza</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copyright */}
      <div className="text-center text-gray-500 text-xs py-4">
        <p>© 2025 ControlStage - Crew App Mobile V. 1.0.0</p>
        <p>Tutti i diritti riservati - Software realizzato da ControlStage</p>
      </div>
    </div>
  );
};

export default VacationRequests;