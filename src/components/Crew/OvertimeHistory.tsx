import React, { useState } from 'react';
import { Clock, Calendar, DollarSign, CheckCircle, XCircle, AlertTriangle, Filter, Search, Building2, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/db';

interface OvertimeRecord {
  id: string;
  crewId: string;
  warehouseId?: string;
  warehouseName?: string;
  eventId?: string;
  eventTitle?: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  baseRate: number;
  overtimeRate: number;
  totalAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  submittedAt: Date;
  paymentStatus: 'pending' | 'paid' | 'confirmed';
}

interface OvertimeFilter {
  status: 'all' | 'pending' | 'approved' | 'rejected';
  dateFrom: string;
  dateTo: string;
  paymentStatus: 'all' | 'pending' | 'paid' | 'confirmed';
}

const OvertimeHistory: React.FC = () => {
  const { user } = useAuth();
  
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<OvertimeFilter>({
    status: 'all',
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
    paymentStatus: 'all'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<OvertimeRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Carica i dati reali degli straordinari dal database
  React.useEffect(() => {
    const loadOvertimeRecords = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        
        // Carica gli straordinari dalla tabella overtime_requests
        const { data: overtimeData, error: overtimeError } = await supabase
          .from('overtime_requests')
          .select(`
            *,
            events!event_id(title)
          `)
          .eq('crew_id', user.id)
          .order('date', { ascending: false });
        
        if (overtimeError) {
          console.error('Errore nel caricamento straordinari:', overtimeError);
          setOvertimeRecords([]);
        } else {
          // Mappa i dati dal database al formato dell'interfaccia
          const mappedRecords: OvertimeRecord[] = (overtimeData || []).map(record => ({
            id: record.id,
            crewId: record.crew_id,
            warehouseId: record.warehouse_id,
            warehouseName: record.warehouse_id ? 'Magazzino' : undefined,
            eventId: record.event_id,
            eventTitle: record.crew_events?.title,
            date: record.date,
            startTime: record.start_time,
            endTime: record.end_time,
            hours: record.hours,
            baseRate: record.base_rate,
            overtimeRate: record.overtime_rate,
            totalAmount: record.total_amount,
            status: record.status,
            notes: record.notes,
            approvedBy: record.approved_by,
            approvedAt: record.approved_at ? new Date(record.approved_at) : undefined,
            rejectionReason: record.rejection_reason,
            submittedAt: new Date(record.submitted_at),
            paymentStatus: record.payment_status
          }));
          
          setOvertimeRecords(mappedRecords);
        }
      } catch (error) {
        console.error('Errore nel caricamento degli straordinari:', error);
        setOvertimeRecords([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadOvertimeRecords();
  }, [user?.id]);

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
      case 'approved': return 'Approvato';
      case 'rejected': return 'Rifiutato';
      case 'pending': return 'In Attesa';
      default: return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'paid': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confermato';
      case 'paid': return 'Pagato';
      case 'pending': return 'In Attesa';
      default: return status;
    }
  };

  const filteredRecords = overtimeRecords.filter(record => {
    // Search filter
    if (searchTerm && !record.warehouseName?.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !record.eventTitle?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !record.notes?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    if (filters.status !== 'all' && record.status !== filters.status) return false;

    // Date range filter
    if (filters.dateFrom && new Date(record.date) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(record.date) > new Date(filters.dateTo)) return false;

    // Payment status filter
    if (filters.paymentStatus !== 'all' && record.paymentStatus !== filters.paymentStatus) return false;

    return true;
  });

  const handleViewDetails = (record: OvertimeRecord) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  // Calculate summary statistics
  const pendingCount = filteredRecords.filter(r => r.status === 'pending').length;
  const approvedCount = filteredRecords.filter(r => r.status === 'approved').length;
  const rejectedCount = filteredRecords.filter(r => r.status === 'rejected').length;
  const totalHours = filteredRecords.reduce((sum, r) => sum + r.hours, 0);
  const totalAmount = filteredRecords.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.totalAmount, 0);
  const paidAmount = filteredRecords.filter(r => r.paymentStatus === 'confirmed' || r.paymentStatus === 'paid').reduce((sum, r) => sum + r.totalAmount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">I Miei Straordinari</h1>
        <p className="text-gray-600">Visualizza lo storico e lo stato dei tuoi straordinari</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ore Totali</p>
              <p className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}h</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-green-500 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Approvati</p>
              <p className="text-2xl font-bold text-gray-900">{approvedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-yellow-500 p-3 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Attesa</p>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-red-500 p-3 rounded-lg">
              <XCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Rifiutati</p>
              <p className="text-2xl font-bold text-gray-900">{rejectedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-purple-500 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Importo Totale</p>
              <p className="text-2xl font-bold text-gray-900">€{totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Filter className="h-5 w-5" />
          <span>Filtri</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cerca</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 border border-gray-300 rounded-md px-3 py-2"
                placeholder="Cerca per evento, magazzino, note..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">Tutti</option>
              <option value="pending">In Attesa</option>
              <option value="approved">Approvati</option>
              <option value="rejected">Rifiutati</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pagamento</label>
            <select
              value={filters.paymentStatus}
              onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value as any })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">Tutti</option>
              <option value="pending">In Attesa</option>
              <option value="paid">Pagato</option>
              <option value="confirmed">Confermato</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({
                status: 'all',
                dateFrom: '2024-01-01',
                dateTo: '2024-12-31',
                paymentStatus: 'all'
              })}
              className="w-full bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Da Data</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">A Data</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Overtime Records */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Straordinari ({filteredRecords.length})
          </h3>
        </div>
        
        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Nessun record di straordinari trovato</p>
            <p className="text-sm mt-1">Prova a modificare i filtri di ricerca</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredRecords.map((record) => (
              <div key={record.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-medium text-gray-900">
                        {record.eventTitle || record.warehouseName || 'Evento/Magazzino'}
                      </h4>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                        {getStatusLabel(record.status)}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(record.paymentStatus)}`}>
                        {getPaymentStatusLabel(record.paymentStatus)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(record.date).toLocaleDateString('it-IT')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>{record.startTime} - {record.endTime} ({record.hours}h)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span className="text-green-600 font-medium">€{record.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    {record.notes && (
                      <p className="text-sm text-gray-600 mt-2">{record.notes}</p>
                    )}
                    
                    {record.status === 'rejected' && record.rejectionReason && (
                      <div className="mt-2 p-2 bg-red-50 rounded-lg">
                        <p className="text-sm text-red-700">
                          <span className="font-medium">Motivo rifiuto:</span> {record.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleViewDetails(record)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Dettagli
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedRecord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Dettagli Straordinario
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Evento/Magazzino</label>
                    <p className="text-sm text-gray-900">{selectedRecord.eventTitle || selectedRecord.warehouseName || 'Evento/Magazzino'}</p>
                    <p className="text-xs text-gray-500">{selectedRecord.eventId ? 'Evento' : 'Magazzino'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data</label>
                    <p className="text-sm text-gray-900">{new Date(selectedRecord.date).toLocaleDateString('it-IT')}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Orario</label>
                    <p className="text-sm text-gray-900">{selectedRecord.startTime} - {selectedRecord.endTime}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Ore Straordinario</label>
                    <p className="text-sm text-gray-900">{selectedRecord.hours}h</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Note</label>
                    <p className="text-sm text-gray-900">{selectedRecord.notes || 'Nessuna nota'}</p>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tariffe</label>
                    <div className="space-y-1 mt-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tariffa Base:</span>
                        <span className="font-medium">€{selectedRecord.baseRate}/h</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tariffa Straordinario:</span>
                        <span className="font-medium text-green-600">€{selectedRecord.overtimeRate}/h</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-gray-200 mt-2">
                        <span className="font-medium">Importo Totale:</span>
                        <span className="font-bold text-green-600">€{selectedRecord.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Stato Richiesta</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedRecord.status)}`}>
                        {getStatusLabel(selectedRecord.status)}
                      </span>
                    </div>
                    {selectedRecord.status === 'approved' && selectedRecord.approvedAt && (
                      <div className="text-sm text-gray-600 mt-2">
                        <p>Approvato il {selectedRecord.approvedAt.toLocaleDateString('it-IT')}</p>
                      </div>
                    )}
                    {selectedRecord.status === 'rejected' && selectedRecord.rejectionReason && (
                      <div className="text-sm text-red-600 mt-2">
                        <p>Motivo rifiuto: {selectedRecord.rejectionReason}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Stato Pagamento</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${getPaymentStatusColor(selectedRecord.paymentStatus)}`}>
                        {getPaymentStatusLabel(selectedRecord.paymentStatus)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-600" />
                      <p className="text-xs text-gray-700">
                        Richiesta inviata il {selectedRecord.submittedAt.toLocaleDateString('it-IT')} alle {selectedRecord.submittedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 mt-6 pt-4 border-t border-gray-200">
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

export default OvertimeHistory;