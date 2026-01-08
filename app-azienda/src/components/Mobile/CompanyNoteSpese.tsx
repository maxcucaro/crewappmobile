import React, { useEffect, useState } from 'react';
import { Receipt, RefreshCw, Check, X, User, AlertCircle, Calendar, DollarSign } from 'lucide-react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../utils/supabase';

interface ExpenseRequest {
  id: string;
  dipendente_id: string;
  categoria: string;
  importo: number;
  data_spesa: string;
  descrizione?: string;
  stato: string;
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  crew_member?: {
    nome: string;
    cognome: string;
    email: string;
  };
}

const CompanyNoteSpese: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const { showSuccess, showError } = useToastContext();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  useEffect(() => {
    if (companyProfile?.id) {
      findCompanyId();
    }
  }, [companyProfile?.id]);

  useEffect(() => {
    if (companyId) {
      loadRequests();
    }
  }, [companyId, filter]);

  const findCompanyId = async () => {
    try {
      const { data, error } = await supabase
        .from('regaziendasoftware')
        .select('id')
        .eq('auth_user_id', companyProfile?.user_id)
        .maybeSingle();

      if (error) {
        console.error('Errore ricerca company_id:', error);
        return;
      }

      if (data?.id) {
        setCompanyId(data.id);
      }
    } catch (err) {
      console.error('Eccezione findCompanyId:', err);
    }
  };

  const loadRequests = async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      let query = supabase
        .from('crew_richiestenota_spese')
        .select(`
          *,
          crew_member:crew_members!crew_richiestenota_spese_dipendente_id_fkey(
            nome,
            cognome,
            email
          )
        `)
        .eq('azienda_id', companyId)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        if (filter === 'pending') {
          query = query.eq('stato', 'in_attesa');
        } else if (filter === 'approved') {
          query = query.eq('stato', 'approvata');
        } else if (filter === 'rejected') {
          query = query.eq('stato', 'rifiutata');
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Errore caricamento richieste:', error);
        showError('Errore nel caricamento delle note spese');
        return;
      }

      setRequests(data || []);
    } catch (err) {
      console.error('Errore loadRequests:', err);
      showError('Errore nel caricamento delle note spese');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase
        .from('crew_richiestenota_spese')
        .update({
          stato: 'approvata',
          approved_by: companyProfile?.nome_azienda,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      showSuccess('Nota spese approvata');
      await loadRequests();
    } catch (err: any) {
      console.error('Errore approvazione:', err);
      showError(err?.message || 'Errore durante l\'approvazione');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!rejectReason.trim()) {
      showError('Inserisci il motivo del rifiuto');
      return;
    }

    setProcessing(requestId);
    try {
      const { error } = await supabase
        .from('crew_richiestenota_spese')
        .update({
          stato: 'rifiutata',
          rejection_reason: rejectReason,
          approved_by: companyProfile?.nome_azienda,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      showSuccess('Nota spese rifiutata');
      setShowRejectModal(null);
      setRejectReason('');
      await loadRequests();
    } catch (err: any) {
      console.error('Errore rifiuto:', err);
      showError(err?.message || 'Errore durante il rifiuto');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return date;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approvata':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Approvata</span>;
      case 'rifiutata':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Rifiutata</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">In attesa</span>;
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('vitt') || cat.includes('pasto') || cat.includes('cibo')) return '';
    if (cat.includes('trasport') || cat.includes('viaggio') || cat.includes('car')) return '';
    if (cat.includes('allog')) return '';
    if (cat.includes('carburan') || cat.includes('benzin')) return '';
    return '';
  };

  const pendingCount = requests.filter(r => r.stato === 'in_attesa').length;
  const totalPending = requests
    .filter(r => r.stato === 'in_attesa')
    .reduce((sum, r) => sum + (r.importo || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Note Spese</h2>
            <p className="text-sm text-gray-400">Gestisci i rimborsi dei dipendenti</p>
          </div>
          <button
            onClick={() => loadRequests()}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {pendingCount > 0 && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
              <p className="text-sm text-yellow-200">
                {pendingCount} {pendingCount === 1 ? 'richiesta in attesa' : 'richieste in attesa'} di approvazione
              </p>
            </div>
            <div className="flex items-center gap-2 text-lg font-bold text-yellow-400 ml-8">
              <DollarSign className="h-5 w-5" />
              {formatCurrency(totalPending)}
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            In attesa ({requests.filter(r => r.stato === 'in_attesa').length})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === 'approved'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Approvate ({requests.filter(r => r.stato === 'approvata').length})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === 'rejected'
                ? 'bg-red-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Rifiutate ({requests.filter(r => r.stato === 'rifiutata').length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Tutte ({requests.length})
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
            <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400">Nessuna nota spese trovata</p>
          </div>
        ) : (
          requests.map((request) => {
            const isPending = request.stato === 'in_attesa';
            const isProcessing = processing === request.id;

            return (
              <div key={request.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-2xl">
                      {getCategoryIcon(request.categoria)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        {request.categoria || 'Spesa'}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                        <User className="h-4 w-4" />
                        <span>
                          {request.crew_member?.nome} {request.crew_member?.cognome}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white mb-1">
                      {formatCurrency(request.importo)}
                    </div>
                    {getStatusBadge(request.stato)}
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>{formatDate(request.data_spesa)}</span>
                  </div>

                  {request.descrizione && (
                    <div className="mt-2 p-2 bg-gray-900 rounded text-sm text-gray-300 border border-gray-700">
                      <span className="text-gray-500">Descrizione:</span> {request.descrizione}
                    </div>
                  )}

                  {request.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-500/10 rounded text-sm text-red-300 border border-red-500/30">
                      <span className="text-red-400">Motivo rifiuto:</span> {request.rejection_reason}
                    </div>
                  )}

                  {request.approved_by && (
                    <div className="text-xs text-gray-500 mt-2">
                      Gestita da: {request.approved_by} • {formatDate(request.approved_at)}
                    </div>
                  )}
                </div>

                {isPending && (
                  <div className="flex gap-2 pt-3 border-t border-gray-700">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="h-4 w-4" />
                      {isProcessing ? 'Approvazione...' : 'Approva'}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(request.id)}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="h-4 w-4" />
                      Rifiuta
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Rifiuta Nota Spese</h3>
            <p className="text-gray-300 mb-4">Inserisci il motivo del rifiuto:</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white mb-4"
              rows={4}
              placeholder="Es: Documentazione incompleta, importo non giustificato..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                disabled={!rejectReason.trim() || processing === showRejectModal}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing === showRejectModal ? 'Rifiuto...' : 'Conferma Rifiuto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyNoteSpese;
